# Pinned PyMOL chemistry-role source evidence

This note records why `donors` and `acceptors` remain a canonical-data gate in
the selection closure matrix. It is an evidence artifact, not an application
chemistry implementation.

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
complete, revision-matched, and provenance-bearing. Missing or stale data
returns `MISSING_DEPENDENCY`; no renderer state or fallback element heuristic
is promoted to scientific state.

## Gap in the admitted PDB/mmCIF ingestion

The current PDB/mmCIF ingestion preserves source atom identity, coordinates,
formal charge where supplied, and admitted topology records. It does not
produce the complete chemistry-perception inputs or role assignments required
by the pinned algorithm. The official wwPDB dictionary lists the available
`chem_comp_atom` fields (including charge and partial charge) but no complete
per-atom donor/acceptor role fields:

- [`chem_comp_atom` category](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v50.dic/Categories/chem_comp_atom.html)
- [`pdbx_struct_chem_comp_feature` category](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v40.dic/Categories/pdbx_struct_chem_comp_feature.html), which is not a complete atom-role assignment category

Adding a rule-based fallback would silently choose a chemistry profile and
could disagree with the pinned PyMOL behavior for resonance, protonation,
tautomer, and incomplete-topology cases. That remains out of scope until the
chemistry-perception profile is accepted and supplied with positive oracle
fixtures for benzene, pyridine, pyrrole, amide, carboxylate, protonated amine,
and unknown components.

