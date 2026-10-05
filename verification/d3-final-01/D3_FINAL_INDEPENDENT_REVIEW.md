# D3 Final Independent Evidence Review

**Independent reviewer:** `/root/d3_independent_review`  
**Disposition:** `HOLD`  
**Initial read-only review commit:** `c525462e522232c3c17833897a841edaaea09a15`  
**Review mode:** read-only; reviewer did not author the scientific fixture data or closure test evidence.

## Conclusion

The final disposition is `D3 FINAL HOLD — MANDATORY ACCEPTANCE REQUIREMENT UNSATISFIED`. The reviewer independently confirmed `ME-DCK-V1-AT-0058 / ME-DCK-V1-REQ-0058` as a mandatory failure: typing/scoring dependency references must affect `PreparedReceptorState` identity, but the current prepared-state payload and contract omit them. Their separate inclusion in scoring-field identity does not satisfy that state-identity requirement. The closure replay validates one state; it does not test cross-dependency identity sensitivity. Consequently D4 is not authorized and `DOCKING.RUN` remains unavailable.

## Independent evidence checks

- Recomputed the six-pose `E_inter` summary and confirmed the committed statistics, direct/grid order, absence of ties/reversals, and all 30 weighted term rows. One direct term sum differs from its reported aggregate only by binary64 addition roundoff (`8.88e-16`).
- Audited preparation source hashes, replay payload, heavy-atom invariants, CBOR seals, resource measurements, field metrics, PyMOL boundary, and the product registry; these are internally consistent within their bounded claims.
- Reviewed the acceptance branch's ancestry and found it descends from the closure commit.
- Audited committed preparation/native/resource/regression records rather than rerunning those experiments during the initial review. The final acceptance lane must still record its final-SHA regression execution separately.

## Corrections raised by the reviewer

1. **REP sign wording:** the first draft said weighted REP error was consistently positive. It is positive for five poses and negative for cutoff stress (`−0.02152184399`); the cohort bias remains positive. `D3_FINAL_NUMERICAL_ACCEPTANCE.md` now states the per-pose split accurately.
2. **Gate authority mismatch:** the Final Acceptance Specification labels AT-0141, AT-0146 and AT-0204 Gate D3, while Roadmap/PHD-V2-15 sequences their Q-score, final-mode or broader numerical-equivalence scope to D5/D6. No approved amendment reconciling these labels was found. Both traceability matrices and the blocker/scope records now retain the permitted Roadmap deferral status while explicitly stating that these tests are not claimed complete in D3 and the authority mismatch is unresolved.
3. **Regression record:** the initial package report asserted final-SHA results would be recorded later but included no such results. `D3_FINAL_REGRESSION_REPORT.md` now summarizes the observed checks and specifies the final-head output locations.
4. **Distinct review artifact:** this file records the reviewer’s HOLD and read-only findings, as required by the final evidence package.

The corrections above are package/documentation changes after the initial review. This record does not represent the reviewer as having independently authored or rerun the underlying evidence. The supplemental review below assessed the corrected content; the finalizer then completed the stated manifest, commit, and final-head rerun steps.

## Supplemental review

**Result:** PASS for the corrected evidence-package content; the overall D3 disposition remains HOLD.

The reviewer confirmed the corrected REP sign description is accurate, the three Gate D3 versus Roadmap/PHD-V2-15 conflicts are explicit and are not represented as completed tests, and the six npm advisories are consistent with an OPS-02 deferral rather than a D3-specific failure. No new factual error was found; AT-0058 remains a mandatory failure and D4 remains unauthorized.

The supplemental reviewer read the reported preparation/native evidence rather than rerunning those experiments. The reviewer checked the corrected regression summary, not the later final-HEAD test process. The finalizer regenerated the checksum manifest, committed the package, and reran the listed suites on that exact commit; command outputs and machine-readable rerun results are at the locations described in `D3_FINAL_REGRESSION_REPORT.md`.
