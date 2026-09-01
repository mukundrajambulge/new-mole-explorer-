# Mole Explorer — V-FINAL visualization closure

## Repository and scope

- Repository: `mukundrajambulge/new-mole-explorer-`
- Local implementation: `outputs/molecular-workstation`
- Branch: `fix/visualization-final-closure`
- Remote used: `new-origin` → `https://github.com/mukundrajambulge/new-mole-explorer-.git`
- Base/start SHA: `8215121464db70e6a99a5000dc802ad977882ea7` for this visualization-correction pass.
- Implementation ending SHA: pending the implementation commit below; the final report commit is recorded in the handoff.
- Legacy application on port 5173: not modified

The attached V-FINAL brief was treated as the implementation gate. Earlier pasted briefs and screenshots were treated as historical context/reference material, not as additional authority to expand this gate into editing, docking, HTS, alignment, or R-PYMOL-07 work.

## Research and architecture consumed

The implementation was checked against the authoritative Drive research and repository architecture for R-PYMOL-02, R-PYMOL-03, R-PYMOL-04, R-PYMOL-05, R-PYMOL-06, IA-03, and IA-06. The research was used for show/hide, representation, color, label, camera, picking, measurement, object/coordinate-state, surface, transparency, and capability semantics.

No authoritative admitted pocket/cavity algorithm was found in the available structural-analysis research. H-bond, contact, and clash behavior is therefore explicitly a Mole Explorer-native bounded diagnostic profile; it is not presented as a full chemistry engine.

The boundary remains:

```text
CanonicalMolecularStructure (backend/domain authority)
        → PresentationState / RenderProjection
        → RenderProjectionDiagnostics / RenderDirectives
        → ThreeDMolViewerAdapter (one per mounted canvas)
        → 3Dmol.js (renderer only)
```

`CameraController` owns semantic Center/Fit/Orient/Reset routing. Stable canonical atom IDs and canonical bond IDs are the only durable targets; 3Dmol indices are renderer-local.

## Implemented corrections

1. Replaced placeholder molecular geometry with the real 3Dmol-backed adapter and retained one authoritative adapter/viewer per mounted canvas.
2. Added deterministic, bounded exposed-point Dots and distinct probe-expanded Dot Surface projections. Large display lists are capped only after canonical geometry/cache generation.
3. Replaced the sparse Mesh lattice with a 3Dmol-native VDW surface in wireframe mode; the projection is an actual renderer mesh and remains qualified as renderer-limited rather than presented as a fake lattice.
4. Set standard surface, mesh, dot, stick, sphere, cartoon, and ribbon defaults to renderer opacity `1` (opaque). Material-only opacity changes reuse geometry.
5. Kept VDW, SAS, and SES distinct by profile ID, probe semantics, target/contributor membership, cache identity, and renderer path. Native 3Dmol surface output is qualified as native/limited.
6. Kept Cartoon, Ribbon, Trace, and Putty on distinct renderer profiles; Putty maps canonical per-residue B-factor values to variable-width oval/tube cartoon geometry and does not fabricate missing values.
7. Kept Lines, Sticks, Ball-and-Stick, Space-Filling, Licorice, Non-bonded crosses, and Non-bonded spheres target-scoped and topology-driven.
8. Preserved transient pick, canonical selection, measurement picks, labels, and measurement annotations as separate interaction state. Large selection markers are capped for renderer safety while canonical membership remains complete.
9. Added canonical chain-label regression coverage and stale-safe measurement kernels.
10. Added bounded canonical-coordinate H-Bond, Contact, and Clash results with stable participants, profile IDs, molecular revision, coordinate context, result counts, and renderer overlays. Clash does not modify coordinates.
11. Kept Pocket truthful as unavailable/research-required because no validated algorithm is admitted.
12. Routed the Surface shortcut through the same canonical presentation style path and Center through `CameraController`.
13. Added surface request generation tokens, geometry/material cache separation, cache hit/miss counters, viewer/model/render counters, bounded overlay/highlight budgets, and stale-result protection.
14. Preserved unavailable toolbar/menu operations as explicit Coming Soon/Unavailable states.
15. Fixed Dot Surface material ownership so sampled points retain the selected canonical color scheme instead of inheriting 3Dmol's default black shape color.
16. Native VDW/SAS/SES/Mesh surfaces now use a canonical-stable-ID color map, so color changes update surface materials without rebuilding the canonical model or silently collapsing to a first-atom color.
17. Made new structures start in Rainbow color mode for an immediately legible polymer-order presentation; CPK and other schemes remain selectable.
18. Made Representation Settings contextual: only controls applicable to the active global/category projections are shown, and unsupported native-surface parameters are not exposed as if they were effective.

## Final visualization matrix

| Capability | Status | Scientific source | Renderer implementation | Manual acceptance test | Known limitation | Compatibility profile |
| --- | --- | --- | --- | --- | --- | --- |
| Lines | IMPLEMENTED_VERIFIED | CanonicalBond topology | 3Dmol line | Display → Lines on loaded fixture | Renderer line width | `canonical-bond-lines.v1` |
| Sticks | IMPLEMENTED_VERIFIED | CanonicalBond topology | 3Dmol stick cylinders | Display → Sticks; contributor count | Renderer bond styling | `canonical-bond-sticks.v1` |
| Spheres | IMPLEMENTED_VERIFIED | Canonical atoms/elements | 3Dmol scaled spheres | Display → Spheres; no stick contributors | Sphere scale is presentation | `canonical-element-spheres.v1` |
| Ball-and-Stick | IMPLEMENTED_VERIFIED | Canonical atoms + bonds | Sticks plus small spheres | Display → Ball & Stick | Fixed small-sphere scale | `canonical-stick-plus-small-sphere.v1` |
| Space-Filling | IMPLEMENTED_VERIFIED | Canonical element VDW radii | Full-radius atom spheres | Ligand-only Space-Filling screenshot | Renderer radius profile | `canonical-element-vdw-full-radius.v1` |
| Cartoon | IMPLEMENTED_VERIFIED | Canonical polymer hierarchy/order | 3Dmol cartoon | 4DJW polymer cartoon | 3Dmol profile | `canonical-polymer-cartoon.v1` |
| Ribbon | SUPPORTED_WITH_LIMITATIONS | Canonical polymer hierarchy/order | 3Dmol cartoon oval profile | Ribbon screenshot and diagnostic | Not exact PyMOL ribbon conformance | `canonical-polymer-ribbon-oval.v1` |
| Trace | SUPPORTED_WITH_LIMITATIONS | Canonical ordered polymer/backbone | 3Dmol cartoon trace profile | Trace screenshot | Renderer trace profile | `canonical-polymer-trace.v1` |
| Putty | SUPPORTED_WITH_LIMITATIONS | Canonical per-residue B-factor | 3Dmol oval/tube cartoon with grouped variable thickness | 4DJW Putty screenshot; varied-B-factor unit coverage | Missing B-factors remain unavailable; exact PyMOL conformance unverified | `canonical-polymer-putty-bfactor.v1` |
| Licorice | IMPLEMENTED_VERIFIED | Canonical atoms + bonds | 3Dmol sticks with licorice radius | Display → Licorice | Fixed presentation radius | `canonical-licorice.v1` |
| Non-bonded crosses | SUPPORTED_WITH_LIMITATIONS | Canonical zero-bond topology | 3Dmol crosses | Eligible count and cross projection | Bounded native diagnostic, not full chemistry | `canonical-zero-bond-crosses.v1` |
| Non-bonded spheres | SUPPORTED_WITH_LIMITATIONS | Canonical zero-bond topology | Small 3Dmol spheres | Eligible count and sphere projection | Bounded native diagnostic | `canonical-zero-bond-spheres.v1` |
| VDW | SUPPORTED_WITH_LIMITATIONS | Element VDW radius profile | 3Dmol native VDW surface | 4DJW VDW screenshot | Native 3Dmol semantics; not PyMOL oracle-verified | `surface.vdw.element-vdw.v1` |
| SAS | SUPPORTED_WITH_LIMITATIONS | Element VDW + explicit probe | 3Dmol native surface with probe | 4DJW SAS screenshot | Presentation surface, not quantitative SASA | `surface.sas.element-vdw.probe-1.4A.v1` |
| SES | SUPPORTED_WITH_LIMITATIONS | Element VDW + explicit probe | 3Dmol native SES path | 4DJW SES screenshot | Native profile, not PyMOL oracle-verified | `surface.ses.element-vdw.probe-1.4A.v1` |
| Mesh | SUPPORTED_WITH_LIMITATIONS | Canonical coordinates + VDW surface profile | 3Dmol-native VDW surface with wireframe material | 1CRN/4DJW Mesh screenshot; ready/count diagnostics | Renderer wireframe and exact PyMOL conformance are unverified | `surface-mesh.v3` |
| Dots | SUPPORTED_WITH_LIMITATIONS | Canonical coordinates + VDW sample profile | Bounded color-batched GLShape point projection | 4DJW colored Dots screenshot; ready/count diagnostics | Display sample only, not SASA | `surface-dots.v1` |
| Dot Surface | SUPPORTED_WITH_LIMITATIONS | Canonical coordinates + probe-expanded samples | Distinct bounded application-native sampled GLShape points | 4DJW Dot Surface screenshot; distinct profile | Mole Explorer-native, not an exact PyMOL token | `surface-dot-surface.v1` |
| Colors | IMPLEMENTED_VERIFIED | Canonical atom/property availability | Shared color registry and atom color state | Scheme switching and missing-data diagnostics | Some scientific color datasets unavailable | Color registry profile IDs |
| Transparency | IMPLEMENTED_VERIFIED | Presentation-only material state | 3Dmol material/shape opacity | Surface opacity slider; no geometry rebuild | Native material limits | `renderer-opacity-1-opaque.v1` |
| Visibility | IMPLEMENTED_VERIFIED | Canonical category membership | Shared Protein/Ligand/Water/Ions/Other masks | Toggle layers; counts unchanged | Presentation only | `canonical-component-visibility.v1` |
| Labels | SUPPORTED_WITH_LIMITATIONS | Canonical chain/residue/atom identity | 3Dmol labels projected from stable targets | 4DJW chain labels; repeated mode changes | Large atom labels bounded by policy | `canonical-label-targets.v1` |
| Picking | IMPLEMENTED_VERIFIED | Reverse identity map to canonical atom | 3Dmol click/hover callbacks | Selected and cleared-pick screenshots | Renderer picking depends on visible geometry | `canonical-pick-reverse-map.v1` |
| Selection | IMPLEMENTED_VERIFIED | Canonical stable atom membership | Subtle grouped renderer highlight markers | Command selection and Clear Selection | Large marker list capped for performance | `canonical-selection-markers.v1` |
| Measurements | SUPPORTED_WITH_LIMITATIONS | Canonical coordinate kernels | Separate measurement GLShape annotations | Distance/angle/dihedral mode, hide/show/delete UI and unit tests | Full four-result live history screenshot was not deterministic in browser automation | `canonical-coordinate-kernel.v1` |
| H-Bonds | SUPPORTED_WITH_LIMITATIONS | Mole Explorer-native bounded donor/acceptor geometry | Bounded overlay connectors | H-Bonds action, result count/profile, screenshot | Donor/acceptor heuristic; explicit-H angle may be null | `analysis.h-bond.distance-3.5A.inferred-donor-acceptor.v1` |
| Contacts | SUPPORTED_WITH_LIMITATIONS | Mole Explorer-native heavy-atom nonbonded distance | Bounded overlay connectors | Contacts action, result count/profile, screenshot | Not full residue/contact chemistry | `analysis.contact.heavy-atom-distance-4.0A.nonbonded.v1` |
| Clash | SUPPORTED_WITH_LIMITATIONS | Mole Explorer-native VDW overlap geometry | Bounded red/orange overlay connectors/markers | Clash action, result count/profile, screenshot | Fixed VDW overlap criterion; no coordinate repair | `analysis.clash.heavy-atom-vdw-overlap-0.4A.nonbonded.v1` |
| Pocket | UNAVAILABLE / RESEARCH_REQUIRED | No admitted validated algorithm | No false renderer implementation | Pocket button shows truthful unavailable notice | Must await validated cavity method | `pocket.no-admitted-algorithm.v1` |
| Center | IMPLEMENTED_VERIFIED | Canonical target membership | Semantic CameraController → adapter → 3Dmol center | Center action and camera diagnostic | Camera is renderer state | `camera.center.semantic-controller.v1` |

## Automated tests and results

All commands completed successfully from the repository root after the final source changes:

- `npm test`: PASS — web 14 files / 54 tests; API 2 files / 9 tests.
- `npm run lint`: PASS — API, app, web, and contracts with zero warnings allowed.
- `npm run typecheck`: PASS — all workspaces.
- `npm run build`: PASS — all workspaces and Vite production build. Non-blocking existing warnings: 3Dmol bundle uses `eval`; the main JS chunk exceeds 500 kB.
- `npm run test:e2e`: PASS — 53 tests with the repository's bounded two-worker WebGL configuration, including all existing accepted UI tests and the added rapid-switching/contextual-settings regressions.

The V-FINAL E2E coverage checks bounded H-Bonds/Contacts/Clash and truthful Pocket state; distinct VDW/SAS/SES/Mesh/Dots/Dot Surface profile readiness; opacity-only material changes without model/surface-generation rebuild; CameraController Center and chain-label cardinality; and clean local-upload evidence capture.

## Manual localhost acceptance

Deterministic local services used:

- Landing: `http://localhost:3100`
- Workstation: `http://localhost:3101/molstudio`
- API: `http://localhost:8100`
- Legacy `http://localhost:5173`: left untouched.

Manual 4DJW was fetched through File → Fetch using the official backend RCSB mmCIF workflow. The loaded source was `4DJW.cif`, `RCSB · MMCIF`, with SHA-256 prefix `c816a3b9e9…`. Live canonical counts were 7,079 atoms, 786 residues, 9 chains, 6,112 polymer atoms, 82 ligand/non-polymer atoms, 885 waters, and 0 ions. The canonical model-load diagnostic remained `1` while switching presentation styles.

Verified manually from the running workstation:

- empty real viewer state with no preview geometry;
- local uploaded protein and ligand presentation;
- RCSB 4DJW polymer Cartoon with ligand Sticks;
- Cartoon, Ribbon, Trace, and Putty profile screenshots;
- ligand-only Space-Filling;
- Non-bonded crosses and spheres diagnostics;
- VDW, SAS, SES, native wireframe Mesh, color-aware Dots, and Dot Surface profile transitions;
- transparent surface material state;
- selected canonical atom and cleared transient pick;
- chain labels with one label per chain;
- H-Bonds, Contacts, Clash result panels and overlays;
- Pocket truthful unavailable state;
- Center camera action and unchanged model-load count.

Measurement kernels, stable participants, stale revision handling, visibility, and delete behavior are covered by frontend unit tests and the existing V2 interaction acceptance test. A full four-result live measurement-history screenshot was not captured deterministically in the in-app browser, so that is recorded as a limitation rather than claimed as manual evidence.

## Performance and invalidation evidence

The adapter exposes diagnostics for viewer creation, model loads, scene rebuilds, render calls, surface generations, mesh generations, dot generations, surface cache hits/misses, stale surface results, rendered surface point count, label count, canonical contributor counts, pick/selection state, and camera action.

The E2E runner is intentionally limited to two concurrent Chromium contexts because real 3Dmol surface generation is GPU/memory intensive on the supported local runner; this keeps the visual acceptance suite repeatable.

The final E2E suite verifies presentation changes do not recreate the canonical model and opacity changes do not regenerate surface geometry. Cache keys include structure/revision, coordinate context, target/contributor membership, profile, probe/quality/sampling inputs; color/opacity are material dependencies. Generation tokens prevent stale asynchronous surface results from replacing a current projection.

## Evidence screenshots

All files are under `verification/evidence/visualization-final/`:

`empty-workstation.png`, `uploaded-protein-cartoon-ligand-sticks.png`, `rcsb-4djw-cartoon-ligand-sticks.png`, `polymer-cartoon.png`, `polymer-ribbon.png`, `polymer-trace.png`, `polymer-putty.png`, `current-putty-corrected.png`, `current-default-rainbow-1crn.png`, `space-filling-ligand-only.png`, `nonbonded-crosses.png`, `nonbonded-spheres.png`, `surface-vdw.png`, `surface-sas.png`, `surface-ses.png`, `current-sas-1crn-corrected.png`, `current-native-mesh-collapsed.png`, `current-mesh-1crn-corrected.png`, `surface-dots.png`, `current-colored-dots.png`, `surface-dot-surface.png`, `current-colored-dot-surface.png`, `surface-transparent.png`, `selected-pick.png`, `cleared-pick.png`, `chain-labels.png`, `analysis-h-bonds.png`, `analysis-contacts.png`, `analysis-clash.png`, and `analysis-pocket-unavailable.png`.

## Known limitations and explicit non-scope

- H-Bonds use a bounded donor/acceptor heuristic; explicit hydrogen absence can leave angle data null. Contacts and clashes are bounded frontend geometric diagnostics, not the future backend full-chemistry analysis service.
- VDW/SAS/SES use 3Dmol-native profiles and are not claimed as exact PyMOL conformance or quantitative SASA/SES results.
- Mesh is a 3Dmol-native VDW wireframe projection and is not claimed as exact PyMOL mesh conformance or as a quantitative surface result. Dots and Dot Surface are bounded presentation sampling and must not be read as quantitative area values.
- Large analysis overlays and selection markers have renderer budgets; canonical result membership remains complete.
- Pocket remains unavailable until a validated/admitted cavity algorithm is supplied.
- Full live four-result measurement-history capture was not deterministic in browser automation; canonical measurement behavior is unit-tested and the existing V2 measurement interaction path passes.
- No selection/editing, docking, HTS, alignment, R-PYMOL-07, or unrelated feature family was started.
- The production build retains the upstream 3Dmol `eval` warning and large-bundle warning noted above.

## Git and push

Source, tests, docs, and evidence are ready to be committed on `fix/visualization-final-closure`. The implementation commit SHA and final remote verification are recorded in the handoff after the commit/push step.

VISUALIZATION FINAL CLOSURE: PASS
