# Cumulative regression report

## Current closure branch

On the execution branch containing D3-TOR-01 and D3-GRID-01 ancestry:

| Command | Result |
|---|---|
| `npm ci` | PASS; lockfile install succeeded, 248 packages; npm reported 6 advisories (3 moderate, 2 high, 1 critical); no fixes applied. |
| `npm test` | PASS after TOR serial-parser correction; 47 files and 254 tests (web 34/156, API 13/98), recorded in `runtime_logs/npm-test-output.txt` and `runtime_logs/npm-test-run.txt`. The new regression rejects `0001X` in the five-character PDBQT serial field. |
| `npm run typecheck` | PASS across API, app, web and contracts after the parser correction, run on 2026-10-04 in this checkout. |
| `npm run lint` | PASS across API, app, web and contracts after the parser correction, run on 2026-10-04 in this checkout. An initial lint run rejected the test regex style; the expression was corrected and the lint rerun passed. Both transcripts are preserved in `runtime_logs/`. |
| `npm run build` | PASS in this checkout after the parser correction. Existing 3Dmol.js `eval` and large-chunk advisories were emitted; build completed. |

## Preserved D3 implementation evidence

`verification/d3-grid/D3_GRID_01_TEST_REPORT.md` records strict Zig 0.16.0 C++ direct-scoring tests (6 fixture groups) and field tests (6 fixture groups), the focused TypeScript contract test (5 tests), D1/D2 regressions, D3-TOR-01 tests (7), workspace typecheck/lint/build/tests, and protected final PyMOL browser tests (3/3). Its implementation commit is an ancestor of this branch. CMake was unavailable there; the recorded strict native path used Zig. No D2-sealed prepared complex was available in that D3-GRID evidence, and no direct-versus-grid full-pose result was claimed.

The independent code review identified a permissive TOR atom-serial parse; the corrected implementation validates the complete fixed-width field, and the new test rejects a trailing non-numeric character. The reviewer re-reviewed the correction and passed the Roadmap code-review element. The present continuation did not run repository regressions because it changed only closure evidence/tools, not application code. It did not run fixture preparation or full-pose tests: although the relocated pinned Python/RDKit runtime and safe synthetic controls pass, the fixture preflight found unresolved coordinate states outside the approved profile. PyMOL's pinned executable oracle remains pending; the preserved 3/3 browser test result does not claim executable-oracle conformance or manual user retest.
