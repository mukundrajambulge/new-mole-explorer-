# D3 acceptance-test traceability

This continuation updates the closure evidence for the 23 tests identified with GATE: D3 in the current Final Docking Acceptance Specification. SATISFIED_WITH_EVIDENCE refers to the stated implementation/fixture evidence and does not itself make final D3 acceptance. FINAL_D3_ACCEPTANCE_DECISION_PENDING rows are carried to D3-FINAL-01; they are not a new gate.

| Acceptance test | Scope | Current closure status | Evidence / remaining final scope |
|---|---|---|---|
| AT-0057 | Unsupported metal/cofactor chemistry | SATISFIED_WITH_EVIDENCE | All 418 source components dispositioned before chemistry; supported selected atoms and explicit exclusions recorded in the profile matrix and chemistry artifact. |
| AT-0058 | Prepared receptor identity changes with material state | FINAL_D3_ACCEPTANCE_DECISION_PENDING | Current prepared receptor identity, chemical-state and prepared-state digests are sealed and independently recomputed. This run materializes one authorized state; final acceptance may assess cross-state sensitivity evidence. |
| AT-0070 | XS typing does not consume imported partial charges | SATISFIED_WITH_EVIDENCE | Native SCORE-FX-039 varies imported partial charge while requiring identical direct score; fixture assignments are separately sealed. |
| AT-0085 | SearchRegion boundary distinct from field OOD | SATISFIED_WITH_EVIDENCE | D3-GRID boundary/OOD tests plus six fixture poses with separate closed-region and field-domain status; all are IN_DOMAIN. |
| AT-0091 | Field domain and interpolation halo coverage | SATISFIED_WITH_EVIDENCE | Sealed 0.375 Å halo geometry and six successful in-domain poses; native interpolation halo/OOD tests pass. |
| AT-0094 | Canonical scoring profile and typing | SATISFIED_WITH_EVIDENCE | Fixture scoring/typing profiles and assignment digests are bound into the sealed full-pose bundle. |
| AT-0095 | Exact pair-score primitives | SATISFIED_WITH_EVIDENCE | Native direct scorer test target passes; fixture direct terms are retained per pose. |
| AT-0096 | Exact coefficient vector and torsional divisor coefficient | SATISFIED_WITH_EVIDENCE | Native scorer/TOR regressions pass; fixture records zero search/scorer torsions and divisor 1.0. |
| AT-0097 | Zero physical pair interaction at/above 8.0 Å | SATISFIED_WITH_EVIDENCE | Native exact-cutoff fixtures pass; the tagged fixture stress pair is recorded at its actual binary64 distance. |
| AT-0098 | Vina torsion divisor and score semantics | SATISFIED_WITH_EVIDENCE | D3-TOR tests pass 8/8; sealed PDBQT mapping has no active rotor, nTorsVina 0 and divisor 1.0. |
| AT-0099 | No partial-charge/electrostatic score term | SATISFIED_WITH_EVIDENCE | Native SCORE-FX-039 charge-invariance regression passes; the full-pose scorer uses the named five-term profile and no electrostatic term. |
| AT-0100 | Explicit formal charge/protonation state | SATISFIED_WITH_EVIDENCE | All 51 side-chain assignments and both termini reconcile with sealed D2 graph charges; STATE_CHARGE_VALIDATION.json passes. |
| AT-0101 | No unspecified Vina-like approximation | SATISFIED_WITH_EVIDENCE | Named scoring/backend/chemistry/typing profiles are sealed and checked by the full-pose runner. |
| AT-0104 | Trilinear interpolation/derivative semantics | SATISFIED_WITH_EVIDENCE | Native field tests and the D3-GRID contract test pass; fixture grid-phase pose completed without OOD. |
| AT-0105 | 8.649519052838329 Å support horizon vs 8.0 Å pair horizon | SATISFIED_WITH_EVIDENCE | SearchRegion geometry records both horizons and the halo; native field and fixture construction pass. |
| AT-0106 | Score decomposition | SATISFIED_WITH_EVIDENCE | Per-pose raw and weighted five-term direct/grid decomposition retained in FULLPOSE_TERM_DECOMPOSITION.csv. |
| AT-0107 | Truthful empirical-score terminology | SATISFIED_WITH_EVIDENCE | Reports label E_inter/empirical scores and measured grid-direct error; no affinity, free-energy, or probability inference is made. |
| AT-0108 | No affinity/free-energy/probability claim | SATISFIED_WITH_EVIDENCE | The fixture run is explicitly a scoring validation result; no such claim is made and DOCKING.RUN remains unavailable. |
| AT-0132 | Structural water evidence vs unsupported water scoring | SATISFIED_WITH_EVIDENCE | Source component occurrences are documented; CORE_DRY_V1 dispositions 248 water occurrences for exclusion from the selected dry scoring complex. |
| AT-0139 | Pose validity/plausibility separate from score/RMSD | SATISFIED_WITH_EVIDENCE | Cohort class, cutoff-stress tag, and boundary/OOD status are recorded separately from scores. The stress pose is not presented as a plausible docking pose. |
| AT-0141 | Exact Q-score tie semantics | SATISFIED_WITH_EVIDENCE | Inherited exact comparison/tie tests remain in force; the fixture direct/grid orders contain no ties or reversals. |
| AT-0146 | Final-mode count and best+3 score window | FINAL_D3_ACCEPTANCE_DECISION_PENDING | No search or final-mode selection was run, as required by this closure task. D3-FINAL-01 retains final-mode acceptance scope. |
| AT-0204 | Raw-score backend equivalence and exact discrete semantics | FINAL_D3_ACCEPTANCE_DECISION_PENDING | Six-pose grid-minus-direct distributions are measured. No approved approximation/ranking threshold was found; backend-equivalence tolerances are not substituted. |

AT-0103 remains assigned to D6 field representation/resource qualification under the current acceptance amendments. No D3 acceptance threshold is created by this closure.
