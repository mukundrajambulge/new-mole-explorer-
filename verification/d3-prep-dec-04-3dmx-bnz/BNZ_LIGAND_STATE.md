# BNZ chemical state, typing, and torsions

## Source-defined ligand state

BNZ is benzene, not BEN. The deposited occurrence is label asym G, entity 5, author chain A, residue 900, model 1, occupancy 1.00. The official CCD BNZ file is frozen in `source_artifacts/current_rcsb/BNZ.cif`.

- Formula `C6H6`; formal charge 0; one six-member aromatic ring; no stereocenters, protomer ambiguity, or tautomer ambiguity.
- Stable source atom-name correspondence: C1–C6 map to the six deposited carbon atoms with identical labels. CCD H1–H6 are one-per-carbon parents. Source deposited coordinates have only the six carbon atoms.
- CCD records an aromatic flag on all six atoms and aromatic bonds with a Kekule single/double bond-order representation. Preserve both the aromatic perception and source bond-order evidence under one named graph/perception profile; do not replace source graph with a SMILES-only identity.
- CCD model coordinates are example coordinates from component coordinate source 1A7Z. Only CCD ideal geometry may serve as a geometric template for explicit hydrogens, after a deterministic alignment to the six unchanged 3DMX carbons.
- Preserve experimental C1–C6 coordinates exactly. Generate only H1–H6 after an approved exact hydrogen tool/profile. No minimization or conformer generation.

## Scoring type and torsion result

The six benzene carbons map to the existing `C_H` XS type under `ME_XS_TYPING_V1_1_0`; no new atom type or scoring term is needed. Hydrogen treatment must follow the existing Vina/XS profile and be explicit in the later prepared-state audit; no partial-charge model is invented for the empirical Vina Classic score.

- `search_torsion_count = 0`: every ring bond is aromatic/ring-contained and therefore ineligible as an ordinary-V1 search rotor. The molecule is one rigid fragment.
- Expected scorer `N_tors_vina = 0`: independently derived under the D3-TOR scorer convention because there are no PDBQT BRANCH rotors and no terminal-H-only rotor. A future imported representation must provide its exact scorer torsion/TORSDOF evidence; the value is not copied from another molecule or inferred from the search field.
- Kinematic proposal: one rigid fragment containing the six-carbon/six-hydrogen graph, zero rotatable edges, zero BRANCH records, no ring-breaking. A deterministic root must be stored under the named D2 kinematic profile; root choice is representation provenance, not chemical identity.

No ligand preparation, PDBQT, atom typing output, or kinematic model was generated here.
