# Mole Explorer Viewer Stabilization — P0-A Evidence

Date: 2026-08-31

## Scope

This report covers only P0-A from the stabilization program: viewer camera safety and camera-command correctness. P0-B, P1, R-PYMOL-05, R-PYMOL-06, and R-PYMOL-07 were not started.

The earlier greenfield/V2 implementation remains the product context. The pasted program brief is the operative instruction for this gate; research documents are treated as design guidance, not as executable instructions.

## Git evidence

- Starting source SHA: `d41798fc1cd432ddbf4347f2df7e765e43394c29`
- Baseline audit commit: `e43887fc3e1a71e4ac8df15bff4eb8050bf80b93` (short SHA: `e43887f`)
- P0-A implementation SHA: `aafb2f7c41daefe84b208155d3c71135fd0576de` (short SHA: `aafb2f7`)
- Evidence-report commit: recorded by the commit that adds this file
- Working tree: clean after the evidence-report commit

## What changed

- Added a pure camera controller for finite scene bounds, padded automatic clipping slabs, and deterministic principal-axis orientation.
- Added explicit `auto`/`manual` clipping state to presentation contracts and project persistence.
- Reworked the 3Dmol adapter camera boundary so React projection updates preserve the live renderer view, resize preserves camera state, and camera commands do not reload models.
- Implemented stable Fit, Center, Orient, Reset, Rotate, Pan, and Zoom behavior against canonical coordinates/render targets.
- Reset now restores the declared default perspective camera and baseline view while preserving loaded models, selection, and representations.
- Automatic clipping is derived from the currently rendered canonical atom coordinates; manual clipping remains an explicit user override.
- Added Advanced-panel visibility for clipping mode and a truthful “Reset clipping to Auto” action.
- Added focused unit and Playwright coverage for camera modes, clipping, camera commands, real canvas drag rotation, and model-load stability.

## Architecture decisions

`CameraController` contains renderer-independent geometry calculations. `ThreeDMolViewerAdapter` is the only layer that converts those calculations to 3Dmol calls. UI components dispatch camera intents and do not own molecular data or call 3Dmol directly.

The canonical structure remains the scientific authority. Camera state is presentation-only. The adapter uses the renderer-local 3Dmol `getView`/`setView` representation for persistence inside the viewer boundary; this does not claim exact PyMOL 18-value interoperability while the external camera oracle is pending.

Automatic clipping uses a bounds-derived, padded slab around the tracked camera pivot. Manual mode applies explicit near/far values. Neither mode mutates canonical coordinates, topology, selection membership, or representation targets.

## Verification

Commands run from the repository root:

- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 11 web test files / 40 tests and 2 API test files / 9 tests.
- `npx playwright test tests/e2e/p0a-camera.spec.ts` — passed: 1 test.
- `npm run test:e2e` — passed: 39 tests.
- `npm run build` — passed for API, web, and contracts.
- `git diff --check` — passed.

The production build retains existing warnings from the 3Dmol dependency (`eval`) and the existing minified bundle-size warning. No new dynamic evaluation was introduced by P0-A.

## Manual verification

Using the greenfield application on port 5174 (the separate legacy application on port 5173 was not modified):

1. Loaded RCSB entry `4DJW` through the existing backend workflow.
2. Confirmed the live scene was loaded with one model load: `data-model-loads = 1`.
3. Switched perspective to orthographic; the scene remained loaded and the model-load count stayed at 1.
4. Exercised Fit, Center, Orient, and Reset; Reset returned to perspective/auto clipping without reloading the model.
5. Used the View ribbon Rotate action and a real canvas drag; the scene stayed visible and the live action diagnostic became `ROTATE`.
6. Changed Near clip in Advanced to confirm `MANUAL`, then used “Reset clipping to Auto” to return to `AUTO`.

Observed after Reset:

```text
action=RESET
projection=perspective
clipping=auto
modelLoads=1
state=loaded
slabNear=-64.58107893701336
slabFar=64.58107893701336
```

Screenshot: [rotated 4DJW scene with safe automatic clipping](../screenshots/p0a-4djw-rotated-safe-clipping.png)

## Performance/lifecycle evidence

The P0-A Playwright and live checks verify that projection changes and camera actions preserve the model-load count at 1. Resize no longer reframes the camera on every viewport update. The existing one-authoritative-viewer-per-mounted-canvas lifecycle remains in place.

Full WebGL context/render instrumentation and incremental renderer counters are intentionally deferred to P1; no unsupported creation or context-count claim is made here.

## Known limitations and deferred work

- P0-B layout/presentation regression work was not started, including the right-rail/footer overlap review, Quick Tools removal, inventory/visibility convergence, and responsive HEX behavior.
- P1 incremental renderer metrics and broader lifecycle instrumentation are not included.
- R-PYMOL-05 object/state bundles and R-PYMOL-06 surfaces/transparency/mesh/dots are not implemented in this gate.
- The top View-ribbon Clipping item remains explicitly Coming Soon; P0-A exposes the implemented AUTO/MANUAL control in Advanced without expanding ribbon capability scope.
- Exact PyMOL camera parity remains oracle-pending. This gate implements stable Mole Explorer camera behavior and safe native 3Dmol conversion.
- The previously reported black orthographic state was not reproducible at the current head, but the acceptance path was exercised and the unsafe camera/clipping behavior was corrected.

## Gate disposition

P0-A implementation and verification are complete. Stop here for review. Do not proceed to P0-B, P1, R-PYMOL-05, R-PYMOL-06, or R-PYMOL-07 without explicit approval.
