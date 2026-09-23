# Pinned PyMOL chemistry-role source evidence

This note records the pinned source semantics and the bounded canonical
producer used for `donors` and `acceptors` in the selection closure matrix. It
is an evidence artifact for the admitted compatibility profile; it does not
claim full PyMOL chemistry perception or general cheminformatics parity.

## Pinned selector path

The pinned source commit is
[`schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69`](https://github.com/schrodinger/pymol-open-source/tree/5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69).
The selector evaluator first verifies chemistry for each object, then reads
the resulting `hb_donor` and `hb_acceptor` atom flags:

- [`Selector.cpp` chemistry dispatch, lines 7051–7077](https://raw.githubusercontent.com/schrodinger/pymol-open-source/5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69/layer3/Selector.cpp#L7051-L7077)
- [`ObjectMoleculeInferHBondFromChem`, lines 5804–5944](https://raw.githubusercontent.com/schrodinger/pymol-open-source/5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69/layer2/ObjectMolecule.cpp#L5804-L5944)

The pinned implementation documents the inputs to that inference as valence,
geometry, formal charge, and bonded atoms. It also distinguishes implicit and
explicit hydrogen presence before assigning donor/acceptor flags. Nitrogen and
oxygen cases inspect bond orders, delocalization, planarity, coordination,
and charge; selected metal cations are handled separately. Consequently,
`donors` and `acceptors` cannot be reproduced safely from element names or
coordinates alone.

## Canonical data required by this application

An admitted chemistry-role dataset must be complete for the molecular
revision and must carry provenance. Its producer must establish, at minimum:

- the revision-bound atom membership of donor and acceptor roles;
- the bond graph and bond orders used by the perception profile;
- valence, geometry/coordination, formal-charge, and hydrogen-state inputs;
- the protonation/tautomer policy and the treatment of unknown components;
- a reproducible profile version and source/provenance record.

The application contract is therefore intentionally strict:
`canonical-chemistry-roles-v1` is accepted only when both role sets are
revision-matched and provenance-bearing. The backend producer in
`apps/api/src/structures/chemistryRoles.ts` ports the bounded pinned sequence
of geometry, bond, valence, charge, and hydrogen-state inference. It runs on
canonical atoms and bonds before the load result is returned; the viewer is
never consulted. Missing or stale data returns `MISSING_DEPENDENCY`; no
renderer state or element-only fallback is promoted to scientific state.

The producer fails closed when the admitted input contains an unknown element,
an explicitly unknown formal charge, an unknown bond order, or a disconnected
non-water/non-ion atom. An absent formal charge follows the pinned profile's
zero default and is recorded in the dataset provenance. The role dataset is
bound to the resulting scientific revision and is covered by the mini-fixture
oracle: donor serials `[1, 4, 5, 8, 10, 11, 12]` and acceptor serials
`[4, 8, 10, 11]`.

## Remaining admitted-input boundary

The current PDB/mmCIF ingestion preserves source atom identity, coordinates,
formal charge where supplied, and admitted topology records. The bounded role
producer is promoted only when those canonical topology and geometry inputs
are sufficient. Sources without sufficient inputs remain fail-closed rather
than receiving guessed roles. The official wwPDB dictionary lists the
available `chem_comp_atom` fields (including charge and partial charge) but no
complete per-atom donor/acceptor role fields:

- [`chem_comp_atom` category](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v50.dic/Categories/chem_comp_atom.html)
- [`pdbx_struct_chem_comp_feature` category](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v40.dic/Categories/pdbx_struct_chem_comp_feature.html), which is not a complete atom-role assignment category

This implementation is deliberately a bounded PyMOL compatibility profile.
It does not infer missing bonds, protonation, tautomer state, resonance, or
unknown component chemistry, and it is not a substitute for a complete
cheminformatics perception engine. Broader chemistry claims remain out of
scope until a separately accepted profile is supplied with positive oracle
fixtures for benzene, pyridine, pyrrole, amide, carboxylate, protonated amine,
and unknown components.
