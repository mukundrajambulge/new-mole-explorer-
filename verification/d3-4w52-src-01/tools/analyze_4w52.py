"""Read-only, reproducible analysis of the frozen 4W52 mmCIF coordinates."""
from __future__ import annotations

import json
import math
import shlex
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CIF = ROOT / "source_artifacts" / "cif" / "4W52_current.cif"
OUT = ROOT / "source_artifacts" / "derived" / "4W52_coordinate_audit.json"


def loops(path: Path):
    lines = path.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        if lines[i].strip() != "loop_":
            i += 1
            continue
        i += 1
        headers = []
        while i < len(lines) and lines[i].lstrip().startswith("_"):
            headers.append(lines[i].strip())
            i += 1
        rows = []
        while i < len(lines):
            line = lines[i].strip()
            if not line or line.startswith("#") or line == "loop_" or line.startswith("data_") or line.startswith("_"):
                break
            vals = shlex.split(line, posix=True)
            if len(vals) == len(headers):
                rows.append(dict(zip(headers, vals)))
            else:
                raise ValueError(f"CIF loop row/header mismatch at {path}:{i+1}: {len(vals)} != {len(headers)}")
            i += 1
        yield headers, rows


def d(a, b):
    return math.sqrt(sum((float(a["_atom_site." + k]) - float(b["_atom_site." + k])) ** 2 for k in ("Cartn_x", "Cartn_y", "Cartn_z")))


def minimum(a, b):
    return min(((d(x, y), x, y) for x in a for y in b), key=lambda item: item[0])


all_rows = []
unobs_atoms = []
unobs_residues = []
entity_seq = []
for headers, rows in loops(CIF):
    if headers and headers[0].startswith("_atom_site."):
        all_rows.extend(rows)
    elif headers and headers[0].startswith("_pdbx_unobs_or_zero_occ_atoms."):
        unobs_atoms = rows
    elif headers and headers[0].startswith("_pdbx_unobs_or_zero_occ_residues."):
        unobs_residues = rows
    elif headers and headers[0].startswith("_entity_poly_seq."):
        entity_seq = rows

heavy = [r for r in all_rows if r.get("_atom_site.type_symbol", "").upper() not in {"H", "D"}]
protein = [r for r in heavy if r.get("_atom_site.label_entity_id") == "1" and r.get("_atom_site.pdbx_PDB_model_num") == "1"]
ligand = [r for r in heavy if r.get("_atom_site.label_comp_id") == "BNZ" and r.get("_atom_site.pdbx_PDB_model_num") == "1"]
waters = [r for r in heavy if r.get("_atom_site.label_comp_id") in {"HOH", "DOD"} and r.get("_atom_site.pdbx_PDB_model_num") == "1"]
epe = [r for r in heavy if r.get("_atom_site.label_comp_id") == "EPE" and r.get("_atom_site.pdbx_PDB_model_num") == "1"]
other_het = [r for r in heavy if r.get("_atom_site.group_PDB") == "HETATM" and r.get("_atom_site.label_comp_id") not in {"BNZ", "EPE", "HOH", "DOD"}]
metal_symbols = {"LI", "BE", "NA", "MG", "AL", "K", "CA", "MN", "FE", "CO", "NI", "CU", "ZN", "MO", "CD", "HG"}
metals = [r for r in heavy if r.get("_atom_site.type_symbol", "").upper() in metal_symbols and r.get("_atom_site.group_PDB") == "HETATM"]

if len(ligand) != 6:
    raise ValueError(f"Expected six modeled BNZ heavy atoms, found {len(ligand)}")

dist_lig_prot = minimum(protein, ligand)
terminal_atoms = [a for a in protein if a.get("_atom_site.auth_seq_id") == "164"]
terminal_to_ligand = minimum(terminal_atoms, ligand)
dist_lig_wat = sorted((minimum(ligand, [w])[0], w) for w in waters)
dist_lig_epe = minimum(epe, ligand) if epe else None

water_detail = []
for dw, w in dist_lig_wat:
    dp, pa, wa = minimum(protein, [w])
    dl, la, ww = minimum(ligand, [w])
    water_detail.append({
        "identity": {k: w.get("_atom_site." + k) for k in ("label_asym_id", "label_seq_id", "auth_asym_id", "auth_seq_id", "label_comp_id", "label_atom_id")},
        "occupancy": float(w["_atom_site.occupancy"]),
        "nearest_BNZ_distance_A": round(dw, 3),
        "nearest_BNZ_atom": la.get("_atom_site.auth_atom_id"),
        "nearest_protein_distance_A": round(dp, 3),
        "nearest_protein_atom": {k: pa.get("_atom_site." + k) for k in ("auth_asym_id", "auth_seq_id", "auth_comp_id", "auth_atom_id")},
        "protein_water_and_water_ligand_both_le_3_5A": dp <= 3.5 and dw <= 3.5,
    })

missing_atom_detail = []
for missing in unobs_atoms:
    residue_atoms = [a for a in protein if a.get("_atom_site.auth_asym_id") == missing.get("_pdbx_unobs_or_zero_occ_atoms.auth_asym_id") and a.get("_atom_site.auth_seq_id") == missing.get("_pdbx_unobs_or_zero_occ_atoms.auth_seq_id")]
    if residue_atoms:
        dm, nearest_atom, nearest_ligand = minimum(residue_atoms, ligand)
    else:
        dm, nearest_atom, nearest_ligand = None, None, None
    missing_atom_detail.append({
        "residue": missing.get("_pdbx_unobs_or_zero_occ_atoms.auth_comp_id") + missing.get("_pdbx_unobs_or_zero_occ_atoms.auth_seq_id"),
        "missing_atom": missing.get("_pdbx_unobs_or_zero_occ_atoms.auth_atom_id"),
        "nearest_observed_residue_atom_distance_to_BNZ_A": None if dm is None else round(dm, 3),
        "nearest_observed_atom": None if nearest_atom is None else nearest_atom.get("_atom_site.auth_atom_id"),
        "within_8A_by_observed_residue_atoms": False if dm is None else dm <= 8,
    })

residues = defaultdict(list)
for atom in protein:
    key = tuple(atom.get("_atom_site." + k, "") for k in ("auth_asym_id", "auth_seq_id", "pdbx_PDB_ins_code", "auth_comp_id"))
    residues[key].append(atom)
alt_rows = []
for key, atoms in residues.items():
    alt_ids = sorted({a.get("_atom_site.label_alt_id", ".") for a in atoms if a.get("_atom_site.label_alt_id", ".") not in {".", "?"}})
    if not alt_ids:
        continue
    conformers = []
    for alt in alt_ids:
        subset = [a for a in atoms if a.get("_atom_site.label_alt_id", ".") in {".", "?", alt}]
        md, pa, la = minimum(subset, ligand)
        alt_specific = [a for a in atoms if a.get("_atom_site.label_alt_id", ".") == alt]
        ad, aa, al = minimum(alt_specific, ligand)
        occupancy = sorted({round(float(a["_atom_site.occupancy"]), 3) for a in atoms if a.get("_atom_site.label_alt_id", ".") == alt})
        contacts = []
        for a in subset:
            da, ligand_atom = minimum([a], ligand)[0], minimum([a], ligand)[2]
            if da <= 4.5:
                contacts.append({"protein_atom": a["_atom_site.auth_atom_id"], "ligand_atom": ligand_atom["_atom_site.auth_atom_id"], "distance_A": round(da, 3)})
        conformers.append({"alt_id": alt, "occupancies": occupancy, "minimum_BNZ_distance_A_including_common_atoms": round(md, 3), "nearest_residue_atom": pa.get("_atom_site.auth_atom_id"), "nearest_BNZ_atom": la.get("_atom_site.auth_atom_id"), "within_5A": md <= 5, "within_8A": md <= 8, "alternate_atoms_only_minimum_BNZ_distance_A": round(ad, 3), "nearest_alternate_atom": aa.get("_atom_site.auth_atom_id"), "nearest_BNZ_atom_to_alternate": al.get("_atom_site.auth_atom_id"), "alternate_atoms_only_within_5A": ad <= 5, "alternate_atoms_only_within_8A": ad <= 8, "contacts_le_4_5A": contacts})
    alt_rows.append({"residue": {"chain": key[0], "auth_seq_id": key[1], "insertion_code": key[2], "name": key[3]}, "atoms_with_altloc": sorted({a["_atom_site.auth_atom_id"] for a in atoms if a.get("_atom_site.label_alt_id", ".") not in {".", "?"}}), "conformers": conformers})

protein_residue_keys = sorted({(int(a["_atom_site.auth_seq_id"]), a["_atom_site.auth_comp_id"]) for a in protein})
water_residue_ids = sorted({(w["_atom_site.auth_asym_id"], w["_atom_site.auth_seq_id"], w["_atom_site.auth_comp_id"]) for w in waters})
ligand_atoms = [{"atom_name": a["_atom_site.auth_atom_id"], "element": a["_atom_site.type_symbol"], "occupancy": float(a["_atom_site.occupancy"]), "B_A2": float(a["_atom_site.B_iso_or_equiv"]), "alt_id": a["_atom_site.label_alt_id"], "xyz_A": [float(a["_atom_site.Cartn_" + x]) for x in ("x", "y", "z")]} for a in ligand]

result = {
    "source_file": str(CIF.relative_to(ROOT)),
    "models": sorted({a["_atom_site.pdbx_PDB_model_num"] for a in all_rows}),
    "atom_site_rows_total": len(all_rows),
    "heavy_atoms_total": len(heavy),
    "protein_heavy_atoms": len(protein),
    "protein_modeled_residues": len(protein_residue_keys),
    "protein_auth_residue_numbers": [n for n, _ in protein_residue_keys],
    "modeled_residue_164": {"minimum_distance_to_BNZ_A": round(terminal_to_ligand[0], 3), "nearest_atom": terminal_to_ligand[1].get("_atom_site.auth_atom_id"), "nearest_BNZ_atom": terminal_to_ligand[2].get("_atom_site.auth_atom_id")},
    "protein_missing_heavy_atom_count_from_CIF_annotation": len(unobs_atoms),
    "missing_heavy_atom_annotations": missing_atom_detail,
    "unobserved_polymer_residues": [{k.split(".")[-1]: v for k, v in row.items()} for row in unobs_residues],
    "BNZ": {
        "atom_count": len(ligand),
        "atoms": ligand_atoms,
        "label_asym_id": ligand[0]["_atom_site.label_asym_id"],
        "auth_asym_id": ligand[0]["_atom_site.auth_asym_id"],
        "auth_seq_id": ligand[0]["_atom_site.auth_seq_id"],
        "occupancies": sorted({float(a["_atom_site.occupancy"]) for a in ligand}),
        "alt_ids": sorted({a["_atom_site.label_alt_id"] for a in ligand}),
        "minimum_distance_to_protein_A": round(dist_lig_prot[0], 3),
        "minimum_contact_atom_pair": {"protein": {k: dist_lig_prot[1].get("_atom_site." + k) for k in ("auth_seq_id", "auth_comp_id", "auth_atom_id")}, "BNZ_atom": dist_lig_prot[2]["_atom_site.auth_atom_id"]},
    },
    "alternate_conformation_residue_count": len(alt_rows),
    "alternate_conformations": alt_rows,
    "water_count": len(water_residue_ids),
    "waters_within_5A": sum(d <= 5 for d, _ in dist_lig_wat),
    "waters_within_8A": sum(d <= 8 for d, _ in dist_lig_wat),
    "waters": water_detail,
    "EPE": None if not epe else {"atom_count": len(epe), "residue_ids": sorted({(r["_atom_site.label_asym_id"], r["_atom_site.auth_asym_id"], r["_atom_site.auth_seq_id"]) for r in epe}), "occupancies": sorted({float(a["_atom_site.occupancy"]) for a in epe}), "minimum_distance_to_BNZ_A": round(dist_lig_epe[0], 3), "nearest_EPE_atom": dist_lig_epe[1]["_atom_site.auth_atom_id"], "nearest_BNZ_atom": dist_lig_epe[2]["_atom_site.auth_atom_id"]},
    "other_nonpolymer_residue_names": sorted({r["_atom_site.label_comp_id"] for r in other_het}),
    "metal_atom_count": len(metals),
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "models": result["models"],
    "atom_site_rows_total": result["atom_site_rows_total"],
    "protein_heavy_atoms": result["protein_heavy_atoms"],
    "protein_modeled_residues": result["protein_modeled_residues"],
    "modeled_residue_164": result["modeled_residue_164"],
    "protein_missing_heavy_atom_count_from_CIF_annotation": result["protein_missing_heavy_atom_count_from_CIF_annotation"],
    "alternate_conformation_residue_count": result["alternate_conformation_residue_count"],
    "alternate_conformations": [{"residue": x["residue"], "atoms_with_altloc": x["atoms_with_altloc"], "conformers": [{k: c[k] for k in ("alt_id", "occupancies", "minimum_BNZ_distance_A_including_common_atoms", "within_5A", "within_8A", "alternate_atoms_only_minimum_BNZ_distance_A", "alternate_atoms_only_within_5A", "alternate_atoms_only_within_8A", "contacts_le_4_5A")} for c in x["conformers"]]} for x in alt_rows],
    "BNZ": result["BNZ"],
    "water_count": result["water_count"],
    "waters_within_5A": result["waters_within_5A"],
    "waters_within_8A": result["waters_within_8A"],
    "nearest_water": result["waters"][0] if result["waters"] else None,
    "EPE": result["EPE"],
    "other_nonpolymer_residue_names": result["other_nonpolymer_residue_names"],
    "metal_atom_count": result["metal_atom_count"],
}, indent=2))
