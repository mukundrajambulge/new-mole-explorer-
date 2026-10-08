# Mole Explorer: agent guide (keep this file short; every agent loads it)

Browser molecular workstation + docking. Sprint goal: correct, secure workstation and a real docking run in the browser (pinned Vina 1.2.7, re-scored by our C++ scorer). Current state: docs/sprint/STATE.md. Tasks: docs/sprint/backlog.json.

## Map
apps/api (Node 22, :8100) · apps/web (React 18 + Vite, :3101, 3Dmol via rendering/ThreeDMolViewerAdapter.ts) · packages/contracts (shared types + zod) · native/docking-reference (C++17, build in WSL Ubuntu-24.04) · workers/prep (Python) · tools/mole-dock · tests/e2e · tests/fixtures (real RCSB files)

## Checks: always use the compact runner
`node scripts/sprint/check.mjs` (add --quick, --native, --python, --smoke). Never run raw npm test/tsc/eslint/playwright: hooks block it. Full logs land in test-results/sprint-logs/; grep them instead of printing.

## Token discipline (hard rules)
1. Read only the task's contextFiles first; find anything else with Grep. Files over 120 KB need Read with offset/limit (hook-enforced).
2. Never open verification/, outputs/, node_modules/, lockfiles, images or big fixtures.
3. Keep commands quiet: git log --oneline -n 20, git diff --stat first, then path-limited diffs.
4. Do not restate code or logs in your answer. The final result must fit the schema's length limits.
5. Commit a WIP checkpoint after each working sub-step (`wip(<task>): ...`), so an interrupted run never loses work.
6. If you are not converging after about 40 tool calls, stop: commit WIP and return status PARTIAL with what remains.

## Engineering rules
- Edit only the task's owned files, unless that is unavoidable (then list them in outsideOwnedFiles).
- Tests prove "done when"; parsing and science tests use real files from tests/fixtures.
- Validate inputs (zod), cap sizes, keep paths inside their root, no absolute paths in errors.
- No per-atom work in render or hover paths; no [...a, x] or .includes inside loops.
- Never change scoring constants, profile IDs or digests unless the task says so. Never fabricate results; unfinished features stay UNAVAILABLE or PREVIEW_UNQUALIFIED.
- Never write into verification/ (hook-enforced). Never force-push, delete tags or reset shared branches.

## Implementer protocol
In your fresh worktree: git switch -c <branch> <base> (fix round: git switch <branch>) → npm ci → implement + tests → node scripts/sprint/check.mjs --quick (plus lane flags) → commit "<task-id>: <title>" ending with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" → git switch --detach → return the schema.
