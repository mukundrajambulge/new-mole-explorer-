"""Inventory deposited mmCIF non-polymer instances and polymer entities.

Discovery-only parser. It does not modify coordinates or infer chemistry.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

from audit_mmcif import f, loops


def inventory(path: Path) -> dict:
    data: dict[str, list[dict]] = {}
    for headers, rows in loops(path):
        if not headers:
            continue
        category = headers[0].split(".", 1)[0]
        data[category] = rows

    by_component: dict[tuple[str, str, str, str], dict] = defaultdict(
        lambda: {"atoms": set(), "residues": set(), "occupancies": set(), "altlocs": set()}
    )
    for row in data.get("_atom_site", []):
        if f(row, "_atom_site.pdbx_PDB_model_num", "1") != "1":
            continue
        if f(row, "_atom_site.group_PDB") != "HETATM" or f(row, "_atom_site.type_symbol", "").upper() in {"H", "D"}:
            continue
        key = (
            f(row, "_atom_site.label_comp_id", "?"),
            f(row, "_atom_site.label_entity_id", "?"),
            f(row, "_atom_site.label_asym_id", "?"),
            f(row, "_atom_site.auth_asym_id", "?"),
        )
        record = by_component[key]
        record["atoms"].add(f(row, "_atom_site.label_atom_id", "?"))
        record["residues"].add((f(row, "_atom_site.auth_seq_id", "?"), f(row, "_atom_site.pdbx_PDB_ins_code", "?")))
        record["occupancies"].add(f(row, "_atom_site.occupancy", "1"))
        alt = f(row, "_atom_site.label_alt_id")
        if alt not in (None, ".", "?"):
            record["altlocs"].add(alt)

    polymer_entities = []
    entity_ids = sorted({f(r, "_entity_poly_seq.entity_id", "?") for r in data.get("_entity_poly_seq", [])})
    for entity_id in entity_ids:
        sequence_rows = sorted(
            [e for e in data.get("_entity_poly_seq", []) if f(e, "_entity_poly_seq.entity_id") == entity_id],
            key=lambda e: int(f(e, "_entity_poly_seq.num", "0")),
        )
        expected = len(sequence_rows)
        atom_rows = [
            a for a in data.get("_atom_site", [])
            if f(a, "_atom_site.group_PDB") == "ATOM"
            and f(a, "_atom_site.label_entity_id") == entity_id
            and f(a, "_atom_site.pdbx_PDB_model_num", "1") == "1"
        ]
        observed = {f(a, "_atom_site.label_seq_id") for a in atom_rows if f(a, "_atom_site.label_seq_id")}
        alt_residues = {
            (f(a, "_atom_site.label_asym_id"), f(a, "_atom_site.label_seq_id"), f(a, "_atom_site.label_comp_id"))
            for a in atom_rows
            if f(a, "_atom_site.label_alt_id") not in (None, ".", "?")
        }
        polymer_entities.append({
            "entity_id": entity_id,
            "description": next((f(e, "_entity.pdbx_description") for e in data.get("_entity", []) if f(e, "_entity.id") == entity_id), None),
            "type": "polypeptide(L)" if any(f(e, "_entity_poly_seq.mon_id", "") in {"ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE", "LEU", "LYS", "MET", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL"} for e in sequence_rows) else None,
            "monomer_count_expected": expected,
            "monomer_count_observed": len(observed),
            "missing_label_seq_ids": sorted(set(range(1, expected + 1)) - {int(x) for x in observed if x.isdigit()}),
            "asym_ids": sorted({f(a, "_atom_site.label_asym_id") for a in atom_rows}),
            "author_chains": sorted({f(a, "_atom_site.auth_asym_id") for a in atom_rows}),
            "altloc_residues": sorted([list(x) for x in alt_residues]),
            "sequence": "".join(f(e, "_entity_poly_seq.mon_id", "?") for e in sequence_rows),
        })

    categories = {}
    for cat in ("_entity_src_nat", "_entity_src_gen", "_pdbx_entity_src_syn", "_struct_ref", "_struct_ref_seq", "_pdbx_struct_assembly", "_citation"):
        rows = data.get(cat, [])
        if rows:
            categories[cat] = rows

    return {
        "source_file": path.name,
        "title": next((f(r, "_struct.title") for r in data.get("_struct", [])), None),
        "entry_id": next((f(r, "_entry.id") for r in data.get("_entry", [])), None),
        "resolution_A": next((f(r, "_refine.ls_d_res_high") for r in data.get("_refine", [])), None),
        "polymer_entities": polymer_entities,
        "nonpolymer_instances": [
            {
                "comp_id": key[0], "entity_id": key[1], "label_asym_id": key[2], "author_chain": key[3],
                "residues": sorted([list(x) for x in value["residues"]]),
                "heavy_atom_names": sorted(value["atoms"]), "heavy_atom_count": len(value["atoms"]),
                "occupancies": sorted(value["occupancies"]), "altlocs": sorted(value["altlocs"]),
            }
            for key, value in sorted(by_component.items())
        ],
        "source_citation": categories.get("_citation", []),
        "source_categories": categories,
    }


if __name__ == "__main__":
    print(json.dumps(inventory(Path(sys.argv[1])), indent=2, sort_keys=True))
