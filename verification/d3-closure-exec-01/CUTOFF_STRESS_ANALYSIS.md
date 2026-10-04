# Cutoff-stress analysis

**Status: PASS — one sealed deterministic cutoff-stress pose.**

The cohort nominates one source-backed receptor/ligand atom pair whose transformed distance is 7.999999999999998 Å in binary64, immediately below the 8.0 Å pair cutoff. The pose is tagged STRESS in the pose manifest and remains IN_DOMAIN under the sealed SearchRegion. It is an algorithmic cutoff case, not a plausible docking pose.

For this n=1 subset, grid-minus-direct E_inter is -0.02524701521328865 kcal/mol (absolute error 0.02524701521328865 kcal/mol). Direct and grid totals are 53.921030095737173 and 53.895783080523884 kcal/mol. Other close contacts make the aggregate score high, so this result is limited to the nominated cutoff stress case.

The direct scorer and field unit regressions include exact 8.0 Å cutoff fixtures. This fixture case is reported at its actual binary64 pair distance; it is not mislabeled as an exactly representable 8.0 Å coordinate separation. No cutoff shell width or approximation threshold is inferred.
