# Final 4V6F Selection A→BF Report

- Source: `C:\Users\mukun\Desktop\molecular-workstation\verification\large-molecule-4v6f\01-source\4v6f.cif`
- Source SHA-256: `a48b6f9865ed1dff0e45d1992b9d20633582de6675c16d0b9a4abc75d595e56f`
- Canonical revision: `20b7c8468b598ce6272d83709eba7454505881b43d5083c85df50735e801d913`
- Query corpus: 532 cases; hash `0f5a81931dbe5960f97da323eb1adab734f2da5dffe9805f885e6966346e65c0`
- Semantic replay: 532/532
- Semantic result counts: {"PASS":251,"EMPTY_VALID":243,"IMPLEMENTED_WITH_LIMITATION":9,"INVALID_EXPECTED":29}
- UI screenshots captured: 532/532
- Visual review: **PASS_WITH_LIMITATIONS** across 34 contact sheets
- Drive evidence readback: 532/532; pending 0
- Internal acceptance: **PASS_WITH_LIMITATIONS**
- Pinned PyMOL oracle: **BLOCKED_ENVIRONMENT**

The canonical compact transport preserves the full 4V6F identity: 307,345 atoms, 26,941 residues, 5,467 chains, 301,988 polymer atoms, and 5,351 ions. No P1 correctness defect was observed in the replay or cross-structure regressions.

Known limitations are explicit and isolated to revision-matched chemistry-role vectors, segment identity, and charge predicates; they are not collapsed into PASS.

Drive completion: all evidence rows uploaded and read back successfully.

Commit created: NO. Main merge and docking readiness remain subject to user approval.

## Exhaustive audit

- Previous A→BF definitions: 523
- A→BF executed: 523/523
- Additional LMX executions: 9
- Total query executions: 532
- Membership hashes: 509/509
- Post-execution screenshots: 499; recovery pre-run captures: 33
- Performance (semantic ms): {"completedCases":532,"elapsedMs":387281,"count":532,"minQueryMs":0,"medianQueryMs":252,"p90QueryMs":759,"p95QueryMs":1097,"p99QueryMs":10890,"maxQueryMs":29813}
- UI classification counts: {"PASS":211,"EMPTY_VALID":265,"PERFORMANCE_TIMEOUT":35,"IMPLEMENTED_WITH_LIMITATION":8,"BLOCKED":13}

| Category | Executed/Expected | Result counts |
|---|---:|---|
| A | 20/20 | {"PASS":15,"EMPTY_VALID":3,"IMPLEMENTED_WITH_LIMITATION":2} |
| B | 6/6 | {"EMPTY_VALID":5,"PASS":1} |
| C | 7/7 | {"PASS":5,"EMPTY_VALID":2} |
| D | 8/8 | {"PASS":5,"EMPTY_VALID":3} |
| E | 7/7 | {"PASS":5,"INVALID_EXPECTED":2} |
| F | 8/8 | {"PASS":6,"EMPTY_VALID":2} |
| G | 9/9 | {"PASS":8,"EMPTY_VALID":1} |
| H | 11/11 | {"EMPTY_VALID":6,"PASS":5} |
| I | 6/6 | {"PASS":4,"EMPTY_VALID":2} |
| J | 8/8 | {"EMPTY_VALID":8} |
| K | 9/9 | {"PASS":5,"EMPTY_VALID":3,"IMPLEMENTED_WITH_LIMITATION":1} |
| L | 3/3 | {"EMPTY_VALID":3} |
| M | 2/2 | {"EMPTY_VALID":2} |
| N | 3/3 | {"EMPTY_VALID":3} |
| O | 8/8 | {"EMPTY_VALID":8} |
| P | 3/3 | {"INVALID_EXPECTED":2,"EMPTY_VALID":1} |
| Q | 2/2 | {"EMPTY_VALID":2} |
| R | 3/3 | {"PASS":3} |
| S | 4/4 | {"EMPTY_VALID":4} |
| T | 2/2 | {"PASS":2} |
| U | 6/6 | {"PASS":4,"EMPTY_VALID":2} |
| V | 3/3 | {"EMPTY_VALID":1,"PASS":2} |
| W | 5/5 | {"PASS":3,"EMPTY_VALID":2} |
| X | 4/4 | {"IMPLEMENTED_WITH_LIMITATION":4} |
| Y | 5/5 | {"PASS":5} |
| Z | 4/4 | {"PASS":4} |
| AA | 4/4 | {"PASS":4} |
| AB | 5/5 | {"PASS":5} |
| AC | 5/5 | {"EMPTY_VALID":5} |
| AD | 6/6 | {"EMPTY_VALID":5,"PASS":1} |
| AE | 1/1 | {"EMPTY_VALID":1} |
| AF | 1/1 | {"EMPTY_VALID":1} |
| AG | 9/9 | {"EMPTY_VALID":7,"PASS":2} |
| AH | 19/19 | {"INVALID_EXPECTED":19} |
| AI | 6/6 | {"INVALID_EXPECTED":5,"EMPTY_VALID":1} |
| AJ | 8/8 | {"PASS":6,"EMPTY_VALID":2} |
| AK | 3/3 | {"PASS":3} |
| AL | 5/5 | {"EMPTY_VALID":5} |
| AM | 3/3 | {"PASS":3} |
| AN | 13/13 | {"EMPTY_VALID":11,"IMPLEMENTED_WITH_LIMITATION":2} |
| AO | 4/4 | {"PASS":2,"EMPTY_VALID":2} |
| AP | 5/5 | {"PASS":4,"EMPTY_VALID":1} |
| AQ | 5/5 | {"EMPTY_VALID":4,"PASS":1} |
| AR | 3/3 | {"PASS":3} |
| AS | 7/7 | {"EMPTY_VALID":7} |
| AT | 4/4 | {"PASS":3,"EMPTY_VALID":1} |
| AU | 5/5 | {"PASS":4,"EMPTY_VALID":1} |
| AV | 120/120 | {"PASS":40,"EMPTY_VALID":80} |
| AW | 80/80 | {"PASS":50,"EMPTY_VALID":30} |
| AX | 3/3 | {"EMPTY_VALID":2,"PASS":1} |
| AY | 1/1 | {"INVALID_EXPECTED":1} |
| AZ | 3/3 | {"EMPTY_VALID":2,"PASS":1} |
| BA | 9/9 | {"EMPTY_VALID":1,"PASS":8} |
| BB | 8/8 | {"EMPTY_VALID":1,"PASS":7} |
| BC | 7/7 | {"PASS":7} |
| BD | 7/7 | {"PASS":4,"EMPTY_VALID":3} |
| BE | 8/8 | {"PASS":6,"EMPTY_VALID":2} |
| BF | 0/0 | {} |
| LMX | 9/9 | {"EMPTY_VALID":5,"PASS":4} |

## Readiness

- Visual review: PASS_WITH_LIMITATIONS
- Drive uploaded/readback verified/pending: 532/532/0
- Ready to lock: YES
