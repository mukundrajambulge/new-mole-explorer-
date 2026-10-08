# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 13 · TODO: 73 · NEEDS_OWNER: 1 · DEFERRED: 8
Done by tier: core 13/45 · strong 0/35 · stretch 0/7
Calibration: 8632 output tokens per 1% of the 5-hour window; estimate multiplier 0.68
Last waves: W1 86k (21%→31%), W2 157k (38%→56%)

## Needs the owner
- 1.2 Only allow known websites (CORS allow-list) plus a local token: NEEDS_OWNER (W2: token works but tests/e2e/r10-command-environment.spec.ts calls :8100 without x-mole-token -> 401; fix spec (outside owned files) then re-review)

## Next ready tasks (critical path first)
- ★ 1.6 [L2 S/medium] Crash-proof replies
- ★ 2.4 [L3 M/high] Correct residue and chain identity in mmCIF
- ★ 3.3 [L4 M/medium] Keep hover out of the main state
- ★ 4.4 [L5 S/high] Send numbers over JSON correctly
- ★ 5.0 [L6 S/medium] Docking job API contract (zod schemas) for UI and backend
- ★ 5.2 [L6 L/high] Preparation worker (visible, versioned, user-confirmed)
- ★ 6.1 [L1 S/low] Fast checks on every pull request
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.9 [L2 S/low] Fix the vulnerable development tools
- 2.2 [L3 S/low] Tests no longer need the internet
- 2.6 [L3 S/medium] Smaller PDB reader fixes
