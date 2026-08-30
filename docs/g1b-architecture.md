# G1B architecture and capability boundary

This document records the implementation boundary for the greenfield Molecular Workstation at G1B. The referenced research contracts are R-PYMOL-02 (show/hide/representation), R-PYMOL-03 (color/camera/presentation), and IA-05 (file/project/import/export/session lifecycle). The implementation is renderer-neutral at the domain boundary and makes no selection, editing, or docking claim.

## Responsibility split

| Area | Owner | Rule |
| --- | --- | --- |
| source bytes, validation, RCSB retrieval, provenance, canonical atom identity, bonds, hierarchy and scientific hash | API | canonical molecular structure is the scientific authority |
| project manifest, revisions, source/render payload and presentation snapshot persistence | API | writes are atomic; failed replacement leaves the previous manifest intact |
| UI menus, file picker, drop target, dialogs and transient notices | web | all local acquisition UX calls the same `/api/structures/upload` service |
| camera, canvas size/occlusion measurement and transient render projection | web | presentation state never changes the scientific hash |
| WebGL model/style/camera calls | `ThreeDMolViewerAdapter` | the only 3Dmol owner; one adapter/viewer per mounted canvas |

## Structure lifecycle

```text
local picker / drop / Open / Import  ─┐
                                      ├─ STRUCTURE.IMPORT ──┐
RCSB PDB ID ── STRUCTURE.FETCH_RCSB ──┘                     │
                                                           v
                                     StructureIngestionService
                         exact bytes → validate → parse → hash
                                  → stable IDs/topology/hierarchy
                                  → StructureLoadResult
                                                           │
                                                           v
                                  RenderProjection → 3Dmol adapter
```

The source serial is retained as an alias only. `stableId`, `CanonicalBond`, `CanonicalResidue`, and `CanonicalChain` are the durable identity/topology/hierarchy layer. 3Dmol model indices are used only in an ephemeral adapter predicate mapping and are never stored in project state.

## RepresentationState

The canonical representation set is `LINES`, `STICKS`, `SPHERES`, `CARTOON`, `RIBBON`, `SURFACE`, `MESH`, `DOTS`, `NONBONDED`, and `NB_SPHERES`. A stable bitmask is stored per stable atom ID. The operation algebra is:

```text
SHOW(mask, targets):    old | mask
HIDE(mask, targets):    old & ~mask
SHOW_AS(mask, targets): mask
```

Only resolved stable IDs are targets. The pure implementation is `applyRepresentationOperation` in `apps/web/src/rendering/presentationState.ts`; it is deliberately independent of query-string equality and renderer arrays. Presets are explicit: `WIRE = LINES + NONBONDED`, `LICORICE = STICKS + NB_SPHERES`, and `BALL_AND_STICK = STICKS + SPHERES`. The adapter gates sticks/lines on explicit canonical bond membership and does not create distance-based bonds.

The current UI uses a whole-entity default presentation for polymer, ligand, water, ions, and other atoms. Selection-scoped commands remain an architecture/test foundation only; the Select tool, selection evaluation, and editing are still unavailable in this gate.

## ColorRegistry and precedence

`ColorRegistry` carries `ColorID`, `ColorDefinition`, the pinned PyMOL OSS profile reference, and named-color lookup. The frontend color mode is one of Element, Chain, Object, Residue, Secondary Structure, Uniform, Named, or Custom HEX. Hidden atoms keep their color state because visibility and color are separate presentation dimensions. A future representation-specific override is represented by the renderer-neutral model boundary; no renderer handle is used as a color identity.

Named compatibility values are source-derived from the pinned PyMOL `Color.cpp` core table. This gate does not claim executable PyMOL conformance or the complete generated PyMOL color universe. Spectrum/property modes remain explicitly unavailable in the UI.

## CameraState and viewport framing

On a new structure the adapter performs `resize → canonical all-atom selection → center → zoomTo/fit → render`. `MolecularCanvas` measures the actual host and the console overlay. The adapter translates by the mathematically derived center of the visible viewport, preserving the approved overlay layout without a CSS molecule offset or hard-coded camera correction. Resize changes update the viewport; rotate, pan, zoom and reset change only camera state and do not recreate the viewer.

Project restore reapplies the persisted 3Dmol view after model load. If there is no saved view, the canonical bounds are centered and fit. Reset returns to the current structure's canonical frame.

## BackgroundColorState

Background presets are Black, White, Dark Gray, Light Gray, Navy, Deep Blue, and Custom. Background is independent from atom colors and is reapplied after model recreation. It is stored in the project presentation snapshot and does not affect `scientificHash`.

## File/project capability matrix

| Capability | G1B state | Actual behavior |
| --- | --- | --- |
| `PROJECT.CREATE` / File → New | supported | creates a file-backed empty project manifest and clears the workspace |
| `PROJECT.OPEN` | supported | opens a durable project by project ID prompt and restores structure/presentation |
| `STRUCTURE.IMPORT` / Open / Import / Drop | supported | same backend upload ingestion path, PDB/mmCIF only |
| `STRUCTURE.FETCH_RCSB` | supported | backend fetches official `files.rcsb.org` mmCIF and retains URI/hash |
| `PROJECT.SAVE` / File → Save | supported | atomically saves source/render payload and presentation with revision check |
| `STRUCTURE.EXPORT` / File → Export | Coming Soon | no writer or fake download is exposed |
| selection, editing, measurement, docking | Coming Soon/Unavailable | explicit notices; no substitute behavior |

Project files are written below `.molecular-data/` (or `MOLECULAR_DATA_DIR`) and use temporary-file-plus-rename replacement. This is local durable storage for the current greenfield app, not a multi-user production database.
