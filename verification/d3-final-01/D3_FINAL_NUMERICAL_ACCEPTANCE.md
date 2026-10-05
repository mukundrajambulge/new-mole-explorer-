# D3 Fixture-Bounded Numerical Assessment

## Recomputed cohort results

The six rows in `fullpose/results/FULLPOSE_PER_POSE_RESULTS.csv` were reconciled against the 30 raw/weighted term rows. For each pose, summing its five weighted direct and grid terms reproduced the reported totals. Recomputed `grid - direct` E_inter MAE and RMSE exactly match the committed JSON values.

| Pose | grid − direct E_inter (kcal/mol) |
|---|---:|
| 3dmx-crystal | +0.2141831455 |
| cutoff-exact-8A | −0.0252470152 |
| validation-combined | +0.2901117728 |
| validation-grid-phase-half-cell | +0.2249306786 |
| validation-rotation | +0.1867545205 |
| validation-translation | +0.1614565687 |

For `n=6`: signed bias `+0.1753649452`, MAE `0.1837806169`, RMSE `0.2009211939`, p50 `0.2004688330`, p95 `0.2738164993`, p99 `0.2868527181`, and maximum absolute error `0.2901117728 kcal/mol`. Direct and grid orders are identical, with no ties, pairwise reversals or rank displacement.

## Weighted term analysis

| Term | Bias | MAE | Max absolute error | Interpretation |
|---|---:|---:|---:|---|
| G1 | +0.0079956 | 0.0097674 | 0.0164393 | Small after the frozen coefficient is applied. |
| G2 | +0.0045839 | 0.0089206 | 0.0208747 | Raw G2 max error is 4.0486, attenuated by its small coefficient; weighted error remains about 0.021. |
| REP | +0.1650332 | 0.1722071 | 0.2622238 | Dominant contributor; weighted grid-minus-direct error is positive for five poses and negative for cutoff stress (−0.021521844), while the six-pose bias is positive and makes the aggregate grid score less favorable. |
| HYD | −0.0022477 | 0.0027233 | 0.0050446 | Small after weighting. |
| HB | 0 | 0 | 0 | Exact zero in all six pose records. |

The observed positive total bias is driven primarily by REP interpolation around the overlap region; it is not hidden by averaging the terms. Grid-phase and rigid transformations exercise different interpolation cells. This cohort shows the expected smooth approximation behavior for these inputs without order changes. The cutoff-stress pair at `7.999999999999998 Å` is immediately inside the physical horizon; its E_inter absolute error is `0.0252470152 kcal/mol`, while the direct/grid exact-cutoff unit fixtures enforce zero at/above 8.0 Å. The high cutoff-stress total reflects other close contacts and is not presented as a plausible docking pose.

The owner explicitly authorized acceptance of measured 3DMX/BNZ evidence as fixture-bounded D3 validation, provided mandatory requirements pass. That authorization does not create a scalar tolerance. PHD-V2-13's `1e-10`/`1e-12` tolerances apply to specified backend/calculation equivalence; D3-GRID v1.2 leaves direct-versus-grid approximation acceptance separate. No universal approximation threshold is inferred here.

**Required limitation:** The 3DMX/BNZ results are fixture-bounded development validation evidence. They do not establish a universal direct-versus-grid approximation error bound.

This numerical evidence is acceptable within its declared scope. It does not cure AT-0058, which independently prevents D3 acceptance.
