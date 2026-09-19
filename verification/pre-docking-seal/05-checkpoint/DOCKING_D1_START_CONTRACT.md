# Docking D1 Start Contract

## Exact starting point

D1 may begin only from the tested upstream-core checkpoint:

- source SHA: `28a8dca64a4711ca4b9e00e13e19601e56404709`;
- seal branch: `seal/pre-docking-pymol-core-2026-09-19`;
- immutable checkpoint tag: `mole-explorer-pre-docking-core-2026-09-19`.

A D1 branch must be a descendant of that exact checkpoint and must keep upstream-core changes separable from docking changes. No D1 branch is created by this checkpoint operation.

## Required D1 guardrails

1. Record the exact base SHA before any docking change.
2. Keep docking code, data, experiments, and evidence outside the frozen upstream-core source list unless an approved change request reopens the boundary.
3. Do not change canonical ingestion, selection, rendering, workspace identity, representation, camera, R07–R10 contracts, or responsive shell behavior as an incidental part of D1.
4. Run the focused docking tests plus the complete upstream-core regression gates before claiming a D1 result.
5. If D1 needs an upstream-core change, stop the docking task, document the request, implement the smallest justified change, rerun the complete acceptance suite, and issue a new pre-docking/core seal.

## Explicit status

- Docking execution: **NOT STARTED**.
- Main-branch merge: **NOT AUTHORIZED BY THIS CHECKPOINT**.
- D1 research/implementation contract: **available from the exact tagged SHA only**.
