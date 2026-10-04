# SearchRegion report

**Status: SEALED AND VALIDATED.**

The canonical D2 SearchRegion digest is sha256:690c208e99f9cf467662c071e6934abe01950b0d2e22f7753b5cc5e2ee5b1f2d. It is linked to the sealed PreparedReceptorState and receptor coordinate state. The region is the closed axis-aligned envelope of the deterministic validation cohort only; no D4 search was run.

## Geometry and grid

| Item | Value |
|---|---|
| Closed minimum (Å) | [25.813, 0.653875981912301, 2.769350971986182] |
| Closed maximum (Å) | [28.656180604292317, 7.417396483918871, 5.279] |
| Extent (Å) | [2.843180604292318, 6.76352050200657, 2.509649028013818] |
| Grid profile / spacing | ME_VINA_GRID_V1_1_0 / 0.375 Å |
| Interpolation halo | 0.375 Å on each side |
| Field origin | [25.438, 0.278875981912301, 2.394350971986182] |
| Field domain maximum | [29.188, 8.1538759819123, 5.7693509719861815] |
| Cell counts / point counts | [10, 21, 9] / [11, 22, 10] |
| Total grid points | 2,420 |
| Pair cutoff / receptor support horizon | 8.0 Å / 8.649519052838329 Å |

The 8.649519052838329 Å receptor support horizon includes the 8.0 Å pair cutoff plus the trilinear interpolation support radius derived from grid spacing. The halo preserves interpolation stencils at the closed region boundary. The grid dimensions match the native 0.375 Å spacing and one-cell halo rules.

The receptor-influence support AABB is [17.16348094716167, -7.995643070926028, -5.8801680808521475] through [37.305699657130646, 16.0669155367572, 13.928519052838329]. It covers every potentially contributing receptor scoring center for points in the region, including the interpolation support.

## Validation evidence and limits

The full-pose runner built a single field from the sealed receptor projection and scored all six poses. The deposited crystal pose and all five declared validation transforms report IN_DOMAIN; there was no OOD, extrapolation, or clamping result.

Point counts [11,22,10] remain below the 110-point-per-axis limit. The receptor has 1,306 scoring centers, below the 250,000-center limit. The fixed 59-channel physical layout implies 1,142,240 bytes of double payload at 2,420 grid points, below the 805,306,368-byte raw-payload cap; this is a layout calculation, not a separate serialized-field or allocator/RSS measurement. The field was successfully constructed by the native full-pose run.

The pose manifest, exact transformations, boundary statuses, and per-pose outputs are in fullpose/results/. The search region and geometry inputs are in sealed_states/search_region.json, D2_SEALED_STATE_SUMMARY.json, and VALIDATION_POSE_COHORT.json.
