# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 22 · TODO: 66 · READY: 1 · BLOCKED: 1 · DEFERRED: 8
Done by tier: core 22/45 · strong 0/38 · stretch 0/7
Calibration: 7516 output tokens per 1% of the 5-hour window; estimate multiplier 1.07
Last waves: W2 157k (38%→56%), W3 241k (6%→34%), W4 131k (3%→28%)

## Needs the owner
- 4.4 Send numbers over JSON correctly: BLOCKED (Waits for 5.2: box seal must take {jobId, bounds} from a real prep job (see design note))

## Next ready tasks (critical path first)
- ★ 3.8 [L4 M/medium] One viewer that survives tab switches
- ★ 5.2 [L6 L/high] Preparation worker (visible, versioned, user-confirmed)
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.9 [L2 S/low] Fix the vulnerable development tools
- 2.2 [L3 S/low] Tests no longer need the internet
- 2.6 [L3 S/medium] Smaller PDB reader fixes
- 2.7 [L3 S/low] One honest file-format table
- 2.8 [L3 S/medium] Selection and fingerprint fixes
- 2.12 [L3 S/medium] Make docking preparation fast on big proteins
- 3.5 [L4 S/medium] Memoize the inspector and selection lists
- 3.10 [L4 S/medium] A robust API client
