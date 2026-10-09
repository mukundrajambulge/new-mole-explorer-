"""Receptor preparation: deterministic PDB cleaning -> [PDBFixer] -> [PDB2PQR+PROPKA] -> Meeko PDBQT."""
from __future__ import annotations

import io
import math
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


SITE_RADIUS_A = 8.0  # research digest C8: hetero groups within 8 A of the ligand are in the site
LIGAND_SELF_TOL_A = 0.05  # a hetero group whose heavy atoms all coincide with the submitted ligand IS the ligand
# Metal ions by element (AT-0057/0131: metals that may control binding are UNSUPPORTED, never silently deleted).
METAL_ELEMENTS = frozenset(
    "Li Be Na Mg Al K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Cs Ba La Ce Pr Nd Sm Eu Gd Tb Dy "
    "Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi U".split()
)
# Interim list of common enzyme cofactors by CCD component id (hemes, flavins, nicotinamides, nucleotide cofactors,
# CoA, SAM/SAH, PLP, ThDP, pterins, quinones, Fe-S clusters, chlorophylls). Unknown groups stay OTHER.
COFACTOR_CCD = frozenset(
    "HEM HEC HEA HEB HDD HAS DHE FAD FDA FMN RBF NAD NAI NAP NDP NDC NMN ATP ADP ANP ACP GTP GDP GNP GCP COA ACO SCA "
    "SAM SAH SFG PLP PMP TPP TDP H4B BH4 HBI MTE MGD PQQ TPQ UQ1 UQ2 U10 PL9 MQ7 F43 SF4 FES F3S CLA CHL BCL BPH LPA "
    "B12 CNC COB".split()
)


def _group_label(k) -> str:
    return f"{k[0]}:{k[1].strip() or '_'}:{k[2]}{k[3].strip()}"


def _min_dist(a: dict, site: list) -> float:
    ax, ay, az = a["x"], a["y"], a["z"]
    return math.sqrt(min((ax - x) ** 2 + (ay - y) ** 2 + (az - z) ** 2 for x, y, z in site))


def classify_hetero(atoms: list[dict], site: list | None) -> dict:
    """Classify every non-water hetero group of the selected model (all chains) as LIGAND (the submitted ligand
    itself, matched by coordinates), METAL, COFACTOR or OTHER, with its distance to the submitted ligand."""
    groups: dict = {}
    for a in atoms:
        if a["het"] and a["res"] not in limits.WATER_RESIDUES:
            groups.setdefault((a["res"], a["chain"], a["seq"], a["icode"]), []).append(a)
    out = {}
    for k, members in groups.items():
        if k[0] in COFACTOR_CCD:
            cls = "COFACTOR"
        elif any(m["el"] in METAL_ELEMENTS for m in members):
            cls = "METAL"
        else:
            cls = "OTHER"
        dist = None
        if site:
            dist = min(_min_dist(m, site) for m in members)
            heavy = [m for m in members if m["el"] != "H"]
            if heavy and len(heavy) <= len(site) and all(_min_dist(m, site) <= LIGAND_SELF_TOL_A for m in heavy):
                cls = "LIGAND"
        out[k] = {"cls": cls, "dist": dist, "inSite": dist is None or dist <= SITE_RADIUS_A}
    return out


def _site_decisions(hetero: dict, site: list | None, n: int) -> list[dict]:
    """R.5: metal or cofactor in the site -> CHEMISTRY_UNSUPPORTED; other site groups are removed with an ack."""
    critical = sorted((k for k, g in hetero.items() if g["cls"] in ("METAL", "COFACTOR") and g["inSite"]), key=lambda k: (k[1], k[2], k[3], k[0]))
    if critical:
        if site:
            shown = ", ".join(f"{_group_label(k)} ({hetero[k]['cls']}, {hetero[k]['dist']:.2f} A)" for k in critical[:12])
            where = f"within {SITE_RADIUS_A:.1f} A of the ligand"
        else:
            shown = ", ".join(f"{_group_label(k)} ({hetero[k]['cls']})" for k in critical[:12])
            where = "possibly in the site (no submitted ligand coordinates, so the site is undetermined)"
        raise Blocked("CHEMISTRY_UNSUPPORTED", f"{len(critical)} metal/cofactor groups {where}: {shown}; the interim profile cannot model them and will not delete them (AT-0057, AT-0131)")
    other = sorted((k for k, g in hetero.items() if g["cls"] == "OTHER" and g["inSite"] and site), key=lambda k: (k[1], k[2], k[3], k[0]))
    if not other:
        return []
    shown = ", ".join(f"{_group_label(k)} {hetero[k]['dist']:.2f} A" for k in other[:20]) + (f" (+{len(other) - 20} more)" if len(other) > 20 else "")
    return [_decision("HETERO_SITE", f"{len(other)} non-metal, non-cofactor hetero groups within {SITE_RADIUS_A:.1f} A of the ligand are removed: {shown}", n, n, True)]


def site_hetero_record(hetero: dict) -> list[dict]:
    rows = [{"group": _group_label(k), "class": g["cls"], "distance": None if g["dist"] is None else round(g["dist"], 2), "inSite": g["inSite"]}
            for k, g in sorted(hetero.items(), key=lambda kv: (kv[0][1], kv[0][2], kv[0][3], kv[0][0]))]
    return rows[:500]


def clean(text: str, opts: dict, site: list | None = None, hetero_out: list | None = None) -> tuple[list[dict], list[dict], list[str]]:
    atoms, models = parse_pdb(text)
    decisions, warnings = [], []
    n0 = len(atoms)
    if models > 1:
        atoms = [a for a in atoms if a["model"] == 1]
        decisions.append(_decision("MODEL", f"keep model 1 of {models}", n0, len(atoms), True))
    # Classified on the whole selected model, before the chain filter: a metal in another chain can still be in the site.
    hetero = classify_hetero(atoms, site)
    decisions.extend(_site_decisions(hetero, site, len(atoms)))
    if hetero_out is not None:
        hetero_out.extend(site_hetero_record(hetero))
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
                g = hetero[k]
                tag = "" if g["cls"] == "OTHER" else f" [{g['cls']}]"
                groups.append(f"{_group_label(k)}{tag}")
        shown = ", ".join(groups[:20]) + (f" (+{len(groups) - 20} more)" if len(groups) > 20 else "")
        before = len(atoms)
        atoms = [a for a in atoms if not a["het"]]
        decisions.append(_decision("HETERO", f"remove {len(groups)} hetero groups (none is a metal or cofactor in the site): {shown}", before, len(atoms), True))
    alts = [a for a in atoms if a["alt"] != " "]
    if alts:
        # Group by residue identity (chain, resSeq, iCode), not resName: microheterogeneity (alt A SER / alt B ALA)
        # must resolve to ONE residue, never two overlapping copies.
        occ: dict = {}
        names: dict = {}
        for a in alts:
            k = (a["chain"], a["seq"], a["icode"])
            occ.setdefault(k, {}).setdefault(a["alt"], 0.0)
            occ[k][a["alt"]] += a["occ"]
            names.setdefault(k, {}).setdefault(a["alt"], a["res"])
        chosen = {k: sorted(v.items(), key=lambda kv: (-round(kv[1], 4), kv[0]))[0][0] for k, v in occ.items()}
        hetero_res = sorted(k for k, v in names.items() if len(set(v.values())) > 1)
        before = len(atoms)
        atoms = [a for a in atoms if a["alt"] == " " or chosen[(a["chain"], a["seq"], a["icode"])] == a["alt"]]
        for a in atoms:  # shared (blank-altloc) atoms take the residue name of the kept alternate
            k = (a["chain"], a["seq"], a["icode"])
            if k in chosen:
                a["res"] = names[k][chosen[k]]
        decisions.append(_decision("ALTLOC", f"keep highest-occupancy altloc (ties: first label) in {len(chosen)} residues", before, len(atoms), True))
        if hetero_res:
            shown = ", ".join(f"{c.strip() or '_'}:{s}{i.strip()}={'/'.join(f'{al}:{names[(c, s, i)][al]}' for al in sorted(names[(c, s, i)]))}->{names[(c, s, i)][chosen[(c, s, i)]]}"
                              for c, s, i in hetero_res[:10])
            decisions.append(_decision("MICROHETEROGENEITY", f"{len(hetero_res)} residues with alternate residue types; kept one per residue: {shown}", before, len(atoms), True))
    if not atoms:
        raise Blocked("EMPTY_RECEPTOR", "no polymer atoms remain after the selected choices")
    seen_atoms = set()
    for a in atoms:
        k = (a["chain"], a["seq"], a["icode"], a["name"].strip())
        if k in seen_atoms:
            raise Blocked("MALFORMED_INPUT", f"duplicate atom {k[3]} in residue {a['res']} {k[0].strip() or '_'}:{k[1]}{k[2].strip()}")
        seen_atoms.add(k)
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
        return pdb_text, total, None, 0
    from openmm.app import PDBFile

    fixer.addMissingAtoms(seed=0)
    buf = io.StringIO()
    PDBFile.writeFile(fixer.topology, fixer.positions, buf, keepIds=True)
    atoms, _ = parse_pdb(buf.getvalue(), "pdbfixer output")
    for a in atoms:
        a["het"] = False
    submitted = {(a["chain"], a["seq"], a["icode"], a["name"].strip()) for a in parse_pdb(pdb_text, "receptor")[0]}
    n_oxt = rebuild_terminal_oxt(atoms, submitted)
    out = write_pdb(atoms)
    notes = [f"added {total} missing heavy/terminal atoms"]
    if n_oxt:
        notes.append(f"{n_oxt} added C-terminal OXT placed by ideal carboxylate geometry")
    st = stage("pdbfixer", tool_version("pdbfixer"), {"addMissingAtoms": True, "missingResidues": "not built", "seed": 0, "openmm": tool_version("openmm"),
                                                      "oxt": "ideal sp2 (C-O 1.25 A, 120 deg)"},
               sha256_text(pdb_text), sha256_text(out), notes)
    return out, total, st, n_oxt


OXT_BOND = 1.25


def rebuild_terminal_oxt(atoms: list[dict], submitted: set) -> int:
    """Place every generated OXT in the CA-C-O plane, opposite the CA/O bisector (ideal carboxylate).

    PDBFixer's addMissingAtoms can leave OXT ~1.7 A from CA (bent ~80 deg); Meeko's C-terminal template then
    perceives an O-CA bond and RDKit rejects the residue (TEMPLATE_MISMATCH). Only atoms PDBFixer added are moved.
    """
    by_res: dict = {}
    for a in atoms:
        by_res.setdefault((a["chain"], a["seq"], a["icode"]), {})[a["name"].strip()] = a
    moved = 0
    for key, res in by_res.items():
        oxt, c, ca, o = res.get("OXT"), res.get("C"), res.get("CA"), res.get("O")
        if oxt is None or c is None or ca is None or o is None or (*key, "OXT") in submitted:
            continue
        u = []
        for other in (ca, o):
            v = [other[k] - c[k] for k in ("x", "y", "z")]
            n = math.sqrt(sum(t * t for t in v))
            if n < 1e-6:
                break
            u.append([t / n for t in v])
        if len(u) != 2:
            continue
        d = [-(u[0][i] + u[1][i]) for i in range(3)]
        n = math.sqrt(sum(t * t for t in d))
        if n < 1e-6:
            continue
        for i, k in enumerate(("x", "y", "z")):
            oxt[k] = round(c[k] + OXT_BOND * d[i] / n, 3)
        moved += 1
    return moved


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


HIS_NAMES = frozenset({"HIS", "HID", "HIE", "HIP", "HSD", "HSE", "HSP"})


def his_states(out_atoms: list[dict], submitted: list[dict], protonation: str, site: list | None) -> list[dict]:
    """R.6 / AT-0052: the HID/HIE/HIP microstate of every His, read from the ring-N hydrogens actually written,
    with its source (submitted H, PROPKA or Meeko template) and whether it lies in the site."""
    sub_h = {}
    for a in submitted:
        if a["res"] in HIS_NAMES and a["el"] == "H":
            sub_h.setdefault((a["chain"], a["seq"], a["icode"]), set()).add(a["name"].strip())
    res: dict = {}
    for a in out_atoms:
        if a["res"] in HIS_NAMES:
            res.setdefault((a["chain"], a["seq"], a["icode"]), []).append(a)
    rows = []
    for k in sorted(res, key=lambda k: (k[0], k[1], k[2])):
        names = {a["name"].strip() for a in res[k]}
        d1, e2 = "HD1" in names, "HE2" in names
        state = "HIP" if d1 and e2 else "HID" if d1 else "HIE" if e2 else "UNPROTONATED"
        if protonation == "PROPKA_PREVIEW":
            source = "PROPKA"
        elif sub_h.get(k, set()) & {"HD1", "HE2"}:
            source = "SUBMITTED_H"
        else:
            source = "MEEKO_TEMPLATE"
        dist = None if not site else min(_min_dist(a, site) for a in res[k])
        rows.append({"chain": k[0].strip() or "_", "resSeq": k[1], "iCode": k[2].strip(), "state": state, "source": source,
                     "distance": None if dist is None else round(dist, 2), "inSite": dist is None or dist <= SITE_RADIUS_A})
    return rows


def _his_decisions(rows: list[dict], site: list | None, n: int) -> list[dict]:
    if not rows:
        return []
    counts = {s: sum(1 for r in rows if r["state"] == s) for s in ("HID", "HIE", "HIP", "UNPROTONATED")}
    sources = sorted({r["source"] for r in rows})
    out = [_decision("HIS_STATES", f"{len(rows)} His: " + ", ".join(f"{v} {k}" for k, v in counts.items() if v) + f"; source {'/'.join(sources)}; per-residue list in plan.histidines",
                     n, n, False)]
    in_site = [r for r in rows if r["inSite"]]
    if in_site:
        where = f"within {SITE_RADIUS_A:.1f} A of the ligand" if site else "with an undetermined site (no submitted ligand coordinates)"
        shown = ", ".join(f"{r['chain']}:{r['resSeq']}{r['iCode']}={r['state']}({r['source']})" for r in in_site[:20])
        out.append(_decision("HIS_SITE_STATES", f"{len(in_site)} His {where}; confirm each microstate: {shown}", n, n, True))
    return out


def prepare(text: str, opts: dict, workdir: str, site: list | None = None) -> dict:
    hetero_rows: list = []
    atoms, decisions, warnings = clean(text, opts, site, hetero_rows)
    stages = []
    raw_sha = sha256_text(text)
    h_sub = _count_h(atoms)
    cleaned = write_pdb(atoms)
    stages.append(stage("mole_prep.receptor_clean", "0.1.0", {"model": 1, "waters": "removed", "hetero": "classified in an 8 A site; metal/cofactor in site UNSUPPORTED, others removed", "altloc": "max-occupancy"},
                        raw_sha, sha256_text(cleaned), [d["key"] for d in decisions]))
    generated = False
    current = cleaned
    n_atoms = len(atoms)
    fixed, n_missing, st, n_oxt = run_pdbfixer(current, opts)
    if n_missing:
        added = opts.get("addMissingAtoms")
        after = len(parse_pdb(fixed, "pdbfixer output")[0]) if added else n_atoms
        decisions.append(_decision("MISSING_HEAVY_ATOMS", f"{n_missing} missing heavy/terminal atoms: " + ("added by PDBFixer (seed 0), generated coordinates (PREVIEW_UNQUALIFIED)" if added else "not added (opt-in)"), n_atoms, after, True))
        if added and n_oxt:
            decisions.append(_decision("TERMINAL_OXT", f"{n_oxt} generated C-terminal OXT placed by ideal carboxylate geometry (C-O {OXT_BOND} A, in CA-C-O plane)", after, after, True))
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
        generated = True
        decisions.append(_decision("RECEPTOR_TEMPLATE_HEAVY_ATOMS", f"Meeko templates changed heavy atoms {heavy_in} -> {heavy_out} (PREVIEW_UNQUALIFIED)", n_atoms, len(out_atoms), True))
    if protonation == "PROPKA_PREVIEW":
        source = "PROPKA_PREVIEW"
    elif h_out != h_in:
        source = "MEEKO_TEMPLATES_PREVIEW"
    else:
        source = "EXPLICIT_SUBMITTED"
    if h_out != h_in:
        generated = True
        decisions.append(_decision("RECEPTOR_TEMPLATE_HYDROGENS", f"Meeko residue templates set hydrogens {h_in} -> {h_out} (generated, PREVIEW_UNQUALIFIED; protonation source {source})", n_atoms, len(out_atoms), True))
    decisions.append(_decision("RECEPTOR_CHARGES", "Gasteiger charges from Meeko residue templates", len(out_atoms), len(out_atoms), False))
    histidines = his_states(out_atoms, atoms, protonation, site)
    decisions.extend(_his_decisions(histidines, site, len(out_atoms)))
    stages.append(stage("meeko.receptor", tool_version("meeko"), {"templates": "default", "charge_model": "gasteiger(template)", "allow_bad_res": False},
                        sha256_text(current), sha256_text(rigid), ["RECEPTOR_CHARGES"]))
    pdbqt_atoms = parse_pdbqt_atoms(rigid)
    return {
        "decisions": decisions, "warnings": warnings, "stages": stages, "generated": generated, "protonationSource": source,
        "pdbqt": rigid, "clean_pdb": prepared_pdb if prepared_pdb.endswith("\n") else prepared_pdb + "\n",
        "canonical": {"schemaVersion": 1, "subject": "receptor", "atoms": pdbqt_atoms, "bonds": None, "bondsSource": "UNAVAILABLE (residue templates; not exported in 5.2 part 1)"},
        "histidines": histidines, "siteHetero": hetero_rows,
        "atoms": len(pdbqt_atoms), "hSubmitted": h_sub, "hAdded": max(0, h_out - h_in) if protonation != "PROPKA_PREVIEW" else max(0, h_out - h_sub),
    }
