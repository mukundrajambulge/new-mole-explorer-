# D3 Scope and Limitations

- The 3DMX/BNZ six-pose results are fixture-bounded development validation evidence. They do not establish a universal direct-versus-grid approximation error bound, general docking or affinity accuracy, redocking success, or virtual-screening performance.
- D3 is the reference scoring, atom typing, scoring-field, interpolation and decomposition subsystem. D3 does not implement global search, pose generation, optimizer/RNG, final clustering/modes, GPU execution, production screening, or release qualification.
- `DOCKING.RUN` remains unavailable. D4 is not authorized because the final D3 disposition is HOLD.
- The active fixture is 3DMX/BNZ. Historical `181L/BNZ`, `3ATL/BEN`, `4W52/BNZ` and `9I7O/RTL` candidate decisions remain candidate-specific historical evidence; no current D3 requirement demands multiple fixtures.
- Protected PyMOL behavior was exercised through the protected browser suite and 40 screenshot hashes. This review makes no new claim for the separate pinned PyMOL executable oracle or a new manual user retest; current roadmap places these in existing PyMOL governance, not as D3-specific requirements.
- Pre-existing 3Dmol.js eval and bundle-size build advisories remain technical debt. The closure changes no dependency manifests or lockfiles and introduced no new advisory. No canonical D3 policy identified them as a D3 release blocker.
- No D4-PREFLIGHT-01 package was found in the final checkout/worktree inventory or canonical Drive search. Since D4 is not authorized, there is no D4 starting-base update.
