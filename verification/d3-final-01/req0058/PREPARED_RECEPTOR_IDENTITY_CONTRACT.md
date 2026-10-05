# PreparedReceptorState Identity Contract

## Normative identity property

`ME-DCK-V1-REQ-0058` (Normalized Requirements v1.0, Google Doc `1_M2RzFxcg0wgNAeyo5mFKHI8HA6JTtJiGPtZ79nuddY`) states:

> Changing assembly, model, chain set, altloc, chemical microstate, active hydrogen set, retained components, typing/scoring dependencies or scientifically active coordinates SHALL change PreparedReceptorState identity.

`ME-DCK-V1-AT-0058` (Final Docking Acceptance Specification, Google Doc `1QjuDYapWNc2bRX4CUpa5w57iJP0evMc9SnSDqu8rFrg`) requires demonstrating that exact property at Level 1 / Gate D3 for `docking/preparation/receptor`.

## Current identity representation

`D2PreparedReceptorStateV2` carries `scientificDependencies`, each as a stable profile ID plus canonical SHA-256 profile digest:

| Reference | Canonical profile | Why it is part of this state identity |
|---|---|---|
| `chemicalPerceptionProfileRef` | `ME_SUPPORTED_CHEMISTRY_V1_1_0` | Identifies the chemistry interpretation used for receptor state. |
| `receptorAtomTypingProfileRef` | `ME_XS_TYPING_V1_1_0` | Identifies the receptor atom typing definition used downstream. |
| `scoringProfileRef` | `ME_DOCKING_V1_VINA_CLASSIC_1_0` | Identifies the canonical scorer definition consuming the prepared receptor. |

The whole reference object is included in the canonical-CBOR scientific digest payload. The profile digest is content identity; neither value is derived from a path, mutable global, current environment, field identity, or assignment-table digest.

The inherited molecular identity, graph, chemical-state, coordinate-state, assembly, model, chain, alternate-location, retained component-role, and site-critical-atom inputs remain in the state digest. Together these bind molecular preparation and the explicit scoring/typing profile boundary.

## Contract boundary

`PreparedReceptorState` is a prepared molecular state plus references to scientific dependencies. `ScoringFieldIdentity` remains a separate derived artifact and carries its own field data and dependency identity. Per-receptor typing assignments remain child data that link to the receptor state; their digest is not folded back into that parent identity, avoiding a cycle.

Canonical V1 scoring does not require an atomic partial-charge assignment. Accordingly no partial-charge profile reference is fabricated for the D3 profile. The selected scoring, typing, and chemistry profile identities are explicit and are tested for identity sensitivity.

## Serialization and version

The receptor entity advances to `schemaVersion: 2`, `semanticSchemaId: D2_PREPARED_RECEPTOR_STATE_V2`, and a new `D2_PREPARED_RECEPTOR_STATE_V2` digest domain. The global `D2_SCHEMA_VERSION` remains 1 so unrelated D1/D2 schemas are not invalidated. V1 remains only as a historical wire type; active sealing and SearchRegion construction require V2. A V1 state is not silently upgraded or accepted as complete: it must be resealed with explicit dependencies.

The canonical sources also require deterministic scientific hashing and named profile references (PHD-V2-03, PHD-V2-06, PHD-V2-10, PHD-V2-15). The independent digest recomputation is recorded in `replay/D2_SEAL_DIGEST_REPLAY_VALIDATION.json`.
