# 3ATL source and construct reconciliation

## Frozen digital source

| Field | Verified value |
|---|---|
| PDB accession | 3ATL |
| Source artifact | verification/d3-prep-cand-02/source_artifacts/3ATL.cif |
| SHA-256 | 453f370fcccc9181ee64f664164372f0b6a1043cb7df66ba8da84f924e5a4b46 |
| Size | 263,005 bytes |
| Current official download | https://files.rcsb.org/download/3ATL.cif |
| Re-fetch result, 2026-10-02 | Same size and SHA-256; byte-for-byte identical |
| Method / resolution / models | X-ray diffraction / 1.74 Å / one model |
| Reported crystal-growth context | pH 8.5, 277 K; sitting-drop vapor diffusion |

The reported pH is bulk crystal-growth context only. It is not evidence for any one microscopic protein or ligand protonation state. Official entry metadata: [RCSB 3ATL](https://www.rcsb.org/structure/3ATL), [RCSB experimental record](https://www.rcsb.org/experimental/3ATL), and [wwPDB entry](https://www.wwpdb.org/pdb?id=pdb_00003atl).

## Receptor chain, construct and termini

The deposited protein is entity 1, cationic trypsin from Bos taurus, label asym A / author chain A, model 1. The declared sequence has 223 of 223 label positions observed. The candidate audit records no missing standard protein heavy atoms, receptor alternate conformations, chain breaks, or sequence-difference records.

The source cross-reference is UniProt P00760, with source alignment beginning at UniProt precursor residue 24. The current official 246-residue P00760 FASTA was fetched and compared directly: the source's 223-residue declared polymer sequence exactly equals UniProt positions 24–246. It is consistent with the cleavage after Lys23 noted for beta-trypsin. Thus the digital source contains the mature N-terminal Ile at label residue 1 and terminal Asn at label residue 223; there is no evidence here for an engineered affinity tag or a missing terminal segment. UniProt P00760 is a 246-residue precursor and records cationic trypsin/beta-trypsin and cleavage after Lys23: [UniProt P00760 sequence](https://rest.uniprot.org/uniprotkb/P00760.fasta) and [UniProt record](https://rest.uniprot.org/uniprotkb/P00760.txt).

Deposited label_seq_id and author residue numbers are not interchangeable. Preserve both identifiers in any future source map. The deposited structure declares assembly 1 as monomeric by author/PISA definition. This source-defined monomer is the bounded structural context for this candidate review; no claim about other biological associations is needed for the narrow S1 site decision.

The six deposited disulfide connections are:

| Label positions | Author chain/residue IDs | Deposited SG–SG distance |
|---|---|---:|
| 7–137 | A:25 – A:155 | 2.023 Å |
| 25–41 | A:43 – A:59 | 2.033 Å |
| 109–210 | A:127 – A:228 | 2.035 Å |
| 116–183 | A:134 – A:201 | 2.028 Å |
| 148–162 | A:166 – A:180 | 2.030 Å |
| 173–197 | A:191 – A:215 | 2.023 Å |

These are source-annotated covalent disulfides and must not be treated as free cysteine thiols in any future state. The coordinates and connection records are evidence, not prepared receptor chemistry.

## Ligand source instance

There is one BEN instance: model 1, label asym F, author chain A, author residue 5. All nine CCD heavy atoms are observed once with occupancy 1.00, with no alternate location. The source atom names are C1, C2, C3, C4, C5, C6, C, N1, and N2. No ligand hydrogen coordinates are present.

The receptor and ligand coordinates are source-faithful only. No PreparedReceptorState, PreparedLigandState, ChemicalState, or sealed CoordinateState exists in this package.

## Structural neighborhood summary

The source audit finds BEN near Asp189 and Ser190, in the trypsin S1 specificity pocket. The nearest measured deposited waters are 2.747 Å and 2.894 Å from BEN heavy atoms; the water-network audit lists every deposited water within 8 Å. Distances in this report are minimum distances between deposited heavy-atom coordinates. They do not alone establish hydrogen directionality or a protonation state.

## Source evidence

- Full source identity and inventory: verification/d3-prep-cand-02/CANDIDATE_SOURCE_INVENTORY.md and CANDIDATE_RAW_AUDIT.json.
- Candidate identity and comparison: verification/d3-prep-cand-02/D3_PREP_CAND_02_REPORT.md.
- Frozen source hash: verification/d3-prep-cand-02/SHA256SUMS.txt.
- PDB record: [RCSB 3ATL](https://www.rcsb.org/structure/3ATL) and [wwPDB entry](https://www.wwpdb.org/pdb?id=pdb_00003atl).
- Primary structure paper: [Yamane et al., 2011](https://doi.org/10.1107/S0021889811017717).
