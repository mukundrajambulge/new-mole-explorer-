# D3-FINAL-01 Corrected Closure Summary

## Decision

`D3 ACCEPTED — D4 AUTHORIZED` after resolving `ME-DCK-V1-REQ-0058 / ME-DCK-V1-AT-0058` and recording the owner-approved AT-0141/0146/0204 sequence reconciliation. The earlier HOLD package and checksum record are preserved unchanged.

## Identity repair

PreparedReceptorState V2 explicitly stores and hashes chemical-perception, receptor atom-typing, and scorer profile IDs and digests. Deterministic canonical-CBOR replay passes; changed dependency identity changes the prepared-receptor digest; missing/malformed references and mismatched scoring-field dependencies fail closed. The receptor digest transitions from old incomplete `sha256:cc8556b9e66fc8baedcff42ac72a56da5ac18cedd2f65a065054e667366c2a06` to complete `sha256:226761376a4fbb3d361d3fe6b4e677f53986e2c36cc4f4ca0d4dc0ef34dbe76d`. Ligand identity remains unchanged.

## Scientific and regression evidence

The 3DMX/BNZ replay retains the validated molecular state, with zero heavy-atom additions/deletions/remappings, bond changes, or coordinate-bit changes. The six-pose direct/grid values compare exactly with the prior evidence. E_inter MAE is `0.18378061689470737 kcal/mol`; RMSE `0.20092119392847385`; maximum absolute error `0.2901117728421321`; cutoff-stress absolute error `0.02524701521328865`; pairwise order reversals `0`.

Regression passes: workspace tests 47 files / 256 tests; D3-GRID 5/5; native CTest 2/2; protected PyMOL 3/3 and screenshot SHA-256 40/40; typecheck, lint, build, preparation replay, D2 seal replay, focused AT-0058, synthetic full-pose smoke and six-pose validation. Final exact-SHA commands and results are identified in `D3_FINAL_REGRESSION_REPORT_CORRECTED.md` and local runtime record `runtime_logs/REQ0058_FINAL_TESTED_SHA.txt`.

## Gate assignments and limits

AT-0141 and AT-0146 are D5; AT-0204 is D5/D6 by the owner-approved amendment in `ROADMAP_AMENDMENT_D3_FINAL_01.md`. Their old Final Acceptance Specification Gate D3 labels remain preserved as history and are superseded for execution sequencing and this D3 disposition. No search, final-mode selection, qualification, affinity claim, or production execution is included. `DOCKING.RUN` remains unavailable.

Predecessor: `6bcaefc5290fadefd9d3bb9ecce2c641f1a0dcad`, branch `release/d3-final-acceptance`. Exact final tested SHA, tag and final clean-worktree state are in the task-local acceptance signoff and canonical Source of Truth/Roadmap records.
