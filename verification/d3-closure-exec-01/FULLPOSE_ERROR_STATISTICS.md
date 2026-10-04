# Full-pose error statistics

**Status: COMPLETE — SEALED_STATES fixture result, six deterministic poses.**

Errors are signed grid minus direct. Percentiles use linear interpolation at h=(n−1)p. Values are kcal/mol.

| E_inter statistic | Full cohort (n=6) | Cutoff-stress subset (n=1) |
|---|---:|---:|
| Signed mean bias | 0.17536494515694448 | -0.02524701521328865 |
| MAE | 0.18378061689470737 | 0.02524701521328865 |
| RMSE | 0.20092119392847385 | 0.02524701521328865 |
| p50 | 0.20046883300537743 | -0.02524701521328865 |
| p95 | 0.27381649927862073 | -0.02524701521328865 |
| p99 | 0.2868527181294298 | -0.02524701521328865 |
| Maximum absolute error | 0.2901117728421321 | 0.02524701521328865 |

All five raw and weighted term distributions are in fullpose/results/FULLPOSE_ERROR_STATISTICS.json. Per-pose direct/grid terms, weighted values, torsion quantities, total scores, and differences are in FULLPOSE_TERM_DECOMPOSITION.csv and FULLPOSE_PER_POSE_RESULTS.csv. Exact transform, state digests, field digest, pose digest, and boundary disposition are in FULLPOSE_POSE_MANIFEST.csv.

Direct and grid orders match exactly. There are no ties, pairwise reversals, or nonzero rank displacements. The current D3 materials approve no scalar direct-versus-grid approximation/ranking threshold; these values are evidence for D3-FINAL-01, not an invented acceptance limit. The six-pose deterministic validation cohort is not a general error-bound sample.
