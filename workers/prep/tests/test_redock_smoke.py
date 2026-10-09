"""R.1 smoke-redock helpers: independent start ligand and symmetry-exact docking RMSD. Real CCD/RCSB fixtures only."""
from __future__ import annotations

import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import ccd  # noqa: E402
from mole_prep import redock_smoke as rs  # noqa: E402
from mole_prep.limits import Blocked  # noqa: E402

OPTS = {"pH": 7.4, "ligandProtonation": "EXPLICIT_SUBMITTED"}


def _start(code):
    return rs.start_ligand(ccd.ccd_smiles(code), OPTS)


def _pose_text(pdbqt: str, coords_by_line: dict[int, tuple]) -> str:
    """Vina-style single MODEL from a ligand PDBQT, with some atom lines moved to new coordinates."""
    out = ["MODEL 1", "REMARK VINA RESULT:    -5.000      0.000      0.000"]
    for k, ln in enumerate(pdbqt.splitlines()):
        if k in coords_by_line:
            x, y, z = coords_by_line[k]
            ln = f"{ln[:30]}{x:8.3f}{y:8.3f}{z:8.3f}{ln[54:]}"
        out.append(ln)
    out.append("ENDMDL")
    return "\n".join(out) + "\n"


def _heavy_lines(pdbqt: str) -> list[int]:
    return [k for k, ln in enumerate(pdbqt.splitlines()) if ln.startswith(("ATOM", "HETATM")) and (ln[77:79].strip()) not in rs.H_TYPES]


def test_start_ligand_is_an_etkdg_conformer_with_a_complete_pdbqt_map():
    r = _start("BTN")
    assert r["conformer"] == {"method": "RDKit ETKDGv3", "seed": 0xF00D, "numThreads": 1}
    assert sorted(r["pdbqtHeavyToAtom"]) == sorted(set(r["pdbqtHeavyToAtom"]))
    assert len(r["pdbqtHeavyToAtom"]) == 16  # biotin heavy atoms
    assert r["stereo"]["source"] == "ISOMERIC_SMILES"


def test_start_ligand_is_not_the_crystal_pose():
    """1STP BTN A300 crystal coordinates are nowhere near the ETKDG conformer (which sits near the origin)."""
    pdb = open(os.path.join(ccd.FIX, "1STP.pdb")).read().splitlines()
    het = [ln for ln in pdb if ln.startswith("HETATM") and ln[17:20] == "BTN" and ln[21] == "A"]
    cx = sum(float(ln[30:38]) for ln in het) / len(het)
    r = _start("BTN")
    xs = [float(ln[30:38]) for ln in r["pdbqt"].splitlines() if ln.startswith(("ATOM", "HETATM"))]
    assert abs(sum(xs) / len(xs) - cx) > 5.0


@pytest.mark.parametrize("code,expected", [("BTN", 1), ("BEN", 2), ("STI", 4)])
def test_automorphism_counts_are_exact(code, expected):
    """Neutral biotin has no symmetry (C-OH vs C=O differ); benzamidine flips its ring (2); imatinib flips two para rings (4)."""
    r = _start(code)
    mol = rs._load_3d(r["sdf"])
    h, _ = rs._heavy(mol)
    status, maps = rs.valid_mappings(h, h)
    assert status == "OK" and len(maps) == expected


def test_symmetric_rmsd_is_zero_for_a_symmetry_image_while_direct_is_not():
    r = _start("BEN")
    mol = rs._load_3d(r["sdf"])
    h, full_to_heavy = rs._heavy(mol)
    _, maps = rs.valid_mappings(h, h)
    flip = next(m for m in maps if m != tuple(range(h.GetNumAtoms())))
    conf = h.GetConformer()
    lines = r["pdbqt"].splitlines()
    heavy_lines = _heavy_lines(r["pdbqt"])
    # Atom i of the pose takes the reference coordinates of flip[i]: an exact symmetry image of the reference.
    moved = {}
    for k, line_no in enumerate(heavy_lines):
        i = full_to_heavy[r["pdbqtHeavyToAtom"][k]]
        p = conf.GetAtomPosition(flip[i])
        moved[line_no] = (p.x, p.y, p.z)
    assert len(lines) > len(heavy_lines)
    out = rs.docking_rmsd(r["sdf"], r["sdf"], r["pdbqtHeavyToAtom"], [_pose_text(r["pdbqt"], moved), _pose_text(r["pdbqt"], {})])
    assert out["status"] == "OK" and out["directStatus"] == "OK" and out["mappings"] == 2
    image, same = out["runs"][0][0], out["runs"][1][0]
    assert image["symmetricRmsd"] < 1e-3 and image["directRmsd"] > 0.5
    assert same["symmetricRmsd"] < 1e-3 and same["directRmsd"] < 1e-3
    assert image["vinaScore"] == -5.0


def test_rmsd_is_undefined_when_the_reference_stereo_differs():
    """BTN with one inverted stereocentre has the same graph but no stereo-preserving mapping: UNDEFINED, no fallback."""
    smi = ccd.ccd_smiles("BTN")
    assert "[C@@H]1S" in smi
    probe = rs.start_ligand(smi, OPTS)
    ref = rs.start_ligand(smi.replace("[C@@H]1S", "[C@H]1S", 1), OPTS)  # epimer at C2 of the thiolane
    out = rs.docking_rmsd(ref["sdf"], probe["sdf"], probe["pdbqtHeavyToAtom"], [_pose_text(probe["pdbqt"], {})])
    assert out["status"] == "NO_VALID_MAPPING" and out["mappings"] == 0
    assert out["runs"][0][0]["symmetricRmsd"] is None and out["runs"][0][0]["directRmsd"] is None


def test_pose_with_wrong_atom_count_is_rejected():
    r = _start("BEN")
    text = _pose_text(r["pdbqt"], {})
    first = _heavy_lines(r["pdbqt"])[0] + 2  # +2 header lines in the MODEL block
    lines = text.splitlines()
    del lines[first]
    with pytest.raises(Blocked):
        rs.docking_rmsd(r["sdf"], r["sdf"], r["pdbqtHeavyToAtom"], ["\n".join(lines)])
