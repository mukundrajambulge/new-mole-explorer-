# Roadmap Amendment Record — D3-FINAL-01 Closure

**Effective date:** 2026-10-05
**Approver:** Project owner, through the explicit instruction in the current D3-FINAL-01 continuation request.
**Change type:** owner-approved execution-sequence reconciliation and D3 status update.

## Reason and source conflict

The Final Docking Acceptance Specification v1.0 with appended amendments labels AT-0141, AT-0146 and AT-0204 `Gate D3`. The current Execution Roadmap places Q-score/tie and final-mode semantics in D5 (“D5 Pose and Result Semantics”), broader replay/numerical-equivalence work in D6 (“D6 Provenance Replay and Numerical Equivalence”), and D3 out of scope for global search, pose generation, final clustering, and ranking. PHD-V2-15 gives the corresponding D3/D5/D6 sequence. The Normalized Requirements define requirement semantics and thresholds but do not supply a conflicting execution sequence.

Roadmap §1.3 requires a documented owner-approved reconciliation when authorities disagree. The project owner's current instruction explicitly requires choosing, for each of these IDs, either `MANDATORY_IN_D3` or `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`, and instructs that deferred rows cite the controlling authority. This amendment records that decision and resolves the previous source conflict for execution sequencing and this D3 disposition.

## Approved disposition

| Test | Superseded earlier label | Controlling assignment after this amendment |
|---|---|---|
| AT-0141 | Final Acceptance Specification: Gate D3 | D5 — Q-score quantization, tie, and result semantics. `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`. |
| AT-0146 | Final Acceptance Specification: Gate D3 | D5 — final mode selection after D4 search. `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`. |
| AT-0204 | Final Acceptance Specification: Gate D3 | D5 for Q-score/discrete-result semantics and D6 for numerical-equivalence/replay criteria. As a compound test, it is `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`. |

These tests remain valid requirements and retain all normalized criteria. They are not D3 passes and must close in their assigned later gates. Their prior Gate D3 labels are retained as historical source text but are superseded for execution order and D3 final disposition by this owner-approved amendment. No numerical threshold or scientific profile is changed.

## D3 acceptance and dependent effects

The corrected REQ-0058 / AT-0058 implementation and evidence close the mandatory remaining D3 blocker. D3 is accepted; D4 is authorized to begin on the exact tested baseline recorded by the final D3 signoff. D4 authorization does not enable production execution. `DOCKING.RUN` remains unavailable pending a later explicit execution gate.

Affected records: the current status in this Roadmap and the Global Master Plan / Source of Truth; corrected D3 requirement/test/blocker matrices and decision under `verification/d3-final-01/req0058/`. Historical HOLD material and the previous Final Acceptance Specification labels are preserved.

## Amendment control record (Roadmap §2.2)

- **Affected acceptance:** `ME-DCK-V1-REQ-0058 / ME-DCK-V1-AT-0058` closes the prior mandatory D3 HOLD; the execution assignments for `AT-0141`, `AT-0146`, and `AT-0204` are reconciled as listed above.
- **Reason:** the Final Acceptance Specification's earlier Gate D3 labels conflict with the current Roadmap and PHD-V2-15 execution sequence for result semantics and numerical equivalence. The owner expressly required an exact D3-vs-later disposition for each test. The prior receptor-state identity also failed REQ-0058 by omitting explicit typing/scoring dependency identities.
- **Before → after:** before, the three tests carried Gate D3 labels in the Final Acceptance Specification with later D5/D6 assignments in the Roadmap, and the prepared-receptor V1 digest did not bind chemistry/typing/scorer profile references. After, the tests have the owner-approved D5/D6 execution assignments without changing their acceptance criteria; the receptor state uses schema V2 and hashes explicit chemistry, typing, and scorer profile IDs and SHA-256 digests. The global D2 envelope stays schema V1.
- **Affected gates and claims:** D3 closure and the D4 starting baseline are affected. AT-0141/0146/0204 are not D3 passes. The amendment adds no global search, pose generation, final clustering/ranking, affinity/free-energy/probability claim, or production execution capability. `DOCKING.RUN` remains unavailable.
- **Migration and compatibility:** prior V1 receptor states remain historical/incomplete for the corrected identity contract and cannot be treated as complete V2 states. Any future use must explicitly reseal/replay under V2 with all three profile references; no implicit scorer/global/environment fallback is allowed. The D1 artifacts, unrelated D2 artifacts, and global D2 envelope are not migrated or reinterpreted. The sealed molecular coordinates, chemical state, and scoring outputs are unchanged by this identity-only correction.
- **Added acceptance checks:** AT-0058 checks same-input deterministic canonical-CBOR replay; changed chemistry, typing, and scorer dependency identities; scorer-ID sensitivity with unchanged digest bytes; missing/blank/malformed reference rejection; and receptor/scoring-field reference consistency. Focused D2 preparation coverage is 13 tests. The existing sealed 3DMX/BNZ replay and six-pose direct/grid comparison are repeated; their six values, ordering, cutoff stress, and preparation invariants are compared with the preserved evidence.
- **Requalification scope:** after the final acceptance commit, rerun the focused AT-0058/PreparedReceptorState tests, workspace suite, D3-GRID, native CTest, typecheck, lint, production build, protected PyMOL browser tests, protected screenshot hash verification, pinned preparation replay, corrected D2 seal replay, and the full-pose six-pose plus synthetic-smoke checks. Record branch, exact commit SHA, tag target, commands, counts, and results in task-local `runtime_logs/REQ0058_FINAL_TESTED_SHA.txt`; independently verify that record and the continuation checksum manifest. No fixture discovery or scientific parameter changes are included.
- **Version/tag:** the reconciled D3 release record is `D3-FINAL-01`; the planned annotated acceptance tag is `mole-explorer-docking-d3-accepted-2026-10-05`, subject to repository convention verification. It will point to the exact commit that receives the complete post-commit requalification. The accepted SHA and tag are written to the canonical Roadmap and Source of Truth after verification.
- **Approver and preserved evidence:** project owner, via explicit instruction in the current continuation request dated 2026-10-05. Preserve the original HOLD report, its original checksum manifest, all prior evidence, and the predecessor commit; record the correction as a new acceptance commit/tag.
