# R-PYMOL-07 B2 Verification Report

## 1. Verdict and scope

**R07-B2 TOPOLOGY EDITING COMPLETE — READY FOR B3**

This report covers the bounded R-PYMOL-07 B2 slice: canonical atom deletion, incident-bond cascade, canonical bond creation, unbonding, bond-order replacement, exact selection and pick identity handling, typed command adapters, bounded Edit UI, live viewer reconciliation, existing B1 history integration, lineage, invalidation, multi-object and multi-state safety, and deterministic browser evidence.

B1 remains the authoritative foundation. B2 was implemented on a fresh worktree from the completed B1 tip. No B3 hydrogen or advanced-chemistry work was started, and R08 was not started.

## 2. Repository and Git discipline

```text
AUTHORITATIVE_REPO: https://github.com/mukundrajambulge/new-mole-explorer-
REMOTE: new-origin
LOCAL_REPO_ROOT: C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation
R07_B2_WORKTREE_ROOT: C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation-r07-b2
B2_BRANCH: feature/r07-topology-editing
R07_B2_BASE_SHA: 2e1b41e4cf0f8b045c034aaf0e037f41a60b68a6
B1_BRANCH: feature/r07-editing-foundation
B1_TIP_SHA: 2e1b41e4cf0f8b045c034aaf0e037f41a60b68a6
CODEX_A_BRANCH: fix/visualization-final-closure
CODEX_A_REMOTE_HEAD_AT_B2_START: 6829d8cf3fd9a348c2146c54fd706469bbbcb3df
CODEX_A_REMOTE_HEAD_AT_B2_FINISH: 9c4226d5ba1c2484f7fecc6ac878400aea11065d
B2_FINAL_SHA: 8549cfe1430e44192b8db07a274a0bbc5bf76d12
```

`B2_FINAL_SHA` is the final implementation/evidence tip before this report-only documentation commit. The original Codex A checkout was not edited, merged, rebased, or pushed by B2. Its remote head advanced independently during the task and is recorded above.

## 3. Authority read

- Pasted B2 task authority: `C:\Users\mukun\.codex\attachments\38c531a0-af6c-41a3-bec2-df917b35e7d6\pasted-text-1.txt`.
- Google Drive document `R-PYMOL-07 — Molecular Editing, Bonds, Hydrogens & Undo/Redo`, ID `1BQEeBRNPBl2f1MdAPWKzGq8Gx_lh0cqkAycSTbYPGYU`.
- Google Drive document `R-PYMOL-05 — Objects, Models, Coordinate States & Multi-Object Workflows`, ID `1_bpN8YtzTbqxcTJbLIf3I-Bh241rF7ykWXf4Fm0sHq4`.
- B1 report and implementation from `feature/r07-editing-foundation` at `2e1b41e4cf0f8b045c034aaf0e037f41a60b68a6`.

## 4. Canonical transaction semantics delivered

The exact B2 operation names are:

```text
EDIT_DELETE_ATOMS
EDIT_ADD_BOND
EDIT_DELETE_BOND
EDIT_REPLACE_BOND_SEMANTICS
```

All four operations use the existing B1 `ScientificHistoryService` and publish only an immutable, validated child revision.

- `EDIT_DELETE_ATOMS` removes the exact canonical AtomUID targets and cascades every incident canonical BondUID. It prunes deleted atom coordinate keys from every explicit coordinate state while preserving state order and surviving coordinates.
- `EDIT_ADD_BOND` requires two exact singleton canonical endpoints, rejects self-bonds and duplicate endpoint pairs, accepts only `SINGLE`, `DOUBLE`, `TRIPLE`, or `AROMATIC`, canonicalizes endpoint order, and assigns a deterministic new BondUID with `source: UNKNOWN`.
- `EDIT_DELETE_BOND` removes only the exact endpoint-pair bond, optionally constrained by one authoritative BondUID. Endpoint atoms remain intact; an absent bond returns `BOND_NOT_FOUND`.
- `EDIT_REPLACE_BOND_SEMANTICS` requires one existing authoritative bond, a changed supported order, and bounded valence. The old BondUID is retained in the parent revision and marked `REPLACED`; the child receives a deterministic new BondUID with `source: UNKNOWN`.
- The bounded valence guard uses explicit order weights and element ceilings. It rejects unsupported order, duplicate, self-bond, and over-valence requests without implicit-hydrogen or aromaticity inference.
- Topology scope is `ALL` explicit coordinate states. Cross-object targets, renderer indices, duplicate AtomUIDs, stale SelectionResults, empty selections, wrong objects, and invalid state scopes fail closed before history publication.

## 5. Identity, lineage, provenance, and invalidation

- Every topology edit derives a new molecular identity and scientific revision; the parent structure and parent load result remain immutable.
- Surviving AtomUIDs and BondUIDs are preserved by lineage. Deleted atoms/bonds are `RETIRED`; created bonds are `NEW`; replaced bonds have a `REPLACED` source record plus a `NEW` result record.
- Each committed revision includes operation, base/result revision IDs, object ID, transaction ID, producer metadata, identity transition, changed domains `TOPOLOGY` and `IDENTITY`, state order, and exact entity lineage.
- Topology invalidation includes topology selection, neighbor/ring/fragment analysis, contact/clash/hydrogen-bond analysis, surface and geometry caches, chemistry analysis, structural analysis, and docking-preparation artifacts.
- Stale artifact IDs include affected AtomUIDs, affected BondUIDs, replacement result BondUIDs, and the source SelectionResult ID.
- Chemistry, fragment, partial-charge, and peptide-sequence datasets are rebound to the child revision and pruned to surviving canonical IDs where applicable.

## 6. Selection and picking contract

- Console and UI adapters reuse the canonical selection engine and convert workspace-scoped IDs back to one object-local immutable SelectionResult before constructing a topology command.
- Bond commands require two exact singleton endpoint selections. Cross-object endpoint selections return `CROSS_OBJECT_TOPOLOGY_UNSUPPORTED` with no partial mutation.
- `ReverseIdentityMap.resolveBond` resolves a bond pick to stable `BondUID`, endpoint AtomUIDs, object scope, and molecular revision; a stale revision resolves to null.
- Renderer indices are never accepted as canonical IDs. The transaction checks exact SelectionResult membership and current revision identity before publication.

## 7. Viewer reconciliation and UI

- The Edit ribbon now exposes the canonical selected-atom count/object, Undo, Redo, Delete Selected, Create Bond, Delete Bond, and supported bond-order selection.
- Destructive/edit controls are disabled unless the required exact selection cardinality is present. Errors are surfaced through the existing notice/console path.
- Scientific topology revisions reconcile canonical atom specs into the mounted 3Dmol model in place. The viewer instance and model-load count remain stable; renderer generation and reverse identity bindings advance so old picks cannot commit against the child.
- Canonical atom/bond counts, AtomUIDs, bond orders, scientific revision, renderer generation, and model-load diagnostics are exposed for deterministic browser verification.

## 8. Typed console adapters

The command registry and App adapter support:

```text
remove <selection>
bond <selection1>, <selection2>[, single|double|triple|aromatic]
unbond <selection1>, <selection2>
set_bond order, <single|double|triple|aromatic>, <selection1>, <selection2>
```

Malformed arity, unsupported order, ambiguous endpoint selections, self-bonds, absent bonds, stale selections, and cross-object endpoint pairs return structured Edit errors and preserve the current workspace/history state.

## 9. Verification performed

All commands were run from `C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation-r07-b2`.

```text
npm run typecheck                         PASS
npm run lint                              PASS
npm test                                  PASS — web 19 files / 109 tests; API 2 files / 20 tests
npm run build                             PASS — API, app, web, contracts
npx playwright test --config playwright.r07b2.config.ts tests/e2e/r07-b2-topology-edit.spec.ts
                                           PASS — 4 tests
npx playwright test --config playwright.r07b2.config.ts \
  tests/e2e/g1c-visualization.spec.ts \
  tests/e2e/selection-closure.spec.ts \
  tests/e2e/multi-object-state.spec.ts \
  tests/e2e/r07-b1-edit-history.spec.ts
                                           PASS — 36 tests
```

Focused B2 unit coverage includes 14 edit-foundation tests, typed command parsing, stable bond picking, exact delete cascade, every-state pruning, empty/ambiguous/missing/cross-object rejection, supported/unsupported/duplicate/self/over-valence bond creation, exact unbonding, order replacement, invalidation, stale selection rejection, topology undo/redo, branch retention, and object isolation.

The pre-existing presentation-dependent selector test received only a timeout-budget correction from 30 seconds to 60 seconds because it performs eleven sequential console actions; its final browser run passed in 22.2 seconds.

## 10. Browser evidence

- `verification/evidence/r07-b2/delete-selected.png` — Edit UI deletion, canonical count/bond cascade, unchanged model-load count, and live viewer state.
- `verification/evidence/r07-b2/bond-order-replacement.png` — console bond/unbond/set_bond flow and canonical order replacement.
- The four B2 browser tests also verify self-bond rejection, cross-object atomic rejection, multistate deletion/state switching, and exact undo/redo.

## 11. PyMOL and deferred scope

PyMOL oracle status: **NOT RUN / ORACLE PENDING**. No external PyMOL process or Python chemistry oracle was available or executed for this B2 task. Verification is against the repository’s canonical model, existing B1 history service, selection engine, and 3Dmol adapter.

Explicitly deferred to B3: add/remove hydrogens, implicit-hydrogen recomputation, advanced valence/perception, chemistry normalization beyond the bounded valence guard, fragment attachment, atom replacement, and any broader chemical editing UI. R08 docking was not started.

## 12. Commits and final state

```text
b46349b  feat(r07): add canonical topology editing transactions
12386f3  feat(r07): expose bounded topology editing UI
8549cfe  test(r07): add topology editing verification evidence
```

The B2 branch was pushed to `new-origin/feature/r07-topology-editing`. The worktree is clean after the report commit, and the task stops here before B3.
