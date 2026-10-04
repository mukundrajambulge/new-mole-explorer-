# Cumulative regression report

## Current closure branch

On the execution branch containing D3-TOR-01 and D3-GRID-01 ancestry:

| Command | Result |
|---|---|
| `npm ci` | PASS; lockfile install succeeded, 248 packages; npm reported 6 advisories (3 moderate, 2 high, 1 critical); no fixes applied. |
| `npm test` | PASS on the corrected TOR parser and again in the runtime-unblock continuation; 47 files and 254 tests (web 34/156, API 13/98). Continuation output is `runtime_logs/continuation-npm-test-output.txt`. The regression rejects `0001X` in the five-character PDBQT serial field. |
| `npm run typecheck` | PASS across API, app, web and contracts in the continuation; see `runtime_logs/continuation-npm-typecheck-output.txt`. |
| `npm run lint` | PASS across API, app, web and contracts in the continuation; see `runtime_logs/continuation-npm-lint-output.txt`. The earlier initial lint failure/fix remains in `runtime_logs/`. |
| `npm run build` | PASS in the continuation; see `runtime_logs/continuation-npm-build-output.txt`. Existing 3Dmol.js `eval` and large-chunk advisories were emitted; build completed. |
| Native CMake/CTest | PASS in WSL2 Ubuntu 24.04.5 with CMake 3.28.3 / GCC 13.3.0; direct scorer and scoring field both pass, 2/2 targets. Detailed resource run is recorded under `runtime_logs/continuation-native-*`. |
| Protected PyMOL browser suite | PASS, 3/3 in this continuation; screenshot fixture hashes were restored and verified after Playwright rewrote them. |

## Preserved D3 implementation evidence

`verification/d3-grid/D3_GRID_01_TEST_REPORT.md` records strict Zig 0.16.0 C++ direct-scoring tests (6 fixture groups) and field tests (6 fixture groups), the focused TypeScript contract test (5 tests), D1/D2 regressions, D3-TOR-01 tests (7), workspace typecheck/lint/build/tests, and protected final PyMOL browser tests (3/3). Its implementation commit is an ancestor of this branch. The continuation independently reran native direct/field tests with CMake/GCC on WSL2 and the protected PyMOL browser suite. No D2-sealed prepared complex was available, and no direct-versus-grid fixture full-pose result is claimed.

The independent code review identified a permissive TOR atom-serial parse; the corrected implementation validates the complete fixed-width field, and the new test rejects a trailing non-numeric character. The reviewer re-reviewed the correction and passed the Roadmap code-review element. Continuation regressions pass at the same 47-file/254-test count, plus typecheck, lint, build, native scorer/field tests, and protected PyMOL browser tests. Fixture preparation and full-pose tests did not run: although the relocated pinned Python/RDKit runtime and safe synthetic controls pass, the fixture preflight found unresolved coordinate states outside the approved profile. The pinned PyMOL executable oracle remains pending; browser tests do not claim executable-oracle conformance or manual user retest.
