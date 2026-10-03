# Generated-hydrogen provenance contract

No hydrogen has been generated in this authorization lane. The following record is mandatory for each future generated H atom.

## Per-hydrogen fields

- generated AtomUID using the canonical project AtomUID constructor;
- atom element H and assigned atom name;
- parent heavy-atom AtomUID and stable parent atom mapping;
- molecular state ID and source artifact SHA-256;
- receptor residue/component/chain/assembly/model identity or ligand occurrence identity;
- preparation profile ID, semantic version, and profile/configuration content digest;
- tool name RDKit, exact version/build/tag, package wheel filename and SHA-256, and runtime version;
- operation identifier Chem.AddHs with exact AddHsParameters values;
- source heavy-atom parent coordinate bits and generated hydrogen coordinate bits in Å/binary64;
- derivation mode: H-only graph operation from exact explicit graph/state/conformer; no pKa choice, conformer generation, minimization, or heavy-atom edit;
- execution run ID, timestamp, host/runtime/environment, sealed driver-source digest, complete argument vector, and run manifest digest.

The generated hydrogen is derived data and must never be labeled as a deposited experimental source atom. A matched element/name without a unique parent AtomUID is insufficient provenance. The parent map must survive canonical serialization and must be checked against the hydrogen bond in the derived graph.

## Identity and naming

For BNZ, record exactly H1–H6 parent-mapped to CCD atom C1–C6. For receptor atoms, use canonical stable AtomUID plus a deterministic residue/atom naming rule from the approved adapter; preserve AtomPDBResidueInfo where available. If any generated H collides with an existing atom identity/name or its parent cannot be resolved uniquely, stop rather than silently renaming a source atom.

## Coordinate record

Record exact binary64 XYZ values and canonical state serialization, not rounded display strings. The generated-H coordinate is linked to its parent, source conformer, explicit ChemicalState, exact RDKit call, and profile. Preserve H coordinates unchanged after AddHs. No post-generation orientation optimization is allowed by this profile.

## Provenance boundary

Hydrogen atom identity/coordinate and full ChemicalState are distinct from raw source ArtifactByteDigest and from downstream partial-charge/atom-typing assignments. Do not create a PreparedReceptorDigest or PreparedLigandDigest until a real payload is produced and serialized using the canonical project procedure. Keep source heavy coordinates, generated hydrogens, provenance, and downstream scoring representation as separate linked records.
