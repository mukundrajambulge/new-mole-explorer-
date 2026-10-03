# Selected preparation-ready fixture: 3DMX / BNZ

## Classification

`SOURCE_RESOLVED_AND_PREPARATION_READY_FOR_CORE_DRY_V1`

This is the sole passing fixture in D3-FIXTURE-READY-03. It has passed source identity and structural completeness before selection, so it can move directly to candidate-specific `D3-PREP-DEC-04`. This document is a readiness record, not a prepared molecular artifact.

## Source identity

- **Entry / experimental source:** [RCSB 3DMX](https://www.rcsb.org/structure/3DMX), [primary study DOI 10.1016/j.jmb.2008.10.086](https://doi.org/10.1016/j.jmb.2008.10.086).
- **Experimental model:** X-ray, 1.80 Å; Rwork 0.182; Rfree 0.208.
- **Receptor:** T4 lysozyme, polymer entity 1, deposited chain label/auth A, all 164 entity positions observed. The engineered substitutions C54T, C97A and L99A are explicitly recorded; L99A creates the internal hydrophobic cavity used for benzene binding. The entry reports *E. coli* expression and bacteriophage T4 protein source. RCSB assembly 1 is the author/PISA monomer A1.
- **Ligand:** BNZ, label asym G, author chain A/residue 900, matched to the current RCSB CCD BNZ component. The deposited ligand has six of six expected heavy atoms, occupancy 1.0, no alternate ligand state, a neutral C6H6 one-graph aromatic ring, no stereocenters and no protomer/tautomer ambiguity. It is rigid, with zero search rotors. The later scorer `N_tors_vina` must be derived separately by its own contract.

## Preparation preflight

- Receptor expected heavy atoms: **all present** at every modeled sequence position; 0 incomplete residues, 0 missing heavy-atom sites, 0 missing entity positions, true N terminus with N present, true C terminus with OXT present, and 163/163 peptide C–N links in range. No coordinate repairs are called for.
- Ligand: **6/6 heavy atoms observed**, occupancy 1.0, single state. Official validation reports RSCC 0.97, RSR 0.05, Q<0.9=0, no geometry outliers, and zero ligand or symmetry clashes.
- Alternates: MET106 and GLU108 are A/B 0.7/0.3. Their nearest ligand distances are 7.9205/8.0028 Å and 7.6341/7.6590 Å, respectively; neither residue has atoms within 5 Å of BNZ. Their per-state distance changes are under 0.09 Å. DEC-04 should specify deterministic use of the deposited majority A conformer and preserve the decision in provenance.
- Water: 0 within 5 Å; 1 within 8 Å at 7.8253 Å. It is 3.2703 Å from the nearest protein atom Val87 CG2, but does not directly contact benzene and creates no ligand–water–protein bridge. The primary study describes binding in an internal hydrophobic cavity; no essential water-mediated recognition is identified.
- Metals and components: no metal or cofactor is present in the ≤8 Å ligand shell. Remote crystallization/source components are explicitly listed by the audit: HED at 10.8478 and 11.6196 Å, phosphate at 15.3395 and 20.1564 Å, and chloride at 32.533 Å. They are outside the 8 Å pair cutoff; DEC-04 must record their source identities and explicit omission/inclusion policy rather than blanket-delete HET groups.
- Supported atom/score representation: protein residues are standard amino acids containing C/N/O/S and BNZ contributes aromatic/hydrophobic carbon atoms mapping to the existing `C_H` XS type. This pair requires no new XS type or scoring term. It requires no explicit water, metal coordination, covalent, receptor-motion, or cofactor score.
- Grid feasibility is geometry-only: deposited BNZ bounds are x 25.813–27.432 Å, y 5.062–7.329 Å, z 3.066–5.279 Å. Including the 8 Å cutoff and one 0.375 Å interpolation-halo cell suggests about 50 × 52 × 52 nodes, within the existing 110-node dimension bound. No SearchRegion, scoring field, or molecular score was created.

## Preparation-feasibility answer

**YES.** The receptor and ligand experimental heavy atoms are complete and source-mapped, true terminal chemistry is represented, and the future state can plausibly be obtained through chemical-state and hydrogen derivation plus explicit deterministic component and alternate policies. There is no known heavy-atom repair, missing-residue reconstruction, ligand reconstruction, manual coordinate edit, essential-water retention, or unsupported metal/cofactor requirement.

## Deferred to DEC-04

DEC-04 must decide and document, without executing preparation: exact pH/context; receptor side-chain protonation and hydrogen policy; the BNZ aromatic/bond-order/hydrogen policy; deterministic preparation toolchain/version/options; majority A selection for MET106/GLU108; the remote HED/PO4/Cl policy; prepared-state serialization and canonical atom identity; source/tool/config/input/output digests; provenance schema; a valid SearchRegion and grid-point containment policy; and only those owner/reviewer approvals that the canonical contracts truly require. Source-resolution and heavy-atom-completeness investigation are complete and should not be opened as a new gate.
