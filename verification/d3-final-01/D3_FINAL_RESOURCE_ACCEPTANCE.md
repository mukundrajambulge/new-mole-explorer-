# D3 Resource Evidence Review

The field resource contract is checked against the maximum-size 110 × 110 × 110 node, 250,000 receptor scoring-center C++ implementation measurement, not inferred from the small 3DMX fixture allocation.

| Measure | Observed | Limit | Result |
|---|---:|---:|---|
| Raw 59-array field payload | 628,232,000 B | 805,306,368 B (768 MiB) | PASS |
| Field-owned allocation during construction | 635,301,752 B | 1,073,741,824 B (1 GiB) | PASS |
| Retained field allocation | 628,234,296 B | 1,073,741,824 B (1 GiB) | PASS |
| Construction peak field-owned allocation | 635,301,752 B | 1,073,741,824 B (1 GiB) | PASS |
| Process peak RSS | 676,855,808 B | 2,147,483,648 B (2 GiB) | PASS |

The ordinary-V1 safety ceiling is 4,294,967,296 B (4 GiB); the measured process peak is below both this ceiling and the stricter default per-attempt limit. The small fixture field's 1,142,240 B payload is arithmetic only; its allocator overhead/RSS was not measured. Windows Zig and Linux GCC measurements differ slightly, so no cross-platform bitwise resource identity is claimed.

Evidence: `verification/d3-closure-exec-01/RESOURCE_VALIDATION.md` and `runtime_logs/continuation-native-field-resource-output.txt`. Resource acceptance passes; it does not close AT-0058.
