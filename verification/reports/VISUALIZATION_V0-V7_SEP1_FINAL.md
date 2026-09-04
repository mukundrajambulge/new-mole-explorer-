# Mole Explorer — Visualization V0–V7 Final Verification

Date: 2026-09-01
Repository: `mukundrajambulge/new-mole-explorer-`
Remote: `https://github.com/mukundrajambulge/new-mole-explorer-.git`
Starting SHA: `5693526a955e0199631839985ebf0b92a0f5d4d6`
Ending SHA: `fc0fd3f` (implementation and evidence commit; this report is a documentation-only follow-up)

## V0 — repository and runtime lock

The authoritative local root is `C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation`. The implementation branch is `fix/visualization-final-closure`, with `new-origin` pointing to the required repository. The old `mole-explorer` repository was not modified during this pass.

Verified services:

- Landing: `http://localhost:3100/`
- Workstation: `http://localhost:3101/molstudio`
- API health: `http://localhost:8100/api/health`

The running stack remained available after verification and is serving the current repository.

## Architecture decisions

- The backend canonical structure and provenance remain authoritative in `apps/api/src/structures/ingestion.ts` and the API routes in `apps/api/src/server.ts`.
- UI state is represented as `RenderProjection` in `apps/web/src/rendering/presentationState.ts` and exposed through `apps/web/src/rendering/renderProjection.ts`.
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts` is the only owner of 3Dmol calls. It maintains one viewer per mounted canvas, canonical stable-ID mapping, native surface handles, and camera operations.
- Components render the projection boundary; they do not own canonical molecular data or call 3Dmol directly.
- Presentation-only operations never mutate canonical atoms, bonds, hashes, or source metadata.

## V1 — ligand color fix

`resolveProjectedAtomColor` now applies deterministic precedence:

1. representation-specific explicit override
2. explicit atom color override
3. inherited global scheme
4. neutral CPK/element fallback

HETATM/category status cannot override an explicit ligand color. `color reset, ligand` clears explicit overrides and restores the inherited scheme. Automated coverage includes custom red ligand persistence across Stick, Ball-and-Stick, hide/show, global scheme changes, and reset; live 4DJW evidence is in `16-4djw-ligand-red-persistent.png` and `17-4djw-cartoon-ligand-sticks-final.png`.

## V2 — performance and camera

The adapter separates scene/style, camera, labels, interaction, and background dirty domains. Camera actions do not reapply molecular styles or reload models. Analysis overlays are memoized at the React boundary.

Live 4DJW check: viewer creations `1`, model loads `1`; Fit/Rotate/Pan/Zoom increased render calls while projection rebuilds and model loads remained unchanged. Native surface geometry is cached where the application generates deterministic dot points, and stale surface generations are rejected.

## V3 — analysis and measurements layout

The current left rail contains the required 2×3 Analysis & Interaction grid: H-Bonds, Contacts, Clash, Pocket Unavailable, Surface, and Center. Measurements are in the same card with canonical Distance, Angle, and Dihedral picks. Responsive side-rail reachability is covered by the accepted browser suite.

## V4 — safe custom labels

Labels use a field-template AST in `apps/web/src/interaction/labels.ts`. Only allowlisted canonical fields are resolved. Code-like punctuation and unbalanced braces are rejected with structured `LabelExpressionError` codes; no application label path uses `eval`, `exec`, `Function`, or dynamic code generation. The controlled inspector input preserves the last valid expression after invalid input. Live 4DJW label evidence is `09-4djw-custom-labels-ligand.png`.

## V5–V6 — representation and surface matrix

Live 4DJW results:

| Presentation | Projection | Canonical contributors | Result |
|---|---|---:|---|
| Lines | `line` | 5,582 line segments | ready |
| Sticks | `stick` | 5,582 stick cylinders | ready |
| Ball & Stick | `ball-and-stick` | 6,194 spheres + 5,582 sticks | ready |
| Spheres | `space-filling` | 6,194 spheres | ready |
| Cartoon + ligand Stick | `cartoon` | 6,112 cartoon contributors + ligand target | ready |
| VDW | native `VDW` | 6,194 surface contributors | ready |
| SAS | native `SAS`, 1.4 Å probe profile | 6,194 surface contributors | ready |
| SES | native `SES`, 1.4 Å probe profile | 6,194 surface contributors | ready |
| Mesh | native VDW wireframe | 6,194 mesh contributors | ready |
| Dots | deterministic `DOTS` | 7,172 sampled points | ready |
| Dot Surface | deterministic `DOT_SURFACE` | 6,201 sampled points | ready |

Switching back to Cartoon clears surface state without reloading the canonical model. Renderer opacity remains 0 transparent / 1 opaque in the adapter. Displayed surfaces are presentation geometry, not quantitative SASA/SES results. No executable PyMOL oracle was available in this workspace; exact PyMOL conformance is therefore `ORACLE_PENDING`, and no reference output is claimed.

## V7 — landing and launch

The existing landing server was upgraded in place at `apps/app/src/index.html`. It now introduces Mole Explorer, separates canonical structure state from render projection, labels unsupported capabilities honestly, and provides:

- `Launch App` → `http://localhost:3101/molstudio`
- `Explore 4DJW demo` → `http://localhost:3101/molstudio?demo=4DJW`

The demo link uses the same backend RCSB ingestion path and was verified to load `4DJW.cif` with source metadata. No marketing viewer or duplicate landing system was added.

## Evidence files

Current Sep 1 evidence is under `verification/evidence/september-1-current/`, including empty workstation, RCSB 4DJW, cartoon/ligand sticks, explicit ligand color, custom labels, VDW, SAS, SES, Mesh, Dots, Dot Surface, and landing-page captures. The checked-in correct-repository local upload capture is `verification/evidence/visualization-final/uploaded-protein-cartoon-ligand-sticks.png`.

## Tests and results

- `npm test` — web 55 tests and API 9 tests passed.
- `npm run lint` — all workspaces passed.
- `npm run typecheck` — all workspaces passed.
- `npm run build` — all workspaces passed. Vite reports the known third-party 3Dmol bundle warning about its internal `eval` usage and a large bundle advisory.
- `npx playwright test` — 53 passed.
- Manual API upload of `tests/fixtures/mini-protein.pdb` — canonical PDB structure, provenance, SHA-256, topology, and `renderSource` returned successfully.
- Safe-label static scan of application source — no forbidden executable evaluation constructs found.

## Manual verification steps

1. Open `http://localhost:3100/` and confirm the Mole Explorer landing hierarchy and both CTAs.
2. Select `Explore 4DJW demo` and confirm the workstation loads `4DJW.cif` through the backend.
3. Confirm the empty workstation accepts PDB/mmCIF import and preserves the current structure after a failed load.
4. Set Ligand to Stick, run `color red, ligand`, toggle Ligand off/on, change the global color scheme, then run `color reset, ligand`.
5. Exercise Lines, Sticks, Ball & Stick, Spheres, Cartoon, VDW, SAS, SES, Mesh, Dots, and Dot Surface; confirm status and target diagnostics.
6. Use View → Pan, Rotate, Zoom, Fit, Center, Orient, and Reset; confirm no model reload occurs.
7. Open Labels, enter a valid template, then an unsafe/unbalanced template; confirm invalid input is rejected and the valid template remains.
8. Confirm Pocket, docking, export, and other unavailable operations remain explicitly labeled.

## Known limitations

- Exact PyMOL surface/representation conformance remains `ORACLE_PENDING` without an executable PyMOL reference run.
- 3Dmol native VDW/SAS/SES output is a render projection, not a validated quantitative surface-area calculation.
- RCSB retrieval depends on network availability; failed remote loads are surfaced truthfully and leave the current structure intact.
- The production web bundle remains large because 3Dmol.js is loaded in the workstation path; no marketing 3D scene is loaded on the landing page.

## Final verdict

VISUALIZATION V0–V7 COMPLETE — READY FOR USER ACCEPTANCE
