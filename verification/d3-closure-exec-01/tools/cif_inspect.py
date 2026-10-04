"""Read-only source table inspection; performs no RDKit operation."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cif_io import find_loop, read_loops, rows_by_header  # noqa: E402
from prepare_3dmx_bnz_hydrogens import (  # noqa: E402
    atom_site_rows,
    build_component_maps,
    create_residue_inventory,
    read_and_verify_sources,
)


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "source_artifacts" / "current_rcsb"
    evidence_root = Path(__file__).resolve().parents[1]
    raw, source_hashes = read_and_verify_sources(root, evidence_root / "SOURCE_MANIFEST.csv")
    mmcif = read_loops(raw["3DMX.cif"])
    bnz = read_loops(raw["BNZ.cif"])
    atom_site = find_loop(mmcif, "_atom_site.")
    comp_atom = find_loop(mmcif, "_chem_comp_atom.")
    comp_bond = find_loop(mmcif, "_chem_comp_bond.")
    poly = find_loop(mmcif, "_entity_poly_seq.")
    atom_rows = rows_by_header(atom_site)
    polymer = [row for row in atom_rows if row.get("_atom_site.pdbx_PDB_model_num") == "1" and row.get("_atom_site.group_PDB") == "ATOM" and row.get("_atom_site.label_entity_id") == "1" and row.get("_atom_site.label_asym_id") == "A"]
    comp_atom_rows = rows_by_header(comp_atom)
    comp_bond_rows = rows_by_header(comp_bond)
    component_atoms, component_bonds = build_component_maps(mmcif)
    parsed_sites = atom_site_rows(raw["3DMX.cif"])
    selected_receptor = residues = altlocs = []
    selection_error = None
    try:
        selected_receptor, residues, altlocs = create_residue_inventory(parsed_sites, mmcif, component_atoms, component_bonds)
    except Exception as exc:
        selection_error = f"{type(exc).__name__}: {exc}"
    polymer_alternates = [
        {"label_seq": atom["label_seq"], "auth_seq": atom["auth_seq"], "comp": atom["comp"], "atom": atom["atom"], "alt": atom["alt"], "occupancy": atom["occupancy"], "row": atom["row"]}
        for atom in parsed_sites
        if atom["model"] == 1 and atom["record"] == "ATOM" and atom["entity"] == "1" and atom["label_asym"] == "A" and atom["auth_asym"] == "A" and atom["alt"]
    ]
    print(json.dumps({
        "3dmx_loops": len(mmcif),
        "bnz_loops": len(bnz),
        "atom_site_rows": len(atom_site.rows),
        "chem_comp_atom_rows": len(comp_atom.rows),
        "chem_comp_bond_rows": len(comp_bond.rows),
        "entity_poly_seq_rows": len(poly.rows),
        "selected_polymer_site_rows": len(polymer),
        "selected_polymer_heavy_rows": sum(1 for row in polymer if row.get("_atom_site.type_symbol") != "H"),
        "selected_receptor_heavy_atoms_after_altloc": len(selected_receptor),
        "residue_count": len(residues),
        "altloc_occurrence_rows": len(altlocs),
        "verified_source_hashes": source_hashes,
        "selection_error": selection_error,
        "polymer_altloc_rows": polymer_alternates,
        "selected_polymer_models": sorted({row.get("_atom_site.pdbx_PDB_model_num") for row in polymer}),
        "proline_hydrogen_bonds": [row for row in comp_bond_rows if row.get("_chem_comp_bond.comp_id") == "PRO" and (row.get("_chem_comp_bond.atom_id_1", "").startswith("H") or row.get("_chem_comp_bond.atom_id_2", "").startswith("H"))],
        "source_component_counts": {comp: sum(1 for row in polymer if row.get("_atom_site.label_comp_id") == comp) for comp in sorted({row.get("_atom_site.label_comp_id") for row in polymer})},
        "struct_conn_loops": [{"headers": list(loop.headers), "rows": len(loop.rows)} for loop in mmcif if any(h.startswith("_struct_conn.") for h in loop.headers)],
        "component_hydrogen_parents": {
            comp: sorted(
                [row["_chem_comp_bond.atom_id_1"], row["_chem_comp_bond.atom_id_2"]]
            for row in comp_bond_rows
                if row.get("_chem_comp_bond.comp_id") == comp
                and row.get("_chem_comp_bond.atom_id_1", "").startswith("H")
                or row.get("_chem_comp_bond.comp_id") == comp
                and row.get("_chem_comp_bond.atom_id_2", "").startswith("H")
            )
            for comp in ["ALA", "ARG", "ASP", "GLU", "HIS", "LEU", "LYS", "MET", "TYR"]
        },
        "component_formal_charges": {
            comp: [
                (row.get("_chem_comp_atom.atom_id"), row.get("_chem_comp_atom.charge"))
                for row in comp_atom_rows
                if row.get("_chem_comp_atom.comp_id") == comp
                and row.get("_chem_comp_atom.charge", "0") not in ("0", ".", "?")
            ]
            for comp in ["ARG", "ASP", "GLU", "HIS", "LYS", "TYR"]
        },
    }, indent=2))


if __name__ == "__main__":
    main()
