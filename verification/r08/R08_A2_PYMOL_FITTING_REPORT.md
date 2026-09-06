# MOLEXPLORER R08 A2 — PyMOL Fitting Family

## Scope

A2 adds governed adapters for the PyMOL low-level fitting family on top of the A1 correspondence and rigid-fitting contract. Analysis is immutable and analysis-only unless a separate transform transaction is requested. Coordinate mutation is routed through the existing R07 `ScientificHistoryService` as `APPLY_RIGID_TRANSFORM`, so exact undo/redo remains on the R07 history line.

| Item | Value |
| --- | --- |
| A1 base | `3919f53` |
| R08 A2/A3 implementation commit | `398e1e6` |
| Profiles | `PYMOL_RMS_CUR_PROFILE`, `PYMOL_RMS_PROFILE`, `PYMOL_FIT_PROFILE`, `PYMOL_PAIR_FIT_PROFILE` |
| Transform convention | `x' = R x + t` |
| Oracle | `PYMOL_ORACLE = ORACLE_PENDING` |

## Command behavior

`rms_cur` computes current-coordinate RMSD with no fit and no mutation. `rms` computes proper best-fit RMSD with no mutation. `fit` and `pair_fit` first produce a full immutable analysis result; application is a separate guarded operation that checks the retained base revision and then commits through R07 history. The intra-state family materializes every state and rejects partial multi-state application. `align` and `super` use distinct sequence-guided profiles; `cealign` returns an explicit unsupported capability error rather than a fake alias.

The compatibility tuple preserves the seven PyMOL-facing values while the native result retains mapping, residuals, diagnostics, coverage, provenance, and dependency signatures.

## AT-R08-19..30 matrix

| Acceptance | Result | Evidence |
| --- | --- | --- |
| AT-R08-19 | PASS | `rms_cur` adapter returns current RMSD and does not mutate coordinates. |
| AT-R08-20 | PASS | `rms` adapter returns proper best-fit RMSD and preserves the native result. |
| AT-R08-21 | PASS | `fit` separates analysis from transform application. |
| AT-R08-22 | PASS | `pair_fit` requires explicit pairs and uses the explicit mapping profile. |
| AT-R08-23 | PASS | Fit application creates `APPLY_RIGID_TRANSFORM` through R07 history. |
| AT-R08-24 | PASS | Unit coverage verifies exact undo and redo of transformed coordinates. |
| AT-R08-25 | PASS | Intra current-RMS family materializes per-state results. |
| AT-R08-26 | PASS | Intra fitted-RMS family uses the same governed result contract. |
| AT-R08-27 | PASS | Intra-fit application requires every retained state and applies atomically with `ALL` scope. |
| AT-R08-28 | PASS | Missing state/coordinate and stale revision failures are structured and fail closed. |
| AT-R08-29 | PASS | Seven-value compatibility tuple is retained alongside the native result. |
| AT-R08-30 | PASS | Unsupported capability boundary is explicit for CE alignment; no plausible transform is returned. |

## Verification

- `apps/web/src/analysis/pymolFitting.test.ts` — PASS: 4/4
- R08 focused E2E — PASS: 4/4 per run, 3 consecutive runs
- Full E2E — PASS: 109/109
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm test` — PASS: web 126/126, API 22/22
- `npm run build` — PASS

## PyMOL source and oracle status

The pinned open-source source at commit `5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69` was inspected, including `modules/pymol/fitting.py`, `layer4/Cmd.cpp`, and `layer3/Executive.*`. No local PyMOL executable or importable PyMOL module was available. Therefore every implemented command remains `IMPLEMENTED_UNVERIFIED`, not `VERIFIED_REFERENCE_PROFILE` or `VERIFIED_PYMOL_CONFORMANCE`.

## Disposition

A2 is complete as a bounded, implementation-level PyMOL fitting family with an explicit unverified-oracle boundary. The transform path is R07-history-backed and is not a parallel undo system.
