# Resource validation

**Closure-task status: PARTIAL.** No prepared states, actual fixture SearchRegion, serialized final field, or full-pose workload was produced. Their dimensions, serialized sizes and runtime/RSS cannot be reported.

The preserved D3-GRID-01 maximum-field implementation evidence at `verification/d3-grid/D3_GRID_01_REPORT.md` reports a 110×110×110 node grid and 250,000 supported receptor scoring centers:

| Measure | Prior bounded implementation result | Limit | Interpretation |
|---|---:|---:|---|
| Raw physical payload | 628,232,000 B | 805,306,368 B (768 MiB) | Within |
| Field-owned allocation during construction | 635,301,608 B | 1,073,741,824 B (1 GiB) | Within |
| Retained field allocation | 628,234,152 B | 1,073,741,824 B (1 GiB) | Within |
| Construction peak field-owned allocation | 635,301,608 B | 1,073,741,824 B (1 GiB) | Within |
| Process peak working-set RSS | 674,414,592 B | 2,147,483,648 B default | Within |

That previous, exact-commit result is retained as implementation evidence, not represented as a new execution on prepared 3DMX/BNZ states. It does not validate this task's SearchRegion, final serialization, or full-pose resources. Current workspace lookup did not find CMake or Zig on PATH; the prior D3-GRID report identifies its strict Zig 0.16.0 build and compiler/package digests.
