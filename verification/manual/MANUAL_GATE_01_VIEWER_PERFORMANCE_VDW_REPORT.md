# Manual Gate 01 — Viewer Performance, View Response, and Van der Waals Surface

## Scope

This report records the manual gate fix for the MolExplorer interactive viewer. The validation target was a clean 4DJW load at /molstudio, with native 3Dmol camera interaction, deterministic View controls, and a visible asynchronous Van der Waals surface.

## Repository and commits

| Item | Value |
|---|---|
| Base branch | integration/r07-b1-b3 |
| Base SHA | f85ddc037fde123f52cf8a3b1f8ff3d0aac70891 |
| Fix branch | fix/manual-gate-viewer-performance-vdw |
| Fix/source SHA | 7fbcf36d492793b64bf868aaa0da86c0f3af6b0c |
| Remote | https://github.com/mukundrajambulge/new-mole-explorer-.git |
| GitHub workflow | [molecular-workstation-ci run 33951179986](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/33951179986) |

The fix is isolated to the dedicated branch. No integration or main branch was modified, and no R08 or docking work was included.

## Reproduced root causes

### Rotation and zoom lag

The camera path called automatic clipping recalculation on pointer-driven camera updates. That recalculation scanned the rendered atom set even though quaternion and zoom changes do not change the canonical molecular bounds or pivot. Camera-only workspace synchronization also fell through the full model, surface, and picking reconciliation path.

### Delayed or non-deterministic View response

Any workspace projection update could trigger model styling, auxiliary model rendering, surface reconciliation, picking rebinding, and a render. In the large 4DJW path, the visible projection state could also advance before the authoritative active workspace object was synchronized, allowing the adapter to observe the previous projection for a render cycle.

### Blank Van der Waals Surface

The top-level projection could show Van der Waals Surface while the authoritative 4DJW workspace object still carried the Cartoon presentation. The adapter therefore had no surface directive or surface handle: surface state remained idle, surface generation remained 0, and the cartoon model stayed visible. This was a projection-authority and surface-materialization defect, not a molecule-data defect.

## Files changed

- apps/web/src/App.tsx — synchronizes the active workspace object’s projection in a layout effect, before canvas effects observe the workspace.
- apps/web/src/rendering/ThreeDMolViewerAdapter.ts — isolates camera-only updates, removes per-frame atom scanning, makes workspace surface ownership authoritative, and adds guarded fallback/ready tracking for asynchronous surfaces.
- tests/e2e/manual-gate-01-viewer.spec.ts — adds deterministic regression coverage for 4DJW VDW, View, camera isolation, stale transitions, and evidence capture.
- verification/evidence/manual-gate-01/vdw-surface-visible.png — VDW surface after clean 4DJW load.
- verification/evidence/manual-gate-01/vdw-after-rotation.png — VDW surface after native camera rotation.
- verification/evidence/manual-gate-01/view-orthographic.png — deterministic Orthographic View result.

## Architecture change

Before the fix, a native camera gesture could enter React/workspace synchronization, rescan atoms for clipping, restyle models, reconcile surfaces, rebind picking, and render. Projection updates used the same broad path, and surface directives could lag the visible global projection.

After the fix:

1. Native 3Dmol gestures remain native. The adapter’s camera render path updates the camera/background and renders without rebuilding molecular models or surfaces.
2. Workspace changes are classified by scene, camera, labels, and interaction dirtiness. Model and surface work runs only when scene/model state is dirty.
3. Automatic clipping is recalculated on canonical-bound changes and relevant projection changes, not on every camera pointer frame.
4. The active workspace object is synchronized before the canvas effect runs, so the object projection is authoritative for VDW materialization.
5. VDW uses scoped asynchronous 3Dmol surface handles, cached geometry where available, active generation/handle checks, and stale-completion guards. Existing valid geometry or a lightweight molecular fallback remains available until an accepted surface completion; stale completion cannot replace the current surface.

## Regression and gate results

| Gate | Result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS — 138 tests (116 web, 22 API) |
| npm run build | PASS |
| Manual-gate regression | PASS — 1/1 |
| B1/B2/B3 focused regression | PASS — 7/7 |
| Full Chromium E2E | PASS — 90/90 |
| GitHub Actions | PASS — workflow run [33951179986](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/33951179986) |

The build emitted the existing 3Dmol evaluation and large-chunk warnings; neither was a build failure.

## Automated regression evidence

The focused manual-gate test loads 4DJW through the UI and verifies the canonical 7079-atom model. It then verifies that:

- VDW reaches ready, reports a ready surface, has a non-empty surface object count, and leaves the model count at one.
- Native rotate and zoom preserve the VDW surface.
- Camera actions do not increase model loads, scene rebuilds, or the surface rebuild map, and do not mutate the scientific revision.
- Rapid Cartoon → Sticks → VDW transitions leave the final VDW projection ready, covering stale asynchronous completion guards.
- Orthographic View applies deterministically without model or surface reconstruction.

## Native manual validation — 4DJW

Validation was performed in the browser at http://localhost:3101/molstudio using the visible UI and actual pointer/scroll interaction:

1. Reloaded the viewer, used File → Fetch, entered 4DJW, and fetched from RCSB.
2. Confirmed 7079 atoms, 786 residues, and 9 chains.
3. Selected Van der Waals Surface and confirmed a ready surface with one surface object and one model.
4. Used View → Rotate and dragged the molecule. The VDW surface remained visible.
5. Used View → Zoom with scroll/drag. The VDW surface remained ready.
6. Exercised rapid Cartoon → Sticks → VDW transitions. The final VDW state was ready.
7. Applied Perspective and then Orthographic. The final camera projection was Orthographic.
8. Applied residue-number labels and By Element coloring, then rotated again. The final state remained VDW-ready.

Final native stress-state diagnostics:

~~~text
data-projection: van-der-waals-surface
data-surface-state: ready
data-surface-ready: true
data-renderer-surface-object-count: 1
data-renderer-model-count: 1
data-renderer-model-loads: 1
data-renderer-scene-rebuilds: 1
data-renderer-surface-rebuilds: {"object:structure_c816a3b9e947cc71:c816a3b9e947cc71:state:1":3}
data-scientific-revision: e22e291973c17f883c7489d01e8214406ca1d3191c02c337957fe6e9f9fb54a4
data-camera-projection: orthographic
data-label-mode: residue-number
data-label-count: 784
~~~

The surface rebuild count of three reflects accepted VDW requests during the deliberate style-transition stress sequence. It did not increase during the final camera interaction; model loads and scene rebuilds remained one, and the scientific revision was unchanged.

## Evidence

- [VDW surface visible](../../evidence/manual-gate-01/vdw-surface-visible.png)
- [VDW after rotation](../../evidence/manual-gate-01/vdw-after-rotation.png)
- [Orthographic View](../../evidence/manual-gate-01/view-orthographic.png)

## Limitations and out-of-scope items

- The first uncached full-4DJW native 3Dmol VDW generation remains legitimate main-thread/native surface work and can take a few seconds locally. Existing valid geometry or the fallback remains visible while it completes; camera interaction does not invalidate or regenerate the surface.
- No brittle FPS threshold was added. The regression uses architecture and invariant counters: camera isolation, no reconstruction, surface readiness, stale-guard behavior, and scientific-revision stability.
- Existing product wording that marks Cartoon and VDW as supported with limitations remains unchanged.
- Pre-existing View ribbon items for Clipping, Background, and Axes remain Coming Soon and were not part of this gate.
- No known in-scope functional failures remain after the local gates, native manual validation, and GitHub CI.

## Gate conclusion

Manual Gate 01 is PASS for the dedicated fix branch. The branch is pushed and ready for user retest. Main-branch merge authorization is intentionally not implied by this report.
