# D3 implementation change inventory

Candidate implementation commit: 0b83a318822856d7f4ce231983ec5fe0d9ab22d3

## Added files

- native/docking-reference/scoring/CMakeLists.txt: standalone C++20 static library and test target with strict floating-point/compiler flags.
- native/docking-reference/scoring/include/mole/docking/scoring.hpp: profile identifiers, typed atom/request/result data, XS feature helpers, and direct scorer interface.
- native/docking-reference/scoring/src/scoring.cpp: fixed direct scoring profile, canonical 16-label XS table, type and chemistry validation, deterministic pair evaluation, five-term decomposition, and pass-through provenance fields.
- native/docking-reference/scoring/tests/scoring_test.cpp: six native test groups covering type table/features, independent score/decomposition oracle, term boundaries, charge/torsion, validation/determinism, profile/site/provenance.

The implementation commit adds 907 lines across those four files and modifies no existing repository file. No packages, lockfiles, APIs, UI routes, CLI, search, pose-generation, GPU code, grid code, or release behavior were added.

## Implementation boundary

This is a direct evaluator for caller-supplied typed atoms. It does not yet connect raw D2 chemistry graphs to state-aware typing, generate or interpolate grids, compare grid scores to direct scores, recompute declared profile digests from canonical profile data, or emit a canonical score-record digest. These are tracked in D3_UNRESOLVED_ISSUES.md.
