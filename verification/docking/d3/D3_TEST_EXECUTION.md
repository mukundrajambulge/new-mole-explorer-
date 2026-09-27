# D3 test execution report

Candidate code commit: 0b83a318822856d7f4ce231983ec5fe0d9ab22d3
Tested repository baseline: P0 tag mole-explorer-p0-perf-accepted-2026-09-21, SHA f773b7fcf0a6f16b23f9abc760fa9d2292b63061
Runtime: Windows x64, Node 24.14.1, npm 11.11.0, Chromium installed through Playwright.
Disposition: HOLD because mandatory grid, complete typing, provenance, and acceptance conditions remain unresolved.

## Repository regression commands

| Command | Fresh result |
| --- | --- |
| npm run typecheck --workspaces | PASS |
| npm run lint --workspaces | PASS |
| npm test | PASS: web 34 files / 156 tests; API 12 files / 90 tests; 246 total |
| npm run build | PASS; existing 3Dmol eval and bundle-size warnings were emitted |
| npm run test:e2e -- --reporter=line | PASS: 150 / 150 browser tests, including final PyMOL workstation acceptance coverage, UI-D0 boundary cases, P0 boot/camera, R07/R08/R09/R10, selection campaign and responsive UI |
| node verification/p0-perf/renderer-baseline.mjs | PASS against fresh production preview plus API; counters recorded below |

The E2E run took about 34.5 minutes. Playwright rewrote tracked screenshot/report outputs during execution. Those generated verification changes were restored from the unchanged P0 commit afterward; the source candidate and package manifests were unchanged. The report artifacts are not claimed as changed D3 deliverables.

## Native direct scorer

Six native fixture groups passed with GCC 9.4 on Ubuntu 20.04, using the compiler's C++2a preview mode, strict warnings, no fast-math, and floating-point contraction disabled. The same fixtures passed with UndefinedBehaviorSanitizer and AddressSanitizer builds. The independent numeric fixture is documented in D3_INDEPENDENT_NUMERICAL_VERIFICATION.md.

The pinned scientific environment in the requirements is Ubuntu 24.04 with GCC 13.3.0-6ubuntu2~24.04.1 and C++20. The available compiler was Ubuntu 20.04 GCC 9.4; CMake and container runtimes were unavailable. Therefore these native runs are development-only and are not claimed as pinned-toolchain acceptance.

## Fresh protected P0 measurements

Scientific hash identities were unchanged:

| Fixture | Hash | Elapsed | Size and counts |
| --- | --- | ---: | --- |
| tests/fixtures/mini-protein.pdb | fa1524d6d571617208dd1bea5822b0ffa44c5c3f3353e923e019b5d9a7d69c37 | 18.43 ms | 1,214 B; 12 atoms; 8 bonds |
| tests/fixtures/g1c-small-molecule.pdb | df756035ad07fd030ced2c1a0eed09a40af620a2a58eb352e30b959244f7f726 | 6.36 ms | 342 B; 3 atoms; 2 bonds |
| verification/large-molecule-4v6f/01-source/4v6f.cif | 20b7c8468b598ce6272d83709eba7454505881b43d5083c85df50735e801d913 | 16.29 s | 38,555,766 B; 307,345 atoms |

4V6F post-run RSS sample was approximately 1.145 GB. It is a post-run process sample, not peak memory.

Fresh production renderer probe:

| Operation | Viewer / model / scene / projection rebuilds | Other counters |
| --- | --- | --- |
| Loaded mini-protein | 1 / 1 / 1 / 1 | 8 render calls; 0 diagnostics recomputations; 2 style rebuilds |
| Camera rotation | 1 / 1 / 1 / 1 | 22 render calls; 0 diagnostics recomputations; 2 style rebuilds |
| Representation change | 1 / 1 / 1 / 1 | 25 render calls; 1 diagnostics recomputation; 3 style rebuilds |
| Surface change | 1 / 1 / 1 / 1 | 26 render calls; 2 diagnostics recomputations; 4 style rebuilds; surface ready |

## Security audit

Current npm audit reported five existing development/test dependency findings: three moderate, one high, and one critical. npm audit --omit=dev reported zero production findings. No dependency or lockfile changes were made. Details and relevance are in D3_SECURITY_DEPENDENCY.md.

No D3 grid, direct-versus-grid scientific test, full authoritative SCORE-FX-001..040 campaign, pinned compiler run, or CMake run was possible or claimed as passed.
