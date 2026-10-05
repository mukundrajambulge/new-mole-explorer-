# D3 Architecture Reviewed for Final Disposition

This records the canonical D3 architecture found in the latest PHD-V2 and D3-GRID evidence. The architecture is technically consistent with the reviewed implementation, but this file does **not** declare an accepted D3 baseline because AT-0058 fails; see `D3_FINAL_DECISION.md`.

## Canonical atom types, terms, and storage map

- Canonical XS types, in stable order for receptor and ligand: `C_H, C_P, N_P, N_D, N_A, N_DA, O_P, O_D, O_A, O_DA, S_P, P_P, F_H, Cl_H, Br_H, I_H`.
- Terms in stable order: `G1, G2, REP, HYD, HB`.
- Logical channel ID: `5 * XS_ID + TERM_ID`; 16 × 5 = 80 stable logical channels.
- Physical storage: 59 binary64 arrays under `ME_SCORING_FIELD_80_TO_59_F64_V1`.
- All 16 XS types have physical G1/G2/REP channels. HYD is physical for XS IDs 0 and 12–15 only; its 11 omitted channels are exact `+0.0`. HB is physical for XS IDs 3, 4, 5, 7, 8 and 9 only; its 10 omitted channels are exact `+0.0`. The omissions are equation-proven, not missing data.
- Canonical coefficients: `[-0.035579, -0.005156, +0.840245, -0.035069, -0.587439]`.

## Scoring and torsion semantics

- The direct scalar scorer is the auditable reference primitive and returns raw and weighted G1/G2/REP/HYD/HB decomposition.
- The named profile is `ME_DOCKING_V1_VINA_CLASSIC_1_0`, with `ME_XS_TYPING_V1_1_0` and `ME_SUPPORTED_CHEMISTRY_V1_1_0`.
- The score divisor is `1 + 0.05846 * N_tors_vina`. `N_tors_vina` is the source-faithful Vina torsion count and is distinct from search torsions or blindly copied PDBQT `TORSDOF`.
- Partial charges are not scoring terms; formal charge/protonation and donor/acceptor typing remain explicit state.
- The pair-score primitive uses the PHD-V2-06 surface-distance equations and exactly zero physical pair contribution at/above the 8.0 Å pair horizon.

## Field semantics

- Grid spacing `h = 0.375 Å`; canonical trilinear interpolation uses the complete 8-corner stencil and declared analytic derivative semantics.
- Physical pair horizon `8.0 Å`; interpolation support horizon `8.0 + sqrt(3) * 0.375 = 8.649519052838329 Å`.
- SearchRegion is a closed ligand-pose admissibility AABB and is independent of the scoring-field domain. The field is built with a one-cell `0.375 Å` support halo.
- Deterministic geometry/origin/extents and receptor AtomUID ordering are part of the field contract.
- Out-of-field queries fail closed with `SCORING_FIELD_OUT_OF_DOMAIN`. No extrapolation, clamping or direct-scorer fallback is permitted.
- Logical content digest, physical storage identity/payload digest, and cache compatibility are distinct; field identity binds receptor state and typing/scoring/chemistry/numeric dependencies.

## Resource ceilings

- Raw field payload ≤ 805,306,368 B (768 MiB).
- Field-owned construction allocation ≤ 1,073,741,824 B (1 GiB).
- Default per-attempt process RSS ≤ 2,147,483,648 B (2 GiB); ordinary-V1 safety ceiling ≤ 4 GiB.
- Maximum field axes: 110 points each; maximum receptor scoring centers: 250,000.
- The measured 110³/250,000-center implementation values are recorded in `D3_FINAL_RESOURCE_ACCEPTANCE.md`.

## Acceptance limitation

This architecture review does not make `PreparedReceptorState` hash omission conformant. The separate scoring-field identity cannot substitute for AT-0058's required prepared-state identity dependency binding.
