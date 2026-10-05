# Corrected Final D3 Acceptance-Test Matrix

| Acceptance test | Form | Result / evidence path | Final disposition |
|---|---|---|---|
| AT-0057 | Native typing test + source/profile evidence | PASS; native scoring tests and closure component/profile matrix. | SATISFIED |
| AT-0058 | Required cross-dependency identity property | PASS; corrected receptor V2 seal, sensitivity/replay/missing-reference/mismatch tests; `REQ0058_ACCEPTANCE_TEST_REPORT.md`. | SATISFIED |
| AT-0070 | Native charge-invariance fixture | PASS; direct scorer regression. | SATISFIED |
| AT-0085 | Native boundary/OOD + fixture evidence | PASS; scoring-field tests and full-pose boundary statuses. | SATISFIED |
| AT-0091 | Native domain/halo + sealed geometry | PASS; state summary and native field tests. | SATISFIED |
| AT-0094 | Profile/digest evidence | PASS; profile digests and corrected per-pose rows. | SATISFIED |
| AT-0095 | Native mathematical pair-score oracle | PASS; native scorer tests. | SATISFIED |
| AT-0096 | Coefficient and torsion divisor regression | PASS; D3-TOR suite and sealed torsion evidence. | SATISFIED |
| AT-0097 | Exact cutoff + stress-pose evidence | PASS; native cutoff test and cutoff-stress row. | SATISFIED |
| AT-0098 | Vina torsion profile | PASS; D3-TOR 8/8 and sealed assignment. | SATISFIED |
| AT-0099 | Charge/electrostatics invariance | PASS; native scorer regression. | SATISFIED |
| AT-0100 | Formal-charge/protonation replay | PASS; state-charge validation. | SATISFIED |
| AT-0101 | Profile and equation audit | PASS; scorer, named profile JSON and full-pose bundle. | SATISFIED |
| AT-0104 | Interpolation/derivative + phase pose | PASS; native field tests and D3-GRID 5/5. | SATISFIED |
| AT-0105 | Support horizon / field geometry | PASS; sealed SearchRegion and native fixtures. | SATISFIED |
| AT-0106 | Raw and weighted term decomposition | PASS; corrected six-pose output, 30 rows. | SATISFIED |
| AT-0107 | Terminology/code review | PASS; empirical-score language retained. | SATISFIED |
| AT-0108 | Claim-boundary audit | PASS; no affinity/free-energy/probability claims. | SATISFIED |
| AT-0132 | Component disposition/water policy | PASS; 418 dispositions, 248 exclusions, dry-core profile. | SATISFIED |
| AT-0139 | Pose cohort/status separation | PASS; cohort, stress and domain fields remain explicit. | SATISFIED |
| AT-0141 | Q-score tie/result semantics | Not executed in D3; Roadmap/PHD-V2-15 sequence to D5; Final Acceptance Specification has conflicting Gate D3 label. | DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP |
| AT-0146 | Final-mode count/window | No search or final-mode selection in D3; Roadmap/PHD-V2-15 sequence to D5; Final Acceptance Specification has conflicting Gate D3 label. | DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP |
| AT-0204 | Raw equivalence + exact discrete result contract | Scalar direct oracle passes; full compound result/equivalence semantics are sequenced by Roadmap/PHD-V2-15 to D5/D6; Final Acceptance Specification has conflicting Gate D3 label. | DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP |

The specification lists 23 tests. The three rows marked `DEFERRED_BEYOND_D3_BY_AUTHORITATIVE_ROADMAP` are not represented as completed. The owner-approved Roadmap/Source-of-Truth amendment records why their earlier Gate D3 labels in the Final Acceptance Specification are superseded for execution sequencing and this D3 disposition. See `D3_FINAL_REQUIREMENT_MATRIX_CORRECTED.md`. The mandatory AT-0058 failure is closed by the corrected implementation and evidence.
