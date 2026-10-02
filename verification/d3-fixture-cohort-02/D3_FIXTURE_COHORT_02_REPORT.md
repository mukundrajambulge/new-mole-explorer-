# D3-FIXTURE-COHORT-02 — cohort result

## Decision

**D3-FIXTURE-COHORT-02 PASS — SOURCE-RESOLVED CORE_DRY_V1 FIXTURE SELECTED**

Selected candidate: **PDB 9I7O**, beta-lactoglobulin bound to all-trans-retinol. Its source is resolved sufficiently to move directly to the candidate-specific `D3_PREP_DEC_03_PROMPT.md` authorization gate. This decision is not preparation authorization.

Project state remains **full D3 HOLD**, **D4 BLOCKED**, and **`DOCKING.RUN` unavailable**.

## Why 9I7O advances

The primary study reports bovine milk beta-lactoglobulin powder and native A/B variants. The deposited model is natural Bos taurus P02754 and uses one author-designated monomer. It contains the complete 21-heavy-atom RTL instance at 0.720 occupancy. A coherent major coordinate state matches the ligand occupancy; the minor Phe105 state clashes and is excluded from the proposed state. The 19 `C_H`, one `C_P`, and one `O_DA` atom types are all in CORE_DRY_V1.

The source is not a homogeneous-variant claim. The natural A/B polymorphs remain explicit, the lot's genotype proportions are not reported, mature Leu17 and internal AEPE residues 111–114 are unresolved, and no residues will be rebuilt. The internal gap's remoteness is an inference from a homolog and is carried as a warning. The paper's crystallization method says pH 8.5, while RCSB metadata says 7.4; the preparation authorization prompt requires this discrepancy to be affirmed before any pH-dependent preparation choice.

The deposited complex contains no metal/cofactor or non-water components. It has 35 water sites but no direct modeled water bridge to retinol O1. No literature requirement for a water-supported retinol state was identified. This supports a dry representation for the source gate, with water absence explicitly documented rather than asserted from distance alone.

## Cohort record

The exact RCSB `RTL` cohort contains 28 entries. The staged screen retains 15 for detailed review and five for deep finalist comparison. 9I7N is a paired detailed comparator from the same study, not an extra finalist. All entries and evidence-linked rationales are in `COHORT_SCREEN_DECISION_MATRIX.csv`; source and coordinate records are in `COHORT_SOURCE_TRACTABILITY_MATRIX.csv`.

Deep finalists were 5LJB, 1KT5, 1GX8, 6PY0, and 9I7O. 1KT5 was excluded because its source study discusses a retinol-associated water/H-bond network; 1GX8 because of weaker model validation, alternate state, and a close dimer mate; 6PY0 because its recombinant SAA3 trimer has an unresolved binding-loop segment; and 5LJB because it has a recombinant source and less direct support for dry-profile omission around its polar/water contact context. The selected candidate has the best bounded combination of source transparency, explicit ligand state, monomer context, and supported atom types.

## Source references

- [Primary 9I7O article and experimental methods](https://doi.org/10.1016/j.foodchem.2026.150783)
- [RCSB 9I7O entry](https://www.rcsb.org/structure/9I7O) and [experimental details](https://www.rcsb.org/experimental/9I7O)
- [UniProt P02754](https://www.uniprot.org/uniprotkb/P02754)
- Official wwPDB validation report: `source_artifacts/validation/9I7O_full_validation.pdf`.

The report, methods, predecessor register, structural review, candidate decision, authorization prompt, checksums, and preflight record are in this evidence-only lane. No preparation, scoring, docking, production, or D4 changes were made.
