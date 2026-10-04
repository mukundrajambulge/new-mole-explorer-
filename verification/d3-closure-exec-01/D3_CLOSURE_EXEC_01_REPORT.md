# D3-CLOSURE-EXEC-01 report

**Disposition:** `D3-CLOSURE-EXEC-01 HOLD — HARD SCIENTIFIC OR NUMERICAL FAILURE`

**Reason:** the approved CPython runtime starts in isolation, but Windows Code Integrity blocks RDKit 2026.03.6's unsigned native extension `rdBase.pyd` under the device's enterprise signing policy. RDKit could not be imported, so the approved hydrogen-generation operation could not be run. This meets the integrated task's §39 hard-stop example, “pinned toolchain cannot reproduce the approved state.” No chemistry or scoring operation was attempted.

## Gate review

The current Execution Roadmap §3.2 requires “code review and an independent evidence review” at closure. It does not name a human reviewer or credential. The separate D3-CLOSURE-EXEC-01 §12 requires an independent pre-execution review; that review was completed by the isolated read-only reviewer lane and is recorded in `D3_REQUIRED_GATE_REVIEW.md`.

AUTH04 makes deterministic replay a mandatory execution precondition, and this integrated task §25 directs the repeated preparation. Neither operation began because RDKit could not be imported. The approved preparation remains unconsumed; no replay or digest-equality result is claimed.

The reviewer confirmed that this task authorizes a D3 profile-aware prepared-state envelope to bind the candidate preparation-profile digest while preserving D2 V1 object and digest semantics. The envelope is described in `PROFILE_AWARE_ENVELOPE_SCHEMA.md`; no envelope instance was created because there is no prepared state.

## Completed work

- Verified the approved AUTH04 parent commit and clean isolated branch before work. This closure worktree is based on `2e05be567d96592e866ab13acb161c9eb3ae2953` on `feature/d3-closure-exec-01`.
- Read the current Roadmap and required scientific documents, then completed the independent pre-execution review.
- Copied the six byte-exact DEC04 RCSB source artifacts into this evidence package and checked every copied byte length and SHA-256 against `SOURCE_MANIFEST.csv`. No source was parsed or used for chemistry.
- Downloaded and verified the pinned Python installer and all four pinned wheels. The full installer rolled back; the official Python embeddable runtime was then unpacked into an isolated, task-specific directory and reports CPython 3.13.16 x64.
- Bootstrapped pip 25.2 and installed only the pinned RDKit, NumPy, and Pillow wheels. RDKit import failed because Code Integrity blocked `rdkit/rdBase.pyd`.
- The independent code review found a TOR parser fail-open on malformed fixed-width serials. The parser now checks the complete five-character atom serial field before conversion; a regression rejects `0001X`. This is a strict input-validation correction and does not change the scientific scoring proposal.
- Re-ran the complete repository test command after the correction: 47 test files and 254 tests passed (web 34/156, API 13/98). `npm run typecheck`, `npm run lint`, and `npm run build` also exited 0 on the corrected revision. The build emitted the existing 3Dmol.js `eval` and large-chunk advisories.
- Re-attempted the pinned RDKit import on 2026-10-04 04:13:04 UTC. Windows Code Integrity again blocked `rdkit\rdBase.pyd` (events 3033/3077, policy `0283ac0f-fff1-49ae-ada1-8a933130cad6`); the full transcript is `runtime_logs/rdkit-import-recheck.txt`.
- Completed the current canonical-document source review, repository preflight, requirement and acceptance-test traceability, and the blocked-state reports required for this closure package.

## Not performed

No CIF parsing, molecular graph construction, synthetic ethane control, `Chem.AddHs`, driver/profile sealing, fixture preparation, deterministic replay, prepared-state sealing, SearchRegion sealing, scorer or field evaluation, or full-pose analysis occurred. The independent reviewer passed the blocked-state evidence-package audit, but no scientific execution outputs exist for final D3 acceptance review. The source files in this package are verified copies only; they are not evidence of byte-exact use by a chemistry operation.

## Required to resume

1. Resolve device policy so the pinned RDKit native extension can load under the approved isolated runtime, without disabling or bypassing Code Integrity. The runtime and wheel hashes are preserved in `PINNED_TOOLCHAIN_EXECUTION_RECORD.md`.
2. After the approved runtime is executable, complete the preparation and required deterministic replay under the frozen source/profile conditions. Do not use synthetic replay as a substitute for fixture replay.

## Closure evidence status

The exact Roadmap §3.2 language and source revision are recorded in `DRIVE_SOURCE_REVIEW.md` and `D3_REQUIRED_GATE_REVIEW.md`. It requires code review and an independent evidence review, without naming a human credential. The task-specific independent pre-execution review and corrected-revision code review passed. An independent audit of the blocked-state evidence package also passed; scientific closure remains unsupported because prepared states and full-pose results do not exist.

The source copy hashes are listed in `BYTE_EXACT_INPUT_VERIFICATION.md`; they establish byte-exact copies only, not source use. The approved profile ID is `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0`; no profile, receptor, ligand, or SearchRegion digest was produced. No pose cohort or numerical statistics exist. Regression evidence and limits are summarized in `CUMULATIVE_REGRESSION_REPORT.md` and `RESOURCE_VALIDATION.md`.

The exact final classification remains **`D3-CLOSURE-EXEC-01 HOLD — HARD SCIENTIFIC OR NUMERICAL FAILURE`** under §39 because the approved pinned chemistry engine cannot reproduce the approved runtime state on this host. D3-FINAL-01 is not ready; D4 remains blocked and `DOCKING.RUN` remains unavailable.

No D3-FINAL-01 handoff is issued. D3 remains HOLD; D4 and `DOCKING.RUN` remain unavailable.
