"""Sealed, fail-closed hydrogen-only preparation adapter for 3DMX/BNZ."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import math
import os
import platform
import struct
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cif_io import CifLoop, find_loop, read_loops, rows_by_header  # noqa: E402

PROFILE_ID = "ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1"
EXPECTED_RDKit = "2026.03.6"
EXPECTED_PYTHON = "3.13.16"
EXPECTED_SOURCE = {
    "3DMX.cif": (218104, "e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef"),
    "BNZ.cif": (4633, "01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61"),
    "3DMX_entry.json": (22036, "e9b303678dab19908f7708201586e732caf1f015fde0e4d36c4d7c97bfbaad1b"),
    "3DMX_assembly_1.json": (3543, "2accfe2d4b9eabc50c37932da6af4ce6b36ad0b0ee078192fd882fd005ea9670"),
    "3DMX_polymer_entity_1.json": (50665, "e016e357934b43d07c58e971720d800ba253b441b614dfd547933838226a508d"),
    "3DMX_full_validation.pdf": (515092, "e24681b6500f8489ad93b8ce747978b1346df2f2817aa208683a1b6656e47f62"),
}
PROFILE_CONFIG = "PREPARATION_RUN_CONFIG.json"
SEALED_INPUTS = "SEALED_PREPARATION_RUN_INPUTS.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_sha(path: Path) -> str:
    return sha256(path.read_bytes())


def f64hex(value: float) -> str:
    if not math.isfinite(value):
        raise ValueError("non-finite coordinate")
    return struct.pack(">d", value).hex()


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def value(row: dict[str, str], name: str, *fallbacks: str) -> str | None:
    for key in (name, *fallbacks):
        candidate = row.get(key)
        if candidate not in (None, "", ".", "?"):
            return candidate
    return None


def required(row: dict[str, str], name: str, *fallbacks: str) -> str:
    result = value(row, name, *fallbacks)
    if result is None:
        raise ValueError(f"missing required CIF field {name}")
    return result


def integer(row: dict[str, str], name: str, *fallbacks: str) -> int:
    return int(required(row, name, *fallbacks))


def number(row: dict[str, str], name: str, *fallbacks: str) -> float:
    result = float(required(row, name, *fallbacks))
    if not math.isfinite(result):
        raise ValueError(f"non-finite CIF number at {name}")
    return result


def map_order(raw: str, aromatic_flag: str) -> str:
    normalized = raw.upper()
    if aromatic_flag.upper() == "Y":
        return "AROMATIC"
    return {"SING": "SINGLE", "SINGLE": "SINGLE", "DOUB": "DOUBLE", "DOUBLE": "DOUBLE", "TRIP": "TRIPLE", "TRIPLE": "TRIPLE"}.get(normalized, "UNKNOWN")


def rdkit_bond_type(name: str) -> Chem.BondType:
    mapping = {
        "SINGLE": Chem.BondType.SINGLE,
        "DOUBLE": Chem.BondType.DOUBLE,
        "TRIPLE": Chem.BondType.TRIPLE,
        "AROMATIC": Chem.BondType.AROMATIC,
    }
    if name not in mapping:
        raise ValueError(f"unsupported/unknown source bond order {name}")
    return mapping[name]


def read_and_verify_sources(source_dir: Path, source_manifest: Path) -> tuple[dict[str, bytes], dict[str, dict[str, Any]]]:
    # Read each source once, hash these exact in-memory bytes, and parse those same bytes.
    manifest_rows = list(csv.DictReader(source_manifest.open("r", encoding="utf-8-sig", newline="")))
    expected_manifest = {Path(row["file"]).name: row for row in manifest_rows}
    if set(expected_manifest) != set(EXPECTED_SOURCE):
        raise ValueError("source manifest must contain exactly the six frozen DEC04 artifacts")
    raw_by_name: dict[str, bytes] = {}
    hashes: dict[str, dict[str, Any]] = {}
    for name, (expected_size, expected_hash) in EXPECTED_SOURCE.items():
        raw = (source_dir / name).read_bytes()
        observed = sha256(raw)
        row = expected_manifest[name]
        if len(raw) != expected_size or observed != expected_hash:
            raise ValueError(f"source byte gate failed for {name}: bytes={len(raw)}, sha256={observed}")
        if int(row["byte_length"]) != expected_size or row["sha256"].lower() != expected_hash:
            raise ValueError(f"committed SOURCE_MANIFEST mismatch for {name}")
        raw_by_name[name] = raw
        hashes[name] = {"byteLength": len(raw), "sha256": observed, "manifestRole": row["role"], "sourceUrl": row["official_source_url"]}
    return raw_by_name, hashes


def get_rows(loops: tuple[CifLoop, ...], prefix: str) -> list[dict[str, str]]:
    return rows_by_header(find_loop(loops, prefix))


def atom_site_rows(raw: bytes) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, row in enumerate(get_rows(read_loops(raw), "_atom_site."), start=1):
        model = integer(row, "_atom_site.pdbx_PDB_model_num", "_atom_site.pdbx_model_num")
        record = required(row, "_atom_site.group_PDB").upper()
        element = required(row, "_atom_site.type_symbol").upper()
        atom_name = required(row, "_atom_site.label_atom_id", "_atom_site.auth_atom_id").strip()
        comp = required(row, "_atom_site.label_comp_id", "_atom_site.auth_comp_id").upper()
        label_asym = required(row, "_atom_site.label_asym_id")
        auth_asym = value(row, "_atom_site.auth_asym_id") or label_asym
        label_seq = value(row, "_atom_site.label_seq_id")
        auth_seq = value(row, "_atom_site.auth_seq_id")
        xyz = tuple(number(row, f"_atom_site.Cartn_{axis}") for axis in "xyz")
        alt = value(row, "_atom_site.label_alt_id", "_atom_site.pdbx_PDB_alt_id") or ""
        occupancy = number(row, "_atom_site.occupancy")
        rows.append({
            "row": index,
            "id": integer(row, "_atom_site.id"),
            "record": record,
            "model": model,
            "entity": value(row, "_atom_site.label_entity_id") or "",
            "label_asym": label_asym,
            "auth_asym": auth_asym,
            "label_seq": int(label_seq) if label_seq else None,
            "auth_seq": auth_seq or "",
            "comp": comp,
            "atom": atom_name,
            "element": element,
            "alt": alt,
            "occupancy": occupancy,
            "xyz": xyz,
            "ins": value(row, "_atom_site.pdbx_PDB_ins_code") or "",
        })
    return rows


def source_occurrences(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for atom in rows:
        if atom["model"] != 1:
            continue
        key = (atom["record"], atom["entity"], atom["label_asym"], atom["auth_asym"], atom["auth_seq"], atom["comp"])
        grouped[key].append(atom)
    result = []
    for key, atoms in sorted(grouped.items(), key=lambda item: (str(item[0][2]), str(item[0][4]), str(item[0][5]))):
        record, entity, label_asym, auth_asym, auth_seq, comp = key
        if comp == "HOH":
            disposition = "EXCLUDE_WATER_CORE_DRY_V1"
            role = "crystallographic water"
        elif comp in {"PO4", "CL", "HED"}:
            disposition = "EXCLUDE_NONPOLYMER_PROFILE_OMISSION"
            role = {"PO4": "crystallization buffer", "CL": "crystal-associated ion", "HED": "crystallization additive"}[comp]
        elif comp == "BNZ" and label_asym == "G":
            disposition = "SELECT_AS_DOCKED_LIGAND"
            role = "reference ligand and selected ligand occurrence"
        elif record == "ATOM" and entity == "1" and label_asym == "A":
            disposition = "SELECT_POLYMER_RECEPTOR"
            role = "T4 lysozyme receptor polymer"
        else:
            raise ValueError(f"unlisted model-1 component occurrence requires disposition: {key}")
        result.append({
            "group_PDB": record,
            "entity_id": entity,
            "label_asym_id": label_asym,
            "auth_asym_id": auth_asym,
            "auth_seq_id": auth_seq,
            "comp_id": comp,
            "atomSiteRowCount": len(atoms),
            "altlocLabels": sorted({atom["alt"] or "(blank)" for atom in atoms}),
            "role": role,
            "disposition": disposition,
        })
    return result


def build_component_maps(loops: tuple[CifLoop, ...]) -> tuple[dict[str, dict[str, dict[str, Any]]], dict[str, list[dict[str, Any]]]]:
    atoms_by_comp: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for atom in get_rows(loops, "_chem_comp_atom."):
        comp = required(atom, "_chem_comp_atom.comp_id").upper()
        name = required(atom, "_chem_comp_atom.atom_id").strip()
        if name in atoms_by_comp[comp]:
            raise ValueError(f"duplicate CCD atom definition {comp}:{name}")
        atoms_by_comp[comp][name] = {
            "element": required(atom, "_chem_comp_atom.type_symbol").upper(),
            "charge": int(value(atom, "_chem_comp_atom.charge") or "0"),
            "aromatic": (value(atom, "_chem_comp_atom.pdbx_aromatic_flag") or "N").upper() == "Y",
            "ordinal": int(value(atom, "_chem_comp_atom.pdbx_ordinal") or "0"),
        }
    bonds_by_comp: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for bond in get_rows(loops, "_chem_comp_bond."):
        comp = required(bond, "_chem_comp_bond.comp_id").upper()
        order_raw = required(bond, "_chem_comp_bond.value_order")
        aromatic_raw = value(bond, "_chem_comp_bond.pdbx_aromatic_flag") or "N"
        bonds_by_comp[comp].append({
            "a1": required(bond, "_chem_comp_bond.atom_id_1").strip(),
            "a2": required(bond, "_chem_comp_bond.atom_id_2").strip(),
            "order": map_order(order_raw, aromatic_raw),
            "sourceOrder": order_raw.upper(),
            "aromatic": aromatic_raw.upper() == "Y",
            "ordinal": int(value(bond, "_chem_comp_bond.pdbx_ordinal") or "0"),
        })
    return atoms_by_comp, bonds_by_comp


def component_graph_signature(atoms_by_name: dict[str, dict[str, Any]], bonds: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "atoms": {name: {key: atom[key] for key in ("element", "charge", "aromatic")} for name, atom in sorted(atoms_by_name.items())},
        "bonds": sorted((min(bond["a1"], bond["a2"]), max(bond["a1"], bond["a2"]), bond["order"], bond["aromatic"]) for bond in bonds),
    }


def create_residue_inventory(rows: list[dict[str, Any]], mmcif_loops: tuple[CifLoop, ...], atoms_by_comp: dict[str, dict[str, dict[str, Any]]], bonds_by_comp: dict[str, list[dict[str, Any]]], profile: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    polymer_sequence = get_rows(mmcif_loops, "_entity_poly_seq.")
    sequence = sorted(
        [row for row in polymer_sequence if value(row, "_entity_poly_seq.entity_id") == "1"],
        key=lambda row: int(required(row, "_entity_poly_seq.num")),
    )
    if len(sequence) != 164 or [int(required(row, "_entity_poly_seq.num")) for row in sequence] != list(range(1, 165)):
        raise ValueError("entity 1 is not the frozen complete 164-position sequence")
    seq_comp = {int(required(row, "_entity_poly_seq.num")): required(row, "_entity_poly_seq.mon_id").upper() for row in sequence}

    source_polymer = [row for row in rows if row["model"] == 1 and row["record"] == "ATOM" and row["entity"] == "1" and row["label_asym"] == "A" and row["auth_asym"] == "A"]
    by_residue: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for atom in source_polymer:
        if atom["label_seq"] is None or atom["label_seq"] not in seq_comp or atom["comp"] != seq_comp[atom["label_seq"]]:
            raise ValueError(f"polymer atom does not map exactly to entity-1 sequence: {atom}")
        if atom["ins"]:
            raise ValueError(f"unexpected insertion code in the frozen chain: {atom}")
        by_residue[atom["label_seq"]].append(atom)

    altloc_groups = profile.get("altloc_resolution", {}).get("groups")
    if not isinstance(altloc_groups, list):
        raise ValueError("profile must explicitly enumerate altloc groups")
    altloc_by_position: dict[int, dict[str, Any]] = {}
    for group in altloc_groups:
        if not isinstance(group, dict) or not isinstance(group.get("label_seq_id"), int):
            raise ValueError("profile altloc group is malformed")
        position = group["label_seq_id"]
        if position in altloc_by_position:
            raise ValueError(f"profile repeats an altloc disposition for residue {position}")
        if group.get("selected_label") != "A" or group.get("occupancy_by_label") not in ({"A": 0.7, "B": 0.3}, {"A": 0.8, "B": 0.2}, {"A": 0.6, "B": 0.4}):
            raise ValueError(f"profile altloc disposition is not a supported explicit coherent-A rule at residue {position}")
        altloc_by_position[position] = group

    selected: list[dict[str, Any]] = []
    residue_rows: list[dict[str, Any]] = []
    alternate_rows: list[dict[str, Any]] = []
    for position in range(1, 165):
        comp = seq_comp[position]
        definition = atoms_by_comp.get(comp)
        if not definition:
            raise ValueError(f"missing source component definition {comp}")
        expected = {name for name, atom in definition.items() if atom["element"] != "H" and (name != "OXT" or position == 164)}
        all_rows = by_residue.get(position, [])
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for atom in all_rows:
            groups[atom["atom"]].append(atom)
        extra_names = set(groups) - expected
        if extra_names:
            raise ValueError(f"unlisted source heavy atoms at residue {position} {comp}: {sorted(extra_names)}")
        resolved: list[dict[str, Any]] = []
        for atom_name in sorted(expected):
            candidates = groups.get(atom_name, [])
            common = [atom for atom in candidates if not atom["alt"]]
            alternatives = [atom for atom in candidates if atom["alt"]]
            if position in altloc_by_position:
                if alternatives:
                    alt_names = {atom["alt"] for atom in alternatives}
                    if alt_names != {"A", "B"}:
                        raise ValueError(f"unexpected alternate labels for {position}:{atom_name}: {alt_names}")
                    a_rows = [atom for atom in alternatives if atom["alt"] == "A"]
                    b_rows = [atom for atom in alternatives if atom["alt"] == "B"]
                    if len(a_rows) != 1 or len(b_rows) != 1:
                        raise ValueError(f"duplicate/missing A/B alternate {position}:{atom_name}")
                    expected_occupancies = altloc_by_position[position]["occupancy_by_label"]
                    if abs(a_rows[0]["occupancy"] - expected_occupancies["A"]) > 1e-6 or abs(b_rows[0]["occupancy"] - expected_occupancies["B"]) > 1e-6:
                        raise ValueError(f"occupancy differs from the profile's explicit coherent-A policy at {position}:{atom_name}")
                    resolved.extend(common)
                    resolved.append(a_rows[0])
                    alternate_rows.extend([
                        {"label_seq_id": position, "comp_id": comp, "atom_name": atom_name, "altloc": atom["alt"] or "(blank)", "occupancy": atom["occupancy"], "source_row": atom["row"], "selected": atom["alt"] == "A" or not atom["alt"]}
                        for atom in candidates
                    ])
                else:
                    if len(common) != 1:
                        raise ValueError(f"missing/duplicate common atom {position}:{atom_name}")
                    resolved.extend(common)
            else:
                if alternatives:
                    raise ValueError(f"unapproved alternate state at polymer position {position}:{atom_name}")
                if len(common) != 1:
                    raise ValueError(f"missing/duplicate atom {position}:{atom_name}; found {len(common)}")
                resolved.append(common[0])
        selected_names = [atom["atom"] for atom in resolved]
        if len(selected_names) != len(set(selected_names)) or set(selected_names) != expected:
            raise ValueError(f"heavy-atom inventory mismatch at residue {position} {comp}")
        for atom in resolved:
            ccd = definition[atom["atom"]]
            if atom["element"] != ccd["element"]:
                raise ValueError(f"element mismatch for {position}:{atom['atom']}: source {atom['element']} CCD {ccd['element']}")
        resolved.sort(key=lambda atom: (atom["row"], atom["atom"]))
        selected.extend(resolved)
        residue_rows.append({
            "label_seq_id": position,
            "auth_seq_id": resolved[0]["auth_seq"],
            "comp_id": comp,
            "heavy_atom_count": len(resolved),
            "expected_heavy_atom_names": sorted(expected),
            "selected_altloc": "A+blank" if position in altloc_by_position else "blank",
        })
        if position in altloc_by_position:
            candidate_labels = {atom["alt"] for atom in all_rows if atom["alt"]}
            if candidate_labels != {"A", "B"}:
                raise ValueError(f"altloc group at residue {position} is incomplete: {candidate_labels}")
        elif any(atom["alt"] for atom in all_rows):
            raise ValueError(f"unapproved alternate state at polymer position {position}")
    if len(by_residue) != 164:
        raise ValueError(f"expected all 164 residue positions, found {len(by_residue)}")
    observed_altloc_positions = {position for position, atoms in by_residue.items() if any(atom["alt"] for atom in atoms)}
    if observed_altloc_positions != set(altloc_by_position):
        raise ValueError(f"source/profile altloc residue sets differ: source={sorted(observed_altloc_positions)}, profile={sorted(altloc_by_position)}")
    if len(selected) != len({(atom["label_seq"], atom["atom"]) for atom in selected}):
        raise ValueError("selected receptor heavy atom identity is not unique")
    expected_selected_count = profile.get("selected_receptor_heavy_atom_count")
    if not isinstance(expected_selected_count, int) or len(selected) != expected_selected_count:
        raise ValueError(f"profile receptor heavy-atom inventory mismatch: expected {expected_selected_count}, found {len(selected)}")
    return selected, residue_rows, alternate_rows


def validate_chemical_state_profile(profile: dict[str, Any], sequence: list[dict[str, str]]) -> dict[int, str]:
    expected = {
        "ASP_DEPROTONATED": {10, 20, 47, 61, 70, 72, 89, 92, 127, 159},
        "GLU_DEPROTONATED": {5, 11, 22, 45, 62, 64, 108, 128},
        "ARG_PROTONATED": {8, 14, 52, 76, 80, 95, 96, 119, 125, 137, 145, 148, 154},
        "LYS_PROTONATED": {16, 19, 35, 43, 48, 60, 65, 83, 85, 124, 135, 147, 162},
        "TYR_NEUTRAL": {18, 24, 25, 88, 139, 161},
        "HIS31_NEUTRAL_HID": {31},
    }
    configured = profile.get("chemical_state_assignments")
    if not isinstance(configured, dict):
        raise ValueError("profile must explicitly enumerate its state-sensitive residue assignments")
    parsed: dict[int, str] = {}
    for category, positions in expected.items():
        values = configured.get(category)
        if not isinstance(values, list) or any(not isinstance(pos, int) for pos in values) or set(values) != positions or len(values) != len(positions):
            raise ValueError(f"profile chemical-state map differs from AUTH04 for {category}")
        for position in positions:
            parsed[position] = category
    sequence_by_position = {int(required(row, "_entity_poly_seq.num")): required(row, "_entity_poly_seq.mon_id").upper() for row in sequence}
    expected_component = {"ASP_DEPROTONATED": "ASP", "GLU_DEPROTONATED": "GLU", "ARG_PROTONATED": "ARG", "LYS_PROTONATED": "LYS", "TYR_NEUTRAL": "TYR", "HIS31_NEUTRAL_HID": "HIS"}
    for position, category in parsed.items():
        if sequence_by_position.get(position) != expected_component[category]:
            raise ValueError(f"profile state assignment {category} does not match source residue {position}")
    observed_ionizable = {pos: comp for pos, comp in sequence_by_position.items() if comp in {"ASP", "GLU", "ARG", "LYS", "TYR", "HIS"}}
    if set(observed_ionizable) != set(parsed):
        raise ValueError(f"state-sensitive residue coverage mismatch: source={sorted(observed_ionizable)}, profile={sorted(parsed)}")
    if sequence_by_position.get(1) != "MET" or sequence_by_position.get(164) != "LEU":
        raise ValueError("the approved charged Met1 and Leu164 termini do not match the selected source construct")
    if profile.get("default_standard_residue_state") != "NEUTRAL_CCD_COMPONENT_STATE_WITH_EXPLICIT_HYDROGEN_RULES":
        raise ValueError("profile lacks the explicit standard-residue CCD state rule")
    return parsed


def profile_charges(comp: str, pos: int, atom_name: str) -> int:
    acidic = {
        "ASP": {10, 20, 47, 61, 70, 72, 89, 92, 127, 159},
        "GLU": {5, 11, 22, 45, 62, 64, 108, 128},
    }
    basic = {
        "ARG": {8, 14, 52, 76, 80, 95, 96, 119, 125, 137, 145, 148, 154},
        "LYS": {16, 19, 35, 43, 48, 60, 65, 83, 85, 124, 135, 147, 162},
    }
    if pos == 1 and atom_name == "N":
        return 1
    if pos == 164 and atom_name == "OXT":
        return -1
    if comp == "ASP" and pos in acidic["ASP"] and atom_name == "OD2":
        return -1
    if comp == "GLU" and pos in acidic["GLU"] and atom_name == "OE2":
        return -1
    if comp == "ARG" and pos in basic["ARG"] and atom_name == "NH1":
        return 1
    if comp == "LYS" and pos in basic["LYS"] and atom_name == "NZ":
        return 1
    return 0


def expected_hydrogens(comp: str, pos: int, definition: dict[str, dict[str, Any]], component_bonds: list[dict[str, Any]], heavy_names: set[str]) -> dict[str, list[str]]:
    parent_names: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for bond in component_bonds:
        a1, a2 = bond["a1"], bond["a2"]
        if a1 not in definition or a2 not in definition:
            continue
        if definition[a1]["element"] == "H" and definition[a2]["element"] != "H":
            parent_names[a2].append((definition[a1]["ordinal"], a1))
        elif definition[a2]["element"] == "H" and definition[a1]["element"] != "H":
            parent_names[a1].append((definition[a2]["ordinal"], a2))
    names = {parent: [name for _, name in sorted(values)] for parent, values in parent_names.items() if parent in heavy_names}
    if pos != 1:
        backbone = names.get("N", [])
        if "H2" in backbone:
            backbone.remove("H2")
        elif "H" in backbone:
            backbone.remove("H")
        elif comp != "PRO":
            raise ValueError(f"component {comp} does not provide the expected peptide N hydrogen at residue {pos}")
    else:
        if names.get("N") != ["H", "H2"]:
            raise ValueError("source N-terminal component hydrogen inventory is not the frozen two-H baseline")
        names["N"].append("H3")
    if pos == 164:
        names.get("OXT", []).clear()
    if comp == "ASP" and names.get("OD2"):
        names["OD2"] = [name for name in names["OD2"] if name != "HD2"]
    if comp == "GLU" and names.get("OE2"):
        names["OE2"] = [name for name in names["OE2"] if name != "HE2"]
    if comp == "HIS" and pos == 31:
        names["NE2"] = [name for name in names.get("NE2", []) if name != "HE2"]
        if names.get("ND1") != ["HD1"] or names.get("NE2"):
            raise ValueError("HIS31 HID inventory must contain ND1-HD1 and no NE2 hydrogen")
    for atom_name in list(names):
        if atom_name not in heavy_names:
            names.pop(atom_name)
    for atom_name in heavy_names:
        names.setdefault(atom_name, [])
    return {key: value for key, value in sorted(names.items())}


def construct_molecule(atoms: list[dict[str, Any]], bonds: list[dict[str, Any]], h_names: dict[str, list[str]], residue_labels: dict[str, tuple[str, int, str]], context: str) -> tuple[Chem.Mol, dict[str, int], list[dict[str, Any]]]:
    editable = Chem.RWMol()
    source_key_to_index: dict[str, int] = {}
    atom_records: list[dict[str, Any]] = []
    for atom in atoms:
        key = atom["source_key"]
        ccd = atom["ccd"]
        rd_atom = Chem.Atom(atom["element"].title())
        rd_atom.SetFormalCharge(atom["formal_charge"])
        rd_atom.SetNoImplicit(True)
        rd_atom.SetNumExplicitHs(len(h_names.get(key, [])))
        if ccd["aromatic"]:
            rd_atom.SetIsAromatic(True)
        resname, resnum, chain = residue_labels[key]
        residue_info = Chem.AtomPDBResidueInfo()
        residue_info.SetName(f"{atom['atom']:<4}"[:4])
        residue_info.SetResidueName(resname[:3])
        residue_info.SetResidueNumber(int(resnum))
        residue_info.SetChainId(chain[:1])
        residue_info.SetIsHeteroAtom(context == "ligand")
        rd_atom.SetMonomerInfo(residue_info)
        index = editable.AddAtom(rd_atom)
        source_key_to_index[key] = index
        atom_records.append(atom)
    for bond in bonds:
        a1 = source_key_to_index[bond["atom1_key"]]
        a2 = source_key_to_index[bond["atom2_key"]]
        editable.AddBond(a1, a2, rdkit_bond_type(bond["order"]))
        if bond["order"] == "AROMATIC":
            editable.GetBondBetweenAtoms(a1, a2).SetIsAromatic(True)
    molecule = editable.GetMol()
    # Precompute explicit-only valence metadata. This does not sanitize, perceive,
    # repair, or change any source atom, bond, charge, or coordinate.
    molecule.UpdatePropertyCache(strict=False)
    if any(atom.GetNumImplicitHs() != 0 for atom in molecule.GetAtoms()):
        raise ValueError("NoImplicit failed to suppress unapproved implicit-H generation")
    if any(atom.HasQuery() for atom in molecule.GetAtoms()) or any(bond.HasQuery() for bond in molecule.GetBonds()):
        raise ValueError("query atom/bond present in approved source graph")
    conformer = Chem.Conformer(len(atoms))
    for index, atom in enumerate(atoms):
        x, y, z = atom["xyz"]
        conformer.SetAtomPosition(index, Point3D(x, y, z))
    molecule.AddConformer(conformer, assignId=True)
    return molecule, source_key_to_index, atom_records


class RdkitMessageCollector(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.DEBUG)
        self.records: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(f"{record.levelname}:{record.getMessage()}")


def add_hydrogens(molecule: Chem.Mol, atom_count: int, expected_by_source: dict[str, list[str]], source_by_index: list[dict[str, Any]], context: str, warning_collector: RdkitMessageCollector) -> tuple[Chem.Mol, list[dict[str, Any]], dict[str, Any]]:
    before_heavy = []
    conformer = molecule.GetConformer()
    for index in range(atom_count):
        pos = conformer.GetAtomPosition(index)
        before_heavy.append(tuple(f64hex(value) for value in (pos.x, pos.y, pos.z)))
    before_bonds = sorted((min(bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()), max(bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()), str(bond.GetBondType()), bond.GetIsAromatic()) for bond in molecule.GetBonds())
    prepared = Chem.AddHs(molecule, explicitOnly=False, addCoords=True, onlyOnAtoms=None, addResidueInfo=True)
    if warning_collector.records:
        raise ValueError("RDKit emitted warning/error during AddHs: " + " | ".join(warning_collector.records))
    if prepared.GetNumHeavyAtoms() != atom_count or prepared.GetNumAtoms() < atom_count:
        raise ValueError("RDKit AddHs altered the heavy atom count")
    result_conf = prepared.GetConformer()
    after_heavy = []
    for index in range(atom_count):
        atom = prepared.GetAtomWithIdx(index)
        if atom.GetAtomicNum() == 1:
            raise ValueError("heavy-atom prefix/order changed during AddHs")
        pos = result_conf.GetAtomPosition(index)
        after_heavy.append(tuple(f64hex(value) for value in (pos.x, pos.y, pos.z)))
    after_bonds = sorted((min(bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()), max(bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()), str(bond.GetBondType()), bond.GetIsAromatic()) for bond in prepared.GetBonds() if bond.GetBeginAtomIdx() < atom_count and bond.GetEndAtomIdx() < atom_count)
    if after_heavy != before_heavy:
        raise ValueError("heavy atom in-memory binary64 coordinate bits changed")
    if after_bonds != before_bonds:
        raise ValueError("heavy-heavy graph changed during AddHs")
    if molecule.GetNumAtoms() != atom_count:
        raise ValueError("RDKit mutated the original molecule rather than returning a copy")
    hydrogen_rows: list[dict[str, Any]] = []
    seen_parent_ord: dict[str, int] = defaultdict(int)
    parent_index_to_source = {index: atom["source_key"] for index, atom in enumerate(source_by_index)}
    for atom in prepared.GetAtoms():
        if atom.GetAtomicNum() != 1:
            continue
        neighbors = list(atom.GetNeighbors())
        if len(neighbors) != 1 or neighbors[0].GetAtomicNum() == 1:
            raise ValueError("generated hydrogen lacks exactly one heavy parent")
        parent_index = neighbors[0].GetIdx()
        parent_key = parent_index_to_source.get(parent_index)
        if parent_key is None:
            raise ValueError("generated hydrogen is not parented to a source heavy atom")
        ordinal = seen_parent_ord[parent_key]
        seen_parent_ord[parent_key] += 1
        names = expected_by_source[parent_key]
        if ordinal >= len(names):
            raise ValueError(f"extra hydrogen at parent {parent_key}")
        hname = names[ordinal]
        position = result_conf.GetAtomPosition(atom.GetIdx())
        xyz = (position.x, position.y, position.z)
        if not all(math.isfinite(value) for value in xyz):
            raise ValueError("generated hydrogen has non-finite coordinates")
        hydrogen_rows.append({
            "context": context,
            "hydrogen_index": atom.GetIdx(),
            "hydrogen_name": hname,
            "parent_source_key": parent_key,
            "parent_index": parent_index,
            "ordinal_for_parent": ordinal + 1,
            "formal_charge": atom.GetFormalCharge(),
            "coordinate": list(xyz),
            "coordinate_bits": [f64hex(value) for value in xyz],
            "rdkit_pdb_name": atom.GetPDBResidueInfo().GetName().strip() if atom.GetPDBResidueInfo() else None,
        })
    if seen_parent_ord != {key: len(names) for key, names in expected_by_source.items() if names}:
        raise ValueError("generated hydrogen inventory does not match explicit per-parent state")
    hydrogen_rows.sort(key=lambda row: (row["parent_source_key"], row["ordinal_for_parent"]))
    return prepared, hydrogen_rows, {
        "heavyAtomCountBefore": atom_count,
        "heavyAtomCountAfter": prepared.GetNumHeavyAtoms(),
        "hydrogenCount": len(hydrogen_rows),
        "heavyCoordinateBitsUnchanged": True,
        "heavyHeavyBondsUnchanged": True,
        "originalInputGraphUnchanged": molecule.GetNumAtoms() == atom_count,
    }


def heavy_atom_molecule_data(atoms: list[dict[str, Any]], bonds: list[dict[str, Any]], component_atoms: dict[str, dict[str, dict[str, Any]]], component_bonds: dict[str, list[dict[str, Any]]], context: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, list[str]], dict[str, tuple[str, int, str]]]:
    atom_output: list[dict[str, Any]] = []
    h_names: dict[str, list[str]] = {}
    residue_labels: dict[str, tuple[str, int, str]] = {}
    for atom in atoms:
        if context == "receptor":
            source_key = f"A:{atom['label_seq']}:{atom['comp']}:{atom['atom']}"
            pos = int(atom["label_seq"])
            charge = profile_charges(atom["comp"], pos, atom["atom"])
            names = expected_hydrogens(atom["comp"], pos, component_atoms[atom["comp"]], component_bonds[atom["comp"]], {item["atom"] for item in atoms if item["label_seq"] == pos})
            # Build each residue H-name map once; this lookup is replaced below for speed/readability.
            del names
            residue_labels[source_key] = (atom["comp"], pos, "A")
        else:
            source_key = f"G:900:BNZ:{atom['atom']}"
            charge = 0
            residue_labels[source_key] = ("BNZ", 900, "G")
        atom_output.append({
            **atom,
            "source_key": source_key,
            "formal_charge": charge,
            "ccd": component_atoms[atom["comp"]][atom["atom"]],
        })
    if context == "receptor":
        per_residue_names: dict[int, dict[str, list[str]]] = {}
        for atom in atoms:
            pos = int(atom["label_seq"])
            if pos in per_residue_names:
                continue
            residue_atoms = [item for item in atoms if item["label_seq"] == pos]
            per_residue_names[pos] = expected_hydrogens(atom["comp"], pos, component_atoms[atom["comp"]], component_bonds[atom["comp"]], {item["atom"] for item in residue_atoms})
        for atom in atom_output:
            h_names[atom["source_key"]] = per_residue_names[int(atom["label_seq"])][atom["atom"]]
    else:
        ccd_h_names: dict[str, list[str]] = defaultdict(list)
        definition = component_atoms["BNZ"]
        for bond in component_bonds["BNZ"]:
            a1, a2 = bond["a1"], bond["a2"]
            if definition[a1]["element"] == "H" and definition[a2]["element"] == "C":
                ccd_h_names[a2].append((definition[a1]["ordinal"], a1))
            elif definition[a2]["element"] == "H" and definition[a1]["element"] == "C":
                ccd_h_names[a1].append((definition[a2]["ordinal"], a2))
        for atom in atom_output:
            attached = [name for _, name in sorted(ccd_h_names.get(atom["atom"], []))]
            if len(attached) != 1:
                raise ValueError(f"BNZ atom {atom['atom']} must map to exactly one CCD hydrogen")
            h_names[atom["source_key"]] = attached

    atom_by_key = {atom["source_key"]: atom for atom in atom_output}
    output_bonds: list[dict[str, Any]] = []
    seen_edges: set[tuple[str, str]] = set()
    for atom in atom_output:
        comp = atom["comp"]
        if context == "receptor":
            source_bonds = component_bonds[comp]
            pos = int(atom["label_seq"])
            residue_key_for_name = {item["atom"]: item["source_key"] for item in atom_output if int(item["label_seq"]) == pos}
        else:
            source_bonds = component_bonds["BNZ"]
            residue_key_for_name = {item["atom"]: item["source_key"] for item in atom_output}
        for bond in source_bonds:
            if bond["a1"] not in residue_key_for_name or bond["a2"] not in residue_key_for_name:
                continue
            a1key, a2key = residue_key_for_name[bond["a1"]], residue_key_for_name[bond["a2"]]
            edge = tuple(sorted((a1key, a2key)))
            if edge in seen_edges:
                continue
            seen_edges.add(edge)
            output_bonds.append({
                "atom1_key": a1key,
                "atom2_key": a2key,
                "order": bond["order"],
                "source_order": bond["sourceOrder"],
                "evidence": "SOURCE_EXPLICIT",
                "source_ref": f"CCD:{comp}:bond:{bond['ordinal']}:{bond['sourceOrder']}:aromatic={bond['aromatic']}",
            })
    if context == "receptor":
        for pos in range(1, 164):
            c_comp = next(atom["comp"] for atom in atom_output if int(atom["label_seq"]) == pos)
            n_comp = next(atom["comp"] for atom in atom_output if int(atom["label_seq"]) == pos + 1)
            if "C" not in component_atoms[c_comp] or "N" not in component_atoms[n_comp]:
                raise ValueError(f"polymer link endpoint absent at {pos} -> {pos + 1}")
            ckey, nkey = f"A:{pos}:{c_comp}:C", f"A:{pos + 1}:{n_comp}:N"
            if ckey not in atom_by_key or nkey not in atom_by_key:
                raise ValueError(f"polymer peptide bond endpoint absent at {pos} -> {pos + 1}")
            edge = tuple(sorted((ckey, nkey)))
            if edge in seen_edges:
                raise ValueError(f"duplicate polymer edge at {pos} -> {pos + 1}")
            seen_edges.add(edge)
            output_bonds.append({"atom1_key": ckey, "atom2_key": nkey, "order": "SINGLE", "source_order": "SING", "evidence": "SOURCE_INFERRED", "source_ref": f"_entity_poly_seq:entity=1:{pos}->{pos+1}"})
    output_bonds.sort(key=lambda bond: (bond["atom1_key"], bond["atom2_key"], bond["source_ref"]))
    if len(output_bonds) != len(seen_edges):
        raise AssertionError("bond deduplication invariant failed")
    return atom_output, output_bonds, h_names, residue_labels


def residue_charge_summary(atoms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for atom in atoms:
        grouped[int(atom["label_seq"])].append(atom)
    result = []
    for pos, group in sorted(grouped.items()):
        comp = group[0]["comp"]
        result.append({"label_seq_id": pos, "comp_id": comp, "formal_charge": sum(atom["formal_charge"] for atom in group), "nonzero_atoms": {atom["atom"]: atom["formal_charge"] for atom in group if atom["formal_charge"]}})
    return result


def prepare_run(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(__file__).resolve().parents[1]
    config_path = root / PROFILE_CONFIG
    sealed_path = root / SEALED_INPUTS
    if not sealed_path.exists() or not config_path.exists():
        raise ValueError("sealed run configuration or input seal is missing")
    sealed = json.loads(sealed_path.read_text(encoding="utf-8"))
    config_bytes = config_path.read_bytes()
    if sha256(Path(__file__).read_bytes()) != sealed["driver_sha256"]:
        raise ValueError("execution driver hash differs from sealed run inputs")
    parser_path = Path(__file__).resolve().parent / "cif_io.py"
    if file_sha(parser_path) != sealed["cif_parser_sha256"]:
        raise ValueError("CIF parser hash differs from sealed run inputs")
    if sha256(config_bytes) != sealed["profile_config_sha256"]:
        raise ValueError("profile configuration hash differs from sealed run inputs")
    if sha256((root / "SOURCE_MANIFEST.csv").read_bytes()) != sealed["source_manifest_sha256"]:
        raise ValueError("source manifest hash differs from sealed run inputs")
    completeness_path = root / "PROFILE_COMPLETENESS_VALIDATION.json"
    matrix_path = root / "SOURCE_PROFILE_COMPLETENESS_MATRIX.csv"
    if sha256(completeness_path.read_bytes()) != sealed.get("profile_completeness_validation_sha256"):
        raise ValueError("source/profile completeness validation bytes differ from the pre-execution seal")
    if sha256(matrix_path.read_bytes()) != sealed.get("completeness_matrix_sha256"):
        raise ValueError("source/profile completeness matrix bytes differ from the pre-execution seal")
    completeness = json.loads(completeness_path.read_text(encoding="utf-8"))
    if completeness.get("status") != "PASS" or completeness.get("profile_id") != PROFILE_ID or completeness.get("selected_residue_count") != 164 or completeness.get("profile_dispositioned_residue_count") != 164 or completeness.get("rdkit_imported") is not False or completeness.get("molecules_constructed") is not False:
        raise ValueError("source/profile completeness validation did not pass before RDKit import")
    profile = json.loads(config_bytes.decode("utf-8"))
    if profile.get("profile_id") != PROFILE_ID or profile.get("semantic_version") != "1.1.0" or profile.get("rdkit_version") != EXPECTED_RDKit or profile.get("python_version") != EXPECTED_PYTHON:
        raise ValueError("preparation profile configuration disagrees with the approved exact pins")
    if sys.version_info[:3] != (3, 13, 16):
        raise ValueError(f"CPython pin mismatch: {sys.version}")

    source_dir = root / "source_artifacts" / "current_rcsb"
    raw_sources, source_hashes = read_and_verify_sources(source_dir, root / "SOURCE_MANIFEST.csv")
    if source_hashes != completeness.get("source_hashes_preparse"):
        raise ValueError("preparation input hashes differ from the pre-RDKit source/profile validation")
    # The bytes parsed below are exactly the bytes whose hashes were checked immediately above.
    mmcif_loops = read_loops(raw_sources["3DMX.cif"])
    ligand_loops = read_loops(raw_sources["BNZ.cif"])
    all_site_rows = atom_site_rows(raw_sources["3DMX.cif"])
    component_atoms, component_bonds = build_component_maps(mmcif_loops)
    ligand_component_atoms, ligand_component_bonds = build_component_maps(ligand_loops)
    if component_graph_signature(component_atoms.get("BNZ", {}), component_bonds.get("BNZ", [])) != component_graph_signature(ligand_component_atoms.get("BNZ", {}), ligand_component_bonds.get("BNZ", [])):
        raise ValueError("3DMX embedded BNZ CCD component conflicts with the separately pinned BNZ CCD input")
    sequence_rows = get_rows(mmcif_loops, "_entity_poly_seq.")
    state_categories = validate_chemical_state_profile(profile, sequence_rows)
    receptor_heavy, residue_manifest, alternate_manifest = create_residue_inventory(all_site_rows, mmcif_loops, component_atoms, component_bonds, profile)
    component_dispositions = source_occurrences(all_site_rows)
    disposition_counts: dict[str, int] = defaultdict(int)
    for occurrence in component_dispositions:
        disposition_counts[occurrence["disposition"]] += 1
    if disposition_counts != profile.get("component_disposition_counts"):
        raise ValueError(f"source/profile component disposition mismatch: source={dict(disposition_counts)}, profile={profile.get('component_disposition_counts')}")

    # Only after byte, residue, chemical-state, altloc, CCD graph, and component
    # completeness checks pass may this adapter import or use RDKit.
    from rdkit import Chem, rdBase  # noqa: PLC0415
    from rdkit.Geometry import Point3D  # noqa: PLC0415

    globals().update({"Chem": Chem, "rdBase": rdBase, "Point3D": Point3D})
    if rdBase.rdkitVersion != EXPECTED_RDKit:
        raise ValueError(f"RDKit pin mismatch: {rdBase.rdkitVersion}")
    ligand_heavy = [row for row in all_site_rows if row["model"] == 1 and row["record"] == "HETATM" and row["entity"] == "5" and row["label_asym"] == "G" and row["auth_asym"] == "A" and row["comp"] == "BNZ" and row["auth_seq"] == "900"]
    if len(ligand_heavy) != 6 or {row["atom"] for row in ligand_heavy} != {f"C{i}" for i in range(1, 7)} or any(row["element"] != "C" or row["alt"] for row in ligand_heavy):
        raise ValueError("selected 3DMX BNZ occurrence must be exactly six unaltloc carbon atoms")
    ligand_heavy.sort(key=lambda atom: (int(atom["atom"][1:]), atom["row"]))
    if sorted({row["occupancy"] for row in ligand_heavy}) != [1.0]:
        raise ValueError("BNZ source atoms must have occupancy 1.00")
    if set(component_atoms["BNZ"][name]["element"] for name in component_atoms["BNZ"] if component_atoms["BNZ"][name]["element"] != "H") != {"C"}:
        raise ValueError("BNZ source component contains an unexpected heavy element")

    receptor_atoms, receptor_bonds, receptor_h_names, receptor_labels = heavy_atom_molecule_data(receptor_heavy, [], component_atoms, component_bonds, "receptor")
    ligand_atoms, ligand_bonds, ligand_h_names, ligand_labels = heavy_atom_molecule_data(ligand_heavy, [], ligand_component_atoms, ligand_component_bonds, "ligand")
    if len(receptor_bonds) < len(receptor_atoms) - 1 or len(ligand_bonds) != 6:
        raise ValueError("explicit source graph is incomplete")
    ring_degrees: dict[str, int] = defaultdict(int)
    for bond in ligand_bonds:
        if bond["order"] != "AROMATIC":
            raise ValueError("BNZ CCD ring edge lost aromatic perception")
        ring_degrees[bond["atom1_key"]] += 1
        ring_degrees[bond["atom2_key"]] += 1
    if len(ring_degrees) != 6 or set(ring_degrees.values()) != {2}:
        raise ValueError("BNZ graph is not the exact six-carbon aromatic ring")
    if sum(atom["formal_charge"] for atom in receptor_atoms) != sum(entry["formal_charge"] for entry in residue_charge_summary(receptor_atoms)):
        raise ValueError("receptor formal charge accounting mismatch")
    if sum(atom["formal_charge"] for atom in ligand_atoms) != 0:
        raise ValueError("BNZ must remain neutral")

    # Install a Python logging sink for RDKit's native diagnostic channel.
    rdBase.LogToPythonLogger()
    rdkit_logger = logging.getLogger("rdkit")
    collector = RdkitMessageCollector()
    rdkit_logger.addHandler(collector)
    rdkit_logger.setLevel(logging.DEBUG)
    receptor_molecule, _, _ = construct_molecule(receptor_atoms, receptor_bonds, receptor_h_names, receptor_labels, "receptor")
    if collector.records:
        raise ValueError("RDKit emitted a diagnostic while constructing receptor graph: " + " | ".join(collector.records))
    ligand_molecule, _, _ = construct_molecule(ligand_atoms, ligand_bonds, ligand_h_names, ligand_labels, "ligand")
    if collector.records:
        raise ValueError("RDKit emitted a diagnostic while constructing ligand graph: " + " | ".join(collector.records))
    prepared_receptor, receptor_hydrogens, receptor_invariants = add_hydrogens(receptor_molecule, len(receptor_atoms), receptor_h_names, receptor_atoms, "receptor", collector)
    prepared_ligand, ligand_hydrogens, ligand_invariants = add_hydrogens(ligand_molecule, len(ligand_atoms), ligand_h_names, ligand_atoms, "ligand", collector)
    rdkit_logger.removeHandler(collector)
    if collector.records:
        raise ValueError("RDKit emitted an unapproved warning/error: " + " | ".join(collector.records))

    hydrogen_rows = receptor_hydrogens + ligand_hydrogens
    for row in hydrogen_rows:
        row["atom_uid_material"] = f"{row['context']}|{row['parent_source_key']}|{row['hydrogen_name']}|{row['ordinal_for_parent']}"
    source_heavy_rows = []
    for atom in receptor_atoms + ligand_atoms:
        source_heavy_rows.append({
            "context": "receptor" if atom in receptor_atoms else "ligand",
            "source_row": atom["row"],
            "source_id": atom["id"],
            "source_key": atom["source_key"],
            "label_asym_id": atom["label_asym"],
            "auth_asym_id": atom["auth_asym"],
            "label_seq_id": atom["label_seq"],
            "auth_seq_id": atom["auth_seq"],
            "comp_id": atom["comp"],
            "atom_name": atom["atom"],
            "element": atom["element"],
            "altloc": atom["alt"] or "(blank)",
            "occupancy": atom["occupancy"],
            "formal_charge": atom["formal_charge"],
            "coordinate": list(atom["xyz"]),
            "coordinate_bits": [f64hex(value) for value in atom["xyz"]],
        })
    source_heavy_rows.sort(key=lambda atom: (atom["context"], str(atom["source_key"])))

    atom_bond_payload = {
        "profile_id": PROFILE_ID,
        "profile_semantic_version": profile["semantic_version"],
        "source_hashes": source_hashes,
        "receptor": {
            "heavy_atoms": source_heavy_rows[:len(receptor_atoms)],
            "heavy_bonds": receptor_bonds,
            "hydrogen_parent_inventory": {key: names for key, names in sorted(receptor_h_names.items())},
            "residues": residue_manifest,
            "formal_charge_summary": residue_charge_summary(receptor_atoms),
        },
        "ligand": {
            "heavy_atoms": source_heavy_rows[len(receptor_atoms):],
            "heavy_bonds": ligand_bonds,
            "hydrogen_parent_inventory": {key: names for key, names in sorted(ligand_h_names.items())},
            "component": "BNZ",
            "charge": 0,
            "search_torsion_count": 0,
            "N_tors_vina": 0,
        },
    }
    # Rebuild the context split after stable sorting; do not rely on positional slicing.
    atom_bond_payload["receptor"]["heavy_atoms"] = [row for row in source_heavy_rows if row["context"] == "receptor"]
    atom_bond_payload["ligand"]["heavy_atoms"] = [row for row in source_heavy_rows if row["context"] == "ligand"]
    source_manifest_payload = {"artifacts": source_hashes, "manifestSha256": sealed["source_manifest_sha256"]}
    canonical_state_payload = {
        "schema": "D3_CLOSURE_PREPARED_ATOM_COORDINATES_V1",
        "profile_id": PROFILE_ID,
        "source_manifest": source_manifest_payload,
        "graph_state": atom_bond_payload,
        "generated_hydrogens": hydrogen_rows,
        "component_occurrences": component_dispositions,
    }
    canonical_state_bytes = canonical_json(canonical_state_payload)
    output_root = Path(args.output_dir).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "PREPARED_SCIENTIFIC_PAYLOAD.json").write_bytes(canonical_state_bytes)
    (output_root / "PREPARED_SCIENTIFIC_PAYLOAD.sha256").write_text(sha256(canonical_state_bytes) + "\n", encoding="ascii")
    (output_root / "SOURCE_ARTIFACT_HASHES.json").write_bytes(canonical_json(source_manifest_payload))
    (output_root / "SELECTED_HEAVY_ATOM_MANIFEST.json").write_bytes(canonical_json(source_heavy_rows))
    (output_root / "EXPLICIT_GRAPH_STATE.json").write_bytes(canonical_json(atom_bond_payload))
    (output_root / "HYDROGEN_PROVENANCE.json").write_bytes(canonical_json(hydrogen_rows))
    (output_root / "COMPONENT_DISPOSITIONS.json").write_bytes(canonical_json(component_dispositions))
    (output_root / "ALTLOC_DISPOSITIONS.json").write_bytes(canonical_json(alternate_manifest))
    (output_root / "RESIDUE_STATE_INVENTORY.json").write_bytes(canonical_json(residue_manifest))
    (output_root / "HEAVY_ATOM_INVARIANTS.json").write_bytes(canonical_json({"receptor": receptor_invariants, "ligand": ligand_invariants, "heavyAtomAdditions": 0, "heavyAtomDeletions": 0, "heavyAtomIdentityChanges": 0, "heavyAtomCoordinateBitChanges": 0}))
    run_summary = {
        "status": "PASS",
        "run_id": args.run_id,
        "run_started_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "working_directory": str(Path.cwd()),
        "python": sys.version,
        "python_executable": sys.executable,
        "platform": platform.platform(),
        "machine": platform.machine(),
        "rdkit_version": rdBase.rdkitVersion,
        "profile_id": PROFILE_ID,
        "profile_semantic_version": profile["semantic_version"],
        "environment": {name: os.environ.get(name) for name in ("TZ", "LC_ALL", "LANG", "PYTHONHASHSEED")},
        "sealed_inputs": sealed,
        "source_hashes_preparse": source_hashes,
        "source_profile_completeness": {"status": "PASS", "residue_count": len(residue_manifest), "selected_heavy_atom_count": len(receptor_heavy), "state_sensitive_site_count": len(state_categories), "component_disposition_counts": dict(disposition_counts)},
        "atom_count": {"receptor_heavy": len(receptor_atoms), "receptor_hydrogen": len(receptor_hydrogens), "ligand_heavy": len(ligand_atoms), "ligand_hydrogen": len(ligand_hydrogens)},
        "bond_count": {"receptor_heavy": len(receptor_bonds), "ligand_heavy": len(ligand_bonds)},
        "invariants": {"receptor": receptor_invariants, "ligand": ligand_invariants},
        "preparation_payload_sha256": sha256(canonical_state_bytes),
        "rdkit_diagnostics": list(collector.records),
        "fixture_scores_or_docking": False,
    }
    (output_root / "RUN_SUMMARY.json").write_bytes(canonical_json(run_summary))
    return run_summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", choices=("run-1", "run-2"), required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    result = prepare_run(args)
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"PREPARATION_FAILURE: {type(error).__name__}: {error}", file=sys.stderr)
        raise
