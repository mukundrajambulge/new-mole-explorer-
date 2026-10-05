# Definitive D3-FINAL-01 Decision

## Decision

`D3 FINAL HOLD — MANDATORY ACCEPTANCE REQUIREMENT UNSATISFIED`

## Failed mandatory item

- **Acceptance test:** `ME-DCK-V1-AT-0058` (Gate D3)
- **Requirement:** `ME-DCK-V1-REQ-0058`
- **Requirement:** changing assembly, model, chain set, altloc, chemical microstate, active hydrogen set, retained components, typing/scoring dependencies, or scientifically active coordinates changes `PreparedReceptorState` identity.
- **Evidence:** `apps/api/src/docking/d2Preparation.ts:128-150` constructs the prepared-receptor digest from the receptor/graph/chemical/coordinate digests and explicit receptor selections/profile. The payload has no downstream typing/scoring dependency references. The corresponding contract at `packages/contracts/src/docking/d2.ts:188-205` has no such fields. By comparison, `native/docking-reference/scoring/include/mole/docking/scoring_field.hpp:103-112` places receptor typing assignment, scoring profile, and typing profile in `ScoringFieldDependencies`; `scoring_field.cpp:839-860` includes them in the separate logical field identity.
- **Disposition:** `FAILED`. The required identity boundary is absent in the prepared-state implementation and no cross-dependency identity test or later owner-approved amendment was found.

## Verified D3 closure input

`05cdb83fbcac71fb5cf3d53a19935b5b0a54f735` is the requested closure commit, on local branch `codex/d3-closure-profile-correction`, based on `783aa166d9d5790f798bff41444d6ba0fac7bd27`. It is a descendant of fetched `new-origin/main` (`c219d5fcfcbe71537fb8e0139cdef495a9f1f504`) and is not contained in any fetched remote branch. D1/D2 accepted tags and the preserved D3-TOR/D3-GRID history are ancestors. The separate D3-SCI-04 research commit `6769f00cbfd4486a86c7512030b4cf942a9244a8` is remote-preserved but is not an ancestor; it remains research evidence.

The final disposition package is sealed on local branch `release/d3-final-acceptance`. The exact final tested commit SHA is reported with the signoff; detailed suite counts and results are in `D3_FINAL_REGRESSION_REPORT.md`.

## Consequences

- D3 is not accepted.
- D4 is not authorized; no `D4_STARTING_BASE_SHA` is defined.
- No accepted-D3 annotated tag is created.
- The canonical Google Docs Source of Truth and Roadmap are not updated to an accepted status.
- `DOCKING.RUN` remains unavailable.
- This is the definitive D3 disposition. No additional D3 micro-gate is proposed.
