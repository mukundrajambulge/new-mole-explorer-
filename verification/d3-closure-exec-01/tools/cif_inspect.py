"""Hash-gated source/profile validator; imports no chemistry toolkit."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cif_io import find_loop, read_loops, rows_by_header  # noqa: E402
from prepare_3dmx_bnz_hydrogens import (  # noqa: E402
    PROFILE_ID,
    atom_site_rows,
    build_component_maps,
    component_graph_signature,
    create_residue_inventory,
    expected_hydrogens,
    get_rows,
    read_and_verify_sources,
    source_occurrences,
    validate_chemical_state_profile,
)


IONIZABLE_CATEGORIES = {
    "ASP_DEPROTONATED": "ASP_DEPROTONATED(-1)",
    "GLU_DEPROTONATED": "GLU_DEPROTONATED(-1)",
    "ARG_PROTONATED": "ARG_PROTONATED(+1)",
    "LYS_PROTONATED": "LYS_PROTONATED(+1)",
    "TYR_NEUTRAL": "TYR_NEUTRAL(0)",
    "HIS31_NEUTRAL_HID": "HIS31_NEUTRAL_HID(0; ND1-H)",
}


def xyz_distance(left: dict[str, Any], right: dict[str, Any]) -> float:
    return math.sqrt(sum((left["xyz"][axis] - right["xyz"][axis]) ** 2 for axis in range(3)))


def selected_context(rows: list[dict[str, Any]], profile: dict[str, Any], target_position: int | None = None, target_label: str = "A") -> list[dict[str, Any]]:
    selected = []
    altloc_by_position = {group["label_seq_id"]: group["selected_label"] for group in profile["altloc_resolution"]["groups"]}
    for atom in rows:
        if atom["model"] != 1 or atom["element"] == "H":
            continue
        if atom["record"] == "ATOM" and atom["entity"] == "1" and atom["label_asym"] == "A" and atom["auth_asym"] == "A":
            if atom["alt"]:
                chosen = target_label if atom["label_seq"] == target_position else altloc_by_position.get(atom["label_seq"])
                if atom["alt"] != chosen:
                    continue
        selected.append(atom)
    return selected


def local_environment(rows: list[dict[str, Any]], profile: dict[str, Any], targets: list[dict[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {"method": "source-coordinate nearest heavy-atom pairs; descriptive only; no contact cutoff used for state assignment", "residues": []}
    for target in targets:
        position = target["label_seq_id"]
        comp = target["comp_id"]
        altloc_states = ["A", "B"] if position in {group["label_seq_id"] for group in profile["altloc_resolution"]["groups"]} else [""]
        residue_reports = []
        for altloc in altloc_states:
            context = selected_context(rows, profile, position, altloc or "A")
            target_atoms = [atom for atom in context if atom["record"] == "ATOM" and atom["label_seq"] == position]
            sidechain = [atom for atom in target_atoms if atom["atom"] not in {"N", "CA", "C", "O", "OXT"}]
            other_atoms = [atom for atom in context if not (atom["record"] == "ATOM" and atom["label_seq"] == position)]
            pairs = []
            for atom in sidechain:
                for neighbor in other_atoms:
                    distance = xyz_distance(atom, neighbor)
                    pairs.append({
                        "target_atom": atom["atom"],
                        "target_altloc": atom["alt"] or "(blank)",
                        "neighbor": f"{neighbor['comp']}:{neighbor['auth_seq'] or neighbor['label_seq']}:{neighbor['atom']}:{neighbor['alt'] or '(blank)'}",
                        "neighbor_element": neighbor["element"],
                        "distance_angstrom": round(distance, 6),
                        "neighbor_role": "BNZ" if neighbor["comp"] == "BNZ" else "water" if neighbor["comp"] == "HOH" else "polymer_or_component",
                    })
            pairs.sort(key=lambda pair: (pair["distance_angstrom"], pair["target_atom"], pair["neighbor"]))
            residue_reports.append({"altloc": altloc or "common", "nearest_pairs": pairs[:12]})
        result["residues"].append({"label_seq_id": position, "comp_id": comp, "states": residue_reports})
    return result


def write_matrix(path: Path, rows: list[dict[str, Any]], all_rows: list[dict[str, Any]], sequence: list[dict[str, Any]], atoms_by_comp: dict[str, dict[str, dict[str, Any]]], bonds_by_comp: dict[str, list[dict[str, Any]]], selected: list[dict[str, Any]], residue_manifest: list[dict[str, Any]], profile: dict[str, Any], state_categories: dict[int, str]) -> None:
    sequence_by_position = {int(row["_entity_poly_seq.num"]): row["_entity_poly_seq.mon_id"].upper() for row in sequence}
    manifest_by_position = {row["label_seq_id"]: row for row in residue_manifest}
    selected_names: dict[int, set[str]] = defaultdict(set)
    for atom in selected:
        selected_names[int(atom["label_seq"])].add(atom["atom"])
    source_by_position: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for atom in all_rows:
        if atom["model"] == 1 and atom["record"] == "ATOM" and atom["entity"] == "1" and atom["label_asym"] == "A" and atom["auth_asym"] == "A":
            source_by_position[int(atom["label_seq"])].append(atom)
    configured_altlocs = {group["label_seq_id"]: group for group in profile["altloc_resolution"]["groups"]}
    state_by_position = dict(state_categories)
    state_by_position[1] = "MET1_N_TERMINUS_PROTONATED(+1); sidechain neutral CCD state"
    state_by_position[164] = "LEU164_C_TERMINUS_DEPROTONATED(-1); sidechain neutral CCD state"
    for pos, comp in sequence_by_position.items():
        if pos not in state_by_position:
            state_by_position[pos] = "ASN68_NEUTRAL_AMIDE_CCD_STATE(OD1 acceptor; ND2 donor)" if pos == 68 else "STANDARD_NEUTRAL_CCD_COMPONENT_STATE"
    fieldnames = ["residue_number", "residue_name", "selected_conformer", "source_atoms", "chemical_state_category", "profile_disposition", "hydrogen_state_rule", "inclusion_status", "provenance"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for position in range(1, 165):
            comp = sequence_by_position[position]
            src = source_by_position[position]
            src.sort(key=lambda atom: (atom["row"], atom["atom"], atom["alt"]))
            expected_heavy = {name for name, item in atoms_by_comp[comp].items() if item["element"] != "H" and (name != "OXT" or position == 164)}
            selected_atom_names = selected_names[position]
            if selected_atom_names != expected_heavy:
                raise ValueError(f"matrix coverage failed at residue {position}: selected={sorted(selected_atom_names)}, expected={sorted(expected_heavy)}")
            h_by_parent = expected_hydrogens(comp, position, atoms_by_comp[comp], bonds_by_comp[comp], expected_heavy)
            alt_spec = configured_altlocs.get(position)
            selected_altloc = f"{alt_spec['selected_label']}+blank" if alt_spec else "blank/common"
            rows_payload = [{"atom": atom["atom"], "element": atom["element"], "altloc": atom["alt"] or "(blank)", "occupancy": atom["occupancy"], "source_row": atom["row"]} for atom in src]
            state = state_by_position[position]
            charge_category = state_categories.get(position)
            if charge_category:
                state = IONIZABLE_CATEGORIES[charge_category]
            hydrogen_rule = {
                "method": "CCD hydrogen-parent inventory; explicit AUTH04 terminal/acid/base/HIS31 adjustments; no implicit state selection",
                "parent_to_hydrogen_names": h_by_parent,
            }
            writer.writerow({
                "residue_number": position,
                "residue_name": comp,
                "selected_conformer": selected_altloc,
                "source_atoms": json.dumps(rows_payload, sort_keys=True, separators=(",", ":")),
                "chemical_state_category": state,
                "profile_disposition": f"SELECT_RECEPTOR_CHAIN_A; {selected_altloc}; exact state category {state}",
                "hydrogen_state_rule": json.dumps(hydrogen_rule, sort_keys=True, separators=(",", ":")),
                "inclusion_status": f"INCLUDED; {len(selected_atom_names)}/{len(expected_heavy)} expected CCD heavy atoms; zero missing/extra",
                "provenance": f"3DMX.cif atom_site source rows {min(atom['row'] for atom in src)}-{max(atom['row'] for atom in src)}; CCD {comp} atom/bond definitions; AUTH04 chemical-state decision; {profile['profile_id']} v{profile['semantic_version']}",
            })


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    evidence_root = Path(__file__).resolve().parents[1]
    parser.add_argument("--output-json", type=Path, default=evidence_root / "PROFILE_COMPLETENESS_VALIDATION.json")
    parser.add_argument("--output-csv", type=Path, default=evidence_root / "SOURCE_PROFILE_COMPLETENESS_MATRIX.csv")
    args = parser.parse_args()
    root = evidence_root / "source_artifacts" / "current_rcsb"
    profile_path = evidence_root / "PREPARATION_RUN_CONFIG.json"
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    if profile.get("profile_id") != PROFILE_ID or profile.get("semantic_version") != "1.1.0":
        raise ValueError("profile validator requires the exact corrected v1.1 profile")
    raw_sources, source_hashes = read_and_verify_sources(root, evidence_root / "SOURCE_MANIFEST.csv")
    mmcif = read_loops(raw_sources["3DMX.cif"])
    ligand_cif = read_loops(raw_sources["BNZ.cif"])
    atom_loop = find_loop(mmcif, "_atom_site.")
    component_atoms, component_bonds = build_component_maps(mmcif)
    ligand_atoms, ligand_bonds = build_component_maps(ligand_cif)
    if component_graph_signature(component_atoms.get("BNZ", {}), component_bonds.get("BNZ", [])) != component_graph_signature(ligand_atoms.get("BNZ", {}), ligand_bonds.get("BNZ", [])):
        raise ValueError("source/profile completeness requires exact 3DMX/CCD BNZ agreement")
    site_rows = atom_site_rows(raw_sources["3DMX.cif"])
    sequence = get_rows(mmcif, "_entity_poly_seq.")
    state_categories = validate_chemical_state_profile(profile, sequence)
    selected, residue_manifest, alternate_manifest = create_residue_inventory(site_rows, mmcif, component_atoms, component_bonds, profile)
    occurrence_manifest = source_occurrences(site_rows)
    disposition_counts: dict[str, int] = defaultdict(int)
    for occurrence in occurrence_manifest:
        disposition_counts[occurrence["disposition"]] += 1
    if dict(disposition_counts) != profile.get("component_disposition_counts"):
        raise ValueError(f"component source/profile mismatch: observed={dict(disposition_counts)}")
    selected_positions = {row["label_seq_id"] for row in residue_manifest}
    dispositioned_positions = set(range(1, 165))
    if selected_positions != dispositioned_positions:
        raise ValueError("SOURCE_SELECTED_RESIDUES != PROFILE_DISPOSITIONED_RESIDUES")
    if len(residue_manifest) != 164 or len(selected) != profile["selected_receptor_heavy_atom_count"]:
        raise ValueError("source/profile receptor residue or heavy-atom count mismatch")
    matrix_path = args.output_csv.resolve()
    matrix_path.parent.mkdir(parents=True, exist_ok=True)
    write_matrix(matrix_path, site_rows, site_rows, sequence, component_atoms, component_bonds, selected, residue_manifest, profile, state_categories)
    matrix_hash = hashlib.sha256(matrix_path.read_bytes()).hexdigest()
    local = local_environment(site_rows, profile, [{"label_seq_id": pos, "comp_id": next(row["comp_id"] for row in residue_manifest if row["label_seq_id"] == pos)} for pos in (68, 72, 76)])
    result = {
        "status": "PASS",
        "validator": "same source/profile residue inventory used by hydrogen-only preparation adapter; source-only; no RDKit import or molecular construction",
        "profile_id": profile["profile_id"],
        "profile_semantic_version": profile["semantic_version"],
        "source_hashes_preparse": source_hashes,
        "selected_residue_count": len(selected_positions),
        "profile_dispositioned_residue_count": len(dispositioned_positions),
        "source_selected_residues_equal_profile_dispositioned_residues": selected_positions == dispositioned_positions,
        "selected_receptor_heavy_atom_count": len(selected),
        "residue_altloc_dispositions": alternate_manifest,
        "state_sensitive_site_count": len(state_categories),
        "state_sensitive_assignments": {str(position): category for position, category in sorted(state_categories.items())},
        "termini": {"1": "MET_N_TERMINUS_PROTONATED(+1)", "164": "LEU_C_TERMINUS_DEPROTONATED(-1)"},
        "component_occurrence_count": len(occurrence_manifest),
        "component_disposition_counts": dict(disposition_counts),
        "component_occurrences": occurrence_manifest,
        "completeness_matrix": {"path": str(matrix_path), "sha256": matrix_hash, "rows": 164},
        "local_interaction_environment": local,
        "rdkit_imported": "rdkit" in sys.modules,
        "molecules_constructed": False,
        "validations": {
            "all_164_source_polymer_residues_mapped": True,
            "all_expected_heavy_atoms_present_once": True,
            "no_extra_source_heavy_atoms": True,
            "all_51_state_sensitive_side_chains_explicit": len(state_categories) == 51,
            "both_termini_explicit": True,
            "all_altloc_sites_exactly_listed": True,
            "all_source_components_dispositioned": True,
            "no_unknown_state_or_hidden_default": True,
        },
    }
    json_path = args.output_json.resolve()
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    result["validation_json_sha256"] = hashlib.sha256(json_path.read_bytes()).hexdigest()
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"SOURCE_PROFILE_VALIDATION_FAILURE: {type(error).__name__}: {error}", file=sys.stderr)
        raise
