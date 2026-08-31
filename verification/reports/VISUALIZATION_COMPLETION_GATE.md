# Visualization Completion Gate

## Scope and disposition

This report records the bounded visualization-completion implementation for the current greenfield Molecular Workstation repository. Work was limited to canonical structure ingestion, 3Dmol projection, presentation, surfaces, interaction foundations, evidence, and truthful capability states. Selection editing, docking, and later R-PYMOL work were not started.

The older pasted briefs and the attached reference image were treated as source context, not as additional user instructions. The operative request was the visualization-completion gate brief. The legacy application on port 5173 was not modified.

## Repository identity

- Repository: `molecular-workstation`
- Branch: `main`
- Starting SHA: `94304495f1cf1f64f8734f296eaa65f4e04d0053`
- Ending SHA: `4e1c0b83d37c53e827ca17f129779eceb14c4dc4`
- Local topology: landing `3100`, scientific workstation `3101`, API `8100`
- Legacy port `5173`: left untouched

## Architecture decisions

The implementation preserves the scientific boundary:

```text
CanonicalMolecularStructure (backend authority)
  -> RenderProjection / RenderDirectives (renderer-neutral frontend boundary)
  -> presentation state and color resolution
  -> ThreeDMolViewerAdapter (one authoritative owner per mounted canvas)
  -> 3Dmol.js (renderer only)
```

- Canonical atom, residue, chain, bond, coordinate, topology, property, provenance, and revision data remain backend-owned. Renderer indexes and raw selection strings are not durable identities.
- Stable atom IDs and canonical bond IDs drive representation targets. Component visibility is separate from representation masks.
- The adapter uses the existing mount guard and clears/reloads the scientific model exactly once per scientific load. Presentation changes reproject styles without reparsing or recreating the model.
- Local PDB/mmCIF upload and RCSB PDB-ID retrieval converge on the backend ingestion service. RCSB retrieval prefers official mmCIF and records source URI, source kind, filename, byte length, SHA-256, parser profile, and canonical scientific hash.
- Surface requests distinguish target atoms from canonical coordinate contributors. VDW, SAS, SES, Mesh, Dots, and Dot Surface requests carry profile, probe, quality, sampling, coordinate context, molecular revision, and a deterministic cache key. Surface generations are invalidated and stale results are rejected when a newer projection supersedes them.
- Putty derives variable radius from source polymer B-factors and reports the property-unavailable state when the source has no usable B-factors; it does not fabricate scalar values.
- Hover, transient picked atoms, persistent selection, and measurement picks have separate state. Highlight geometry is small, wireframe/low-opacity marker geometry rather than a large opaque click sphere.
- File import/fetch actions are under File. The Project Tree contains structure and provenance only. Analysis and Interaction are a single left-rail component, and Projection & Display is the single visual inspector.
- Unsupported features remain explicit Coming Soon/Unavailable capability states. Surface, Ribbon, Trace, Putty, and the deterministic dot projection are supported with bounded renderer limitations documented below rather than silently substituted.

## Representation and scientific behavior

Implemented canonical masks: `LINES`, `STICKS`, `SPHERES`, `CARTOON`, `RIBBON`, `SURFACE`, `MESH`, `DOTS`, `NONBONDED`, and `NB_SPHERES`.

Explicit composites:

- Ball-and-Stick = Sticks + Spheres
- Licorice = Sticks + Non-bonded spheres
- Wire = Lines + Non-bonded crosses

The initial protein presentation is polymer Cartoon, organic ligand Sticks, ion Spheres, and water hidden by presentation. Lines and Sticks consume canonical bonds only. Non-bonded primitives use canonical bonded-neighbor counts. Ligand surface membership is target-scoped and does not change unrelated entities.

## Files changed

Application and runtime:

- `apps/app/package.json`
- `apps/app/src/index.html`
- `apps/app/src/server.mjs`
- `apps/api/src/server.ts`
- `apps/web/index.html`
- `apps/web/vite.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/ContextToolbar.tsx`
- `apps/web/src/components/InspectorPanel.tsx`
- `apps/web/src/components/MolecularCanvas.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/domain/registry.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/rendering/presentationState.ts`
- `apps/web/src/rendering/renderDirectives.ts`
- `apps/web/src/rendering/styleProfiles.ts`
- `apps/web/src/rendering/putty.ts`
- `apps/web/src/rendering/surfaceGenerator.ts`
- `apps/web/src/rendering/surfaceProfiles.ts`
- `apps/web/src/styles/global.css`
- `packages/contracts/src/index.ts`
- `.env.example`
- `package.json`
- `playwright.config.ts`

Tests and documentation:

- `apps/web/src/domain/registry.test.ts`
- `apps/web/src/rendering/g1cVisualization.test.ts`
- `apps/web/src/rendering/presentationState.test.ts`
- `apps/web/src/rendering/renderDirectives.test.ts`
- `apps/web/src/rendering/putty.test.ts`
- `apps/web/src/rendering/surfaceProfiles.test.ts`
- `tests/e2e/g0.spec.ts`
- `tests/e2e/g1b-r1.spec.ts`
- `tests/e2e/g1c-visualization.spec.ts`
- `tests/e2e/imp-pres-01.spec.ts`
- `tests/e2e/visualization-evidence.spec.ts`
- `README.md`
- `docs/api.md`
- `docs/visualization/REPRESENTATION_MATRIX.md`
- `docs/visualization/SURFACE_PROFILE_MATRIX.md`
- this report

Evidence assets:

- `verification/evidence/empty-workstation.png`
- `verification/evidence/uploaded-cartoon-ligand-sticks.png`
- `verification/evidence/rcsb-cartoon-1crn.png`
- `verification/evidence/rcsb-4djw-cartoon-ligand-sticks.png`
- `verification/evidence/rcsb-4djw-vdw-surface.png`

## Automated verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — API, app, web, and contracts |
| `npm run lint` | PASS — all workspaces, zero warnings |
| `npm test` | PASS — web 13 files / 51 tests; API 2 files / 9 tests |
| `npm run build` | PASS — API, app, web, and contracts |
| `npm run test:e2e` | PASS — 46 Playwright tests |

The production build reports the upstream 3Dmol `eval` warning and a bundle-size warning; neither is an application test failure.

The end-to-end suite covers empty real viewer state, local PDB upload, failed-load preservation, RCSB mmCIF, all core representation families, target-scoped surface projection, canonical non-bonded topology, component visibility, color capability truth, camera actions, interaction state separation, measurement foundations, and model-load lifecycle stability.

## Browser evidence and manual verification

The in-app browser was used for live verification on the current workstation, with no console errors observed beyond normal development informational messages.

1. Open `http://localhost:3100/`. Confirm the landing page identifies `3100`, `3101`, and `8100`, and its workstation link opens `http://localhost:3101/molstudio`.
2. On an empty workstation, confirm the canvas has no placeholder geometry and reports an empty real viewer state. Evidence: [empty workstation](../evidence/empty-workstation.png).
3. Use File → Import with a local PDB or mmCIF. Confirm the current structure remains unchanged if parsing fails. Evidence: [uploaded Cartoon plus ligand Sticks](../evidence/uploaded-cartoon-ligand-sticks.png).
4. Use File → Fetch, enter `4DJW`, and submit. Confirm the backend-loaded structure reports RCSB/MMCIF provenance, source hash, and the canonical counts observed in the live check: 7,079 atoms, 786 residues, and 9 chains. Evidence: [RCSB 4DJW Cartoon plus ligand Sticks](../evidence/rcsb-4djw-cartoon-ligand-sticks.png).
5. Switch to VDW Surface and confirm the surface reaches the ready state without changing canonical counts. Evidence: [RCSB 4DJW VDW surface](../evidence/rcsb-4djw-vdw-surface.png). The live check reported 6,194 surface targets.
6. Exercise Lines, Sticks, Ball-and-Stick, Space-Filling, Cartoon, Ribbon, Trace, Putty, Non-bonded crosses/spheres, SAS, SES, Mesh, Dots, and Dot Surface. Confirm the inspector reports the selected profile and does not claim unavailable properties.
7. Toggle Protein, Ligand, Water, and Ions independently; rotate, pan, zoom, fit, center, and resize the canvas. Confirm presentation changes do not reload the canonical model.
8. Verify hover, picked, persistent selection, measurement picks, Escape, background clear, measurement history, and Clear selection independently.

Additional live checks included 1CRN Cartoon, Ribbon, VDW, and Dot Surface projections and the required 4DJW RCSB path. The landing page was verified separately so the existing port-5173 application remained outside this repository's runtime.

## Known limitations

- Native 3Dmol surfaces use the renderer's available material/color API; uniform material color can be based on the first resolved canonical target rather than per-atom surface coloring.
- Mesh is a truthful bounded wireframe projection of the VDW surface, and Dots/Dot Surface use a deterministic exposed-point GLShape projection. These are explicit limited profiles, not mislabeled spheres or Cartoon fallbacks.
- SAS and SES currently share the same governed probe-expanded sampling basis while retaining distinct profile identities and cache keys; a future exact solvent topology/triangulation implementation can replace the generator behind the same boundary.
- Ribbon, Trace, and Putty use bounded 3Dmol cartoon styles. Putty is variable-radius only when canonical source B-factors are present; the missing-property state is explicit.
- The current gate does not implement editing, deletion, export, docking, advanced analysis, partial-charge coloring, or selection workflows beyond the interaction foundations required for truthful picking and measurement state.
- Historical G1B/G1C audit and baseline documents still describe their original checkpoint limitations. The current architecture and capability matrices plus this report are the completion-gate status; those historical records were not rewritten into false retrospective results.

VISUALIZATION COMPLETION GATE: PASS
