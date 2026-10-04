# D3 profile-aware prepared-state envelope schema

**Purpose:** carry the AUTH04 candidate preparation-profile dependency required by PHD-V2-10 while retaining the accepted D2 V1 consumer objects and their digests unchanged.

## Profile manifest

Use semantic schema `D3_3DMX_BNZ_PREPARATION_PROFILE_V1` and semantic version `1.0.0` for the immutable approved preparation profile. Its canonical payload binds:

- the frozen AUTH04 profile ID and exact approved state/component/H policies;
- DEC04 source-manifest digest and each selected source artifact digest;
- pinned runtime and wheel identities/hashes;
- exact AddHs API and parameters;
- the driver and its immutable configuration digests, sealed before any AddHs call.

Compute the profile manifest digest with the existing project `scientificDigest` / `encodeCanonicalCbor` convention, using digest class `D3_PREPARATION_PROFILE_MANIFEST` and schema `D3_3DMX_BNZ_PREPARATION_PROFILE_V1`. The fixed D2 receptor/ligand consumer profile IDs remain separate references and are not replaced by the candidate profile ID.

## Prepared-state envelopes

Define two D3 objects with their own digest types and semantic schemas:

- `D3_PROFILE_AWARE_PREPARED_RECEPTOR_V1`
- `D3_PROFILE_AWARE_PREPARED_LIGAND_V1`

Each canonical payload contains the unchanged D2 V1 prepared-state digest, D2 consumer profile ID, candidate preparation-profile ID and digest, source-input-manifest digest, preparation activity/toolchain digest, heavy-atom invariant digest, and generated-hydrogen provenance digest. For the ligand, the payload also binds the six-atom BNZ identity/mapping and torsion evidence. The canonical serializer binds all fields and ordered digest lists using the project's canonical CBOR profile; the scientific digest class is `D3_PROFILE_AWARE_PREPARED_STATE` and the corresponding schema ID above.

The envelope is a D3 object. Its digest is never passed as a D2 V1 prepared-state digest and never described as changing or completing an existing D2 V1 digest. D2 `SearchRegion` continues to bind the unchanged D2 receptor and ligand digests. D3 full-pose evidence records the D2 consumer digests and the profile-aware envelope digests together, making the profile dependency traceable without changing D2 semantics.

## Dependency order and status

The non-cyclic dependency order is: frozen source/profile/toolchain and driver digests → preparation activity and per-H provenance digests → unchanged D2 V1 prepared-state digests → D3 envelope digests → SearchRegion and validation-context evidence. Run output digests are not inputs to the preparation-profile manifest.

The independent reviewer ruled that defining this envelope is within the integrated task's scope and that PHD-V2-10 does not require project-wide pre-acceptance of a new schema. This document establishes the proposed task-local schema boundary. No canonical profile manifest, D2 state, or envelope instance was generated because RDKit was blocked before preparation.
