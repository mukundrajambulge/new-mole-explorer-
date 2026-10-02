"""Read-only inter-instance distances for ligand/assembly context triage."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from audit_mmcif import f, loops


def main(path: Path, ligand_asym: str) -> None:
    atoms = []
    for headers, rows in loops(path):
        if headers[0] != "_atom_site.group_PDB":
            continue
        for row in rows:
            element = f(row, "_atom_site.type_symbol", "").upper()
            if element in {"H", "D"}:
                continue
            atoms.append(
                {
                    "group": f(row, "_atom_site.group_PDB"),
                    "element": element,
                    "comp": f(row, "_atom_site.label_comp_id"),
                    "asym": f(row, "_atom_site.label_asym_id"),
                    "entity": f(row, "_atom_site.label_entity_id"),
                    "seq": f(row, "_atom_site.label_seq_id"),
                    "alt": f(row, "_atom_site.label_alt_id"),
                    "occ": f(row, "_atom_site.occupancy"),
                    "atom": f(row, "_atom_site.label_atom_id"),
                    "xyz": tuple(
                        float(f(row, f"_atom_site.Cartn_{axis}"))
                        for axis in "xyz"
                    ),
                }
            )

    ligands = [a for a in atoms if a["asym"] == ligand_asym and a["comp"] == "RTL"]
    if not ligands:
        raise SystemExit(f"no RTL atoms in label asym {ligand_asym}")

    def distance(a, b):
        return math.sqrt(sum((x - y) ** 2 for x, y in zip(a["xyz"], b["xyz"])))

    def nearest_pair(left, right):
        pairs = [(distance(a, b), a, b) for a in left for b in right]
        return min(pairs, key=lambda x: x[0]) if pairs else None

    by_asym = {}
    for asym in sorted({a["asym"] for a in atoms if a["group"] == "ATOM"}):
        protein = [a for a in atoms if a["group"] == "ATOM" and a["asym"] == asym]
        pair = nearest_pair(ligands, protein)
        if pair:
            d, lig, atom = pair
            by_asym[asym] = {
                "minimum_distance_A": round(d, 4),
                "nearest_ligand_atom": lig["atom"],
                "nearest_protein_residue": f"{atom['comp']}:{atom['seq']}",
                "nearest_protein_atom": atom["atom"],
                "protein_residues_with_any_atom_within_5A": sorted(
                    {
                        f"{atom['comp']}:{atom['seq']}"
                        for atom in protein
                        if any(distance(lig, atom) <= 5.0 for lig in ligands)
                    }
                ),
            }

    selected_protein = [
        a
        for a in atoms
        if a["group"] == "ATOM"
        and a["asym"] == "A"
        and a["alt"] in {None, ".", "?", "A"}
    ]
    selected_min = nearest_pair(ligands, selected_protein)
    selected_oh = nearest_pair(
        [a for a in ligands if a["atom"] == "O1"], selected_protein
    )
    alt_b_protein = [
        a for a in atoms if a["group"] == "ATOM" and a["asym"] == "A" and a["alt"] == "B"
    ]
    alt_b_min = nearest_pair(ligands, alt_b_protein)

    terminal = [a for a in atoms if a["group"] == "ATOM" and a["asym"] == "A" and a["seq"] == "2"]
    term_pairs = [(distance(lig, atom), lig, atom) for lig in ligands for atom in terminal]
    term_min = min(term_pairs, key=lambda x: x[0]) if term_pairs else None

    altlocs = {}
    for seq in sorted(
        {
            a["seq"]
            for a in atoms
            if a["group"] == "ATOM"
            and a["asym"] == "A"
            and a["alt"] not in {None, ".", "?"}
        },
        key=lambda value: int(value),
    ):
        local = [
            a
            for a in atoms
            if a["group"] == "ATOM" and a["asym"] == "A" and a["seq"] == seq
        ]
        altlocs[seq] = sorted(
            {f"{a['comp']}:{a['alt']}={a['occ']}" for a in local if a["alt"] not in {None, ".", "?"}}
        )

    selected_residues = {}
    for atom in selected_protein:
        key = f"{atom['comp']}:{atom['seq']}"
        nearest = min(distance(lig, atom) for lig in ligands)
        if key not in selected_residues or nearest < selected_residues[key]:
            selected_residues[key] = nearest

    water = [a for a in atoms if a["comp"] == "HOH"]
    nearest_water = min((distance(lig, wat) for lig in ligands for wat in water), default=None)
    ligand_copies = [a for a in atoms if a["comp"] == "RTL" and a["asym"] != ligand_asym]
    ligand_copy_min = nearest_pair(ligands, ligand_copies)
    output = {
        "source_file": path.name,
        "target_ligand_label_asym": ligand_asym,
        "polymer_instance_distances_to_ligand": by_asym,
        "selected_major_altloc_A_or_common_atoms": (
            {
                "minimum_heavy_atom_distance_A": round(selected_min[0], 4),
                "nearest_pair": [
                    f"RTL:{selected_min[1]['atom']}",
                    f"{selected_min[2]['comp']}:{selected_min[2]['seq']}:{selected_min[2]['atom']}",
                ],
                "minimum_distance_from_retinol_O1_A": round(selected_oh[0], 4),
                "nearest_O1_pair": [
                    f"RTL:{selected_oh[1]['atom']}",
                    f"{selected_oh[2]['comp']}:{selected_oh[2]['seq']}:{selected_oh[2]['atom']}",
                ],
            }
            if selected_min and selected_oh
            else None
        ),
        "minor_altloc_B_minimum_distance_A": round(alt_b_min[0], 4) if alt_b_min else None,
        "symmetry_copy_ligand_distance_A": (
            round(ligand_copy_min[0], 4) if ligand_copy_min else None
        ),
        "nearest_observed_atom_in_label_seq_2": (
            {
                "distance_A": round(term_min[0], 4),
                "ligand_atom": term_min[1]["atom"],
                "protein_atom": term_min[2]["atom"],
            }
            if term_min
            else None
        ),
        "local_altloc_occupancies": altlocs,
        "selected_major_conformer_residue_distances_A": {
            key: round(value, 4)
            for key, value in sorted(selected_residues.items(), key=lambda item: item[1])
        },
        "nearest_water_distance_A": round(nearest_water, 4) if nearest_water is not None else None,
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: assembly_context.py INPUT.cif LIGAND_LABEL_ASYM")
    main(Path(sys.argv[1]), sys.argv[2])
