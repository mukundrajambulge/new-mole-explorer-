# D3-FIXTURE-READY-03 — preparation-ready `CORE_DRY_V1` fixture selection

## Final classification

**D3-FIXTURE-READY-03 PASS — SOURCE-RESOLVED PREPARATION-READY CORE_DRY_V1 FIXTURE SELECTED**

Exactly one candidate receives `SOURCE_RESOLVED_AND_PREPARATION_READY_FOR_CORE_DRY_V1`: **RCSB 3DMX / BNZ (benzene)**. The pass identifies a fixture for the next preparation-decision gate; no preparation was performed or authorized.

## What was examined

- Existing candidate evidence began with the preserved **28-entry** retinol cohort. Of its original 15 detailed/deep entries, 9I7O remained closed under the latest HOLD/rejection; the other **14** were freshly audited against current official coordinates and source records. Those 14 produced no YES.
- One fixed external batch of **9** benzene-bound T4 lysozyme records was screened. There was no second expansion. Four external entries stopped at terminal-sequence screening; four plus the cohort's 1CRB were deeply preflighted, for **5 deep finalists** total: 1CRB, 3DMX, 3HH4, 227L, and 4I7J.
- The auditable source script covers 23 open entries (14 cohort plus 9 external), with atom-level receptor/ligand inventory and per-candidate chain, terminus, link, alternate, water and non-water component matrices. 9I7O is not one of those 23 rows.

## Finalist outcomes

| Finalist | Receptor heavy-atom status | Missing residues / termini | Alternates | Ligand | Water | Metals / components | Preparation feasibility |
|---|---|---|---|---|---|---|---|
| 1CRB / RTL | 0 missing sites | 0 missing positions; N/C and OXT complete; 133/133 links | None within 8 Å | 21/21, occ 1.0; RSCC .86 / RSR .08, 5 bond and 2 angle outliers | 6 ≤5 Å, 10 ≤8 Å; nearest 3.6239 Å; primary source describes RTL–Gln108 H-bond | Two receptor-coordinated Cd ions at 14.7001/18.9515 Å; no component within 8 Å, but omission/state is unresolved | UNKNOWN / HOLD |
| **3DMX / BNZ** | **0 missing sites** | **0 missing positions; N/C and OXT complete; 163/163 links** | **MET106/GLU108 A/B, each major A 0.7, >7.6 Å; no direct geometry change** | **6/6, occ 1.0, neutral single graph; RSCC .97 / RSR .05, no outliers** | **0 ≤5 Å, 1 ≤8 Å; nearest 7.8253 Å; no ligand contact/bridge or essential-water report** | **No metal; HED >10.8 Å and PO4 >15.3 Å, outside pair shell** | **YES — SELECTED** |
| 3HH4 / BNZ | 1 terminal atom missing (OXT) | C endpoint residue modeled but terminal OXT absent | 4 residues within 8 Å | 6/6, occ 1.0, single state | 0/0; nearest 8.0308 Å | No unsupported component within 8 Å | NO — terminal heavy-atom blocker |
| 227L / BNZ | 0 partial sites | C-terminal entity positions 163–164 absent; false terminus | None within 8 Å | 6/6, occ 1.0, single state | 5/15; nearest 2.9646 Å | No metal within 8 Å | NO — terminal and dry-state blockers |
| 4I7J / BNZ | 27 missing sites over 11 residues | N positions 1–12 and internal 59 absent; N/tag continuation unresolved | Lys108 at 6.3461 Å | 6/6, occ 1.0, single state | 0/1; nearest 7.9044 Å | No metal within 8 Å | NO — incomplete receptor and false-terminal blockers |

Every finalist-specific blocker and affirmative item is detailed in `FINALIST_PREPARATION_PREFLIGHT.md`; full tables are in `PREPARATION_READINESS_MATRIX.csv`, `D3_REPRESENTABILITY_MATRIX.csv`, `LIGAND_STATE_MATRIX.csv`, and the component/water/alternate/atom/gap matrices.

## Why 3DMX passes

3DMX is a 1.80 Å X-ray T4 lysozyme L99A hydrophobic-cavity complex, with the additional C54T/C97A substitutions explicitly annotated, *E. coli* expression, a complete deposited 164-position chain and RCSB assembly 1 monomer A1. It contains the directly observed neutral BNZ ligand with all six expected heavy atoms at occupancy 1.0. The current RCSB ligand validation is strong (RSCC 0.97, RSR 0.05, no reported ligand geometry/clash outliers), and the primary paper describes benzene binding in a hydrophobic internal cavity.

The selected receptor has no missing residues or atoms, has both true termini and OXT, and passes all 163 sequential peptide C–N distance checks. The lone water in the 8 Å shell is 7.8253 Å from benzene, makes no ligand contact, and does not create a bridge. No metal/cofactor or other non-water component lies in the 8 Å pair shell. The pair's standard protein C/N/O/S and aromatic BNZ carbon use existing XS support and five scoring terms. The rigid BNZ ring needs no rotatable search bond; scorer `N_tors_vina` remains a separate future derivation.

Ligand bounds plus the existing 8 Å cutoff and one-cell 0.375 Å interpolation halo yield an approximate 50 × 52 × 52-node containment box, within the 110-node dimension limit. This is only a geometry estimate; no SearchRegion, field, direct/grid score, or docking was generated.

## Required outputs and status

- `D3_PREP_DEC_04_PROMPT.md` is generated and is bound to 3DMX/BNZ. It asks DEC-04 to resolve preparation-state choices and provenance without re-running source/structural admission and without preparing the structure.
- `source_artifacts/SOURCE_MANIFEST.csv` records source URLs, file roles, lengths, retrieval date, and SHA-256 for 103 retained current RCSB artifacts. `SHA256SUMS.txt` hashes every authored and retained lane file other than itself.
- The atom audit distinguishes partial modeled residues from missing sequence positions, checks only the true endpoint for terminal OXT, unions alternate atom sites for completeness while retaining per-state altloc detail, and records ligand-distance evidence. No coordinates were repaired or edited.
- Full D3 remains HOLD; D4 remains BLOCKED; `DOCKING.RUN` remains unavailable.

Repository base, branch/worktree isolation, preserved worktree inspection, and canonical contract references are recorded in `PREFLIGHT_RECORD.md`. See `CANDIDATE_SELECTION_DECISION.md` and `SELECTED_PREPARATION_READY_FIXTURE.md` for the formal decision and handoff.
