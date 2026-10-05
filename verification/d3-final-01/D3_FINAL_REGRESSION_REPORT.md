# Final D3 Regression Report

## Inherited closure results

The D3-CLOSURE-EXEC-01 evidence commit `05cdb83fbcac71fb5cf3d53a19935b5b0a54f735` records:

| Suite | Result |
|---|---:|
| Workspace unit tests | 254 passed across 47 files (web 156 / 34 files; API 98 / 13 files; includes D1 14, D2 11, D3-TOR 8) |
| D3-GRID contract tests | 5/5 passed |
| Native scorer + scoring-field CTest | 2/2 targets passed on WSL2 Ubuntu 24.04.5 / GCC 13.3.0 |
| Prepared-profile completeness | PASS; 164 residues, 51 side chains, five altloc groups, two termini, and 418 components dispositioned |
| Preparation and D2 state digest replay | PASS; two identical preparation payloads and independent canonical-CBOR seals |
| Full-pose harness | PASS; five synthetic controls plus six sealed fixture poses; 30 term rows |
| Protected PyMOL browser suite | 3/3 passed; 40/40 protected screenshot hashes matched/restored |
| Typecheck / lint / production build | PASS |

Evidence paths include `verification/d3-closure-exec-01/CUMULATIVE_REGRESSION_REPORT.md`, `runtime_logs/`, `fullpose/results/`, and `native/docking-reference/scoring/`.

## Final acceptance SHA run

The final HOLD evidence commit changes documentation only. After that commit is created, this branch is re-run with `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, the protected PyMOL browser test, the D3-GRID contract suite, the native CTest suite, and the sealed preparation/full-pose validation commands. The final response records the exact SHA at test time and the observed counts/results. No file or commit will be added after that final run.

The result of these regressions does not override the explicit `FAILED` AT-0058 disposition. Regression suites do not currently test prepared-state identity sensitivity to downstream typing/scoring parameterization references.
