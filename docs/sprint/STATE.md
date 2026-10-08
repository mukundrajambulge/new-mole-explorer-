# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 14 · TODO: 71 · BLOCKED: 1 · NEEDS_OWNER: 1 · DEFERRED: 8
Done by tier: core 14/45 · strong 0/35 · stretch 0/7
Calibration: 8632 output tokens per 1% of the 5-hour window; estimate multiplier 0.68
Last waves: W1 86k (21%→31%), W2 157k (38%→56%)

## Needs the owner
- 4.4 Send numbers over JSON correctly: BLOCKED (Waits for 5.2: box seal must take {jobId, bounds} from a real prep job (see design note))
- 5.2 Preparation worker (visible, versioned, user-confirmed): NEEDS_OWNER (Design note docs/sprint/design/5.2.md ready; owner to confirm protonation default (EXPLICIT_SUBMITTED, PROPKA opt-in PREVIEW_UNQUALIFIED))

## Next ready tasks (critical path first)
- ★ 1.6 [L2 S/medium] Crash-proof replies
- ★ 2.4 [L3 M/high] Correct residue and chain identity in mmCIF
- ★ 3.3 [L4 M/medium] Keep hover out of the main state
- ★ 5.0 [L6 S/medium] Docking job API contract (zod schemas) for UI and backend
- ★ 6.1 [L1 S/low] Fast checks on every pull request
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.9 [L2 S/low] Fix the vulnerable development tools
- 2.2 [L3 S/low] Tests no longer need the internet
- 2.6 [L3 S/medium] Smaller PDB reader fixes
- 2.8 [L3 S/medium] Selection and fingerprint fixes
- 2.12 [L3 S/medium] Make docking preparation fast on big proteins
