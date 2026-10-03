# D3-PREP-AUTH-04 — 3DMX/BNZ Owner Decision Closure and Toolchain Freeze

**Classification: D3-PREP-AUTH-04 HOLD — REQUIRED REVIEW/CONTRACT CONDITION UNSATISFIED**

## Decision

The project owner explicitly approved all three exact AUTH04 choices for the 3DMX/BNZ development fixture. The GLU128/count reconciliation is recorded exactly as proposed: preserve the corrected 51 side-chain identities plus two termini and include deprotonated GLU128−. The toolchain remains RDKit 2026.03.6 with CPython 3.13.16 x64 and the exact dependency artifact hashes in `PINNED_TOOLCHAIN_PROPOSAL.md`.

The AUTH04 scientific proposal and owner choices are closed. The exact API invocation has been corrected to the pinned RDKit Python wrapper signature without changing the approved effective parameters. However, the current Roadmap requires an independent evidence review for gate closure. No reviewer or signed review disposition is present in the available project evidence. The applicable review condition is therefore unsatisfied and this task cannot authorize D3-PREP-EXEC-04 yet. No execution prompt was generated.

## Owner decisions

- **AUTH04-01 — YES:** one development-only 3DMX/BNZ bootstrap under the named candidate profile, with the single-use scope, expiry, revocation, provenance and explicit non-permissions in `BOOTSTRAP_EXCEPTION_DECISION.md`.
- **AUTH04-02 — YES:** the complete state proposal at `target_pH=6.9` as a crystallization-context proxy; all exact states as enumerated; the source count reconciled to 51 side-chain identities plus two termini; GLU128 explicitly deprotonated (−1). This is a single candidate state, not an experimentally known binding microstate.
- **AUTH04-03 — YES:** profile `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0`, v1.0.0; RDKit hydrogen-only coordinate generation; coherent A altlocs at MET106/GLU108; occurrence-level CORE_DRY_V1 component policy; no structural repair or minimization; heavy-atom invariance and complete provenance.

Exact authority text and its SHA-256 are recorded in `OWNER_AUTHORIZATION_RECORD.md`.

## Toolchain disposition

RDKit 2026.03.6 release docs, wrapper source, C++ implementation, exact Windows CPython 3.13 wheel SHA, and Python 3.13.16 official installer checksum were verified against primary release sources. The Python call is `Chem.AddHs(molecule, explicitOnly=False, addCoords=True, onlyOnAtoms=None, addResidueInfo=True)`. The pinned wrapper defaults internal `skipQueries` to false; the execution driver must first reject query atoms and bonds. Details and primary source links are in `TOOLCHAIN_API_VERIFICATION.md`.

The exact DEC04 predecessor worktree passes its 19-entry SHA256SUMS.txt and six-entry SOURCE_MANIFEST.csv checks. The AUTH04 Windows checkout materializes the inherited CIFs with CRLF and their raw bytes fail the DEC04 source hashes; any future execution must read byte-exact inputs from the verified predecessor checkout or checked copies, and stop before parsing if a hash does not match.

The exact Python installer downloaded in this task matched its published SHA-256. An isolated per-user install attempt rolled back with Windows Installer error `0x80070003` while opening the local `core.msi` cache path. No runtime or wheels were installed and no RDKit operation or molecular preparation occurred. The future execution task must verify the exact runtime and wheel installation before any graph construction or H addition. This environment setup result is recorded as an execution preflight, not as a chemistry result.

## Review requirement

The canonical preparation rules do not require an independent structural biologist or computational chemist to approve hydrogen coordinates before the bounded preparation call; that review is recommended. Separately, the current Execution Roadmap says gate closure requires an independent evidence review. No independent reviewer is named in this evidence lane, and no review report or sign-off is present. The missing Roadmap review blocks AUTH04 gate exit and D3-PREP-EXEC-04 authorization; see `REVIEW_REQUIREMENT_STATUS.md`.

## Scope and claims

No 3DMX/BNZ preparation, hydrogen addition, scoring, grid construction, docking, PyMOL modification, D4 implementation, or D1/D2 behavior change occurred. The owner approval does not create a general preparation profile, alter CORE_DRY_V1, enable production behavior, or enable `DOCKING.RUN`.

3DMX/BNZ remains the active selected fixture. Full D3 remains HOLD; D4 remains BLOCKED; `DOCKING.RUN` remains UNAVAILABLE.

## Evidence index

- `PREDECESSOR_DECISION_EXTRACTION.md`
- `BOOTSTRAP_EXCEPTION_DECISION.md`
- `CHEMICAL_STATE_DECISION.md`
- `PREPARATION_CONTEXT_DECISION.md`
- `ALTERNATE_COMPONENT_POLICY_FREEZE.md`
- `HYDROGEN_TOOLCHAIN_CANDIDATES.md`
- `PINNED_TOOLCHAIN_PROPOSAL.md`
- `TOOLCHAIN_API_VERIFICATION.md`
- `HEAVY_ATOM_INVARIANT.md`
- `HYDROGEN_PROVENANCE_CONTRACT.md`
- `PREPARATION_PROFILE_FREEZE.md`
- `OWNER_DECISION_PACKET.md`
- `OWNER_AUTHORIZATION_RECORD.md`
- `REVIEW_REQUIREMENT_STATUS.md`
- `EXECUTION_READINESS_MATRIX.md`
- `OPEN_BLOCKERS.md`
- `PREFLIGHT_RECORD.md`
- `CHANGED_PATHS.txt`
- `SHA256SUMS.txt`

`D3_PREP_EXEC_04_PROMPT.md` is absent because the required independent evidence review has not been completed.
