# Candidate decision — PDB 9I7O

## Classification

**D3-FIXTURE-COHORT-02 PASS — SOURCE-RESOLVED CORE_DRY_V1 FIXTURE SELECTED**

Advance 9I7O directly to the candidate-specific `D3_PREP_DEC_03_PROMPT.md` authorization gate. This is a source-selection decision only. It does not authorize any preparation or docking operation.

## Source resolution

The primary article reports lyophilized bovine milk beta-lactoglobulin powder (Sigma product L3908), with retinol complexation. It describes native beta-lactoglobulin variants A and B; it does not report that the powder was a homogeneous single variant or publish the source lot's genotype proportions. The deposited P02754 sequence is the natural bovine protein, not a recombinant tagged construct or engineered mutant. The major deposited A coordinate state is coherent with the RTL occupancy. Keep the minor natural B sequence/rotamer state documented; do not call this a homogeneous A sample.

The primary article's crystallization methods specify 20 mM Tris, pH 8.5, protein at 40 mg/mL, and a reservoir of 0.5 M Tris pH 8.5 plus 2.0–2.5 M ammonium sulfate. RCSB metadata says pH 7.4. The detailed method is the more specific experimental description of the crystallization protocol, but the conflict is retained for the subsequent authorization decision.

The receptor is entity 1, chain A, in the author-designated monomer assembly. The ligand is the deposited 21-heavy-atom `RTL` instance at 0.720 occupancy. The major Phe105 A rotamer matches that ligand state; the minor B rotamer clashes and must not be mixed into the selected coordinate state. The supported CCD atom types fit CORE_DRY_V1.

The unmodeled mature N-terminal Leu17 and internal AEPE segment at precursor positions 127–130 remain gaps. The internal segment is considered remote by comparison with homolog 1GX8; this is a homolog-based inference and remains flagged. No residues are rebuilt. The source record has no metal/cofactor and no direct crystallographic water bridge at the retinol hydroxyl; no source-literature requirement for a water-supported ligand state was found. The water-free representation is admitted with this caveat.

## Independent review

The independent read-only structural review returned a qualified yes for direct progression to a candidate-specific preparation authorization prompt, conditional on explicit disclosure of the natural A/B mixture, internal gap, and pH discrepancy. Those conditions are present in the prompt below. No unresolved issue requires a new cohort-level escalation under the predecessor decision strategy.

## Decision boundary

No preparation has been performed or authorized. Candidate source-selection does not change project gate state: full D3 remains HOLD; D4 remains BLOCKED; `DOCKING.RUN` remains unavailable. A future preparation step requires a separate affirmative decision at `D3_PREP_DEC_03`.

## Evidence paths

- `COHORT_SOURCE_TRACTABILITY_MATRIX.csv` and `COHORT_SCREEN_DECISION_MATRIX.csv`
- `audit/9I7O_B_A_audit.json` and `source_artifacts/9I7O.cif`
- `source_artifacts/metadata/9I7O_entry.json`, `9I7O_polymer_entity.json`, and `9I7O_inventory.json`
- `source_artifacts/validation/9I7O_full_validation.pdf`
- `source_artifacts/primary_sources/` (article XML/source response, if present)
- Independent review notes are incorporated above; they were read-only and did not modify project files.
