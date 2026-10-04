#!/usr/bin/env python3
"""Non-scientific orchestration smoke test for the full-pose native runner."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import pathlib
import subprocess
import sys
import tempfile


def sha(char: str) -> str:
    return "sha256:" + char * 64


def make_bundle() -> dict:
    profile = {
        "receptor_profile_id": "ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0",
        "scoring_profile_id": "ME_DOCKING_V1_VINA_CLASSIC_1_0",
        "receptor_typing_profile_id": "ME_XS_TYPING_V1_1_0",
        "ligand_typing_profile_id": "ME_XS_TYPING_V1_1_0",
        "chemistry_profile_id": "ME_SUPPORTED_CHEMISTRY_V1_1_0",
        "numerical_backend_profile_id": "ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0",
        "scorer_torsion_profile_id": "ME_D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1",
        "scoring_profile_digest": sha("1"),
        "typing_profile_digest": sha("2"),
        "chemistry_profile_digest": sha("3"),
        "numerical_backend_profile_digest": sha("4"),
        "receptor_typing_assignment_digest": sha("5"),
        "ligand_typing_assignment_digest": sha("6"),
        "scorer_torsion_profile_digest": "sha256:0c042369f70f8a555930aa32cf2c0211abf93ef4bc837cdb389caff50e0edc6b",
        "scorer_torsion_assignment_digest": sha("7"),
    }
    ring = [[2.5 + 1.4 * math.cos(i * math.pi / 3), 1.4 * math.sin(i * math.pi / 3), 0.0] for i in range(6)]
    poses = [
        {"poseId": "p-crystal", "cohortClass": "CRYSTAL", "cutoffStress": False,
         "transform": {"translationAngstrom": [0.0, 0.0, 0.0], "rotationAxis": [0.0, 0.0, 1.0], "rotationAngleRadians": 0.0, "rotationOriginAngstrom": [2.5, 0.0, 0.0]}},
        {"poseId": "p-translation", "cohortClass": "TRANSLATION", "cutoffStress": False,
         "transform": {"translationAngstrom": [0.25, 0.0, 0.0], "rotationAxis": [0.0, 0.0, 1.0], "rotationAngleRadians": 0.0, "rotationOriginAngstrom": [2.5, 0.0, 0.0]}},
        {"poseId": "p-rotation", "cohortClass": "ROTATION", "cutoffStress": True,
         "transform": {"translationAngstrom": [0.0, 0.0, 0.0], "rotationAxis": [0.0, 0.0, 1.0], "rotationAngleRadians": 0.12, "rotationOriginAngstrom": [2.5, 0.0, 0.0]}},
        {"poseId": "p-combined", "cohortClass": "COMBINED", "cutoffStress": False,
         "transform": {"translationAngstrom": [0.125, -0.125, 0.0], "rotationAxis": [0.0, 0.0, 1.0], "rotationAngleRadians": 0.08, "rotationOriginAngstrom": [2.5, 0.0, 0.0]}},
        {"poseId": "p-grid-phase", "cohortClass": "GRID_PHASE", "cutoffStress": False,
         "transform": {"translationAngstrom": [0.1875, 0.0, 0.0], "rotationAxis": [0.0, 0.0, 1.0], "rotationAngleRadians": 0.0, "rotationOriginAngstrom": [2.5, 0.0, 0.0]}},
    ]
    result = {
        "schemaId": "MOLE_D3_FULLPOSE_INPUT_V1", "mode": "SYNTHETIC_CONTROL", "coordinateUnits": "ANGSTROM",
        "siteClass": "DRY_CORE", "siteInfluenceComplete": True,
        "states": {"preparedReceptorDigest": sha("a"), "preparedLigandDigest": sha("b"),
                   "preparedReceptorCoordinateStateDigest": sha("c"), "preparedLigandCoordinateStateDigest": sha("d")},
        "coordinateStateDigest": sha("d"), "searchRegionDigest": sha("e"),
        "searchRegion": {"minimum": [-4.25, -4.25, -4.25], "maximum": [4.25, 4.25, 4.25], "boundary": "CLOSED_AABB_V1",
                         "preparedReceptorDigest": sha("a"), "coordinateStateDigest": sha("c"), "digest": sha("e")},
        "profiles": profile,
        "torsions": {"searchTorsionCount": 0, "nTorsVina": 0.0},
        "receptorAtoms": [{"atomUid": "receptor:C1", "xsType": "C_H", "element": "C", "positionAngstrom": [0.0, 0.0, 0.0],
                            "formalCharge": 0, "importedPartialCharge": None, "scoringCenter": True}],
        "ligandAtoms": [{"atomUid": f"ligand:C{i + 1}", "xsType": "C_H", "element": "C", "positionAngstrom": xyz,
                         "formalCharge": 0, "importedPartialCharge": None, "scoringCenter": True} for i, xyz in enumerate(ring)],
        "poses": poses,
    }
    canonical = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    result["bundleDigest"] = "sha256:" + hashlib.sha256(canonical).hexdigest()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native", type=pathlib.Path, required=True)
    args = parser.parse_args()
    script = pathlib.Path(__file__).with_name("full_pose_compare.py").resolve()
    with tempfile.TemporaryDirectory(prefix="mole-fullpose-smoke-") as temp:
        root = pathlib.Path(temp)
        input_path = root / "control-input.json"
        output_path = root / "output"
        input_path.write_text(json.dumps(make_bundle(), indent=2) + "\n", encoding="utf-8")
        completed = subprocess.run([sys.executable, str(script), "--input", str(input_path), "--native", str(args.native.resolve()),
                                    "--out-dir", str(output_path), "--allow-synthetic-control"], capture_output=True, text=True)
        if completed.returncode != 0:
            sys.stderr.write(completed.stderr)
            sys.stderr.write(completed.stdout)
            return completed.returncode
        with (output_path / "CONTROL_PER_POSE_RESULTS.csv").open(encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        with (output_path / "CONTROL_TERM_DECOMPOSITION.csv").open(encoding="utf-8", newline="") as f:
            term_rows = list(csv.DictReader(f))
        summary = json.loads((output_path / "CONTROL_ERROR_STATISTICS.json").read_text(encoding="utf-8"))
        evidence_dir = pathlib.Path(__file__).resolve().parent.parent
        for output_name, template_name in (
            ("CONTROL_PER_POSE_RESULTS.csv", "FULLPOSE_PER_POSE_RESULTS.csv"),
            ("CONTROL_POSE_MANIFEST.csv", "FULLPOSE_POSE_MANIFEST.csv"),
            ("CONTROL_TERM_DECOMPOSITION.csv", "FULLPOSE_TERM_DECOMPOSITION.csv"),
        ):
            with (output_path / output_name).open(encoding="utf-8", newline="") as f:
                output_columns = next(csv.reader(f))
            template_columns = next(csv.reader((evidence_dir / template_name).open(encoding="utf-8", newline="")))
            if output_columns != template_columns:
                print(f"synthetic output columns differ from {template_name}", file=sys.stderr)
                return 1
        if len(rows) != 5 or any(row["boundary_ood_status"] != "IN_DOMAIN" for row in rows):
            print("synthetic runner output failed completeness/boundary check", file=sys.stderr)
            return 1
        if len(term_rows) != 25 or summary["fullCohort"]["E_inter"]["n"] != 5 or summary["cutoffStressSubset"]["E_inter"]["n"] != 1:
            print("synthetic runner output failed decomposition/statistics check", file=sys.stderr)
            return 1
        if any(not row.get("input_bundle_digest") or not row.get("input_file_sha256") for row in rows):
            print("synthetic runner output omitted its input identities", file=sys.stderr)
            return 1
        if list(output_path.glob("FULLPOSE_*")):
            print("synthetic runner mislabeled control data as fixture output", file=sys.stderr)
            return 1
        if {row["cohort_class"] for row in rows} != {"CRYSTAL", "TRANSLATION", "ROTATION", "COMBINED", "GRID_PHASE"}:
            print("synthetic runner output failed cohort coverage check", file=sys.stderr)
            return 1
        print("PASS: five synthetic poses traversed both paths; term/statistics and input identity outputs verified; no fixture evidence emitted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
