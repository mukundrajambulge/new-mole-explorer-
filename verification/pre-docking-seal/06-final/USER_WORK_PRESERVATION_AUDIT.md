# User Work Preservation Audit

The original worktree was dirty before sealing. The sealing operation preserved unrelated work and used explicit path staging throughout.

## Baseline comparison

- Baseline tracked dirty paths: 678.
- Baseline tracked paths intentionally sealed into the accepted core: 17.
- Baseline tracked paths still dirty after sealing: 661.
- Baseline tracked paths unexpectedly missing: 0.
- Pre-existing untracked inventory entries: 1,277.
- Pre-existing untracked files missing: 0.
- Pre-existing untracked files with hash changes: 3, all authorized files touched by the scoped core sealing:
  - `apps/api/src/structures/ingestionProfiler.ts` (lint-safe newline correction);
  - `apps/web/src/selection/compactSelectionEngine.ts` (unused profile constants removed);
  - `verification/large-molecule-4v6f/19-lm-imp-001-fix/11-final/LM_IMP_001_FINAL_ACCEPTANCE_REPORT.md` (trailing-space cleanup).

The modified frozen 4V6F fixture remains user-owned and was not staged or committed. Bulk evidence, logs, screenshots, profiler output, and unrelated reports remain outside the seal.

No reset, clean, checkout, restore, or stash operation was used. No unrelated user data was deleted.
