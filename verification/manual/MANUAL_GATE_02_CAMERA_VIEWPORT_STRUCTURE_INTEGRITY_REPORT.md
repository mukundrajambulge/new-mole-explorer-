# Manual Gate 02 — Camera, Viewport, Structure Integrity & Full-Canvas Closure

## Closure metadata

| Field | Value |
|---|---|
| BASE BRANCH | `fix/r07-user-operational-closure` |
| BASE SHA | `1964784dadb436a45cd9ad7c69dba4908a04ed2c` |
| FIX BRANCH | `fix/manual-gate-02-camera-viewport-integrity` |
| FINAL CODE/EVIDENCE SHA | `112b972` |
| REPORT CLOSURE SHA | `4d083d5` |
| Scope | Camera, viewport, console overlay, structure-integrity proof, Manual Gate 02 only |

R08, alignment/RMSD, docking, coordinate mutation, fabricated bonds, and main-branch merge were not performed.

## Scientific structure integrity

The official RCSB source was fetched and independently tokenized before the camera changes were accepted:

- Source URI: `https://files.rcsb.org/download/4DJW.cif`
- Source SHA-256: `c816a3b9e947cc71bf5390b2d10aeb117f0b6a2e7b16efbba3bf4c56c8d044f2`
- Source bytes: `1,289,288`
- RCSB source atom rows: `7079`
- Canonical atoms: `7079`
- Coordinate mismatch count: `0`
- Maximum coordinate delta: `0`
- Coordinate states: `1`; source model numbers: `[1]`
- Canonical residues: `786`; modeled polymer residues: `779`; deposited polymer-sequence rows: `828`
- Chains: `9` total canonical chains; polymer chains `A/B`
- Polymer atoms: `6112`; ligand atoms: `82`; water atoms: `885`
- Canonical bounds: min `(-16.931, -21.559, -4.245)`, max `(62.903, 66.740, 94.035)`
- Canonical centroid: `(21.74200960587654, 22.472644582568122, 44.73937321655604)`

Chain-level anchors:

- Chain A: `3060` atoms, `390` polymer residues; centroid `(28.14593496732029, 5.589228104575159, 27.764827450980466)`.
- Chain B: `3052` atoms, `389` polymer residues; centroid `(15.05882798165144, 39.65027522935774, 62.18846231979041)`.

The parser’s source hash exactly matched the independently fetched source hash. No canonical coordinates, atom identities, or source-derived bonds were changed to improve presentation.

## Viewer and camera closure

| Gate | Result | Evidence |
|---|---|---|
| VIEWER FULL CANVAS | PASS | `.viewer-host` remains `inset: 0`; WebGL canvas and host retain full measured bounds under console expansion, collapse, and resize. |
| CONSOLE OVERLAY | PASS | Console is layered above the full canvas; it no longer changes the host’s physical bottom edge. |
| HORIZONTAL CUTOFF | NONE | 4DJW, 1CRN, and two-object views retain the same full horizontal host/canvas span. |
| FIT | PASS | Expanded and collapsed console, 4DJW-only, 1CRN-only, two-object, orthographic, and post-resize states. |
| CENTER | PASS | Center after pan restores the camera pan baseline; one-atom selection does not hijack global center. |
| ORIENT | PASS | Global orient operates on the current workspace-visible rendered scene. |
| RESET | PASS | Reset clears camera translation and reapplies the current workspace baseline without changing scientific revision. |
| FREE ROTATION | PASS | X/Y/diagonal pointer drags produce distinct camera quaternions; final gesture deltas are flushed synchronously. |
| ROTATION CLIPPING | PASS | Auto clipping follows the current rendered bounds and no geometry disappears during the three-angle rotation sequence. |
| ZOOM | PASS | Gesture zoom and safe-area Fit preserve the rendered scene and camera-only diagnostics. |
| AUTO CLIPPING | PASS | Camera slab diagnostics remain finite and scene-aware across camera actions. |
| 4DJW ONLY | PASS | `7079` canonical atoms; default visible workspace target `6194` (polymer + ligand). |
| 1CRN ONLY | PASS | Single-object fit and resize evidence captured. |
| TWO OBJECT VIEW | PASS | 4DJW plus 1CRN share one viewer; object count and visible target counts remain workspace-aware. |
| ONE-ATOM SELECTION CAMERA ISOLATION | PASS | `select id 1` leaves global Fit/Center/Orient/Reset targeted to the visible workspace scene. |

Global View commands now resolve the enabled, visible workspace scene, including auxiliary objects and projection category visibility. Explicit selection-targeted commands remain separate. Camera translation, pivot, viewport, safe viewport, target atom/model/object counts, and target mode are exposed in production diagnostics.

## Scientific-history and rebuild guard

| Check | Result |
|---|---|
| CAMERA CREATES SCIENTIFIC HISTORY | NO |
| CONSOLE CREATES SCIENTIFIC HISTORY | NO |
| CAMERA TRIGGERS MODEL REBUILD | NO |
| CAMERA TRIGGERS SURFACE REBUILD | NO |

The E2E camera assertions compare scientific revision, canonical atom/bond identity, renderer generation, object/model counts, and surface state before and after camera/console actions.

## Required gates

| Gate | Result |
|---|---|
| TYPECHECK | PASS — `npm run typecheck --workspace @molecular/web` |
| LINT | PASS — `npm run lint --workspace @molecular/web` |
| UNIT | PASS — `138/138` tests (`116` web, `22` API) |
| BUILD | PASS — `npm run build`; existing 3Dmol `eval` and bundle-size warnings only |
| B1 | PASS — R07 edit/history suite |
| B2 | PASS — R07 topology/edit suite |
| B3 | PASS — R07 hydrogen-picked editing suite |
| SELECTION | PASS — selection closure and live matrix suites |
| MANUAL GATE 01 | PASS — viewer performance/VDW suite |
| MANUAL GATE 02 | PASS — `1/1` test; `12/12` required screenshots |
| FULL E2E | PASS — `101/101` |
| GITHUB CI | PASS — [run 33990679280](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/33990679280) on exact tip `4d083d5` |

## Manual evidence

All twelve required screenshots were captured at the authoritative browser app and manually inspected:

`verification/evidence/manual-gate-02/`

- `01-4djw-only-fit-console-expanded.png`
- `02-4djw-only-fit-console-collapsed.png`
- `03-4djw-centered-after-pan.png`
- `04-4djw-one-atom-selection-global-center.png`
- `05-4djw-rotation-angle-1.png`
- `06-4djw-rotation-angle-2.png`
- `07-4djw-rotation-angle-3.png`
- `08-4djw-orthographic-fit.png`
- `09-1crn-only-fit.png`
- `10-two-objects-fit.png`
- `11-console-overlay-full-canvas.png`
- `12-post-resize-fit-1366x768.png`

The expanded-console screenshots intentionally show the console covering lower pixels as an overlay. The underlying WebGL canvas remains full-size; there is no physical canvas truncation or horizontal cutoff.

## Known limitations

- 3Dmol.js remains the bounded renderer and retains its existing representation limitations, surfaced by the UI.
- Console overlay pixels are visually occluded while expanded by design; camera Fit targets the safe visible region and the renderer canvas remains full-size.
- Docking, alignment/RMSD, and R08 capabilities remain out of scope.

## Promotion and user retest

USER RETEST: READY

READY TO PROMOTE TO INTEGRATION: YES

The branch is intentionally not merged into integration or main by this task. User manual approval remains required before main merge.

## Final status fields

SCIENTIFIC_STRUCTURE_INTEGRITY: PASS

COORDINATE_PARITY: PASS

VIEWER_FULL_CANVAS: PASS

CONSOLE_OVERLAY: PASS

HORIZONTAL_RENDER_CUTOFF: NONE

READY TO MERGE MAIN: NO — USER MANUAL APPROVAL REQUIRED
