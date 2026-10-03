# D3-PREP-DEC-04 — 3DMX / BNZ preparation decision

**Classification: D3-PREP-DEC-04 HOLD — PREPARATION EXECUTION NOT AUTHORIZED**

## Decision

3DMX/BNZ remains a scientifically admissible `CORE_DRY_V1` development-fixture candidate. The source and structural admission findings from D3-FIXTURE-READY-03 are corroborated. This lane does not authorize preparation because the current canonical owner decision explicitly leaves preparation profiles open and the required candidate-specific receptor chemical state and exact preparer/toolchain have not been approved. The experiment-context pH and heavy-atom geometry do not by themselves establish the missing microstate and hydrogen policy.

This is an authorization HOLD, not a fixture rejection and not a source/contract conflict. No molecular preparation, hydrogen addition, structure editing, PDBQT generation, scoring, field construction, docking, PyMOL change, D4 work, or `DOCKING.RUN` occurred. No `D3_PREP_EXEC_04_PROMPT.md` is produced because no executable profile is authorized.

## Candidate state supported by evidence

- Receptor: RCSB 3DMX polymer entity 1, deposited model 1, assembly 1 monomer A1, chain/asym A; all 164 entity positions are observed with 163/163 peptide links and both termini represented. The explicit construct is T4 lysozyme C54T/C97A/L99A, expressed in *E. coli*. There are no cysteine residues in this construct and no disulfide state to assign.
- Ligand: BNZ, label asym G / author chain A / residue 900; six of six carbon heavy atoms, occupancy 1.00, one neutral C6H6 aromatic ring. The CCD graph and ligand map are exact; no stereochemical, tautomer, or protomer choice is open.
- Receptor alternates: MET106 and GLU108 each have coherent A/B groups at 0.70/0.30. The candidate profile recommendation is one major conformer A for both, retaining blank/common atoms and never mixing A/B coordinates. This follows the D2 `COHERENT_MAX_OCCUPANCY_V1` semantics and the candidate-specific distance evidence.
- Site context: the closest ionizable side-chain group is Tyr88 OH at 8.1425 Å from BNZ; Arg96 is 8.5090 Å. The lone water within 8 Å is 7.8253 Å from BNZ and 3.2703 Å from Val87 CG2, with no ligand contact or bridge. No metal/cofactor is in the 8 Å shell.
- Chemistry/type compatibility: standard protein C/N/O/S and the six BNZ carbons map to existing `ME_XS_TYPING_V1_1_0`/CORE_DRY_V1 chemistry; BNZ carbon maps to `C_H`. No new XS type or scoring term is proposed.

## Candidate-specific preparation decision proposal

The records support a reviewable proposal, not an approved profile:

1. Record `target_pH = 6.9` only as a **crystallization-context proxy**: source reports 277 K and 2.0–2.2 M K/Na phosphate, pH 6.9, with 5 mM BME and 5 mM oxidized BME. RCSB also says complexes were prepared by soaking or vapor diffusion, without assigning which route or a distinct 3DMX ligand-soak/binding-solution pH. Do not claim pH 6.9 is the ligand-binding-solution pH or proof of any microscopic state.
2. If an owner authorizes that proxy, the candidate microstate hypothesis is standard acid/base side-chain charge at that declared context, neutral HID for HIS31, protonated N terminus, deprotonated C terminus, no caps, and no disulfides. This state is explicit and unranked by a pKa predictor. HIS31 ND1 is 2.672 Å from Asp70 OD2; its neutral delta-N tautomer is a geometry-supported proposal, while its charge state remains experimentally unresolved. HIS31 is 19.125 Å from the nearest BNZ atom and is remote from the reference-pose scoring site, but its state still belongs in the full receptor ChemicalState.
3. Preserve every selected receptor and ligand heavy-atom coordinate exactly. Generate only explicitly mapped hydrogens after the chemical state and toolchain are approved; do no minimization, heavy-atom repair, side-chain flip, or hydrogen-bond optimization that can move/rename heavy atoms. For BNZ, use CCD ideal geometry aligned to the six immutable 3DMX carbons; never copy CCD `model_Cartn_*` hydrogen positions, which are example coordinates from a different source structure.
4. Use the existing `ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0`, `ME_DOCKING_V1_LIGAND_EXPLICIT_STATE_1_0`, and `ME_DOCKING_V1_KINEMATIC_MODEL_1_0` semantic contracts. Keep source evidence, state objects, prepared states, and derived scorer representation separate. Canonical state digests would use `ME_CANONICAL_CBOR_V1_1_0` and domain-separated SHA-256 only after a real state exists.
5. The proposed reference-ligand SearchRegion is the exact six-carbon BNZ envelope with 0.000 Å per-axis padding, closed AABB, and all-heavy-atom containment. The geometry-only scoring-field support check in `SEARCHREGION_GEOMETRY.md` is PASS; no SearchRegion object or scoring field was created.
6. Derive `search_torsion_count = 0` from the six-member aromatic ring and no eligible acyclic rotor. The expected scorer `N_tors_vina = 0` is a separate D3-TOR result because no rotatable branch or terminal-H-only rotor exists. Preserve the two fields separately; exact imported TORSDOF evidence belongs to the later authorized representation.

## Why HOLD

The current D3-GRID-DEC-02 owner record says no preparation profile is approved and leaves it for a separate evidence-based owner decision after suitable D2-sealed prepared-state/full-pose evidence. The current Source of Truth repeats that boundary. PHD-V2-15 excludes unvalidated automatic protonation/pKa, tautomer, and conformer-generation choices from ordinary V1; PHD-V2-03 requires explicit pH/state/provenance and user authorization for materially hypothesis-changing choices not uniquely governed by a named profile. No approved 3DMX pH/microstate profile, exact hydrogen-generation profile, package/container digest, executable hash, or command/configuration exists in the authoritative evidence reviewed.

The current user task authorizes this scientific analysis and a recommendation. It does not document the missing specific owner decision or amend the earlier owner record. I therefore do not convert the proposal into an owner approval. Optional independent review is not treated as a gate: no controlling PHD-V2 rule makes it mandatory for this candidate decision.

## Smallest next integration step

The project owner records an explicit, scoped decision or amendment that permits one 3DMX/BNZ bootstrap development preparation before the general profile is approved; accepts or replaces the pH 6.9 crystallization-proxy and HIS31/terminal-state proposal; and authorizes a pinned hydrogen-only toolchain/profile-lock step. That lock must contain exact software/runtime/dependency hashes and a fail-closed command/configuration before a separate preparation task is authorized. Independent review may be requested by the owner but is not a contract-required blocker.

Full D3 remains HOLD. D4 remains BLOCKED. `DOCKING.RUN` remains UNAVAILABLE.

## Evidence and verification

- Source freeze and exact hashes: [SOURCE_STATE_FREEZE.md](SOURCE_STATE_FREEZE.md)
- Protonation, pH, and H proposal: [RECEPTOR_CHEMICAL_STATE_PROPOSAL.md](RECEPTOR_CHEMICAL_STATE_PROPOSAL.md)
- Alternates and components: [ALTLOC_COMPONENT_POLICY.md](ALTLOC_COMPONENT_POLICY.md)
- BNZ graph/typing/torsions: [BNZ_LIGAND_STATE.md](BNZ_LIGAND_STATE.md)
- SearchRegion math: [SEARCHREGION_GEOMETRY.md](SEARCHREGION_GEOMETRY.md)
- Toolchain and state-serialization status: [TOOLCHAIN_AND_STATE_CONTRACT.md](TOOLCHAIN_AND_STATE_CONTRACT.md)
- Authority and approvals: [AUTHORITY_APPROVAL_REGISTER.md](AUTHORITY_APPROVAL_REGISTER.md)
- Finite blockers: [OPEN_BLOCKERS.md](OPEN_BLOCKERS.md)
- Read-only ionizable proximity audit: [IONIZABLE_RESIDUE_PROXIMITY.csv](IONIZABLE_RESIDUE_PROXIMITY.csv), generated by [ionizable_proximity.py](audit/ionizable_proximity.py)
- SHA-256 inventory: [SHA256SUMS.txt](SHA256SUMS.txt)
