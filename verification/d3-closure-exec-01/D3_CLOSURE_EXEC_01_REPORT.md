# D3-CLOSURE-EXEC-01 report

**Disposition:** `D3-CLOSURE-EXEC-01 HOLD — HARD SCIENTIFIC OR NUMERICAL FAILURE`

**Reason:** the approved CPython runtime starts in isolation, but Windows Code Integrity blocks RDKit 2026.03.6's unsigned native extension `rdBase.pyd` under the device's enterprise signing policy. RDKit could not be imported, so the approved hydrogen-generation operation could not be run. This meets the integrated task's §39 hard-stop example, “pinned toolchain cannot reproduce the approved state.” No chemistry or scoring operation was attempted.

## Gate review

The current Execution Roadmap §3.2 requires “code review and an independent evidence review” at closure. It does not name a human reviewer or credential. The separate D3-CLOSURE-EXEC-01 §12 requires an independent pre-execution review; that review was completed by the isolated read-only reviewer lane and is recorded in `D3_REQUIRED_GATE_REVIEW.md`.

The review found a second unresolved authorization conflict: this task §25 directs a fixture preparation replay, while the authoritative AUTH04 owner record and standalone execution prompt allow exactly one 3DMX/BNZ bootstrap preparation and prohibit a second fixture run/replay. No amendment to that closed owner record was supplied. The one authorized preparation was not consumed because the runtime blocked first.

The reviewer confirmed that this task authorizes a D3 profile-aware prepared-state envelope to bind the candidate preparation-profile digest while preserving D2 V1 object and digest semantics. The envelope is described in `PROFILE_AWARE_ENVELOPE_SCHEMA.md`; no envelope instance was created because there is no prepared state.

## Completed work

- Verified the approved AUTH04 parent commit and clean isolated branch before work. This closure worktree is based on `2e05be567d96592e866ab13acb161c9eb3ae2953` on `feature/d3-closure-exec-01`.
- Read the current Roadmap and required scientific documents, then completed the independent pre-execution review.
- Copied the six byte-exact DEC04 RCSB source artifacts into this evidence package and checked every copied byte length and SHA-256 against `SOURCE_MANIFEST.csv`. No source was parsed or used for chemistry.
- Downloaded and verified the pinned Python installer and all four pinned wheels. The full installer rolled back; the official Python embeddable runtime was then unpacked into an isolated, task-specific directory and reports CPython 3.13.16 x64.
- Bootstrapped pip 25.2 and installed only the pinned RDKit, NumPy, and Pillow wheels. RDKit import failed because Code Integrity blocked `rdkit/rdBase.pyd`.
- Ran the repository cumulative test command: 47 test files and 253 tests passed.

## Not performed

No CIF parsing, molecular graph construction, synthetic ethane control, `Chem.AddHs`, driver/profile sealing, fixture preparation, deterministic replay, prepared-state sealing, SearchRegion sealing, scorer or field evaluation, full-pose analysis, or final evidence review occurred. The source files in this package are verified copies only; they are not evidence of byte-exact use by a chemistry operation.

## Required to resume

1. Resolve device policy so the pinned RDKit native extension can load under the approved isolated runtime, without disabling or bypassing Code Integrity. The runtime and wheel hashes are preserved in `PINNED_TOOLCHAIN_EXECUTION_RECORD.md`.
2. Obtain an explicit owner-record amendment authorizing a second 3DMX/BNZ preparation for deterministic replay, or update the task's replay requirement while retaining the one-run boundary. Do not use synthetic replay as a substitute for fixture replay.

No D3-FINAL-01 handoff is issued. D3 remains HOLD; D4 and `DOCKING.RUN` remain unavailable.
