"""Read-only structural triage for deposited PDBx/mmCIF coordinates.

This script does not alter coordinates, add atoms, assign protonation, prepare
PDBQT, or evaluate a docking score. It reports source-coordinate completeness,
minimum heavy-atom distances, and geometry-only water-neighbor context for a
selected ligand instance. Water-neighbor geometry is not a hydrogen-bond
assignment or an essential-water conclusion.
"""

from __future__ import annotations

import json
import math
import shlex
import sys
from collections import defaultdict
from pathlib import Path


def loops(path: Path):
    lines = path.read_text(encoding="utf-8", errors="strict").splitlines()
    i = 0
    while i < len(lines):
        if lines[i].strip().lower() != "loop_":
            i += 1
            continue
        i += 1
        headers = []
        while i < len(lines) and lines[i].lstrip().startswith("_"):
            headers.append(lines[i].strip())
            i += 1
        if not headers:
            continue
        rows = []
        pending = []
        while i < len(lines):
            s = lines[i].strip()
            if not s or s.startswith("#"):
                if pending:
                    raise ValueError(f"wrapped row before comment at line {i+1}")
                i += 1
                continue
            if s.lower() == "loop_" or s.startswith("_") or s.lower().startswith(("data_", "save_")):
                break
            if lines[i].startswith(";"):
                text = [lines[i][1:]]
                i += 1
                while i < len(lines) and not lines[i].startswith(";"):
                    text.append(lines[i])
                    i += 1
                if i >= len(lines):
                    raise ValueError(f"unterminated semicolon text at line {i+1}")
                pending.append("\n".join(text))
                while len(pending) >= len(headers):
                    rows.append(dict(zip(headers, pending[: len(headers)])))
                    pending = pending[len(headers) :]
                i += 1
                continue
            pending.extend(shlex.split(s, posix=True, comments=False))
            while len(pending) >= len(headers):
                rows.append(dict(zip(headers, pending[: len(headers)])))
                pending = pending[len(headers) :]
            i += 1
        if pending:
            raise ValueError(f"incomplete row for loop {headers[0]} in {path}")
        yield headers, rows


def f(row, key, default=None):
    value = row.get(key, default)
    if value in (None, ".", "?"):
        return default
    return value


def atom_coords(atom):
    return tuple(float(atom[k]) for k in ("_atom_site.Cartn_x", "_atom_site.Cartn_y", "_atom_site.Cartn_z"))


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def run(path: Path, ligand_comp: str, ligand_asym: str | None, receptor_asym: str | None):
    atom_rows = []
    expected_poly = defaultdict(set)
    unobs_atoms = []
    unobs_residues = []
    for headers, rows in loops(path):
        first = headers[0]
        if first.startswith("_atom_site."):
            atom_rows = rows
        elif first.startswith("_entity_poly_seq."):
            for r in rows:
                expected_poly[f(r, "_entity_poly_seq.entity_id")].add(int(r["_entity_poly_seq.num"]))
        elif first.startswith("_pdbx_unobs_or_zero_occ_atoms."):
            unobs_atoms = rows
        elif first.startswith("_pdbx_unobs_or_zero_occ_residues."):
            unobs_residues = rows

    if not atom_rows:
        raise ValueError(f"No _atom_site loop found in {path}")
    atoms = []
    for r in atom_rows:
        if f(r, "_atom_site.pdbx_PDB_model_num", "1") != "1":
            continue
        element = f(r, "_atom_site.type_symbol", "").upper()
        if element in {"H", "D"}:
            continue
        a = {
            "group": f(r, "_atom_site.group_PDB"),
            "element": element,
            "atom": f(r, "_atom_site.label_atom_id"),
            "alt": f(r, "_atom_site.label_alt_id", "."),
            "comp": f(r, "_atom_site.label_comp_id"),
            "asym": f(r, "_atom_site.label_asym_id"),
            "entity": f(r, "_atom_site.label_entity_id"),
            "seq": f(r, "_atom_site.label_seq_id"),
            "auth_asym": f(r, "_atom_site.auth_asym_id"),
            "auth_seq": f(r, "_atom_site.auth_seq_id"),
            "occ": float(f(r, "_atom_site.occupancy", "1")),
            "b": float(f(r, "_atom_site.B_iso_or_equiv", "0")),
            "xyz": atom_coords(r),
        }
        atoms.append(a)

    ligands = [a for a in atoms if a["comp"] == ligand_comp and (ligand_asym is None or a["asym"] == ligand_asym)]
    if not ligands:
        raise ValueError(f"Ligand {ligand_comp} asym {ligand_asym!r} not found")
    asym_values = sorted({a["asym"] for a in ligands})
    if len(asym_values) != 1:
        raise ValueError(f"Specify ligand_asym; found {asym_values}")
    ligand_asym = asym_values[0]
    ligand_residues = sorted({(a["auth_asym"], a["auth_seq"], a["comp"]) for a in ligands})
    ligand_atom_names = sorted({a["atom"] for a in ligands})
    receptor = [a for a in atoms if a["group"] == "ATOM" and (receptor_asym is None or a["asym"] == receptor_asym)]
    if not receptor:
        raise ValueError("No receptor polymer atoms found")
    if receptor_asym is None:
        receptor_asym = sorted({a["asym"] for a in receptor})[0]
    receptor = [a for a in receptor if a["asym"] == receptor_asym]

    def min_to_ligand(a):
        return min(dist(a["xyz"], b["xyz"]) for b in ligands)

    waters = [a for a in atoms if a["comp"] in {"HOH", "WAT", "DOD"} and a["element"] == "O"]
    water_groups = {}
    water_atoms_by_key = {}
    for a in waters:
        key = (a["asym"], a["auth_seq"], a["comp"])
        d = min_to_ligand(a)
        if key not in water_groups or d < water_groups[key]["min_distance_A"]:
            water_groups[key] = {"asym": a["asym"], "auth_seq": a["auth_seq"], "comp": a["comp"], "occupancy": a["occ"], "B_iso_A2": a["b"], "min_distance_A": d}
            water_atoms_by_key[key] = a
    water_list = sorted(water_groups.values(), key=lambda x: x["min_distance_A"])

    # Preserve interpretable source identities and geometric neighbors for
    # every water in the ligand's 8 A audit shell. These are not hydrogen-bond
    # or essential-water assignments: the deposited model has no hydrogens,
    # and atom chemistry/orientation is not inferred here.
    water_network = []
    for w in water_list:
        if w["min_distance_A"] > 8.0:
            continue
        water_atom = water_atoms_by_key[(w["asym"], w["auth_seq"], w["comp"])]
        ligand_atom = min(ligands, key=lambda a: dist(water_atom["xyz"], a["xyz"]))
        protein_neighbors = sorted(
            ((dist(water_atom["xyz"], a["xyz"]), a) for a in receptor),
            key=lambda item: item[0],
        )
        polar_neighbors = [(d, a) for d, a in protein_neighbors if a["element"] in {"N", "O", "S"} and d <= 3.6]
        water_network.append({
            "water": {"label_asym": w["asym"], "auth_seq": w["auth_seq"], "comp": w["comp"], "occupancy": w["occupancy"], "B_iso_A2": w["B_iso_A2"]},
            "nearest_ligand_atom": {"comp": ligand_atom["comp"], "auth_seq": ligand_atom["auth_seq"], "atom": ligand_atom["atom"], "distance_A": dist(water_atom["xyz"], ligand_atom["xyz"])},
            "direct_ligand_water_contact_lt_3_5A": dist(water_atom["xyz"], ligand_atom["xyz"]) <= 3.5,
            "nearest_receptor_heavy_atoms": [
                {"comp": a["comp"], "auth_seq": a["auth_seq"], "atom": a["atom"], "element": a["element"], "altloc": a["alt"], "occupancy": a["occ"], "distance_A": d}
                for d, a in protein_neighbors[:5] if d <= 4.0
            ],
            "nearby_polar_receptor_atoms_geometry_only": [
                {"comp": a["comp"], "auth_seq": a["auth_seq"], "atom": a["atom"], "element": a["element"], "altloc": a["alt"], "occupancy": a["occ"], "distance_A": d}
                for d, a in polar_neighbors[:8]
            ],
            "potential_water_bridge_geometry_only": dist(water_atom["xyz"], ligand_atom["xyz"]) <= 3.5 and bool(polar_neighbors),
        })

    het_atoms = [a for a in atoms if a["group"] == "HETATM" and a["comp"] not in {ligand_comp, "HOH", "WAT", "DOD"}]
    nonpoly_groups = {}
    for a in het_atoms:
        key = (a["asym"], a["auth_seq"], a["comp"])
        d = min_to_ligand(a)
        if key not in nonpoly_groups or d < nonpoly_groups[key]["min_distance_A"]:
            nonpoly_groups[key] = {"asym": a["asym"], "auth_seq": a["auth_seq"], "comp": a["comp"], "min_distance_A": d, "elements": sorted({x["element"] for x in het_atoms if (x["asym"], x["auth_seq"], x["comp"]) == key})}

    metal_symbols = {"LI", "NA", "K", "MG", "CA", "MN", "FE", "CO", "NI", "CU", "ZN", "MO", "W", "CD", "HG"}
    metals = [a for a in het_atoms if a["element"] in metal_symbols]
    metal_distances = sorted((min_to_ligand(a), a["element"], a["comp"], a["asym"], a["auth_seq"]) for a in metals)
    receptor_residue_ids = {(a["entity"], a["seq"], a["comp"]) for a in receptor}
    entity = receptor[0]["entity"]
    expected = expected_poly.get(entity, set())
    observed = {int(seq) for ent, seq, _ in receptor_residue_ids if ent == entity and seq is not None}
    altlocs = defaultdict(set)
    alt_res = set()
    for a in receptor:
        if a["alt"] not in {None, ".", "?"}:
            altlocs[(a["seq"], a["comp"])].add(a["alt"])
            if min_to_ligand(a) <= 5.0:
                alt_res.add((a["seq"], a["comp"]))
    local_receptor_atom_dists = sorted((min_to_ligand(a), a["comp"], a["auth_seq"], a["atom"], a["alt"], a["occ"]) for a in receptor)
    ligand_distinct = len(ligand_atom_names)
    report = {
        "source_file": path.name,
        "ligand_component": ligand_comp,
        "ligand_label_asym": ligand_asym,
        "ligand_residues": ligand_residues,
        "ligand_heavy_atom_names_observed": ligand_atom_names,
        "ligand_heavy_atom_count_observed": ligand_distinct,
        "ligand_atom_rows_including_altlocs": len(ligands),
        "ligand_altloc_labels": sorted({a["alt"] for a in ligands if a["alt"] not in {None, ".", "?"}}),
        "ligand_occupancy_values": sorted({a["occ"] for a in ligands}),
        "model_1_only": True,
        "receptor_label_asym": receptor_asym,
        "receptor_entity_id": entity,
        "receptor_observed_heavy_atom_count": len(receptor),
        "receptor_observed_residue_count": len(receptor_residue_ids),
        "receptor_polymer_expected_residue_count": len(expected),
        "receptor_observed_label_seq_min_max": [min(observed), max(observed)] if observed else None,
        "receptor_unobserved_label_seq_ids": sorted(expected - observed),
        "unobserved_atom_rows_model_1": [r for r in unobs_atoms if f(r, "_pdbx_unobs_or_zero_occ_atoms.label_asym_id") == receptor_asym],
        "unobserved_residue_rows_model_1": [r for r in unobs_residues if f(r, "_pdbx_unobs_or_zero_occ_residues.label_asym_id") == receptor_asym],
        "receptor_altloc_residue_count_total": len(altlocs),
        "receptor_altloc_residues_within_5A_of_ligand": [list(x) for x in sorted(alt_res, key=lambda x: (int(x[0]) if x[0] else 0, x[1]))],
        "waters_by_min_heavy_atom_distance": water_list,
        "water_network_geometry_only_within_8A": water_network,
        "water_residue_count_within_5A": sum(w["min_distance_A"] <= 5.0 for w in water_list),
        "water_residue_count_within_8A": sum(w["min_distance_A"] <= 8.0 for w in water_list),
        "nearest_water_distance_A": water_list[0]["min_distance_A"] if water_list else None,
        "nonpolymer_components_by_min_distance": sorted(nonpoly_groups.values(), key=lambda x: x["min_distance_A"]),
        "metals_by_min_distance_A": [{"distance_A": x[0], "element": x[1], "comp": x[2], "asym": x[3], "auth_seq": x[4]} for x in metal_distances],
        "nearest_100_receptor_atoms_to_ligand": [{"distance_A": x[0], "comp": x[1], "auth_seq": x[2], "atom": x[3], "altloc": x[4], "occupancy": x[5]} for x in local_receptor_atom_dists[:100]],
        "ligand_bounds_A": {axis: [min(a["xyz"][j] for a in ligands), max(a["xyz"][j] for a in ligands)] for j, axis in enumerate("xyz")},
    }
    return report


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("usage: audit_mmcif.py INPUT.cif LIGAND_COMP LIGAND_LABEL_ASYM RECEPTOR_LABEL_ASYM")
    result = run(Path(sys.argv[1]), sys.argv[2], None if sys.argv[3] == "-" else sys.argv[3], None if sys.argv[4] == "-" else sys.argv[4])
    print(json.dumps(result, indent=2))
