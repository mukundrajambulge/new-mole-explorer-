"""Build derived D3-FIXTURE-READY-03 matrices from the read-only source audit."""

from __future__ import annotations

import csv
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
AUDIT = HERE / "audit"
SRC = HERE / "source_artifacts" / "current_rcsb"


def read_csv(name: str) -> list[dict[str, str]]:
    with (AUDIT / name).open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        raise ValueError(f"No rows for {path}")
    fields = list(rows[0])
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


summary = read_csv("source_audit_summary.csv")
by_id = {row["pdb_id"]: row for row in summary}
deep_ids = ["1CRB", "3DMX", "3HH4", "227L", "4I7J"]

# Preserve the complete source-level atom, sequence-gap, altloc, water, and
# component inventories at the required lane-root output names.
for name in (
    "MISSING_ATOM_AUDIT.csv",
    "MISSING_RESIDUE_AUDIT.csv",
    "BINDING_SITE_ALTERNATE_MATRIX.csv",
    "WATER_AUDIT_MATRIX.csv",
    "METAL_COFACTOR_COMPONENT_MATRIX.csv",
):
    (HERE / name).write_bytes((AUDIT / name).read_bytes())

termini = []
for row in summary:
    termini.append({
        "pdb_id": row["pdb_id"],
        "candidate_set": row["candidate_set"],
        "audit_depth": row["audit_depth"],
        "receptor_label_asym": row["receptor_label_asym"],
        "receptor_entity_id": row["receptor_entity_id"],
        "expected_polymer_residues": row["polymer_expected_residues"],
        "observed_polymer_residues": row["polymer_observed_residues"],
        "missing_sequence_positions": row["missing_sequence_positions"],
        "missing_sequence_position_count": row["missing_sequence_position_count"],
        "N_endpoint_observed": row["N_terminus_sequence_endpoint_observed"],
        "N_terminal_N_present": row["N_terminus_N_atom_present"],
        "C_endpoint_observed": row["C_terminus_sequence_endpoint_observed"],
        "C_terminal_OXT_present": row["C_terminus_OXT_present"],
        "expected_peptide_links": row["expected_peptide_links"],
        "continuous_C_N_links": row["continuous_C_N_peptide_links"],
        "broken_links": row["broken_peptide_links"],
        "incomplete_residue_count": row["missing_receptor_heavy_atom_residues"],
        "missing_heavy_atom_site_count": row["missing_receptor_heavy_atom_site_count"],
        "incomplete_residue_atom_inventory": row["missing_receptor_heavy_atom_residue_ids"],
        "altloc_residue_count_total": row["protein_altloc_residue_count_total"],
        "altloc_residues_within_8A": row["protein_altloc_residues_within_8A"],
    })
write_csv(HERE / "TERMINUS_AND_CHAIN_CONTINUITY_MATRIX.csv", termini)

ligands = []
for row in summary:
    is_bnz = row["ligand_component"] == "BNZ"
    ligands.append({
        "pdb_id": row["pdb_id"],
        "ligand_component": row["ligand_component"],
        "ligand_label_asym": row["ligand_label_asym"],
        "observed_expected_CCD_heavy_atoms": row["ligand_observed_expected_heavy_atoms"],
        "expected_CCD_heavy_atoms": row["ligand_expected_CCD_heavy_atoms"],
        "missing_heavy_atom_names": row["ligand_missing_heavy_atom_names"],
        "occupancy_values": row["ligand_occupancies"],
        "ligand_altloc_ids": row["ligand_altloc_ids"],
        "single_coordinate_state": row["ligand_single_coordinate_state"],
        "CCD_identity": "BNZ / benzene / C6H6" if is_bnz else "RTL / all-trans-retinol / C20H30O",
        "formal_charge_and_state": "neutral, one connectivity graph, one aromatic ring, no stereocenters; no protomer/tautomer ambiguity" if is_bnz else "neutral deposited all-trans-retinol graph; protonation/tautomer not expected to branch, but explicit hydrogen/bond-order policy is deferred to DEC-04",
        "kinematics_readiness": "rigid six-member aromatic ring; zero search rotors; derive scorer N_tors_vina separately" if is_bnz else "conjugated polyene chain with defined deposited all-trans stereochemistry; explicit torsion-tree contract required in preparation decision",
        "local_validation_summary": "3DMX: RSCC 0.97, RSR 0.05, Q<0.9=0; no ligand geometry/clash outliers" if row["pdb_id"] == "3DMX" else ("1CRB: RSCC 0.86, RSR 0.08; validation reports 5 bond-length and 2 angle outliers" if row["pdb_id"] == "1CRB" else "See retained current RCSB full validation report where available; source audit confirms atom count, occupancy, and altloc state."),
    })
write_csv(HERE / "LIGAND_STATE_MATRIX.csv", ligands)

reason = {
    "5LJB": "Reject: N-terminal entity position 1 is unobserved (false terminal state); six waters within 5 A including direct ligand-water contacts and a water-linked polar pocket; engineered construct/source gives no advantage.",
    "1KT5": "Reject: true C-terminal OXT is absent; source study describes the retinol-associated water/H-bond context (4 waters <=5 A, 12 <=8 A).",
    "1GX8": "Reject: entity N-terminal residue is absent; multiple pocket alternate states include PHE105 within 1.48 A; low-resolution/refinement and assembly context remain problematic.",
    "6PY0": "Reject: sequence positions 1, 73, and 74 are unobserved; His71 lacks six heavy atoms; internal binding-loop state unresolved and relevant assembly is trimeric.",
    "5HBS": "Reject: C-terminal residue 140 is absent; many nearby waters and receptor alternate states; engineered construct.",
    "5H8T": "Reject: N-terminal residue 1 is absent; partial Lys68 and nearby alternate/water states; engineered construct.",
    "1KQW": "Reject: true C-terminal OXT absent; ligand is distributed over multiple refined occupancy conformers; water-rich local site.",
    "1AQB": "Reject: C-terminal sequence is incomplete and source has three receptor alternate states; remote Cd still requires explicit component disposition; not a clean first fixture.",
    "1HBP": "Reject: eight-residue sequence/coordinate gap; full ligand/water site remains water-rich; primary source record is incomplete.",
    "4QZT": "Reject: true C-terminal OXT missing, ligand instances/occupancies and pocket alternates are not a single frozen state, and acetate is 3.3928 A from ligand.",
    "9I7N": "Reject: 21 receptor heavy-atom omissions, seven missing sequence positions including mature N-terminal/internal loop, and RTL occupancy 0.598; 9I7O is closed and was not reopened.",
    "1FMJ": "Reject: terminal/gap incompleteness and a second active-site component A3P is 4.8031 A from RTL; enzyme co-complex includes unsupported Hg chemistry.",
    "1RBP": "Reject: seven unresolved C-terminal sequence positions and incomplete terminal state; less direct construct/source record.",
    "1CRB": "Hold: receptor/RTL are atom-complete with true termini and no pocket altloc, but two Cd ions coordinate receptor residues and require an unresolved unsupported-metal/component omission decision; ligand validation also has 5 bond and 2 angle outliers (RSCC 0.86).",
    "1L83": "Reject at fixed-batch screen: true C-terminal positions 163-164 absent.",
    "1L84": "Reject at fixed-batch screen: true C-terminal positions 163-164 absent.",
    "220L": "Reject at fixed-batch screen: true C-terminal positions 163-164 absent.",
    "223L": "Reject at fixed-batch screen: true C-terminal positions 163-164 absent.",
    "227L": "Reject: true C-terminal positions 163-164 absent; five waters <=5 A and nearest water 2.9646 A from BNZ.",
    "3DMX": "Pass: source/construct/assembly explicit; 164/164 residues, zero missing receptor or ligand heavy atoms, both true termini/OXT and 163/163 links; BNZ is a validated neutral rigid one-state ligand; no water or unsupported component within 8 A; no essential-water or metal dependence identified.",
    "3GUJ": "Reject: true C-terminal positions 163-164 absent; nearest water 3.7003 A and unsupported CME component is 7.8771 A from ligand.",
    "3HH4": "Reject: terminal residue is present but true C-terminal OXT is missing; four receptor altloc residues occur within 8 A.",
    "4I7J": "Reject: N-terminal positions 1-12 (including His tag) and internal position 59 absent; 27 heavy atoms missing across 11 residues; one pocket-shell Lys108 altloc.",
}

readiness = []
for row in summary:
    pid = row["pdb_id"]
    if pid == "3DMX":
        classification, feasible = "SOURCE_RESOLVED_AND_PREPARATION_READY_FOR_CORE_DRY_V1", "YES"
    elif pid == "1CRB":
        classification, feasible = "HOLD_REQUIRES_COMPONENT_SOURCE_RESOLUTION", "UNKNOWN"
    else:
        classification, feasible = "REJECTED_FOR_CURRENT_CORE_DRY_V1_PREPARATION_PATH", "NO"
    readiness.append({
        "pdb_id": pid,
        "candidate_set": row["candidate_set"],
        "audit_depth": row["audit_depth"],
        "receptor_chain_entity": f"{row['receptor_label_asym']}/{row['receptor_entity_id']}",
        "ligand": f"{row['ligand_component']}/{row['ligand_label_asym']}",
        "receptor_missing_heavy_atom_sites": row["missing_receptor_heavy_atom_site_count"],
        "incomplete_residues": row["missing_receptor_heavy_atom_residues"],
        "missing_sequence_positions": row["missing_sequence_positions"],
        "N_endpoint_and_N_atom": f"{row['N_terminus_sequence_endpoint_observed']}/{row['N_terminus_N_atom_present']}",
        "C_endpoint_and_OXT": f"{row['C_terminus_sequence_endpoint_observed']}/{row['C_terminus_OXT_present']}",
        "ligand_heavy_atoms_observed_expected": f"{row['ligand_observed_expected_heavy_atoms']}/{row['ligand_expected_CCD_heavy_atoms']}",
        "ligand_occupancies": row["ligand_occupancies"],
        "altlocs_within_8A": row["protein_altloc_residues_within_8A"],
        "waters_le_5A_and_le_8A": f"{row['waters_le_5A']}/{row['waters_le_8A']}",
        "nearest_water_A": row["nearest_water_distance_A"],
        "nonwater_components_within_8A": row["nearby_nonwater_components_le_8A"],
        "metals_within_8A": row["nearby_metals_ions_le_8A"],
        "preparation_feasibility_answer": feasible,
        "classification": classification,
        "decision_basis": reason[pid],
    })
write_csv(HERE / "PREPARATION_READINESS_MATRIX.csv", readiness)

representability = []
for pid in deep_ids:
    row = by_id[pid]
    is_selected = pid == "3DMX"
    representability.append({
        "pdb_id": pid,
        "receptor_elements_and_residues": "standard amino acids with C/N/O/S; no modified polymer residues" if pid != "4I7J" else "standard amino acids; incomplete sidechains and N-tag/sequence gap",
        "ligand_type_map": "BNZ C6H6 -> six hydrophobic/aromatic carbon atoms; supported existing C_H type" if row["ligand_component"] == "BNZ" else "RTL C20H30O carbon and hydroxyl oxygen map to existing XS types; state/geometry issues still block admission",
        "16_XS_types_and_five_terms": "No new type or term required for selected pair; 3DMX receptor C/N/O/S plus BNZ carbon map into current set" if is_selected else "Type compatibility alone does not clear source/structural blockers; no new types/terms proposed",
        "80_logical_59_physical_grid": "Existing CORE_DRY_V1 field contract applies; no field generated" if is_selected else "Not advanced to field construction",
        "water_metal_cofactor_requirements": "No water <=5 A, only one water at 7.8253 A with no ligand contact/bridge; no metal; nearest HED 10.8478 A and PO4 15.3395 A, both outside scoring shell" if pid == "3DMX" else "See component and water matrices; blocker or deferred disposition prevents a YES",
        "ligand_kinematics": "Rigid ring; search_torsion_count=0 is geometrically clear; derive scorer N_tors_vina independently during DEC-04" if row["ligand_component"] == "BNZ" else "Retinol torsion-tree/state contract remains to be resolved",
        "searchregion_geometry_only": "Frozen BNZ bounds 1.619 x 2.267 x 2.213 A; 8 A cutoff + 0.375 A one-cell halo estimate ~50 x 52 x 52 nodes, below 110; no region/field made" if is_selected else "Not evaluated for a candidate that fails source or structural gates",
        "preserve_experimental_heavy_atoms_without_structural_repair": "YES, receptor and ligand are complete; later component and altloc choices are explicit DEC-04 policy items" if is_selected else "NO or UNKNOWN; see preparation readiness matrix",
        "current_preparation_feasibility": "YES" if is_selected else "NO" if pid != "1CRB" else "UNKNOWN",
    })
write_csv(HERE / "D3_REPRESENTABILITY_MATRIX.csv", representability)

# Hash every retained current RCSB object and record exact endpoint URLs.
manifest = []
for path in sorted(SRC.iterdir(), key=lambda p: p.name.lower()):
    if not path.is_file():
        continue
    name = path.name
    if name in {"BNZ.cif", "RTL.cif"}:
        component = path.stem
        url = f"https://files.rcsb.org/ligands/view/{component}.cif"
        role = f"Official PDB Chemical Component Dictionary definition for {component}"
    elif name.endswith("_full_validation.pdf"):
        pdb_id = name.split("_")[0].lower()
        url = f"https://files.rcsb.org/pub/pdb/validation_reports/{pdb_id[1:3]}/{pdb_id}/{pdb_id}_full_validation.pdf"
        role = "Official RCSB full validation report"
    elif name.endswith("_assembly_1.json"):
        pdb_id = name.split("_")[0]
        url = f"https://data.rcsb.org/rest/v1/core/assembly/{pdb_id}/1"
        role = "RCSB biological assembly 1 metadata"
    elif name.endswith("_polymer_entity_1.json"):
        pdb_id = name.split("_")[0]
        url = f"https://data.rcsb.org/rest/v1/core/polymer_entity/{pdb_id}/1"
        role = "RCSB polymer entity 1 sequence and source metadata"
    elif name.endswith("_polymer.json"):
        pdb_id = name.split("_")[0]
        url = f"https://data.rcsb.org/rest/v1/core/polymer_entity/{pdb_id}/1"
        role = "RCSB polymer entity sequence and source metadata"
    elif name.endswith("_entry.json"):
        pdb_id = name.split("_")[0]
        url = f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
        role = "RCSB entry metadata"
    elif name.endswith(".cif"):
        pdb_id = path.stem
        url = f"https://files.rcsb.org/download/{pdb_id}.cif"
        role = "Official RCSB deposited mmCIF source coordinates"
    else:
        url = ""
        role = "Unclassified retained source file"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    manifest.append({
        "file": f"source_artifacts/current_rcsb/{name}",
        "role": role,
        "official_source_url": url,
        "retrieved_utc_date": "2026-10-03",
        "byte_length": path.stat().st_size,
        "sha256": digest,
    })
write_csv(HERE / "source_artifacts" / "SOURCE_MANIFEST.csv", manifest)
print(f"wrote {len(summary)} preparation rows, {len(deep_ids)} representability rows, {len(manifest)} source digests")
