# Performance report

The repository's prior autonomous campaign measured local ingestion and recorded architecture-level stress outcomes. Those measurements remain the authoritative baseline for this UI campaign.

| Structure / bucket | Observation | Status |
| --- | --- | --- |
| 1CRN (327 atoms) | API ingest 237 ms in the recorded run | PASS |
| 4DJW (7,079 atoms, 82 ligand atoms) | API ingest 5,284 ms in the recorded run; real-app load, rotate, zoom, VDW, selection, and multi-object paths exercised | PASS |
| 1AON / 5LE5 (50k–59k atoms) | Bounded ingestion/render corpus | PASS |
| 3J9M (XL) | Probe stopped after 995.1 s without validated result | BLOCKED |
| 4V6F (XXL) | 38,137,644 bytes exceeds 26,214,400-byte application limit | BLOCKED |

No fabricated FPS or memory threshold is claimed. The detailed machine-readable observations are in [PERFORMANCE_STRESS_REPORT.json](../autonomous-pymol/PERFORMANCE_STRESS_REPORT.json). Browser/renderer warnings are retained from the production build; the 3Dmol bundle uses `eval` and produces a chunk-size warning.
