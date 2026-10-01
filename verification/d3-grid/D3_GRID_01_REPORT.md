# D3-GRID-01 — Bounded Scoring-Field Core

## Disposition

**Bounded implementation PASS; ready for D3 numerical/full-pose follow-up.** This is not D3 acceptance. D3 remains HOLD, D4 remains BLOCKED, and production `DOCKING.RUN` remains unavailable.

## Provenance

- Branch: `feature/d3-scoring-field-core`
- Verified remote `main`: `c219d5fcfcbe71537fb8e0139cdef495a9f1f504`
- Protected D3-TOR-01 commit: `f0bd2eaf47b02faab4dea694e7c2677094969076`
- Implementation commit: `2b811c238ed071ce1f6d007a393e81ef65fe29f3` — `feat(docking): add bounded sparse scoring field core`
- Starting HEAD was D3-TOR-01, whose parent is verified remote `main`; both commits are ancestors of the implementation.
- Worktree: `C:\Users\mukun\.codex\worktrees\d3-scoring-field-core\molecular-workstation`
- Canonical evidence folder: https://drive.google.com/drive/folders/1H4zmeZlyuySRwZfvMSr2uCW1fE7eN45f

## Implemented contract

- Sixteen canonical XS types; five terms; exactly 80 stable logical IDs with `5 * XS_ID + TERM_ID`.
- A constexpr 80→59 mapping in ascending logical-ID order. The omitted IDs are `4,8,9,13,14,18,23,28,33,34,38,43,48,53,54,58,59,64,69,74,79`. [channel-map.csv](./channel-map.csv) enumerates all channels.
- Omitted raw values materialize as IEEE-754 binary64 `+0.0`; ordinary term coefficients yield signed `-0.0` when specified by IEEE-754 multiplication. F64Bits canonicalization preserves the sign.
- A shared direct pair-scoring primitive drives both direct scoring and field-node construction.
- Canonical `ME_VINA_GRID_V1_1_0` geometry at 0.375 Å spacing, one-cell interpolation halo, complete trilinear stencil, no extrapolation or clamping, and fail-closed out-of-domain results.
- `SCORING_FIELD_LOGICAL_V2` logical digest covers all 80 channels and is independent of compatible storage. `SCORING_FIELD_STORAGE_V1` and `ME_SCORING_FIELD_80_TO_59_F64_V1` identify physical layout and payload separately. Cache fixtures reject incompatible schema/layout and tampering.
- Deterministic receptor ordering and spatial indexing; unsupported chemistry, incomplete site-influence evidence, invalid provenance, and unsupported geometry fail closed.
- No search, optimizer, RNG, pose generation, receptor/ligand preparation, GPU, or production-run path was added.

## Full-size C++ resource result

Measured by the bounded production C++ builder on the maximum 110×110×110 grid with 250,000 supported receptor scoring centers:

| Metric | Measured | Limit | Result |
|---|---:|---:|---|
| Raw physical payload | 628,232,000 B | 805,306,368 B (768 MiB) | Within |
| Field-owned allocation during construction | 635,301,608 B | 1,073,741,824 B (1 GiB) | Within |
| Retained field allocation | 628,234,152 B | 1,073,741,824 B (1 GiB) | Within |
| Construction peak field-owned allocation | 635,301,608 B | 1,073,741,824 B (1 GiB) | Within |
| Process peak working-set RSS | 674,414,592 B | 2,147,483,648 B default | Within |
| Ordinary-V1 RSS safety ceiling | — | 4,294,967,296 B | Higher ceiling retained |

RSS was read from the operating system and reported independently; it is not inferred from field allocation. This is a full-size C++ allocation/build measurement, not a resource guarantee for future search or pose workloads.

## Verification outcome

See [D3_GRID_01_TEST_REPORT.md](./D3_GRID_01_TEST_REPORT.md) for commands and results.

- C++ direct-scoring fixtures: 6 groups PASS.
- C++ scoring-field fixtures: 6 groups PASS; maximum-size resource fixture PASS.
- TypeScript logical-channel and canonical digest fixtures: 5/5 PASS, including C++/TypeScript digest agreement.
- Typecheck, lint, 253 workspace tests (156 web + 97 API), and production build PASS.
- Protected final PyMOL browser acceptance: 3/3 PASS. Its generated screenshots were restored after the run so checked-in acceptance evidence remains unchanged.
- The pinned PyMOL executable oracle remains unavailable (`ORACLE_PENDING` in the preserved acceptance report); no executable PyMOL conformance claim is made.
- Diff integrity check passed. CMake configuration was not run because CMake is unavailable in this environment; the Windows native executables were compiled with the pinned Zig C++ toolchain and strict floating-point flags.

## Open scientific follow-up

No D2-sealed prepared receptor/ligand complexes are present in the repository evidence. Therefore, no direct-versus-grid full-pose error distribution was substituted with synthetic data.

**FULL-POSE APPROXIMATION ACCEPTANCE REMAINS OPEN.** No approximation, ranking, or preparation threshold is approved here. Owner decisions must follow D2-sealed prepared-state/full-pose development evidence.

## Gate state

- PyMOL — PROTECTED; final manual user retest remains pending per its acceptance report.
- D1 — ACCEPTED.
- D2 — ACCEPTED.
- D3-TOR-01 — PASS / PRESERVED.
- D3-SCI-04 — PRESERVED research/conformance evidence.
- D3-GRID-01 — bounded implementation PASS only.
- Full D3 — HOLD.
- D4 — BLOCKED.
- Production docking and `DOCKING.RUN` — UNAVAILABLE.
