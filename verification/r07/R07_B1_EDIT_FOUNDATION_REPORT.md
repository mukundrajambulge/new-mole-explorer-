# R-PYMOL-07 B1 Verification Report

## 1. Status and scope

This report covers only R-PYMOL-07 B1: the scientific edit transaction boundary, immutable molecular revisions, lineage, dependency invalidation, retained undo/redo history, bounded integration, and multi-object/multi-state safety.

No B2/B3 chemistry editor was implemented. The only user-facing mutation is the deterministic `edit_test` coordinate mutation used to prove the canonical transaction path.

## 2. Repository and Git discipline

```text
AUTHORITATIVE_REPO: C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation
LOCAL_REPO_ROOT: C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation
R07_WORKTREE_ROOT: C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation-r07-b1
BRANCH: feature/r07-editing-foundation
REMOTE: new-origin
R07_BASE_SHA: 5aced1b45f8997a9efef90928e6da306e53989e9
CODEX_A_REMOTE_HEAD_AT_FINAL_FETCH: 6f695300f8519aaeec6b5b5e41d844996ef828eb
```

The R07 worktree was created from the exact base SHA on a dedicated branch. The original `fix/visualization-final-closure` checkout was not used for edits, was not merged into, and was not pushed by this task. Its local uncommitted state was preserved.

## 3. Research authority read

- Pasted task authority: `C:\Users\mukun\.codex\attachments\9421a9f6-48eb-4817-a5e4-170d26e125db\pasted-text-1.txt`.
- Google Drive document `R-PYMOL-07 — Molecular Editing, Bonds, Hydrogens & Undo/Redo`, ID `1BQEeBRNPBl2f1MdAPWKzGq8Gx_lh0cqkAycSTbYPGYU`.
- Google Drive document `R-PYMOL-05 — Objects, Models, Coordinate States & Multi-Object Workflows`, ID `1_bpN8YtzTbqxcTJbLIf3I-Bh241rF7ykWXf4Fm0sHq4`.

The implementation follows the read authority: exact base-revision checking, canonical stable IDs, immutable published revisions, explicit state selectors, object-scoped transactions, retained DAG history, no silent rebasing, and renderer projection after canonical publication.

## 4. Implemented foundation

- Added typed canonical edit contracts in `packages/contracts/src/index.ts`.
- Added `ScientificHistoryService` and atomic `EditTransaction` in `apps/web/src/editing/editFoundation.ts`.
- Added immutable root/child `ScientificRevision` records with parent links, sequence, content hash, identity transition, entity lineage, provenance, state order, and invalidation manifest.
- Added fail-closed outcomes for stale base, wrong object, invalid selection, missing target, invalid state scope, ambiguous target, unsupported operation, and no-op coordinate mutation.
- Added canonical selectors `CURRENT`, `ALL`, `EXPLICIT_ORDINAL`, `COORDINATE_STATE_ID`, `APPEND`, and `COMMAND_DEFAULT`; B1 edits require explicit supported coordinate scopes and never clone a patch implicitly across states.
- Added coordinate invalidation categories for spatial selection, measurements, contacts, clashes, H-bonds, alignment, spatial/geometry/surface caches; stale analyses remain represented but are not rendered.
- Added exact undo/redo cursor navigation with retained branch descendants and explicit ambiguous-redo failure.
- Added serializable `persistenceManifest` as the R09 integration boundary without expanding project/session persistence.
- Wired console commands `history`, `undo`, `redo`, and deterministic `edit_test` through the existing command parser into the canonical service.
- Wired Edit-ribbon Undo/Redo action IDs through the same handler/service path.
- Reprojected scientific revisions into the existing viewer instance and rebuilt reverse identity bindings in place; model count stays stable and renderer generation advances to reject stale picks.
- Kept unchanged atom, bond, residue, and molecular identity IDs stable for coordinate-only edits.
- Added a `lucide-react` ambient declaration so the existing workspace typecheck is reproducible with the installed package metadata.
- Updated the lockfile to match the already-declared workspace packages and test dependencies so `npm ci`/workspace scripts have a consistent lock graph.

## 5. Transaction and history semantics

The transaction validates the command schema, exact object, exact current base revision, canonical selection binding, stable AtomUID targets, state scope, finite coordinates, and no-op protection before constructing an isolated candidate. Publication is the final mutation: a child revision is inserted, its parent child set is updated, and the controlled cursor moves atomically.

Coordinate-only edits preserve `MolecularIdentity`; they create a new coordinate-bearing scientific revision. Undo and redo return retained canonical revision payloads and reproject those payloads. Undo followed by a new edit retains the previous descendant and reports ambiguous redo until a child is selected explicitly.

Presentation-only changes return `createdScientificRevision: false` and an empty stale-artifact set. Full R09 session/history persistence remains outside B1; the manifest records the object cursor, retained revision IDs, and parent map needed by that later boundary.

## 6. Multi-object and multi-state safety

- Each object has an independent history root keyed by durable ObjectID.
- A workspace selection is namespace-aware; the bounded integration adapter converts exactly one selected atom back to an object-local canonical SelectionResult before transaction execution.
- An edit scoped to object A cannot accept object B's target or mutate object B's retained root.
- Multi-state edits require `COORDINATE_STATE_ID`, `CURRENT`, `EXPLICIT_ORDINAL`, or an explicit `ALL` patch for every state. Coordinates are not cloned implicitly.
- Selection and analysis state is safely cleared or rebound after restored scientific revisions; stale overlays are filtered from rendering.

## 7. Deterministic unit coverage

`apps/web/src/editing/editFoundation.test.ts` covers the B1 T1–T18 invariants: controlled child creation, parent immutability, parent links, no publication on failure, stale base rejection, ObjectID rejection, invalid state rejection, exact undo/redo, unavailable navigation, retained branching, presentation-only behavior, invalidation categories, stable identity/lineage, multi-object history isolation, explicit multi-state scope, deterministic serialization/hash, and persistence manifest shape.

`apps/web/src/commands/commandRegistry.test.ts` also verifies typed parsing for `history`, `undo`, `redo`, and `edit_test`.

## 8. Browser/integration evidence

`tests/e2e/r07-b1-edit-history.spec.ts` passed 1/1. It proves:

```text
R0 -> edit_test -> R1 -> console undo -> R0 -> console redo -> R1
R1 -> Edit-ribbon Undo -> R0 -> Edit-ribbon Redo -> R1
```

The test loads object A and object B, targets one namespaced atom on A, verifies the application observes the child revision without reload, verifies the viewer remains one instance with two models, verifies renderer generation changes across scientific restoration, verifies no stale active selection remains bound, and verifies object B retains a one-revision root history. Browser console errors and page errors were both empty.

The focused test used an isolated API/web port pair because another checkout already owned the default local E2E ports; that other process was left untouched.

## 9. Regression and verification results

```text
npm run typecheck       PASS — API, app, web, contracts
npm run lint            PASS — API, app, web, contracts; zero warnings
npm run build           PASS — all workspaces; Vite build completed
npm test                PASS — web 19 files / 101 tests; API 2 files / 20 tests
git diff --check        PASS — no whitespace errors

Existing E2E:
  g1c-visualization     PASS — 10 / 10
  multi-object-state    PASS — 11 / 11
  selection-closure     PASS — 14 / 14
R07 B1 E2E:
  edit-history          PASS — 1 / 1
```

## 10. Deferred work

### Deferred to B2

- Full Delete Atom UI and complete remove command.
- Complete bond create/unbond commands and bond-order UI.
- Full edit panel and general selection-to-mutation UI beyond the deterministic B1 integration command.

### Deferred to B3

- `h_add`, `h_fill`, protonation, aromaticity, and advanced chemical perception.
- Attach-fragment and replace-residue chemistry workflows.
- Chemistry-specific editor validation and mutation engines.

Also outside B1 are R08 fitting/alignment commands, sessions/scenes/PSE, docking, pocket detection, and any rewrite of the existing Selection or Visualization systems.

## 11. Files changed

- `packages/contracts/src/index.ts`
- `apps/web/src/editing/editFoundation.ts`
- `apps/web/src/editing/editFoundation.test.ts`
- `apps/web/src/lucide-react.d.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/analysis/structuralAnalysis.ts`
- `apps/web/src/commands/commandRegistry.ts`
- `apps/web/src/commands/commandRegistry.test.ts`
- `apps/web/src/components/ConsolePanel.tsx`
- `apps/web/src/components/ContextToolbar.tsx`
- `apps/web/src/components/StatusBar.tsx`
- `apps/web/src/domain/registry.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `tests/e2e/r07-b1-edit-history.spec.ts`
- `package-lock.json`

## 12. Commits

```text
b42cf2f feat(edit): add canonical scientific revision foundation
6dedcd3 feat(history): wire scientific undo redo into the workstation
5e5694a test(edit): verify revision history integration invariants
```

`FINAL_SHA` below identifies the final implementation/test commit; the final documentation commit is the branch tip and is reported in the final handoff after it is created and pushed.

```text
FINAL_SHA: 5e5694a
REPORT_COMMIT: created after this report is added; exact branch tip is reported in the final handoff
WORKTREE_STATUS_AT_REPORT_CREATION: pending final documentation commit
```

## 13. Acceptance verdict

All mandatory B1 acceptance items are verified in this worktree. B2/B3 implementation was not started.
