# MOLEXPLORER R08 A3 — Structural Alignment and User Workflow

## Scope

A3 adds deterministic sequence-guided residue mapping, residue-to-atom expansion, refinement bookkeeping, seven-value `align` compatibility output, alignment objects/raw-pair access, distinct `super` capability metadata, explicit unsupported `cealign`, and the governed user-facing alignment workflow.

The UI labels MOBILE and TARGET separately, exposes object/selection/method/mapping/transform/refinement/alignment-object controls, shows `ORACLE PENDING`, and presents scientifically meaningful result fields. Apply operations remain revision-guarded and use the R07 history service. Scientific results are immutable; a later coordinate edit marks them stale.

## AT-R08-31..40 matrix

| Acceptance | Result | Evidence / boundary |
| --- | --- | --- |
| AT-R08-31 | PASS | Sequence-guided mapping is materialized independently of fitting. |
| AT-R08-32 | PASS | Residue-to-atom expansion records missing-atom coverage and retained pair count. |
| AT-R08-33 | PASS | Refinement history records cycles, retained/rejected pairs, and residuals. |
| AT-R08-34 | PASS | Outlier/core collapse returns `OUTLIER_REJECTION_INSUFFICIENT_CORE`; no fake result. |
| AT-R08-35 | PASS | `align` exposes the seven compatibility fields plus the native immutable result. |
| AT-R08-36 | PASS | Zero refinement cycles do not perform structural rejection. |
| AT-R08-37 | PASS | `AlignmentObject` reproduces retained stable pair relationships; raw pairs are retrievable. |
| AT-R08-38 | PASS | `super` has its own profile and default bounded refinement policy; it is not an alias. |
| AT-R08-39 | PASS | `cealign` is explicitly `UNSUPPORTED_CAPABILITY` because the bounded CE guide algorithm is absent. |
| AT-R08-40 | PASS | UI blocks unsupported CE execution, labels the oracle pending, and records no fake result. |

## Command capability matrix

| Command | Capability | Oracle status |
| --- | --- | --- |
| `rms_cur` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `rms` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `fit` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `pair_fit` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `align` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `super` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `cealign` | `UNSUPPORTED` | Not claimed |
| `intra_rms_cur` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `intra_rms` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `intra_fit` | `IMPLEMENTED_UNVERIFIED` | `ORACLE_PENDING` |
| `get_raw_alignment` | `SUPPORTED` | Native alignment-object contract |

## Visual and workflow evidence

The full browser suite exercises the live alignment workflow and R07 regression surface. Deterministic R08 evidence is under `verification/evidence/r08/ui/`:

`01-rms-current-result.png`, `02-rms-fit-result.png`, `03-fit-apply-before.png`, `04-fit-apply-after.png`, `05-fit-undo.png`, `06-fit-redo.png`, `07-pair-fit.png`, `08-align-before.png`, `09-align-after.png`, `10-align-result-panel.png`, `11-refinement-rejected-pairs.png`, `12-alignment-object.png`, `13-multi-state-analysis.png`, `14-stale-result.png`, `15-unsupported-super.png`, and `16-unsupported-ce.png`.

The result panel is renderer-neutral and does not make presentation state authoritative. Pair/residual graphics are not yet projected into the 3D renderer; the authoritative pair records and residual values are present in the immutable alignment object/result. This is a deliberate bounded limitation, not a claim of full renderer overlay conformance.

## Disposition

A3 is complete as the bounded structural-alignment program authorized by the research contract. `super` is implemented but unverified against an executable PyMOL oracle. `cealign` is truthfully unsupported. No R09 persistence or docking work was started.
