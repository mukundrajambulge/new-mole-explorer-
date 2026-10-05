# REQ-0058 Root Cause

## Requirement

The normalized requirement `ME-DCK-V1-REQ-0058` states:

> Changing assembly, model, chain set, altloc, chemical microstate, active hydrogen set, retained components, typing/scoring dependencies or scientifically active coordinates SHALL change PreparedReceptorState identity.

The Final Docking Acceptance Specification labels `ME-DCK-V1-AT-0058` Gate D3 and requires demonstrating that same property.

## Defect in the predecessor

At predecessor `6bcaefc5290fadefd9d3bb9ecce2c641f1a0dcad`, `sealPreparedReceptorState` hashed receptor, graph, chemical and coordinate state digests plus assembly/model/chain/altloc/component choices. It did not carry the downstream typing and scoring profile references. Those references were present in the distinct `ScoringFieldIdentity` dependency payload (`native/docking-reference/scoring/include/mole/docking/scoring_field.hpp` and `native/docking-reference/scoring/src/scoring_field.cpp`), but that later identity did not make the already-sealed receptor state distinguish between those dependencies.

The former test verified the state inputs then available, but did not vary a typing or scoring dependency. Thus it could not demonstrate the full normative identity contract. The prior HOLD remains preserved in `../D3_FINAL_DECISION.md` and its associated matrices.

## Root cause

The PreparedReceptorState schema modeled molecular and preparation selections but omitted the explicit references to scientific profile definitions used downstream. Hashing profile dependencies only in a separate scoring-field artifact left a gap at the prepared-state boundary.

## Scope

The repair adds only stable profile identity references to the receptor state. It does not include assignment tables, score grids, coefficients copied as bulk payloads, runtime locations, or filesystem paths. The scoring-field artifact remains separate.
