# Mole Explorer UI-D0 Closure

## Acceptance identity

- Repository: `mukundrajambulge/new-mole-explorer-`
- Worktree: `C:\Users\mukun\.codex\worktrees\molecular-workstation-ui-d0-workspace\molecular-workstation`
- Branch: `feature/docking-ui-d0-workspace`
- Accepted D2 baseline: `mole-explorer-docking-d2-accepted-2026-09-20`
- Accepted D2 SHA: `ba2ffb4eb28a00ee945086b24f39bf639ca2250c`
- UI-D0 implementation commit tested: `5bf7c0d9b6d11d195fb8008ee6d763bd603007cd`
- Final tag: `mole-explorer-docking-ui-d0-accepted-2026-09-20`
- Final tag SHA: recorded by `git rev-parse mole-explorer-docking-ui-d0-accepted-2026-09-20^{commit}` after this closure commit
- Drive closure folder: `1LAAKOrzxsB8zaAVakbyjtcbBjOzmxhSV`
- Drive closure Markdown: `1m9TIONQXCvFEYnwqo7_0PpgpJP6HcH36`
- Drive closure JSON: `1CfdANqPqqRVkKknqm-wmDugYQbRboojJ`
- Drive scope audit: `1RFNAHpQso3963RkUqm7Js46wBrZHny3g`

## Delivered boundary

UI-D0 adds a first-class Docking workspace inside the accepted AppShell and
reuses the existing `MolecularCanvas` / `ThreeDMolViewerAdapter` as the only
molecular viewer. It exposes:

- D2-backed source adaptation through `POST /api/docking/d2/adapt`.
- Receptor and ligand candidate state cards with identity, graph, chemical,
  coordinate, prepared-state, and kinematic-state truth.
- PDBQT execution representation as explicitly non-authoritative for
  MolecularIdentity.
- Mutable six-field Å SearchRegion draft state kept separate from scientific
  authority.
- Explicit D2 SearchRegion transport through
  `POST /api/docking/d2/search-region` when caller-supplied prepared states are
  present; the current UI blocks without those explicit states.
- Renderer-neutral draft/committed SearchRegion box projection through the
  existing 3Dmol viewer, with camera actions remaining presentation-only.
- Truthful workflow, capability, preflight, jobs, events, results, and
  provenance surfaces. No fake execution state is created.
- `DOCKING.RUN` remains registered as unavailable and non-executable.

## Verification

All commands below were run from the UI-D0 worktree.

```text
npm ci --ignore-scripts
=> PASS (baseline install; npm reported 5 existing audit findings)

npm run typecheck --workspaces
=> PASS

npm run lint --workspaces
=> PASS

npm run build
=> PASS (inherited 3Dmol eval warning and large-chunk warning only)

npm test --workspace @molecular/web -- --run
=> 34 test files, 156 tests passed

npm test --workspace @molecular/api -- --run
=> 12 test files, 90 tests passed

npm run verify:selection-matrix
=> PASS

npm run verify:r10
=> PASS

npx playwright test tests/e2e/ui-d0-docking.spec.ts --config=playwright.ui-d0.config.ts
=> 3 passed

npx playwright test --config=playwright.ui-d0.config.ts
=> 150 passed (final post-fix run; 31.3 minutes)
```

The full Playwright run includes the inherited PyMOL, rearchitecture, P0,
R07/R08/R09/R10, selection closure, exhaustive A–BF selection, visualization,
and final acceptance suites. Test-generated inherited evidence fixtures were
restored to their D2 baseline after verification; only `verification/ui-d0/`
closure materials remain in this change.

## Scope-negative result

`verification/ui-d0/UI_D0_SCOPE_NEGATIVE_AUDIT.md` records the changed-surface
and negative checks. No scoring, search/optimization, pose generation, worker,
GPU, HTS, native docking engine, new JobStatus vocabulary, fake job/result
store, or executable `DOCKING.RUN` was added.

## Known deferred risks

The following inherited D1/D2 risks remain outside UI-D0 scope and are not
silently repaired here: the development API server remains non-loopback with
wildcard CORS and no authentication, request-body limits are not yet enforced,
dispatcher enqueue/completion and cancellation race semantics remain as
accepted, and the current ActionRecordStore / SourceArtifactStore are local
development stores. Production hardening requires its own accepted gate.

The UI intentionally cannot seal a scientific SearchRegion from the current
screen alone because the accepted D2 UI boundary has no explicit prepared
receptor/ligand selection surface yet. It fails closed and explains the exact
missing authority; it does not manufacture prepared states.

## Runtime smoke

- API: `http://localhost:18110`
- Web: `http://127.0.0.1:3102`
- The isolated API and web development servers remained available for browser
  verification.

## Drive readback

Upload/readback was verified for all three files. The exact Drive
file/folder IDs and status are recorded in `UI_D0_CLOSURE.json` and in the
final commit of this directory.
