# SearchRegion and geometry-only field support

This is a geometry-only decision calculation. No `SearchRegion` object was sealed and no potential arrays or scoring fields were constructed.

## Proposed SearchRegion

Use the exact reference-ligand occurrence (3DMX model 1 / label asym G / BNZ / C1–C6), heavy atoms only, as `REFERENCE_LIGAND_ENVELOPE_V1`. The D2 region is a closed AABB with `posePolicy = ALL_LIGAND_HEAVY_ATOMS_IN_OR_ON`, receptor frame, angstrom units, and explicit per-axis padding 0.000 Å. PHD-V2-05 permits zero padding. This gives the smallest region that admits the deposited reference pose and leaves no translation/search claim; D4/global search is outside scope.

| Axis | Source heavy-atom min | Source heavy-atom max | Full extent | Center |
|---|---:|---:|---:|---:|
| x | 25.813 | 27.432 | 1.619 | 26.6225 |
| y | 5.062 | 7.329 | 2.267 | 6.1955 |
| z | 3.066 | 5.279 | 2.213 | 4.1725 |

All six source carbon atoms lie on or inside these exact bounds. Future serialization must bind this region to the exact prepared receptor digest and selected coordinate frame; no region digest exists before the receptor state does.

## Grid-domain support calculation

Under the existing D3 field profile, spacing `h = 0.375 Å`, pair cutoff `R = 8.0 Å`, and one-cell interpolation halo `h`, use

`support_min = ligand_min − (R + h)`

`support_max = ligand_max + (R + h)`

`origin = support_min`

`n_axis = ceil((support_max − support_min)/h) + 1`

`grid_point(i) = origin + i*h`, `i = 0 ... n_axis−1`.

| Axis | Support min | Support max | Span / h | Nodes | Last node | Upper overhang |
|---|---:|---:|---:|---:|---:|---:|
| x | 17.438 | 35.807 | 48.984 | 50 | 35.813 | 0.006 |
| y | -3.313 | 15.704 | 50.712 | 52 | 15.812 | 0.108 |
| z | -5.309 | 13.654 | 50.568 | 52 | 13.816 | 0.162 |

The exact node dimensions are **50 × 52 × 52**, 135,200 spatial nodes. Each dimension is below the 110-node cap. For every query within the cutoff-expanded support, the stated upper overhang leaves the upper trilinear neighbor available; at support minima the origin node and its next node exist. Later scorer code must reject out-of-domain queries and must not clamp or extrapolate.

This is a bounded geometry pass only. It does not imply field construction, score validity, or authorization to run direct/grid scoring.
