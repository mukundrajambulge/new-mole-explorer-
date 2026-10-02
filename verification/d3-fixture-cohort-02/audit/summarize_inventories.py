"""Print a compact summary from retained deposited-source inventory JSON."""

from __future__ import annotations

import json
from pathlib import Path

base = Path(__file__).parents[1] / "source_artifacts" / "metadata"
for path in sorted(base.glob("*_inventory.json")):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    proteins = [
        (p["entity_id"], p["description"], p["monomer_count_expected"], p["monomer_count_observed"], p["missing_label_seq_ids"], p["author_chains"])
        for p in data["polymer_entities"]
    ]
    ligands = [
        (x["comp_id"], x["label_asym_id"], x["author_chain"], x["heavy_atom_count"], x["occupancies"])
        for x in data["nonpolymer_instances"]
        if x["comp_id"] not in {"HOH", "DOD", "WAT"}
    ]
    print(path.stem, "resolution_A=", data["resolution_A"], "proteins=", proteins, "nonpolymers=", ligands)

audit_base = Path(__file__).parent
for path in sorted(audit_base.glob("*_audit.json")):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    print(
        path.stem,
        "ligand=", data["ligand_component"], data["ligand_heavy_atom_count_observed"], "occ", data["ligand_occupancy_values"],
        "receptor=", data["receptor_label_asym"], data["receptor_entity_id"], data["receptor_observed_residue_count"], "/", data["receptor_polymer_expected_residue_count"],
        "missing=", data["receptor_unobserved_label_seq_ids"], "alt=", data["receptor_altloc_residues_within_5A_of_ligand"],
        "water=", data["water_residue_count_within_5A"], data["water_residue_count_within_8A"], "nearest_water=", data["nearest_water_distance_A"],
        "nonpoly=", data["nonpolymer_components_by_min_distance"][:8], "metals=", data["metals_by_min_distance_A"][:4],
    )
