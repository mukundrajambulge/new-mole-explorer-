# MOLE EXPLORER — D3-PREP-DEC-02
## 3ATL / BEN candidate-specific preparation authorization review

You are continuing Mole Explorer / Mole Studio. This is a new authorization decision gate for one selected candidate. It is not a preparation or docking task.

## Objective

Review whether 3ATL with its deposited BEN ligand may be authorized for a future development-only PreparedReceptorState + PreparedLigandState fixture. Produce a candidate-specific authorization decision and exact execution handoff specification. Do not perform preparation in this gate.

This prompt is based on D3-PREP-CAND-02 selection evidence. Re-read current canonical Drive sources and the complete 3ATL source artifact before deciding. A selection PASS is not scientific approval.

## Frozen source identity to verify

- PDB accession: 3ATL.
- Current official artifact: https://files.rcsb.org/download/3ATL.cif
- Retained evidence artifact: verification/d3-prep-cand-02/source_artifacts/3ATL.cif
- SHA-256: 453f370fcccc9181ee64f664164372f0b6a1043cb7df66ba8da84f924e5a4b46
- RCSB entry: https://www.rcsb.org/structure/3ATL
- Experimental conditions: https://www.rcsb.org/experimental/3ATL
- Method/resolution/model: X-ray diffraction, 1.74 Å, one model.
- Polymer: cationic bovine trypsin, entity 1, label/auth chain A, 223 residues declared and all 223 modeled.
- Ligand: CCD component BEN, benzamidine, C7H8N2, nine heavy atoms, label asym F / author chain A / residue 5 / model 1, all nine observed at occupancy 1.00.
- BEN is not BNZ. CCD BEN is benzamidine; CCD BNZ is benzene.
- Deposited crystal-growth pH is 8.5 at 277 K.
- Current inventory reports no missing standard protein heavy atoms, no receptor alternate conformations, no chain breaks, six disulfide connections, one calcium, three DMS instances, and 317 water atoms.

Independently recalculate hashes and verify entry identity and exact ligand instance. Do not edit source artifacts.

## Required authorization questions

### 1. Receptor identity, construct, and termini

- Reconcile deposited sequence with mature bovine trypsin and authoritative UniProt/source publication.
- Verify mature N/C boundaries and that modeled endpoints are true biological construct termini.
- Verify all 223 positions and six disulfide pairs.
- Inventory histidines and every titratable side chain or terminus near the site.
- Determine whether the S1 site requires any biological assembly context.
- No mutation, terminus, missing atom, or disulfide assumption may be silent.

### 2. BEN graph, chemical state, and atom mapping

- Compare the 3ATL BEN atom graph, bond orders, aromaticity, and atom names against current RCSB CCD and an authoritative benzamidine source.
- Explain why BEN is not benzene and why BNZ is another component.
- CCD BEN records a neutral composition without ligand hydrogens. Deposited coordinates do not determine H placement.
- Crystal-growth pH is 8.5. A reported conjugate-acid pKa near 11.6 strongly suggests amidinium +1 in bulk solution. This is an inference. Decide whether authoritative chemical analysis and independent review support a bound amidinium state and define resonance/atom-charge mapping for approved D3 typing/scoring.
- If formal state, tautomer/resonance mapping, or atom assignment remains uncertain, return HOLD. Do not default to the neutral CCD state or generate states automatically.

### 3. Crystallographic waters and supported receptor model

- Inspect every water within 8 Å and the network around BEN, Asp189, Ser190, and Tyr228.
- Review primary structural evidence and the study describing W1 as a bridge from benzamidine to Ser190/Tyr228 and a reservoir near Asp189.
- Decide whether any water is essential to represent the experimental bound state. Separate deposited geometry from inferred functional roles.
- Current D3 consumes explicit prepared receptor/ligand states; no fixed-water special profile is approved by this prompt. Determine whether the defensible state is representable by an already approved profile.
- If an essential water cannot be encoded under an approved profile, reject 3ATL and return to candidate selection. Do not silently delete the network or invent a retention rule.

### 4. Calcium, DMS, and all other components

- Identify calcium coordination and whether calcium is structural, crystallization-derived, or otherwise relevant to protein integrity.
- Identify each DMS molecule and assess proximity/function.
- Decide retention/omission only with explicit evidence and atom-level policy. No blanket solvent or HETATM cleanup.
- Unsupported component or required metal parameters are stop conditions.

### 5. Chemical and hydrogen-state policy

- Use crystallization pH only as bulk context; it does not settle microscopic protein or ligand states.
- Resolve plausible histidine tautomers, acidic/basic side-chain states, cysteine/disulfide chemistry, termini, and hydrogen orientations around the pocket.
- Do not infer final states from package defaults.
- Propose deterministic settings only after state decisions and toolchain reproducibility are established.

### 6. Toolchain, provenance, and D3 contract mapping

Without running tools, specify for a future separately authorized execution:
- exact preparation programs, versions, immutable release/commit IDs, executable/container hashes, platform, deterministic settings;
- input/output hashes and atom-level source-to-state mapping;
- heavy-atom identity and coordinate immutability checks;
- PreparedReceptorState and PreparedLigandState fields and canonical digests;
- ligand torsion semantics and D3 Vina N_tors assignment;
- approved XS typing/scoring profile and charge model;
- future SearchRegion and digest policy, frozen only after state selection;
- identical state digests and geometry for direct/grid scoring;
- derivation log and failure codes.

Meeko, PDB2PQR, PROPKA, or package defaults are not approved merely because they appear in a proposal. Every choice needs reviewed settings and supported-contract evidence.

### 7. Cohort, reviews, and authorization record

- Confirm development-only cohort and identify its owner.
- Require independent structural-biology and computational-chemistry reviewers to sign the exact state proposal.
- Record the accountable project owner's explicit approval or rejection.
- Preserve dissent and unresolved objections.
- Define fail-closed conditions that return to candidate selection.

## Required outputs

Create a candidate-specific authorization report, state decision matrix, source/construct reconciliation, water/component policy, proposed preparation profile, provenance plan, reviewer/owner decision fields, and SHA-256 manifest. Do not fabricate approval signatures or scientific values. An unsigned approval field is a blocker.

## Prohibited actions

This gate does not authorize:
- adding, optimizing, or placing any hydrogen;
- changing protein or ligand protonation, tautomer, atoms, bonds, or coordinates;
- reconstructing missing atoms/residues;
- generating ligand conformers or protonation enumerations;
- creating PDBQT;
- docking, global search, or direct/grid molecular validation;
- changing implementation or project-wide D3/D4 status.

After this authorization review closes, a later separate execution task must receive explicit authorization before preparation runs. Full D3 remains HOLD, D4 remains BLOCKED, and DOCKING.RUN remains unavailable unless controlling gates independently change those states.
