"""Read-only atom-level source audit for D3-FIXTURE-READY-03.

Reads official current RCSB PDBx/mmCIF files and writes structural inventory
tables only. It does not prepare molecules, modify coordinates, repair atoms,
assign protonation, build PDBQT, score, or dock.
"""

from __future__ import annotations

import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parents[1]
SRC = HERE / "source_artifacts" / "current_rcsb"
OUT = HERE / "audit"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "d3-fixture-cohort-02" / "audit"))
from audit_mmcif import f, loops  # noqa: E402


# (receptor label_asym, ligand component, ligand label_asym)
PAIRS = {
    # Existing detailed 28-entry cohort: five prior deep finalists plus ten
    # detailed screens.
    "5LJB": ("A", "RTL", "B"),
    "1KT5": ("A", "RTL", "B"),
    "1GX8": ("A", "RTL", "B"),
    "6PY0": ("A", "RTL", "D"),
    # 9I7O is deliberately closed under the prior HOLD/rejection and is not
    # re-screened here. Its corrected sequence interpretation is cited in the
    # separate reconciliation reference.
    "5HBS": ("A", "RTL", "B"),
    "5H8T": ("A", "RTL", "B"),
    "1KQW": ("A", "RTL", "B"),
    "1AQB": ("A", "RTL", "C"),
    "1HBP": ("A", "RTL", "B"),
    "4QZT": ("A", "RTL", "E"),
    "9I7N": ("A", "RTL", "B"),
    "1FMJ": ("A", "RTL", "H"),
    "1RBP": ("A", "RTL", "B"),
    "1CRB": ("A", "RTL", "D"),
    # One bounded external batch. The receptor chain for 4I7J is one of two
    # repeated complexes; chain A is selected consistently for this audit.
    "1L83": ("A", "BNZ", "F"),
    "1L84": ("A", "BNZ", "F"),
    "220L": ("A", "BNZ", "F"),
    "223L": ("A", "BNZ", "F"),
    "227L": ("A", "BNZ", "F"),
    "3DMX": ("A", "BNZ", "G"),
    "3GUJ": ("A", "BNZ", "B"),
    "3HH4": ("A", "BNZ", "E"),
    "4I7J": ("A", "BNZ", "D"),
}

EXISTING = {"5LJB", "1KT5", "1GX8", "6PY0", "5HBS", "5H8T", "1KQW", "1AQB", "1HBP", "4QZT", "9I7N", "1FMJ", "1RBP", "1CRB"}
EXTERNAL_DEEP = {"3DMX", "3HH4", "227L", "4I7J"}
DEEP_FINALISTS = EXTERNAL_DEEP | {"1CRB"}


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def atom_xyz(row):
    return tuple(float(row[f"_atom_site.Cartn_{axis}"]) for axis in "xyz")


def read_cif(path: Path):
    atom_rows = []
    chem_atoms = defaultdict(dict)
    chem_bonds = defaultdict(list)
    poly_seq = defaultdict(dict)
    unobs_atoms = []
    unobs_residues = []
    ref_diffs = []
    for headers, rows in loops(path):
        first = headers[0]
        if first.startswith("_atom_site."):
            atom_rows = rows
        elif first.startswith("_entity_poly_seq."):
            for row in rows:
                ent = f(row, "_entity_poly_seq.entity_id")
                num = int(row["_entity_poly_seq.num"])
                poly_seq[ent][num] = f(row, "_entity_poly_seq.mon_id")
        elif first.startswith("_chem_comp_atom."):
            for row in rows:
                comp = f(row, "_chem_comp_atom.comp_id")
                name = f(row, "_chem_comp_atom.atom_id")
                element = f(row, "_chem_comp_atom.type_symbol", "").upper()
                if comp and name and element not in {"H", "D"}:
                    chem_atoms[comp][name] = element
        elif first.startswith("_chem_comp_bond."):
            for row in rows:
                comp = f(row, "_chem_comp_bond.comp_id")
                if comp:
                    chem_bonds[comp].append(row)
        elif first.startswith("_pdbx_unobs_or_zero_occ_atoms."):
            unobs_atoms = rows
        elif first.startswith("_pdbx_unobs_or_zero_occ_residues."):
            unobs_residues = rows
        elif first.startswith("_struct_ref_seq_dif."):
            ref_diffs = rows
    if not atom_rows or not poly_seq:
        raise ValueError(f"Missing atom_site or entity_poly_seq in {path}")
    atoms = []
    for row in atom_rows:
        if f(row, "_atom_site.pdbx_PDB_model_num", "1") != "1":
            continue
        element = f(row, "_atom_site.type_symbol", "").upper()
        if element in {"H", "D"}:
            continue
        atoms.append({
            "group": f(row, "_atom_site.group_PDB"),
            "element": element,
            "atom": f(row, "_atom_site.label_atom_id"),
            "alt": f(row, "_atom_site.label_alt_id", "."),
            "comp": f(row, "_atom_site.label_comp_id"),
            "asym": f(row, "_atom_site.label_asym_id"),
            "entity": f(row, "_atom_site.label_entity_id"),
            "seq": f(row, "_atom_site.label_seq_id"),
            "auth_asym": f(row, "_atom_site.auth_asym_id"),
            "auth_seq": f(row, "_atom_site.auth_seq_id"),
            "occ": float(f(row, "_atom_site.occupancy", "1")),
            "b": float(f(row, "_atom_site.B_iso_or_equiv", "0")),
            "xyz": atom_xyz(row),
        })
    return atoms, chem_atoms, chem_bonds, poly_seq, unobs_atoms, unobs_residues, ref_diffs


def min_distance(atoms, ligand):
    if not atoms or not ligand:
        return None
    return min(distance(a["xyz"], l["xyz"]) for a in atoms for l in ligand)


def csv_write(path, fields, rows):
    fields = list(dict.fromkeys(list(fields) + [key for row in rows for key in row if key not in fields]))
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def bond_gap(atom_by_name):
    c, n = atom_by_name.get("C"), atom_by_name.get("N")
    return distance(c["xyz"], n["xyz"]) if c and n else None


def run_one(pdb_id):
    receptor_asym, ligand_comp, ligand_asym = PAIRS[pdb_id]
    path = SRC / f"{pdb_id}.cif"
    atoms, chem_atoms, chem_bonds, poly_seq, unobs_atoms, unobs_residues, ref_diffs = read_cif(path)
    ligand = [a for a in atoms if a["comp"] == ligand_comp and a["asym"] == ligand_asym]
    if not ligand:
        raise ValueError(f"Missing selected ligand {pdb_id}/{ligand_comp}/{ligand_asym}")
    ligand_residue_keys = sorted({(a["auth_asym"], a["auth_seq"], a["comp"]) for a in ligand})
    lig_entity = ligand[0]["entity"]

    # The selected chain is audited by label asym and polymer entity; include
    # any polymer atoms deposited as HETATM under a modified component.
    receptor = [a for a in atoms if a["asym"] == receptor_asym and a["entity"] in poly_seq and a["seq"] not in (None, ".", "?")]
    if not receptor:
        raise ValueError(f"No polymer atoms for receptor chain {receptor_asym} in {pdb_id}")
    entity = receptor[0]["entity"]
    expected_seq = poly_seq[entity]
    observed_seq = {int(a["seq"]) for a in receptor}
    first_expected, last_expected = min(expected_seq), max(expected_seq)
    first_observed, last_observed = min(observed_seq), max(observed_seq)
    complete_n_residue = first_observed == first_expected
    complete_c_residue = last_observed == last_expected
    residue_rows = defaultdict(list)
    for a in receptor:
        residue_rows[(int(a["seq"]), a["comp"])].append(a)
    sequence_gaps = sorted(set(expected_seq) - observed_seq)
    ligand_names = sorted({a["atom"] for a in ligand})
    expected_ligand_names = sorted(chem_atoms.get(ligand_comp, {}))
    ligand_missing = sorted(set(expected_ligand_names) - set(ligand_names))
    ligand_alt = defaultdict(list)
    for a in ligand:
        if a["alt"] not in {None, ".", "?"}:
            ligand_alt[a["alt"]].append(a)
    ligand_occupancies = sorted({a["occ"] for a in ligand})
    ligand_completeness = len(set(expected_ligand_names) & set(ligand_names))
    ligand_residue_min = min_distance(ligand, ligand)

    # True construct termini are taken from the deposited polymer sequence;
    # explicit OXT is required when that construct endpoint is modeled.
    first_atoms = [a for a in receptor if int(a["seq"]) == first_expected]
    last_atoms = [a for a in receptor if int(a["seq"]) == last_expected]
    n_atom_present = any(a["atom"] == "N" for a in first_atoms)
    oxt_present = any(a["atom"] == "OXT" for a in last_atoms)

    atom_audit = []
    incomplete_residue_rows = []
    for seq_id, comp in sorted(residue_rows):
        atoms_here = residue_rows[(seq_id, comp)]
        # PDB CCD residue definitions commonly include OXT as a terminal
        # option. It is not expected at internal peptide residues.
        expected_names = set(chem_atoms.get(comp, {})) - {"OXT"}
        observed_names = {a["atom"] for a in atoms_here}
        missing_names = sorted(expected_names - observed_names)
        # OXT is a terminal variant rather than part of the CCD's internal
        # amino-acid graph. Require it at the true polymer C terminus.
        if seq_id == last_expected and atoms_here and "OXT" not in observed_names:
            missing_names.append("OXT[terminal-carboxyl]")
        dmin = min_distance(atoms_here, ligand)
        nearest = None
        if atoms_here:
            nearest = min(((distance(a["xyz"], l["xyz"]), a, l) for a in atoms_here for l in ligand), key=lambda x: x[0])
        missing_plausible = "yes" if dmin is not None and dmin <= 8.0 else ("unlikely" if dmin is not None and dmin > 12.0 else "uncertain")
        row = {
            "pdb_id": pdb_id,
            "candidate_set": "existing_28_cohort" if pdb_id in EXISTING else "external_fixed_batch_9",
            "receptor_label_asym": receptor_asym,
            "receptor_entity_id": entity,
            "label_seq_id": seq_id,
            "residue_comp_id": comp,
            "expected_heavy_atom_count_CCD_plus_terminal": len(expected_names) + (1 if seq_id == last_expected and atoms_here else 0),
            "expected_heavy_atom_names_CCD_plus_terminal": ";".join(sorted(expected_names | ({"OXT[terminal-carboxyl]"} if seq_id == last_expected and atoms_here else set()))),
            "observed_heavy_atom_names_union_of_altlocs": ";".join(sorted(observed_names)),
            "missing_expected_heavy_atom_names": ";".join(missing_names),
            "observed_heavy_atom_count_union_of_altlocs": len(observed_names),
            "observed_atom_rows_including_altlocs": len(atoms_here),
            "incomplete_heavy_atom_site": "yes" if missing_names else "no",
            "minimum_observed_residue_ligand_distance_A": f"{dmin:.4f}" if dmin is not None else "",
            "nearest_observed_residue_atom": nearest[1]["atom"] if nearest else "",
            "nearest_observed_ligand_atom": nearest[2]["atom"] if nearest else "",
            "within_5A": "yes" if dmin is not None and dmin <= 5.0 else "no",
            "within_8A": "yes" if dmin is not None and dmin <= 8.0 else "no",
            "missing_atoms_plausible_in_scoring_environment": missing_plausible if missing_names else "not_applicable",
        }
        atom_audit.append(row)
        if missing_names:
            incomplete_residue_rows.append(row)

    missing_residue_audit = []
    for seq_id in sequence_gaps:
        terminal = "N-terminal" if seq_id < first_observed else "C-terminal" if seq_id > last_observed else "internal"
        # Bound the potential relevance using the observed flanks; no gap
        # coordinates are estimated. If either flank is in the 12 A shell,
        # the missing segment is treated as plausibly relevant.
        flanks = []
        left = seq_id - 1
        right = seq_id + 1
        if left in expected_seq and (left, expected_seq[left]) in residue_rows:
            flanks.extend(residue_rows[(left, expected_seq[left])])
        if right in expected_seq and (right, expected_seq[right]) in residue_rows:
            flanks.extend(residue_rows[(right, expected_seq[right])])
        flank_distance = min_distance(flanks, ligand)
        missing_residue_audit.append({
            "pdb_id": pdb_id,
            "receptor_label_asym": receptor_asym,
            "receptor_entity_id": entity,
            "missing_label_seq_id": seq_id,
            "expected_residue_comp_id": expected_seq[seq_id],
            "gap_class_relative_to_observed_coordinates": terminal,
            "physical_construct_membership": "in deposited entity sequence; source construct details separately recorded",
            "flanking_modeled_residue_ligand_min_distance_A": f"{flank_distance:.4f}" if flank_distance is not None else "",
            "gap_site_relevance_without_coordinate_inference": "flank within 12 A; plausible" if flank_distance is not None and flank_distance <= 12 else "not localized by adjacent coordinates",
            "coordinate_repair_performed": "no",
        })

    # Sequential peptide-link audit, including count of expected links.
    expected_links = max(0, last_expected - first_expected)
    continuous_links = 0
    broken_links = []
    for seq_id in range(first_expected, last_expected):
        if seq_id not in observed_seq or seq_id + 1 not in observed_seq:
            broken_links.append(f"{seq_id}-{seq_id + 1}:missing_residue")
            continue
        left_atoms = residue_rows.get((seq_id, expected_seq[seq_id]), [])
        right_atoms = residue_rows.get((seq_id + 1, expected_seq[seq_id + 1]), [])
        left_names = {a["atom"]: a for a in left_atoms if a["alt"] in {None, ".", "?", "A"}}
        right_names = {a["atom"]: a for a in right_atoms if a["alt"] in {None, ".", "?", "A"}}
        c_atom = left_names.get("C")
        n_atom = right_names.get("N")
        c_n = distance(c_atom["xyz"], n_atom["xyz"]) if c_atom and n_atom else None
        if c_n is not None and 1.1 <= c_n <= 1.8:
            continuous_links += 1
        else:
            broken_links.append(f"{seq_id}-{seq_id + 1}:C-N={c_n:.3f}" if c_n is not None else f"{seq_id}-{seq_id + 1}:missing_backbone_atom")

    # Alternate conformations within 8 A: retain IDs, occupancy, affected atom
    # names and per-state minimum distance, rather than choosing a state.
    alt_groups = defaultdict(list)
    for a in receptor:
        if a["alt"] not in {None, ".", "?"}:
            alt_groups[(int(a["seq"]), a["comp"])].append(a)
    alt_audit = []
    for (seq_id, comp), states in sorted(alt_groups.items()):
        per_state = defaultdict(list)
        for a in states:
            per_state[a["alt"]].append(a)
        state_records = []
        for alt_id, alt_atoms in sorted(per_state.items()):
            state_records.append({
                "altloc": alt_id,
                "occupancy_values": sorted({a["occ"] for a in alt_atoms}),
                "atom_names": sorted({a["atom"] for a in alt_atoms}),
                "minimum_atom_ligand_distance_A": min_distance(alt_atoms, ligand),
            })
        dmin = min(x["minimum_atom_ligand_distance_A"] for x in state_records)
        if dmin <= 8.0:
            alt_audit.append({
                "pdb_id": pdb_id,
                "receptor_label_asym": receptor_asym,
                "label_seq_id": seq_id,
                "residue_comp_id": comp,
                "altloc_ids": ";".join(x["altloc"] for x in state_records),
                "state_occupancies": ";".join(f"{x['altloc']}:{','.join(map(str,x['occupancy_values']))}" for x in state_records),
                "affected_atom_names_by_state": ";".join(f"{x['altloc']}={','.join(x['atom_names'])}" for x in state_records),
                "minimum_alt_atom_ligand_distance_A": f"{dmin:.4f}",
                "nearest_state_distances_A": ";".join(f"{x['altloc']}:{x['minimum_atom_ligand_distance_A']:.4f}" for x in state_records),
                "core_site_within_5A": "yes" if dmin <= 5 else "no",
                "interaction_geometry_change_assessment": "not direct ligand-contact geometry; outside 5 A" if dmin > 5 else "requires explicit state review",
                "dominant_state_explicit_in_deposit": "one major occupancy state only" if len(state_records) > 1 and max(max(x["occupancy_values"]) for x in state_records) >= 0.7 else "no single >=0.7 state / assess",
            })

    # Component-level water/nonpolymer audit, each residue counted once by
    # minimum heavy-atom distance to the selected ligand.
    water_by_key = {}
    other_by_key = {}
    metal_symbols = {"LI", "NA", "K", "MG", "CA", "MN", "FE", "CO", "NI", "CU", "ZN", "MO", "W", "CD", "HG"}
    for a in atoms:
        if a["group"] != "HETATM" or a["comp"] == ligand_comp:
            continue
        key = (a["asym"], a["auth_seq"], a["comp"])
        d = min_distance([a], ligand)
        if a["comp"] in {"HOH", "WAT", "DOD"}:
            item = water_by_key.setdefault(key, {"atoms": [], "distance": d, "occupancy": a["occ"]})
            item["atoms"].append(a)
            item["distance"] = min(item["distance"], d)
        else:
            item = other_by_key.setdefault(key, {"atoms": [], "distance": d})
            item["atoms"].append(a)
            item["distance"] = min(item["distance"], d)
    water_dists = sorted(v["distance"] for v in water_by_key.values())
    water_summary = {
        "waters_le_5A": sum(d <= 5.0 for d in water_dists),
        "waters_le_8A": sum(d <= 8.0 for d in water_dists),
        "nearest_water_distance_A": f"{water_dists[0]:.4f}" if water_dists else "none",
    }
    water_audit = []
    for key, item in sorted(water_by_key.items(), key=lambda pair: pair[1]["distance"]):
        if item["distance"] <= 8.0:
            nearest_lig = min(((distance(w["xyz"], l["xyz"]), w, l) for w in item["atoms"] for l in ligand), key=lambda x: x[0])
            nearest_protein = min(((distance(w["xyz"], r["xyz"]), w, r) for w in item["atoms"] for r in receptor), key=lambda x: x[0]) if receptor else None
            water_audit.append({
                "pdb_id": pdb_id,
                **water_summary,
                "water_label_asym": key[0],
                "water_auth_seq_id": key[1],
                "water_comp_id": key[2],
                "occupancy": item["occupancy"],
                "minimum_ligand_distance_A": f"{item['distance']:.4f}",
                "nearest_ligand_atom": nearest_lig[2]["atom"],
                "nearest_protein_distance_A": f"{nearest_protein[0]:.4f}" if nearest_protein else "",
                "nearest_protein_residue_atom": f"{nearest_protein[2]['comp']}:{nearest_protein[2]['auth_seq']}:{nearest_protein[2]['atom']}" if nearest_protein else "",
                "direct_ligand_water_contact_le_3_5A": "yes" if item["distance"] <= 3.5 else "no",
                "geometry_only_water_bridge_candidate": "possible geometry only" if item["distance"] <= 3.5 and nearest_protein and nearest_protein[0] <= 3.6 else "no geometric bridge at these cutoffs",
            })
    component_audit = []
    for key, item in sorted(other_by_key.items(), key=lambda pair: pair[1]["distance"]):
        es = sorted({a["element"] for a in item["atoms"]})
        component_audit.append({
            "pdb_id": pdb_id,
            "component_label_asym": key[0],
            "component_auth_seq_id": key[1],
            "component_id": key[2],
            "elements": ";".join(es),
            "minimum_ligand_distance_A": f"{item['distance']:.4f}",
            "within_5A": "yes" if item["distance"] <= 5 else "no",
            "within_8A": "yes" if item["distance"] <= 8 else "no",
            "metal_or_ion": "yes" if set(es) & metal_symbols else "no",
            "CORE_DRY_V1_disposition_evidence_needed": (
                "review site role; no blanket deletion" if item["distance"] <= 8
                else "remote from ligand scoring shell; record provenance and omission rationale"
            ),
        })

    # Unobserved atom remarks may have labels not represented by coordinate
    # rows; preserve chain-specific reporting alongside the atom-list diff.
    unobs_chain_rows = [r for r in unobs_atoms if f(r, "_pdbx_unobs_or_zero_occ_atoms.label_asym_id") == receptor_asym]
    unobs_res_chain_rows = [r for r in unobs_residues if f(r, "_pdbx_unobs_or_zero_occ_residues.label_asym_id") == receptor_asym]
    receptor_alt_summary = len(alt_groups)
    comps_dists = sorted(v["distance"] for v in other_by_key.values())
    ligand_bounds = {axis: [min(a["xyz"][i] for a in ligand), max(a["xyz"][i] for a in ligand)] for i, axis in enumerate("xyz")}
    summary = {
        "pdb_id": pdb_id,
        "candidate_set": "existing_28_cohort" if pdb_id in EXISTING else "external_fixed_batch_9",
        "audit_depth": "deep_finalist" if pdb_id in DEEP_FINALISTS else "detailed_or_external_screen",
        "receptor_label_asym": receptor_asym,
        "receptor_entity_id": entity,
        "ligand_component": ligand_comp,
        "ligand_label_asym": ligand_asym,
        "ligand_entity_id": lig_entity,
        "ligand_residues": json.dumps(ligand_residue_keys),
        "ligand_expected_CCD_heavy_atoms": len(expected_ligand_names),
        "ligand_observed_heavy_atom_names": ";".join(ligand_names),
        "ligand_observed_expected_heavy_atoms": ligand_completeness,
        "ligand_missing_heavy_atom_names": ";".join(ligand_missing),
        "ligand_occupancies": ";".join(map(str, ligand_occupancies)),
        "ligand_altloc_ids": ";".join(sorted(ligand_alt)),
        "ligand_single_coordinate_state": "yes" if not ligand_alt else "no",
        "polymer_expected_residues": len(expected_seq),
        "polymer_observed_residues": len(observed_seq),
        "missing_sequence_positions": ";".join(map(str, sequence_gaps)),
        "missing_sequence_position_count": len(sequence_gaps),
        "missing_receptor_heavy_atom_residues": sum(bool(r["missing_expected_heavy_atom_names"]) for r in incomplete_residue_rows),
        "missing_receptor_heavy_atom_site_count": sum(len(r["missing_expected_heavy_atom_names"].split(";")) for r in incomplete_residue_rows),
        "missing_receptor_heavy_atom_residue_ids": ";".join(f"{r['label_seq_id']}:{r['residue_comp_id']}[{r['missing_expected_heavy_atom_names']}]" for r in incomplete_residue_rows),
        "N_terminus_sequence_endpoint_observed": "yes" if complete_n_residue else "no",
        "N_terminus_N_atom_present": "yes" if n_atom_present else "no",
        "C_terminus_sequence_endpoint_observed": "yes" if complete_c_residue else "no",
        "C_terminus_OXT_present": "yes" if oxt_present else "no",
        "expected_peptide_links": expected_links,
        "continuous_C_N_peptide_links": continuous_links,
        "broken_peptide_links": ";".join(broken_links),
        "protein_altloc_residue_count_total": receptor_alt_summary,
        "protein_altloc_residues_within_8A": ";".join(f"{r['label_seq_id']}:{r['residue_comp_id']}@{r['minimum_alt_atom_ligand_distance_A']}A" for r in alt_audit),
        "waters_le_5A": sum(d <= 5.0 for d in water_dists),
        "waters_le_8A": sum(d <= 8.0 for d in water_dists),
        "nearest_water_distance_A": f"{water_dists[0]:.4f}" if water_dists else "none",
        "nearby_nonwater_components_le_8A": ";".join(f"{r['component_id']}:{r['minimum_ligand_distance_A']}A" for r in component_audit if r["within_8A"] == "yes"),
        "nearby_metals_ions_le_8A": ";".join(f"{r['component_id']}:{r['minimum_ligand_distance_A']}A" for r in component_audit if r["metal_or_ion"] == "yes" and r["within_8A"] == "yes"),
        "ligand_coordinate_bounds_A": json.dumps(ligand_bounds, sort_keys=True),
        "chain_specific_unobserved_atom_records": len(unobs_chain_rows),
        "chain_specific_unobserved_residue_records": len(unobs_res_chain_rows),
        "struct_ref_seq_dif_rows": sum(1 for r in ref_diffs if receptor_asym in (f(r, "_struct_ref_seq_dif.pdbx_pdb_strand_id", "") or "").split(",")),
    }
    return summary, atom_audit, missing_residue_audit, alt_audit, water_audit, component_audit


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    summaries, atom_rows, missing_rows, alt_rows, water_rows, component_rows = [], [], [], [], [], []
    for pdb_id in PAIRS:
        data = run_one(pdb_id)
        summary, atoms, gaps, alts, waters, comps = data
        summaries.append(summary)
        atom_rows.extend(atoms)
        missing_rows.extend(gaps)
        alt_rows.extend(alts or [{"pdb_id": pdb_id, "receptor_label_asym": PAIRS[pdb_id][0], "altloc_ids": "NONE within 8 A"}])
        water_rows.extend(waters or [{"pdb_id": pdb_id, "waters_le_5A": summaries[-1]["waters_le_5A"], "waters_le_8A": summaries[-1]["waters_le_8A"], "nearest_water_distance_A": summaries[-1]["nearest_water_distance_A"], "water_label_asym": "NONE within 8 A", "minimum_ligand_distance_A": "no water within 8 A"}])
        component_rows.extend(comps or [{"pdb_id": pdb_id, "component_label_asym": "NONE", "minimum_ligand_distance_A": "no nonwater components in source"}])
    csv_write(OUT / "source_audit_summary.csv", list(summaries[0]), summaries)
    csv_write(OUT / "MISSING_ATOM_AUDIT.csv", list(atom_rows[0]), atom_rows)
    csv_write(OUT / "MISSING_RESIDUE_AUDIT.csv", list(missing_rows[0]) if missing_rows else ["pdb_id"], missing_rows)
    csv_write(OUT / "BINDING_SITE_ALTERNATE_MATRIX.csv", list(alt_rows[0]), alt_rows)
    csv_write(OUT / "WATER_AUDIT_MATRIX.csv", list(water_rows[0]), water_rows)
    csv_write(OUT / "METAL_COFACTOR_COMPONENT_MATRIX.csv", list(component_rows[0]), component_rows)
    print(json.dumps({
        "candidates": len(summaries),
        "per_candidate": [{k: r[k] for k in ("pdb_id", "missing_receptor_heavy_atom_residues", "missing_receptor_heavy_atom_site_count", "missing_sequence_position_count", "N_terminus_sequence_endpoint_observed", "C_terminus_sequence_endpoint_observed", "C_terminus_OXT_present", "protein_altloc_residues_within_8A", "waters_le_5A", "waters_le_8A", "nearest_water_distance_A", "nearby_nonwater_components_le_8A")} for r in summaries],
    }, indent=2))


if __name__ == "__main__":
    main()
