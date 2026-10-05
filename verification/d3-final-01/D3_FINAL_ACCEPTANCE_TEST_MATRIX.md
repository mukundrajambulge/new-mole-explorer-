# Final D3 Acceptance-Test Matrix

| Acceptance test | Form | Result / evidence path | Final disposition |
|---|---|---|---|
| AT-0057 | Native typing test + source/profile evidence | PASS; `native/docking-reference/scoring/tests/scoring_test.cpp`; `verification/d3-closure-exec-01/SOURCE_PROFILE_COMPLETENESS_MATRIX.csv` | SATISFIED |
| AT-0058 | Required cross-dependency identity property | FAIL; `apps/api/src/docking/d2Preparation.ts:128-150` omits downstream typing/scoring refs from prepared-state hash; no sensitivity test found | FAILED — MANDATORY BLOCKER |
| AT-0070 | Native charge-invariance fixture | PASS; direct scorer regression | SATISFIED |
| AT-0085 | Native boundary/OOD test + fixture evidence | PASS; `scoring_field_test.cpp`; full-pose boundary status | SATISFIED |
| AT-0091 | Native domain/halo test + sealed geometry | PASS; `D2_SEALED_STATE_SUMMARY.json`; field tests | SATISFIED |
| AT-0094 | Profile/digest evidence check | PASS; `FULLPOSE_PROFILE_DIGESTS.json` and pose rows | SATISFIED |
| AT-0095 | Native mathematical pair-score oracle | PASS; `scoring_test.cpp` | SATISFIED |
| AT-0096 | Native coefficients + D3-TOR regression | PASS; 8 D3-TOR cases and full-pose divisor | SATISFIED |
| AT-0097 | Exact-cutoff unit test + stress-pose record | PASS; native exact 8.0 Å and `CUTOFF_STRESS_ANALYSIS.md` | SATISFIED |
| AT-0098 | Vina torsion profile test | PASS; D3-TOR 8/8 and sealed assignment | SATISFIED |
| AT-0099 | Charge/electrostatics invariance | PASS; native score regression | SATISFIED |
| AT-0100 | Formal-charge/protonation replay evidence | PASS; `STATE_CHARGE_VALIDATION.json` | SATISFIED |
| AT-0101 | Profile and equation audit | PASS; native scorer, named profile JSON and full-pose bundle | SATISFIED |
| AT-0104 | Interpolation/derivative native tests + phase pose | PASS; CTest scoring-field target and D3-GRID contract 5/5 | SATISFIED |
| AT-0105 | Support horizon / field geometry | PASS; sealed SearchRegion geometry and native field fixtures | SATISFIED |
| AT-0106 | Machine-readable raw and weighted term decomposition | PASS; 30 term rows reconcile to all six totals | SATISFIED |
| AT-0107 | Terminology/code review | PASS; final reports use empirical-score terminology only | SATISFIED |
| AT-0108 | Claim-boundary audit | PASS; no affinity/free-energy/probability claims | SATISFIED |
| AT-0132 | Component disposition and water-policy inspection | PASS; 418 dispositions, 248 water exclusions, dry-core profile | SATISFIED |
| AT-0139 | Pose cohort/status separation | PASS; manifest separates cohort/stress/domain fields from score | SATISFIED |
| AT-0141 | Q-score tie/result semantics | Not run in D3; current Roadmap places exact Q-score/ranking in D5 | DEFERRED_BY_ACCEPTED_ROADMAP |
| AT-0146 | Final-mode count/window | No search or final-mode selection ran; Roadmap assigns to D5 | DEFERRED_BY_ACCEPTED_ROADMAP |
| AT-0204 | Scalar direct oracle and backend-equivalence/discrete result contract | Native direct formula oracle passes. The complete alternate-backend/Q-score test belongs to later D5/D6 semantics; direct-grid approximation is separately scoped by D3-GRID v1.2. | DEFERRED_BY_ACCEPTED_ROADMAP |

The final D3 acceptance test count remains 23. The historical AT-0103 supplement is Level 6 / Gate D6, not part of the 23 Gate D3 tests; its 70-channel phrase is superseded by 80 logical / conditional 59 physical architecture. No acceptance test is labeled pending. AT-0058 prevents D3 acceptance.
