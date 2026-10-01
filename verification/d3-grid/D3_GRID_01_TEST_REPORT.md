# D3-GRID-01 Test and Resource Record

Implementation commit: `2b811c238ed071ce1f6d007a393e81ef65fe29f3`.

## Native C++ tests

Toolchain: Zig 0.16.0, target `x86_64-windows-gnu`, `-std=c++20 -O2 -Wall -Wextra -Wpedantic -Werror -ffp-contract=off -fno-fast-math`. The field executable linked Windows `psapi` for process peak working-set measurement. The bundled compiler's recorded SHA-256 is `086ce9d47ba42f33a514e1a6e04eb1d4a8fa1d75e0868e0213caad447c91e864`; package hash `68659eb5f1e4eb1437a722f1dd889c5a322c9954607f5edcf337bc3684a75a7e`.

- Direct scorer compiled from `scoring.cpp` + `scoring_test.cpp`: **PASS — 6 fixture groups**.
- Scoring field compiled from `scoring.cpp` + `scoring_field.cpp` + `scoring_field_test.cpp`: **PASS — 6 fixture groups**.
- Resource line: `raw_payload_bytes=628232000 field_owned_allocation_bytes=635301608 retained_field_allocation_bytes=628234152 construction_peak_owned_bytes=635301608 peak_rss_bytes=674414592 receptor_scoring_atoms=250000`.

The native matrix covers 16×16 receptor/ligand XS combinations, shared direct pair terms, term breakpoints, 8 Å cutoff behavior, all channel IDs and mappings, exact +0.0 / weighted -0.0, interpolation nodes/faces/edges/corners/halo and OOD, dense/sparse logical digest equality, canonical F64Bits signed zero, storage identity and adversarial cache cases, invalid inputs, and the maximum geometry/resource fixture.

## TypeScript and repository regression

| Command | Result |
|---|---|
| `npm exec -- vitest run verification/d3-grid/scoring-field-contract.test.ts` | 1 file, 5 tests PASS |
| `npm run typecheck` | PASS (API, app, web, contracts) |
| `npm run lint` | PASS (all workspaces) |
| `npm test` | PASS — web 34 files / 156 tests; API 13 files / 97 tests |
| D1 contracts included in workspace tests | 14 tests PASS |
| D2 preparation included in workspace tests | 11 tests PASS |
| D3-TOR-01 included in workspace tests | 7 tests PASS |
| `npm run build` | PASS |
| `npm run test:e2e -- tests/e2e/final-pymol-acceptance.spec.ts` | PASS — 3/3 tests |

Build emitted the pre-existing 3Dmol.js `eval` advisory and a large web chunk advisory (1,406.87 kB); build completed successfully.

## Diff and environment

- `git diff --check`: PASS.
- CMake executable: unavailable; no CMake generator/test run is claimed.
- Pinned PyMOL executable: unavailable; automated protected browser regression passed, but oracle conformance remains pending.
- No D2-sealed prepared receptor/ligand complex fixture was available, so no direct-versus-grid full-pose statistics were generated.
- PyMOL test screenshots emitted during the browser run were restored to their pre-run checked-in bytes.
