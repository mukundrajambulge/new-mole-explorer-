# Final D3-FINAL-01 Decision

## Decision

# `D3 ACCEPTED — D4 AUTHORIZED`

## Mandatory gate disposition

`ME-DCK-V1-REQ-0058 / ME-DCK-V1-AT-0058` is `SATISFIED`. PreparedReceptorState V2 directly binds the required explicit chemistry, receptor-typing and scoring profile identities into canonical-CBOR state identity. Same-dependency replay is deterministic; changed dependency references change identity; missing/malformed references and shared scoring-field dependency mismatches fail closed. Corrected 3DMX/BNZ replay and six-pose numerical evidence preserve the prior validated molecular state and energy results.

The complete corrected requirement/test matrices and blocker disposition are adjacent. The prior HOLD is retained unchanged as historical provenance and is superseded by this final decision.

## Deferred requirement tests

AT-0141, AT-0146 and AT-0204 are each classified `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP` under the project owner's explicit sequence reconciliation recorded in the Roadmap and Source of Truth. This amendment supersedes the earlier Final Acceptance Specification Gate D3 labels for execution sequencing and this D3 disposition; the original labels are preserved as history. The tests remain requirements and are not claimed complete in D3.

## Acceptance boundary

D3 accepts the frozen reference scorer, profile, field, fixture-bounded numerical evidence, and corrected prepared-state identity contract. It does not claim global search, result-mode selection, docking validation, affinity, or production `DOCKING.RUN` availability. D4 is authorized to begin from the exact tested acceptance baseline; no D4 implementation was added here.

**Predecessor:** `6bcaefc5290fadefd9d3bb9ecce2c641f1a0dcad`
**Branch:** `release/d3-final-acceptance`
**Final tested SHA and annotated tag:** recorded in local ignored `runtime_logs/REQ0058_FINAL_TESTED_SHA.txt` and in the canonical Source of Truth/Roadmap update after final verification.

`DOCKING.RUN remains unavailable.`
