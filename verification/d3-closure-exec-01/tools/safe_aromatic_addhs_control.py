"""Synthetic aromatic control for RDKit AddHs; never opens fixture inputs."""

from __future__ import annotations

import hashlib
import json
import math
import struct

from rdkit import Chem, rdBase
from rdkit.Geometry import Point3D


def bits(value: float) -> str:
    return struct.pack(">d", value).hex()


def make_ring() -> Chem.Mol:
    edit = Chem.RWMol()
    for _ in range(6):
        atom = Chem.Atom("C")
        atom.SetIsAromatic(True)
        atom.SetNoImplicit(True)
        atom.SetNumExplicitHs(1)
        edit.AddAtom(atom)
    for index in range(6):
        edit.AddBond(index, (index + 1) % 6, Chem.BondType.AROMATIC)
        edit.GetBondBetweenAtoms(index, (index + 1) % 6).SetIsAromatic(True)
    molecule = edit.GetMol()
    molecule.UpdatePropertyCache(strict=False)
    conformer = Chem.Conformer(6)
    for index in range(6):
        angle = 2.0 * math.pi * index / 6.0
        conformer.SetAtomPosition(index, Point3D(1.4 * math.cos(angle), 1.4 * math.sin(angle), 0.0))
    molecule.AddConformer(conformer, assignId=True)
    return molecule


def signature(mol: Chem.Mol) -> dict[str, object]:
    conf = mol.GetConformer()
    atoms = []
    for atom in mol.GetAtoms():
        point = conf.GetAtomPosition(atom.GetIdx())
        atoms.append([atom.GetIdx(), atom.GetAtomicNum(), atom.GetFormalCharge(), [bits(v) for v in (point.x, point.y, point.z)]])
    bonds = sorted([min(b.GetBeginAtomIdx(), b.GetEndAtomIdx()), max(b.GetBeginAtomIdx(), b.GetEndAtomIdx()), str(b.GetBondType()), b.GetIsAromatic()] for b in mol.GetBonds())
    return {"atoms": atoms, "bonds": bonds}


def main() -> None:
    source = make_ring()
    before = signature(source)
    one = Chem.AddHs(Chem.Mol(source), explicitOnly=False, addCoords=True, onlyOnAtoms=None, addResidueInfo=True)
    two = Chem.AddHs(Chem.Mol(source), explicitOnly=False, addCoords=True, onlyOnAtoms=None, addResidueInfo=True)
    if one.GetNumHeavyAtoms() != 6 or one.GetNumAtoms() != 12:
        raise AssertionError("aromatic six-carbon control must add exactly six H atoms")
    if signature(one) != signature(two):
        raise AssertionError("aromatic AddHs replay differs")
    if signature(source) != before:
        raise AssertionError("AddHs mutated its source molecule")
    if signature(one)["atoms"][:6] != before["atoms"]:
        raise AssertionError("aromatic heavy-atom identity or coordinate bits changed")
    parents = [atom.GetNeighbors()[0].GetIdx() for atom in one.GetAtoms() if atom.GetAtomicNum() == 1]
    if sorted(parents) != list(range(6)):
        raise AssertionError("aromatic H parent inventory is not one per carbon")
    encoded = json.dumps(signature(one), sort_keys=True, separators=(",", ":")).encode("utf-8")
    print(json.dumps({"status": "PASS", "control": "synthetic aromatic six-carbon ring", "rdkit_version": rdBase.rdkitVersion, "hydrogen_count": 6, "heavy_atom_coordinates_unchanged": True, "hydrogen_parent_coverage": True, "replay_bitwise_identical": True, "sha256": hashlib.sha256(encoded).hexdigest(), "fixture_files_opened": False}, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
