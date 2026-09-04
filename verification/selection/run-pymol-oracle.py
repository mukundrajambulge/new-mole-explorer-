#!/usr/bin/env python3
"""Run the pinned PyMOL selection corpus against a canonical fixture.

This runner is intentionally independent of the web selection engine. It records
PyMOL's returned count and a stable membership hash for comparison evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import types
from pathlib import Path

# The pinned source currently uses two post-3.9 stdlib symbols.  Keep the
# compatibility shim local to this evidence runner so the application and the
# pinned source remain untouched.
if not hasattr(types, "UnionType"):
    types.UnionType = type  # type: ignore[attr-defined]
if not hasattr(sys, "setcheckinterval"):
    sys.setcheckinterval = lambda _value: None  # type: ignore[attr-defined]

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
    "chain A polymer.protein",
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
    "name CA in chain A",
    "name like CA",
    "(chain A and name CA) like (chain A and name CA)",
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
    "organic extend 1",
    "polymer.protein",
    "polymer.nucleic",
    "protein",
    "solvent",
    "inorganic",
    "organic",
    "hetatm",
    "hydro",
    "backbone",
    "sidechain",
    "guide",
    "metals",
    "bonded",
    "donors",
    "acceptors",
    "all within 4 of organic",
    "all and (organic around 4)",
    "organic expand 4",
    "all near_to 4 of organic",
    "all beyond 4 of organic",
    "all and (organic gap 4)",
    "formal_charge = 0",
    "partial_charge > 0",
    "b > 20",
    "q >= 0.5",
    "q != 0.5",
    "ss HELIX",
    "x < 2",
    "x <= 2",
    "y >= 0",
    "z <= 100",
    "state 2",
    "foo = bar",
    'label "CA"',
    "pepseq AG",
    "rep cartoon",
    "color red",
)

# Keep the corpus readable while ensuring repeated compatibility cases are
# executed once and the emitted query count remains deterministic.
QUERIES = tuple(dict.fromkeys(QUERIES))


def atom_tuples(selection: str) -> list[str]:
    return [
        f"{atom.index}|{atom.chain}|{atom.resn}|{atom.resi}|{atom.name}|{atom.symbol}"
        for atom in cmd.get_model(selection).atom
    ]


def membership_hash(selection: str) -> str:
    return hashlib.sha256("\n".join(atom_tuples(selection)).encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    pymol.finish_launching(["pymol", "-cq"])
    cmd.load(str(args.fixture), "oracle_fixture")
    # Named-selection and presentation-dependent rows must be self-contained:
    # their setup is explicit and is never inferred from a previous query.
    cmd.select("active_site", "chain A and polymer.protein")
    cmd.group("groupA", "oracle_fixture")
    cmd.label("name CA", '"CA"')
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
                    "tuples": atom_tuples(selection),
                    "status": "PASS",
                }
            )
        except Exception as error:  # pragma: no cover - exercised by PyMOL runtime
            rows.append({"query": query, "status": "ERROR", "error": repr(error)})

    result = {
        "schemaVersion": 1,
        "source": ORACLE_SOURCE,
        "oracleSource": ORACLE_SOURCE,
        "runtime": f"PyMOL {cmd.get_version()[0]}",
        "fixture": str(args.fixture),
        "queryCount": len(rows),
        "summary": {
            "pass": sum(row["status"] == "PASS" for row in rows),
            "errors": sum(row["status"] == "ERROR" for row in rows),
        },
        "generatedBy": "verification/selection/run-pymol-oracle.py",
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
