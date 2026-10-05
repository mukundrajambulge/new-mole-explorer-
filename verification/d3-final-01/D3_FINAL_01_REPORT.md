# D3-FINAL-01 Final Review Report

**Disposition:** `D3 FINAL HOLD — MANDATORY ACCEPTANCE REQUIREMENT UNSATISFIED`

**Review date:** 2026-10-05
**Acceptance branch:** `release/d3-final-acceptance`
**Verified closure input:** `05cdb83fbcac71fb5cf3d53a19935b5b0a54f735`
**Closure base:** `783aa166d9d5790f798bff41444d6ba0fac7bd27`

## Decision basis

The scientific, preparation, replay, full-pose, resource, and cumulative-regression evidence from D3-CLOSURE-EXEC-01 was independently inspected. The six-pose 3DMX/BNZ direct-versus-grid evidence is acceptable only as fixture-bounded development evidence under the project owner's explicit authorization. It is not a general error or accuracy claim.

The final canonical Final Acceptance Specification still assigns AT-0058 to Gate D3. Its test requires a `PreparedReceptorState` identity change when typing/scoring dependencies change. The normative PHD-V2-03 prepared-state hash contract also includes downstream parameterization references. The current `sealPreparedReceptorState` payload hashes receptor identity, graph, chemical state, coordinates, assembly, model, chains, altloc, components, receptor profile, and site-critical atoms, but has no downstream typing/scoring reference fields. Those digests are instead included in `ScoringFieldDependencies` and the scoring-field identity. No later approved D3 amendment supersedes AT-0058, and the D3 closure traceability explicitly left it for final disposition.

This is a mandatory contract/evidence failure. Documentation cannot convert the separate scoring-field identity into `PreparedReceptorState` identity. No D3 production implementation was changed in this final lane. Accordingly, D3 cannot be accepted and D4 is not authorized.

## Evidence reviewed

- Canonical Drive master folder and latest Source of Truth, Roadmap, PHD-V2-00 through relevant PHD-V2-15 records, normalized requirements, Final Acceptance Specification and D1/D2/D3 decision evidence.
- Repository refs, ancestry, accepted tags, D3-TOR/D3-GRID implementation, D3-SCI-04 research preservation, protected PyMOL behavior, and closure commit contents.
- Sealed 3DMX/BNZ preparation and full-pose machine-readable outputs, including independent recomputation of per-pose term sums and E_inter error statistics.
- D3 resource report and measured maximum-field implementation output.
- Closure SHA-256 manifest, source-artifact bytes, final requirement/test/blocker traceability and code diff.

## Results that pass within their declared scope

- Preparation profile v1.1: all source/profile entries dispositioned; two pinned runs reproduced the same scientific payload digest; heavy-atom changes are zero; D2 state and SearchRegion digests replay-validated.
- Six same-state direct/grid poses are in-domain and retain five raw and weighted terms per pose. Recomputed E_inter MAE/RMSE equal the committed statistics exactly. The six-pose order has no ties or pairwise reversals.
- Maximum-field payload, construction, retained allocation, and process RSS are below the frozen limits.
- Existing workspace, native, protected PyMOL browser, typecheck, lint and build evidence passes. The final acceptance commit regression results are recorded after its exact SHA is created in `D3_FINAL_REGRESSION_REPORT.md`.
- The implementation diff after the closure base contains execution/evidence harness changes under `verification/d3-closure-exec-01/tools`; no `apps`, `packages` or `native` production code was changed in that closure.

## Final boundary

The binding failed item is `ME-DCK-V1-AT-0058 / ME-DCK-V1-REQ-0058`. Full disposition is in `D3_FINAL_REQUIREMENT_MATRIX.md`, `D3_FINAL_ACCEPTANCE_TEST_MATRIX.md`, and `D3_FINAL_BLOCKER_REGISTER.md`. `DOCKING.RUN` remains unavailable. No accepted D3 tag, D4 starting base, or canonical Drive status update is created under a HOLD disposition.
