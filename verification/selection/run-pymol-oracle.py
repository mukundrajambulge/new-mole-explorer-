#!/usr/bin/env python3
"""Run the pinned PyMOL selection corpus against a canonical fixture.

This runner is intentionally independent of the web selection engine. It records
PyMOL's returned count and a stable membership hash for comparison evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pymol
from pymol import cmd


ORACLE_SOURCE = "schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69"
QUERIES = (
    "all",
    "*",
    "everything",
    "none",
    "enabled",
    "present",
    "visible",
    "name CA",
    "%active_site",
    "?missing",
    "active_site",
    "groupA",
    "not solvent",
    "!solvent",
    "chain A",
    "chain A and polymer.protein",
    "chain A & polymer.protein",
    "organic or solvent",
    "organic | solvent",
    "(chain A or chain B) and name CA",
    "chain A protein",
    "first all",
    "last all",
    "model oracle_fixture",
    "object oracle_fixture",
    "segi A",
    "resn ALA",
    "resi 1",
    "alt A",
    "index 2",
    "id 2",
    "rank 0",
    "label all, {name}",
    "pepseq 10",
    "name CA in chain A",
    "name like CA",
    "byobject chain A",
    "bysegi chain A",
    "bychain organic",
    "byres name CA",
    "bycalpha name CA",
    "bymolecule organic",
    "byfragment organic",
    "byring organic",
    "bycell chain A",
    "neighbor organic",
    "bound_to organic",
    "extend 1 organic",
    "polymer.protein",
    "polymer.nucleic",
    "solvent",
    "inorganic",
    "name CA",
    "resn ALA",
    "resi 1",
    "elem C",
    "hetatm",
    "hydro",
    "not solvent",
    "first all",
    "last all",
    "byres name CA",
    "bychain organic",
    "neighbor organic",
    "bound_to organic",
    "within 4 of organic",
    "around 4 organic",
    "expand 4 organic",
    "near_to organic",
    "beyond 4 organic",
    "gap 4 organic",
    "formal_charge = 0",
    "partial_charge > 0",
    "b > 20",
    "q >= 0.5",
    "ss HELIX",
    "x < 2",
    "x <= 2",
    "y >= 0",
    "z <= 100",
    "state 2",
    "foo = bar",
    "show sticks, all",
    "hide sticks, all",
    "center all",
    "zoom all",
    "measure distance",
    "measure clear",
    "get_view",
    "cartoon_color red",
    "ribbon_color red",
    "rep cartoon",
    "color red",
    "polymer",
    "protein",
    "backbone",
    "sidechain",
    "guide",
    "metals",
    "bonded",
    "donors",
    "acceptors",
)

# Keep the corpus readable while ensuring repeated compatibility cases are
# executed once and the emitted query count remains deterministic.
QUERIES = tuple(dict.fromkeys(QUERIES))


def membership_hash(selection: str) -> str:
    atoms = (
        f"{atom.index}|{atom.chain}|{atom.resn}|{atom.resi}|{atom.name}|{atom.symbol}"
        for atom in cmd.get_model(selection).atom
    )
    return hashlib.sha256("\n".join(atoms).encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    pymol.finish_launching(["pymol", "-cq"])
    cmd.load(str(args.fixture), "oracle_fixture")
    selection = "oracle_selection"
    rows = []
    for query in QUERIES:
        try:
            return_code = cmd.select(selection, query)
            rows.append(
                {
                    "query": query,
                    "returnCode": return_code,
                    "count": len(cmd.index(selection)),
                    "membershipHash": membership_hash(selection),
                    "status": "PASS",
                }
            )
        except Exception as error:  # pragma: no cover - exercised by PyMOL runtime
            rows.append({"query": query, "status": "ERROR", "error": repr(error)})

    result = {
        "schemaVersion": 1,
        "oracleSource": ORACLE_SOURCE,
        "fixture": str(args.fixture),
        "queryCount": len(rows),
        "rows": rows,
    }
    rendered = json.dumps(result, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    cmd.quit()


if __name__ == "__main__":
    main()
