# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 28 · TODO: 58 · NEEDS_OWNER: 3 · BLOCKED: 1 · DEFERRED: 8
Done by tier: core 26/45 · strong 2/38 · stretch 0/7
Calibration: 6814 output tokens per 1% of the 5-hour window; estimate multiplier 1.13
Last waves: W4 131k (3%→28%), W6 336k (3%→44%), W8 246k (0%→35%)

## Needs the owner
- 2.8 Selection and fingerprint fixes: NEEDS_OWNER (Science decision: task says a -0 box must get the same digest as a 0 box, but d1Contracts.test.ts:77 asserts CoordinateStateDigest(+0) != (-0). Owner: should -0 normalise to 0 for geometry digests only, or everywhere? Also combineSelections still hashes unsorted ids)
- 4.1 Build and test the C++ in CI: NEEDS_OWNER (W6 BLOCKED: needs real CI runs on Windows MSVC and macOS clang (push the branch); agent wanted to drop /WX (denied). Owner: push sprint/W6/4.1 to see CI logs)
- 4.4 Send numbers over JSON correctly: BLOCKED (Waits for 5.2: box seal must take {jobId, bounds} from a real prep job (see design note))
- 5.2 Preparation worker (visible, versioned, user-confirmed): NEEDS_OWNER (Merged parts 1+2: worker, job store, HTTP routes, pin + version checks, upload quota, plan-bound qualification. Receptor seal BLOCKED in production: SERVER_D2_RECEPTOR_DEPENDENCIES is empty because the 3 D2 profile digests are not published (none invented). Owner: publish/approve those digests. Follow-up: require the core stages to be present in the manifest (prepPins.ts:186).)

## Next ready tasks (critical path first)
- ★ 5.7b [L7 M/medium] Box + Run steps: progress, cancel, error states
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.3a [L2 S/high] Prove the memory limit with a dense structure
- 1.3b [L2 S/high] Keep the parse slot until the reply is sent
- 1.3c [L2 S/high] Idle timeouts for slow clients
- 1.4 [L2 S/medium] Stop sending the whole file text back
- 1.8 [L2 S/high] Do not trust "sealed" objects sent by the browser
- 1.9 [L2 S/low] Fix the vulnerable development tools
- 1.10 [L2 M/medium] HTTP route tests
- 2.2 [L3 S/low] Tests no longer need the internet
- 2.7 [L3 S/low] One honest file-format table
