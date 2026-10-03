# D3-PREP-AUTH-04 — 3DMX/BNZ Owner Decision Closure and Toolchain Freeze

**Classification: D3-PREP-AUTH-04 READY FOR OWNER DECISION**

## Decision

The exact candidate fixture remains 3DMX/BNZ. A versioned development-only preparation profile and exact RDKit-based hydrogen-generation stack are proposed. The proposed stack keeps source heavy-atom coordinates fixed, derives no chemical state automatically, does no structural repair, and does no minimization. A DEC04 residue-list/count inconsistency involving GLU128 means the ChemicalState portion is not executable until the owner resolves it. The full proposal and limitations are in PREPARATION_PROFILE_FREEZE.md and PINNED_TOOLCHAIN_PROPOSAL.md.

No explicit project-owner authorization for the bootstrap exception, the receptor microstate/context, or the named candidate profile was found in the current project records or supplied in this task. Those are recorded as three bounded owner decisions in OWNER_DECISION_PACKET.md. This task does not claim owner approval. No OWNER_AUTHORIZATION_RECORD.md or D3_PREP_EXEC_04_PROMPT.md is produced.

No molecular preparation was run. No hydrogen was added to 3DMX or BNZ. No scoring, field construction, docking, PyMOL change, D4 work, or DOCKING.RUN occurred.

## Exact proposal summary

- Bootstrap: permit exactly one 3DMX/BNZ development preparation under the proposed profile before the broader preparation profile timing prerequisite is met. The exact predecessor wording, scope, non-permissions, risks, provenance, revocation, and D1/D2/D3 effects are recorded in BOOTSTRAP_EXCEPTION_DECISION.md.
- Receptor: model 1, biological assembly 1 monomer A1, chain/asym A, full 164-residue C54T/C97A/L99A construct. Use pH 6.9 only as the crystallization-context proxy, not as a measured binding-solution pH. Proposed microstate: Asp/Glu deprotonated; Arg/Lys protonated; Tyr neutral; HIS31 neutral HID; Met1 N terminus +1; Leu164 C terminus -1; no caps or disulfides. The predecessor's numbered map omits GLU128 despite the general Asp/Glu rule and the source CSV; AUTH04-02 asks the owner to resolve that explicitly. This is one declared hypothesis, not an experimentally observed full-protein state.
- Ligand: CCD BNZ, neutral rigid aromatic C6H6; six deposited carbons are immutable; generate H1–H6 one per carbon from the CCD graph and observed coordinates. No tautomer, protomer, stereochemical, or conformer choice is introduced.
- Alternates/components: select the coherent A conformer for MET106 and GLU108 (each deposited A 0.70/B 0.30); retain common atoms and all discarded source alternatives in provenance. Exclude all 248 source waters from the separate CORE_DRY_V1 scoring receptor, including HOH1147 at 7.8253 Å from BNZ C2; record its disposition. Exclude HED, phosphate, chloride and other non-polymers from that dry receptor by explicit role, never by generic HETATM deletion. Preserve all source records and provenance.
- Toolchain: CPython 3.13.16 x64 on the current Windows x64 host; RDKit 2026.03.6 stable release for receptor and ligand H-coordinate generation; exact Windows wheels and dependencies are hash-pinned in PINNED_TOOLCHAIN_PROPOSAL.md. Explicit chemical-state and component data are inputs, not predictions by the tool.
- Heavy atoms: the in-memory postcondition is bitwise-identical heavy-atom coordinates and identical authorized atom identities/mappings. The file round-trip check uses 0.001 Å only for decimal serialization/parsing; it grants no coordinate movement. The source heavy-atom records remain immutable.
- Preparation profile proposal: ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0, semantic version 1.0.0. It follows the repository’s versioned ME_DOCKING_V1_*_1_0 naming pattern and remains a proposal outside the currently registered D2 consumer-profile union.
- Review: a qualified independent chemist review is recommended but is not a contract-mandatory pre-execution blocker under the reviewed PHD-V2 rules. The independent evidence-review step for gate closure remains a separate Roadmap control. Final D3 scientific/qualification acceptance retains its own independent review requirements.

## Owner decisions still open

1. Approve or reject the one-fixture bootstrap exception, exactly as bounded in BOOTSTRAP_EXCEPTION_DECISION.md.
2. Approve or replace the explicitly listed receptor chemical-state hypothesis and use of pH 6.9 as a crystallization-context proxy, including whether GLU128 is −1 and whether the source audit's 51 distinct side-chain residue identities are complete, as detailed in CHEMICAL_STATE_DECISION.md and PREPARATION_CONTEXT_DECISION.md.
3. Approve or reject the named versioned profile and pinned RDKit toolchain, including the exact BNZ state, coherent altloc choice, CORE_DRY_V1 component dispositions, and prepared-state interpretation in PREPARATION_PROFILE_FREEZE.md.

Source facts and already named deterministic project policies are not presented as independent owner decisions. In particular, the BNZ identity/neutral graph is a source fact, and coherent maximum-occupancy A plus CORE_DRY_V1 are named policies whose exact application is included in the composite profile decision.

## Readiness and boundaries

The software stack, configuration, and validation contract are pinned as a candidate proposal, not executed or owner-authorized. The ChemicalState list/count conflict must be resolved before the profile is executable. The run command and complete validation contract are specified in PINNED_TOOLCHAIN_PROPOSAL.md. Any execution implementation must be sealed and hashed before its first chemical operation and must fail closed on any input, graph, state, output, or heavy-atom mismatch. No result digest is claimed before a real prepared-state payload exists.

Full D3 remains HOLD. D4 remains BLOCKED. DOCKING.RUN remains UNAVAILABLE. This gate cannot accept D3.

## Evidence index

- PREDECESSOR_DECISION_EXTRACTION.md
- BOOTSTRAP_EXCEPTION_DECISION.md
- CHEMICAL_STATE_DECISION.md
- PREPARATION_CONTEXT_DECISION.md
- ALTERNATE_COMPONENT_POLICY_FREEZE.md
- HYDROGEN_TOOLCHAIN_CANDIDATES.md
- PINNED_TOOLCHAIN_PROPOSAL.md
- HEAVY_ATOM_INVARIANT.md
- HYDROGEN_PROVENANCE_CONTRACT.md
- PREPARATION_PROFILE_FREEZE.md
- OWNER_DECISION_PACKET.md
- REVIEW_REQUIREMENT_STATUS.md
- EXECUTION_READINESS_MATRIX.md
- OPEN_BLOCKERS.md
- PREFLIGHT_RECORD.md
- CHANGED_PATHS.txt
- SHA256SUMS.txt
