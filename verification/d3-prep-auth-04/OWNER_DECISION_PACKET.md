# D3-PREP-AUTH-04 owner decision packet

This packet preserves the exact three questions, proposed choices, evidence, and consequences that were presented for owner decision. The owner later explicitly approved each exact proposed choice; no owner decision remains open. The owner statuses below are current, and the original proposal details remain here for audit. Any changed choice requires a revised packet/profile version before execution.

## AUTH04-01 — one-fixture bootstrap exception

**Exact question:** Approve / do not approve the bounded 3DMX/BNZ development-fixture bootstrap exception exactly as specified in BOOTSTRAP_EXCEPTION_DECISION.md, permitting one development-only preparation of this selected fixture before the general profile timing prerequisite is met?

**Proposed choice:** YES to the single-use exception for profile ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0, with all non-permissions, expiry and revocation conditions in that decision file.

**Evidence:** D3-PREP-DEC-04 report proposes a one-fixture bootstrap before the general profile is approved. Current D3-GRID-DEC-02 says no preparation profile is approved and profiles remain separate owner decisions after suitable D2-sealed prepared-state/full-pose evidence. The first prepared state cannot exist before one preparation.

**YES consequence:** Removes the timing blocker for one 3DMX/BNZ development preparation under the exact profile if AUTH04-02 and AUTH04-03 are also YES, the required independent evidence review is recorded, and all execution preflight checks pass. It creates no general profile or D3 acceptance.

**NO consequence:** No D3-PREP-EXEC-04 preparation may occur under this exception; wait for the project’s general prepared-state/full-pose prerequisite or a later explicit owner amendment.

**Preparation blocked:** YES unless approved.

**Owner status:** OWNER APPROVED — YES on 2026-10-04; see `OWNER_AUTHORIZATION_RECORD.md`.

## AUTH04-02 — chemical state and context

**Exact question:** Approve / replace the full state hypothesis in CHEMICAL_STATE_DECISION.md and PREPARATION_CONTEXT_DECISION.md, including target_pH 6.9 as a crystal-growth-context proxy, whether GLU128 is deprotonated, whether the source audit's 51 unique side-chain residue identities are the complete set, the remaining numbered Asp/Glu/Arg/Lys/Tyr map, neutral HID HIS31, +1 Met1 N terminus, −1 Leu164 C terminus, no caps/disulfides, and the declared BNZ state/interpretation?

**Proposed choice:** YES to exactly one explicit state: add GLU128 as deprotonated, formal charge −1, under the broad predecessor rule that all Asp/Glu side chains are deprotonated, and recognize the source CSV grouping of 51 unique side-chain residue identities plus two termini as the complete set. Keep every other residue assignment exactly as listed in CHEMICAL_STATE_DECISION.md. BNZ remains neutral CCD BNZ with six fixed experimental carbons and six parent-mapped generated hydrogens. The receptor state is one hypothesis at a proxy context, not an experimentally known binding microstate.

**Evidence:** DEC04 source freeze and receptor chemical-state proposal; RCSB/mmCIF crystallization metadata; residue-level coordinate/proximity audit. The source does not state a distinct soak/binding pH. HIS31 neutral/positive state is unobserved; geometry weakly supports HID. BNZ graph and neutrality are CCD/source facts. The predecessor says 49 ionizable side-chain groups and omits GLU128 from its numbered list; the predecessor CSV has 51 distinct side-chain identities, including GLU128, plus two termini. The proposed YES explicitly resolves this discrepancy.

**YES consequence:** Authorizes only the listed explicit candidate ChemicalState in this profile, including GLU128− and the reconciled 51-site enumeration. The run must record all states explicitly and fail closed if they differ. Execution still requires the recorded independent evidence review and all preflight checks. It does not authorize automatic pKa/protonation, alternate states, physiological pH substitution, or a broader rule.

**NO consequence:** ChemicalState remains unresolved and preparation is blocked. A replacement state/context requires a revised decision packet and new profile version.

**Preparation blocked:** YES unless approved.

**Owner status:** OWNER APPROVED — YES on 2026-10-04; see `OWNER_AUTHORIZATION_RECORD.md`.

## AUTH04-03 — exact toolchain, profile and component interpretation

**Exact question:** Approve / do not approve the exact candidate profile ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0 and its exact pinned stack/configuration in PINNED_TOOLCHAIN_PROPOSAL.md, including selected coherent A altlocs, explicit CORE_DRY_V1 source-water/HED/phosphate/chloride dispositions, RDKit 2026.03.6 hydrogen generation, no minimization/repair, immutable source heavy atoms, and the prepared-state interpretation in PREPARATION_PROFILE_FREEZE.md?

**Proposed choice:** YES to the exact v1.0 candidate profile and stack; retain all source evidence and all excluded component/alternate mappings; require a sealed driver digest and all preflight/postcondition checks before any hydrogen operation.

**Evidence:** DEC04 altloc/component freeze; PHD-V2-03 REC-D04/12/16/18; D2 profile contracts; RDKit 2026.03.6 API/source and pinned wheel/runtime hashes. OpenMM 8.6.1 was not selected because its addHydrogens API performs minimization. The profile ID is separate from the registered D2 dry-core consumer profile.

**YES consequence:** Closes the candidate toolchain/profile owner decision for the single fixture only. It permits a separate execution task to follow the pinned command only after the required independent evidence review is recorded and its driver/config source hash, full input hashes, state/graph checks, owner approvals and run manifest are sealed and validated.

**NO consequence:** No execution. Revisit toolchain/profile research only for the named unresolved reason or a replacement profile, without changing fixture selection.

**Preparation blocked:** YES unless approved.

**Owner status:** OWNER APPROVED — YES on 2026-10-04; see `OWNER_AUTHORIZATION_RECORD.md`.

## Recording instructions

The project owner’s explicit YES for all three exact proposed choices is recorded in `OWNER_AUTHORIZATION_RECORD.md`, sourced to the later owner instruction and its SHA-256. No owner decision remains open. AUTH04 gate exit and D3-PREP-EXEC-04 remain blocked only by the independent evidence-review condition documented in `REVIEW_REQUIREMENT_STATUS.md`; no execution prompt is present.
