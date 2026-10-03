# Existing 28-entry retinol cohort rescreen

## Scope

The preserved D3-FIXTURE-COHORT-02 query contains 28 distinct RCSB entry IDs. Its earlier detailed/deep subset contained 15 entries. 9I7O is specifically closed under the latest D3-PREP-DEC-03 rejection and was not reopened. The other 14 detailed entries were re-audited from current official mmCIF coordinates and current RCSB entry/polymer/validation records. The 13 original fast exclusions were not promoted or re-opened; their preserved cohort rationale remains controlling.

The full atom-by-atom source results are in `audit/MISSING_ATOM_AUDIT.csv`, `audit/MISSING_RESIDUE_AUDIT.csv`, `audit/TERMINUS_AND_CHAIN_CONTINUITY_MATRIX.csv`, and `audit/source_audit_summary.csv`. Candidate dispositions are in `PREPARATION_READINESS_MATRIX.csv`.

## Screen result

No still-open cohort candidate received `SOURCE_RESOLVED_AND_PREPARATION_READY_FOR_CORE_DRY_V1`.

- **1CRB / RTL** is the strongest complete receptor-state screen: 134/134 sequence positions, 0 missing receptor heavy-atom sites, both termini including OXT, 133/133 continuous peptide links, no binding-site altloc, and 21/21 ligand atoms at occupancy 1.0. It remains HOLD because the source contains two receptor-coordinated Cd ions 14.70 Å and 18.95 Å from retinol, with no CORE_DRY_V1 coordination representation and no source-grounded omission decision. The validation report also records five RTL bond-length and two bond-angle outliers (RSCC 0.86, RSR 0.08). This is not treated as a preparation-ready state.
- **1KT5 / RTL** has no sequence gap but lacks the true C-terminal OXT heavy atom and has 4 waters within 5 Å / 12 within 8 Å; the source paper describes the retinol-associated hydrogen-bond/water context.
- **5LJB / RTL** is missing the entity N-terminal residue; **1GX8 / RTL** also lacks its entity N-terminal residue and has multiple alternate pocket residues, including PHE105/MET107 within 5 Å.
- **6PY0 / RTL** is missing entity position 1 and internal positions 73–74; His71 omits six heavy atoms. The loop/state and oligomer context therefore remains unsuitable for a complete receptor input.
- **5HBS, 5H8T, 1AQB, 1HBP, 4QZT, 9I7N, 1FMJ, and 1RBP** fail a terminal, internal-gap, incomplete-sidechain, near-site alternate, ligand-state, nearby component, or combination of these hard filters, as detailed in the matrices.

The closed 9I7O rejection is not part of the 14-entry fresh rescreen. Its corrected sequence interpretation and unchanged disposition are recorded separately in `9I7O_RECONCILIATION_REFERENCE.md`.

## Decision

The existing detailed cohort produced no candidate with an affirmative preparation-feasibility answer. One finite, externally sourced nine-entry screen was therefore conducted under `EXTERNAL_EXPANSION_PROTOCOL.md`. No additional search generation is authorized or proposed.
