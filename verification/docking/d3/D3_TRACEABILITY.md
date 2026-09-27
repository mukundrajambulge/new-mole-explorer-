# D3 requirements-to-code traceability

Candidate implementation commit: 0b83a318822856d7f4ce231983ec5fe0d9ab22d3
Baseline: mole-explorer-p0-perf-accepted-2026-09-21 at f773b7fcf0a6f16b23f9abc760fa9d2292b63061
Disposition: HOLD. The direct CPU scorer is implemented as a standalone reference component; D3 is not complete or accepted.

| Requirement area | Current implementation | Evidence | Status |
| --- | --- | --- | --- |
| Frozen profile identity and classical coefficients | Fixed scoring profile ID, five term coefficients, 8 Å cutoff, and 0.05846 torsion divisor coefficient in scoring.cpp | scoring.hpp, scoring.cpp, six native fixture groups | Partial pass: direct profile constants only |
| Canonical XS type table | Sixteen canonical XS type labels, radii, element checks, hydrophobic and donor/acceptor features | test_xs_type_table | Partial pass: authoritative documents disagree whether the supported ligand set has 14 or 16 entries |
| Atom typing | Feature-to-type mapping for already-resolved carbon hetero context and N/O donor/acceptor roles; ambiguity and unsupported features fail closed | assign_xs_type; test_xs_type_table | Partial pass: no complete state-aware chemical graph perception from D2 input |
| Direct pairwise score | Direct receptor-ligand evaluation with G1/G2/repulsion/hydrophobic/H-bond terms, cutoff, weighting, torsion correction and decomposition | score_direct; test_independent_pair_oracle_and_decomposition; test_hydrophobic_piecewise_and_cutoff | Implemented for pretyped atoms |
| Supported chemistry and site exclusions | Closed type vocabulary, element compatibility, explicit ligand formal charges in the accepted range, dry-core-only profile, unsupported site classes rejected | test_charge_domain_and_torsion_divisor; test_profile_site_and_provenance_rejection; test_boundary_validation_and_determinism | Partial pass: acceptance coverage is not the full authoritative SCORE-FX suite |
| Deterministic numerical behavior | Stable AtomUID ordering, receptor then ligand validation, ligand-outer/receptor-inner pair loop, Neumaier term sums, round-to-nearest, FTZ/DAZ disabled, FMA and fast-math disabled | scoring.cpp; compiler flags in CMakeLists.txt; test_boundary_validation_and_determinism | Development-toolchain pass; pinned reference toolchain unavailable |
| Provenance | Validates digest shape/profile IDs and passes state/profile/type references into direct result | test_profile_site_and_provenance_rejection; test_independent_pair_oracle_and_decomposition | Partial: no canonical result record hash and profile digests are not recomputed against profile contents |
| Grid construction and interpolation | Not present | None | Not implemented |
| Direct-versus-grid comparison | No grid backend or authoritative error tolerance is available | None | Not implemented; blocking |
| SCORE-FX-001 through SCORE-FX-040 | Representative type, formula, boundary, chemistry, determinism and provenance cases are covered | scoring_test.cpp, six groups | Partial; no complete official case-by-case acceptance matrix |
| Docking execution boundary | New code is a standalone library/test component; no API, CLI, UI, search or pose-generation entry point was added | Change inventory and P0-based regression | Preserved in this change |

The native component accepts typed atom records and declared provenance. It does not infer a complete chemical state from raw D2 molecular graphs, build grids, interpolate grids, produce the canonical scored result record, or provide an execution route.
