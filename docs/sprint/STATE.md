# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 8 · TODO: 77 · NEEDS_OWNER: 2 · DEFERRED: 8
Done by tier: core 8/45 · strong 0/35 · stretch 0/7
Calibration: not yet (next wave is a calibration wave); estimate multiplier 1
Last waves: none

## Needs the owner
- 3.2 Replace the JSON fingerprint with revision counters: NEEDS_OWNER (W1: dirtyTracker + unit tests pass; needs 4V6F perf run proving hover does no JSON.stringify in App (fixture missing in agent worktree; fetch via scripts/fetch-fixtures.mjs).)
- 5.1 Lock the tool versions (DEC-2, DEC-3): NEEDS_OWNER (W1 PARTIAL: sandbox blocked wsl for agents. Need: run scripts/lock-prep.sh in WSL for full hashed transitive lock, install+pin PDBFixer, verify licences via pip show. Agent summary overstated branch content; reviewer flagged.)

## Next ready tasks (critical path first)
- ★ 0.7 [L1 S/low] Stop tests from writing into tracked folders
- ★ 1.1 [L2 S/high] Two run modes: local and hosted
- ★ 2.3 [L3 M/high] Fix the mmCIF tokenizer
- ★ 4.4 [L5 S/high] Send numbers over JSON correctly
- ★ 5.0 [L6 S/medium] Docking job API contract (zod schemas) for UI and backend
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.9 [L2 S/low] Fix the vulnerable development tools
- 2.2 [L3 S/low] Tests no longer need the internet
- 2.6 [L3 S/medium] Smaller PDB reader fixes
- 2.8 [L3 S/medium] Selection and fingerprint fixes
- 2.12 [L3 S/medium] Make docking preparation fast on big proteins
