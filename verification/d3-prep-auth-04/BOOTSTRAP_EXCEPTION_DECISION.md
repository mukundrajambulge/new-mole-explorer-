# Bounded 3DMX/BNZ bootstrap exception — owner decision

## Exact proposed decision

The exact proposal in D3_PREP_DEC_04_REPORT.md is to record a scoped decision that “permits one 3DMX/BNZ bootstrap development preparation before the general profile is approved”.

The proposed exception permits exactly one development-only preparation of the already selected 3DMX/BNZ fixture under the candidate-specific profile ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0, after this profile, chemical-state proposal, and owner authorization are recorded. The output is one prepared-state evidence candidate intended to enable later D2-sealed prepared-state/full-pose development evidence and a separate general-profile decision.

## Why the exception is needed

Current D3-GRID-DEC-02 says a preparation profile is not approved and remains a separate evidence-based owner decision after suitable D2-sealed prepared-state and full-pose development evidence. The first such prepared state cannot exist until one preparation has been performed. DEC04 proposed the narrow bootstrap to close this sequencing dependency while preserving the general owner decision.

## Exact scope

The exception would:

- apply only to the existing 3DMX/BNZ fixture, exact source hashes, and one named profile version;
- allow a single hydrogen-only derivation of the explicit receptor and BNZ states in that profile;
- allow D2 state/provenance evidence to be prepared as an unaccepted development candidate;
- require complete source, component, altloc, atom mapping, hydrogen, toolchain, and validation provenance;
- expire on one completed run, a changed source/profile/toolchain, or owner revocation, whichever happens first.

It would not:

- approve a project-wide or reusable general preparation profile;
- select another fixture or authorize automatic state generation;
- authorize residue repair, side-chain rebuilding, heavy-atom minimization, ligand minimization, Asn/Gln/His flipping, alternate averaging, or silent source-component deletion;
- authorize production PDBQT, scoring, scoring-field construction, pose generation, docking, any D3 scoring implementation, PyMOL change, D4 work, or DOCKING.RUN;
- accept D1, D2, D3, or the future prepared state as production-qualified.

## Scientific risk

The selected pH is a crystallization-context proxy, not a measured binding/soak pH. HIS31 is experimentally unresolved; neutral HID is a geometry-supported hypothesis. Fixed hydrogen orientations are deterministic geometry from the input graph, not hydrogen-bond-optimized or experimentally observed. The dry policy omits crystallographic water contributions, including HOH1147 near BNZ. These limitations must accompany any derived state and any later full-pose/scoring interpretation.

## Reproducibility and provenance

Bind the run to the exact 3DMX and BNZ source SHA-256 values in the predecessor SOURCE_MANIFEST.csv; exact environment and wheel hashes in PINNED_TOOLCHAIN_PROPOSAL.md; versioned profile; adapter/source hash sealed before first chemical operation; complete input/state/configuration digest; RDKit version; process command; relevant environment; stdout/stderr; generated-H-to-parent map; exact H coordinate bits; validation report; and output payload hashes. Run offline from a hash-verified wheelhouse. Do not calculate or claim a prepared-state digest before the payload exists.

## Revocation and rollback

Before execution, an owner may revoke the exception by replacing its decision with a dated record; no run is then permitted. After a run, revocation does not erase or overwrite source evidence or outputs. Mark the authorization revoked, preserve the run and its failures, invalidate any dependent prepared-state identity/cache, and create a new profile/version and new provenance if a different hypothesis is authorized. A changed source, coordinate mapping, microstate, toolchain, or profile content requires a new version/identity rather than reusing this exception.

## D1/D2/D3 effect

The exception changes no accepted D1 or D2 semantic rule. It authorizes only a single development data derivation outside the ordinary profile-timing sequence; it does not mean the derived state passed a D2 gate. D3 remains HOLD until its own evidence and owner acceptance. D4 remains BLOCKED; DOCKING.RUN remains UNAVAILABLE.

## Owner status

OWNER APPROVED — YES on 2026-10-04; see `OWNER_AUTHORIZATION_RECORD.md`. The exact single-use 3DMX/BNZ scope and every non-permission in this proposal remain controlling. AUTH04 gate exit is still held for the independent evidence review.
