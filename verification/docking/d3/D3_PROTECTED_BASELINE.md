# Protected baseline regression comparison

Starting point: P0 accepted tag mole-explorer-p0-perf-accepted-2026-09-21 at f773b7fcf0a6f16b23f9abc760fa9d2292b63061.
Candidate: code-only commit 0b83a318822856d7f4ce231983ec5fe0d9ab22d3 on codex/d3-reference-scoring.
Desktop checkout C:\Users\mukun\Desktop\molecular-workstation was not modified.

The code commit adds only four new files under native/docking-reference/scoring: the CMake definition, public scoring header, scorer implementation, and native unit fixtures. No existing D1, D2, UI-D0, P0, API, web, PyMOL-workstation, biological-data, trajectory, identity, session, or dependency files changed. No accepted tag was rewritten and no D3 acceptance tag was created.

Fresh regression outcomes:

- Typecheck, lint, unit/integration tests, build, and all 150 browser tests passed.
- The browser suite included the existing final PyMOL workstation acceptance coverage and UI-D0 negative-boundary coverage.
- Mini-protein, small-molecule, and 4V6F scientific hashes exactly matched accepted P0 identities.
- The fresh renderer probe retained P0's one viewer/model/scene/projection rebuild counts through camera interaction and the expected style/diagnostic counts.
- Playwright rewrote tracked visual verification outputs during the run; those outputs were restored, so accepted evidence stayed byte-for-byte unchanged.

Fresh fixture timings were 18.43 ms (mini-protein), 6.36 ms (small molecule), and 16.29 s (4V6F). Timing varies by host and is not asserted against the historical baseline; scientific hashes and renderer rebuild invariants are the protected comparisons.

The candidate is additive and standalone, and existing tests pass. These facts establish no observed regression in the executed checks; they do not establish full D3 scientific acceptance.
