# D3-4W52-SRC-01 — 4W52 / BNZ Source Resolution

**Classification:** D3-4W52-SRC-01 HOLD — AUTHOR/PRIMARY-SOURCE CLARIFICATION REQUIRED

**Internal fixture disposition:** SOURCE_UNRESOLVED — RETIRE FROM CURRENT CORE_DRY_V1 FIXTURE PATH pending new evidence.

## Decision

The current official 4W52 record defines a 172-residue deposited polymer sequence and a 164-residue coordinate model. It identifies R12G, L99A, I137R and a C-terminal LEHHHHHH expression-tag extension. The deposited structure, current validation report, UniProt reference, benzene component record, local solvent shell and component inventory were independently checked and frozen here. The current official mmCIF is byte-identical to the source retained by D3-EXT-FIX-01.

The exact sequence in the deposited entity is clear. The accessible primary article says the T4 lysozyme/L99A construct was prepared as described in its Supporting Information. A correction notice confirms that the SI was corrected online, but the corrected SI file could not be retrieved from the official PNAS endpoint (403) or the tested PMC supplement path (404). Neither the accessible article nor the deposited entity establishes whether LEHHHHHH was cleaved before crystallization or remained physically present but disordered. The physical C-terminal state, and therefore whether residue 164 is chemically terminal, cannot be frozen without inference. The source record also does not establish whether R12G and I137R were intentional mutations or background construct variants.

This source gate therefore does not admit 4W52 to CORE_DRY_V1 and does not issue D3_PREP_DEC_03_PROMPT.md. It prepares a narrow clarification request without sending it and records a batch-oriented next-fixture strategy. No molecular preparation, hydrogen addition, protonation, coordinate modification, PDBQT generation, scoring or docking was performed.

## Findings at a glance

| Item | Finding |
|---|---|
| Official source | PDB 4W52, DOI 10.2210/pdb4w52/pdb, entry version 1.6, revision 2023-09-27 |
| Current mmCIF | 216,440 bytes; SHA-256 29636d4be96bd30079007ffd65835fc351bf751238e701068d1b4d924aaf8a22 |
| Method / resolution | X-ray diffraction; 1.50 Å |
| Biological assembly | Assembly 1, monomer A1; model 1; receptor label/auth chain A |
| Deposited / modeled protein | 172 entity positions / 164 modeled residues, positions 1–164 |
| Sequence differences | R12G and I137R called variants by validation; L99A called engineered; exact origin of R12G/I137R unresolved |
| C-terminal extension | Deposited and validation-annotated LEHHHHHH at 165–172; coordinates absent; physical cleavage/retention unresolved |
| BNZ | Benzene, neutral CCD component, complete six-carbon coordinate ring, occupancy 0.70, no altloc; ligand identity is resolved |
| Receptor altlocs | 13 protein residues audited; M106 branches are 7.720/7.986 Å from BNZ by alt-specific atoms; no branch-specific atom is within 5 Å; one modeled F-helix backbone has 0.90 occupancy while BNZ is 0.70, an occupancy relationship the accessible sources do not reconcile |
| Water | 146 water sites; none within 5 Å; one within 8 Å at 7.841 Å; no simultaneous ≤3.5 Å ligand/protein bridge |
| EPE | One 15-heavy-atom HEPES component, occupancy 1.0, 12.445 Å from BNZ |
| Other non-polymers / metals | No other non-polymer component and zero metal atoms in the asymmetric-unit source |
| Admission | Not CORE_DRY_V1-admissible; source-unresolved pending authoritative clarification |

## Evidence package

- Source and retrieval inventory: SOURCE_ARTIFACT_FREEZE.md
- Sequence comparison and all positions: CONSTRUCT_SEQUENCE_RECONCILIATION.md and SEQUENCE_POSITION_MAP.csv
- Mutation, tag and terminal decisions: R12G_I137R_L99A_AUDIT.md, EXPRESSION_TAG_AUDIT.md and C_TERMINAL_STATE_DECISION.md
- Coordinate and component audits: MODELED_VS_DEPOSITED_RESIDUES.md, ALTERNATE_CONFORMATION_AUDIT.md, BNZ_SOURCE_STATE.md, WATER_CONFIRMATION_AUDIT.md, EPE_COMPONENT_AUDIT.md and NONPOLYMER_AND_METAL_AUDIT.md
- Quality, evidence classes and admission: STRUCTURE_QUALITY_SUMMARY.md, EVIDENCE_HIERARCHY.md and CORE_DRY_V1_ADMISSION_DECISION.md
- Outstanding issue and next steps: OPEN_BLOCKERS.md, AUTHOR_CLARIFICATION_REQUEST.md and NEXT_FIXTURE_STRATEGY.md
- Reproducible source checks: tools/ and source_artifacts/derived/

## Preserved project gate state

PyMOL remains protected; D1 and D2 remain accepted; D3-TOR-01 and D3-SCI-04 remain preserved; D3-GRID-01 remains bounded PASS; full D3 remains HOLD; D4 remains BLOCKED; DOCKING.RUN remains unavailable. This task does not accept D3.

## Final classification

**D3-4W52-SRC-01 HOLD — AUTHOR/PRIMARY-SOURCE CLARIFICATION REQUIRED**
