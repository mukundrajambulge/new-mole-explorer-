# D3 independent numerical verification

Candidate implementation commit: 0b83a318822856d7f4ce231983ec5fe0d9ab22d3
Disposition: direct-score numerical fixtures pass in development mode; this does not establish complete D3 acceptance.

## Independent pair fixture

The fixture uses a receptor N_D atom at (0, 0, 0) Å and a ligand O_A atom at (3, 0, 0) Å. The authoritative XS radii in this fixture are 1.8 Å and 1.7 Å, so the surface separation is d = 3 - 1.8 - 1.7 = -0.5 Å. The fixture has three scorer torsions.

Expected raw terms, independently evaluated from the equations with high-precision decimal arithmetic:

- G1 = exp(-((-0.5)/0.5)^2) = exp(-1) = 0.3678794411714423216…
- G2 = exp(-((-0.5 - 3)/2)^2) = exp(-3.0625) = 0.04677062238395898365…
- REP = max(-0.5, 0)^2 = 0.25
- HYD = 0 because both types are polar/non-hydrophobic
- HB = 5/7 = 0.7142857142857142857…

Frozen coefficients, in G1/G2/REP/HYD/HB order: -0.035579, -0.005156, 0.840245, -0.035069, -0.587439.

Expected weighted terms are -0.013088782637438746, -0.00024114932901169252, 0.21006125, 0, and -0.4195992857142857. Their sum is E_inter = -0.22286796768073615. The torsion divisor is 1 + 0.05846 × 3 = 1.17538; the empirical score is E_inter / 1.17538 = -0.18961354428417716.

The reference values are fixed independently in scoring_test.cpp; they are not read from the scorer output or derived by calling the implementation. Assertions use a relative/absolute tolerance of 2×10^-15.

## Other independent boundaries covered

- G2 equals 1 at d = 3 Å; repulsion equals 1 at d = -1 Å and 0 at d = +1 Å.
- The hydrophobic plateau/shoulder/end points, hydrogen-bond plateau/midpoint/zero points, and the exact 8 Å cutoff.
- Zero-distance score remains finite and marks the gradient invalid.
- Imported partial charges do not affect the score.
- Permuting input atom vectors preserves exact decomposition and score after stable AtomUID ordering.
- Torsion-corrected score uses scorer torsions, not search torsion metadata.

This verifies a direct-scoring oracle subset only. There is no grid implementation, interpolation fixture, direct-versus-grid oracle, full SCORE-FX matrix, or canonical profile/result hashing verification.
