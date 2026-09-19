# Final Pre-Docking Seal Report

## Outcome

The accepted upstream visualization and selection core is sealed at:

`28a8dca64a4711ca4b9e00e13e19601e56404709`

The release branch is `seal/pre-docking-pymol-core-2026-09-19`. The immutable pre-docking tag is `mole-explorer-pre-docking-core-2026-09-19`.

## Scoped commits

- `0184d44f0f9814a83e4d32d809f9230c447ced3d` — seal large-molecule ingestion and selection.
- `385d9cf0345c62303f233c9b264dc0c8cde202b8` — remove unused compact profile constants.
- `bb551741d4e4ca942f91ec5e9a88ecdbd0a99298` — stabilize workspace fingerprint memo.
- `f9f86cc364069453ed81416b1083bac344c2aa88` — isolate scalar selection fingerprint dependencies.
- `28a8dca64a4711ca4b9e00e13e19601e56404709` — preserve the coarse viewer lifecycle contract while retaining detailed lifecycle telemetry.

## Verification

- Clean checkout gates: all passed.
- Unit/API: 215/215 passed.
- E2E: 147/147 passed.
- Selection matrix: passed.
- R10 verification: passed.
- API health, web shell, `/molstudio`, responsive shell, 1CRN/4DJW, multi-object, and frozen 4V6F focused smoke: passed.
- Six-case compact selection fingerprint subset: exact match against the accepted lock.

## Preservation and boundaries

- Unrelated dirty work remains in the original worktree; see [USER_WORK_PRESERVATION_AUDIT.md](USER_WORK_PRESERVATION_AUDIT.md).
- The accepted 4V6F fixture SHA-256 is `a48b6f9865ed1dff0e45d1992b9d20633582de6675c16d0b9a4abc75d595e56f`; it remains outside the commit.
- PyMOL remains `BLOCKED_ENVIRONMENT`.
- AF-001 remains a documented performance concern with correct semantics.
- Docking execution was not started.
- Main-branch merge is not authorized by this seal.

## Next-phase contract

Use [UPSTREAM_CORE_FREEZE_BOUNDARY.md](../05-checkpoint/UPSTREAM_CORE_FREEZE_BOUNDARY.md) and [DOCKING_D1_START_CONTRACT.md](../05-checkpoint/DOCKING_D1_START_CONTRACT.md) before any D1 work. D1 must start from the exact tagged SHA and keep any boundary changes explicit and resealed.
