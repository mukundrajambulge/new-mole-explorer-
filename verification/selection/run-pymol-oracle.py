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
    "none",
    "chain A",
    "chain A and polymer.protein",
    "polymer.protein",
    "organic",
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
)


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
