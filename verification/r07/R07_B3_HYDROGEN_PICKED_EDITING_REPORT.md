# R-PYMOL-07 B3 Verification Report

## Verdict

**R07-B3 HYDROGEN + PICKED EDITING COMPLETE — READY FOR B1+B2+B3 INTEGRATION**

This report covers the bounded B3 slice: explicit hydrogen addition, atomic local hydrogen refill, explicit-H removal, picked-target freshness validation, atom attachment, atom replacement with identity lineage, multistate scope, chemistry policy/provenance, viewer reprojection, and exact retained-revision undo/redo. No merge to `main` or the visualization branch was performed. R08/docking was not started.

## Repository and authority

```text
AUTHORITATIVE_REPO: https://github.com/mukundrajambulge/new-mole-explorer-
REMOTE: new-origin
LOCAL_REPO_ROOT: C:\Users\mukun\Desktop\molecular-workstation
B3_BRANCH: feature/r07-hydrogen-picked-editing
B3_WORKTREE_MODE: single Desktop checkout; no worktree
B2_BASE_SHA: 6a1018d95f0613ca2275394ea956cbac6b3cb334
B3_IMPLEMENTATION_SHA: bb2ce66
```

Before implementation, the authoritative Google Drive document `R-PYMOL-07 — Molecular Editing, Bonds, Hydrogens & Undo/Redo` (ID `1BQEeBRNPBl2f1MdAPWKzGq8Gx_lh0cqkAycSTbYPGYU`) was read in full. The B1 and B2 reports were read from the live B2 branch before modification.

## Delivered canonical behavior

- `EDIT_ADD_HYDROGENS` uses a bounded explicit-valence policy for supported C/N/O targets, declared aromatic bond semantics, preserved formal charge, deterministic local-frame coordinates, new AtomUIDs and explicit single BondUIDs.
- `EDIT_REFILL_HYDROGENS` stages removal of the target’s existing local explicit H atoms and H bonds, recalculates replacement H, validates the complete candidate, and publishes exactly one child revision. Failure returns before publication, so no intermediate dehydrogenated revision is observable.
- `EDIT_REMOVE_HYDROGENS` removes exact selected H atoms or local H attached to selected parent atoms and is reusable by later editing stages.
- `EDIT_ADD_ATOM_AND_BOND` / `EDIT_ATTACH_FRAGMENT` attach one explicitly specified element to one exact parent AtomUID with explicit bond order, valence, geometry/placement provenance, and per-state coordinates.
- `EDIT_REPLACE_ATOM` retires the old AtomUID, mints a NEW replacement AtomUID, records an explicit replacement relation, replaces affected bond identities under lineage, and optionally refills H atomically.
- `HydrogenAdditionPolicy` records policy ID, implementation/version, compatibility profile, target revision/selection/pick, state scope, valence model, declared aromaticity/perception, formal-charge and stereochemistry policies, placement algorithm/version, fail-closed unsupported-chemistry policy, and legacy mode.
- Picks are checked against structure/revision, coordinate context, object scope, target identity, and optional expected renderer generation. Stale renderer generation/revision, cross-object, background, ambiguous, missing, and retired identities fail closed.
- Multi-state identity edits require explicit `ALL` scope and compute coordinates independently per state; no coordinate cloning is used.
- Every successful edit is retained by `ScientificHistoryService`; undo/redo navigates the exact retained revision. The existing invalidation manifest is extended to topology, identity, chemistry, geometry, analysis, surface, and docking-preparation categories.

## Acceptance matrix

| Acceptance | Result | Evidence |
|---|---|---|
| AT-R07-17 | PASS | C/N/O bounded fixture adds expected H counts |
| AT-R07-18 | PASS | Every new H has a NEW AtomUID and explicit canonical bond |
| AT-R07-19 | PASS | Policy captures valence, aromaticity/perception, and placement versions |
| AT-R07-20 | PASS | Ambiguous carboxylate protonation returns `CHEMISTRY_AMBIGUOUS` before publication |
| AT-R07-21 | PASS | Aromatic fixture uses declared topology/aromaticity state |
| AT-R07-22 | PASS | Refill retires old local H identities and mints replacements atomically |
| AT-R07-23 | PASS | Refill failure leaves retained history at the parent; no intermediate node |
| AT-R07-24 | PASS | Attach produces one explicit atom+bond with placement/geometry provenance |
| AT-R07-25 | PASS | Replace records old RETIRED, replacement NEW, and explicit REPLACED lineage |
| AT-R07-26 | PASS | Stale renderer generation and stale molecular revision picks are rejected |
| AT-R07-27 | PASS | Multi-state non-ALL scope fails; ALL scope writes every state independently |
| AT-R07-28 | PASS | Real viewer reconciles child atom/bond counts, advances renderer generation, and preserves model-load count |

## UI and command adapters

The Edit ribbon exposes Undo, Redo, Delete Selected, Create Bond, Delete Bond, Add Hydrogens, Refill H, Remove Explicit H, Attach Atom, Replace Atom, and bond-order controls. Invalid cardinalities are disabled and chemistry failures surface through the existing notice/console path.

The bounded console verbs are:

```text
h_add <selection>
h_fill <selection>
h_remove <selection>
attach <element>, <selection>
replace <element>, <selection>
```

The existing B1/B2 commands remain available unchanged.

## Verification performed

```text
npm run typecheck                  PASS
npm run lint                       PASS
npm test                            PASS — web 20 files / 115 tests; API 2 files / 20 tests
npm run build                       PASS — API, app, web, contracts
npx playwright test B1+B2+B3       PASS — 7 tests
npx playwright test (complete)     83 passed / 6 failed outside B3
```

The six complete-suite failures are pre-existing presentation/camera/surface checks outside the B3 change set: one stale toolbar text expectation (`Delete atom`), label/cardinality projection timing, camera projection timing, and surface-generation timing. They reproduce without touching B3 paths; all B1, B2, and B3 browser tests pass. Legacy evidence regenerated by the suite was restored; only B3 evidence is added by this branch.

Focused B3 unit coverage is in `apps/web/src/editing/hydrogenPickedEditing.test.ts` (6 tests). Focused browser coverage is in `tests/e2e/r07-b3-hydrogen-picked-editing.spec.ts` (2 tests), using `tests/fixtures/r07-b3-explicit-h.pdb`.

## Browser evidence

- `verification/evidence/r07-b3/hydrogen-addition.png` — live viewer after `h_add`, canonical count increase, renderer generation reconciliation, and unchanged renderer model-load count.
- `verification/evidence/r07-b3/hydrogen-refill.png` — live viewer after atomic `h_fill` with explicit-H replacement.
- Manual CUA verification on the running localhost app loaded the B2 topology fixture, committed `h_add id 1`, selected an exact atom, committed the Add Hydrogens toolbar action, and committed `attach O, id 3`; the visible console showed committed child revisions and the viewer showed 7, 9, and 10 atoms respectively.

## PyMOL oracle and deferred scope

PyMOL oracle status: **ORACLE_PENDING / NOT RUN**. The research pin is `schrodinger/pymol-open-source@5e8bf...`, but no executable pinned PyMOL oracle was available in this environment. The bounded implementation does not claim exact PyMOL conformance; it claims the explicit R07-B3 policy and repository acceptance behavior above.

R08 docking and broader chemistry/perception, tautomer/protonation inference, advanced stereochemistry rewriting, and unrestricted fragment chemistry remain deferred.

## Final state

The implementation and evidence are committed as `bb2ce66` on `feature/r07-hydrogen-picked-editing`. The branch is ready to push and for separate B1+B2+B3 integration review; this task does not perform that integration.
