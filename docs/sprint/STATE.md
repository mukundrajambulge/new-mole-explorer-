# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)

Status: DONE: 28 · TODO: 66 · NEEDS_OWNER: 2 · BLOCKED: 2 · DEFERRED: 8
Done by tier: core 26/53 · strong 2/38 · stretch 0/7
Calibration: 6814 output tokens per 1% of the 5-hour window; estimate multiplier 1.13
Last waves: W4 131k (3%→28%), W6 336k (3%→44%), W8 246k (0%→35%)

## Needs the owner
- 4.1 Build and test the C++ in CI: NEEDS_OWNER (W6 BLOCKED: needs real CI runs on Windows MSVC and macOS clang (push the branch); agent wanted to drop /WX (denied). Owner: push sprint/W6/4.1 to see CI logs)
- 4.4 Send numbers over JSON correctly: BLOCKED (Waits for 5.2: box seal must take {jobId, bounds} from a real prep job (see design note))
- 4.8 Ready for search: gradients and out-of-box penalty: BLOCKED (Research conflict C1 (blocker): out-of-box poses must be REJECTED [AT-0084]; a penalty may exist only as an explicit, versioned E_search term from PHD-V2-07 (not yet read) and never in DockingScore. Read PHD-V2-07 and rewrite this task before building. See docs/sprint/RESEARCH-DIGEST.md)
- 5.2 Preparation worker (visible, versioned, user-confirmed): NEEDS_OWNER (Merged parts 1+2: worker, job store, HTTP routes, pin + version checks, upload quota, plan-bound qualification. Receptor seal BLOCKED in production: SERVER_D2_RECEPTOR_DEPENDENCIES is empty because the 3 D2 profile digests are not published (none invented). Owner: publish/approve those digests. Follow-up: require the core stages to be present in the manifest (prepPins.ts:186).)

## Next ready tasks (critical path first)
- ★ R.8 [L9 S/low] Read PHD-V2-03..14 (esp. PHD-V2-07 E_search) into the digest
- ★ R.7 [L6 S/medium] Seeds uint64 and box digest from sealed min/max
- ★ R.6 [L6 S/medium] Histidine states listed and acknowledged
- ★ R.5 [L6 S/high] Metals and cofactors in the site make the task UNSUPPORTED
- ★ R.4 [L6 S/high] Ligand stereochemistry from CCD isomeric SMILES
- ★ R.3 [L6 S/low] Honest score labels
- ★ R.2 [L6 S/medium] Research job states: Created/Queued/Running/Completed/Failed/Cancelled
- ★ R.1 [L6 S/high] Scientific smoke redock (symmetric RMSD, 5 A box, RDKit start, 3 seeds)
- ★ 5.7b [L7 M/medium] Box + Run steps: progress, cancel, error states
- 0.8 [L1 S/low] Pin the Node.js version
- 0.9 [L1 S/low] Write ONE honest status document
- 1.3a [L2 S/high] Prove the memory limit with a dense structure
