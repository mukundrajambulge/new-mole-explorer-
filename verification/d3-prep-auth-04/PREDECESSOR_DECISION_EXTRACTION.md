# DEC04 predecessor decision extraction

## Exact predecessor and evidence

- Branch: research/d3-prep-dec-04-3dmx-bnz
- Commit: be16bd1149e7a2e1285916846265ffbcbee8c341
- Worktree: C:/Users/mukun/.codex/worktrees/d3-prep-dec-04-3dmx-bnz/molecular-workstation
- Pre-task status: clean at the exact commit; verified from Git, not inferred from chat.
- The full source report and every related DEC04 artifact were read from that checkout. The authoritative lane is verification/d3-prep-dec-04-3dmx-bnz/.
- DEC04 SHA256SUMS.txt lists 19 lane payload checksums. The source manifest lists six source artifact entries. This task preserved those bytes and source manifests.

## Extracted proposals

### Receptor chemical state

Candidate 3DMX model 1, assembly 1 monomer A1, polymer chain/asym A; 164 residues; source construct C54T/C97A/L99A; no cysteine remains and no disulfide is proposed. The explicit conventional state hypothesis at the declared pH 6.9 context is:

- ASP 10, 20, 47, 61, 70, 72, 89, 92, 127, 159: deprotonated, −1.
- GLU 5, 11, 22, 45, 62, 64, 108: deprotonated, −1, as explicitly enumerated.
- ARG 8, 14, 52, 76, 80, 95, 96, 119, 125, 137, 145, 148, 154: protonated, +1.
- LYS 16, 19, 35, 43, 48, 60, 65, 83, 85, 124, 135, 147, 162: protonated, +1.
- TYR 18, 24, 25, 88, 139, 161: neutral.
- HIS31: neutral HID proposal. ND1–ASP70 OD2 is 2.672 Å; this geometry supports the tautomer hypothesis but does not establish protonation.
- Met1 alpha-amino terminus: +1.
- Leu164 alpha-carboxyl terminus with source OXT: −1.
- No caps; no disulfides.

The DEC04 prose states 49 ionizable side-chain groups plus the two termini. A read-only grouping of its IONIZABLE_RESIDUE_PROXIMITY.csv by component and auth residue identity returns 51 distinct side-chain identities plus MET1/LEU164 termini. This includes GLU128, which is absent from the numbered state list. The broad “Asp/Glu side chains deprotonated” proposal implies it might be −1, but the numbered list does not state it. The difference between the prose count and audit rows/numbered state list is unresolved. No residue was silently added to the frozen predecessor proposal. This is a proposed one-state ChemicalState, not a source-observed hydrogen or charge assignment. Tyr88 is the nearest ionizable side-chain group to BNZ at 8.1425 Å; HIS31 is 19.1250 Å away. Proximity does not make full receptor ChemicalState optional.

### BNZ chemical state

The ligand is PDB Chemical Component Dictionary component BNZ, neutral benzene, one rigid six-carbon aromatic ring, C6H6. It has no protomer, tautomer, or stereochemical ambiguity. The six 3DMX source carbon coordinates remain unchanged. The proposal is to create one hydrogen H1–H6 parent-mapped to the corresponding C1–C6 from the CCD graph and observed conformer. Do not copy CCD model hydrogen coordinates and do not minimize the ring.

### Alternate conformers

MET106 and GLU108 each have coherent A/B alternatives with deposited occupancies A=0.70 and B=0.30. Choose A for both under COHERENT_MAX_OCCUPANCY_V1, including common blank atoms; do not mix or average. The nearest MET106 A/B atoms are 7.9205/8.0028 Å from BNZ; GLU108 A/B are 7.6341/7.6590 Å away. Preserve all atom-site rows, altloc labels, occupancies, and mappings for the unselected B alternatives in source provenance.

### Water and component policy

The future receptor scorer representation is CORE_DRY_V1. Exclude all 248 crystallographic waters from that representation, with occurrence-level reasons and source links recorded. The one within 8 Å is HOH1147, 7.8253 Å from BNZ C2; it is 3.2703 Å from Val87 CG2 and was not found to bridge/contact the BNZ site. Its exclusion is explicit and loses the possible solvent contribution; it is not a generic removal rule.

HED occurrences E/A904 and F/A905 are 10.8478 and 11.6196 Å from BNZ; PO4 B/A901 and C/A902 are 15.3395 and 20.1564 Å; CL D/A903 is 32.533 Å. They are crystal additives/buffer, source-only and excluded from the dry receptor with explicit roles. No metal/cofactor occurs within 8 Å. The source BNZ occurrence remains the ligand source occurrence and is excluded from the receptor graph as that reference ligand. No source component is deleted from the evidence record.

### Preparation context and bootstrap

The source reports crystallization at pH 6.9 and 277 K, 2.0–2.2 M K/Na phosphate, 5 mM BME, and 5 mM oxidized BME. It does not resolve whether the complex was obtained by soaking or vapor diffusion and does not supply a separate ligand-binding/soak pH. Therefore pH 6.9 is a crystallization-context proxy only.

The exact predecessor wording is: “permits one 3DMX/BNZ bootstrap development preparation before the general profile is approved”. It is proposed to resolve the sequence problem created by the later-owner-decision-after-prepared-state/full-pose-evidence prerequisite. It is not in force without explicit owner approval.

### Toolchain and execution blockers extracted

DEC04 left tool/version/runtime/configuration/hashes/command unset, did not authorize automatic pKa or chemical-state decisions, and required heavy-atom invariance, a named hydroxyl/terminal hydrogen-orientation policy, exact altloc/component provenance, and separate source/state/prepared-state identities. It did not create prepared-state digests.

The predecessor’s blockers were:

1. No owner bootstrap exception to the existing preparation-profile timing rule.
2. No owner acceptance/replacement of the pH 6.9 proxy and HIS31/terminus state proposal.
3. No selected exact hydrogen-only toolchain, runtime, dependency lock, executable/package digest, command, deterministic behavior, or profile.
4. No exact receptor/ligand hydrogen placement, orientation, coordinate serialization, or per-hydrogen provenance.
5. No real PreparedReceptorState, PreparedLigandState, or SearchRegion digest.

DEC04 explicitly says the task itself does not document the missing owner decisions. It also records independent structural-biologist/computational-chemist review as optional under the canonical PHD-V2 rules then reviewed; absence is not a preparation HOLD reason.

### Newly identified residue-enumeration conflict

The source audit CSV contains 53 distinct component/residue keys after repeated altloc rows are grouped: 51 side-chain residue identities and two termini. The numbered proposal, counting HIS31, contains 50 side-chain identities and omits GLU128; its prose instead says 49. The numbered-list omission and count are not resolved by source evidence alone. AUTH04-02 therefore asks the owner to confirm the exact set and whether GLU128 is deprotonated under the broad Asp/Glu rule.

## Current reconciliation

The present gate proposes a concrete software/configuration profile to close the research portion of item 3 and the hydrogen method portion of item 4. The profile is not an executed or approved state. Items 1 and 2 remain owner decisions; the profile/toolchain use itself is item 3 in OWNER_DECISION_PACKET.md. No prepared-state digest can exist before execution.

Current owner records still say no preparation profile is approved. D3-GRID-DEC-02 says preparation profiles remain separate evidence-based owner decisions after appropriate prepared-state/full-pose evidence. The proposed bootstrap therefore remains a new, bounded exception for the single fixture only.

## Predecessor artifacts read

D3_PREP_DEC_04_REPORT.md; SOURCE_STATE_FREEZE.md; RECEPTOR_CHEMICAL_STATE_PROPOSAL.md; BNZ_LIGAND_STATE.md; ALTLOC_COMPONENT_POLICY.md; SEARCHREGION_GEOMETRY.md; TOOLCHAIN_AND_STATE_CONTRACT.md; AUTHORITY_APPROVAL_REGISTER.md; OPEN_BLOCKERS.md; REPOSITORY_PREFLIGHT.md; SOURCE_MANIFEST.csv; IONIZABLE_RESIDUE_PROXIMITY.csv; audit/ionizable_proximity.py; SHA256SUMS.txt.
