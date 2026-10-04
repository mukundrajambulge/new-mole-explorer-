# D3-CLOSURE-EXEC-01 Final Closure Run

Completion date: 2026-10-05
Branch: `codex/d3-closure-profile-correction`
Base commit: `783aa166d9d5790f798bff41444d6ba0fac7bd27`
Scope: the D3-CLOSURE-EXEC-01 package only; isolated managed worktree.

## Profile and preparation

The approved source/profile reconciliation resolved only ASN68, ASP72, and ARG76 by selecting each uniquely highest-occupancy, coherent A conformer. No atom-name swap, side-chain flip, coordinate modification, or unlisted source atom/state was introduced. ASN68 remains neutral CCD Asn; ASP72 remains deprotonated; ARG76 remains protonated. Preparation profile v1.0 is retained historically and the completeness correction is v1.1 (`ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1`).

The source-only validator passed 164/164 polymer residues, 51/51 state-sensitive side chains, both termini, and all 418 source component occurrences. Pinned source hashes and the 164-row completeness matrix are recorded in the package. The pinned Linux x86-64 runtime is CPython 3.13.16 with RDKit 2026.03.6 under the recorded deterministic environment.

Two preparation runs and independent replay validation passed with the same canonical prepared scientific payload SHA-256 `212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f`. The receptor has 1,306 heavy atoms and 1,330 hydrogens; BNZ has 6 heavy atoms and 6 hydrogens. Heavy-atom additions, deletions, remappings, heavy-heavy bond changes, and coordinate changes are all zero. Hydrogen-parent provenance and run outputs are preserved beside each prepared state.

## D2 seals and full-pose fixture evidence

The prepared receptor, prepared ligand, and SearchRegion are sealed and independently replay-validated. All six deterministic full-pose cohort members are in-domain; no fallback, clamping, or extrapolation was used. The fixed SearchRegion contains 2,420 nodes (11 x 22 x 10), and the sealed full-pose input digest is `sha256:5c5ce05dfe5c1694ad30e72d4f247a4861e9d3d54fb5b9d4d8dd23e4e879939d`.

For six poses, grid-minus-direct E_inter had signed bias 0.1753649452 kcal/mol, MAE 0.1837806170, RMSE 0.2009211939, p95 absolute error 0.2738164993, and maximum absolute error 0.2901117728. Direct and grid order matched with zero ties and zero pairwise reversals. The one-pose cutoff stress case placed the nominated pair at 7.999999999999998 Å and measured an absolute E_inter difference of 0.0252470152 kcal/mol. This is a bounded fixture result; no approved scientific approximation or ranking threshold was supplied, and no general error bound is claimed.

## Regression and protected evidence

The cumulative regression passed: `npm test` (47 files, 254 tests), D3-GRID scoring-field contract (5/5), native CTest (2/2), native full-pose comparator synthetic smoke (5 control poses), fixture full-pose comparison (6 poses), typecheck, lint, and build. The protected PyMOL browser suite passed 3/3. All 40 protected screenshot hashes were captured before the run; two generated screenshots were restored, and the post-restoration comparison found zero mismatches. The separate pinned PyMOL executable oracle and manual user retest are not claimed.

## Closure

D3-CLOSURE-EXEC-01 PASS — PREPARED FIXTURE SEALED AND FULL-POSE D3 EVIDENCE COMPLETE; READY FOR FINAL D3 ACCEPTANCE

The evidence-backed recommendation for D3-FINAL-01 is to review the six-pose per-term distributions, zero pairwise reversals, and single-pose cutoff stress result as fixture-bounded evidence. Any numerical acceptance criterion remains for the final D3 decision; none is inferred here.
