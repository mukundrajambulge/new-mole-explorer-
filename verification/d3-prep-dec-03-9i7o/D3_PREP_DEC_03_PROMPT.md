# D3_PREP_DEC_03 — candidate-specific authorization request for 9I7O

## Decision requested

Decide whether to authorize a later, isolated preparation-only review of the source-resolved 9I7O retinol complex under the project's applicable PHD-V2 and CORE_DRY_V1 requirements. This prompt requests authorization; it does not perform preparation and must not be interpreted as approval.

## Proposed source state

- Structure: PDB `9I7O`, one deposited X-ray model, 2.00 Å.
- Receptor: protein entity 1, chain A, deposited asymmetric-unit monomer; RCSB author-assigned biological assembly 1 is monomeric.
- Ligand: entity 2, asym B / author chain A, residue 500, component `RTL`, 21 heavy atoms, occupancy 0.720; noncovalent.
- Natural-source record: primary paper describes lyophilized bovine milk beta-lactoglobulin powder (Sigma L3908) and native A/B variants. It does not establish a homogeneous lot genotype. The deposited protein is natural P02754, without an engineered tag/mutation. Treat the major deposited A state as a coordinate conformer, not proof of pure variant A in the sample.
- Alternative state: mature residues 64 and 118 are modeled as natural variants (precursor 80/134; A occupancy about 0.746 and B about 0.254); Phe105 rotamer A is 0.720 and B 0.280. RTL is 0.720. Use one coherent major-A state only if authorized; minor Phe105 B clashes with RTL. Retain the alternates and occupancy evidence in the audit record.
- Sequence gaps: mature Leu17 is not modeled; this is the first residue of the mature protein after the cleaved 1–16 signal peptide. Internal precursor 127–130 (mature 111–114, AEPE) is unresolved. Leave both gaps untouched. The homolog-based remote-site assessment for AEPE is an inference, not an observation from 9I7O.
- Crystallization pH discrepancy: the primary paper's detailed methods state pH 8.5 for both protein buffer and reservoir; RCSB entry metadata lists pH 7.4. The preparation authorization must explicitly affirm which documented condition should inform any pH-dependent preparation choices. Do not silently substitute one value.
- CORE_DRY_V1: the `RTL` CCD atom graph maps to supported types (`C_H` x19, `C_P` x1, `O_DA` x1). The model contains no metal or non-water cofactor. There is no modeled direct water bridge to the retinol hydroxyl; closest water to O1 is about 6.57 Å. The water-free choice is source/literature-screened, not proven by distance alone.

## If authorization is granted

Limit any future work to the expressly approved preparation scope and record its input source hash, explicit assembly/chain, major-altloc policy, component/type map, missing-residue policy, water policy, and pH decision. Do not rebuild Leu17 or AEPE. Do not infer or collapse sample genotype beyond the selected deposited major coordinate state. Stop if the authorized scope cannot preserve these decisions or if unsupported components/types are discovered.

This request does not authorize scoring, docking, direct-grid work, scorer changes, D4 work, or production-lane state changes. Until separate gate decisions are made, full D3 stays HOLD, D4 stays BLOCKED, and `DOCKING.RUN` stays unavailable.

## Primary references

- [Primary article and experimental methods](https://doi.org/10.1016/j.foodchem.2026.150783)
- [RCSB 9I7O entry](https://www.rcsb.org/structure/9I7O) and [experimental details](https://www.rcsb.org/experimental/9I7O)
- [UniProt bovine beta-lactoglobulin P02754](https://www.uniprot.org/uniprotkb/P02754)
- Canonical CORE_DRY_V1 types: PHD-V2-06, `https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit`
