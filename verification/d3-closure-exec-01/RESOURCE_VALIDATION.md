# Resource validation

**Closure-task status: SearchRegion geometry and fixed field budget PASS; allocator/RSS profiling not performed for the small fixture field.**

The fixture SearchRegion contains 2,420 grid points at 0.375 Å spacing with a 0.375 Å interpolation halo. Its axes are 11, 22, and 10 points, below the native 110-point maximum. The receptor uses 1,306 scoring centers, below the 250,000-center maximum. The 59-channel physical layout implies 1,142,240 bytes of double values (59 × 2,420 × 8), below the 805,306,368-byte raw-payload limit. This is a layout calculation; metadata, allocator overhead, serialized-field size, and fixture RSS were not separately measured. Native construction of the field completed successfully in the full-pose run.

The direct C++ and scoring-field test suite passed under CMake/GCC on WSL2 Ubuntu 24.04.5, 2/2 CTest targets. The inherited D3-GRID-01 maximum-field implementation evidence uses 110 × 110 × 110 nodes and 250,000 receptor scoring centers. It remains recorded below with its measured values and existing limits.

| Maximum-field measure | Prior Windows Zig result | Continuation Linux GCC result | Limit |
|---|---:|---:|---:|
| Raw physical payload | 628,232,000 B | 628,232,000 B | 805,306,368 B (768 MiB) |
| Field-owned allocation during construction | 635,301,608 B | 635,301,752 B | 1,073,741,824 B (1 GiB) |
| Retained field allocation | 628,234,152 B | 628,234,296 B | 1,073,741,824 B (1 GiB) |
| Construction peak field-owned allocation | 635,301,608 B | 635,301,752 B | 1,073,741,824 B (1 GiB) |
| Process peak RSS | 674,414,592 B | 676,855,808 B | 2,147,483,648 B |

The small allocation/RSS differences between Windows Zig and Linux GCC are observations; no cross-platform bitwise resource identity is claimed. These maximum-field implementation measures are not represented as fixture-field measurements.
