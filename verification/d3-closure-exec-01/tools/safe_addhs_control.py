"""Safe synthetic check for the pinned RDKit AddHs wrapper and invariants.

This script uses only a hand-built ethane graph with explicit heavy-atom
coordinates. It does not open or parse fixture files and is not fixture
determinism evidence.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
import sys

from rdkit import Chem, rdBase
from rdkit.Geometry import Point3D


def make_ethane() -> Chem.Mol:
    editable = Chem.RWMol()
    first = Chem.Atom("C")
    second = Chem.Atom("C")
    first_index = editable.AddAtom(first)
    second_index = editable.AddAtom(second)
    editable.AddBond(first_index, second_index, Chem.BondType.SINGLE)
    molecule = editable.GetMol()
    Chem.SanitizeMol(molecule)
    conformer = Chem.Conformer(2)
    conformer.SetAtomPosition(0, Point3D(0.0, 0.0, 0.0))
    conformer.SetAtomPosition(1, Point3D(1.54, 0.0, 0.0))
    molecule.AddConformer(conformer, assignId=True)
    return molecule


def coordinate_bits(molecule: Chem.Mol, atom_index: int) -> tuple[str, str, str]:
    position = molecule.GetConformer().GetAtomPosition(atom_index)
    return tuple(struct.pack(">d", value).hex() for value in (position.x, position.y, position.z))


def canonical_signature(molecule: Chem.Mol) -> dict[str, object]:
    conformer = molecule.GetConformer()
    atoms = []
    for atom in molecule.GetAtoms():
        position = conformer.GetAtomPosition(atom.GetIdx())
        coordinates = (position.x, position.y, position.z)
        if not all(math.isfinite(value) for value in coordinates):
            raise AssertionError(f"non-finite coordinate at atom {atom.GetIdx()}")
        atoms.append(
            {
                "index": atom.GetIdx(),
                "atomic_number": atom.GetAtomicNum(),
                "formal_charge": atom.GetFormalCharge(),
                "isotope": atom.GetIsotope(),
                "aromatic": atom.GetIsAromatic(),
                "chiral_tag": int(atom.GetChiralTag()),
                "coordinate_bits": coordinate_bits(molecule, atom.GetIdx()),
            }
        )
    bonds = sorted(
        (
            min(bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()),
            max(bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()),
            str(bond.GetBondType()),
            bond.GetIsAromatic(),
        )
        for bond in molecule.GetBonds()
    )
    return {"atoms": atoms, "bonds": bonds}


def reject_queries(molecule: Chem.Mol) -> None:
    if any(atom.HasQuery() for atom in molecule.GetAtoms()):
        raise AssertionError("query atom reached the hydrogen operation")
    if any(bond.HasQuery() for bond in molecule.GetBonds()):
        raise AssertionError("query bond reached the hydrogen operation")


def add_hydrogens(molecule: Chem.Mol) -> Chem.Mol:
    reject_queries(molecule)
    return Chem.AddHs(
        molecule,
        explicitOnly=False,
        addCoords=True,
        onlyOnAtoms=None,
        addResidueInfo=True,
    )


def main() -> int:
    source = make_ethane()
    before_heavy = [coordinate_bits(source, index) for index in range(2)]
    heavy_bonds_before = sorted(
        (bond.GetBeginAtomIdx(), bond.GetEndAtomIdx(), str(bond.GetBondType()))
        for bond in source.GetBonds()
    )

    prepared_one = add_hydrogens(Chem.Mol(source))
    prepared_two = add_hydrogens(Chem.Mol(source))

    for prepared in (prepared_one, prepared_two):
        if prepared.GetNumAtoms() != 8 or prepared.GetNumHeavyAtoms() != 2:
            raise AssertionError("ethane control did not produce exactly six hydrogens")
        after_heavy = [coordinate_bits(prepared, index) for index in range(2)]
        if after_heavy != before_heavy:
            raise AssertionError("heavy-atom coordinate bits changed")
        heavy_bonds_after = sorted(
            (bond.GetBeginAtomIdx(), bond.GetEndAtomIdx(), str(bond.GetBondType()))
            for bond in prepared.GetBonds()
            if bond.GetBeginAtom().GetAtomicNum() != 1 and bond.GetEndAtom().GetAtomicNum() != 1
        )
        if heavy_bonds_after != heavy_bonds_before:
            raise AssertionError("heavy-heavy bond graph changed")
        hydrogens = [atom for atom in prepared.GetAtoms() if atom.GetAtomicNum() == 1]
        if len(hydrogens) != 6 or any(atom.GetDegree() != 1 for atom in hydrogens):
            raise AssertionError("hydrogen parent mapping is incomplete")

    signature_one = canonical_signature(prepared_one)
    signature_two = canonical_signature(prepared_two)
    encoded_one = json.dumps(signature_one, sort_keys=True, separators=(",", ":")).encode("utf-8")
    encoded_two = json.dumps(signature_two, sort_keys=True, separators=(",", ":")).encode("utf-8")
    if encoded_one != encoded_two:
        raise AssertionError("independent ethane AddHs calls were not bitwise deterministic")
    if coordinate_bits(source, 0) != before_heavy[0] or coordinate_bits(source, 1) != before_heavy[1]:
        raise AssertionError("AddHs mutated the original source molecule")

    print(
        json.dumps(
            {
                "status": "PASS",
                "control": "hand-built ethane",
                "rdkit_version": rdBase.rdkitVersion,
                "operation": "Chem.AddHs(molecule, explicitOnly=False, addCoords=True, onlyOnAtoms=None, addResidueInfo=True)",
                "heavy_atom_count": 2,
                "hydrogen_count": 6,
                "heavy_atom_coordinate_bits_unchanged": True,
                "heavy_heavy_bonds_unchanged": True,
                "original_molecule_unchanged": True,
                "independent_replay_bitwise_identical": True,
                "hydrogen_parent_indices": [
                    {"hydrogen_index": atom.GetIdx(), "parent_index": atom.GetNeighbors()[0].GetIdx()}
                    for atom in prepared_one.GetAtoms()
                    if atom.GetAtomicNum() == 1
                ],
                "canonical_result_sha256": hashlib.sha256(encoded_one).hexdigest(),
                "fixture_sources_opened": False,
                "fixture_determinism_claimed": False,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"SAFE_CONTROL_FAILURE: {type(error).__name__}: {error}", file=sys.stderr)
        raise
