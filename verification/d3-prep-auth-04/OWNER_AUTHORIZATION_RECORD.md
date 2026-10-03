# Owner authorization record — D3-PREP-AUTH-04

## Authority and source

- Owner status: **APPROVED FOR THE 3DMX/BNZ DEVELOPMENT FIXTURE ONLY**.
- Role: project owner, as explicitly self-identified in the authorizing instruction; the source does not provide a personal name.
- Date: 2026-10-04 (session date; no source-message clock time was supplied).
- Authorization source: the user instruction titled `MOLE EXPLORER — D3-CLOSURE-EXEC-01`, which states “I am the project owner,” explicitly records YES for the three decisions then marked `NOT RECORDED` in this AUTH04 packet, and calls itself the owner record.
- Source attachment: `C:\Users\mukun\.codex\attachments\885e697b-12c2-40e1-8b8b-688be3486f32\pasted-text-1.txt`.
- Source attachment SHA-256: `f4526524331f33e6e0055a4cddeac083dba2aedeec52421d89d161f31c95688d`.
- The instruction directs that the exact proposal in this AUTH04 packet controls and forbids reinterpretation or scope expansion. No conflicting accepted D1/D2 semantics were found in the reviewed authority records.

## Exact decisions

| Decision | Owner decision | Exact approved choice and scope |
|---|---|---|
| AUTH04-01 — bootstrap | **YES** | Permit exactly one development-only 3DMX/BNZ bootstrap preparation under `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0`, subject to the complete bounds, expiry, revocation, provenance and non-permissions in `BOOTSTRAP_EXCEPTION_DECISION.md`. It does not create a general preparation profile or production capability. |
| AUTH04-02 — state/context | **YES** | Approve exactly the state proposal in `CHEMICAL_STATE_DECISION.md` and `PREPARATION_CONTEXT_DECISION.md`, with `target_pH=6.9` used only as a crystallization-context proxy, the explicit listed microstate, and the specific reconciliation: 51 side-chain residue identities plus two termini; include `GLU128` as deprotonated, formal charge −1. This is one preparation hypothesis, not an experimentally established binding-state microstate or predicted pKa result. |
| AUTH04-03 — toolchain/profile/components | **YES** | Approve the exact v1.0 candidate profile and pinned CPython/RDKit/dependency stack in `PREPARATION_PROFILE_FREEZE.md` and `PINNED_TOOLCHAIN_PROPOSAL.md`, including neutral CCD BNZ, coherent A alternatives for MET106/GLU108, CORE_DRY_V1 occurrence-level water/HED/PO4/CL dispositions, hydrogen-only derivation, immutable source heavy atoms, and all listed no-repair/no-minimization limitations. |

## Conditions and boundaries

- Applicable fixture and source identity: 3DMX / BNZ, using only the exact source artifacts and hashes in `PINNED_TOOLCHAIN_PROPOSAL.md` and the DEC04 source manifest.
- Preparation profile: `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0`, semantic version `1.0.0`, single-use development fixture profile.
- Pinned engine/runtime: RDKit `2026.03.6`, release tag `Release_2026_03_6`, commit `0e0d85f4ca34aeae15dfc0f7cf5503bdb0a8e985`; CPython `3.13.16` x64; dependency versions and package hashes are in `PINNED_TOOLCHAIN_PROPOSAL.md`.
- The approved profile permits a future preparation task only after its sealed driver/config/source hashes, exact runtime and wheel hashes, explicit graph/state checks, deterministic replay, hydrogen-parent provenance and zero-change heavy-atom invariant all pass. A failed or unverified precondition stops before any hydrogen-generation call. This AUTH04 task did not run preparation and did not add any hydrogen to 3DMX or BNZ.
- `GLU128−` is the approved resolution of the DEC04 list/count discrepancy. Preserve DEC04 unchanged; use the corrected inventory only in later executable state evidence.
- No structural repair, residue/side-chain rebuilding, heavy-atom movement, ligand movement, minimization, flips, alternate averaging, hidden component deletion, automatic pKa/state selection, production PDBQT, scoring, scoring-field construction, pose generation, docking, D4 work, PyMOL behavior change, or `DOCKING.RUN` enablement is authorized.
- The exception does not change accepted D1/D2 semantics, general `CORE_DRY_V1` domain, or application defaults. It expires after one completed run, any source/profile/toolchain change, or owner revocation, whichever comes first.

## Reviewer status

No independent reviewer was named or contacted for this authorization. The reviewed PHD-V2 preparation rules do not make a qualified chemist's approval of hydrogen coordinates a prerequisite to this bounded preparation execution; such review is recommended. The separate Roadmap independent-evidence-review control remains applicable to formal implementation-gate closure and final D3 acceptance. This record does not claim that later review has occurred.

## Record integrity

This file records the source instruction verbatim as the decision authority and the exact three proposal choices. It does not assert that preparation, hydrogen generation, D2 sealing, scoring, grid construction, or D3 acceptance has occurred.