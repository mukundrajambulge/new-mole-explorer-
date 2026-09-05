# MOLEXPLORER R07 USER-OPERATIONAL CLOSURE REPORT

## Scope and disposition

This report records the bounded R07 closure on the authoritative local repository. The work stays on the existing B1+B2+B3 integration line plus the accepted Manual Gate 01 viewer baseline. No R08, alignment/RMSD, docking, main-branch merge, or broad UI redesign was started.

| Item | Value |
| --- | --- |
| Repository | `https://github.com/mukundrajambulge/new-mole-explorer-.git` |
| Authoritative checkout | `C:\Users\mukun\Desktop\molecular-workstation` |
| Fix branch | `fix/r07-user-operational-closure` |
| Verified base branch | `integration/r07-b1-b3` |
| Verified base SHA | `aa6100a0b5f474433d7ec1355495a39655f0fd06` |
| Final implementation SHA | `a82af43c2e0e5346778bd5e14f3f4091f2699bab` |
| Manual approval | Required before any main merge |

## Root causes

### Object ON/OFF

The workspace toggle changed the object `enabled` flag but did not consistently dirty/reproject the mounted scene, retire object-scoped surface handles, or invalidate an interaction target that belonged to the object being turned OFF. The closure routes UI and `enable`/`disable` through one workspace operation, preserves the canonical object and history root, reprojects enabled objects, and rejects disabled-object picks/edits.

### User selection/object-name mismatch

The user query used `mini-protein.pdb` while the loaded real workspace contained `4DJW.cif` and `1CRN.cif`. The application now accepts durable object IDs, canonical structure IDs, current display names, and filename-stem aliases in object resolution; the initially loaded display name is the source original filename, so `4DJW.cif`, `4DJW`, `1CRN.cif`, and `1CRN` resolve the real objects. An unloaded `object ...` predicate now returns `OBJECT_NOT_FOUND` with the loaded-name diagnostic instead of a silent valid-empty result.

### History/Undo/Redo operational behavior

The scientific history service was present, but the user-facing workflow did not reliably preserve canonical picked targets or expose active-object/edit-readiness state. The closure keeps the canonical `PickResult`, binds edit commands to the active object's current revision, registers a root for every loaded object, clears stale/OFF targets, and renders history cursor plus Undo/Redo state in the Edit ribbon and status bar. UI Undo/Redo and console `undo`/`redo` use the same `ScientificHistoryService`.

### Why the previous 90/90 suite missed this

The previous tests were heavily fixture-specific and covered many console/service paths without proving the complete real-user chain. They did not collectively verify real RCSB object names, mounted object visibility, actual canvas pointer input, button enablement, all B3 ribbon actions, missing-object diagnostics, or command/UI convergence. The existing tests were retained; this closure adds a dedicated browser suite that exercises those gaps.

## B1 complete matrix

| Invariant | Evidence | Result |
| --- | --- | --- |
| Root revision exists immediately after load | Closure UI suite; `history` returns `retainedRevisionCount:1` | PASS |
| Successful edit creates one child | `edit_test`, topology, and chemistry workflows | PASS |
| Failed edit creates no node | self-bond and invalid-target assertions; unit edit-foundation tests | PASS |
| Exact Undo restores retained parent | UI and console workflows | PASS |
| Exact Redo restores retained child | UI and console workflows | PASS |
| Multiple revisions | multi-revision history closure test | PASS |
| Undo → different edit branch semantics | closure branch-after-undo test; redo becomes unavailable/ambiguous | PASS |
| Object A history isolated from B | deterministic two-object and real 4DJW/1CRN focus/history checks | PASS |
| Presentation-only actions create no history | existing visualization/camera E2E and closure visibility checks | PASS |
| Camera rotation/zoom creates no scientific revision | Manual Gate 01 and camera regression E2E | PASS |
| Visibility ON/OFF creates no scientific revision | closure root revision remains unchanged across UI and console toggles | PASS |
| Selection creates no scientific revision | selection closure and history root checks | PASS |
| Stale selection cannot edit a later revision | stale identity unit/E2E guards and edit readiness state | PASS |
| Viewer follows restored topology/coordinates | renderer generation/canonical count assertions | PASS |
| History UI agrees with service state | status attributes and command `history` assertions | PASS |

## B2 complete matrix

| Capability | Evidence | Result |
| --- | --- | --- |
| Delete Selected UI | Edit ribbon, canonical atom/bond counts, selection clear | PASS |
| `remove <selection>` command | existing R07-B2 E2E and closure failure/branch checks | PASS |
| Create Bond UI | two exact endpoints, canonical bond count/order | PASS |
| `bond` command | existing R07-B2 E2E for supported orders | PASS |
| Delete Bond UI | closure UI test, exact endpoint selection, Undo/Redo | PASS |
| `unbond` command | existing R07-B2 E2E | PASS |
| Bond order UI: SINGLE/DOUBLE/TRIPLE/AROMATIC | closure UI loop over all supported orders | PASS |
| `set_bond` command | existing R07-B2 E2E | PASS |
| Self-bond rejection | `SELF_BOND`; revision/counts unchanged | PASS |
| Cross-object rejection | `CROSS_OBJECT_TOPOLOGY_UNSUPPORTED`; no partial success | PASS |
| Ambiguous/stale topology target rejection | canonical edit validation and stale identity tests | PASS |
| Multi-state topology semantics | existing multi-state B2 E2E | PASS |
| Exact topology Undo/Redo | UI and console count/revision assertions | PASS |

## B3 complete matrix

| Capability | Evidence | Result |
| --- | --- | --- |
| Add Hydrogens UI | closure UI and picked-atom UI; canonical child/count | PASS |
| `h_add <selection>` | existing R07-B3 console E2E | PASS |
| Ambiguous/unsupported chemistry rejection | edit-foundation and chemistry unit coverage; no partial publish | PASS |
| `h_fill <selection>` | existing R07-B3 console E2E | PASS |
| Refill H UI | explicit-H fixture through Edit ribbon | PASS |
| Remove Explicit H UI | Edit ribbon, heavy-atom preservation/count assertion | PASS |
| Attach Atom UI | deterministic topology fixture through Edit ribbon | PASS |
| `attach` command | existing R07-B3 console E2E | PASS |
| Replace Atom UI | Edit ribbon; replacement is a new canonical identity | PASS |
| Picked-atom Add/Refill/Attach/Replace | actual `page.mouse` canvas clicks followed by each UI action | PASS |
| Picked-bond path where applicable | canonical `BondUID` resolver and bond-target validation exist; no 3Dmol bond-click callback is exposed | BLOCKED — adapter contract is atom-callback only |
| Stale pick rejection | generation/revision checks and pick unit coverage | PASS |
| Multi-state hydrogen edit | multistate fixture, both states, UI Undo/Redo | PASS |
| Identity lineage | edit-foundation lineage tests and replacement invariants | PASS |
| Exact chemistry Undo/Redo | UI/console tests and retained revision checks | PASS |

## Real 4DJW/1CRN matrix

| Workflow | Result |
| --- | --- |
| File → Fetch `4DJW` through the real backend | PASS — resolved as `4DJW.cif`; 7,079 atoms, 786 residues, 9 chains |
| RCSB Add `1CRN` into the same workspace | PASS — resolved as `1CRN.cif`; 327 atoms, 46 residues, 1 chain |
| Two distinct object IDs and one mounted viewer with two models | PASS |
| Focus 4DJW and report its root history | PASS |
| `object 4DJW.cif and id 1` | PASS |
| Focus 1CRN and report its independent root history | PASS |
| `object 1CRN.cif and id 1` | PASS |
| Disable/enable one object without affecting the other | PASS — native browser and automated UI |
| Renderer remains populated and active object is visible | PASS |

## UI/command equivalence matrix

| Operation | UI path | Console path | Result |
| --- | --- | --- | --- |
| Object visibility | row Disable/Enable | `disable`/`enable` actual object name | PASS — same workspace state and unchanged scientific root |
| History root/status | Edit ribbon/status bar | `history` | PASS — UI attributes agree with service response |
| Undo | Edit → Undo | `undo` | PASS — same cursor and canonical revision restoration |
| Redo | Edit → Redo | `redo` | PASS — same cursor and canonical revision restoration |
| Delete atoms | Edit → Delete Selected | `remove` | PASS |
| Create/delete/order bond | Edit bond controls | `bond`, `unbond`, `set_bond` | PASS |
| Add/refill/remove H | Edit chemistry controls | `h_add`, `h_fill`, `h_remove` where implemented | PASS |
| Attach atom | Edit → Attach Atom | `attach` | PASS |
| Replace atom | Edit → Replace Atom | canonical edit service path | PASS |

## Workspace, selection, and safety matrix

| Required check | Result |
| --- | --- |
| Replace/open one structure | PASS |
| Add a second structure | PASS |
| Focus A/B | PASS |
| ON/OFF A and ON/OFF B | PASS |
| Command enable/disable | PASS |
| No scientific revision from visibility | PASS |
| Simple active-object selection | PASS |
| Object-qualified selection and filename stem | PASS |
| Real fetched object name | PASS |
| Nonexistent object diagnostic | PASS |
| Multi-object stable identity | PASS |
| Canvas atom pick | PASS |
| Clear/unpick/background semantics | PASS |
| Stale selection and pick | PASS |

## Viewer regression matrix

The accepted Manual Gate 01 and existing visualization suites remain green. Rotation, zoom, camera actions, VDW, representations, ligand color, surfaces, labels, and projection switching are covered by the existing browser/unit gates. The R07 changes keep camera actions, visibility toggles, and presentation updates out of scientific history; model-load and surface-generation invariants remain asserted.

| Viewer item | Result |
| --- | --- |
| Rotation and zoom | PASS |
| VDW and surface visibility | PASS |
| Representations | PASS |
| Ligand color | PASS |
| Surfaces and cache behavior | PASS |
| Labels | PASS |
| Camera/history separation | PASS |

## Tests added and verification

- Strengthened `tests/e2e/r07-user-operational-closure.spec.ts` to 10 browser tests covering object visibility, real names, missing-object diagnostics, root and multi-revision history, branch-after-undo, all B2 UI bond operations, multi-state B3 UI, actual canvas picking, all four picked-atom chemistry actions, and real 4DJW/1CRN loading.
- Added the `OBJECT_NOT_FOUND` selection diagnostic and updated the selection unit regression to assert structured failure rather than silent empty success.
- Existing R07 tests were retained.

| Gate | Result |
| --- | --- |
| Typecheck | PASS — `npm run typecheck` |
| Lint | PASS — `npm run lint` |
| Unit | PASS — web 116/116 and API 22/22; 138/138 total |
| Build | PASS — `npm run build` |
| Focused operational repeatability | PASS — 3 consecutive runs, 10/10 each; 30/30 |
| Full E2E | PASS — 100/100 tests in 18 files |
| Historical evidence preservation | PASS — generated non-closure fixtures restored; 17 closure images retained |
| GitHub CI | Pending exact final documentation tip at report push; implementation SHA exact-head run previously passed |
| PyMOL oracle | ORACLE_PENDING — no independent executable PyMOL oracle was available/run |

## Evidence

The 17 requested closure screenshots are under [`verification/evidence/r07-operational-closure`](../evidence/r07-operational-closure/):

`01-two-real-objects.png`, `02-object-a-off.png`, `03-object-b-off.png`, `04-real-object-selection.png`, `05-history-root.png`, `06-history-after-edit.png`, `07-undo.png`, `08-redo.png`, `09-b2-delete-selected.png`, `10-b2-bond.png`, `11-b3-add-h.png`, `12-b3-refill-h.png`, `13-b3-remove-h.png`, `14-b3-attach.png`, `15-b3-replace.png`, `16-picked-edit.png`, and `17-object-isolation.png`.

The executable closure coverage is [`r07-user-operational-closure.spec.ts`](../../tests/e2e/r07-user-operational-closure.spec.ts). The current local application is launchable at `http://localhost:3101/molstudio`.

## Known limitations

1. PyMOL independent-oracle comparison was not run; status is `ORACLE_PENDING`.
2. The current 3Dmol adapter exposes real atom picking with canonical reverse identity, but does not expose a renderer bond-click callback. Canonical BondUID resolution and bond-target validation are implemented and tested; a real picked-bond UI workflow remains explicitly blocked by that adapter capability boundary.

The branch is ready for the requested user-manual R07 retest, not for automatic merge to main.

`READY TO MERGE MAIN:`

`NO — USER FULL R07 MANUAL APPROVAL REQUIRED`
