# MOLEXPLORER FINAL PYMOL MANUAL ACCEPTANCE CAMPAIGN

## Campaign result

**Codex consolidated manual campaign: PASS**  
**User final manual approval: PENDING — ready for user final retest**

The real Molexplorer workstation was launched at `http://localhost:3101/molstudio` on the acceptance branch. The campaign used 4DJW as the canonical RCSB fixture (7,079 atoms), the local deterministic fixtures, and Chromium at a 1440×900 observation size. Manual browser inspection covered boot, full-canvas console overlay, 4DJW Cartoon, protein Stick and Ball-and-Stick, VDW, Mesh, residue selection, selection overlays, camera controls, and the historical representation/color failures. A concrete layout defect and a surface-material regression were fixed and manually retested.

## Repository and environment

| Field | Value |
|---|---|
| Repository | `C:\Users\mukun\Desktop\molecular-workstation` |
| Remote | `https://github.com/mukundrajambulge/new-mole-explorer-.git` |
| Base branch | `feature/r10-canonical-command-environment` |
| Base SHA | `617da648edd06c0cb6dc0632b57a9a2645d88bdc` |
| Acceptance branch | `fix/final-pymol-manual-acceptance` |
| App URL | `http://localhost:3101/molstudio` |
| Node | `v24.14.1` |
| Playwright | `1.62.1` |
| Browser | Chromium |
| Date | 2026-09-08 |

## Fixes made in this campaign

1. The app grid now reserves an explicit row for the scene manager, preventing scene controls from being clipped below the workspace. Canonical active-object and selection ownership text now wraps within the sidebar.
2. Selection emphasis now reapplies the complete surface material, including `wireframe` and `wireframeLinewidth`, so Mesh remains a mesh after selection highlighting is applied or cleared.

The surface behavior is covered by `apps/web/src/rendering/surfaceMaterial.test.ts`; the integrated acceptance paths are covered by `tests/e2e/final-pymol-acceptance.spec.ts`.

## Functional acceptance matrix

| Area | Status | Evidence |
|---|---|---|
| Application boot and workspace | PASS | `01-app-loaded.png` |
| Multi-object loading and identity | PASS | `16-multi-object.png` |
| R01–R06 visualization and global representations | PASS | `02-4djw-cartoon.png`, `04-protein-stick.png`, `05-protein-ball-stick.png` |
| Ligand representation and independent color | PASS | `03-ligand-custom-color.png`, `10-ligand-selection.png` |
| Visibility and component targeting | PASS | full E2E and `manual-gate-03b-selection` evidence |
| Camera, Fit, Center, Orient | PASS | `14-orthographic.png`, `15-perspective.png` |
| Console full-canvas behavior | PASS | `13-console-overlay-full-canvas.png` |
| Rotation/zoom and surface performance | PASS | Gate 01 and Gate 02 E2E |
| VDW / Surface / Mesh | PASS | `06-vdw-surface.png`, `07-mesh.png` |
| Labels and safe custom labels | PASS | `17-labels.png` |
| Gate 03B selection semantics and visual UX | PASS | `08-residue-selection-focus.png`, `09-chain-selection.png`, `12-selection-clear-restored.png` |
| Measurements | PASS | inherited V-FINAL and interaction closure suites |
| R07 editing and exact undo/redo | PASS | `19-edit-before.png` through `22-edit-redo.png` |
| R08 RMSD / Fit / Align / alignment object | PASS | `23-r08-alignment.png`, `24-r08-alignment-overlay.png` |
| R09 import / save / restore / scenes / export | PASS | `25-scene-a.png` through `28-export.png` |
| R10 safe console / settings / security | PASS | `29-command-console.png`, `31-security-rejection.png` |
| GUI / console / REST / SDK convergence | PASS | release R10 suites and full E2E |
| Safe macro / batch bounds | PASS | API and R10 regression suites |
| Command history / provenance | PASS | R07/R09/R10 suites |
| Cross-feature workflow | PASS | `32-final-cross-feature-workspace.png` |

## Historical defects A–O

All 15 historical defects were deliberately classified as PASS. The complete matrix with reproduction steps, regression tests, and evidence links is in [HISTORICAL_USER_DEFECT_RETEST.md](./HISTORICAL_USER_DEFECT_RETEST.md).

## Automated verification

- API: **56/56 PASS**
- Web: **138/138 PASS**
- Lint: **PASS**
- Typecheck: **PASS**
- Build: **PASS**
- Full hosted E2E: **118/118 PASS**
- Final focused acceptance E2E: **3/3 PASS**, repeated **3 consecutive runs**
- Gate 01, Gate 02, Gate 03B, R07, R08, R09, and R10 regressions: **PASS**
- GitHub CI on the verified R10 base tip: **PASS** ([run 34115885809](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/34115885809))

## Scientific and lifecycle integrity

The canonical backend structure remains the scientific authority. Presentation changes did not change canonical atom counts or scientific revision state. Selection overlays use stable canonical identities. Camera actions remain presentation-only. R07 edits create exact retained revisions and undo/redo restores those revisions. R08 analysis results are bound to their input state and become stale after coordinate edits. R09 sessions and scenes preserve object identity and presentation state. R10 rejects host-language, shell, arbitrary filesystem, and arbitrary network execution before dispatch.

## Bounded limitations

- Pinned executable PyMOL oracle: **ORACLE_PENDING**; verified executable conformance: **NO**.
- PSE/PZE: **UNAVAILABLE**.
- CEALIGN: **UNSUPPORTED**.
- Docking execution: **NOT IMPLEMENTED IN R10; NOT STARTED**.
- HTS execution: **NOT IMPLEMENTED IN R10; NOT STARTED**.

These are declared bounded capabilities, not acceptance defects.

## Approval and next step

`R07 USER APPROVAL: DEFERRED — CONSOLIDATED USER RETEST PENDING`  
`R08 USER APPROVAL: DEFERRED — CONSOLIDATED USER RETEST PENDING`  
`R09 USER APPROVAL: DEFERRED — CONSOLIDATED USER RETEST PENDING`  
`R10 USER APPROVAL: PENDING`

No main merge was performed. No docking or HTS work was started. The branch is ready for the user’s final manual retest and remains **not ready to merge main** or begin docking.
