# Corrected Final D3 Regression Report

## Candidate and exact-SHA verification

This is the final acceptance continuation on branch `release/d3-final-acceptance`, based on predecessor `6bcaefc5290fadefd9d3bb9ecce2c641f1a0dcad`. The corrected receptor state is V2 and the continuation preserves the original HOLD package. Final full regression is run after the acceptance commit against exact `HEAD`; its SHA and command result summary are captured in ignored task-local `verification/d3-final-01/runtime_logs/REQ0058_FINAL_TESTED_SHA.txt` so the commit does not contain a self-referential hash.

## Final applicable suites

| Suite | Result |
|---|---|
| Focused AT-0058 / PreparedReceptorState API tests | PASS — API D2 preparation file, 13 tests; verifies deterministic replay, canonical serialization, dependency sensitivity, missing/malformed fail-closed, and field mismatch rejection. |
| Workspace tests | PASS — 47 files / 256 tests (web 34 files / 156; API 13 files / 100). Includes D1 contracts 14, D2 prep 13, D3-TOR 8. |
| D3-GRID contract | PASS — 1 file / 5 tests. |
| Native CMake / CTest | PASS — 2/2 tests, fresh configure/build on Ubuntu 24.04.5 / GCC 13.3. |
| Typecheck | PASS — API, app, web and contracts. |
| Lint | PASS — all workspaces. |
| Production build | PASS — all workspaces. Existing 3Dmol.js `eval` and >500 kB bundle advisories remain. |
| Protected PyMOL browser suite | PASS — 3/3 Playwright tests. |
| Protected screenshot hashes | PASS — 40/40 exact hashes after restoring the two browser-generated files to their tracked bytes. |
| Preparation replay | PASS — canonical preparation payload replay; two pinned preparation runs had identical payload digest `212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f`; heavy-atom additions, deletions, remappings, bond changes and coordinate-bit changes are zero. |
| D2 seal replay | PASS — independent canonical-CBOR recomputation for graph, identity, chemical state, coordinates, V2 prepared receptor, ligand, kinematic model and SearchRegion. |
| Corrected 3DMX/BNZ full-pose run | PASS — rebuilt native comparison runner; six `SEALED_STATES` poses, all in-domain. Five-case synthetic smoke suite passes, including mismatch and V1 rejection. |

## Corrected digest identities

- Prepared receptor: `sha256:226761376a4fbb3d361d3fe6b4e677f53986e2c36cc4f4ca0d4dc0ef34dbe76d` (V2, dependency-complete).
- Prepared ligand: unchanged `sha256:65e8b07631df6cc83800b31bf7682b420fce282cadaf3b2427973260b5e851a1`.
- SearchRegion: `sha256:c7065c614847781cb6c20456d43a3f69ac48520cc1fc11e5b35c010575198117` (references the new receptor digest).
- Input bundle: `sha256:6de4d67f190e5e07478c27610d25d3184610f75b3d0ae020c60c38c74c83aa9f`.

## Six-pose numerical equivalence

The previous and corrected per-pose direct/grid values, torsion result, source-pose and pose hashes, and boundary statuses compare exactly for all six rows. The new receptor and bundle identity digests differ as intended. Corrected machine-readable results are preserved in `replay/fullpose/results/`.

- E_inter MAE: `0.18378061689470737 kcal/mol`.
- RMSE: `0.20092119392847385 kcal/mol`.
- Maximum absolute error: `0.2901117728421321 kcal/mol`.
- Cutoff-stress absolute error: `0.02524701521328865 kcal/mol`.
- Direct/grid pairwise order reversals: `0` (no ties).
- Direct/grid orders are identical for this six-pose cohort.

These are fixture-bounded measurements, not a universal approximation threshold or production performance/accuracy claim.

## Other D3 dispositions

AT-0141, AT-0146 and AT-0204 are classified `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP` in the corrected test matrix under the owner-approved sequence reconciliation amendment. Their earlier Gate D3 labels are preserved as history and superseded for execution assignment. No test is falsely marked PASS. The accepted scope remains reference scoring/validation; no search, final-mode selection, or `DOCKING.RUN` capability is added.

Earlier HOLD evidence and its checksum manifest are unmodified. The updated continuation checksum manifest covers the corrected code, reports, replay states, tools and full-pose result files.
