# D3 unresolved issues and scientific limitations

Candidate code commit: 0b83a318822856d7f4ce231983ec5fe0d9ab22d3
Disposition: HOLD. The open items below prevent D3 acceptance.

## Authoritative specification conflicts or omissions

1. The scoring specification enumerates 16 canonical XS types and describes one channel per supported ligand XS type × five scoring terms, implying 80 channels if all 16 are ligand-supported. The chemistry requirements describe 14 ligand XS types and the synthesis retains a 70-channel grid. The authoritative materials provide no exact 14-type subset/channel order/map. Do not choose the missing map by engineering inference.
2. The scoring specification points direct-versus-grid tolerance to PHD-V2-11, but the current PHD-V2-11 text does not state that acceptance threshold. Interpolation tolerance and general backend equivalence limits do not define this physical direct-versus-grid error threshold.
3. The pinned scientific toolchain is Ubuntu 24.04/GCC 13.3.0-6ubuntu2~24.04.1/C++20. Only Ubuntu 20.04/GCC 9.4 was available; CMake and container runtimes were unavailable.

## Required engineering work still absent

- Complete molecule-graph and state-aware typing from D2 prepared input. The current type mapper accepts already-resolved chemistry features.
- The authoritative grid channel map, grid construction, interpolation semantics, and direct-versus-grid comparisons.
- The authoritative direct-versus-grid acceptance tolerance and reproducible threshold checks.
- Canonical profile-content digest validation and canonical output score-record digest generation. Current result provenance carries caller-provided references.
- Full authoritative SCORE-FX-001 through SCORE-FX-040 coverage, including all required unsupported chemistry and numerical boundary cases.
- Pinned-toolchain build and test execution.
- CMake configure/build/CTest execution.

## Gate boundary

No search, RNG, optimization, pose generation, clustering, GPU docking, durable public execution, API/CLI/UI scoring route, or production release capability was added. DOCKING.RUN remains unavailable. No D4 work started.
