"""Build a reproducible source-tractability table for the exact RTL query hits."""

from __future__ import annotations

import csv
import json
from pathlib import Path

root = Path(__file__).parents[1]
meta = root / "source_artifacts" / "metadata"
query_result = json.loads((root / "source_artifacts" / "queries" / "rcsb_RTL_search.json").read_text(encoding="utf-8-sig"))
ids = [item["identifier"] for item in query_result["result_set"]]
out = root / "COHORT_SOURCE_TRACTABILITY_MATRIX.csv"

with out.open("w", newline="", encoding="utf-8") as stream:
    writer = csv.DictWriter(stream, fieldnames=[
        "pdb_id", "title", "resolution_A", "primary_source_title", "primary_source_doi",
        "source_type", "organism", "expression_host", "protein_description", "uniprot_ids",
        "mutation_count", "deposited_sequence_length", "coordinate_residues_observed", "coordinate_residues_missing",
        "protein_altloc_residue_count", "retinol_instances", "other_nonwater_components", "source_artifacts",
        "rcsb_entry_url", "coordinate_url", "primary_source_url",
    ], lineterminator="\n")
    writer.writeheader()
    for pdb_id in ids:
        entry = json.loads((meta / f"{pdb_id}_entry.json").read_text(encoding="utf-8-sig"))
        entity = json.loads((meta / f"{pdb_id}_polymer_entity.json").read_text(encoding="utf-8-sig"))
        inventory = json.loads((meta / f"{pdb_id}_inventory.json").read_text(encoding="utf-8-sig"))
        entity_poly = entity.get("entity_poly") or {}
        source_rows = entity.get("rcsb_entity_source_organism") or []
        source = source_rows[0] if source_rows else {}
        natural = entity.get("entity_src_nat") or []
        generated = entity.get("entity_src_gen") or []
        host = generated[0].get("pdbx_host_org_scientific_name", "") if generated else ""
        primary = entry.get("rcsb_primary_citation") or {}
        protein = inventory["polymer_entities"][0] if inventory["polymer_entities"] else {}
        ligand = [
            f"{item['comp_id']}:{item['label_asym_id']}:{item['author_chain']}:{item['heavy_atom_count']} atoms;occ={','.join(item['occupancies'])}"
            for item in inventory["nonpolymer_instances"]
            if item["comp_id"] in {"RTL", "RET"}
        ]
        other = [
            f"{item['comp_id']}:{item['label_asym_id']}:{item['heavy_atom_count']} atoms"
            for item in inventory["nonpolymer_instances"]
            if item["comp_id"] not in {"RTL", "RET", "HOH", "WAT", "DOD"}
        ]
        writer.writerow({
            "pdb_id": pdb_id,
            "title": (entry.get("struct") or {}).get("title", "").replace("\n", " "),
            "resolution_A": (entry.get("rcsb_entry_info") or {}).get("resolution_combined", [""])[0],
            "primary_source_title": primary.get("title", "").replace("\n", " "),
            "primary_source_doi": primary.get("pdbx_database_id_DOI", ""),
            "source_type": source.get("source_type", ""),
            "organism": source.get("scientific_name", ""),
            "expression_host": host,
            "protein_description": (entity.get("rcsb_polymer_entity") or {}).get("pdbx_description", ""),
            "uniprot_ids": ";".join((entity.get("rcsb_polymer_entity_container_identifiers") or {}).get("uniprot_ids", [])),
            "mutation_count": entity_poly.get("rcsb_mutation_count", ""),
            "deposited_sequence_length": entity_poly.get("rcsb_sample_sequence_length", ""),
            "coordinate_residues_observed": protein.get("monomer_count_observed", ""),
            "coordinate_residues_missing": ";".join(str(x) for x in protein.get("missing_label_seq_ids", [])),
            "protein_altloc_residue_count": len(protein.get("altloc_residues", [])),
            "retinol_instances": " | ".join(ligand),
            "other_nonwater_components": " | ".join(other),
            "source_artifacts": f"cif/{pdb_id}.cif; metadata/{pdb_id}_entry.json; metadata/{pdb_id}_polymer_entity.json",
            "rcsb_entry_url": f"https://www.rcsb.org/structure/{pdb_id}",
            "coordinate_url": f"https://files.rcsb.org/download/{pdb_id}.cif",
            "primary_source_url": f"https://doi.org/{primary.get('pdbx_database_id_DOI')}" if primary.get("pdbx_database_id_DOI") else "",
        })

print(out)
