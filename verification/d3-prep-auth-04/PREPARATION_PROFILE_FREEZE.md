# Candidate-specific preparation profile freeze

Status: exact profile proposal; not registered in application contracts, not owner-approved, not executable until AUTH04-02 resolves the GLU128/count conflict, and not executed.

## Identity

- profile_id: ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0
- semantic_version: 1.0.0
- profile purpose: one development-only hydrogen-only preparation hypothesis for RCSB 3DMX/BNZ.
- state payload: exact 3DMX model 1 / assembly 1 monomer A1 / chain A receptor; 164-residue C54T/C97A/L99A construct; explicit chemical-state map in CHEMICAL_STATE_DECISION.md; neutral rigid CCD BNZ ligand state; target_pH 6.9 as crystallization-context proxy.
- coordinate/component payload: coherent major A conformers for MET106 and GLU108; all common atoms retained; dry scoring receptor under CORE_DRY_V1; all water and non-polymer occurrence decisions in ALTERNATE_COMPONENT_POLICY_FREEZE.md.
- hydrogen method/toolchain: RDKit 2026.03.6 Chem.AddHs with addCoords=True, addResidueInfo=True, explicitOnly=False, skipQueries=False on caller-constructed graphs with complete explicit states; CPython 3.13.16 x64; exact hashes in PINNED_TOOLCHAIN_PROPOSAL.md.
- heavy-atom policy: bitwise-identical in-memory coordinate identity, identity/map/bond preservation, zero unauthorized heavy-atom changes; no repair, minimization, flip, alternate averaging, or source rewrite.
- prepared-state interpretation: one declared dry-core receptor microstate hypothesis and one neutral BNZ state; not an experimental determination, general-purpose default, D2 gate acceptance, or D3 acceptance.

The ID uses the project’s established ME_DOCKING_V1_*_1_0 shape. It is intentionally distinct from ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0, which is an existing D2 consumer/component profile ID, and from ME_DOCKING_V1_LIGAND_EXPLICIT_STATE_1_0 / ME_DOCKING_V1_KINEMATIC_MODEL_1_0.

## Contract compatibility

Repository contracts at the verified base define the D2 receptor state profileId as the fixed dry-core consumer profile. D2 provenance profileId is a string. The current ProfileManifest pattern includes profileId, semanticVersion, semanticSchemaId, digest and dependencies; no candidate-specific receptor hydrogen-preparation profile schema is registered in the verified base.

Therefore this ID is a candidate preparation-profile name, not an assertion that the project has registered a new schema or enabled production capability. Do not pass it where the fixed D2 consumer profile ID is required. Keep the D2 consumer profile and the candidate preparation profile as distinct provenance references. Do not claim a canonical profile digest until a profile schema/serializer is established for this artifact; this report's checksum is only a file digest.

## Unique profile content

The profile's immutable semantic content is the conjunction of:

1. exact receptor and ligand source SHA-256 hashes and selected source atom identities;
2. exact chemical-state table, pH proxy and context uncertainty;
3. altloc policy and exact MET106/GLU108 conformer selections;
4. component-role and CORE_DRY_V1 exclusion ledger;
5. exact H-addition function/parameters, software/runtime/dependency versions and package hashes;
6. heavy-atom invariant, hydrogen-parent mapping and output validation contract;
7. exact adapter and configuration bytes, once sealed before any chemical operation.

Any change to one of those items changes the profile version/content identity. Reuse of the ID with changed semantics is forbidden. A canonical semantic digest remains deferred until the profile has a canonical semantic schema/serializer; no prepared-state digest exists yet.

## Owner approval boundary

Owner approval of this profile would authorize only the one fixture bootstrap exception described in BOOTSTRAP_EXCEPTION_DECISION.md and the proposed profile contents above. It would not accept D3 or authorize scoring, grids, docking, PyMOL, D4, production PDBQT, or DOCKING.RUN.
