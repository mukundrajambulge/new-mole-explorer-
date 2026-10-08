# Pre-Docking Baseline

This is the accepted upstream core checkpoint for the next phase.

- Seal branch: `seal/pre-docking-pymol-core-2026-09-19`
- Tested source SHA: `28a8dca64a4711ca4b9e00e13e19601e56404709`
- Planned immutable tag: `mole-explorer-pre-docking-core-2026-09-19`
- Starting branch lineage: `fix/lm-imp-001-canonical-large-ingestion`
- Historical starting SHA: `1b44780c214e83c4d864bb94ecd49132d59b09c3`
- Remote: `new-origin https://github.com/mukundrajambulge/new-mole-explorer-.git`

## What is sealed

The sealed core includes the accepted canonical ingestion, compact transport, progressive large-structure rendering, viewer lifecycle, workspace identity, selection semantics and persistence, presentation projection, camera actions, editing foundations, analysis/session/export contracts, and the R10 typed command boundary.

The source SHA passed the clean-checkout gates in [CLEAN_SHA_REGRESSION_REPORT.md](../04-clean-regression/CLEAN_SHA_REGRESSION_REPORT.md). The accepted frozen 4V6F fixture was used for the focused large-structure smoke but remains outside the commit by design.

## Acceptance posture

- Full unit/API suite: 215/215 passed.
- Full E2E suite: 147/147 passed.
- Selection matrix and R10 verification: passed.
- API health, web shell, `/molstudio`, responsive shell, 1CRN/4DJW, multi-object, and focused 4V6F smoke: passed.
- PyMOL oracle: `BLOCKED_ENVIRONMENT`, unchanged from accepted evidence.
- AF-001: documented performance concern with correct semantics; no P0/P1 defect observed.

This baseline is the upstream-core source of truth for D1 planning. It is not a request to start docking execution.
