# Resource validation

**Closure-task status: PARTIAL.** No prepared fixture states or actual fixture SearchRegion were produced, so dimensions, serialized final field size, full-pose workload, and fixture-specific runtime/RSS remain unavailable.

The preserved D3-GRID-01 maximum-field implementation evidence uses a 110×110×110 node grid and 250,000 receptor scoring centers. The runtime-unblock continuation rebuilt the same native direct/field tests in WSL2 Ubuntu 24.04.5 with CMake 3.28.3 and GCC 13.3.0, using the repository's strict floating-point and warning flags. CTest passed both native test targets. The maximum-geometry resource fixture was also run directly and reported:

| Measure | Prior Windows Zig result | Continuation Linux GCC result | Limit | Interpretation |
|---|---:|---:|---:|---|
| Raw physical payload | 628,232,000 B | 628,232,000 B | 805,306,368 B (768 MiB) | Within |
| Field-owned allocation during construction | 635,301,608 B | 635,301,752 B | 1,073,741,824 B (1 GiB) | Within |
| Retained field allocation | 628,234,152 B | 628,234,296 B | 1,073,741,824 B (1 GiB) | Within |
| Construction peak field-owned allocation | 635,301,608 B | 635,301,752 B | 1,073,741,824 B (1 GiB) | Within |
| Process peak RSS | 674,414,592 B | 676,855,808 B | 2,147,483,648 B default | Within |

The small allocation/RSS differences are observed between the Windows Zig and Linux GCC executions; no cross-platform bitwise resource identity is claimed. Linux outputs are in `runtime_logs/continuation-native-linux-cmake-ctest-output.txt`, `runtime_logs/continuation-native-direct-output.txt`, and `runtime_logs/continuation-native-field-resource-output.txt`. The limits were unchanged.

These implementation-level checks do not validate a SearchRegion for 3DMX/BNZ, a final serialized fixture field, or full-pose fixture resources. No fixture-specific dimensions, payload, RSS, or memory use are inferred from the bounded maximum-field test.
