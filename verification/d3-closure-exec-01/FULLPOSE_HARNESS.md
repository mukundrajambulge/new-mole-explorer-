# Full-pose direct/grid runner

`tools/full_pose_compare.py` and `tools/full_pose_compare.cpp` provide the missing deterministic orchestration around the existing direct scorer and scoring field. They consume one frozen normalized input bundle, build one receptor field, apply each declared rigid transform to a copy of the same ligand coordinates, and send those transformed coordinates to both scoring paths. Any grid OOD or interpolation failure stops the run; there is no direct-score fallback.

The native target is built separately from the production library and links the unchanged `native/docking-reference/scoring` library:

```sh
cmake -S verification/d3-closure-exec-01/tools -B /tmp/mole-d3-fullpose-build -DCMAKE_BUILD_TYPE=Release
cmake --build /tmp/mole-d3-fullpose-build --target mole_d3_fullpose_compare --parallel
python3 verification/d3-closure-exec-01/tools/full_pose_compare.py \
  --input /path/to/frozen-fullpose-input.json \
  --native /tmp/mole-d3-fullpose-build/mole_d3_fullpose_compare \
  --out-dir /path/to/fullpose-results
```

## Input bundle

The JSON root uses `schemaId: "MOLE_D3_FULLPOSE_INPUT_V1"` and includes:

- `mode`: `SEALED_STATES` or `SYNTHETIC_CONTROL`;
- `states`: prepared receptor/ligand digests and both coordinate-state references;
- `stateArtifacts` for `SEALED_STATES`: relative or absolute paths plus SHA-256 of serialized state JSON; each file's root `digest`, receptor/ligand profile ID and nested `coordinateState.digest` must match the declared state references;
- `searchRegion`: the closed AABB, its digest, receptor digest and receptor-frame coordinate-state digest;
- `searchRegionArtifact` for `SEALED_STATES`: hash-verified D2 SearchRegion JSON whose closed bounds, coordinate frame, receptor/coordinate-state references, and digest match the declared input;
- `profiles`: the exact scoring, typing, chemistry, backend, receptor and D3 torsion profile IDs and content digests, plus typing-assignment digests;
- `torsions`: independent `searchTorsionCount` and `nTorsVina` values;
- `siteClass`, `siteInfluenceComplete`, and `coordinateUnits`;
- `receptorAtoms` and `ligandAtoms`: stable `atomUid`, `xsType`, `element`, `positionAngstrom`, `formalCharge`, `importedPartialCharge`, and `scoringCenter`;
- `profileArtifacts` for `SEALED_STATES`: hash-verified JSON manifests for scoring, typing, chemistry, numerical-backend, and scorer-torsion profiles. Each root `profileId` and `digest` must match the input metadata;
- `typingAssignmentArtifacts` for `SEALED_STATES`: hash-verified JSON wrappers containing the typed-atom `assignments` array and the matching assignment `digest`;
- `scorerTorsionAssignmentArtifact` for `SEALED_STATES`: hash-verified assignment wrapper whose scorer-torsion profile ID/digest, assignment digest and `nTorsVina` match the request; `searchTorsionCount` must independently match the sealed ligand kinematic model;
- `poses`: unique pose IDs, one identity crystal pose, declared translation/rotation/combined/grid-phase classes, exact rigid transforms, and at least one pose explicitly tagged `cutoffStress: true`;
- `bundleDigest`: SHA-256 of UTF-8 canonical JSON for the root object with `bundleDigest` omitted (sorted keys, compact separators, no non-finite values).

The runner checks bundle integrity, state/profile/typing artifact byte hashes and embedded digest links, finite coordinates, unique atom/pose IDs, profile IDs and content digests, SearchRegion links, required cohort labels, and the explicitly designated cutoff-stress subset. In `SEALED_STATES` mode it also requires an exact match between each projected heavy-atom UID set and its D2 graph, element, formal charge, and coordinate bit pattern; ligand typing must match both the sealed ligand assignment and the separately supplied typing assignment. It does not recompute canonical D2 digests, so the referenced state artifacts must come from the separately verified D2 sealing step. A synthetic control is accepted only with the explicit `--allow-synthetic-control` flag and is labeled `CONTROL_ONLY`.

Pose transforms use Rodrigues rotation about `rotationOriginAngstrom`, followed by `translationAngstrom`. Input axes may have any finite nonzero length and are normalized by the runner. No transform magnitude or approximation threshold is chosen by the runner. The cutoff-stress designation is carried from the frozen pose manifest; the runner does not invent a cutoff shell width.

## Outputs

On a complete run the tool writes per-pose results, the transformed-pose manifest, five-term decomposition rows, error statistics for the full cohort and tagged cutoff-stress subset, and the raw native run log. Synthetic control output files use a `CONTROL_` prefix; fixture output files use `FULLPOSE_`. Statistics use signed `grid − direct` errors and linear-interpolated percentiles at `h=(n−1)p`. Pairwise score ties and direct/grid ordering reversals are listed with their signed differences and magnitudes. These are measurements only; the tool defines no approximation acceptance threshold.

The output pose digest is SHA-256 over atoms sorted by AtomUID, each encoded as a 4-byte big-endian UID byte length, UTF-8 UID bytes, then the three transformed IEEE-754 binary64 coordinates in big-endian bit form. This is a run artifact digest, not a D2 state digest.

## Current closure status

The harness was added because the existing protocol, empty CSV headers and native unit tests did not provide an executable full-pose cohort runner. It has not been run on 3DMX/BNZ: the frozen preparation profile still does not resolve ASN68, ASP72 and ARG76 alternate locations. Synthetic control execution can verify the orchestration and scorer calls, but cannot fill the fixture result tables or establish approximation behavior.
