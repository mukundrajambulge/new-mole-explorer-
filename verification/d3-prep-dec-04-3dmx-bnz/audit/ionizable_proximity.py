#!/usr/bin/env python3
"""Read-only 3DMX ionizable-group proximity audit; writes a CSV evidence table only."""
from __future__ import annotations
import argparse
import csv
import math
import shlex
from pathlib import Path

IONIZABLE = {
    "ASP": ("ASP_SIDECHAIN", ("OD1", "OD2")),
    "GLU": ("GLU_SIDECHAIN", ("OE1", "OE2")),
    "ARG": ("ARG_SIDECHAIN", ("NE", "NH1", "NH2")),
    "LYS": ("LYS_SIDECHAIN", ("NZ",)),
    "HIS": ("HIS_SIDECHAIN", ("ND1", "NE2")),
    "CYS": ("CYS_SIDECHAIN", ("SG",)),
    "TYR": ("TYR_SIDECHAIN", ("OH",)),
}


def atom_rows(cif: Path):
    lines = cif.read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == "_atom_site.group_PDB")
    columns = []
    while start < len(lines) and lines[start].strip().startswith("_atom_site."):
        columns.append(lines[start].strip())
        start += 1
    for line in lines[start:]:
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "loop_", "_")):
            break
        values = shlex.split(stripped)
        if len(values) != len(columns):
            raise ValueError(f"atom_site row has {len(values)} fields; expected {len(columns)}")
        atom = dict(zip(columns, values))
        if atom["_atom_site.pdbx_PDB_model_num"] != "1":
            continue
        try:
            xyz = tuple(float(atom[f"_atom_site.Cartn_{axis}"]) for axis in "xyz")
        except ValueError as exc:
            raise ValueError("non-numeric atom coordinate") from exc
        yield atom, xyz


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cif", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    atoms = list(atom_rows(args.cif))
    ligand = [(atom, xyz) for atom, xyz in atoms
              if atom["_atom_site.label_comp_id"] == "BNZ"
              and atom["_atom_site.label_asym_id"] == "G"]
    if len(ligand) != 6:
        raise ValueError(f"expected exactly six source BNZ heavy atoms, found {len(ligand)}")
    ligand_xyz = [(atom["_atom_site.label_atom_id"], xyz) for atom, xyz in ligand]
    receptor = [(atom, xyz) for atom, xyz in atoms
                if atom["_atom_site.label_asym_id"] == "A"]
    sites = {}
    for atom, xyz in receptor:
        comp = atom["_atom_site.label_comp_id"]
        name = atom["_atom_site.label_atom_id"]
        if comp not in IONIZABLE or name not in IONIZABLE[comp][1]:
            continue
        key = (comp, atom["_atom_site.auth_seq_id"], atom["_atom_site.label_seq_id"], IONIZABLE[comp][0])
        alt = atom["_atom_site.label_alt_id"]
        alt = "" if alt in (".", "?") else alt
        sites.setdefault(key, {}).setdefault(alt, []).append((name, xyz))
    # Include both physical polymer termini in the explicit-state proximity inventory.
    for atom, xyz in receptor:
        seq = atom["_atom_site.label_seq_id"]
        name = atom["_atom_site.label_atom_id"]
        if seq == "1" and name == "N":
            key = (atom["_atom_site.label_comp_id"], atom["_atom_site.auth_seq_id"], seq, "N_TERMINUS")
            sites.setdefault(key, {}).setdefault("", []).append((name, xyz))
        if seq == "164" and name in ("O", "OXT"):
            key = (atom["_atom_site.label_comp_id"], atom["_atom_site.auth_seq_id"], seq, "C_TERMINUS")
            sites.setdefault(key, {}).setdefault("", []).append((name, xyz))
    rows = []
    for (comp, auth_seq, label_seq, site), conformers in sites.items():
        labels = sorted(label for label in conformers if label)
        states = labels or [""]
        for state in states:
            candidates = conformers.get("", []) + conformers.get(state, []) if state else conformers.get("", [])
            if not candidates:
                continue
            nearest = min((math.dist(xyz, ligand_xyz_i), atom_name, ligand_name)
                         for atom_name, xyz in candidates
                         for ligand_name, ligand_xyz_i in ligand_xyz)
            dist, receptor_atom, ligand_atom = nearest
            rows.append({
                "label_asym_id": "A",
                "auth_asym_id": "A",
                "comp_id": comp,
                "auth_seq_id": auth_seq,
                "label_seq_id": label_seq,
                "site_group": site,
                "altloc_state": state or "COMMON",
                "site_atom_names": ";".join(sorted({name for name, _ in candidates})),
                "min_distance_to_BNZ_A": f"{dist:.4f}",
                "closest_site_atom": receptor_atom,
                "closest_BNZ_atom": ligand_atom,
                "model_number": "1",
            })
    rows.sort(key=lambda row: (float(row["min_distance_to_BNZ_A"]), row["site_group"], int(row["auth_seq_id"]), row["altloc_state"]))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    fields = ["label_asym_id", "auth_asym_id", "comp_id", "auth_seq_id", "label_seq_id",
              "site_group", "altloc_state", "site_atom_names", "min_distance_to_BNZ_A",
              "closest_site_atom", "closest_BNZ_atom", "model_number"]
    with args.out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"source={args.cif} atom_site_model1={len(atoms)} BNZ_atoms={len(ligand)} ionizable_site_rows={len(rows)} output={args.out}")


if __name__ == "__main__":
    main()
