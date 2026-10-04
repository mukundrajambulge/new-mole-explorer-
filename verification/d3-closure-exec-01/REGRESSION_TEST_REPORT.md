# Regression test report

## Current D3-CLOSURE-EXEC-01 final run

- npm test: PASS — web 34 files / 156 tests; API 13 files / 98 tests; total 47 files / 254 tests.
- D1 contracts: 14 tests passed within the API suite.
- D2 preparation: 11 tests passed within the API suite.
- D3-TOR: 8 tests passed within the API suite, including the fixed-width serial validation.
- D3-GRID channel/scoring-field contract: PASS — 1 file / 5 tests.
- Native CMake/CTest: PASS — direct scorer and scoring field, 2/2 targets. This includes direct-vs-grid channel mapping, serialization, interpolation, cutoff, and failure-path implementation coverage inherited from the native test targets.
- Fixture source/profile completeness validator: PASS before RDKit import; 164 residues, 51 state-sensitive side chains, five altloc groups, both termini, and all 418 components.
- Preparation and deterministic replay: PASS — two controlled runs, canonical payload digests identical; heavy-atom invariants and hydrogen provenance complete.
- D2 state sealing and independent digest replay: PASS for receptor, ligand, kinematic, coordinate, chemical, identity, prepared-state, and SearchRegion records.
- Fixture full-pose validation: PASS — six SEALED_STATES poses; direct/grid terms and score distributions retained; every pose IN_DOMAIN; no ties or ordering reversals.
- Full-pose synthetic smoke: PASS — five marked control poses.
- Protected PyMOL browser regression: PASS — 3/3 Playwright tests. The two generated screenshot files were restored; all 40 protected screenshot hashes match their captured pretest values.
- Workspace typecheck, lint, and production build: PASS across API, app, web, and contracts.

The browser suite is the protected PyMOL UI regression. The pinned executable PyMOL oracle and manual user retest remain separately pending in their existing acceptance record; this closure does not claim either.

## Historical regression evidence

Earlier continuation logs remain under runtime_logs/. D3-GRID-01 records its original strict Zig direct/scoring-field matrices and maximum-field resource run. This closure independently ran the native targets with CMake/GCC in WSL2. The run emitted existing 3Dmol.js eval and large-chunk advisories; no fix or dependency update was applied.

Exact D3-CLOSURE-EXEC-01 classification: PASS — prepared fixture sealed and full-pose D3 evidence complete; ready for final D3 acceptance.
