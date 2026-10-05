# Independent Review — D3-FINAL-01 / REQ-0058

**Finding:** PASS for the local D3 evidence package at exact candidate SHA `eea25315c04d9691362f085fb36c83f9e50281f5`. Canonical Roadmap and Source of Truth publication and acceptance-tag creation remain pending.

## Requirement and correction reviewed

Normalized Requirement `ME-DCK-V1-REQ-0058` states:

> “Changing assembly, model, chain set, altloc, chemical microstate, active hydrogen set, retained components, typing/scoring dependencies or scientifically active coordinates SHALL change PreparedReceptorState identity.”

The predecessor V1 seal included molecular and preparation selections but omitted explicit typing and scoring profile references. Although those dependencies appeared in the separate scoring-field identity, that did not make the already-sealed receptor state sensitive to them. The prior focused test did not vary those dependencies, so it did not demonstrate the full property.

PreparedReceptorState V2 adds explicit chemistry, receptor-typing, and scoring profile ID/digest references to the canonical-CBOR payload and the V2 digest domain. Same-input replay is deterministic; changing any of the three dependency digests changes receptor-state identity; changing scorer ID with unchanged digest also changes it. The test confirms those references are serialized. Missing or malformed references fail closed without producing a state, and chemistry, typing, or scoring mismatches against the scoring-field dependencies are each rejected. The receptor state advances to schema version 2 while the global D2 schema remains version 1; V1 is not silently accepted as a complete current state.

The old incomplete receptor digest `sha256:cc8556b9e66fc8baedcff42ac72a56da5ac18cedd2f65a065054e667366c2a06` is replaced by V2 digest `sha256:226761376a4fbb3d361d3fe6b4e677f53986e2c36cc4f4ca0d4dc0ef34dbe76d`. SearchRegion digest changes from `sha256:690c208e99f9cf467662c071e6934abe01950b0d2e22f7753b5cc5e2ee5b1f2d` to `sha256:c7065c614847781cb6c20456d43a3f69ac48520cc1fc11e5b35c010575198117` because it binds the receptor digest. The prepared-ligand digest is unchanged: `sha256:65e8b07631df6cc83800b31bf7682b420fce282cadaf3b2427973260b5e851a1`.

## Replay and numerical evidence

The independent canonical-CBOR replay reports PASS for all 12 graph, identity, chemical-state, coordinate-state, prepared-state, kinematic-model, and SearchRegion digest checks. I compared the regenerated replay artifacts against the committed continuation: **20/20 D2 artifacts match**. The regenerated full-pose output set matches at **5/5 files**.

Across the six-pose cohort, I independently compared 37 pose-result fields per row and nine numeric/identity fields across each of the 30 term rows; all compared values match the predecessor results. The matching fields include direct/grid raw and weighted terms, totals, pose/source-pose hashes, torsion results, and boundary status. The expected receptor, SearchRegion, scoring-field, profile, and input-bundle digests differ. All six poses are in-domain; direct and grid orders are identical, with no ties or pairwise reversals.

For grid-minus-direct `E_inter`, the six-pose MAE is **0.18378061689470737 kcal/mol**, RMSE **0.20092119392847385 kcal/mol**, and maximum absolute error **0.2901117728421321 kcal/mol**. The cutoff-stress absolute error is **0.02524701521328865 kcal/mol**. Per-term MAEs are: raw/weighted G1 **0.2745275024 / 0.0097674140**; G2 **1.7301331288 / 0.0089205664**; REP **0.2049487130 / 0.1722071313**; HYD **0.0776566825 / 0.0027233422**. Raw and weighted HB errors are zero across the cohort. These are fixture-bounded results, not universal accuracy claims.

Preparation replay reports identical scientific artifacts for both runs, payload SHA-256 `212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f`, and zero heavy-atom additions, deletions, remappings, bond changes, or coordinate-bit changes. It records 1,306 receptor and 6 ligand heavy atoms and a zero-distance serialization round trip.

## Exact-head regression and authority disposition

The exact-head attestation names the clean candidate SHA above. Recorded results are: workspace tests **47 files / 256 tests** (web 34/156; API 13/100), focused AT-0058 **13/13**, D3-GRID **5/5**, native CTest **2/2**, protected PyMOL browser tests **3/3**, and screenshot hashes **40/40**. Typecheck, lint, production build, preparation replay, and D2 seal replay pass. The synthetic full-pose smoke check passes. The final successful six-pose run is identified as `fullpose-regenerated-state-run-final.txt`; earlier exploratory failures in that directory are superseded by that run. Build advisories remain recorded.

The continuation checksum manifest matches **51/51** entries; the preserved predecessor HOLD manifest matches **17/17**.

The task-local owner-approved Roadmap amendment records the §1.3/§2.2 reconciliation:

- AT-0141: `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`, assigned to D5.
- AT-0146: `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`, assigned to D5.
- AT-0204: `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`, assigned to D5 for result semantics and D6 for numerical-equivalence/replay criteria.

Their former Final Acceptance Specification Gate D3 labels are preserved as historical text and superseded for execution sequencing by the local owner-approved amendment. These tests are not claimed as D3 passes.

The corrected blocker register reports no remaining mandatory D3 blockers. The local decision authorizes D4 to begin from this tested baseline; `DOCKING.RUN` remains unavailable pending a later explicit execution gate.

## Independence and limits

This was a read-only review. I did not author the implementation, fixture preparation, numerical results, or test evidence, and I did not rerun the test suites. I inspected the implementation and focused assertions, verified the exact-head record and recorded results, independently checked artifact hashes and comparison counts, and checked the amendment classifications. Canonical Roadmap and Source of Truth publication and acceptance-tag creation remain pending.
