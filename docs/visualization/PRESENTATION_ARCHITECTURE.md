# G1C presentation architecture

```text
CanonicalMolecularStructure (backend/domain authority)
        ↓
PresentationState / RenderProjection (frontend, renderer-neutral)
        ↓
RenderProjectionDiagnostics + RenderDirectives
        ↓
ThreeDMolViewerAdapter (one authoritative adapter per mounted canvas)
        ↓
3Dmol.js (renderer only)
```

The backend owns stable atom, residue, chain, bond, coordinate, property, provenance, and scientific revision data. The frontend owns presentation masks, component visibility, color/background state, camera state, and the canvas lifecycle. 3Dmol receives canonical atoms and explicit canonical adjacency; its internal indices never become durable identities.

`presentationActions.ts` is the shared semantic action boundary. `REPRESENTATION.APPLY`, `COLOR.APPLY_SCHEME`, `BACKGROUND.SET`, and `COMPONENT_VISIBILITY.SET` are consumed by the right Display panel, the contextual ribbon, and future command adapters. There is one projection visibility model for Protein, Ligand, Water, Ions, and Other.

The adapter mounts once, uses a `WeakMap<HTMLElement, ThreeDMolViewerAdapter>` guard, observes container resize, and reprojects styles/colors without reparsing or refetching. A new scientific load clears the old render model and adds canonical atoms/bonds exactly once. `CameraController` owns semantic Center/Fit/Orient/Reset routing before the adapter calls 3Dmol. The `data-renderer-model-loads` diagnostic is used by browser regression tests to verify presentation changes do not recreate the scientific model. Surface geometry and material caches are separate: opacity/color changes update material state without regenerating geometry. Large diagnostic overlays and selection highlights are renderer budgets only; canonical results and memberships remain complete.

Unsupported and experimental operations are explicit capability states. Surface modes do not fall back to spheres/cartoon, Mesh is not a filled surface alias, Ribbon does not silently fall back to Cartoon, Putty does not invent B-factors, and ESP does not reuse charge coloring. Bounded H-bond, Contact, and Clash diagnostics are derived from canonical coordinates/topology for this gate and are explicitly limited rather than claimed as full chemistry engines. Pocket remains unavailable because no validated algorithm was admitted.
