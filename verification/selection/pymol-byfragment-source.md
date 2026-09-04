# Pinned PyMOL `byfragment` source evidence

This note records the source-level reason that `byfragment` remains a research/data gate in the closure matrix.

- Source: `schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69`
- Runtime used for the direct probe: PyMOL `3.2.0a` in the isolated Ubuntu-20.04/Python-3.8 compatibility build.
- Source location: [`layer3/Selector.cpp`, `SELE_BYF1`, lines 8462–8511](https://raw.githubusercontent.com/schrodinger/pymol-open-source/5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69/layer3/Selector.cpp#L8462-L8511) in the pinned checkout.

The pinned implementation:

1. Calls `EditorGetNFrag(G)` to obtain the number of editor fragments (line 8466).
2. Resolves the internal editor-fragment selections built from `cEditorFragPref` (lines 8478–8480).
3. Reads each atom’s internal `selEntry` membership against those selections (lines 8482–8490).
4. Keeps every fragment that intersects the seed selection, then marks the retained atoms (lines 8493–8506).

Therefore the native operation depends on editor fragment assignments. It is not a synonym for canonical bond connected components or a coordinate-derived connected-component calculation. The application reserves canonical bond components for `bymolecule` and requires a complete, revision-matched `canonical-fragment-assignment-v1` dataset for `byfragment`.

The admitted parser was audited alongside the pinned source: the PDB path records atom identity, coordinates, bonds, unit-cell data, and structural records but no fragment assignment; the mmCIF path promotes `_chem_comp_bond` as canonical bond topology and `_chem_comp_atom.partial_charge` as source charge data, but has no admitted fragment-assignment category. The optional fragment dataset in `packages/contracts/src/index.ts` therefore has no producer for ordinary PDB/mmCIF loads.

The official wwPDB dictionary was checked for a standard source-backed alternative. The [`chem_comp` category](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v40.dic/Categories/chem_comp.html) describes chemical components and related atom/bond geometry, while [`chem_comp_bond`](https://mmcif.rcsb.org/dictionaries/mmcif_rcsb_nmr.dic/Categories/chem_comp_bond.html) describes bonds. The category index lists [`pdbx_struct_chem_comp_feature`](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v40.dic/Categories/pdbx_struct_chem_comp_feature.html) and [`pdbx_struct_group_components`](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v40.dic/Categories/pdbx_struct_group_components.html) as not used in current PDB entries; [`pdbx_reference_entity_subcomponents`](https://mmcif.rcsb.org/dictionaries/mmcif_pdbx_v40.dic/Categories/pdbx_reference_entity_subcomponents.html) is a BIRD reference-dictionary category, not a general atom-to-fragment assignment for admitted structures. None supplies the required complete per-atom fragment membership for ordinary PDB/mmCIF ingestion.

The direct pinned probe records `byfragment organic` as a valid empty result on the shared mini fixture. That result does not prove a positive fragment assignment, because the fixture has no editor fragment assignment payload. The comparison ledger consequently keeps `byfragment` as `ORACLE_PENDING` until an accepted source-backed fragment-assignment fixture and policy are available.

No PyMOL fragment-library files, per-atom hints, inferred connected components, or coordinates are promoted as a universal canonical fragment authority.
