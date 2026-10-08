"""Receptor preparation: deterministic PDB cleaning -> [PDBFixer] -> [PDB2PQR+PROPKA] -> Meeko PDBQT."""
from __future__ import annotations

import io
import os
import shutil
import subprocess
import sys

from . import limits
from .limits import Blocked
from .manifest import sha256_text, stage, tool_version


def _decision(key, choice, before, after, ack):
    return {"key": key, "choice": choice[:500], "atomsBefore": int(before), "atomsAfter": int(after), "requiresAck": bool(ack)}


def _element(line: str) -> str:
    el = line[76:78].strip() if len(line) >= 78 else ""
    if not el:
        name = line[12:16].strip()
        el = "".join(c for c in name if c.isalpha())[:1]
    return el[:1].upper() + el[1:].lower()


def parse_pdb(text: str, what: str = "receptor") -> tuple[list[dict], int]:
    """Parse ATOM/HETATM records strictly. Returns (atoms, model count). Malformed -> BLOCKED."""
    atoms: list[dict] = []
    model = 0
    models = 0
    for n, line in enumerate(text.splitlines(), 1):
        rec = line[:6]
        if rec == "MODEL ":
            models += 1
            model = models
            continue
        if rec not in ("ATOM  ", "HETATM"):
            continue
        if len(line) < 54:
            raise Blocked("MALFORMED_INPUT", f"{what} line {n}: truncated coordinate fields")
        try:
            x, y, z = float(line[30:38]), float(line[38:46]), float(line[46:54])
            occ = float(line[54:60]) if line[54:60].strip() else 1.0
            bf = float(line[60:66]) if line[60:66].strip() else 0.0
            resseq = int(line[22:26])
        except ValueError:
            raise Blocked("MALFORMED_INPUT", f"{what} line {n}: unparseable coordinate or residue fields") from None
        limits.require_finite((x, y, z, occ, bf), f"{what} line {n}")
        atoms.append({
            "het": rec == "HETATM", "name": line[12:16], "alt": line[16], "res": line[17:20].strip(),
            "chain": line[21], "seq": resseq, "icode": line[26] if len(line) > 26 else " ",
            "x": x, "y": y, "z": z, "occ": occ, "b": bf, "el": _element(line), "model": model or 1,
        })
        if len(atoms) > limits.MAX_RECEPTOR_ATOMS:
            raise Blocked("OVERSIZE_INPUT", f"{what} has more than {limits.MAX_RECEPTOR_ATOMS} atoms")
    if not atoms:
        raise Blocked("MALFORMED_INPUT", f"{what} has no ATOM/HETATM records")
    return atoms, max(models, 1)


def write_pdb(atoms: list[dict]) -> str:
    """Canonical PDB text: renumbered serials, no altloc, TER per chain, no headers/CONECT/timestamps."""
    out = []
    prev_chain = None
    serial = 0
    for a in atoms:
        if prev_chain is not None and a["chain"] != prev_chain:
            out.append("TER")
        prev_chain = a["chain"]
        serial += 1
        out.append(
            f"ATOM  {serial % 100000:5d} {a['name']:<4} {a['res']:>3} {a['chain']}{a['seq']:4d}{a['icode']}   "
            f"{a['x']:8.3f}{a['y']:8.3f}{a['z']:8.3f}{a['occ']:6.2f}{a['b']:6.2f}          {a['el']:>2}"
        )
    out.append("TER")
    out.append("END")
    return "\n".join(out) + "\n"


def _count_h(atoms) -> int:
    return sum(1 for a in atoms if a["el"] == "H")


def clean(text: str, opts: dict) -> tuple[list[dict], list[dict], list[str]]:
    atoms, models = parse_pdb(text)
    decisions, warnings = [], []
    n0 = len(atoms)
    if models > 1:
        atoms = [a for a in atoms if a["model"] == 1]
        decisions.append(_decision("MODEL", f"keep model 1 of {models}", n0, len(atoms), True))
    chains = opts.get("chainIds")
    if chains:
        present = sorted({a["chain"] for a in atoms})
        missing = [c for c in chains if c not in present]
        if missing:
            raise Blocked("CHAIN_NOT_FOUND", f"chains not present: {','.join(missing)}")
        keep = set(chains)
        before = len(atoms)
        atoms = [a for a in atoms if a["chain"] in keep]
        decisions.append(_decision("CHAINS", f"keep chains {','.join(chains)} of {','.join(present)}", before, len(atoms), False))
    waters = [a for a in atoms if a["res"] in limits.WATER_RESIDUES]
    if waters:
        if opts.get("keepWaters"):
            raise Blocked("KEEP_WATERS_UNSUPPORTED", "keeping waters is not supported by the interim profile")
        before = len(atoms)
        atoms = [a for a in atoms if a["res"] not in limits.WATER_RESIDUES]
        decisions.append(_decision("WATERS", f"remove {len(waters)} water atoms", before, len(atoms), False))
    het = [a for a in atoms if a["het"]]
    if het:
        groups = []
        seen = set()
        for a in het:
            k = (a["res"], a["chain"], a["seq"], a["icode"])
            if k not in seen:
                seen.add(k)
                groups.append(f"{a['res']}:{a['chain'].strip() or '_'}:{a['seq']}")
        shown = ", ".join(groups[:20]) + (f" (+{len(groups) - 20} more)" if len(groups) > 20 else "")
        before = len(atoms)
        atoms = [a for a in atoms if not a["het"]]
        decisions.append(_decision("HETERO", f"remove {len(groups)} hetero groups: {shown}", before, len(atoms), True))
    alts = [a for a in atoms if a["alt"] != " "]
    if alts:
        occ: dict = {}
        for a in alts:
            k = (a["chain"], a["seq"], a["icode"], a["res"])
            occ.setdefault(k, {}).setdefault(a["alt"], 0.0)
            occ[k][a["alt"]] += a["occ"]
        chosen = {k: sorted(v.items(), key=lambda kv: (-round(kv[1], 4), kv[0]))[0][0] for k, v in occ.items()}
        before = len(atoms)
        atoms = [a for a in atoms if a["alt"] == " " or chosen[(a["chain"], a["seq"], a["icode"], a["res"])] == a["alt"]]
        decisions.append(_decision("ALTLOC", f"keep highest-occupancy altloc (ties: first label) in {len(chosen)} residues", before, len(atoms), True))
    if not atoms:
        raise Blocked("EMPTY_RECEPTOR", "no polymer atoms remain after the selected choices")
    bad_res = sorted({a["res"] for a in atoms if a["res"] not in limits.PROTEIN_RESIDUES})
    if bad_res:
        raise Blocked("UNSUPPORTED_RESIDUE", f"non-standard polymer residues: {','.join(bad_res[:20])}")
    bad_el = sorted({a["el"] for a in atoms if a["el"] not in limits.RECEPTOR_ELEMENTS})
    if bad_el:
        raise Blocked("UNSUPPORTED_ELEMENT", f"receptor elements not supported: {','.join(bad_el[:20])}")
    for a in atoms:
        a["alt"] = " "
    return atoms, decisions, warnings


def _fixer(pdb_text: str):
    from pdbfixer import PDBFixer

    fixer = PDBFixer(pdbfile=io.StringIO(pdb_text))
    fixer.findMissingResidues()
    fixer.missingResidues = {}  # never build missing loops
    fixer.findMissingAtoms()
    return fixer


def run_pdbfixer(pdb_text: str, opts: dict):
    """Count missing heavy atoms always (plan); add them only when opted in."""
    fixer = _fixer(pdb_text)
    n_missing = sum(len(v) for v in fixer.missingAtoms.values())
    n_term = sum(len(v) for v in fixer.missingTerminals.values())
    total = n_missing + n_term
    if not opts.get("addMissingAtoms") or total == 0:
        return pdb_text, total, None
    from openmm.app import PDBFile

    fixer.addMissingAtoms(seed=0)
    buf = io.StringIO()
    PDBFile.writeFile(fixer.topology, fixer.positions, buf, keepIds=True)
    atoms, _ = parse_pdb(buf.getvalue(), "pdbfixer output")
    for a in atoms:
        a["het"] = False
    out = write_pdb(atoms)
    st = stage("pdbfixer", tool_version("pdbfixer"), {"addMissingAtoms": True, "missingResidues": "not built", "seed": 0, "openmm": tool_version("openmm")},
               sha256_text(pdb_text), sha256_text(out), [f"added {total} missing heavy/terminal atoms"])
    return out, total, st


def run_pdb2pqr(pdb_text: str, ph: float, workdir: str):
    """Opt-in PROPKA protonation through PDB2PQR in a child process (PREVIEW_UNQUALIFIED)."""
    if os.path.isdir(workdir):
        shutil.rmtree(workdir)
    os.makedirs(workdir)
    with open(os.path.join(workdir, "rec_in.pdb"), "w", newline="\n") as f:
        f.write(pdb_text)
    argv = [sys.executable, "-I", "-c", "import sys; from pdb2pqr.main import main; sys.exit(main())",
            "--ff=AMBER", "--titration-state-method=propka", f"--with-ph={ph:.2f}", "--pdb-output=rec_h.pdb",
            "--log-level=ERROR", "rec_in.pdb", "rec.pqr"]
    try:
        r = subprocess.run(argv, cwd=workdir, capture_output=True, text=True, timeout=limits.STAGE_TIMEOUT_S, env=dict(os.environ))
    except subprocess.TimeoutExpired:
        raise Blocked("STAGE_TIMEOUT", f"pdb2pqr exceeded {limits.STAGE_TIMEOUT_S} s") from None
    out_path = os.path.join(workdir, "rec_h.pdb")
    if r.returncode != 0 or not os.path.isfile(out_path):
        tail = (r.stderr or r.stdout or "").strip().splitlines()[-1:] or ["no output"]
        raise Blocked("TOOL_FAILED", f"pdb2pqr failed: {tail[0]}")
    with open(out_path) as f:
        text = f.read()
    shutil.rmtree(workdir, ignore_errors=True)
    atoms, _ = parse_pdb(text, "pdb2pqr output")
    for a in atoms:
        a["het"] = False
    return write_pdb(atoms), atoms


def parse_pdbqt_atoms(pdbqt: str) -> list[dict]:
    rows = []
    for line in pdbqt.splitlines():
        if line.startswith(("ATOM  ", "HETATM")):
            rows.append({
                "name": line[12:16].strip(), "res": line[17:20].strip(), "chain": line[21].strip(), "seq": int(line[22:26]),
                "x": round(float(line[30:38]), 3), "y": round(float(line[38:46]), 3), "z": round(float(line[46:54]), 3),
                "charge": round(float(line[70:76]), 3), "adType": line[77:79].strip(),
            })
    return rows


def prepare(text: str, opts: dict, workdir: str) -> dict:
    atoms, decisions, warnings = clean(text, opts)
    stages = []
    raw_sha = sha256_text(text)
    h_sub = _count_h(atoms)
    cleaned = write_pdb(atoms)
    stages.append(stage("mole_prep.receptor_clean", "0.1.0", {"model": 1, "waters": "removed", "hetero": "removed", "altloc": "max-occupancy"},
                        raw_sha, sha256_text(cleaned), [d["key"] for d in decisions]))
    generated = False
    current = cleaned
    n_atoms = len(atoms)
    fixed, n_missing, st = run_pdbfixer(current, opts)
    if n_missing:
        added = opts.get("addMissingAtoms")
        after = len(parse_pdb(fixed, "pdbfixer output")[0]) if added else n_atoms
        decisions.append(_decision("MISSING_HEAVY_ATOMS", f"{n_missing} missing heavy/terminal atoms: " + ("added by PDBFixer (seed 0)" if added else "not added (opt-in)"), n_atoms, after, True))
        if added:
            generated = True
            stages.append(st)
            current, n_atoms = fixed, after
        else:
            warnings.append(f"{n_missing} missing heavy/terminal atoms were not added; Meeko templates may reject affected residues")
    protonation = opts["protonation"]
    if protonation == "PROPKA_PREVIEW":
        protonated, patoms = run_pdb2pqr(current, opts["pH"], workdir)
        decisions.append(_decision("RECEPTOR_PROTONATION", f"PDB2PQR+PROPKA at pH {opts['pH']:.2f} (PREVIEW_UNQUALIFIED; PDB2PQR also rebuilds missing heavy atoms); hydrogens {_count_h(parse_pdb(current)[0])} -> {_count_h(patoms)}", n_atoms, len(patoms), True))
        stages.append(stage("pdb2pqr+propka", f"{tool_version('pdb2pqr')}/{tool_version('propka')}", {"ff": "AMBER", "titration": "propka", "pH": round(opts["pH"], 2)},
                            sha256_text(current), sha256_text(protonated), ["RECEPTOR_PROTONATION"]))
        generated = True
        current, n_atoms = protonated, len(patoms)
    else:
        decisions.append(_decision("RECEPTOR_PROTONATION", f"keep submitted hydrogens ({h_sub}); no pKa model", n_atoms, n_atoms, False))
    h_in = _count_h(parse_pdb(current)[0])

    from meeko import MoleculePreparation, PDBQTWriterLegacy, Polymer, PolymerCreationError, ResidueChemTemplates

    try:
        polymer = Polymer.from_pdb_string(current, ResidueChemTemplates.create_from_defaults(), MoleculePreparation())
        rigid, _flex = PDBQTWriterLegacy.write_from_polymer(polymer)
        prepared_pdb = polymer.to_pdb()
    except (PolymerCreationError, RuntimeError, ValueError, KeyError) as e:
        raise Blocked("TEMPLATE_MISMATCH", f"Meeko residue templates rejected the receptor: {limits.scrub(str(e))[:300]}") from None
    out_atoms, _ = parse_pdb(prepared_pdb, "meeko output")
    h_out = _count_h(out_atoms)
    heavy_in = n_atoms - h_in
    heavy_out = len(out_atoms) - h_out
    if heavy_out != heavy_in:
        decisions.append(_decision("RECEPTOR_TEMPLATE_HEAVY_ATOMS", f"Meeko templates changed heavy atoms {heavy_in} -> {heavy_out}", n_atoms, len(out_atoms), True))
    if h_out != h_in:
        generated = True
        decisions.append(_decision("RECEPTOR_TEMPLATE_HYDROGENS", f"Meeko residue templates set hydrogens {h_in} -> {h_out} (generated, PREVIEW_UNQUALIFIED)", n_atoms, len(out_atoms), True))
    decisions.append(_decision("RECEPTOR_CHARGES", "Gasteiger charges from Meeko residue templates", len(out_atoms), len(out_atoms), False))
    stages.append(stage("meeko.receptor", tool_version("meeko"), {"templates": "default", "charge_model": "gasteiger(template)", "allow_bad_res": False},
                        sha256_text(current), sha256_text(rigid), ["RECEPTOR_CHARGES"]))
    pdbqt_atoms = parse_pdbqt_atoms(rigid)
    return {
        "decisions": decisions, "warnings": warnings, "stages": stages, "generated": generated,
        "pdbqt": rigid, "clean_pdb": prepared_pdb if prepared_pdb.endswith("\n") else prepared_pdb + "\n",
        "canonical": {"schemaVersion": 1, "subject": "receptor", "atoms": pdbqt_atoms, "bonds": None, "bondsSource": "UNAVAILABLE (residue templates; not exported in 5.2 part 1)"},
        "atoms": len(pdbqt_atoms), "hSubmitted": h_sub, "hAdded": max(0, h_out - h_in) if protonation != "PROPKA_PREVIEW" else max(0, h_out - h_sub),
    }
