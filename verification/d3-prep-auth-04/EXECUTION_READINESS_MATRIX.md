# D3-PREP-EXEC-04 readiness matrix

| Requirement | Evidence/status in AUTH04 | Execution status |
|---|---|---|
| Fixture remains 3DMX/BNZ; exact DEC04 parent | Verified exact commit/worktree and unchanged fixture | PASS |
| Owner bootstrap exception | Exact bounded proposal in BOOTSTRAP_EXCEPTION_DECISION.md; owner status NOT RECORDED | BLOCKED |
| Receptor chemical state / pH context | Full residue map and context in CHEMICAL_STATE_DECISION.md and PREPARATION_CONTEXT_DECISION.md; owner status NOT RECORDED; DEC04 map/count conflict (GLU128 omitted) explicitly carried for owner resolution | BLOCKED |
| BNZ explicit state | CCD BNZ neutral rigid graph and source heavy coordinates; included in profile decision; generated Hs not created | Proposed; owner decision required for profile |
| MET106/GLU108 alternates | A 0.70/B 0.30; select coherent A; provenance requirements defined | Proposed; profile approval required |
| Water/component policy | CORE_DRY_V1 occurrence-level exclusions and near-site HOH1147 documented | Proposed; profile approval required |
| Exact H toolchain | RDKit 2026.03.6, CPython 3.13.16 x64, exact wheel hashes and AddHs parameters pinned; no execution | Proposed; profile approval required |
| Automatic state selection prohibited | Explicit state map required; no pKa/protonation/tautomer generator | PASS as a profile constraint |
| Deterministic configuration | Stable RDKit call, input ordering/state map fixed, no RNG, offline wheelhouse, pinned environment | Proposed; driver must be sealed before any molecular operation |
| Heavy-atom invariant | Bitwise in-memory comparison; 0.001 Å serialization-only read-back tolerance; required zero unauthorized changes | PASS as a precondition/acceptance contract; not executed |
| Hydrogen provenance | Per-H parent AtomUID, exact coordinate bits, method/tool/profile/input/run provenance defined | PASS as a contract; no H exists |
| Profile identifier | ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0 v1.0.0 proposed; distinct from D2 consumer IDs | Proposed; profile approval required |
| Current canonical owner profile record | D3-GRID-DEC-02 keeps preparation profile open and requires later owner decision | BLOCKED absent bootstrap approval |
| Qualified independent chemist review before execution | Optional/recommended, not mandatory under current PHD-V2 prep rules | Not a blocker |
| Roadmap independent evidence review | Required general closure evidence-review control | Must be completed at the applicable closure point |
| Prepared-state payload/digests | None; no molecular operation allowed in AUTH04 | Correctly absent |
| D3 acceptance, D4, DOCKING.RUN | Not in scope; D3 HOLD / D4 BLOCKED / DOCKING.RUN UNAVAILABLE | Unchanged |

## Gate result

The scientific proposal and candidate toolchain are ready for the project owner's three explicit YES/NO decisions. Because none is recorded, D3-PREP-EXEC-04 is NOT AUTHORIZED. No execution prompt is generated.
