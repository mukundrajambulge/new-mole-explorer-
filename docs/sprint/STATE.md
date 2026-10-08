# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 24 · TODO: 64 · NEEDS_OWNER: 1 · BLOCKED: 1 · DEFERRED: 8
Done by tier: core 23/45 · strong 1/38 · stretch 0/7
Calibration: 7348 output tokens per 1% of the 5-hour window; estimate multiplier 1.13
Last waves: W3 241k (6%→34%), W4 131k (3%→28%), W6 336k (3%→44%)

## Needs the owner
- 4.1 Build and test the C++ in CI: NEEDS_OWNER (W6 BLOCKED: needs real CI runs on Windows MSVC and macOS clang (push the branch); agent wanted to drop /WX (denied). Owner: push sprint/W6/4.1 to see CI logs)
- 4.4 Send numbers over JSON correctly: BLOCKED (Waits for 5.2: box seal must take {jobId, bounds} from a real prep job (see design note))

## Next ready tasks (critical path first)
- ★ 3.8 [L4 M/medium] One viewer that survives tab switches
- ★ 5.2 [L6 L/high] Preparation worker (visible, versioned, user-confirmed)
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.3a [L2 S/high] Prove the memory limit with a dense structure
- 1.3b [L2 S/high] Keep the parse slot until the reply is sent
- 1.3c [L2 S/high] Idle timeouts for slow clients
- 1.4 [L2 S/medium] Stop sending the whole file text back
- 1.7 [L2 M/medium] Check the shape of every request
- 1.9 [L2 S/low] Fix the vulnerable development tools
- 1.10 [L2 M/medium] HTTP route tests
- 2.2 [L3 S/low] Tests no longer need the internet
