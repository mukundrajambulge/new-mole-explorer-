# REQ-0058 / AT-0058 Acceptance Test Report

**Disposition:** `SATISFIED`

## Exact acceptance property

The tested statement is the normalized `ME-DCK-V1-REQ-0058` text quoted in `PREPARED_RECEPTOR_IDENTITY_CONTRACT.md`: changes to assembly, model, chain set, altloc, chemical microstate, active hydrogen set, retained components, typing/scoring dependencies, or scientifically active coordinates SHALL change PreparedReceptorState identity.

The Final Acceptance Specification defines `ME-DCK-V1-AT-0058` as a Level 1 reference-implementation test of that property, Gate D3.

## Focused evidence

The test `ME-DCK-V1-AT-0058 hashes explicit receptor typing/scoring dependency references and rejects mismatches` in `apps/api/src/docking/d2Preparation.test.ts` demonstrates:

1. same molecular inputs and same explicit dependency references replay to the same digest;
2. the sealed V2 state and canonical CBOR serialization contain all profile IDs and profile digests;
3. changing chemistry, receptor-typing, or scoring profile digest changes the receptor-state digest; changing a scoring profile ID while keeping its digest fixed also changes state identity;
4. an absent reference or malformed/blank reference returns `INVALID` with no state value;
5. matching receptor/scoring-field shared dependencies are admitted; chemistry, receptor-typing, and scorer digest mismatches are each rejected.

The existing sealing payload continues to include the contract's assembly/model/chain/altloc/component, chemical-state, coordinate-state and graph identity inputs. Preparation replay evidence separately confirms those inputs and source atoms are unchanged for the frozen fixture.

## Results

- Targeted API test file: PASS, 13 tests.
- Workspace suite after correction: PASS, 47 files / 256 tests.
- Independent canonical-CBOR state digest replay: PASS for the corrected receptor, ligand, and SearchRegion states.
- Six-pose reference/grid validation on corrected state: PASS; see `replay/fullpose/results/` and `D3_FINAL_REGRESSION_REPORT_CORRECTED.md`.

Exact final candidate SHA verification is recorded in the ignored local `verification/d3-final-01/runtime_logs/REQ0058_FINAL_TESTED_SHA.txt`; it is captured after the acceptance commit so the commit does not self-reference its own hash.
