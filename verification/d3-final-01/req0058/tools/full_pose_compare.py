#!/usr/bin/env python3
"""Run D3's same-state direct/grid full-pose comparison from a frozen input bundle."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import pathlib
import statistics
import struct
import subprocess
import sys
from typing import Any


TERMS = ("g1", "g2", "rep", "hyd", "hb")
COHORTS = {"CRYSTAL", "TRANSLATION", "ROTATION", "COMBINED", "GRID_PHASE"}
EXPECTED_IDS = {
    "receptor_profile_id": "ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0",
    "scoring_profile_id": "ME_DOCKING_V1_VINA_CLASSIC_1_0",
    "receptor_typing_profile_id": "ME_XS_TYPING_V1_1_0",
    "ligand_typing_profile_id": "ME_XS_TYPING_V1_1_0",
    "chemistry_profile_id": "ME_SUPPORTED_CHEMISTRY_V1_1_0",
    "numerical_backend_profile_id": "ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0",
    "scorer_torsion_profile_id": "ME_D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1",
}
SHA256_PREFIX = "sha256:"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest(value: Any, label: str) -> str:
    require(isinstance(value, str) and len(value) == 71 and value.startswith(SHA256_PREFIX), f"{label} must be sha256:<64 lowercase hex>")
    require(all(ch in "0123456789abcdef" for ch in value[7:]), f"{label} must be sha256:<64 lowercase hex>")
    return value


def finite(value: Any, label: str) -> float:
    require(isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value), f"{label} must be finite")
    return float(value)


def vector(value: Any, label: str) -> list[float]:
    require(isinstance(value, list) and len(value) == 3, f"{label} must contain exactly three values")
    return [finite(v, label) for v in value]


def verify_artifact(path_value: Any, sha_value: Any, base_dir: pathlib.Path, label: str) -> tuple[dict[str, Any], str]:
    require(isinstance(path_value, str) and path_value, f"{label} path is required")
    artifact_path = pathlib.Path(path_value)
    if not artifact_path.is_absolute():
        artifact_path = base_dir / artifact_path
    require(isinstance(sha_value, str) and len(sha_value) == 64 and all(ch in "0123456789abcdef" for ch in sha_value), f"{label} SHA-256 is invalid")
    raw = artifact_path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == sha_value, f"artifact bytes changed: {label}")
    parsed = json.loads(raw)
    require(isinstance(parsed, dict), f"{label} must be a JSON object")
    return parsed, sha_value


def f64bits(value: Any, label: str) -> bytes:
    require(isinstance(value, dict) and value.get("tag") == "f64", f"{label} must be canonical F64Bits")
    raw = value.get("bytes")
    if isinstance(raw, list):
        require(len(raw) == 8 and all(isinstance(item, int) and not isinstance(item, bool) and 0 <= item <= 255 for item in raw), f"{label} bytes are invalid")
        data = bytes(raw)
    elif isinstance(raw, dict):
        require(set(raw) == {str(index) for index in range(8)}, f"{label} byte map is invalid")
        values = [raw[str(index)] for index in range(8)]
        require(all(isinstance(item, int) and not isinstance(item, bool) and 0 <= item <= 255 for item in values), f"{label} bytes are invalid")
        data = bytes(values)
    elif isinstance(raw, str):
        try:
            data = bytes.fromhex(raw)
        except ValueError as error:
            raise ValueError(f"{label} bytes are invalid") from error
        require(len(data) == 8, f"{label} must contain exactly eight bytes")
    else:
        raise ValueError(f"{label} bytes are invalid")
    value64 = struct.unpack(">d", data)[0]
    require(math.isfinite(value64), f"{label} must encode a finite float")
    return data


def verify_state_projection(state: dict[str, Any], projected: list[dict[str, Any]], label: str,
                            typing_assignments: dict[str, str] | None = None,
                            verify_embedded_ligand_typing: bool = False) -> None:
    graph = state.get("graphRevision")
    coordinate = state.get("coordinateState")
    chemical = state.get("chemicalState")
    require(isinstance(graph, dict) and isinstance(graph.get("atoms"), list), f"{label} graphRevision is invalid")
    require(isinstance(coordinate, dict) and isinstance(coordinate.get("coordinates"), dict), f"{label} coordinateState is invalid")
    require(isinstance(chemical, dict) and isinstance(chemical.get("formalCharges"), dict), f"{label} chemicalState is invalid")
    graph_uids = [atom_row.get("atomUid") for atom_row in graph["atoms"] if isinstance(atom_row, dict)]
    require(len(graph_uids) == len(graph["atoms"]) and len(graph_uids) == len(set(graph_uids)), f"{label} graph AtomUIDs are malformed or duplicated")
    heavy = {atom_row.get("atomUid"): atom_row for atom_row in graph["atoms"]
             if isinstance(atom_row, dict) and str(atom_row.get("element", "")).upper() != "H"}
    if typing_assignments is not None:
        require(set(typing_assignments) == set(heavy), f"{label} typing assignment UID set does not match sealed heavy atoms")
    projected_by_uid = {row["atomUid"]: row for row in projected}
    require(set(projected_by_uid) == set(heavy), f"{label} scoring projection must contain exactly the sealed heavy-atom UID set")
    coordinates = coordinate["coordinates"]
    formal_charges = chemical["formalCharges"]
    embedded_typing = {}
    if verify_embedded_ligand_typing:
        rows = state.get("atomTyping")
        require(isinstance(rows, list), "prepared ligand atomTyping is invalid")
        require(all(isinstance(row, dict) for row in rows), "prepared ligand atomTyping contains an invalid row")
        embedded_uids = [row.get("atomUid") for row in rows]
        require(len(embedded_uids) == len(set(embedded_uids)), "prepared ligand atomTyping contains duplicate AtomUIDs")
        embedded_typing = {row.get("atomUid"): row.get("typeId") for row in rows}
    for uid, graph_atom in heavy.items():
        require(uid in coordinates and uid in formal_charges, f"{label} sealed atom lacks coordinate or formal charge: {uid}")
        row = projected_by_uid[uid]
        require(str(row["element"]).upper() == str(graph_atom.get("element", "")).upper(), f"{label} element mismatch: {uid}")
        exact = coordinates[uid]
        require(isinstance(exact, list) and len(exact) == 3, f"{label} coordinate tuple is malformed: {uid}")
        source_bits = [f64bits(item, f"{label}.{uid}.coordinate") for item in exact]
        projected_bits = [struct.pack(">d", value) for value in row["position"]]
        require(projected_bits == source_bits, f"{label} scoring projection changed sealed coordinates: {uid}")
        expected_charge = formal_charges[uid]
        require(row["formalCharge"] == expected_charge, f"{label} formal charge mismatch: {uid}")
        if typing_assignments is not None:
            require(typing_assignments.get(uid) == row["xsType"], f"{label} XS typing mismatch: {uid}")
        if verify_embedded_ligand_typing:
            require(embedded_typing.get(uid) == row["xsType"], f"prepared ligand XS type mismatch: {uid}")


def verify_prepared_receptor_profile_dependencies(state: dict[str, Any], profiles: dict[str, Any]) -> None:
    require(state.get("schemaVersion") == 2 and state.get("semanticSchemaId") == "D2_PREPARED_RECEPTOR_STATE_V2",
            "prepared receptor must use the complete V2 identity schema")
    dependencies = state.get("scientificDependencies")
    require(isinstance(dependencies, dict), "prepared receptor scientificDependencies are required")
    expected = (
        ("chemicalPerceptionProfileRef", "chemistry_profile_id", "chemistry_profile_digest"),
        ("receptorAtomTypingProfileRef", "receptor_typing_profile_id", "typing_profile_digest"),
        ("scoringProfileRef", "scoring_profile_id", "scoring_profile_digest"),
    )
    for state_key, profile_id_key, profile_digest_key in expected:
        reference = dependencies.get(state_key)
        require(isinstance(reference, dict), f"prepared receptor dependency {state_key} is required")
        require(reference.get("profileId") == profiles.get(profile_id_key) and
                reference.get("profileDigest") == profiles.get(profile_digest_key),
                f"prepared receptor dependency mismatch: {state_key}")


def atom(row: Any, collection: str) -> dict[str, Any]:
    require(isinstance(row, dict), f"{collection} atom must be an object")
    uid = row.get("atomUid")
    xs = row.get("xsType")
    element = row.get("element")
    require(isinstance(uid, str) and uid and "\t" not in uid and "\n" not in uid and "\r" not in uid, f"{collection} atom UID is invalid")
    require(isinstance(xs, str) and xs and "\t" not in xs, f"{collection} XS type is invalid")
    require(isinstance(element, str) and element and "\t" not in element, f"{collection} element is invalid")
    charge = row.get("formalCharge")
    require(charge is None or (isinstance(charge, int) and not isinstance(charge, bool)), f"{collection} formalCharge must be integer or null")
    partial = row.get("importedPartialCharge")
    require(partial is None or (isinstance(partial, (int, float)) and not isinstance(partial, bool) and math.isfinite(partial)), f"{collection} importedPartialCharge must be finite or null")
    scoring_center = row.get("scoringCenter")
    require(isinstance(scoring_center, bool), f"{collection} scoringCenter must be boolean")
    return {
        "atomUid": uid,
        "xsType": xs,
        "element": element,
        "formalCharge": charge,
        "importedPartialCharge": None if partial is None else float(partial),
        "scoringCenter": scoring_center,
        "position": vector(row.get("positionAngstrom"), f"{collection}.{uid}.positionAngstrom"),
    }


def verify_input(value: Any, input_path: pathlib.Path, allow_synthetic: bool) -> dict[str, Any]:
    require(isinstance(value, dict) and value.get("schemaId") == "MOLE_D3_FULLPOSE_INPUT_V1", "unsupported full-pose input schema")
    require(value.get("mode") in {"SEALED_STATES", "SYNTHETIC_CONTROL"}, "mode must be SEALED_STATES or SYNTHETIC_CONTROL")
    if value["mode"] == "SYNTHETIC_CONTROL":
        require(allow_synthetic, "synthetic controls require --allow-synthetic-control and cannot be reported as fixture evidence")
    require(value.get("coordinateUnits") == "ANGSTROM", "coordinates must be ANGSTROM")
    profile = value.get("profiles")
    require(isinstance(profile, dict), "profiles are required")
    for key, expected in EXPECTED_IDS.items():
        require(profile.get(key) == expected, f"unexpected profile ID for {key}")
    for key in ("scoring_profile_digest", "typing_profile_digest", "chemistry_profile_digest", "numerical_backend_profile_digest", "receptor_typing_assignment_digest", "ligand_typing_assignment_digest", "scorer_torsion_profile_digest", "scorer_torsion_assignment_digest"):
        digest(profile.get(key), key)

    states = value.get("states")
    require(isinstance(states, dict), "state references are required")
    receptor_digest = digest(states.get("preparedReceptorDigest"), "preparedReceptorDigest")
    ligand_digest = digest(states.get("preparedLigandDigest"), "preparedLigandDigest")
    coordinate_digest = digest(value.get("coordinateStateDigest"), "coordinateStateDigest")
    region_digest = digest(value.get("searchRegionDigest"), "searchRegionDigest")
    require(isinstance(states.get("preparedReceptorCoordinateStateDigest"), str), "receptor coordinate-state digest is required")
    digest(states["preparedReceptorCoordinateStateDigest"], "preparedReceptorCoordinateStateDigest")
    require(states.get("preparedLigandCoordinateStateDigest") == coordinate_digest, "ligand coordinate-state digest must match scoring input")

    state_docs = {}
    region_doc = None
    typing_maps: dict[str, dict[str, str]] = {}
    for name, state_digest in (("preparedReceptor", receptor_digest), ("preparedLigand", ligand_digest)):
        if value["mode"] == "SEALED_STATES":
            artifact_refs = value.get("stateArtifacts")
            require(isinstance(artifact_refs, dict), "stateArtifacts must be an object")
            ref = artifact_refs.get(name)
            require(isinstance(ref, dict), f"stateArtifacts.{name} is required for SEALED_STATES")
            state_json, _ = verify_artifact(ref.get("path"), ref.get("sha256"), input_path.parent, f"stateArtifacts.{name}")
            require(isinstance(state_json, dict) and state_json.get("digest") == state_digest, f"state artifact digest reference mismatch: {name}")
            expected_state_profile = EXPECTED_IDS["receptor_profile_id"] if name == "preparedReceptor" else "ME_DOCKING_V1_LIGAND_EXPLICIT_STATE_1_0"
            require(state_json.get("profileId") == expected_state_profile, f"state artifact profile mismatch: {name}")
            if name == "preparedReceptor":
                require(state_json.get("coordinateState", {}).get("digest") == states.get("preparedReceptorCoordinateStateDigest"), "receptor artifact coordinate-state link mismatch")
            else:
                require(state_json.get("coordinateState", {}).get("digest") == coordinate_digest, "ligand artifact coordinate-state link mismatch")
            state_docs[name] = state_json

    if value["mode"] == "SEALED_STATES":
        verify_prepared_receptor_profile_dependencies(state_docs["preparedReceptor"], profile)

    if value["mode"] == "SEALED_STATES":
        expected_artifacts = {
            "scoring": ("scoring_profile_id", "scoring_profile_digest"),
            "typing": ("receptor_typing_profile_id", "typing_profile_digest"),
            "chemistry": ("chemistry_profile_id", "chemistry_profile_digest"),
            "numericalBackend": ("numerical_backend_profile_id", "numerical_backend_profile_digest"),
            "scorerTorsion": ("scorer_torsion_profile_id", "scorer_torsion_profile_digest"),
        }
        refs = value.get("profileArtifacts")
        require(isinstance(refs, dict), "profileArtifacts are required for SEALED_STATES")
        for key, (id_key, digest_key) in expected_artifacts.items():
            ref = refs.get(key)
            require(isinstance(ref, dict), f"profileArtifacts.{key} is required")
            doc, _ = verify_artifact(ref.get("path"), ref.get("sha256"), input_path.parent, f"profileArtifacts.{key}")
            require(doc.get("profileId") == profile[id_key] and doc.get("digest") == profile[digest_key], f"profile artifact identity/digest mismatch: {key}")
        region_ref = value.get("searchRegionArtifact")
        require(isinstance(region_ref, dict), "searchRegionArtifact is required")
        region_doc, _ = verify_artifact(region_ref.get("path"), region_ref.get("sha256"), input_path.parent, "searchRegionArtifact")
        require(region_doc.get("digest") == region_digest and
                region_doc.get("preparedReceptorDigest") == receptor_digest and
                region_doc.get("coordinateStateDigest") == states.get("preparedReceptorCoordinateStateDigest") and
                region_doc.get("boundary") == "CLOSED_AABB_V1" and
                region_doc.get("posePolicy") == "ALL_LIGAND_HEAVY_ATOMS_IN_OR_ON" and
                region_doc.get("units") == "ANGSTROM", "sealed SearchRegion artifact does not match the experiment bundle")
        require(region_doc.get("coordinateFrame") == state_docs["preparedReceptor"].get("coordinateState", {}).get("coordinateFrame"),
                "sealed SearchRegion coordinate frame mismatch")
        typing_refs = value.get("typingAssignmentArtifacts")
        require(isinstance(typing_refs, dict), "typingAssignmentArtifacts are required")
        for key, digest_key in (("receptor", "receptor_typing_assignment_digest"), ("ligand", "ligand_typing_assignment_digest")):
            ref = typing_refs.get(key)
            require(isinstance(ref, dict), f"typingAssignmentArtifacts.{key} is required")
            doc, _ = verify_artifact(ref.get("path"), ref.get("sha256"), input_path.parent, f"typingAssignmentArtifacts.{key}")
            require(doc.get("digest") == profile[digest_key], f"typing assignment artifact digest mismatch: {key}")
            assignments = doc.get("assignments")
            require(isinstance(assignments, list), f"typing assignment list is invalid: {key}")
            require(all(isinstance(row, dict) for row in assignments), f"typing assignment row is invalid: {key}")
            assignment_uids = [row.get("atomUid") for row in assignments]
            require(len(assignment_uids) == len(set(assignment_uids)), f"typing assignments contain duplicate AtomUIDs: {key}")
            typing_maps[key] = {row.get("atomUid"): row.get("typeId") for row in assignments}

    bounds = value.get("searchRegion")
    require(isinstance(bounds, dict) and bounds.get("boundary") == "CLOSED_AABB_V1", "closed SearchRegion is required")
    min_v = vector(bounds.get("minimum"), "searchRegion.minimum")
    max_v = vector(bounds.get("maximum"), "searchRegion.maximum")
    require(all(lo < hi for lo, hi in zip(min_v, max_v)), "SearchRegion bounds must be increasing")
    require(bounds.get("preparedReceptorDigest") == receptor_digest, "SearchRegion must bind the prepared receptor")
    require(bounds.get("coordinateStateDigest") == states.get("preparedReceptorCoordinateStateDigest"), "SearchRegion coordinate frame mismatch")
    require(bounds.get("digest") == region_digest, "SearchRegion digest reference mismatch")
    if region_doc is not None:
        for bit_key, declared in (("min", min_v), ("max", max_v)):
            raw_coords = region_doc.get(bit_key)
            require(isinstance(raw_coords, list) and len(raw_coords) == 3, f"sealed SearchRegion {bit_key} is malformed")
            require([f64bits(item, f"searchRegion.{bit_key}") for item in raw_coords] ==
                    [struct.pack(">d", coordinate) for coordinate in declared],
                    f"declared SearchRegion {bit_key} differs from the sealed artifact")

    atoms: dict[str, list[dict[str, Any]]] = {}
    for key in ("receptorAtoms", "ligandAtoms"):
        rows = value.get(key)
        require(isinstance(rows, list) and rows, f"{key} must be nonempty")
        normalized = [atom(row, key) for row in rows]
        uids = [row["atomUid"] for row in normalized]
        require(len(uids) == len(set(uids)), f"{key} contains duplicate AtomUIDs")
        atoms[key] = sorted(normalized, key=lambda item: item["atomUid"])
    if value["mode"] == "SEALED_STATES":
        verify_state_projection(state_docs["preparedReceptor"], atoms["receptorAtoms"], "receptor",
                                typing_assignments=typing_maps["receptor"])
        verify_state_projection(state_docs["preparedLigand"], atoms["ligandAtoms"], "ligand",
                                typing_assignments=typing_maps["ligand"], verify_embedded_ligand_typing=True)

    torsions = value.get("torsions")
    require(isinstance(torsions, dict), "distinct torsion quantities are required")
    require(isinstance(torsions.get("searchTorsionCount"), int) and torsions["searchTorsionCount"] >= 0, "searchTorsionCount must be a nonnegative integer")
    n_tors = finite(torsions.get("nTorsVina"), "nTorsVina")
    require(n_tors >= 0.0, "nTorsVina must be nonnegative")
    if value["mode"] == "SEALED_STATES":
        kinematic = state_docs["preparedLigand"].get("kinematicModel")
        require(isinstance(kinematic, dict) and kinematic.get("searchTorsionCount") == torsions["searchTorsionCount"],
                "searchTorsionCount must match the sealed ligand kinematic model")
        torsion_ref = value.get("scorerTorsionAssignmentArtifact")
        require(isinstance(torsion_ref, dict), "scorerTorsionAssignmentArtifact is required")
        torsion_doc, _ = verify_artifact(torsion_ref.get("path"), torsion_ref.get("sha256"), input_path.parent,
                                         "scorerTorsionAssignmentArtifact")
        require(torsion_doc.get("digest") == profile["scorer_torsion_assignment_digest"] and
                torsion_doc.get("profileId") == profile["scorer_torsion_profile_id"] and
                torsion_doc.get("profileDigest") == profile["scorer_torsion_profile_digest"] and
                finite(torsion_doc.get("nTorsVina"), "scorerTorsionAssignmentArtifact.nTorsVina") == n_tors,
                "scorer torsion assignment artifact does not match the frozen request")

    poses = value.get("poses")
    require(isinstance(poses, list) and poses, "pose cohort is required")
    ids: set[str] = set()
    seen_classes: set[str] = set()
    cutoff_count = 0
    normalized_poses = []
    for row in poses:
        require(isinstance(row, dict), "pose must be an object")
        pose_id = row.get("poseId")
        cohort = row.get("cohortClass")
        require(isinstance(pose_id, str) and pose_id and "\t" not in pose_id and "\n" not in pose_id, "poseId is invalid")
        require(pose_id not in ids, "poseIds must be unique")
        ids.add(pose_id)
        require(cohort in COHORTS, f"unsupported cohortClass: {cohort}")
        seen_classes.add(cohort)
        transform = row.get("transform")
        require(isinstance(transform, dict), f"pose {pose_id} transform is required")
        translation = vector(transform.get("translationAngstrom"), f"pose {pose_id} translation")
        axis = vector(transform.get("rotationAxis"), f"pose {pose_id} rotationAxis")
        origin = vector(transform.get("rotationOriginAngstrom"), f"pose {pose_id} rotationOrigin")
        angle = finite(transform.get("rotationAngleRadians"), f"pose {pose_id} rotationAngleRadians")
        require(math.hypot(*axis) > 0.0, f"pose {pose_id} rotation axis must be nonzero")
        cutoff = row.get("cutoffStress", False)
        require(isinstance(cutoff, bool), f"pose {pose_id} cutoffStress must be boolean")
        translation_nonzero = any(value != 0.0 for value in translation)
        rotation_nonzero = angle != 0.0
        cutoff_count += int(cutoff)
        if cohort == "CRYSTAL":
            require(not translation_nonzero and not rotation_nonzero, "CRYSTAL pose must be identity transform")
        elif cohort == "TRANSLATION":
            require(translation_nonzero and not rotation_nonzero, f"pose {pose_id} must be translation-only")
        elif cohort == "ROTATION":
            require(not translation_nonzero and rotation_nonzero, f"pose {pose_id} must be rotation-only")
        elif cohort == "COMBINED":
            require(translation_nonzero and rotation_nonzero, f"pose {pose_id} must combine translation and rotation")
        elif cohort == "GRID_PHASE":
            require(translation_nonzero, f"pose {pose_id} must shift coordinates for grid-phase sampling")
        normalized_poses.append({"poseId": pose_id, "cohortClass": cohort, "cutoffStress": cutoff,
                                 "translation": translation, "axis": axis, "angle": angle, "origin": origin})
    require("CRYSTAL" in seen_classes, "cohort must include the crystallographic pose")
    require({"TRANSLATION", "ROTATION", "COMBINED", "GRID_PHASE"} <= seen_classes, "cohort is missing a required controlled transformation class")
    require(cutoff_count > 0, "cohort must designate at least one cutoff-stress pose")

    supplied_bundle_digest = value.get("bundleDigest")
    unsigned = dict(value)
    unsigned.pop("bundleDigest", None)
    actual_bundle_digest = "sha256:" + hashlib.sha256(json.dumps(unsigned, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()
    require(supplied_bundle_digest == actual_bundle_digest, "bundleDigest does not match canonical input JSON")
    return {"original": value, "profile": profile, "states": states, "receptorDigest": receptor_digest,
            "ligandDigest": ligand_digest, "coordinateDigest": coordinate_digest, "regionDigest": region_digest,
            "regionMin": min_v, "regionMax": max_v, "atoms": atoms, "poses": normalized_poses}


def tsv_atom(collection: str, row: dict[str, Any]) -> str:
    charge = "null" if row["formalCharge"] is None else str(row["formalCharge"])
    partial = "null" if row["importedPartialCharge"] is None else float(row["importedPartialCharge"]).hex()
    nums = [float(v).hex() for v in row["position"]]
    return "\t".join(["ATOM", collection, row["atomUid"], row["xsType"], row["element"], charge, partial,
                      "1" if row["scoringCenter"] else "0", *nums])


def make_native_input(data: dict[str, Any]) -> str:
    src = data["original"]
    p = data["profile"]
    states = data["states"]
    meta = {
        "receptor_state_digest": data["receptorDigest"], "ligand_state_digest": data["ligandDigest"],
        "coordinate_state_digest": data["coordinateDigest"], "search_region_digest": data["regionDigest"],
        "receptor_profile_id": p["receptor_profile_id"], "scoring_profile_id": p["scoring_profile_id"],
        "scoring_profile_digest": p["scoring_profile_digest"], "receptor_typing_profile_id": p["receptor_typing_profile_id"],
        "ligand_typing_profile_id": p["ligand_typing_profile_id"], "typing_profile_digest": p["typing_profile_digest"],
        "receptor_typing_assignment_digest": p["receptor_typing_assignment_digest"],
        "ligand_typing_assignment_digest": p["ligand_typing_assignment_digest"],
        "chemistry_profile_id": p["chemistry_profile_id"], "chemistry_profile_digest": p["chemistry_profile_digest"],
        "numerical_backend_profile_id": p["numerical_backend_profile_id"],
        "numerical_backend_profile_digest": p["numerical_backend_profile_digest"],
        "coordinate_units": src["coordinateUnits"], "site_class": src["siteClass"],
        "site_influence_complete": "1" if src.get("siteInfluenceComplete") is True else "0",
        "search_torsion_count": str(src["torsions"]["searchTorsionCount"]),
        "scorer_torsion_profile_id": p["scorer_torsion_profile_id"],
        "scorer_torsion_profile_digest": p["scorer_torsion_profile_digest"],
        "scorer_torsion_assignment_digest": p["scorer_torsion_assignment_digest"],
        "n_tors_vina": float(src["torsions"]["nTorsVina"]).hex(),
    }
    lines = ["SCHEMA\tMOLE_D3_FULLPOSE_NATIVE_V1"]
    lines.extend(f"META\t{k}\t{v}" for k, v in sorted(meta.items()))
    lines.append("REGION\t" + "\t".join(float(v).hex() for v in (*data["regionMin"], *data["regionMax"])))
    lines.extend(tsv_atom("RECEPTOR", row) for row in data["atoms"]["receptorAtoms"])
    lines.extend(tsv_atom("LIGAND", row) for row in data["atoms"]["ligandAtoms"])
    for pose in data["poses"]:
        fields = ["POSE", pose["poseId"], pose["cohortClass"], "1" if pose["cutoffStress"] else "0",
                  *(float(v).hex() for v in pose["translation"]), *(float(v).hex() for v in pose["axis"]),
                  float(pose["angle"]).hex(), *(float(v).hex() for v in pose["origin"]), "POSE_V1"]
        lines.append("\t".join(fields))
    lines.append("END")
    return "\n".join(lines) + "\n"


def q(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * p
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def write_csv(path: pathlib.Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        raise ValueError(f"refusing to write empty scientific output: {path}")
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def score_rows(native_output: str, data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    raw_results: dict[str, list[str]] = {}
    pose_atoms: dict[str, list[tuple[str, str, str, str]]] = {}
    field_digest = None
    for line in native_output.splitlines():
        fields = line.split("\t")
        if fields[0] == "FIELD":
            field_digest = fields[1]
        elif fields[0] == "RESULT":
            raw_results[fields[1]] = fields
        elif fields[0] == "POSE_ATOM":
            pose_atoms.setdefault(fields[1], []).append((fields[2], fields[3], fields[4], fields[5]))
        else:
            raise ValueError("unknown native result record")
    require(field_digest is not None, "native runner did not report a field digest")
    poses_by_id = {pose["poseId"]: pose for pose in data["poses"]}
    result_rows = []
    manifests = []
    for pose_id, fields in raw_results.items():
        require(len(fields) == 32, f"malformed result record for {pose_id}")
        pose = poses_by_id[pose_id]
        numbers = [float(v) for v in fields[4:30]]
        require(all(math.isfinite(v) for v in numbers), f"nonfinite result for {pose_id}")
        atoms = sorted(pose_atoms.get(pose_id, []), key=lambda row: row[0])
        require(len(atoms) == len(data["atoms"]["ligandAtoms"]), f"pose atom count mismatch for {pose_id}")
        pose_hash = hashlib.sha256()
        for uid, x, y, z in atoms:
            uid_bytes = uid.encode("utf-8")
            pose_hash.update(len(uid_bytes).to_bytes(4, "big"))
            pose_hash.update(uid_bytes)
            pose_hash.update(bytes.fromhex(x))
            pose_hash.update(bytes.fromhex(y))
            pose_hash.update(bytes.fromhex(z))
        pose_digest = "sha256:" + pose_hash.hexdigest()
        direct_raw, grid_raw = numbers[0:5], numbers[5:10]
        direct_weighted, grid_weighted = numbers[10:15], numbers[15:20]
        direct_inter, grid_inter, total_delta, n_tors, torsion_divisor, corrected = numbers[20:26]
        row: dict[str, Any] = {
            "pose_id": pose_id, "cohort_class": fields[2], "transformation": json.dumps(pose["transform"] if "transform" in pose else {
                "translationAngstrom": pose["translation"], "rotationAxis": pose["axis"], "rotationAngleRadians": pose["angle"],
                "rotationOriginAngstrom": pose["origin"]}, sort_keys=True, separators=(",", ":")),
            "input_bundle_digest": data["original"]["bundleDigest"], "input_file_sha256": data["inputFileSHA256"],
            "receptor_state_digest": data["receptorDigest"], "ligand_state_digest": data["ligandDigest"],
            "coordinate_state_digest": data["coordinateDigest"], "search_region_digest": data["regionDigest"],
            "scoring_field_digest": field_digest, "source_pose_digest": data["coordinateDigest"], "pose_digest": pose_digest,
            "receptor_profile_id": data["profile"]["receptor_profile_id"],
            "scoring_profile_id": data["profile"]["scoring_profile_id"], "scoring_profile_digest": data["profile"]["scoring_profile_digest"],
            "receptor_typing_profile_id": data["profile"]["receptor_typing_profile_id"],
            "ligand_typing_profile_id": data["profile"]["ligand_typing_profile_id"],
            "typing_profile_digest": data["profile"]["typing_profile_digest"],
            "receptor_typing_assignment_digest": data["profile"]["receptor_typing_assignment_digest"],
            "ligand_typing_assignment_digest": data["profile"]["ligand_typing_assignment_digest"],
            "chemistry_profile_id": data["profile"]["chemistry_profile_id"], "chemistry_profile_digest": data["profile"]["chemistry_profile_digest"],
            "numerical_backend_profile_id": data["profile"]["numerical_backend_profile_id"],
            "numerical_backend_profile_digest": data["profile"]["numerical_backend_profile_digest"],
        }
        for index, term in enumerate(TERMS):
            row[f"direct_{term}"] = direct_raw[index]
            row[f"grid_{term}"] = grid_raw[index]
            row[f"direct_weighted_{term}"] = direct_weighted[index]
            row[f"grid_weighted_{term}"] = grid_weighted[index]
        row.update({"direct_e_inter": direct_inter, "grid_e_inter": grid_inter, "total_difference": total_delta,
                    "search_torsion_count": data["original"]["torsions"]["searchTorsionCount"], "n_tors_vina": n_tors,
                    "scorer_torsion_profile_id": data["profile"]["scorer_torsion_profile_id"],
                    "scorer_torsion_profile_digest": data["profile"]["scorer_torsion_profile_digest"],
                    "scorer_torsion_assignment_digest": data["profile"]["scorer_torsion_assignment_digest"],
                    "torsion_divisor": torsion_divisor, "corrected_score": corrected,
                    "cutoff_stress": "STRESS" if pose["cutoffStress"] else "CONTROL", "boundary_ood_status": fields[31]})
        result_rows.append(row)
        manifests.append({"pose_id": pose_id, "cohort_class": pose["cohortClass"], "transform_spec": row["transformation"],
                          "input_bundle_digest": row["input_bundle_digest"], "input_file_sha256": row["input_file_sha256"],
                          "receptor_state_digest": data["receptorDigest"], "ligand_state_digest": data["ligandDigest"],
                          "coordinate_state_digest": data["coordinateDigest"], "search_region_digest": data["regionDigest"],
                          "scoring_field_digest": field_digest, "source_pose_digest": data["coordinateDigest"],
                          "pose_digest": pose_digest, "cutoff_stress": row["cutoff_stress"], "boundary_status": fields[31]})
    require(len(result_rows) == len(data["poses"]), "native runner omitted a pose")
    result_rows.sort(key=lambda row: row["pose_id"])
    manifests.sort(key=lambda row: row["pose_id"])
    return result_rows, manifests


def metrics(rows: list[dict[str, Any]], variable: str) -> dict[str, float | int | None]:
    errors = [float(row[variable]) for row in rows]
    absolute = [abs(value) for value in errors]
    return {"n": len(errors), "signedMeanBias": statistics.fmean(errors) if errors else None,
            "mae": statistics.fmean(absolute) if errors else None,
            "rmse": math.sqrt(statistics.fmean(value * value for value in errors)) if errors else None,
            "p50": q(errors, 0.50), "p95": q(errors, 0.95), "p99": q(errors, 0.99),
            "maxAbsoluteError": max(absolute) if absolute else None}


def statistics_report(rows: list[dict[str, Any]]) -> dict[str, Any]:
    report: dict[str, Any] = {"quantileEstimator": "linear interpolation at h=(n-1)*p", "signedError": "grid minus direct",
                              "fullCohort": {}, "cutoffStressSubset": {}}
    subset = [row for row in rows if row["cutoff_stress"] == "STRESS"]
    for group_name, group in (("fullCohort", rows), ("cutoffStressSubset", subset)):
        report[group_name]["E_inter"] = metrics(group, "total_difference")
        for term in TERMS:
            for score_type in ("raw", "weighted"):
                key = f"{score_type}_{term}"
                if score_type == "raw":
                    errors = []
                    for row in group:
                        errors.append(float(row[f"grid_{term}"]) - float(row[f"direct_{term}"]))
                else:
                    errors = [float(row[f"grid_weighted_{term}"]) - float(row[f"direct_weighted_{term}"]) for row in group]
                report[group_name][key] = metrics([{"error": value} for value in errors], "error")
    ordered_direct = sorted(rows, key=lambda row: (float(row["direct_e_inter"]), row["pose_id"]))
    ordered_grid = sorted(rows, key=lambda row: (float(row["grid_e_inter"]), row["pose_id"]))
    reversals = []
    ties = []
    direct_rank = {row["pose_id"]: index for index, row in enumerate(ordered_direct)}
    grid_rank = {row["pose_id"]: index for index, row in enumerate(ordered_grid)}
    for i, left in enumerate(rows):
        for right in rows[i + 1:]:
            direct_delta = float(left["direct_e_inter"]) - float(right["direct_e_inter"])
            grid_delta = float(left["grid_e_inter"]) - float(right["grid_e_inter"])
            if direct_delta == 0.0 or grid_delta == 0.0:
                ties.append({"poseA": left["pose_id"], "poseB": right["pose_id"], "directTie": direct_delta == 0.0, "gridTie": grid_delta == 0.0})
            elif (direct_delta < 0.0) != (grid_delta < 0.0):
                reversals.append({"poseA": left["pose_id"], "poseB": right["pose_id"],
                                  "directDifference": direct_delta, "gridDifference": grid_delta,
                                  "reversalMagnitude": abs(direct_delta - grid_delta)})
    report["ordering"] = {"directOrder": [row["pose_id"] for row in ordered_direct],
                          "gridOrder": [row["pose_id"] for row in ordered_grid], "ties": ties,
                          "pairwiseReversals": reversals, "rankDisplacements": {
                              row["pose_id"]: grid_rank[row["pose_id"]] - direct_rank[row["pose_id"]] for row in rows}}
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=pathlib.Path, help="versioned normalized sealed-state and pose bundle")
    parser.add_argument("--native", required=True, type=pathlib.Path, help="compiled full_pose_compare executable")
    parser.add_argument("--out-dir", required=True, type=pathlib.Path)
    parser.add_argument("--allow-synthetic-control", action="store_true", help="permit a marked non-fixture control")
    args = parser.parse_args()
    try:
        raw = args.input.read_bytes()
        source = json.loads(raw)
        data = verify_input(source, args.input.resolve(), args.allow_synthetic_control)
        data["inputFileSHA256"] = hashlib.sha256(raw).hexdigest()
        native_input = make_native_input(data)
        completed = subprocess.run([str(args.native.resolve())], input=native_input, text=True, capture_output=True, check=False)
        if completed.returncode != 0:
            sys.stderr.write(completed.stderr)
            return completed.returncode
        rows, manifest = score_rows(completed.stdout, data)
        terms = []
        for row in rows:
            for term in TERMS:
                terms.append({"pose_id": row["pose_id"], "term_id": term.upper(),
                              "direct_raw": row[f"direct_{term}"], "grid_raw": row[f"grid_{term}"],
                              "direct_weighted": row[f"direct_weighted_{term}"], "grid_weighted": row[f"grid_weighted_{term}"],
                              "raw_difference": row[f"grid_{term}"] - row[f"direct_{term}"],
                              "weighted_difference": row[f"grid_weighted_{term}"] - row[f"direct_weighted_{term}"],
                              "receptor_state_digest": row["receptor_state_digest"], "ligand_state_digest": row["ligand_state_digest"],
                              "search_region_digest": row["search_region_digest"], "scoring_field_digest": row["scoring_field_digest"],
                              "input_bundle_digest": row["input_bundle_digest"], "pose_digest": row["pose_digest"]})
        summary = statistics_report(rows)
        output_dir = args.out_dir.resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        prefix = "CONTROL_" if source["mode"] == "SYNTHETIC_CONTROL" else "FULLPOSE_"
        write_csv(output_dir / f"{prefix}PER_POSE_RESULTS.csv", rows)
        write_csv(output_dir / f"{prefix}POSE_MANIFEST.csv", manifest)
        write_csv(output_dir / f"{prefix}TERM_DECOMPOSITION.csv", terms)
        (output_dir / f"{prefix}ERROR_STATISTICS.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        (output_dir / f"{prefix}NATIVE_RUN.log").write_text(completed.stdout, encoding="utf-8")
        print(json.dumps({"mode": source["mode"], "poseCount": len(rows), "outDir": str(output_dir),
                          "stateDigests": {"receptor": data["receptorDigest"], "ligand": data["ligandDigest"], "searchRegion": data["regionDigest"]},
                          "classification": "CONTROL_ONLY" if source["mode"] == "SYNTHETIC_CONTROL" else "FIXTURE_RESULT"}, indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f"full_pose_compare.py: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
