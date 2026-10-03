# D3-PREP-DEC-04 — candidate-specific preparation decision for 3DMX / BNZ

## Objective

Prepare a decision package for a reproducible `CORE_DRY_V1` molecular-preparation workflow for **RCSB 3DMX / BNZ**, the fixture already admitted by D3-FIXTURE-READY-03 as `SOURCE_RESOLVED_AND_PREPARATION_READY_FOR_CORE_DRY_V1`.

This is a preparation-decision gate. Decide and record the chemical-state, toolchain, provenance and SearchRegion requirements, plus only approvals genuinely required by the canonical contracts. **Do not execute molecular preparation in this decision task.** The source-resolution and missing-heavy-atom admission gate is complete; do not open another source-search or source-resolution gate unless the concrete review reveals a contradiction in the cited evidence.

## Frozen source mapping

- Receptor source: official current RCSB 3DMX mmCIF, polymer entity 1, deposited label/auth chain A, all 164 entity positions observed. Source construct is T4 lysozyme with annotated engineered substitutions C54T, C97A and L99A; *E. coli* expression; author/PISA biological assembly 1 monomer A1. Experimental X-ray structure, 1.80 Å, Rwork 0.182/Rfree 0.208.
- Ligand source: deposited BNZ label asym G/auth chain A/residue 900, matched to current CCD BNZ; all six heavy atoms observed, occupancy 1.0, no alternate ligand state. Neutral C6H6, one aromatic connectivity graph, no stereocenters, protomer or tautomer ambiguity, rigid ring.
- Readiness evidence: `SELECTED_PREPARATION_READY_FIXTURE.md`, `FINALIST_PREPARATION_PREFLIGHT.md`, `MISSING_ATOM_AUDIT.csv`, `MISSING_RESIDUE_AUDIT.csv`, `TERMINUS_AND_CHAIN_CONTINUITY_MATRIX.csv`, `BINDING_SITE_ALTERNATE_MATRIX.csv`, `LIGAND_STATE_MATRIX.csv`, `WATER_AUDIT_MATRIX.csv`, `METAL_COFACTOR_COMPONENT_MATRIX.csv`, and `D3_REPRESENTABILITY_MATRIX.csv`.

## DEC-04 decisions to resolve

1. **Preparation pH and biological/experimental context.** The crystal was grown at pH 6.9 and 277 K in concentrated phosphate. This is crystal context, not an automatic preparation pH. State the justified target pH/context and uncertainty policy.
2. **Receptor protonation and hydrogens.** Specify deterministic protonation rules, histidine tautomer decisions, ionizable side-chain and terminal states, hydrogen placement, treatment of engineered residues, and explicit handling of any experimentally unresolved hydrogen-only state. Keep every selected experimental receptor heavy-atom coordinate invariant.
3. **BNZ chemical and hydrogen state.** Confirm the neutral CCD BNZ graph and aromatic/bond-order representation, hydrogen policy, atom-name mapping, and deterministic canonical ligand atom order. No ligand heavy-atom coordinates may be changed.
4. **Receptor alternate conformations.** MET106 and GLU108 have A/B occupancies 0.7/0.3. Their closest atoms are 7.92/8.00 Å and 7.63/7.66 Å from BNZ; neither directly contacts the ligand. Record the evidence-based deterministic use of major conformer A, with atom selection and source altloc IDs in provenance. Do not merge A/B coordinates.
5. **Water and component policy.** No water is within 5 Å; the lone water within 8 Å is at 7.8253 Å from BNZ, with nearest receptor atom Val87 CG2 at 3.2703 Å and no ligand-water contact/bridge. Record why it is not an essential ligand water and how it is treated. Record remote HED (10.8478 and 11.6196 Å), phosphate (15.3395 and 20.1564 Å), and chloride (32.533 Å) by identity and provenance; make an explicit inclusion/omission choice for the receptor scoring state. No blanket HET deletion. There is no metal/cofactor in the ligand's 8 Å shell.
6. **Exact deterministic toolchain.** Select and justify versioned preparation software and options; pin container/runtime or environment, command/config, CCD/library inputs, random seeds if applicable, locale/units, and execution mode. Demonstrate intent to preserve deposited heavy atoms and generate only permitted chemical/hydrogen derivatives. Identify tool limits without silently substituting another tool.
7. **Prepared-state serialization and provenance.** Specify receptor/ligand file formats, stable atom/residue identifiers, ordering, bond orders, charges, atom types, aromaticity, hydrogen flags, torsion tree, and handling of the rigid BNZ ring. Define canonical serialization and digests for source, tool, configuration, prepared state and manifest. Keep `search_torsion_count` distinct from scorer `N_tors_vina`; derive each only under its applicable contract.
8. **SearchRegion.** Define a reproducible region using the frozen experimental ligand heavy-atom pose and existing cutoff/halo rules. Evidence bounds are x 25.813–27.432, y 5.062–7.329, z 3.066–5.279 Å. At 0.375 Å spacing with the 8 Å pair cutoff and one-cell interpolation halo, expected dimensions are approximately 50 × 52 × 52 nodes, under the 110-node dimension cap. Verify exact integer/grid-point containment, boundary interpolation validity and no extrapolation or clamping as a decision artifact. Do not construct potential arrays or run scoring here.
9. **Required approvals.** Separate contract-required owner approval from optional independent review. Do not fabricate approval or block the scientific decision solely because optional review has not occurred.

## Expected DEC-04 result

Return a concrete, candidate-specific go/no-go decision and a fully specified deterministic preparation protocol, with any approval request directed to the correct owner. If the selected workflow is approved in the proper gate, a later explicitly authorized preparation task can execute it. This prompt itself authorizes neither preparation nor molecular output generation.

## Explicitly out of scope

No hydrogens are to be added; no production protonation is to be assigned; no receptor or ligand files are to be prepared; no heavy atoms, waters, components, or coordinates are to be altered; no PDBQT is to be produced; no full-pose scoring, grid scoring, field generation, docking, scorer change, PyMOL change, or D4 work is to occur. Full D3 remains HOLD, D4 remains BLOCKED, and `DOCKING.RUN` remains unavailable.
