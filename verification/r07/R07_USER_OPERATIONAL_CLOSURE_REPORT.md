# MOLEXPLORER R07 USER-OPERATIONAL CLOSURE REPORT

## Scope and disposition

This report closes the requested R07 user-operational gap on the authoritative local repository. The work is limited to the existing B1+B2+B3 integration line plus the Manual Gate 01 baseline. No R08, alignment/RMSD, docking, main-branch merge, or broad redesign work was started.

| Item | Value |
| --- | --- |
| Repository | `https://github.com/mukundrajambulge/new-mole-explorer-.git` |
| Authoritative checkout | `C:\Users\mukun\Desktop\molecular-workstation` |
| Closure branch | `fix/r07-user-operational-closure` |
| Verified base branch | `integration/r07-b1-b3` |
| Verified base SHA | `aa6100a0b5f474433d7ec1355495a39655f0fd06` |
| Implementation/evidence commit | `c9c8c71820f40cef3947e843b5250698a8942cab` |
| Manual approval | Required before any main merge |

The branch was created from the verified integration tip with a clean worktree. Existing R07 reports and historical evidence were not rewritten.

## What was closed

- Object ON/OFF now changes the mounted scene, reprojects enabled objects, retires disabled-object surface handles, and clears selection/pick state that would otherwise target an OFF object. The same path is used by the object UI and `enable`/`disable` console commands.
- The active object, durable object ID, enabled state, scientific revision, history cursor, and edit readiness are visible in the UI. Invalid, stale, missing, or OFF targets produce user-facing diagnostics and disable the relevant edit controls.
- Canvas picks preserve the canonical `PickResult` through selection state. Renderer index/serial fallbacks were removed from reverse identity resolution; a canonical stable atom ID is required, with canonical object ID used for workspace disambiguation.
- Real object names are addressable with their filename stems (`4DJW` resolves `4DJW.cif`) while durable object IDs remain available for ambiguous cases. Namespaced multi-object selection IDs are normalized before inspection.
- A dedicated browser suite exercises the real Edit ribbon controls for B2 and B3, not only console/internal paths, and includes actual `page.mouse` canvas clicks.

## Acceptance matrix

| R07 area | User path exercised | Result |
| --- | --- | --- |
| B1 object scope | Load two objects; inspect real names; focus active object; toggle each ON/OFF; verify the other object remains isolated | PASS |
| B1 stale state | Disable the selected/active object; verify selection/pick is cleared or rejected and Edit actions are unavailable | PASS |
| B1 history root | Load fixture; show root revision and `canUndo=false` in the UI | PASS |
| B1 history controls | Run a scientific edit; use Edit → Undo and Edit → Redo; verify exact cursor transitions | PASS |
| B2 delete | UI Edit → Delete Selected; verify canonical atom/bond counts and mounted viewer state | PASS |
| B2 topology | UI Edit → Create Bond; verify canonical bond count and history-backed state | PASS |
| B3 add | UI Edit → Add Hydrogens; verify canonical child revision and rendered state | PASS |
| B3 refill | UI Edit → Refill Hydrogens; verify retired explicit H identities and exact undo | PASS |
| B3 remove | UI Edit → Remove Explicit H; verify canonical count | PASS |
| B3 attach/replace | UI Edit → Attach Atom and Replace Atom; verify canonical counts and mounted projection | PASS |
| Picking | Actual canvas pointer sweep resolves a canonical atom and exposes inspector/edit readiness | PASS |

## Real-structure closure

The browser workflow fetched official backend mmCIF `4DJW` and added official backend mmCIF `1CRN` in one workspace.

- `4DJW.cif`: 7,079 atoms, 786 residues, 9 chains; active object and name-addressable selection verified.
- `1CRN.cif`: 327 atoms, 46 residues, 1 chain; second object remained independently addressable.
- Native browser validation at `http://localhost:3101/molstudio` used the real File → Fetch/Add controls, then real Disable/Enable and Focus controls. The resulting page showed both named objects and a rendered molecular projection; disabling 1CRN left 4DJW visible and re-enabling/focusing 4DJW restored the expected active state.

## Verification gates

| Gate | Result | Evidence/command |
| --- | --- | --- |
| Typecheck | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint` |
| Unit tests | PASS | Web: 116 tests; API: 22 tests; 138 total |
| Build | PASS | `npm run build` |
| Focused operational suite | PASS | `tests/e2e/r07-user-operational-closure.spec.ts`: 6/6, repeated 3/3 (18/18) |
| Playwright denominator | PASS | 96 tests in 18 files listed |
| Full E2E | PASS | 96/96 in 10.4 minutes |
| Historical evidence preservation | PASS | Existing tracked evidence restored after test-run screenshot refresh; only the new closure evidence was retained |
| PyMOL oracle | PENDING | No independent executable PyMOL oracle comparison was run in this gate; the bounded 3Dmol profiles remain explicitly labelled |

The full CI workflow is `molecular-workstation-ci` and runs lint, typecheck, unit, build, and E2E verification. The implementation commit’s exact-head run passed: [GitHub Actions run 33959159602](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/33959159602). The final documentation tip is rechecked after this report is pushed.

## Evidence manifest

All new screenshots are under [`verification/evidence/r07-operational-closure`](../evidence/r07-operational-closure/):

1. `01-two-real-objects.png`
2. `02-object-a-off.png`
3. `03-object-b-off.png`
4. `04-real-object-selection.png`
5. `05-history-root.png`
6. `06-history-after-edit.png`
7. `07-undo.png`
8. `08-redo.png`
9. `09-b2-delete-selected.png`
10. `10-b2-bond.png`
11. `11-b3-add-h.png`
12. `12-b3-refill-h.png`
13. `13-b3-remove-h.png`
14. `14-b3-attach.png`
15. `15-b3-replace.png`
16. `16-picked-edit.png`
17. `17-object-isolation.png`

The executable coverage is [`r07-user-operational-closure.spec.ts`](../../tests/e2e/r07-user-operational-closure.spec.ts).

## Release disposition

The closure branch is pushed and launchable at `http://localhost:3101/molstudio`. It is ready for the requested user-manual B1/B2/B3 approval pass, but not approved for merge to `main`.

`READY TO MERGE MAIN:`

`NO — USER FULL R07 MANUAL APPROVAL REQUIRED`
