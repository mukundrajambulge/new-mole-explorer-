# Final D3 Regression Report

## Final-lane results

The final acceptance lane installed the locked workspace dependencies with `npm ci` (248 packages). The following checks were rerun after the evidence package was committed, with no source or dependency changes in the package commit. Final raw command outputs and machine-readable rerun results are kept in the local ignored directory `verification/d3-final-01/runtime_logs/`; `FINAL_TESTED_SHA.txt` there records the exact tested branch `HEAD` reported at signoff. These raw local logs are supplemental execution artifacts; the committed source/profile/result evidence remains under `verification/d3-closure-exec-01/`.

| Suite | Result |
|---|---|
| Workspace tests | PASS — web 34 files / 156 tests; API 13 files / 98 tests; total 47 files / 254 tests. Includes D1 contracts (14), D2 preparation (11), and D3-TOR (8). |
| D3-GRID contract | PASS — 1 file / 5 tests. |
| Native CMake/CTest | PASS — 2/2 targets from a clean build configured against this acceptance worktree: direct scorer and scoring field. |
| Typecheck | PASS across API, app, web and contracts. |
| Lint | PASS across API, app, web and contracts. |
| Production build | PASS across workspaces. Existing 3Dmol.js `eval` and >500 kB bundle warnings remain. |
| Protected PyMOL browser suite | PASS — Playwright 3/3 tests. |
| Protected screenshot hashes | PASS — 40/40 matched after restoring the two browser-test-generated screenshots to their checked-in bytes. |
| Preparation/profile | PASS — two fresh pinned CPython 3.13.16 / RDKit 2026.03.6 hydrogen-only runs, with `LANG=C.UTF-8`, `LC_ALL=C`, `PYTHONHASHSEED=0`, and `TZ=UTC`; both returned payload SHA-256 `212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f`. The pre-chemistry completeness evidence remains hash-checked: 164/164 residues, 51/51 state-sensitive side chains, both termini and 418/418 component occurrences. |
| Preparation/D2 replay | PASS — replay validator recomputed the canonical payload, source-heavy-atom identity, state seals and SearchRegion links; heavy-atom additions, deletions, remappings, identity changes and coordinate-bit changes are zero. |
| Full-pose direct/grid validation | PASS — rebuilt runner consumed the sealed 3DMX/BNZ bundle and emitted six `SEALED_STATES` fixture poses against the same receptor (`cc8556…c2a06`), ligand (`65e8b0…51a1`) and SearchRegion (`690c20…f1f2d`) digests. All six are in-domain; no fallback, clamping or extrapolation. The rerun reproduces E_inter MAE `0.1837806169`, RMSE `0.2009211939`, max absolute error `0.2901117728 kcal/mol`, cutoff-stress absolute error `0.0252470152 kcal/mol`, and zero order reversals. |

The native exact-cutoff, scoring-field interpolation/derivative, failure-path, channel mapping and serialization tests are covered by the native test targets and D3-GRID contract. Preparation, replay and full-pose outputs were written to task-local storage for this rerun; the frozen source, input, run and result evidence remains under `verification/d3-closure-exec-01/`.

Recorded final-HEAD commands: `npm test`; `npx vitest run verification/d3-grid/scoring-field-contract.test.ts`; `npm run typecheck`; `npm run lint`; `npm run build`; `npm run test:e2e -- tests/e2e/final-pymol-acceptance.spec.ts`; clean CMake configure/build/CTest for `native/docking-reference/scoring`; clean CMake configure/build plus `tools/full_pose_compare.py` on the sealed input bundle; two pinned `prepare_3dmx_bnz_hydrogens.py` runs; and `verify_preparation_replay.py`. Per-command stdout/stderr files and the 40/40 screenshot hash comparison are named in the local runtime directory.

## Dependency and build advisories

`npm audit` on the unchanged lockfile reports six existing advisories: three moderate, two high and one critical. The critical finding is in the Vitest dependency path and the suggested fix requires a major version upgrade; Vite and transitive packages also appear in the audit paths. No dependency manifest or lockfile was changed in the D3 closure or final acceptance lane. These existing development/build advisories are recorded as deferred technical debt under the current Roadmap; no D3 policy found in the canonical sources makes them a D3 release blocker. No unrelated dependency upgrade was applied.

## Inherited closure results

The immediate closure commit `05cdb83fbcac71fb5cf3d53a19935b5b0a54f735` separately records the following cumulative regression evidence:

| Suite | Result |
|---|---|
| Workspace tests | 254 passed across 47 files. |
| D3-GRID contract | 5/5 passed. |
| Native scorer + scoring-field CTest | 2/2 passed on WSL2 Ubuntu 24.04.5 / GCC 13.3.0. |
| Preparation, profile completeness and D2 seals | PASS; two identical canonical payloads, full source/profile accounting, heavy-atom invariants, and replay. |
| Full-pose harness | PASS; five synthetic controls and six sealed fixture poses with 30 weighted/raw term rows. |
| Protected PyMOL browser and screenshot evidence | 3/3 passed; 40/40 protected hashes matched/restored. |
| Typecheck / lint / production build | PASS. |

The closure records its full runtime logs under `verification/d3-closure-exec-01/runtime_logs/`. The separate pinned executable PyMOL oracle and a new manual user retest are not claimed; they remain under existing PyMOL governance and are not newly imposed as D3 prerequisites.

## Final disposition boundary

These passing regressions do not satisfy `ME-DCK-V1-AT-0058 / ME-DCK-V1-REQ-0058`. Existing replay validates the supplied state, but there is no cross-dependency sensitivity test showing that changing downstream typing/scoring references changes `PreparedReceptorState` identity. D3 remains HOLD, no accepted-D3 tag is created, D4 is not authorized, and `DOCKING.RUN` remains unavailable.
