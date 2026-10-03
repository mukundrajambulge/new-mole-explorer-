# Toolchain and prepared-state contract status

## Toolchain decision: not selected / not authorized

There is no canonical, owner-approved 3DMX preparation toolchain or profile. This lane therefore does not invent a software choice, release, executable/container digest, dependency lock, command, or options. The source project forbids silent defaults and unvalidated automatic receptor protonation/pKa, ligand protonation/tautomer enumeration, and conformer generation in ordinary V1.

- The current D3-DEC-02 owner decision retains Meeko v0.8.0 as experimental/reference evidence only and expressly does not designate it as the production preparer.
- Earlier PDB2PQR/PROPKA/RDKit package versions and wheel hashes were research evidence, not an approved lockfile or preparation profile.
- OpenMM documents that `addHydrogens` defaults to pH 7 and selects ionization/neutral-histidine variants automatically unless explicitly controlled; no OpenMM version/configuration is accepted here. See [OpenMM hydrogen addition behavior](https://docs.openmm.org/latest/userguide/application/03_model_building_editing.html).
- Python 3.14.2 was used only for the read-only coordinate-distance audit in this lane. It is not a molecular-preparation runtime.

The exact command, config, input set, executable/package hashes, platform/container digest, dependency lock, deterministic behavior, allowed/prohibited operations, warnings/errors, output formats, and output validation remain open. Withholding these is a fail-closed decision: no substitute tool is silently adopted.

## Future receptor object

Use `D2_PREPARED_RECEPTOR_STATE_V1` with the existing profile ID `ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0` only after its candidate-specific preparation profile is explicitly approved. It must bind:

- exact receptor molecular identity / graph revision and the 3DMX raw source ArtifactByteDigest;
- assembly 1, model 1, chain/asym A, exact 164-residue C54T/C97A/L99A construct;
- one explicit CoordinateState with all selected source heavy-atom coordinates bit-preserved and coherent A altloc selection for MET106/GLU108;
- explicit residue-by-residue ChemicalState, declared pH/context, terminal states, hydrogen identities/parents/method, disulfide state, and ambiguity diagnostics;
- per-occurrence component roles and explicit include/exclude dispositions under `ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0`;
- site-critical AtomUIDs, validation digest, provenance record, profile digest, and canonical PreparedReceptorDigest.

## Future ligand object

Use `D2_PREPARED_LIGAND_STATE_V1` with `ME_DOCKING_V1_LIGAND_EXPLICIT_STATE_1_0`; bind the BNZ molecular identity/graph, formal state, exact experimental heavy-atom CoordinateState, explicit generated-hydrogen map if authorized, per-atom typing under `ME_XS_TYPING_V1_1_0`, the one-fragment/zero-edge kinematic model, separate `search_torsion_count` and scorer `N_tors_vina`, provenance, and canonical PreparedLigandDigest.

## Serialization and digest rules

- Raw source ArtifactByteDigest: SHA-256 of the exact source bytes listed in `SOURCE_MANIFEST.csv`.
- Scientific state hashes: existing PHD-V2-10 `ME_CANONICAL_CBOR_V1_1_0`, with exact binary64 coordinate bits, stable AtomUID ordering, semantic schema/domain separation, and SHA-256. Do not hash rounded display coordinates or merge source byte identity with scientific state identity.
- Tool, configuration/profile, validation, prepared receptor, prepared ligand, SearchRegion, and final manifest each receive distinct provenance/digest records per the existing contracts.
- No scientific digest is fabricated in this decision lane; there are no prepared-state payloads to serialize or hash.

Preparation is not authorized until the profile/tool lock and state decision are approved and every listed digest/output check can be produced without any prohibited heavy-atom change.
