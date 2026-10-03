# Candidate selection decision

## Decision

**Selected pair: RCSB 3DMX / BNZ (benzene)**

Classification: `SOURCE_RESOLVED_AND_PREPARATION_READY_FOR_CORE_DRY_V1`

Preparation-feasibility answer: **YES**.

3DMX is the only one of five deep finalists that passes the source, complete-heavy-atom, true-terminus, single-ligand-state, water, unsupported-component, and current-profile representability gates. The detailed per-candidate decisions for the complete fresh screen are in `PREPARATION_READINESS_MATRIX.csv`.

| Deep finalist | Receptor heavy atoms | Missing sequence / terminal state | Receptor alternates ≤8 Å | Ligand | Water ≤5/≤8 Å; nearest | Metal/cofactor and other local components | Decision |
|---|---:|---|---|---|---|---|---|
| 1CRB / RTL | 0 missing | 0 gaps; both termini, OXT; 133/133 links | None | 21/21, occ 1.0; RSCC .86 / RSR .08; 5 bond and 2 angle outliers | 6/10; 3.6239 Å; source describes retinol–Gln108 H-bond | Cd ions coordinate receptor at 14.7001/18.9515 Å; omission and receptor-state effects unresolved | HOLD / UNKNOWN |
| **3DMX / BNZ** | **0 missing** | **0 gaps; both termini, OXT; 163/163 links** | **MET106 and GLU108 at 7.63–8.00 Å; A 0.7/B 0.3, no direct contact geometry change** | **6/6, occ 1.0, single neutral graph; RSCC .97 / RSR .05; no ligand outliers** | **0/1; 7.8253 Å; no ligand contact or bridge** | **No metal; nearest HED 10.8478 Å; PO4 15.3395 Å** | **PASS / YES — SELECTED** |
| 3HH4 / BNZ | 1 terminal OXT missing | 0 sequence gap; C endpoint observed but OXT absent | 4 residues, nearest 7.2946 Å | 6/6, occ 1.0, single state | 0/0; nearest 8.0308 Å | No unsupported component ≤8 Å | REJECTED |
| 227L / BNZ | 0 partial sites | C-terminal 163–164 absent; false terminus | None | 6/6, occ 1.0, single state | 5/15; 2.9646 Å | No metal within 8 Å | REJECTED |
| 4I7J / BNZ | 27 missing atoms in 11 residues | N-terminal 1–12 plus internal 59 absent; 13 total positions | Lys108 at 6.3461 Å | 6/6, occ 1.0, single state | 0/1; 7.9044 Å | No metal within 8 Å | REJECTED |

No numeric ranking was used. Each non-selected structure fails its own admission criteria. 1CRB is not admitted on the basis of being complete because its coordinated Cd state is unsupported/unresolved and its deposited RTL geometry carries multiple validation outliers. The accepted candidate is not a “least-bad” choice: it independently has a complete observed receptor and ligand, true termini, clear ligand graph, and a hydrophobic cavity supported by its primary source.

## Why 3DMX is source-resolved

- RCSB identifies the source as T4 lysozyme, with full 164-residue entity sequence, *E. coli* expression, and an explicit designed mutant. The residue substitutions are annotated as C54T, C97A, and L99A; the L99A internal hydrophobic cavity is the ligand-binding construct, not an unexplained mismatch.
- The selected source mapping is deposited polymer chain label/auth A, entity 1, and BNZ label asym G/auth chain A/residue 900, mapped to the BNZ CCD component. It is the experimental X-ray structure at 1.80 Å resolution, Rwork 0.182 and Rfree 0.208.
- RCSB assembly 1 identifies the author/PISA monomer A1. The 164/164 modeled residues align to the deposited entity; no extra tag or unmodeled construct continuation is indicated for the selected construct.
- The primary paper is [Merski et al., Journal of Molecular Biology (2009)](https://doi.org/10.1016/j.jmb.2008.10.086); the [RCSB entry](https://www.rcsb.org/structure/3DMX) and [experimental details](https://www.rcsb.org/experimental/3DMX) are retained as provenance.
- The [RCSB BNZ chemical component](https://www.rcsb.org/ligand/BNZ) defines benzene as neutral C6H6 with six aromatic carbons, one graph, no stereocenters, and no protomer/tautomer ambiguity.

## Scope of the pass

The decision grants no preparation execution, pH choice, protonation, hydrogen addition, coordinate editing, prepared-state serialization, scoring, docking, scorer changes, PyMOL changes, or D4. It identifies the one fixture that has completed the source/structural preflight and writes a candidate-specific DEC-04 prompt. Full D3 remains HOLD, D4 remains BLOCKED, and `DOCKING.RUN` remains unavailable.
