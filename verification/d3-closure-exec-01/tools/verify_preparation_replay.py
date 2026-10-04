"""Verify the two sealed preparation runs against byte-exact source atom rows."""

from __future__ import annotations

import hashlib
import json
import math
import struct
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_3dmx_bnz_hydrogens import atom_site_rows, read_and_verify_sources  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "PREPARATION_REPLAY_VALIDATION.json"
PROFILE_ID = "ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1"
EXPECTED = {
    "3DMX.cif": "e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef",
    "BNZ.cif": "01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61",
}
SCIENCE_FILES = (
    "PREPARED_SCIENTIFIC_PAYLOAD.json",
    "PREPARED_SCIENTIFIC_PAYLOAD.sha256",
    "SOURCE_ARTIFACT_HASHES.json",
    "SELECTED_HEAVY_ATOM_MANIFEST.json",
    "EXPLICIT_GRAPH_STATE.json",
    "HYDROGEN_PROVENANCE.json",
    "COMPONENT_DISPOSITIONS.json",
    "ALTLOC_DISPOSITIONS.json",
    "RESIDUE_STATE_INVENTORY.json",
    "HEAVY_ATOM_INVARIANTS.json",
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bits(values: list[float]) -> list[str]:
    return [struct.pack(">d", value).hex() for value in values]


def load_run(run_id: str) -> tuple[Path, dict[str, Any], list[dict[str, Any]]]:
    path = ROOT / "prepared_states" / run_id
    summary = json.loads((path / "RUN_SUMMARY.json").read_text(encoding="utf-8"))
    manifest = json.loads((path / "SELECTED_HEAVY_ATOM_MANIFEST.json").read_text(encoding="utf-8"))
    require(summary["status"] == "PASS", f"{run_id} preparation did not pass")
    require(summary["profile_id"] == PROFILE_ID and summary["profile_semantic_version"] == "1.1.0", f"{run_id} profile identity mismatch")
    require(summary["python"].startswith("3.13.16 ") and summary["rdkit_version"] == "2026.03.6", f"{run_id} runtime identity mismatch")
    require(summary["fixture_scores_or_docking"] is False, f"{run_id} unexpectedly scores or docks the fixture")
    require(summary["source_profile_completeness"]["status"] == "PASS", f"{run_id} source/profile completeness gate did not pass")
    require(summary["source_hashes_preparse"]["3DMX.cif"]["sha256"] == EXPECTED["3DMX.cif"], f"{run_id} 3DMX source hash mismatch")
    require(summary["source_hashes_preparse"]["BNZ.cif"]["sha256"] == EXPECTED["BNZ.cif"], f"{run_id} BNZ source hash mismatch")
    return path, summary, manifest


def verify_source_heavy_rows(manifests: list[dict[str, Any]], source_by_row: dict[int, dict[str, Any]]) -> dict[str, Any]:
    seen_source_keys: set[tuple[str, int]] = set()
    max_roundtrip_delta = 0.0
    by_context = {"receptor": 0, "ligand": 0}
    for item in manifests:
        context = item["context"]
        require(context in by_context, f"unknown prepared context: {context}")
        source = source_by_row.get(item["source_row"])
        require(source is not None, f"prepared atom refers to absent CIF row {item['source_row']}")
        require(source["element"] == item["element"] and source["atom"] == item["atom_name"] and source["comp"] == item["comp_id"], f"source heavy-atom identity mismatch at row {item['source_row']}")
        require(source["id"] == item["source_id"] and (source["alt"] or "(blank)") == item["altloc"], f"source row/altloc mapping mismatch at row {item['source_row']}")
        source_bits = bits(list(source["xyz"]))
        require(source_bits == item["coordinate_bits"], f"source coordinate bit pattern changed at row {item['source_row']}")
        serialized_bits = bits([float(value) for value in item["coordinate"]])
        require(serialized_bits == source_bits, f"serialized heavy-atom coordinate bits changed at row {item['source_row']}")
        delta = math.dist(source["xyz"], item["coordinate"])
        max_roundtrip_delta = max(max_roundtrip_delta, delta)
        key = (context, item["source_row"])
        require(key not in seen_source_keys, f"duplicate source heavy atom mapping {key}")
        seen_source_keys.add(key)
        by_context[context] += 1
    require(by_context == {"receptor": 1306, "ligand": 6}, f"unexpected selected heavy-atom counts: {by_context}")
    return {"counts": by_context, "zero_additions": True, "zero_deletions": True, "zero_remappings": True, "bitwise_source_coordinate_identity": True, "serialization_roundtrip_max_angstrom": max_roundtrip_delta}


def main() -> int:
    paths: dict[str, Path] = {}
    summaries: dict[str, dict[str, Any]] = {}
    manifests: dict[str, list[dict[str, Any]]] = {}
    for run_id in ("run-1", "run-2"):
        paths[run_id], summaries[run_id], manifests[run_id] = load_run(run_id)

    for name in SCIENCE_FILES:
        left = (paths["run-1"] / name).read_bytes()
        right = (paths["run-2"] / name).read_bytes()
        require(left == right, f"deterministic replay differs in {name}")
    payload = (paths["run-1"] / "PREPARED_SCIENTIFIC_PAYLOAD.json").read_bytes()
    payload_digest = hashlib.sha256(payload).hexdigest()
    require(payload_digest == summaries["run-1"]["preparation_payload_sha256"] == summaries["run-2"]["preparation_payload_sha256"], "prepared-state canonical payload digests differ")
    require((paths["run-1"] / "PREPARED_SCIENTIFIC_PAYLOAD.sha256").read_text(encoding="ascii").strip() == payload_digest, "run-1 payload checksum file mismatch")
    require((paths["run-2"] / "PREPARED_SCIENTIFIC_PAYLOAD.sha256").read_text(encoding="ascii").strip() == payload_digest, "run-2 payload checksum file mismatch")

    invariants = json.loads((paths["run-1"] / "HEAVY_ATOM_INVARIANTS.json").read_text(encoding="utf-8"))
    for context in ("receptor", "ligand"):
        row = invariants[context]
        require(row["heavyCoordinateBitsUnchanged"] and row["heavyHeavyBondsUnchanged"] and row["originalInputGraphUnchanged"], f"{context} heavy-atom invariant failed")
        require(row["heavyAtomCountBefore"] == row["heavyAtomCountAfter"], f"{context} heavy-atom count changed")
    require(invariants["heavyAtomAdditions"] == invariants["heavyAtomDeletions"] == invariants["heavyAtomIdentityChanges"] == invariants["heavyAtomCoordinateBitChanges"] == 0, "unauthorized heavy-atom change count is nonzero")

    source_dir = ROOT / "source_artifacts" / "current_rcsb"
    raw_sources, source_hashes = read_and_verify_sources(source_dir, ROOT / "SOURCE_MANIFEST.csv")
    cif_rows = atom_site_rows(raw_sources["3DMX.cif"])
    source_by_row = {row["row"]: row for row in cif_rows}
    coordinate_verification = verify_source_heavy_rows(manifests["run-1"], source_by_row)
    require(manifests["run-1"] == manifests["run-2"], "selected heavy-atom manifests differ")
    hydrogen_rows = json.loads((paths["run-1"] / "HYDROGEN_PROVENANCE.json").read_text(encoding="utf-8"))
    hcounts = {key: sum(1 for row in hydrogen_rows if row["context"] == key) for key in ("receptor", "ligand")}
    require(hcounts == {"receptor": 1330, "ligand": 6}, f"hydrogen inventory mismatch: {hcounts}")
    require(json.loads((paths["run-2"] / "HYDROGEN_PROVENANCE.json").read_text(encoding="utf-8")) == hydrogen_rows, "hydrogen provenance differs on replay")

    result = {
        "status": "PASS",
        "profile_id": PROFILE_ID,
        "runs": ["run-1", "run-2"],
        "runtime": {"python": "3.13.16", "rdkit": "2026.03.6", "platform": summaries["run-1"]["platform"]},
        "source_hashes": {name: source_hashes[name]["sha256"] for name in EXPECTED},
        "canonical_prepared_payload_sha256": payload_digest,
        "all_scientific_artifacts_identical": True,
        "source_heavy_atom_verification": coordinate_verification,
        "generated_hydrogens": hcounts,
        "heavy_atom_invariants": invariants,
        "chemistry_engine_was_not_used_for_state_selection": True,
    }
    OUTPUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    result["validation_json_sha256"] = sha(OUTPUT)
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"PREPARATION_REPLAY_FAILURE: {type(error).__name__}: {error}", file=sys.stderr)
        raise
