# Mole Explorer UI-D0 Baseline

## Exact starting point

- Repository: `mukundrajambulge/new-mole-explorer-`
- Starting branch: `feature/docking-ui-d0-workspace`
- Starting worktree: `C:\Users\mukun\.codex\worktrees\molecular-workstation-ui-d0-workspace\molecular-workstation`
- Accepted D2 tag: `mole-explorer-docking-d2-accepted-2026-09-20`
- Expected D2 SHA: `ba2ffb4eb28a00ee945086b24f39bf639ca2250c`
- Resolved D2 SHA: `ba2ffb4eb28a00ee945086b24f39bf639ca2250c`
- Baseline status before this report: clean

## Continuity commands

The following checks were run from the original checkout and the new worktree:

```text
git rev-parse mole-explorer-docking-d2-accepted-2026-09-20^{commit}
=> ba2ffb4eb28a00ee945086b24f39bf639ca2250c

git cat-file -t ba2ffb4eb28a00ee945086b24f39bf639ca2250c
=> commit

git -C <ui-d0-worktree> status --short --branch
=> ## feature/docking-ui-d0-workspace

git ls-remote --tags new-origin refs/tags/mole-explorer-docking-d2-accepted-2026-09-20
=> no matching remote ref returned
```

The D2 tag is therefore locally resolvable and is not published as a matching
tag on the configured `new-origin` remote at baseline. The accepted D2 closure
worktree is the separately preserved local worktree recorded in the
continuation evidence.

## Authoritative evidence read

- Continuation master plan: Drive document `1Cv6Z_0No8EqxkWtet1jlzkpTWciBN8pltHQfxaOv5cw`.
- D1 closure: Drive file `1t_NNjQKFuiivVMMHgWphr6TT-SJINRGG`.
- D1 closure JSON: Drive file `1K0TXKwpY50SBFxzzP_paM9SMtuUrxlG8`.
- D1 negative scope audit: Drive file `1Ndb9DlsW6MqbHV7wem6cMXdhTSgjdWYR`.
- D2 closure: Drive file `10r1NVlJNQ_wjQEBaMLMUuObVbpm-DrX1`.
- D2 closure JSON: Drive file `1S7LgyYiU61A1SaVu2vYIfXqkyo0dM5X9`.
- PHD-V2 research and IA/R-PYMOL documents listed in `UI_D0_PLAN.md`.

## Accepted source inventory

- Active shell composition: `apps/web/src/App.tsx`.
- Existing viewer boundary: `apps/web/src/components/MolecularCanvas.tsx` and
  `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`.
- Existing navigation component: `apps/web/src/components/NavRail.tsx`; it is
  not mounted by the accepted `App.tsx`.
- Existing active panels: `MenuBar`, `ContextToolbar`, `StructurePanel`,
  `ScientificToolRail`, `StatusBar`, `ConsolePanel`, and `CapabilityNotice`.
- Existing UI capability registry: `apps/web/src/domain/registry.ts`.
- Existing API adapter: `apps/web/src/lib/apiClient.ts`.
- Backend command registry/dispatcher: `apps/api/src/command/registry.ts` and
  `apps/api/src/command/dispatcher.ts`.
- D2 contracts: `packages/contracts/src/docking/d2.ts` plus the D1 docking
  contract modules in `packages/contracts/src/docking/`.
- D2 preparation/sealing: `apps/api/src/docking/d2Preparation.ts`,
  `apps/api/src/docking/d2PreparationService.ts`, `d2Validation.ts`, and
  `d2Adapters.ts`.
- D2 route boundary: no docking execution route exists; the accepted server
  exposes the existing structure/project/command surfaces and keeps
  `DOCKING.RUN` unavailable.

## Protected boundary

D1/D2 are accepted contract and preparation/site work only. No scoring,
search, optimization, pose, worker, GPU, HTS, or executable `DOCKING.RUN`
implementation is admitted in UI-D0.
