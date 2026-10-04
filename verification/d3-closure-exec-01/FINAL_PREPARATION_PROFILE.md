# Final preparation profile status

**Profile:** `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0`, semantic version `1.0.0`.

**Authority:** the exact candidate profile in `verification/d3-prep-auth-04/PREPARATION_PROFILE_FREEZE.md`, with tool and dependency pins in `PINNED_TOOLCHAIN_PROPOSAL.md`, was explicitly owner-approved for one 3DMX/BNZ development bootstrap. It is not an ordinary-V1 default or production capability.

The approved state includes 3DMX/BNZ, GLU128 deprotonated, pH 6.9 only as crystallization-context proxy, the corrected 51 side-chain identities plus two termini, the coherent MET106/GLU108 conformer policy, occurrence-level component dispositions, and hydrogen-only derivation with exact heavy-atom identity/coordinate preservation. All scientific details remain frozen in AUTH04; this record does not recreate them.

**Execution status: NOT MATERIALIZED.** The exact pinned Linux runtime loads and passes the safe synthetic AddHs controls. Hash-gated source preflight nevertheless found three additional A/B coordinate groups (ASN68, ASP72, ARG76) beyond the only positions resolved by the frozen profile (MET106, GLU108). Because the relocation authorization forbids changing the alternate policy, the preflight stopped before accepting a receptor graph or supplying a fixture molecule to RDKit. No fixture AddHs call, run driver/config seal, prepared state, or deterministic fixture replay was created. The single-use bootstrap remains unconsumed.
