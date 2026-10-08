# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 18 · TODO: 65 · NEEDS_OWNER: 3 · BLOCKED: 1 · DEFERRED: 8
Done by tier: core 18/45 · strong 0/35 · stretch 0/7
Calibration: 8629 output tokens per 1% of the 5-hour window; estimate multiplier 0.86
Last waves: W1 86k (21%→31%), W2 157k (38%→56%), W3 241k (6%→34%)

## Needs the owner
- 1.3 Size limits on every request: NEEDS_OWNER (W3: memory test pads REMARK lines (not dense mmCIF); parse slot released before stringify of large result; slow-client DoS (no idle timeout, slots held for full body))
- 4.4 Send numbers over JSON correctly: BLOCKED (Waits for 5.2: box seal must take {jobId, bounds} from a real prep job (see design note))
- 5.2 Preparation worker (visible, versioned, user-confirmed): NEEDS_OWNER (Design note docs/sprint/design/5.2.md ready; owner to confirm protonation default (EXPLICIT_SUBMITTED, PROPKA opt-in PREVIEW_UNQUALIFIED))
- 6.1 Fast checks on every pull request: NEEDS_OWNER (W3 PARTIAL: <10 min unmeasured (needs a hosted CI run = push); removed npm run build from fast job - decide keep/replace)

## Next ready tasks (critical path first)
- ★ 1.5 [L2 S/high] Safe file paths everywhere
- ★ 3.3 [L4 M/medium] Keep hover out of the main state
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.9 [L2 S/low] Fix the vulnerable development tools
- 2.2 [L3 S/low] Tests no longer need the internet
- 2.6 [L3 S/medium] Smaller PDB reader fixes
- 2.7 [L3 S/low] One honest file-format table
- 2.8 [L3 S/medium] Selection and fingerprint fixes
- 2.12 [L3 S/medium] Make docking preparation fast on big proteins
- 3.10 [L4 S/medium] A robust API client
- 4.1 [L5 M/medium] Build and test the C++ in CI
