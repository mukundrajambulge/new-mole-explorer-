# Proposed D3 closure report — HOLD

Candidate tested implementation SHA: 0b83a318822856d7f4ce231983ec5fe0d9ab22d3
Branch: codex/d3-reference-scoring
Starting accepted tag and SHA: mole-explorer-p0-perf-accepted-2026-09-21 / f773b7fcf0a6f16b23f9abc760fa9d2292b63061
Recommendation: HOLD; do not mark D3 accepted and do not create an acceptance tag.

## Completed

- Revalidated and used the exact accepted P0 baseline in an isolated worktree.
- Added a standalone deterministic CPU direct-scoring reference component and independent numerical fixtures.
- Passed fresh TypeScript typecheck, lint, 246 unit/integration tests, production build, and 150/150 browser E2E tests.
- Passed native direct-scoring fixtures with development GCC 9.4 and ASan/UBSan variants.
- Re-ran P0 scientific hash checks for two PDB fixtures and the 4V6F mmCIF; identities matched accepted values.
- Re-ran the production renderer probe; P0 viewer/model/scene/projection rebuild invariants held.
- Audited the existing npm findings; no dependency changes were made.
- Preserved the Desktop checkout and accepted P0 tag.

## Acceptance blockers

- The authoritative chemistry/grid documents conflict on 14 versus 16 supported ligand XS types and provide no channel map.
- The required direct-versus-grid scientific tolerance is not stated in its nominated source.
- Grid construction, interpolation and direct-versus-grid validation are not implemented.
- Complete graph-based chemical perception, canonical profile digest checks, result-record digest generation and full SCORE-FX acceptance coverage are not implemented.
- The pinned compiler environment and CMake acceptance build were unavailable.

## Conditions to unlock acceptance

1. Resolve the supported ligand XS set and publish the exact ordered 70-channel map, including interaction-term ordering.
2. Publish the direct-versus-grid comparison metric, tolerance, domain, boundary treatment and fixture set in the authoritative specification.
3. Complete the remaining D3 implementation and full acceptance matrix against those frozen requirements.
4. Build and execute all native checks in the pinned toolchain, rerun the cumulative protected-baseline campaign on the final source SHA, and review the complete evidence.
5. Only after all gate criteria and required approval conditions pass, create the immutable D3 acceptance tag.

This report records a reviewable implementation candidate and its verification limits. It is not an acceptance or a waiver of the unresolved scientific requirements.
