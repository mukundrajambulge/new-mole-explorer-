# MOLEXPLORER R08 Implementation Closure Report

## R08 implementation status

`PASS — bounded R08 implementation complete; PyMOL executable conformance remains pending.`

| Item | Value |
| --- | --- |
| Base branch | `fix/manual-gate-03b-selection-focus-presentation` |
| Base SHA | `845291e0194904bdba91b8729991060578d90de4` |
| R07 user manual approval | `DEFERRED_BY_USER` |
| R07 technical status | `GREEN` |
| R08 branch | `feature/r08-structural-analysis` |
| R08 implementation tip | `c49547e` |
| R07 final approval | Pending; not falsely sealed |
| Main merge | Not performed |
| R09 | Not started |

## Phase status

| Phase | Status | Evidence |
| --- | --- | --- |
| A1 fixed correspondence / RMSD / Kabsch | PASS | `R08_A1_FIXED_CORRESPONDENCE_REPORT.md`; checkpoint `3919f53` |
| A2 PyMOL fitting family / transform history | PASS | `R08_A2_PYMOL_FITTING_REPORT.md`; implementation `398e1e6` |
| A3 structural alignment / workflow | PASS | `R08_A3_STRUCTURAL_ALIGNMENT_REPORT.md`; implementation `c49547e` |

## AT-R08 acceptance matrix

| Acceptance range | Result | Detail |
| --- | --- | --- |
| AT-R08-01..18 | 18/18 PASS | Fixed correspondence, proper Kabsch, degeneracy, mapping, state/context, immutability, staleness. |
| AT-R08-19..30 | 12/12 PASS | `rms_cur`, `rms`, `fit`, `pair_fit`, intra family, R07 transform transaction, explicit unsupported boundary. |
| AT-R08-31..40 | 10/10 PASS | Sequence mapping, residue expansion, refinement, seven-value align result, alignment object, distinct super, unsupported CE, governed UI. |
| Total | 40/40 PASS | Acceptance rows are detailed in the phase reports. |

## VIS-R08 matrix

| Acceptance | Result | Evidence / qualification |
| --- | --- | --- |
| VIS-R08-01 | PASS | Analyze-only RMS/fitting paths do not mutate coordinates; R08 E2E and unit tests pass. |
| VIS-R08-02 | PASS | Fit application is revision-guarded and commits only the designated mobile selection through R07 history. |
| VIS-R08-03 | BOUNDED PASS | Immutable alignment-object links are presented in the result panel; dedicated 3D pair-line projection is a known limitation. |
| VIS-R08-04 | BOUNDED PASS | Retained/rejected counts and pair-link retained flags are exposed; 3D styling is not yet projected. |
| VIS-R08-05 | PASS | Pair-link residuals are read from immutable `perPairResiduals`; no renderer recomputation is authoritative. |
| VIS-R08-06 | PASS | Intra-state results retain explicit state IDs and state-scoped analysis/application semantics. |
| VIS-R08-07 | PASS | CE guide mapping is not fabricated; unsupported CE produces no overlay/result. |
| VIS-R08-08 | PASS | Coordinate edit changes dependencies and marks the stored result `STALE`; browser test covers this path. |
| VIS-R08-09 | PASS | R07 history unit coverage verifies exact undo and redo of an applied fit. |
| VIS-R08-10 | PASS | Unsupported/invalid requests fail structurally and do not create a plausible transform. |

## PyMOL command capability matrix

| Command | Classification | Notes |
| --- | --- | --- |
| `rms_cur` | `IMPLEMENTED_UNVERIFIED` | Current RMSD; no coordinate mutation. |
| `rms` | `IMPLEMENTED_UNVERIFIED` | Proper best-fit RMSD; no coordinate mutation. |
| `fit` | `IMPLEMENTED_UNVERIFIED` | Analysis plus explicit R07 transform transaction. |
| `pair_fit` | `IMPLEMENTED_UNVERIFIED` | Explicit pair endpoints required. |
| `align` | `IMPLEMENTED_UNVERIFIED` | Sequence-guided bounded profile and seven-value tuple. |
| `super` | `IMPLEMENTED_UNVERIFIED` | Distinct bounded profile; not an alias. |
| `cealign` | `UNSUPPORTED` | No bounded CE guide algorithm is enabled; explicit structured error. |
| `intra_rms_cur` | `IMPLEMENTED_UNVERIFIED` | Per-state current RMSD. |
| `intra_rms` | `IMPLEMENTED_UNVERIFIED` | Per-state fitted RMSD. |
| `intra_fit` | `IMPLEMENTED_UNVERIFIED` | Atomic all-state application through R07 history. |
| `get_raw_alignment` | `SUPPORTED` | Returns retained stable pair relationships from an alignment object. |

`PYMOL_ORACLE = ORACLE_PENDING` and `VERIFIED_PYMOL_CONFORMANCE = NO`. The pinned source commit `5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69` was inspected, but no local executable or importable PyMOL runtime was available. No reference-profile claim is made.

## Verification gates

- Typecheck: PASS (`npm run typecheck`)
- Lint: PASS (`npm run lint`, zero warnings)
- Unit: PASS — web 126/126 and API 22/22, 148 total
- Build: PASS (`npm run build`; existing 3Dmol `eval` and bundle-size warnings only)
- R08 focused E2E: PASS — 4/4 on 3 consecutive runs, plus a post-presentation-change 4/4 run
- Full E2E: PASS — 109/109
- R07 regression: PASS — B1/B2/B3 history, topology, hydrogen, object, state, and undo/redo suites
- Gate 01 regression: PASS — viewer, performance, representation, and camera suites
- Gate 02 regression: PASS — camera/viewport/full-canvas/structure-integrity suite
- Gate 03B regression: PASS — selection focus/presentation suite
- RCSB-backed browser coverage: PASS in the clean full run
- Manual Codex browser validation: PASS by the deterministic live-browser campaign represented by the focused and full Playwright runs; no separate PyMOL executable oracle was available

## User-facing workflow

The Alignment panel exposes MOBILE and TARGET object/selection controls, method choices, mapping mode, transform mode, refinement cycles, alignment-object creation, explicit CE unsupported behavior, oracle-pending status, result disposition, RMSD values, pair counts, coverage, state IDs, determinant/uniqueness, and retained pair/residual presentation. Analysis and application are visibly separated; applied fitting is recorded through R07 history.

## Known limitations

1. No executable pinned PyMOL runtime was available; all PyMOL-family capabilities except `cealign` are `IMPLEMENTED_UNVERIFIED`.
2. `cealign` is intentionally unsupported and never aliases `align` or `super`.
3. `super` and `align` are bounded sequence-guided implementations and remain unverified against executable PyMOL behavior.
4. The effective-world coordinate context hook is implemented, while current workspace object transforms are identity; local scientific coordinates remain authoritative.
5. Alignment pair/residual information is available as immutable alignment-object/result data and a renderer-neutral result-panel presentation; dedicated 3D pair-line, retained-core, rejected-outlier, and residual-color overlays are not yet projected.
6. The UI exposes mapping/refinement controls and records the selected workflow intent, while the console adapter currently uses its method-specific request defaults for the actual scientific request; the durable service contract remains explicit and testable.
7. No independent Biopython/D1 numerical oracle was run; deterministic analytic/native tests are the recorded numerical validation.
8. `work/pymol-source` was a temporary source-inspection checkout and is not part of the deliverable or commit history.

## Disposition

`USER R08 RETEST = READY`

`READY FOR R09 = NO`

`READY TO MERGE MAIN = NO`

The branch is the verified R08 candidate, but the deferred R07 Gate 03B manual approval remains visible debt and no main merge is authorized. STOP.
