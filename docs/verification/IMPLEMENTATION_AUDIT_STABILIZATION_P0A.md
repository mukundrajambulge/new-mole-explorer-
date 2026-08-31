# Mole Explorer Stabilization Program — Current Implementation Audit

Audit performed at `d41798fc1cd432ddbf4347f2df7e765e43394c29` on branch `main`, before P0-A production changes. The separate legacy app on port 5173 was out of scope; the greenfield app was inspected on port 5174.

## Authority and source read

The current implementation was inspected against the repository source and the native research documents R-PYMOL-02, R-PYMOL-03, R-PYMOL-04, R-PYMOL-05, R-PYMOL-06, and the Master Research Index. These documents were read as semantic authorities only. No broad `VERIFIED_PYMOL_CONFORMANCE` claim is made; the research documents retain their bounded oracle-pending limitations.

## Current implementation matrix

| Area / visible feature | Classification | Current evidence | Decision for this program |
| --- | --- | --- | --- |
| Canonical structure ingestion and identity | IMPLEMENTED_VERIFIED | Backend canonical structure, stable atom IDs, canonical bonds, revision/provenance | Preserve as scientific authority |
| Core molecular viewer | IMPLEMENTED_NATIVE | `ThreeDMolViewerAdapter` owns the mounted 3Dmol instance | Preserve adapter boundary |
| Viewer lifecycle | IMPLEMENTED_WITH_LIMITATIONS | `WeakMap<HTMLElement, adapter>` prevents duplicate mounted adapters; `load()` replaces models; no browser WebGL counter | Harden counters and camera path only in P0-A |
| Resize handling | IMPLEMENTED_NATIVE | `ResizeObserver` calls viewer resize/render; viewport translation accounts for overlays | Preserve |
| Rotation / pan / zoom | IMPLEMENTED_WITH_LIMITATIONS | Adapter gesture bridge exists; camera is rendered after gesture; slab is not recomputed | Add safe AUTO slab recalculation after camera mutations |
| Fit | IMPLEMENTED_WITH_LIMITATIONS | `frameToCanonicalBounds()` centers/zooms all canonical atoms and stores the resulting view | Make target resolution and clipping explicit; preserve reset baseline |
| Center | BROKEN / INSUFFICIENTLY OBSERVABLE | Direct `viewer.center()` is invoked, but no semantic target/pivot controller or deterministic test exists | Implement through camera controller with stable target and safe slab |
| Orient | BROKEN / INSUFFICIENTLY OBSERVABLE | Uses `cameraState.defaultView`, which is overwritten by framing; no deterministic orientation contract | Implement deterministic orientation from resolved bounds/target |
| Reset | BROKEN / INSUFFICIENTLY OBSERVABLE | Also uses mutable `defaultView`; does not explicitly restore projection, pivot, distance, or AUTO clipping | Implement defined default camera restoration without reload |
| Perspective / orthographic | IMPLEMENTED_WITH_LIMITATIONS | `setProjection` and `setCameraParameters` are called; current live 4DJW runtime remained visible in orthographic | Add semantic conversion and camera/clipping validation tests |
| Clipping | BROKEN | `setSlab(projection.camera.nearClip, farClip)` applies static values; no visible-scene bounds or AUTO/MANUAL mode | P0-A production fix |
| Background / color / labels | IMPLEMENTED_WITH_LIMITATIONS | Presentation state exists; adapter changes renderer presentation | Deferred to later gates except regression protection |
| Representation state | IMPLEMENTED_WITH_LIMITATIONS | Stable selection resolver and masks exist; adapter re-applies styles through a broad `setStyle` reconciliation | Do not expand in P0-A |
| Representation ribbon / capability status | IMPLEMENTED_WITH_LIMITATIONS | Registry exists, but some presentation labels are legacy-compatible UI states | Do not restructure in P0-A |
| Molecular Inspector | IMPLEMENTED_WITH_LIMITATIONS | Canonical atom inspection and measurement cards exist | Do not restructure in P0-A |
| Measurements | IMPLEMENTED_WITH_LIMITATIONS | Typed distance/angle/dihedral objects and kernels exist | Do not restructure in P0-A |
| Right rail / footer separation | IMPLEMENTED_WITH_LIMITATIONS | Right column and display scroll rules exist; current panel contains a separate interaction card | Defer layout fix to P0-B |
| Left Workbench / Quick Tools | BROKEN relative to new brief | Quick Tools are still rendered in the left rail and duplicate right-side measurement actions | Defer removal to P0-B |
| Structural Inventory | IMPLEMENTED_WITH_LIMITATIONS | Current component inventory is canonical-count based | Defer taxonomy/UI changes to P0-B |
| Visibility categories | IMPLEMENTED_WITH_LIMITATIONS | Stable category visibility state exists | Defer verification/UI convergence to P0-B |
| Surfaces / mesh / dots | COMING_SOON / UNSUPPORTED | No surface generator in current greenfield adapter; UI keeps unavailable states explicit | Defer R-PYMOL-06 implementation until P0/P1 review |
| WebGL / rebuild counters | INSUFFICIENT_DATA | Model-load and renderer-generation data attributes exist; creation/context/render/reconciliation counters do not | Add only minimal P0-A camera diagnostics; defer incremental renderer instrumentation to P1 |

## Reproduction and pre-change observations

1. Loaded official RCSB `4DJW` through the current backend workflow. The current runtime reported 7,079 atoms, 786 residues, 9 chains, and official mmCIF provenance.
2. Switched the live viewer to orthographic. On this current head the molecule remained visible; the reported black viewport regression was not reproduced in this run. This does not validate the implementation: projection conversion still uses direct renderer calls without a semantic camera model or clipping validation.
3. Invoked Fit, Center, Orient, and Reset. The controls dispatch, but the current source shows that `frameToCanonicalBounds()` writes the current view into `defaultView`, so Orient and Reset do not have a stable default baseline after framing or resize.
4. The current source applies a fixed `nearClip`/`farClip` slab on every projection/camera update. It does not calculate padding from visible scene bounds and does not distinguish user-edited manual limits from automatic limits. This is the likely source of rotation cut-through/disappearing geometry.
5. The live DOM still exposes Quick Tools in the left sidebar. That is a real P0-B duplication and is intentionally not changed in this P0-A gate.

## P0-A boundary

This audit authorizes only the viewer-blocker gate:

- safe visible-scene clipping with explicit AUTO/MANUAL state;
- stable Perspective/Orthographic conversion without model reload;
- deterministic Fit, Center, Orient, and Reset semantics;
- camera regression tests and manual 4DJW rotation/projection verification.

P0-B layout, labels, inventory, visibility convergence, P1 incremental renderer work, R05 object/state bundles, and R06 surfaces/transparency/mesh/dots are not started by this gate.
