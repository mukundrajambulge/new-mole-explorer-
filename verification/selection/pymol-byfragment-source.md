# Pinned PyMOL `byfragment` source evidence

This note records the source-level reason that `byfragment` remains a research/data gate in the closure matrix.

- Source: `schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69`
- Runtime used for the direct probe: PyMOL `3.2.0a` in the isolated Ubuntu-20.04/Python-3.8 compatibility build.
- Source location: `layer3/Selector.cpp`, `SELE_BYF1`, lines 8970–9021 in the pinned checkout.

The pinned implementation:

1. Calls `EditorGetNFrag(G)` to obtain the number of editor fragments (line 8975).
2. Resolves the internal editor-fragment selections built from `cEditorFragPref` (lines 8987–8990).
3. Reads each atom’s internal `selEntry` membership against those selections (lines 8992–9001).
4. Keeps every fragment that intersects the seed selection, then marks the retained atoms (lines 9004–9016).

Therefore the native operation depends on editor fragment assignments. It is not a synonym for canonical bond connected components or a coordinate-derived connected-component calculation. The application reserves canonical bond components for `bymolecule` and requires a complete, revision-matched `canonical-fragment-assignment-v1` dataset for `byfragment`.

The direct pinned probe records `byfragment organic` as a valid empty result on the shared mini fixture. That result does not prove a positive fragment assignment, because the fixture has no editor fragment assignment payload. The comparison ledger consequently keeps `byfragment` as `ORACLE_PENDING` until an accepted source-backed fragment-assignment fixture and policy are available.

No PyMOL fragment-library files, per-atom hints, inferred connected components, or coordinates are promoted as a universal canonical fragment authority.
