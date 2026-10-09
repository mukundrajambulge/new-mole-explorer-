"""CCD isomeric SMILES for the fixture ligands (R.4), read from the pinned RCSB CCD files in tests/fixtures/rcsb/ccd-*.cif.

Source: the CCD "SMILES_CANONICAL CACTVS" descriptor (isomeric, stereo-defined) of each component. Glycan residues
in a polysaccharide lack the anomeric O1 of the free CCD monosaccharide, so their template is the CCD molecule with
that one atom deleted (every other stereocentre keeps its CCD configuration). Nothing here invents stereo.
"""
from __future__ import annotations

import os
import re

FIX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "tests", "fixtures", "rcsb")


def ccd_smiles(code: str) -> str:
    text = open(os.path.join(FIX, f"ccd-{code}.cif")).read()
    m = re.search(r'^%s\s+SMILES_CANONICAL\s+CACTVS\s+\S+\s+"?([^"\s]+)"?\s*$' % re.escape(code), text, re.M)
    assert m, f"no CACTVS isomeric SMILES in ccd-{code}.cif"
    return m.group(1)


def drop_anomeric_o1(smiles: str) -> str:
    """Delete the exocyclic O on the pyranose ring carbon that is bonded to the ring oxygen (C1)."""
    from rdkit import Chem

    mol = Chem.MolFromSmiles(smiles)
    ring_o = [a for a in mol.GetAtoms() if a.GetSymbol() == "O" and a.IsInRing()]
    assert len(ring_o) == 1
    hits = []
    for c in ring_o[0].GetNeighbors():
        hits += [(c.GetIdx(), n.GetIdx()) for n in c.GetNeighbors() if n.GetSymbol() == "O" and not n.IsInRing() and n.GetDegree() == 1]
    assert len(hits) == 1, "expected exactly one anomeric hydroxyl"
    rw = Chem.RWMol(mol)
    c1 = rw.GetAtomWithIdx(hits[0][0])
    c1.SetNumExplicitHs(0)
    c1.SetNoImplicit(False)  # C1 becomes CH2 (implicit hydrogens), no longer a stereocentre
    rw.RemoveAtom(hits[0][1])
    out = rw.GetMol()
    Chem.SanitizeMol(out)
    Chem.AssignStereochemistry(out, cleanIt=True, force=True)
    return Chem.MolToSmiles(out)


def template(code: str, glycan: bool = False) -> str:
    from rdkit import Chem

    smi = ccd_smiles(code)
    return drop_anomeric_o1(smi) if glycan else Chem.MolToSmiles(Chem.MolFromSmiles(smi))
