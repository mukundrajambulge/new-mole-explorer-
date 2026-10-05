# Independent Review — D3-FINAL-01 / REQ-0058

**Finding:** PASS for the local code/evidence candidate at SHA `aa5daec6bdc4fb55ce39719402c2452f1ed39258`.
**Review date:** 2026-10-05
**Reviewed tree:** branch `release/d3-final-acceptance`; at the final pre-edit audit check, this SHA was HEAD and the tracked tree was clean.

## Requirement and root cause

Normalized Requirement `ME-DCK-V1-REQ-0058` states:

> “Changing assembly, model, chain set, altloc, chemical microstate, active hydrogen set, retained components, typing/scoring dependencies or scientifically active coordinates SHALL change PreparedReceptorState identity.”

The predecessor PreparedReceptorState V1 included molecular and preparation selections but omitted explicit typing and scoring profile references. Although those references appeared in a separate scoring-field identity, that identity did not make the already-sealed receptor state sensitive to them. The predecessor focused test did not vary typing or scoring dependencies and therefore did not establish the complete requirement.

## V2 implementation and AT-0058 evidence

PreparedReceptorState V2 carries explicit chemistry, receptor-typing, and scoring profile references, each with profile ID and SHA-256 digest, in the canonical-CBOR state payload and V2 digest domain. It advances the receptor state to schema version 2 while the global D2 schema remains version 1. V1 is not silently treated as complete under the corrected identity contract.

The focused AT-0058 tests demonstrate deterministic same-input replay; canonical serialized inclusion of each ID and digest; identity changes for chemistry, typing, and scoring digest changes; and scorer-ID sensitivity when digest bytes are unchanged. Missing or malformed references fail closed without returning a state. The scoring-field consistency predicate rejects chemistry, typing, and scoring reference mismatches independently. The active state-sealing API requires the three explicit references; there is no inferred or global fallback.

The old incomplete receptor digest `sha256:cc8556b9e66fc8baedcff42ac72a56da5ac18cedd2f65a065054e667366c2a06` transitions to V2 digest `sha256:226761376a4fbb3d361d3fe6b4e677f53986e2c36cc4f4ca0d4dc0ef34dbe76d`. SearchRegion digest changes from `sha256:690c208e99f9cf467662c071e6934abe01950b0d2e22f7753b5cc5e2ee5b1f2d` to `sha256:c7065c614847781cb6c20456d43a3f69ac48520cc1fc11e5b35c010575198117` because it binds the receptor digest. The prepared-ligand digest remains `sha256:65e8b07631df6cc83800b31bf7682b420fce282cadaf3b2427973260b5e851a1`.

## Replay, preparation, and numerical evidence

The independent canonical-CBOR D2 replay reports PASS for all 12 graph, identity, chemical-state, coordinate-state, prepared-state, kinematic-model, and SearchRegion digest checks. I independently compared regenerated D2 artifacts against the committed continuation: **20/20 match**. The regenerated full-pose output set matches at **5/5 files**.

Preparation replay for profile `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_1` reports identical scientific artifacts for both runs, payload SHA-256 `212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f`, and zero heavy-atom additions, deletions, remappings, heavy-heavy bond changes, or coordinate-bit changes. The verified cohort contains 1,306 receptor and 6 ligand heavy atoms; serialization round-trip displacement is 0.0 Å.

Across the six-pose cohort, I independently compared 37 pose-result fields in each row and nine numeric/identity fields across each of the 30 term rows. Direct/grid raw and weighted terms, totals, pose/source-pose hashes, torsion results, and boundary status match the predecessor values exactly. Expected receptor, SearchRegion, scoring-field, profile, and input-bundle identities differ. All six poses are in-domain; direct and grid orders are identical, with no ties or pairwise reversals.

For grid-minus-direct `E_inter`, MAE is **0.18378061689470737 kcal/mol**, RMSE **0.20092119392847385 kcal/mol**, maximum absolute error **0.2901117728421321 kcal/mol**, and cutoff-stress absolute error **0.02524701521328865 kcal/mol**. Per-term MAEs are raw/weighted G1 **0.2745275024 / 0.0097674140**, G2 **1.7301331288 / 0.0089205664**, REP **0.2049487130 / 0.1722071313**, and HYD **0.0776566825 / 0.0027233422**. Raw and weighted HB errors are zero across the cohort. These are fixture-bounded measurements, not universal approximation claims.

## Exact-head regression and disposition

The exact-head run logs reviewed are in `verification/d3-final-01/runtime_logs/req0058-postcommit-aa5daec/`. The committed candidate was created at 2026-10-05 15:28:49 UTC; the run record starts at 15:29:33 UTC. Logged results are: workspace tests **47 files / 256 tests** (web 34/156; API 13/100), focused AT-0058 **13/13**, D3-GRID **5/5**, native CTest **2/2**, protected PyMOL browser tests **3/3**, and screenshot hashes **40/40**. Typecheck, lint, production build, preparation replay, D2 seal replay, six-pose validation, and the five-pose synthetic smoke check pass. The regenerated six-pose results contain six pose rows and 30 term rows. Existing build advisories are recorded.

I independently verified the 52-entry continuation checksum manifest at **52/52** and the preserved predecessor HOLD manifest at **17/17**. The exact-head log directory and current HEAD identify the reviewed code/evidence SHA as `aa5daec6bdc4fb55ce39719402c2452f1ed39258`. The then-present generic `REQ0058_FINAL_TESTED_SHA.txt` still named the earlier `eea25315` run; I did not rely on that stale summary for this audit. No later commit, acceptance tag, or canonical Docs publication is reviewed or attested here.

The task-local owner-approved Roadmap amendment records the §1.3/§2.2 reconciliation:

- AT-0141: `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`, assigned to D5 for Q-score quantization, ties, and result semantics.
- AT-0146: `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`, assigned to D5 for final-mode selection after D4 search.
- AT-0204: `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP`, assigned to D5 for discrete-result semantics and D6 for numerical-equivalence/replay criteria.

Their earlier Final Acceptance Specification Gate D3 labels are preserved as historical text and superseded for execution sequencing by the local owner-approved amendment. These tests are not represented as D3 passes. The corrected blocker register reports no remaining mandatory D3 blocker; the local decision authorizes D4 to begin, while `DOCKING.RUN` remains unavailable pending a later explicit execution gate. Canonical Roadmap and Source of Truth publication and acceptance-tag creation remain pending.

## Independence and limits

This was a read-only review of candidate SHA `aa5daec6bdc4fb55ce39719402c2452f1ed39258`. I did not author the implementation, fixture preparation, numerical results, or test evidence, and I did not rerun the test suites. I inspected the implementation and focused assertions, checked the exact-head logs and review artifacts, independently compared regenerated hashes and result fields, verified both checksum manifests, and checked the amendment classifications. This report does not claim review of any later commit, tag, or canonical Docs publication.
