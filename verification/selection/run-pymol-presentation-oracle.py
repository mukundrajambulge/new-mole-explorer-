"""Run pinned PyMOL presentation-dependent selection cases.

The application baseline is explicit: solvent is hidden by presentation, the
protein contributes Cartoon, the organic component contributes Sticks, and the
ion contributes Spheres. Color selectors are evaluated only after their
corresponding presentation setup is applied.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import types
from pathlib import Path

if not hasattr(types, "UnionType"):
    types.UnionType = type  # type: ignore[attr-defined]
if not hasattr(sys, "setcheckinterval"):
    sys.setcheckinterval = lambda _value: None  # type: ignore[attr-defined]

import pymol
from pymol import cmd


ORACLE_SOURCE = "schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69"


def atom_tuples(selection: str) -> list[str]:
    return [
        f"{atom.index}|{atom.chain}|{atom.resn}|{atom.resi}|{atom.name}|{atom.symbol}"
        for atom in cmd.get_model(selection).atom
    ]


def row_for(query: str) -> dict[str, object]:
    return_code = cmd.select("presentation_probe", query)
    tuples = atom_tuples("presentation_probe")
    return {
        "query": query,
        "returnCode": return_code,
        "count": len(tuples),
        "membershipHash": hashlib.sha256("\n".join(tuples).encode("utf-8")).hexdigest(),
        "tuples": tuples,
        "status": "PASS",
    }


def reset_fixture(fixture: Path) -> None:
    cmd.reinitialize()
    cmd.load(str(fixture), "presentation_fixture")
    cmd.hide("everything", "solvent")
    cmd.show("cartoon", "polymer.protein")
    cmd.show("sticks", "organic")
    cmd.show("spheres", "inorganic")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    pymol.finish_launching(["pymol", "-cq"])
    rows: list[dict[str, object]] = []

    reset_fixture(args.fixture)
    rows.append(row_for("visible"))

    reset_fixture(args.fixture)
    cmd.color("red", "all and not solvent")
    rows.append(row_for("color red"))

    reset_fixture(args.fixture)
    cmd.set("cartoon_color", "red", "polymer.protein")
    rows.append(row_for("cartoon_color red"))

    result = {
        "schemaVersion": 1,
        "source": ORACLE_SOURCE,
        "oracleSource": ORACLE_SOURCE,
        "runtime": f"PyMOL {cmd.get_version()[0]}",
        "fixture": str(args.fixture),
        "queryCount": len(rows),
        "generatedBy": "verification/selection/run-pymol-presentation-oracle.py",
        "presentationBaseline": {
            "hidden": "solvent",
            "representations": {"polymer.protein": "cartoon", "organic": "sticks", "inorganic": "spheres"},
            "colorSelectorSetup": "color red on all and not solvent",
            "cartoonColorSelectorSetup": "cartoon_color red on polymer.protein",
        },
        "rows": rows,
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    cmd.quit()


if __name__ == "__main__":
    main()
