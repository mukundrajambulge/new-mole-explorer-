# D3 required gate review

## Review mechanism and result

An isolated, read-only independent reviewer examined the current Roadmap, AUTH04 owner package, approved chemistry profile, pinned toolchain proposal, D2 contracts and sealers, PHD-V2-10, the integrated closure request, and inherited TOR/GRID implementation. The reviewer did not modify the scientific proposal or execute preparation.

**Pre-execution review: PASS. Roadmap code-review element: PASS on the corrected revision. Independent blocked-state evidence-package review: PASS. Scientific D3 closure: HOLD because the approved profile does not resolve three source alternate-coordinate groups, so fixture preparation and full-pose outputs do not exist.** The Roadmap itself does not require an external human. Roadmap §3.2, paragraphs 109–112 (current revision `ANLCKQl2s3TyUYW5qYe_9qihkOwWtCeF0OLunNFacRrnaFDzv_mD1Y8bU6osvkbh_qqeIBoMFpaqGjWvnPC486UlQH8-6QuwA1pFIpvyZ_M`) requires code review and independent evidence review for closure, without specifying a human or credential. Integrated task §12 separately requests an independent pre-execution review; the read-only reviewer lane satisfies that task-specific timing.

## Inherited implementation code review

The reviewer examined TOR commit `f0bd2eaf47b02faab4dea694e7c2677094969076`, GRID commit `2b811c238ed071ce1f6d007a393e81ef65fe29f3`, and evidence tip `24c2bf28b811af21c22693091f80f2e47e84fc80`. The initial review found that the TOR importer used `Number.parseInt` on the fixed-width PDBQT atom serial, which could accept malformed `0001X` as serial 1. The authoring lane changed the parser to validate the entire five-character field before conversion and added a regression that expects `D3_PDBQT_ATOM_SERIAL_INVALID`. The reviewer re-read the corrected implementation and regression and returned **PASS** for Roadmap §3.2's code-review element. The complete repository test run then passed with 254 tests; typecheck, lint, and build also passed. Exact commands and logs are in `CUMULATIVE_REGRESSION_REPORT.md` and `runtime_logs/`.

The reviewer found no additional material defect in the bounded GRID channel mapping, shared pair primitive, geometry, interpolation stencil, field-domain behavior, digest separation, or resource evidence. This implementation review does not establish fixture-level or full-pose acceptance.

## Evidence reviewed

- Roadmap §3.2 and D3 exit criteria, plus Global Master Plan D3/D4 status.
- AUTH04 owner decision, exception, exact chemistry profile, component/alternate policy, heavy-atom invariant, hydrogen provenance contract, and toolchain proposal.
- D1 and D2 acceptance evidence, D3-TOR, D3-SCI, D3-GRID, fixture readiness, DEC04 source freeze, and relevant PHD-V2 requirements.
- Exact current closure task, including §§2, 12–16, 20–25, and 39.
- Current D2 prepared receptor/ligand types and sealers. D2 V1 binds its fixed consumer profile and does not include the candidate AUTH04 preparation-profile digest in its prepared-state hash.

## Scientific review

The AUTH04 package consistently resolves GLU128 as deprotonated, limits pH 6.9 to crystallization-context proxy use, specifies the 3DMX construct and residue state inventory, fixes the MET106/GLU108 alternate policy, and authorizes hydrogen-only RDKit AddHs with strict heavy-atom invariance and per-hydrogen provenance. No contrary source decision was found in the reviewed records. The fixture and component choices were not reopened.

## Profile digest contract

The integrated task explicitly requires canonical prepared states to include the preparation profile, canonical serialization, and scientific digest. AUTH04 says no canonical candidate-profile digest exists until a schema and serializer are established. The reviewer ruled that this task authorizes a versioned D3 envelope over unchanged D2 V1 state digests and the candidate profile/provenance dependencies. The envelope must be separately named as a D3 object, must not be represented as a D2 V1 digest, and must use the project's canonical CBOR/scientific-digest convention. See `PROFILE_AWARE_ENVELOPE_SCHEMA.md`.

## Authorization and deterministic replay

AUTH04 records a single-use development fixture authorization and lists deterministic replay as a mandatory execution precondition. Integrated task §25 directs preparation again from the same inputs/profile. After the authorized WSL2 relocation, exact pinned RDKit imports and safe synthetic AddHs repeats passed. No fixture preparation began: byte-exact preflight found unlisted alternate groups and stopped before receptor graph construction. Fixture replay therefore remains unperformed and the authorization remains unconsumed.

## Runtime-unblock continuation update

The Linux runtime relocation subsequently resolved the RDKit import issue and safe synthetic AddHs controls passed. The fixture-specific hash-gated preflight then stopped at ASN68 because the frozen AUTH04 profile resolves only MET106 and GLU108, while the exact source also contains A/B groups at ASN68, ASP72, and ARG76. No fixture graph or AddHs call occurred. The prior independent review remains evidence for its original scope; it does not review newly created fixture states or preparation outputs, because none exist.

## Runtime finding

The standard Windows installer rolled back, and Windows Code Integrity events 3077/3033 blocked the pinned Windows native RDKit modules. Under the owner's bounded relocation authorization, existing WSL2 Ubuntu 24.04.5 runs CPython 3.13.16 with RDKit 2026.03.6; the required `rdkit.Chem` API imports and safe synthetic AddHs controls pass. The Linux wheel hash matches its pinned artifact and no host security policy was modified. The Windows restriction is historical provenance and is no longer the active execution blocker. See `LINUX_RUNTIME_RECORD.md`, `PLATFORM_EQUIVALENCE_REVIEW.md`, and `PINNED_TOOLCHAIN_EXECUTION_RECORD.md`.

## Final review disposition

The pre-execution review passed on the approved scientific choices, with the profile-envelope condition addressed by this task's own scope. The Roadmap code-review element passed after the serial-parser correction. The independent reviewer passed the blocked-state evidence-package audit, including source provenance and manifest integrity. This does not establish scientific acceptance: no fixture preparation, prepared state, SearchRegion, fixture replay, or full-pose scientific outputs exist. Overall closure remains **HOLD** because the exact source contains A/B alternate groups at ASN68, ASP72, and ARG76 that the frozen profile does not resolve; selecting or omitting those coordinates would change the authorized molecular state. No fixture hydrogen operation was run. No numerical scoring failure was measured.
