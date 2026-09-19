# Accepted commit set — provenance audit

Captured during the MOLEXPLORER pre-docking seal campaign on 2026-09-19.

## Source of truth

The accepted implementation provenance is
`verification/large-molecule-4v6f/20-selection-a-bf-4v6f/41-final/4V6F_SELECTION_REPRODUCIBILITY_FINGERPRINT.json`.

## Comparison

- Fingerprinted production files: 17.
- Fingerprinted production files missing from the accepted source set: none.
- Additional source files required by imports from the fingerprinted implementation: 4.
- Fingerprinted test files: `apps/web/src/selection/selectionEngine.test.ts` and
  `tests/e2e/real-structure-workspace.spec.ts`; both are already present at the
  current HEAD and are unchanged in the worktree, so neither belongs in the
  scoped commit.

## Additional dependency rationale

The four additional files are required for the fingerprinted code to compile
and run:

- `apps/api/src/structures/compactCanonical.ts` — server-side compact payload construction.
- `apps/api/src/structures/ingestionProfiler.ts` — opt-in profiling hooks used by
  the accepted bounded-ingestion evidence; disabled unless the profile-path
  environment variable is set and never changes ingestion semantics.
- `apps/web/src/selection/compactSelectionEngine.ts` — compact-column selection
  evaluation imported by `selectionEngine.ts`.
- `apps/web/src/structures/compactCanonical.ts` — lazy legacy views and renderer
  atom-spec projection imported by the accepted web implementation.

No production path in the accepted set is absent from acceptance provenance,
and no unrelated worktree path is included. The complete path-level decision is
in `01-classification/WORKTREE_FILE_CLASSIFICATION.csv` and `.json`; the exact
staging contract is `ACCEPTED_COMMIT_FILESET.txt`.
