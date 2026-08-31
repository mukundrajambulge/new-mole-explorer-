# Viewer Presentation & Interaction V2 — Implementation Audit

## Audit scope

This audit was performed against the current greenfield repository at starting SHA `10e9f925dcf0ad7b46a69b04bb5eead313ae8c6c`. The operative input is the pasted V2 implementation prompt; the earlier G0/G1B/G1C briefs and screenshots are continuity constraints, not new implementation scope. R-PYMOL-04 was read before production changes. Its central rule is preserved: a renderer hit is not scientific identity.

## Current component map

| Current component | Current responsibility | Reuse / modify / retire | Target responsibility | Why |
|---|---|---|---|---|
| `apps/web/src/components/MolecularCanvas.tsx` | Owns the mounted canvas host, drag/drop, empty/loading/error overlays, viewport inset, and camera command dispatch | Modify | Stable viewer surface, pointer event bridge, hover/pick/measurement interaction, and compact overlays | It already isolates canvas lifecycle from the rest of the shell. |
| `apps/web/src/rendering/ThreeDMolViewerAdapter.ts` | Creates one 3Dmol viewer, ingests canonical atoms/bonds, projects directives, resizes, and performs simple camera commands | Modify | Lifecycle-safe renderer adapter plus incremental projection, camera controller, reverse identity map, label/measurement projection | It is the existing renderer boundary and must remain the only 3Dmol owner. |
| `apps/web/src/rendering/presentationState.ts` | Global style selection, category visibility, color/background, basic camera, and per-atom masks | Refactor in place | Composable per-target representation state, color/background/labels/camera/pick/measurement presentation state | Current `setProjectionStyle` recreates every atom mask, so it cannot preserve independent target representations. |
| `apps/web/src/rendering/renderDirectives.ts` | Converts global presentation style into renderer-neutral primitive diagnostics | Refactor in place | Target-specific composable directives and explicit show/hide/show-as mutations | This is the correct projection seam, but its current style model is not enough for arbitrary stable subsets. |
| `apps/web/src/rendering/presentationActions.ts` | Shared representation/color/background/category action helper | Extend | Single semantic action boundary for panel, ribbon, pointer, and measurement controls | Reuse prevents new UI surfaces from owning scientific state. |
| `apps/web/src/components/InspectorPanel.tsx` | Selection placeholder plus permanent Display and Visibility controls | Refactor; retire duplicate permanent display section | Compact Projection & Display accordion and contextual Molecular Inspector | It is the largest duplication source and currently labels selection as future-only. |
| `apps/web/src/components/ContextToolbar.tsx` | Contextual ribbon for file, display, color, camera, and unavailable actions | Simplify / reuse | Compact entry point and contextual quick actions; no second permanent display editor | Keep the approved ribbon language, but route presentation edits to the single panel. |
| `apps/web/src/components/StructurePanel.tsx` | Structure tree, component toggles, quick tools, local import, and RCSB fetch | Modify | Structure context plus compact component summary; visibility edits route to Projection & Display | Component rows are currently a second permanent visibility control surface. |
| `apps/web/src/domain/registry.ts` | Action IDs and capability registry | Extend | Explicit V2 supported/limited/coming-soon interaction actions | Existing capability notices provide the correct unavailable-feature behavior. |
| `packages/contracts/src/index.ts` | Canonical atom, bond, hierarchy, provenance, and project contracts | Extend additively | Optional occupancy/altloc/coordinate context and stable pick/measurement contracts | Backend remains scientific authority; no renderer types become canonical. |
| `apps/api/src/structures/ingestion.ts` | PDB/mmCIF parsing, canonical IDs/topology/provenance | Modify additively | Preserve authoritative fields needed by inspection and labels | Existing parser is the safe source for occupancy and altloc additions. |
| `apps/api/src/projects/projectStore.ts` | In-memory project persistence for presentation snapshot | Extend compatibility | Persist compatible V2 presentation state where appropriate | Do not redesign project lifecycle or start R-PYMOL-05. |
| `apps/web/src/styles/global.css` | Approved dark workstation layout and responsive shell | Modify | Compact accordion, reserved footer, depth/focus/reduced-motion states | Preserve geometry and visual language while fixing overlap and scrolling. |
| `tests/e2e/*` and rendering unit tests | G0/G1B/G1C regression coverage | Extend only | V2 UI, interaction, scientific invariant, and performance regression coverage | Existing accepted tests are protected. |

## Findings by requested audit area

- Canonical atom identity: `CanonicalAtom.stableId`; renderer index and source serial are projection-only.
- Canonical topology: `CanonicalBond[]` with explicit bond order/source; the adapter builds explicit 3Dmol adjacency and does not infer bonds.
- Selection architecture: no current authoritative selection parser/resolver exists; G1C explicitly left `SELECTION.EVALUATE` Coming Soon. V2 therefore needs a bounded stable-membership resolver for the authorized display/picking subset, without pretending to implement a complete PyMOL interpreter.
- Presentation state: currently one `representation` plus per-atom masks, category gates, color, background, and basic camera. Style changes rebuild all masks instead of mutating only a stable target.
- Viewer lifecycle: one `ThreeDMolViewerAdapter` per mounted canvas through a `WeakMap`; presentation changes call `setStyle`/`addStyle` and do not reload the model. This boundary is reusable.
- Camera: adapter supports rotate/pan/zoom/focus and resize, but React dispatches one-shot toolbar commands and does not expose canonical projection mode/FOV/clipping state.
- Picking: no atom click/reverse identity map/hover/picked state is currently implemented.
- Measurements: no frontend numeric kernels, stable participant accumulator, persistent measurement object, or annotation projection is currently implemented. The V2 implementation will add bounded TypeScript kernels rather than modify the out-of-scope backend editing stack.
- Labels: no label state or projection exists. Safe field resolution must be explicit and non-evaluating.
- UI duplication: Display/color/background/visibility exist in the right panel and contextual ribbon; visibility also exists in the left Structure panel and Display ribbon.
- Bundle/loading: Vite eagerly bundles the current web app and 3Dmol; no V2 lazy boundary exists. Defer only the advanced label editor and measurement management UI if this can be done without complicating the core interaction path.

## Baseline to preserve

- Starting SHA: `10e9f925dcf0ad7b46a69b04bb5eead313ae8c6c`.
- Existing G1C verification: 31 frontend unit tests, 9 API tests, and 37 real Chromium/WebGL E2E tests passed before V2 changes.
- Protected behavior: approved shell geometry, backend ingestion/provenance/hash authority, canonical topology, 3Dmol lifecycle boundary, project compatibility, and explicit Coming Soon/Unavailable actions.

## Safest implementation path

1. Consolidate UI state and layout around one Projection & Display panel while keeping the ribbon as a compact entry/quick-action surface.
2. Refactor presentation into composable target masks with explicit SHOW/HIDE/SHOW_AS mutation helpers and preserve G1C compatibility serialization.
3. Add camera, color, background, and safe label state without rebuilding the viewer.
4. Add stable reverse picking and inspector resolution from canonical structure data.
5. Reuse/add typed geometry kernels, then add persistent measurement objects and renderer-neutral annotation directives.
6. Extend tests and capture a 4DJW manual/E2E evidence run, then stop at the V2 boundary.

