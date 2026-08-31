# IMP-PRES-01 implementation report

## Scope and repository

- Repository: `outputs/molecular-workstation`
- Branch: `main`
- Starting SHA: `f18e2a45e1204a7c30d38ba55a6c89c2f3864039`
- Implementation ending SHA: `17eb4b18919ff1ef7c1c15f64a6c6cbbec1c7ab5`
- Legacy application on port 5173: left untouched.
- Greenfield application verified on port 5174.
- Authoritative research consulted read-only: IA-03, IA-05, IA-06, R-PYMOL-02, R-PYMOL-03, R-PYMOL-04, R-PYMOL-05, and R-PYMOL-06.

## Capability truth

A single `STYLE_DEFINITIONS` registry now supplies the visible Display ribbon, Projection & Display controls, render diagnostics, and application guards.

| Capability | Status |
| --- | --- |
| Line, Stick, Ball-and-Stick, Space-Filling | Implemented |
| Cartoon, Trace, Licorice | Implemented with limitations |
| Putty | Implemented with limitations when canonical source B-factors exist |
| Non-bonded crosses/spheres | Implemented with limitations; zero eligible atoms is reported as valid empty |
| Ribbon | Not implemented; no Cartoon substitution |
| VDW/SAS/SES surfaces, Mesh, Dots, Dot Surface | Not implemented; no fake geometry or generic fallback |
| Profile-gated styles | No styles admitted in this gate |

Putty without source B-factors reports `INSUFFICIENT_DATA` and does not fabricate values. Unsupported actions retain explicit Coming Soon/Unavailable messaging and do not mutate the current loaded projection.

## Architecture decisions

- The backend canonical molecular structure remains the scientific authority. UI and 3Dmol handles remain projection/runtime state.
- Representation capability is resolved through the registry before a UI or console action mutates presentation state.
- `RenderProjection` remains the boundary into `ThreeDMolViewerAdapter`; adapter diagnostics expose capability status without making 3Dmol authoritative.
- The right rail is now Projection & Display only. Context/selection properties and Interaction / Measurements live in the left workstation rail.
- Component inventory is read-only and mirrors presentation visibility; actual visibility controls remain in Projection & Display.
- Label cardinality is planned from stable canonical atom identity before labels reach 3Dmol. Chain/residue modes use canonical representatives; atom/custom labels are guarded above 250 eligible atoms with an explicit diagnostic.
- Camera remains presentation-only. Camera controls and resize handling remain adapter-owned and do not mutate canonical coordinates.
- File, Import, Open, Drop, and RCSB workflows continue to converge through the existing ingestion boundary.

## Files changed

Application and projection:

- `apps/web/src/App.tsx`
- `apps/web/src/components/ContextToolbar.tsx`
- `apps/web/src/components/InspectorPanel.tsx`
- `apps/web/src/components/MenuBar.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/interaction/labels.ts`
- `apps/web/src/interaction/picking.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/rendering/renderDirectives.ts`
- `apps/web/src/rendering/styleProfiles.ts`
- `apps/web/src/styles/global.css`

Tests:

- `apps/web/src/interaction/labels-picking.test.ts`
- `apps/web/src/rendering/g1cVisualization.test.ts`
- `apps/web/src/rendering/renderDirectives.test.ts`
- `tests/e2e/g0.spec.ts`
- `tests/e2e/g1c-visualization.spec.ts`
- `tests/e2e/imp-pres-01.spec.ts`
- `tests/e2e/p0a-camera.spec.ts`
- `tests/e2e/v2-interaction.spec.ts`

Evidence screenshots:

- `docs/screenshots/imp-pres-01-empty-1366x768.png`
- `docs/screenshots/imp-pres-01-uploaded-cartoon-ligand-sticks-1366x768.png`
- `docs/screenshots/imp-pres-01-rcsb-cartoon-ligand-sticks-1366x768.png`
- `docs/screenshots/imp-pres-01-layout-1920x1080.png`
- `docs/screenshots/imp-pres-01-advanced-controls-1920x1080.png`
- `docs/screenshots/imp-pres-01-empty-1366.png`

## Verification

Automated:

- `npm run typecheck` — PASS across API, web, and contracts.
- `npm run lint` — PASS across API, web, and contracts.
- `npm test` — PASS: 11 web files / 44 tests and 2 API files / 9 tests.
- `npm run build` — PASS. Vite reports the existing 3Dmol `eval` warning and a bundle-size warning; neither is a build failure.
- `npm run test:e2e` — PASS: 44 tests.
- `git diff --check` — PASS before commit.

Manual localhost verification:

1. Opened `http://localhost:5174/`; empty state showed a real empty viewer and no placeholder molecular geometry.
2. Imported `tests/fixtures/mini-protein.pdb`; canonical metadata showed 12 atoms, 8 polymer atoms, 2 ligand atoms, 1 water, and 1 ion, with LOCAL FILE/PDB/hash provenance.
3. Confirmed default presentation: protein Cartoon, organic ligand target switched to Stick, ions spheres, water hidden by presentation.
4. Fetched PDB ID `4DJW`; backend returned `4DJW.cif` as RCSB/MMCIF with preserved source hash metadata. The viewer rendered the loaded protein with Cartoon and ligand Stick targeting.
5. Clicked Ribbon; the status reported canonical Ribbon geometry is not implemented, the loaded projection remained Cartoon, and no Ribbon contributors were reported.
6. Switched labels to Chain and Residue + Number; the fixture reported 2 and 4 canonical label representatives from 11 visible atoms.
7. Verified File/Edit menu state is explicit and switching menus opens the selected ribbon without a second action.
8. Verified measurement mode appears in the left Interaction / Measurements rail and clear-picks clears transient slots.
9. Verified Advanced Display controls remain reachable at 1366x768 and 1920x1080 with no horizontal document overflow.
10. Browser diagnostics captured no console warnings or errors during the localhost checks.

## Known limitations

- This gate does not implement the complete R-PYMOL-02 stable representation-mask engine; it preserves and uses the existing presentation mask foundations while improving registry truth and projection diagnostics.
- R-PYMOL-07 is not started.
- Full selection/editing expansion is intentionally outside this gate.
- Exact PyMOL conformance remains unverified for Cartoon, Trace, Putty, and Licorice.
- Ribbon geometry and all surface/mesh/dot generators remain explicitly unavailable.
- Putty requires canonical source B-factor values.
- Non-bonded modes may legitimately have zero eligible atoms; this is reported as valid empty.
- The 3Dmol bundle remains large and emits the upstream eval/bundle warnings noted above.

## Handoff

The next bounded stage is to implement the full R-PYMOL-02 stable representation-mask engine. It should preserve the current `RenderProjection` → `ThreeDMolViewerAdapter` boundary, stable canonical atom IDs, truthful capability diagnostics, and the no-fallback behavior established here. Do not begin R07 in that stage.
