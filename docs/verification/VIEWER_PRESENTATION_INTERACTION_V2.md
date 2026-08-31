# Mole Explorer — Viewer Presentation & Interaction V2 Evidence

## Scope

The operative request was the V2 pasted brief, “MOLE EXPLORER — VIEWER PRESENTATION & INTERACTION V2 — IMPLEMENTATION PROMPT.” Earlier G0, G1B-R1, G1C, and VIS-01 briefs were treated as continuity constraints and protected-test context, not as new or competing requests. The implementation stayed in the current greenfield repository and did not copy code from the legacy Molexplorer application.

The separate legacy app on port 5173 was not modified. Verification of this repository used port 5174 for the web app and port 4310 for its API.

## Git evidence

- Starting SHA: `10e9f925dcf0ad7b46a69b04bb5eead313ae8c6c`
- Implementation ending SHA before this evidence-only commit: `27aa1b7`
- Evidence report commit: recorded by `git log -1` at handoff
- Branch: `main`
- Commits:
  - `8ddab3e` — `docs: add V2 implementation audit`
  - `de1613a` — `feat: add V2 molecular presentation and interaction core`
  - `27aa1b7` — `feat: complete V2 viewer interaction UI`

## G0 audit and bounded delivery

The audit was completed before production changes in [IMPLEMENTATION_AUDIT_V2.md](./IMPLEMENTATION_AUDIT_V2.md). It records the existing canonical-structure authority, the existing 3Dmol lifecycle boundary, duplicated presentation controls, and the missing selection, picking, inspection, labels, and measurement foundations. The audit also records the reuse/modify/retire decisions.

| Bounded area | Result |
| --- | --- |
| G0 audit | Complete before production edits |
| G1 presentation state | Complete: renderer-neutral projection, camera, background, color, visibility, labels |
| G2 selection boundary | Complete: canonical selection resolver and stable-ID membership results |
| G3 representations | Complete: Lines, Sticks, Spheres, Ball-and-Stick, Cartoon foundations; target-scoped masks |
| G4 picking/inspection | Complete: reverse identity map, canonical atom inspection, hover/pick state |
| G5 measurements | Complete: distance, angle, dihedral objects with Å/degree units and stale-state checks |
| G6 labels | Complete: safe allow-listed field expressions and preset labels; no dynamic evaluation |
| G7 camera/background | Complete: perspective/orthographic, fit/center/orient/reset, background presets, resize handling |
| G8 UI convergence | Complete: unified Projection & Display panel; inventory is read-only; unavailable features remain explicit |
| G9 regression/performance | Complete: protected suites pass; presentation changes do not add viewer models |
| G10 evidence | Complete: screenshots, tests, manual paths, limitations documented |
| G11–G12 | Complete for the bounded V2 brief; no R-PYMOL-05+ work was started |

## Architecture decisions

- The backend canonical molecular structure remains the scientific authority. PDB/mmCIF ingestion preserves occupancy and alternate-location metadata needed by inspection; it does not make 3Dmol state authoritative.
- `RenderProjection` is the presentation boundary. React components update projection state and interaction intent; `ThreeDMolViewerAdapter` is the only owner of the mounted 3Dmol viewer and translates projection state into renderer calls.
- The adapter uses a `WeakMap<HTMLElement, ThreeDMolViewerAdapter>` and creates one viewer per mounted molecular canvas. Loads replace models through the existing lifecycle instead of duplicating them on remount.
- Selection queries resolve against canonical atoms and return stable-ID membership plus molecular revision. Representation commands apply masks to that returned membership, so a target such as `chain A` does not accidentally change unrelated entities.
- Picking uses renderer hit data only as an input to a reverse identity map. Inspection and measurement participants are canonical stable atom references with structure/revision and coordinate-context checks.
- Labels accept only allow-listed fields and `{field}` templates. Unsupported fields, expression syntax, and dynamic code are rejected with diagnostics.
- Measurements are presentation/annotation objects separate from canonical topology. Raw values are kept separately from formatted display text; distance is in Å and angle/dihedral values are in degrees.
- Visibility, color, representation, camera, background, labels, and measurement display are presentation state. Missing scientific property datasets are explicit diagnostics rather than fabricated values.

## UI changes

- Preserved the approved workstation layout and dark visual system.
- Consolidated right-side presentation controls under one scrollable `Projection & Display` panel with accordion sections for Representation, Color, Visibility, View, Background, Labels, Representation Settings, and Advanced camera settings.
- Converted the left component card into a read-only structure inventory so it no longer competes with the right-side visibility controls.
- Added unified Selection/Molecular Inspector behavior, including stable atom identity, residue/chain, element, coordinates, occupancy, B-factor, formal charge, and object/model.
- Added measurement mode, pick hints, persistent measurement cards, hide/show/delete controls, and clear-picks behavior.
- Kept unavailable toolbar/menu actions explicitly `Coming Soon`/unavailable. The existing protected Ribbon toolbar behavior remains unchanged; the supported-with-limitations ribbon profile is exposed separately through the representation controls.

## Files changed

Core and contract changes:

- `packages/contracts/src/index.ts`
- `apps/api/src/structures/ingestion.ts`
- `apps/web/src/domain/registry.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/rendering/presentationActions.ts`
- `apps/web/src/rendering/presentationState.ts`
- `apps/web/src/rendering/renderProjection.ts`
- `apps/web/src/interaction/selectionResolver.ts`
- `apps/web/src/interaction/picking.ts`
- `apps/web/src/interaction/measurements.ts`
- `apps/web/src/interaction/labels.ts`

UI, styling, and verification:

- `apps/web/src/App.tsx`
- `apps/web/src/components/ConsolePanel.tsx`
- `apps/web/src/components/ContextToolbar.tsx`
- `apps/web/src/components/InspectorPanel.tsx`
- `apps/web/src/components/MolecularCanvas.tsx`
- `apps/web/src/components/StatusBar.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/styles/global.css`
- `apps/web/src/interaction/*.test.ts`
- `tests/e2e/v2-interaction.spec.ts`
- `docs/screenshots/v2-*.png`

## Tests and build results

- `npm run typecheck` — passed.
- `npm test` — passed: web 10 test files / 37 tests; API 2 test files / 9 tests.
- `npm run test:e2e` — passed: 38 tests, including all existing G0/G1B-R1/G1C tests and the V2 interaction test.
- `npm run build` — passed. Vite reported the existing 3Dmol vendor `eval` warning and a large-bundle warning; neither comes from the safe label-expression implementation.
- `git diff --check` — passed; only normal Git LF/CRLF normalization warnings were emitted.

## Manual verification

1. Started the greenfield app on `http://localhost:5174/molstudio`; left the pre-existing legacy `http://localhost:5173` tab untouched.
2. Confirmed the empty state has no fake molecule geometry, retains the approved shell, and keeps the footer visible.
3. Uploaded a local PDB through the File flow. The viewer rendered real canonical atoms; clicking a visible atom opened the Molecular Inspector with element, coordinates, occupancy, B-factor, and object/model.
4. Applied protein Cartoon and ligand Sticks. The viewer showed separate target-scoped projections, and the adapter model-load counter remained unchanged during presentation changes.
5. Used the command console with `show sticks, all`, `hide sticks, chain A`, `show sticks, chain A`, and `color cyan, chain A`; each command reported the canonical selection count and the expected presentation-only result.
6. Fetched `4DJW` through the backend RCSB flow. The source badge reported official `RCSB · MMCIF` provenance and a SHA-256 prefix; the loaded structure reported 7,079 atoms, 786 residues, and 9 chains.
7. On 4DJW, protein Cartoon and ligand Sticks rendered together. Presentation controls changed perspective/orthographic projection and fit/center/orient/reset without adding models.
8. Picked a 4DJW atom and verified canonical inspection. Created distance, angle, and dihedral objects, then hid, showed, and deleted them without changing chemical topology.

Observed lifecycle evidence: the local load reached model-load count 1; loading 4DJW in the same tab reached count 2; subsequent display, camera, label, selection, and measurement updates did not increment the count. This is a smoke-level lifecycle check, not a claim of a full browser/WebGL performance profile.

## Screenshots

- Empty state: [v2-empty-state.png](../screenshots/v2-empty-state.png)
- Uploaded local protein: [v2-local-protein.png](../screenshots/v2-local-protein.png)
- Cartoon plus ligand sticks: [v2-cartoon-ligand-sticks.png](../screenshots/v2-cartoon-ligand-sticks.png)
- RCSB 4DJW with Cartoon plus ligand sticks: [v2-4djw-rcsb-cartoon-ligand-sticks.png](../screenshots/v2-4djw-rcsb-cartoon-ligand-sticks.png)
- Supplemental interaction captures are retained alongside these files under `docs/screenshots/`.

## Known limitations

- Surface, mesh, dots, and advanced secondary-structure/measurement workflows remain explicitly unavailable or limited; no fake substitute is shown.
- Partial-charge/ESP coloring is diagnostic when the canonical structure does not contain the required dataset; values are not invented.
- Screen-space measurement picking remains dependent on a visible atom hit. The typed kernels reject wrong cardinality, stale revisions, missing coordinates, and degenerate geometry.
- V2 transient labels, selections, and measurement annotations are session presentation state; the existing project persistence path continues to persist the supported project/camera data, not a new scientific schema.
- The 3Dmol dependency contributes an upstream vendor `eval` warning and a large bundle warning during build. The application label parser itself contains no `eval`, `new Function`, or equivalent dynamic execution.

## Final verdict

PASS
