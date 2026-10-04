# D3-FINAL-01 handoff

**Status: READY FOR FINAL D3 ACCEPTANCE.** D3-CLOSURE-EXEC-01 completed the authorized profile correction, preparation, replay, D2 state sealing, SearchRegion validation, full-pose direct/grid comparison, and cumulative regression in this same package.

## Profile and preparation

Profile v1.1 supersedes v1.0 only for the authorized 3DMX/BNZ development fixture. It selects coherent A plus common atoms at ASN68, ASP72, and ARG76. ASN68 retains neutral CCD amide chemistry; ASP72 remains the AUTH04 deprotonated state; ARG76 remains the AUTH04 protonated state. No side-chain flips or heavy-atom coordinate edits occurred. The source-only completeness validator reconciled all 164 residues, all 51 state-sensitive side chains, five exact altloc groups, both termini, and 418 components before RDKit import.

The Linux x86-64 WSL2 runtime successfully imported CPython 3.13.16 and RDKit 2026.03.6. Exact source hashes are 3DMX e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef and BNZ 01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61. Two controlled-environment runs generated identical canonical payloads, sha256:212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f. All heavy-atom invariants passed.

Prepared receptor, prepared ligand, receptor/ligand coordinate-state, and SearchRegion digests are recorded in D2_SEALED_STATE_SUMMARY.json. Independent D2 canonical digest recomputation passed every check. The profile-aware envelopes are separate D3 objects and do not change D2 V1 digests.

## Full-pose result

Six deterministic SEALED_STATES poses traversed direct and grid scoring from the same state/profile input. All six are IN_DOMAIN. E_inter error statistics are in FULLPOSE_ERROR_STATISTICS.md and fullpose/results/FULLPOSE_ERROR_STATISTICS.json: MAE 0.1837806169, RMSE 0.2009211939, p50 0.2004688330, p95 0.2738164993, p99 0.2868527181, maximum absolute error 0.2901117728 kcal/mol. The n=1 cutoff-stress error is 0.0252470152 kcal/mol. Direct and grid orders match with no ties or reversals.

The current canonical D3 materials do not approve a direct-versus-grid scientific-error or rank-reversal threshold. Recommendation for D3-FINAL-01: carry forward the complete measured term distributions and cohort boundaries as the fixture baseline; note the identical ordering and the limited n=1 cutoff subset; make any final acceptance decision against an already approved criterion, if one exists in the final acceptance materials. Do not reinterpret backend-equivalence tolerances as this criterion and do not create a new intermediate gate.

## Regression

The workspace suite passed 254 tests across 47 files; the D3-GRID contract test passed 5/5; native scorer/field CTest passed 2/2; the protected PyMOL browser suite passed 3/3 with all 40 protected screenshot hashes restored; typecheck, lint, and build passed. Detailed current results appear in CUMULATIVE_REGRESSION_REPORT.md.

**The only remaining D3 prompt is D3-FINAL-01.** D4 remains blocked and DOCKING.RUN remains unavailable.
