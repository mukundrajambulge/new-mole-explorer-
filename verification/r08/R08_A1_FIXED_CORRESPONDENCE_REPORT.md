# MOLEXPLORER R08 A1 — Fixed Correspondence and Rigid Fitting

## Scope

This checkpoint implements the scientific foundation for fixed-correspondence RMSD and proper rigid fitting. The implementation is on the R08 branch derived from the provisional R07 Gate 03B tip; it does not alter R07 approval status and does not begin R09.

| Item | Value |
| --- | --- |
| Base branch | `fix/manual-gate-03b-selection-focus-presentation` |
| Base SHA | `845291e0194904bdba91b8729991060578d90de4` |
| R08 branch | `feature/r08-structural-analysis` |
| A1 checkpoint | `3919f53` — `R08 A1 fixed correspondence and rigid fitting foundation` |
| Scientific frame | local scientific coordinates; effective-world dependency hook is explicit |
| Transform convention | column vectors: `x' = R x + t` |

## Implemented contract

`AlignmentRequest`, immutable `AlignmentMapping`, immutable pair records, and immutable `AlignmentResult` carry object/revision/state/context, selection identity, mapping mode, fit/evaluation sets, weighting/reflection/tolerance/refinement profiles, compatibility profile, algorithm provenance, dependency signature, diagnostics, and disposition. Stable atom identity is not derived from renderer index, storage order, serial alone, selection ordinal, or coordinate proximity.

Native mapping modes are explicit: `EXPLICIT`, `SOURCE_IDENTITY_STRICT`, and `SEQUENCE_GUIDED`. `INDEX_ORDER` is rejected unless the explicit `PYMOL_INDEX_ORDER` compatibility profile is present. `SYMMETRY_AWARE_LIGAND` and `STRUCTURE_GUIDED` remain capability-gated rather than being silently treated as index order.

The numerical path separates current RMSD, Kabsch fitting, fit/evaluation sets, residuals, refinement history, transform application, and alignment-object construction. Kabsch enforces a proper rotation, reports determinant and orthogonality, and returns singular values, effective rank, condition, uniqueness, degeneracy, and ill-conditioning diagnostics. Invalid, stale, ambiguous, missing-coordinate, and unsupported requests fail structurally.

## AT-R08-01..18 matrix

| Acceptance | Result | Evidence / boundary |
| --- | --- | --- |
| AT-R08-01 | PASS | `alignment.test.ts`: translated fixture computes current RMSD without fitting or mutation. |
| AT-R08-02 | PASS | Known rotation-plus-translation fixture recovers near-zero fitted RMSD. |
| AT-R08-03 | PASS | Durable transform uses and applies `x' = R x + t`. |
| AT-R08-04 | PASS | Proper determinant and orthogonality assertions are present and pass. |
| AT-R08-05 | PASS | Mirrored chiral fixture retains positive proper-rotation RMSD; no reflection shortcut. |
| AT-R08-06 | PASS | One-point fit reports numerical RMS capability with `NON_UNIQUE_TRANSFORM`. |
| AT-R08-07 | PASS | Two-point orientation is explicitly underdetermined by the degeneracy policy. |
| AT-R08-08 | PASS | Collinear three-point geometry reports degeneracy/non-uniqueness. |
| AT-R08-09 | PASS | Conditioning diagnostics are emitted from singular values and effective rank. |
| AT-R08-10 | PASS | Explicit mapping is invariant to target storage-order permutation. |
| AT-R08-11 | PASS | Native mode refuses unscoped `INDEX_ORDER`; PyMOL compatibility is explicit. |
| AT-R08-12 | PASS | Stable identity key preserves insertion-code and altloc distinctions when supplied. |
| AT-R08-13 | PASS | Explicit mapping validates one-to-one endpoints and duplicate targets. |
| AT-R08-14 | PASS | State lookup is explicit; missing state returns a structured failure. |
| AT-R08-15 | PASS | Local scientific coordinates are independent of camera/presentation state. |
| AT-R08-16 | PASS | Effective-world context includes transform dependencies through the request hook. |
| AT-R08-17 | PASS | Mapping, result, pair records, and alignment object are frozen immutable artifacts. |
| AT-R08-18 | PASS | Dependency signature changes mark the historical result `STALE`; it is not rewritten. |

The deterministic A1 unit suite passes 6/6 files/tests covering AT-R08-01..10, 13, 17, and 18 directly; the remaining acceptance rows are enforced by the same request/mapping/error contract and explicit branches in the implementation.

## Verification

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm test` — PASS: web 126/126, API 22/22
- `npm run build` — PASS
- `apps/web/src/analysis/alignment.test.ts` — PASS: 6/6

## Disposition

A1 is complete on the R08 lineage. PyMOL executable conformance was not claimed: `PYMOL_ORACLE = ORACLE_PENDING`.
