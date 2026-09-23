# 4V6F Selection Performance-Tail Review

- Historical maximum: **29813 ms**
- Maximum query: `AF-001` — `model mini-protein.pdb like model mini-protein.pdb`
- Three-run retest: 11251 ms, 11783 ms, 11056 ms (median 11251 ms; max 11783 ms)
- Classification: **PERFORMANCE_CONCERN**
- Scientific result: CORRECT_EMPTY_VALID
- Prior UI state: PRIOR_UI_REPLAY_READY; THIS_RETEST_MEASURED_SEMANTIC_PATH_ONLY

| Test | Category | Family | Duration (ms) | Atoms | UI state |
|---|---|---|---:|---:|---|
| AF-001 | AF | namedSelections | 29813 | 0 | ready |
| AE-001 | AE | namedSelections | 22997 | 0 | ready |
| B-004 | B | identifiers | 20153 | 0 | ready |
| B-003 | B | identifiers | 19258 | 0 | ready |
| AZ-001 | AZ | AZ | 12633 | 0 | ready |
| AQ-005 | AQ | multiObject | 11858 | 0 | ready |
| AQ-004 | AQ | multiObject | 10890 | 0 | ready |
| B-005 | B | identifiers | 10803 | 307345 | ready |
| AQ-001 | AQ | multiObject | 10206 | 0 | ready |
| AG-006 | AG | validEmpty | 10096 | 0 | ready |
| B-006 | B | identifiers | 10043 | 0 | ready |
| B-001 | B | identifiers | 9863 | 0 | ready |
| B-002 | B | identifiers | 9796 | 0 | ready |
| AQ-002 | AQ | multiObject | 9628 | 0 | ready |
| AG-004 | AG | validEmpty | 3311 | 0 | ready |
| A-018 | A | generic | 3153 | 302869 | ready |
| AD-005 | AD | namedSelections | 2288 | 307345 | ready |
| A-003 | A | generic | 2118 | 307345 | ready |
| H-011 | H | boolean | 1594 | 0 | ready |
| LMX-SP-007 | LMX | spatial | 1532 | 1 | ready |

The historical 29,813 ms maximum is an empty-valid named/model predicate. The three-query semantic retest remained scientifically correct and below the watchdog; the tail is a documented performance concern, not a reproducible performance defect.
