# D3 acceptance-test traceability

The current canonical Final Docking Acceptance Specification identifies the following 23 tests with `GATE: D3`. `SATISFIED_WITH_EVIDENCE` refers only to the bounded implementation tests named below, not fixture preparation or final D3 acceptance. `FAILED` means this closure run did not produce the required test/result evidence; it does not claim a scientific failure. `FINAL_D3_ACCEPTANCE_DECISION_PENDING` is used where current owner-approved acceptance requires final evidence/decision not present here.

| Acceptance test | Scope | Status | Evidence / reason |
|---|---|---|---|
| AT-0057 | Unsupported metal/cofactor chemistry | `FAILED` | No fixture graph/typing run. |
| AT-0058 | Prepared receptor identity changes with material state | `FAILED` | No prepared receptor digest. |
| AT-0070 | XS typing does not consume imported partial charges | `FAILED` | No fixture scoring run or direct charge-invariance evidence in this closure. |
| AT-0085 | SearchRegion boundary distinct from field OOD | `SATISFIED_WITH_EVIDENCE` | Bounded D3-GRID boundary/OOD fixtures in its test report; no fixture SearchRegion. |
| AT-0091 | Field domain and interpolation halo coverage | `SATISFIED_WITH_EVIDENCE` | Bounded D3-GRID halo/stencil/OOD fixtures; no 3DMX/BNZ region. |
| AT-0094 | Canonical scoring profile and typing | `SATISFIED_WITH_EVIDENCE` | Preserved D3 direct/field implementation branch and test report; no prepared fixture. |
| AT-0095 | Exact pair-score primitives | `SATISFIED_WITH_EVIDENCE` | Preserved native direct-scoring fixtures (6 groups). |
| AT-0096 | Exact coefficient vector and torsional divisor coefficient | `SATISFIED_WITH_EVIDENCE` | Preserved direct-score and D3-TOR implementation test evidence; fixture-specific scoring absent. |
| AT-0097 | Zero physical pair interaction at/above 8.0 Å | `SATISFIED_WITH_EVIDENCE` | Preserved direct scorer cutoff fixtures. |
| AT-0098 | Vina torsion divisor and score semantics | `SATISFIED_WITH_EVIDENCE` | D3-TOR-01 focused tests (7/7) and preserved implementation record. |
| AT-0099 | No partial-charge/electrostatic score term | `FAILED` | No charge-invariance fixture executed in this closure. |
| AT-0100 | Explicit formal charge/protonation state | `FAILED` | Approved proposal is documented but no graph/scoring state was materialized. |
| AT-0101 | No unspecified “Vina-like” approximation | `SATISFIED_WITH_EVIDENCE` | Preserved named-profile direct scorer implementation/tests; independent TOR/GRID code review passed after strict full-field serial validation. |
| AT-0104 | Trilinear interpolation/derivative semantics | `SATISFIED_WITH_EVIDENCE` | Preserved native field fixtures and TypeScript contract tests (5). |
| AT-0105 | 8.649519052838329 Å field support horizon vs 8.0 Å pair horizon | `SATISFIED_WITH_EVIDENCE` | Preserved D3-GRID code/test evidence; no fixture-level field constructed here. |
| AT-0106 | Score decomposition | `SATISFIED_WITH_EVIDENCE` | Preserved direct/field term fixture evidence; no full-pose values. |
| AT-0107 | Truthful empirical-score terminology | `FAILED` | No user-facing/scored result was produced or audited in this closure. |
| AT-0108 | No affinity/free-energy/probability claim | `SATISFIED_WITH_EVIDENCE` | No such claim or score output was emitted; application capability remains unavailable. |
| AT-0132 | Structural water source evidence vs unsupported water scoring | `FAILED` | No prepared component set or scoring run. |
| AT-0139 | Pose validity/plausibility separate from score/RMSD | `FAILED` | No pose/result record produced. |
| AT-0141 | Exact Q-score tie semantics | `FAILED` | No pose ordering/result cohort executed in this task. |
| AT-0146 | Final-mode count and best+3 score window | `FAILED` | No final mode processing or pose cohort. |
| AT-0204 | Raw-score backend equivalence and exact discrete semantics | `FINAL_D3_ACCEPTANCE_DECISION_PENDING` | PHD-V2-13 engineering comparator is distinct from owner-approved grid-approximation acceptance; no fixture full-pose distribution exists and no D3 approximation threshold is approved. |

The current v1.2 acceptance amendments clarify that AT-0103 belongs to D6 field representation/resource qualification and that neither it nor its `1e-10` backend-equivalence tolerance sets a D3 direct-versus-grid scientific approximation or ranking threshold.
