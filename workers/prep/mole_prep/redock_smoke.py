"""Smoke-redock helpers (task R.1): independent starting ligand and symmetry-exact docking RMSD.

SMOKE: implementation sanity, not validation.

- start_ligand: prepares the ligand from the CCD isomeric SMILES alone (ligand.prepare, format "smi"), so the
  coordinates are an RDKit ETKDGv3 conformer (seed ligand.ETKDG_SEED), never the crystal pose [AT-0173].
  It also records which prepared atom each PDBQT atom is (coordinate identity on the start conformer), because
  Vina writes poses in the input PDBQT atom order.
- docking_rmsd: heavy-atom RMSD in the receptor frame with no superposition [AT-0142..0150]. Candidate mappings
  are the graph isomorphisms probe -> reference that RDKit enumerates (uniquify=False, useChirality=True); each is
  then checked exactly (element, formal charge, aromaticity, hydrogen count, bond order, CIP labels of every
  stereo atom and double bond). The symmetric RMSD is the minimum over the surviving mappings; the direct RMSD
  uses the identity mapping (both preparations number atoms canonically) when that identity is itself one of
  the valid mappings. No mapping, or more than MAX_AUTOMORPHISMS, means UNDEFINED with a typed status:
  nearest-atom, Hungarian and index fallbacks are never used.
"""
from __future__ import annotations

import json
import math
import os
import re

from . import limits
from .limits import Blocked

MAX_AUTOMORPHISMS = 1_048_576  # AT-0145 budget per comparison
MAX_MAPPING_EVALUATIONS = 250_000_000  # mapping x atom evaluations per attempt
MAX_POSES = 400
H_TYPES = frozenset({"H", "HD", "HS"})
COORD_MATCH_TOL = 0.0015  # PDBQT writes %8.3f: at most 0.0005 A per component rounding


DUMMY_TYPE = re.compile(r"^G\d*$")  # Meeko macrocycle ring-closure pseudo atoms (G0..); CG0.. are real carbons


def _pdbqt_atoms(text: str) -> list[dict]:
    """Real atoms only (pseudo atoms of a Meeko-opened macrocycle are dropped)."""
    out = []
    for ln in text.splitlines():
        if ln.startswith(("ATOM", "HETATM")):
            t = ln[77:].split()
            typ = t[0] if t else ""
            if DUMMY_TYPE.match(typ):
                continue
            out.append({"type": typ, "xyz": (float(ln[30:38]), float(ln[38:46]), float(ln[46:54]))})
    return out


def parse_poses(text: str) -> list[dict]:
    """Vina output: MODEL blocks with 'REMARK VINA RESULT: score lb ub' and atoms in input order."""
    poses, cur = [], None
    for ln in text.splitlines():
        if ln.startswith("MODEL"):
            cur = {"score": None, "lines": []}
        elif ln.startswith("REMARK VINA RESULT:") and cur is not None:
            cur["score"] = float(ln.split()[3])
        elif ln.startswith("ENDMDL") and cur is not None:
            poses.append({"score": cur["score"], "atoms": _pdbqt_atoms("\n".join(cur["lines"]))})
            cur = None
        elif cur is not None:
            cur["lines"].append(ln)
    if not poses:
        raise Blocked("MALFORMED_INPUT", "no poses in the Vina output")
    if len(poses) > MAX_POSES:
        raise Blocked("OVERSIZE_INPUT", f"more than {MAX_POSES} poses")
    return poses


def pdbqt_to_mol_map(pdbqt: str, mol) -> list[int]:
    """For every heavy PDBQT atom (in file order) the index of the prepared-molecule atom it was written from."""
    conf = mol.GetConformer()
    heavy = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1]
    pos = {i: tuple(conf.GetAtomPosition(i)) for i in heavy}
    used: set[int] = set()
    out = []
    for at in _pdbqt_atoms(pdbqt):
        if at["type"] in H_TYPES:
            continue
        hits = [i for i in heavy if max(abs(pos[i][k] - at["xyz"][k]) for k in range(3)) <= COORD_MATCH_TOL]
        if len(hits) != 1 or hits[0] in used:
            raise Blocked("MAPPING_FAILED", "PDBQT heavy atoms do not identify the prepared atoms one-to-one")
        used.add(hits[0])
        out.append(hits[0])
    if len(out) != len(heavy):
        raise Blocked("MAPPING_FAILED", f"PDBQT has {len(out)} heavy atoms, the prepared ligand {len(heavy)}")
    return out


def start_ligand(smiles: str, opts: dict) -> dict:
    from rdkit import Chem

    from .ligand import ETKDG_SEED, prepare

    r = prepare(smiles + "\n", "smi", None, opts)
    if not r["embedded"]:
        raise Blocked("EMBED_FAILED", "the start ligand was not embedded by ETKDG")
    mol = Chem.MolFromMolBlock(r["sdf"].split("$$$$")[0], sanitize=True, removeHs=False)
    pmap = pdbqt_to_mol_map(r["pdbqt"], mol)
    return {"pdbqt": r["pdbqt"], "sdf": r["sdf"], "pdbqtHeavyToAtom": pmap, "conformer": {"method": "RDKit ETKDGv3", "seed": ETKDG_SEED, "numThreads": 1},
            "torsions": r["torsions"], "atoms": r["atoms"], "stereo": r["stereo"], "smiles": r["canonical"]["smiles"]}


def _heavy(mol):
    """Heavy-atom molecule plus full-index -> heavy-index map (RemoveHs keeps the relative order of heavy atoms)."""
    from rdkit import Chem

    full = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1]
    h = Chem.RemoveHs(mol)
    if h.GetNumAtoms() != len(full):
        raise Blocked("MAPPING_FAILED", "hydrogen removal changed the heavy-atom set")
    return h, {f: k for k, f in enumerate(full)}


def _labels(mol):
    from rdkit.Chem import rdCIPLabeler

    rdCIPLabeler.AssignCIPLabels(mol)
    atoms = {a.GetIdx(): a.GetProp("_CIPCode") for a in mol.GetAtoms() if a.HasProp("_CIPCode")}
    bonds = {(b.GetBeginAtomIdx(), b.GetEndAtomIdx()): b.GetProp("_CIPCode") for b in mol.GetBonds() if b.HasProp("_CIPCode")}
    return atoms, bonds


def _load_3d(sdf: str):
    from rdkit import Chem

    mol = Chem.MolFromMolBlock(sdf.split("$$$$")[0], sanitize=True, removeHs=False)
    if mol is None or not mol.GetNumConformers():
        raise Blocked("MALFORMED_INPUT", "molecule could not be parsed")
    Chem.AssignStereochemistryFrom3D(mol)
    return mol


def valid_mappings(probe_h, ref_h) -> tuple[str, list[tuple[int, ...]]]:
    """Exact chemistry- and stereo-preserving isomorphisms probe_h -> ref_h, or a typed failure status."""
    n = probe_h.GetNumAtoms()
    if n != ref_h.GetNumAtoms() or probe_h.GetNumBonds() != ref_h.GetNumBonds():
        return "NO_VALID_MAPPING", []
    cands = ref_h.GetSubstructMatches(probe_h, uniquify=False, useChirality=True, maxMatches=MAX_AUTOMORPHISMS + 1)
    if len(cands) > MAX_AUTOMORPHISMS:
        return "BUDGET_EXCEEDED", []
    pa, pb = _labels(probe_h)
    ra, rb = _labels(ref_h)
    rbond = {}
    for b in ref_h.GetBonds():
        rbond[(b.GetBeginAtomIdx(), b.GetEndAtomIdx())] = b
        rbond[(b.GetEndAtomIdx(), b.GetBeginAtomIdx())] = b

    def ok(m):
        for i in range(n):
            p, r = probe_h.GetAtomWithIdx(i), ref_h.GetAtomWithIdx(m[i])
            if (p.GetAtomicNum(), p.GetFormalCharge(), p.GetIsAromatic(), p.GetTotalNumHs()) != (r.GetAtomicNum(), r.GetFormalCharge(), r.GetIsAromatic(), r.GetTotalNumHs()):
                return False
            if pa.get(i) != ra.get(m[i]):
                return False
        for b in probe_h.GetBonds():
            i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
            rb_ = rbond.get((m[i], m[j]))
            if rb_ is None or rb_.GetBondType() != b.GetBondType():
                return False
            if pb.get((i, j)) != rb.get((rb_.GetBeginAtomIdx(), rb_.GetEndAtomIdx())):
                return False
        return True

    good = [tuple(m) for m in cands if ok(m)]
    return ("OK" if good else "NO_VALID_MAPPING"), good


def _rmsd(pose, ref, mapping) -> float:
    s = 0.0
    for i, j in enumerate(mapping):
        s += sum((pose[i][k] - ref[j][k]) ** 2 for k in range(3))
    return math.sqrt(s / len(mapping))


def docking_rmsd(ref_sdf: str, probe_sdf: str, pdbqt_heavy_to_atom: list[int], pose_texts: list[str]) -> dict:
    """Direct and symmetry-exact RMSD of every pose (probe atom order via the PDBQT map) against the crystal reference."""
    ref = _load_3d(ref_sdf)
    probe = _load_3d(probe_sdf)
    ref_h, _ = _heavy(ref)
    probe_h, probe_full_to_heavy = _heavy(probe)
    status, maps = valid_mappings(probe_h, ref_h)
    n = probe_h.GetNumAtoms()
    identity = tuple(range(n))
    direct_ok = status == "OK" and identity in set(maps)
    rconf = ref_h.GetConformer()
    rxyz = [tuple(rconf.GetAtomPosition(i)) for i in range(n)]
    order = [probe_full_to_heavy[i] for i in pdbqt_heavy_to_atom]
    runs = []
    for text in pose_texts:
        poses = parse_poses(text)
        if status == "OK" and len(maps) * len(poses) * n > MAX_MAPPING_EVALUATIONS:
            status, maps, direct_ok = "BUDGET_EXCEEDED", [], False
        rows = []
        for rank, p in enumerate(poses, 1):
            heavy = [a["xyz"] for a in p["atoms"] if a["type"] not in H_TYPES]
            if len(heavy) != n:
                raise Blocked("MAPPING_FAILED", f"pose has {len(heavy)} heavy atoms, the ligand {n}")
            xyz = [None] * n
            for k, hidx in enumerate(order):
                xyz[hidx] = heavy[k]
            sym = min(_rmsd(xyz, rxyz, m) for m in maps) if status == "OK" else None
            direct = _rmsd(xyz, rxyz, identity) if direct_ok else None
            rows.append({"rank": rank, "vinaScore": p["score"], "symmetricRmsd": sym, "directRmsd": direct})
        runs.append(rows)
    return {"status": status, "directStatus": "OK" if direct_ok else ("NO_IDENTITY_MAPPING" if status == "OK" else status),
            "mappings": len(maps), "heavyAtoms": n, "runs": runs}


def _read(root: str, rel: str, what: str) -> str:
    return limits.decode_ascii(limits.read_capped(limits.confined(root, rel), what), what)


def _write(root: str, rel: str, text: str) -> None:
    """Fixed output names only (never caller-supplied)."""
    full = os.path.join(os.path.realpath(root), *rel.split("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full + ".part", "w", encoding="ascii", newline="\n") as f:
        f.write(text)
    os.replace(full + ".part", full)


SAFE_REL = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9._-]*(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$")


def main(argv: list[str]) -> int:
    """redock_smoke.py start|rmsd : reads <cwd>/<cmd>-in.json, writes <cwd>/<cmd>.json. Exit 0 ok, 3 blocked, 2 bad input."""
    from .manifest import canonical_bytes, tool_version

    limits.harden_process()
    root = os.getcwd()
    if len(argv) != 1 or argv[0] not in ("start", "rmsd"):
        print("usage: redock_smoke.py start|rmsd")
        return 2
    cmd = argv[0]
    try:
        req = json.loads(_read(root, f"{cmd}-in.json", "request"))
        if cmd == "start":
            smiles = req["smiles"]
            if not isinstance(smiles, str) or not smiles or len(smiles) > 2000 or any(c.isspace() for c in smiles):
                raise Blocked("MALFORMED_INPUT", "smiles must be one SMILES token")
            r = start_ligand(smiles, {"pH": 7.4, "ligandProtonation": "EXPLICIT_SUBMITTED"})
            _write(root, "start/ligand.pdbqt", r.pop("pdbqt"))
            _write(root, "start/ligand.sdf", r.pop("sdf"))
            out = {"status": "OK", **r, "versions": {"rdkit": tool_version("rdkit"), "meeko": tool_version("meeko")}}
        else:
            rels = [req["ref"], req["probe"], req["map"], *req["poses"]]
            if not all(isinstance(x, str) and SAFE_REL.match(x) for x in rels) or len(req["poses"]) > 64:
                raise Blocked("PATH_REJECTED", "paths must be simple relative paths")
            pmap = json.loads(_read(root, req["map"], "start record"))["pdbqtHeavyToAtom"]
            out = docking_rmsd(_read(root, req["ref"], "reference"), _read(root, req["probe"], "probe"), pmap,
                               [_read(root, p, "poses") for p in req["poses"]])
            out["method"] = ("heavy-atom RMSD in the receptor frame, no superposition; symmetric = min over exact graph isomorphisms "
                             "(RDKit GetSubstructMatches uniquify=False useChirality=True, then element/charge/aromaticity/H-count/bond-order/CIP checks); "
                             f"budget {MAX_AUTOMORPHISMS} mappings; direct = canonical-order identity mapping; UNDEFINED when no valid mapping")
            out["rdkit"] = tool_version("rdkit")
    except Blocked as e:
        _write(root, f"{cmd}.json", json.dumps({"status": "BLOCKED", "code": e.code, "message": limits.scrub(e.message)[:400]}))
        return 3
    except (KeyError, TypeError, ValueError) as e:
        _write(root, f"{cmd}.json", json.dumps({"status": "BAD_INPUT", "message": type(e).__name__}))
        return 2
    _write(root, f"{cmd}.json", canonical_bytes(out).decode("ascii"))
    return 0
