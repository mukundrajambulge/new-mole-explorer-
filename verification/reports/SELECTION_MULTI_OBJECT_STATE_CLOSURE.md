# Selection + multi-object / multi-state closure report

## Verdict

**SELECTION + MULTI-OBJECT/MULTI-STATE CLOSURE INCOMPLETE — BLOCKED**

The implementation paths, live regressions, multi-object workspace, multi-state rendering, and visualization regression suite pass in the authoritative repository. Cross-object spatial queries now require and record an explicit coordinate-frame policy; every coordinate-dependent selection also records the exact per-object coordinate state scope consulted, including cached and bound plans. The pinned PyMOL source has executed against the shared fixture for 85 direct forms: 79 pass and 6 return native errors; the comparison ledger promotes only exact forms or documented aliases. The application now also binds RenderProjection representation, color, label, and representation-specific color selectors, evaluates canonical fragment assignments and bounded ring topology without renderer-derived shortcuts, implements a versioned VDW surface-gap profile with strict missing-radius handling, binds `pepseq` to a revision-stamped canonical one-letter peptide sequence dataset, preserves source-backed crystallographic unit-cell parameters for bounded `bycell` membership, retains the actual official remote retrieval provider and URI when RCSB falls back to the wwPDB partner endpoint, promotes complete source-declared mmCIF partial charges without inference, exposes strict revision-bound canonical chemistry-role and fragment-assignment dataset boundaries for `donors`/`acceptors` and `byfragment`, and never fabricates scientific datasets when those fields are absent. Dynamic arbitrary-property evaluation is explicitly unavailable and is covered by the pinned native rejection of `foo = bar`. The gate remains blocked because 1 of the 87 matrix rows remains oracle-pending, alongside explicitly unsupported or dependency-gated operators. Unsupported and dependency-gated operators remain fail-closed and are not presented as scientifically implemented.

## Repository and run evidence

- Repository: `mukundrajambulge/new-mole-explorer-`
- Remote: `new-origin https://github.com/mukundrajambulge/new-mole-explorer-.git`
- Local root: `C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation`
- Branch: `fix/visualization-final-closure`
- Starting SHA for this closure pass: `27610d35980b2d233e4f97f240ccdbd6439e5d39`
- Previous implementation commits: `467313d436b3686443fee5a0ae3237b5ff97451e` (presentation/topology profiles) and `364ec00` (versioned VDW gap profile)
- Current implementation commit: `6396c17` (`Add source-backed partial charge ingestion`)
- Ending implementation/evidence SHA: `68593df21301b77c38afe6b0a59006995ae875ca`
- Working tree: clean after the implementation/evidence commit; no unrelated files were changed
- Development UI: `http://localhost:3101/molstudio`
- Landing app: `http://localhost:3100`
- API health: `http://localhost:8100/api/health`
- Port `5173` is intentionally untouched/reserved for the legacy application; it is not the authoritative workstation.

## User-reported failures

- `select all`: **Root cause** — console input did not have a guaranteed typed route into the canonical selection evaluator. **Fix** — the InputRouter now classifies the command verb first and sends `select` arguments to the same canonical engine used by bare selections. **Live result** — on 4DJW, the real console selects the loaded canonical universe of 7,079 atoms, updates the active-selection panel/footer/viewer, and remains reusable by later presentation commands.
- `chain A and protein`: **Root cause** — a bare selection expression was previously treated as an unsupported command path. **Fix** — non-command input is routed directly to the canonical selection parser. **Live result** — the real console selects 3,060 atoms on 4DJW with visible feedback and no `UNKNOWN_COMMAND` diagnostic.
- Additional failures discovered and closed: selection feedback was not consistently synchronized with viewer membership; presentation selectors could be confused with scientific `all`; topology expansion could be mistaken for renderer geometry; cross-object spatial queries lacked an explicit coordinate frame; and multi-state selection could lose its state scope. These now have canonical metadata, live regressions, or explicit fail-closed diagnostics.
- `RCSB` fetch: **Root cause** — the primary `files.rcsb.org` edge can time out in the local runtime. **Fix** — the backend now tries the official RCSB mmCIF endpoint first, then the official wwPDB partner PDBe endpoint with a bounded timeout, recording `provider`, URI, byte length, and SHA-256. **Live result** — `1CRN` and `4DJW` load successfully through the fallback path without replacing the current workspace on failure.

## Reproduced failures and live results

The current application was exercised with a real 4DJW RCSB load:

- `select all` selected **7,079 atoms** and remained the active selection.
- Bare `chain A and protein` selected **3,060 atoms**. It is routed by the typed InputRouter to the canonical selection parser, not the command parser.
- The active-selection panel, status bar, and viewer all reported the same live membership hash for both selections; selection marker geometry was capped at 128 atoms while the full stable-ID membership remained in the canonical projection.
- Running `show sticks, all` after each live selection preserved the active membership hash.
- On the same real 4DJW selection, `color red, all` preserved membership, `center all` and `zoom all` routed to the camera adapter, and `unpick` removed the active selection card and viewer indicator without changing the loaded structure.
- A second live RCSB load (`1CRN`) was added without replacing 4DJW. Both objects rendered in one mounted viewer and `object 4DJW.cif` selected 7,079 atoms.

## Architecture decisions

- Backend canonical structure, topology, coordinates, provenance, source hash, and coordinate-state metadata remain the scientific authority.
- Source-backed unit-cell parameters remain attached to their canonical object; multi-object selection views carry an object-qualified cell scope and never reuse the first object’s cell for unrelated atoms.
- `RenderProjection` is the renderer-neutral presentation boundary consumed by `ThreeDMolViewerAdapter`; UI components do not own 3Dmol scientific state.
- Partial-charge selection, color, and labels require complete finite atom coverage from a revision-matched canonical dataset; stale or incomplete datasets fail closed and cannot yield partial scientific results.
- Partial-charge selection, color, labels, UI diagnostics, and cache identity share one validation boundary requiring non-empty dataset metadata, exact atom coverage, finite values, and revision binding.
- `donors` and `acceptors` consume only a complete `canonical-chemistry-roles-v1` dataset whose molecular revision matches the canonical structure; the evaluator records the scientific profile and fails closed when admitted PDB/mmCIF sources do not provide it. No bond-order, protonation, tautomer, or renderer-derived heuristic is promoted to scientific state.
- `byfragment` consumes only a complete `canonical-fragment-assignment-v1` dataset whose molecular revision matches the canonical structure; derived and multi-object selection views remap those assignments by stable ID and keep fragments object-scoped. Per-atom hints, connected components, and coordinates are not used as fallbacks.
- Chemistry-role and fragment validators require non-empty dataset identity/provenance metadata in addition to revision and atom-membership coverage; workspace aggregation uses the same validators before exposing a derived dataset.
- `pepseq` consumes only the revision-matched `canonical-peptide-sequence-v1` dataset produced by ingestion and propagated through derived-object workflows; the evaluator does not infer sequence from renderer state or a residue-name heuristic at query time.
- Workspace peptide-sequence datasets namespace each object and residue ID, so identical chain/residue labels in separate objects cannot collide; the multi-object regression selects the expected 8 atoms from the protein object only.
- One mounted molecular canvas owns one authoritative adapter/viewer instance. Multiple workspace objects become separate 3Dmol models within that viewer.
- Durable `ObjectID`, display name, and renderer model identity are distinct. Duplicate names require an ObjectID and never silently select the first match.
- Multi-object selection uses a derived workspace universe containing every loaded object, including disabled presentation objects, with object-scoped atom IDs; source canonical IDs are unchanged. `enabled` and `visible` remain separate presentation-scoped selectors.
- `bymolecule` expands canonical bond connected components. `byfragment` is a separate canonical fragment-assignment operation: it requires a complete revision-matched `CanonicalFragmentDataset` and never falls back to per-atom hints, connected components, or coordinates.
- Coordinate states use explicit `CoordinateStateID` and `StateOrder`. One-state structures receive a compatibility singleton state; renderer model order is never treated as scientific state identity.
- Canonical polymer typing uses mmCIF `_entity_poly.type` joined by `_atom_site.label_entity_id`, is included in the scientific revision/provenance, survives derived object workflows, and fails closed when absent or incomplete; no residue-name whitelist is used.
- Remote structure ingestion prefers the official RCSB mmCIF endpoint and falls back only to the official wwPDB partner PDBe mmCIF endpoint when the primary retrieval is unavailable; the canonical source records the provider and exact URI used.
- `all_states` is bounded to explicit auxiliary state models. State changes reconcile model coordinates in place when layout is unchanged.
- Coordinate-dependent selection results carry sorted per-object `stateScopes` with `{ObjectID, CoordinateStateID, StateOrder}`; state-dependent live selection changes are therefore distinguishable even when molecular topology/revision is unchanged.
- Cartesian spatial comparisons use the centralized `cartesian-float64-v1` closed-boundary policy with an explicit squared-distance numerical epsilon; the epsilon is numerical protection, not a scientific cutoff expansion.
- VDW gap selection uses the versioned `canonical-element-vdw-radius@1` property source and a separate strict surface-gap tolerance policy. The renderer’s convenience fallback is never used by scientific selection; unknown element radii return `MISSING_DEPENDENCY`.
- Object `copy` deep-clones presentation/load containers, preserves canonical source, state order, current state, enablement, and projection, and receives a new durable ObjectID with explicit lineage. `create` materializes selected atoms with new stable identities and source correspondence; `split_states` creates bounded one-state objects; `join_states` accepts only strict ordered atom/topology correspondence. Failed or incompatible operations are non-destructive.
- Workspace groups provide stable organizational membership with create/add/remove/open/close/toggle/empty operations. Group actions do not mutate canonical molecular data; destructive purge/excise/delete remain unavailable.
- Cross-object spatial evaluation has an explicit `CoordinateFramePolicy`: `LOCAL_SCIENTIFIC` compares raw canonical Å coordinates, while `EFFECTIVE_WORLD` currently uses the declared identity object transforms. The policy is recorded in `SelectionResult` and `BoundSelectionPlan`; an undeclared cross-object query fails closed.
- Bare workspace object names and group names resolve through the same canonical selection engine as explicit `object` predicates. Named snapshots retain precedence, and ambiguous object/group names produce a structured diagnostic.
- Workspace presentation commands are applied per canonical object scope. The viewer adapter projects each object’s representation directives onto its own model, and single-object disable/enable transitions stay in the same workspace projection path.
- Selection cache identity includes canonical selector fields and workspace namespace metadata, including durable object ID, mutable display name, segment identity, and coordinate-state annotations; renaming cannot reuse a stale object-name result.
- Failed loads are non-destructive: the current workspace and viewer remain intact.

## Operator matrix

The machine-readable ledger is [selection-operator-matrix.json](../selection/selection-operator-matrix.json), generated from [SELECTION_OPERATOR_MATRIX.md](../selection/SELECTION_OPERATOR_MATRIX.md).

- Rows: **87**
- Implementation: **83 VERIFIED_WORKING**, **3 MISSING_DEPENDENCY**, **1 INTENTIONALLY_UNSUPPORTED**
- Live-browser status: **90 pass/accepted diagnostic outcomes** across the expanded matrix exercise
- Live evidence: [selection-live-evidence.json](../selection/selection-live-evidence.json) records all **90** attempts, with **0 browser-console errors, 0 page errors, 0 network failures, 0 atom-count mismatches, 0 viewer/panel membership mismatches**, and subsequent targeting checks retaining the active selection hash.
- `in`, `bycalpha`, `bymolecule`, `byfragment`, `byring`, and `bycell` now use canonical tuple, residue-CA, connected-component, canonical-fragment-assignment, bounded-cycle, and source-backed fractional-cell-membership semantics respectively. `visible` is now bound to an explicit presentation context derived from render directives; `rep`, `color`, `label`, `cartoon_color`, and `ribbon_color` are likewise evaluated from the current RenderProjection and never from 3Dmol internals. Generic atom color and representation-scoped color are separate namespaces; `set cartoon_color|ribbon_color, <color>, <query>` is the explicit representation-scoped mutation path. These selectors never alias scientific `all`. `like`, the application implicit-adjacency profile, and the new spatial/topology forms are live-verified; malformed shorthand and missing scientific dependencies remain truthful diagnostics.
- Oracle comparison ledger: **51 ORACLE_PASS**, **35 ORACLE_EQUIVALENT**, **1 ORACLE_PENDING** across the 87-row comparison ledger; the full direct probe is [pymol-matrix-probe.json](../selection/pymol-matrix-probe.json) (**85 forms: 79 successful, 6 native errors**). The positive partial-charge probe is recorded in [pymol-partial-charge-oracle.json](../selection/pymol-partial-charge-oracle.json). The arbitrary-property row is explicitly unsupported and equivalent to the pinned native rejection of `foo = bar`.
- Exact-oracle reproduction: **PASS** in the local Ubuntu-20.04 compatibility environment using the pinned source commit; PyMOL **3.2.0a**, 85 forms, 79 successful and 6 native errors, with row payloads byte-identical to the committed direct probe. The comparison ledger now contains 57 selected exact/equivalent rows, including fixture-scoped partial-charge, formal-charge, B-factor, secondary-structure, segment-identity, alternate-location, ring-topology, backbone-partition, numeric-comparison, alias, inequality, label, representation, visibility, color, ribbon-color, workspace-group, and duplicate-name identity-safety cases.
- Pinned oracle evidence: [pymol-oracle-results.json](../selection/pymol-oracle-results.json); runner: [run-pymol-oracle.py](../selection/run-pymol-oracle.py)
- Presentation-oracle reproduction: **PASS** for the explicit mini-fixture baseline (solvent hidden; protein cartoon; ligand sticks; ion spheres) plus a separate active protein ribbon case with 4 rows (`visible`, `color red`, `cartoon_color red`, `ribbon_color red`); evidence: [pymol-presentation-oracle.json](../selection/pymol-presentation-oracle.json); runner: [run-pymol-presentation-oracle.py](../selection/run-pymol-presentation-oracle.py). The fixture-scoped hashes are recorded in the comparison ledger, including matching 8-atom Cartoon/Ribbon memberships.
- Missing dependency and research rows are explicit gates. No unsupported operator is silently aliased to a different scientific meaning.

## Commands

- Bare selection input, `select`, named selections, `show`, `hide`, `color`, `label`, view, and measurements: **PASS** through the typed console boundary; `select label …` resolves against the active safe-label projection.
- `rename` / `set_name`, `copy`, `create`, `split_states`, and strict `join_states`: **PASS** with durable identity and lineage; invalid or incompatible operations are non-destructive.
- `enable` / `disable`, `state`, `frame`, `all_states`, and `count_states`: **PASS** with explicit per-object state order.
- `group create|add|remove|open|close|toggle|empty`: **PASS** as organizational state; destructive `purge`, `excise`, and `delete` remain unavailable.
- `coordinate_frame local_scientific|effective_world`: **PASS**; the policy is visible in the workspace and included in spatial selection metadata.
- Cross-object spatial selection: **PASS when explicitly declared; fail-closed without a declared coordinate frame**.
- State-dependent coordinate predicates: **PASS**; live `x < 1.5` changes from 3 atoms in state 1 to 1 atom in state 2, and live `within 1.5 of name N` changes from 2 atoms in state 1 to 1 atom in state 2 while exposing the consulted state scope in the active-selection panel.
- Source-backed `bycell` selection: **PASS** for the bounded fractional-cell-membership profile; PDB `CRYST1` and mmCIF `_cell` parameters are preserved canonically, the live fixture selects the same two atoms as pinned PyMOL, and a multi-object regression proves each object uses its own cell scope. Symmetry-mate/PBC expansion is intentionally not claimed.
- Canonical segment, alternate-location, occupancy, and B-factor identity: **PASS**; `segi SEG_A` and `bysegi segi SEG_A` select source-backed segments, while `alt A`, `b > 20`, and `q >= 0.5` use the preserved canonical fields. PDB segment and alternate-location membership match the pinned identity fixture exactly.
- Canonical formal charge and secondary structure: **PASS**; source charge predicates and PDB HELIX/SHEET predicates select positive live subsets without renderer-derived values. Strict/inclusive numeric comparisons are covered on formal charge, B-factor, and coordinates; direct `!=` spelling remains an explicit PyMOL parser difference documented as an equivalent complement.
- Presentation-dependent selection: **PASS** for effective `rep`, `color`, and `label`, plus explicit representation-scoped `cartoon_color` and `ribbon_color` selectors; generic atom color no longer leaks into representation-specific selectors. The selection result records the projection revision and remains stable under subsequent targeting.
- Canonical fragment/ring topology: `byring` **PASS** for the declared bounded-cycle profile; `byfragment` is **MISSING_DEPENDENCY** until an admitted source supplies complete canonical fragment assignments. The ring fixture’s six-atom expansion is oracle-equivalent to pinned PyMOL `byring organic`; no connected-component fallback is exposed as `byfragment`.
- Partial-charge selection: **PASS** when the input mmCIF supplies complete `_chem_comp_atom.partial_charge` values for every loaded atom; the API copies those source values into a revision-bound dataset with explicit model/units/provenance and does not infer charges. Inputs without a complete source loop remain fail-closed.
- VDW surface-gap selection: **PASS** for the declared `canonical-element-vdw-radius@1` profile; non-empty and valid-empty live cases are covered, and unknown radius data fails closed without changing the workspace.
- Peptide sequence selection: **PASS** for the declared `canonical-peptide-sequence-v1` profile; `pepseq AG` selects the complete canonical residue atoms in the uploaded two-residue fixture, while invalid values fail with `INVALID_VALUE`.
- Canonical PDB property selection: **PASS** for source formal charge, B-factor, and HELIX/SHEET secondary-structure assignments in the live `typed-properties.pdb` fixture; missing-property behavior remains fail-closed on the minimal fixture.

## Files changed in this closure

Application/contracts:

- Latest fragment-authority hardening: `packages/contracts/src/index.ts`, `apps/web/src/selection/selectionEngine.ts`, `apps/web/src/selection/selectionEngine.test.ts`, `apps/web/src/workspace/workspaceModel.ts`, and `apps/web/src/workspace/workspaceModel.test.ts`
- Latest partial-charge authority hardening: `apps/web/src/science/datasetValidity.ts`, `apps/web/src/rendering/colorSchemes.ts`, `apps/web/src/interaction/labels.ts`, and `apps/web/src/rendering/presentationState.ts` with corresponding regression tests
- Latest source-declared partial-charge ingestion: `apps/api/src/structures/ingestion.ts`, `apps/api/src/structures/ingestion.test.ts`, `tests/fixtures/source-partial-charge.mmcif`, and the live console coverage in `tests/e2e/selection-closure.spec.ts`
- Latest malformed-dataset guard: `apps/web/src/science/datasetValidity.ts` and `apps/web/src/science/datasetValidity.test.ts`; malformed optional charge, fragment, and chemistry-role payloads now fail closed without throwing
- `apps/api/src/structures/ingestion.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/rendering/colorSchemes.ts`
- `apps/web/src/rendering/colorSchemes.test.ts`
- `apps/web/src/components/StatusBar.tsx`
- `apps/web/src/commands/commandRegistry.test.ts`
- `apps/web/src/commands/commandRegistry.ts`
- `apps/web/src/components/ContextToolbar.tsx`
- `apps/web/src/components/MolecularCanvas.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/interaction/measurements.ts`
- `apps/web/src/interaction/picking.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/rendering/surfaceGenerator.ts`
- `apps/web/src/rendering/surfaceProfiles.ts`
- `apps/web/src/science/vdwRadii.ts`
- `apps/web/src/selection/selectionEngine.ts`
- `apps/web/src/selection/selectionEngine.test.ts`
- `apps/web/src/selection/spatialPolicy.ts`
- `apps/web/src/interaction/selectionResolver.ts`
- `apps/web/src/styles/global.css`
- `apps/web/src/workspace/workspaceModel.ts`
- `apps/web/src/workspace/workspaceModel.test.ts`
- `apps/api/src/structures/ingestion.ts`
- `apps/api/src/structures/ingestion.test.ts`
- `tests/fixtures/unit-cell.pdb`
- `packages/contracts/src/index.ts`
- `package.json`

Verification:

- `tests/e2e/multi-object-state.spec.ts`
- `tests/e2e/g1c-visualization.spec.ts`
- `tests/fixtures/multistate.pdb`
- `tests/e2e/real-structure-workspace.spec.ts`
- `tests/e2e/selection-closure.spec.ts`
- `tests/e2e/selection-matrix-live.spec.ts`
- `tests/fixtures/mini-protein.pdb`
- `tests/fixtures/ring-ligand.pdb`
- `tests/fixtures/typed-nucleic.mmcif`
- `tests/fixtures/edge-identity.mmcif`
- `tests/fixtures/typed-properties.pdb`
- `tests/fixtures/source-partial-charge.mmcif`
- `tests/fixtures/segment-identity.pdb`
- `tests/fixtures/sidechain-identity.pdb`
- `verification/selection/SELECTION_OPERATOR_MATRIX.md`
- `verification/selection/generate-matrix-summary.mjs`
- `verification/selection/selection-operator-matrix.json`
- `verification/selection/pymol-oracle-results.json`
- `verification/selection/pymol-partial-charge-oracle.json`
- `verification/selection/pymol-byfragment-source.md`
- `verification/selection/pymol-object-identity-source.md`
- `verification/selection/pymol-presentation-oracle.json`
- `verification/selection/pymol-matrix-probe.json`
- `verification/selection/run-pymol-oracle.py`
- `verification/selection/run-pymol-presentation-oracle.py`
- `verification/selection/selection-live-evidence.json`
- `verification/evidence/closure-empty-state.png`
- `verification/evidence/closure-uploaded-cartoon-ligand-sticks.png`
- `verification/evidence/closure-rcsb-1crn-cartoon.png`
- `verification/evidence/closure-4djw-two-objects.png`
- `verification/evidence/closure-responsive-canvas.png`
- `verification/evidence/selection-object-create.png`
- `verification/evidence/selection-state-lineage.png`
- `verification/evidence/selection-multi-object-surfaces.png`
- `verification/evidence/selection-bycell.png`
- `verification/evidence/selection-cross-object-spatial.png`
- `verification/evidence/selection-polymer-nucleic-mmcif.png`
- `verification/evidence/selection-console-matrix.png`
- `verification/evidence/selection-ribbon-color.png`
- `verification/evidence/visualization-final/space-filling-ligand-only.png`
- this report

## Multi-object closure

- Durable object registry and duplicate-name ambiguity handling: **PASS**
- Simultaneous objects in one mounted viewer: **PASS**
- Independent object enable/disable and projection/style/color state: **PASS**
- Object-qualified console representation/color targeting and single-object disable/enable synchronization: **PASS**
- Cross-object selection and object-qualified queries: **PASS**
- Scientific `all` versus presentation `enabled` scope after disabling one object: **PASS**
- Reverse picking identity map with object and coordinate-state context: **PASS**
- Object/state-scoped surfaces and unrelated-state cache isolation: **PASS**; VDW, SAS, SES, Mesh, Dots, and Dot Surface are each projected independently to two objects.
- Object-scoped measurement picks reject mixed-object ambiguity and resolve against the canonical target object: **PASS**
- Create-from-selection with new atom identities and lineage: **PASS**
- Bounded split_states first/last/prefix semantics: **PASS**
- Strict join_states correspondence and topology validation: **PASS**
- Non-destructive organizational group lifecycle: **PASS**
- Bare object and group-name resolution: **PASS** through the canonical workspace selection context
- Workspace-scoped `pepseq`: **PASS**; object and residue namespaces remain distinct when multiple canonical objects share one viewer.
- Cross-object spatial selection with `LOCAL_SCIENTIFIC` or `EFFECTIVE_WORLD`: **PASS**; undeclared policy remains **fail-closed with a structured dependency diagnostic**

## Multi-state closure

- `CoordinateStateID`, `StateOrder`, typed `StateSelector`, `ObjectDisplayState`, and `FrameStateResolver`: **PASS**
- Multi-model PDB and mmCIF ingestion coverage: **PASS**
- Source-backed mmCIF polymer entity typing and `polymer.nucleic` / typed `polymer.protein` selection: **PASS**; untyped sources remain fail-closed
- Explicit state UI, state commands in both accepted argument orders, and bounded `all_states`: **PASS**
- In-place state coordinate replacement without duplicate models: **PASS**
- State-aware derived selection metadata and state-dependent spatial/numeric selection scopes: **PASS**; state 1/state 2 live regressions are `x < 1.5`: 3 atoms → 1 atom and `within 1.5 of name N`: 2 atoms → 1 atom.
- Heterogeneous object/state layout reconciliation: **PASS**
- split_states and join_states preserve source-state lineage: **PASS**

## Visualization regression closure

- Real 3Dmol viewer lifecycle and no duplicate models on remount: **PASS**
- Lines, Sticks, Spheres, Ball & Stick, Cartoon, Ribbon/Trace/Putty profiles: **PASS / explicitly limited where applicable**
- Protein Cartoon, organic ligand sticks, ion spheres, and presentation-only water hiding: **PASS**
- Independent representation, color, visibility, view, background, and labels: **PASS**
- VDW/SAS/SES/Mesh/Dots/analysis overlays and surface cache behavior: **PASS / bounded profiles**
- Resize, rotate, pan, zoom, focus, center, orient, origin, and reset: **PASS**
- Responsive narrow layout keeps the real 3Dmol canvas measurable and visible after side-panel collapse: **PASS**
- Unavailable toolbar/menu features: **explicit Coming Soon/Unavailable**

## Tests and results

- `npm run typecheck` — **PASS**
- `npm run lint` — **PASS**
- `npm test` — **PASS: web 18 files / 93 tests; API 2 files / 20 tests**
- `npm run test --workspace @molecular/web -- src/selection/selectionEngine.test.ts src/workspace/workspaceModel.test.ts` — **PASS: 2 files / 30 tests; missing, stale, incomplete, and multi-object fragment datasets are covered**
- `npm run test --workspace @molecular/web -- src/selection/selectionEngine.test.ts src/rendering/colorSchemes.test.ts src/interaction/labels-picking.test.ts src/rendering/presentationState.test.ts` — **PASS: 4 files / 43 tests; shared partial-charge validation and cache/UI diagnostic paths are covered**
- `npm run test --workspace @molecular/web -- src/selection/selectionEngine.test.ts src/workspace/workspaceModel.test.ts` — **PASS: 2 files / 30 tests; chemistry-role and fragment provenance/coverage gates are covered**
- `npm run verify:selection-matrix` — **PASS: 87 rows; JSON regenerated**
- `npx playwright test tests/e2e` — **PASS: 82 / 82**
- `npx playwright test tests/e2e/selection-matrix-live.spec.ts` — **PASS: 1 / 1; 90 live queries**
- Fresh live rerun after the shared dataset-validator changes — **PASS: 1 / 1; 90 live queries; 1.3 minutes; exit 0**
- `npx playwright test tests/e2e/multi-object-state.spec.ts` — **PASS: 11 / 11**
- `npx playwright test tests/e2e/real-structure-workspace.spec.ts` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/closure-evidence.spec.ts` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "source-backed mmCIF polymer typing"` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "canonical mmCIF segment identity"` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "ring topology"` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "formal charge"` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "source-declared mmCIF partial charges"` — **PASS: 1 / 1; complete source values selected through the real console**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "PDB segment identity"` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "sidechain"` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "presentation-dependent"` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/selection-closure.spec.ts --grep "source-backed unit-cell"` — **PASS: 1 / 1; PDB CRYST1 fixture and `bycell name CA` select 2 atoms**
- `npx playwright test tests/e2e/selection-closure.spec.ts tests/e2e/g1c-visualization.spec.ts tests/e2e/v-final.spec.ts --grep "presentation-dependent|component colors|custom labels|G1C-COLOR|labels remain canonical"` — **PASS: 5 / 5; revision-bound partial-charge presentation remains unavailable when its dataset is absent**
- The presentation-dependent regression now verifies that generic `color red` remains distinct from representation-specific selectors, then covers positive `set cartoon_color, red, polymer` and `set ribbon_color, red, polymer` paths.
- `npx playwright test tests/e2e/g1c-visualization.spec.ts --grep "measurable when side panels"` — **PASS: 1 / 1; non-zero CSS and backing canvas dimensions**
- `npx playwright test tests/e2e/g1c-visualization.spec.ts --grep "official RCSB"` — **PASS: 1 / 1; official fallback path exercised**
- `npm run test:e2e` — **PASS: 82 / 82**
- `npm run build` — **PASS**
- `git diff --check` — **PASS**
- Pinned PyMOL oracle reproduction — **PASS: PyMOL 3.2.0a; 85 forms; 79 successful / 6 native errors; committed probe row payload identical**
- Pinned PyMOL presentation oracle reproduction — **PASS: PyMOL 2.3.0; 4 rows; `ribbon_color red` selects the same 8 protein atoms as the application’s explicit RIBBON projection**

## Manual verification

1. Open `http://localhost:3101/molstudio` and confirm an empty canvas with no molecular geometry.
2. Import `tests/fixtures/mini-protein.pdb`; confirm polymer Cartoon, ligand sticks, ion spheres, and water hidden by presentation.
3. Use File → Fetch, enter `1CRN`, and confirm an official RCSB mmCIF load with source/provenance metadata.
4. Load 4DJW, run `select all`, then run bare `chain A and protein`; confirm 7,079 and 3,060 selections respectively.
5. Use RCSB Add for `1CRN`; confirm two object rows, one viewer, independent focus/style/enable controls, and object-qualified selection.
6. Import `tests/fixtures/multistate.pdb`; confirm `2 states`, switch state, toggle bounded all-state overlay, and run `count_states multistate.pdb`.
7. Add `1CRN`, run a cross-object spatial query without a frame and confirm the structured fail-closed diagnostic; choose `LOCAL_SCIENTIFIC` in the panel or run `coordinate_frame local_scientific`, then repeat the query and confirm a non-empty active selection with recorded frame policy.
8. Import `tests/fixtures/multistate.pdb`, run `x < 1.5` and `within 1.5 of name N` in state 1 and state 2, and confirm the canonical results change from 3 to 1 atoms and 2 to 1 atoms respectively while the active-selection panel reports state scopes 1 and 2.
9. Create a group, add an object, and enter the bare group name in the console; confirm the member object atoms are selected without changing canonical objects.
10. Import `tests/fixtures/typed-nucleic.mmcif`, run `polymer.nucleic`, and confirm two atoms are selected; run `protein` on the same source to confirm only the two protein atoms are selected.
11. Import `tests/fixtures/edge-identity.mmcif`, run `segi SEG_A`, `bysegi segi SEG_A`, `alt A`, `b > 20`, and `q >= 0.5`, and confirm the source-backed identity fields drive the expected non-empty selections.
12. Import `tests/fixtures/mini-protein.pdb`, run `gap 0 ligand` and `gap 4 ligand`, and confirm the active-selection counts are 6 and 0; the selection result should expose the `canonical-element-vdw-radius@1` scientific profile.
13. Import `tests/fixtures/mini-protein.pdb`, run `pepseq AG`, and confirm 8 canonical atoms are selected; run `pepseq 10` and confirm the invalid-value diagnostic leaves the previous workspace and active selection unchanged.
14. Import `tests/fixtures/typed-properties.pdb`, run `formal_charge = 0` (2), `formal_charge > 0` (1), `formal_charge != 0` (2), `formal_charge < 0` (1), `formal_charge <= 0` (3), `formal_charge >= 0` (3), `ss HELIX` (2), `ss SHEET` (2), `b > 20` (1), and `b <= 20` (3); confirm `VALID NONEMPTY` status.
15. Import `tests/fixtures/segment-identity.pdb`, run `segi SEGA`, `bysegi segi SEGA`, and `alt A`, and confirm counts 2, 2, and 1 with `VALID NONEMPTY` status.
16. Import `tests/fixtures/sidechain-identity.pdb`, run `backbone` (4 atoms) and `sidechain` (1 atom), and confirm the canonical partition is visible and non-empty.
17. Import `tests/fixtures/unit-cell.pdb`, run `bycell name CA`, and confirm the source-backed `CRYST1` parameters expand the selected atom to the two atoms in its fractional unit cell; confirm no symmetry/PBC mates are implied.
18. In a pinned PyMOL environment, run `python verification/selection/run-pymol-oracle.py tests/fixtures/mini-protein.pdb` and compare the emitted hashes with `pymol-oracle-results.json` and the direct probe evidence.
19. Resize the browser to a narrow viewport (for example 720×800), import `tests/fixtures/mini-protein.pdb`, and confirm the 3Dmol canvas remains non-zero and visibly renders the structure while side panels collapse.
20. With `mini-protein.pdb` loaded, apply `color red, all` and confirm `select cartoon_color red` / `select ribbon_color red` remain empty until an explicit representation setting is applied; then run `set cartoon_color, red, polymer` or `set ribbon_color, red, polymer` and confirm the matching selector returns 8 polymer atoms without changing canonical metrics.

## Screenshot evidence

- [Empty state](../evidence/closure-empty-state.png)
- [Uploaded Cartoon + ligand sticks](../evidence/closure-uploaded-cartoon-ligand-sticks.png)
- [RCSB 1CRN Cartoon](../evidence/closure-rcsb-1crn-cartoon.png)
- [4DJW + 1CRN in one workspace](../evidence/closure-4djw-two-objects.png)
- [Create-from-selection object](../evidence/selection-object-create.png)
- [Split/join state lineage](../evidence/selection-state-lineage.png)
- [Cross-object spatial frame declaration](../evidence/selection-cross-object-spatial.png)
- [Selection console matrix](../evidence/selection-console-matrix.png)
- [Representation-scoped Ribbon color selection](../evidence/selection-ribbon-color.png)
- [Space-filling ligand presentation](../evidence/visualization-final/space-filling-ligand-only.png)

## Known limitations and blockers

- The pinned PyMOL source was executed in an isolated Ubuntu-20.04/Python-3.8 compatibility build using the source-built extension and a temporary import compatibility layer. The remaining `ORACLE_PENDING` matrix row is not promoted without matching coverage; this is one reason for the blocked final verdict.
- Crystallographic `pbc`/`symmetry` and donor/acceptor chemistry remain explicit unsupported or missing-dependency gates. `bycell` now has a bounded source-backed fractional-cell-membership profile, but it does not expand symmetry mates or periodic images. Donor/acceptor selection now has an explicit revision-bound canonical chemistry-role contract, but admitted PDB/mmCIF ingestion does not produce that dataset, so these queries fail closed without heuristic roles; their native PyMOL forms are nevertheless directly recorded as oracle passes. Unknown properties and unknown VDW radii fail closed. `gap` is implemented only for the declared versioned element-radius profile; `byring` is implemented only for the declared bounded-cycle profile, while `byfragment` requires canonical source-backed fragment assignments. These profiles are not claimed as full PyMOL chemistry perception.
- Partial-charge selection, color, and labels are implemented only when a complete, finite, revision-matched canonical charge dataset is present; complete source-declared mmCIF `_chem_comp_atom.partial_charge` values are promoted with provenance, while stale, incomplete, or absent datasets fail closed. The real 4DJW/1CRN loads have no complete source charge loop and therefore still return a structured missing-dependency diagnostic. Dynamic arbitrary-property evaluation is intentionally unavailable; unknown fields return a structured `UNKNOWN_PROPERTY` diagnostic and no runtime code or property lookup is executed. `visible` and presentation selectors require the explicit RenderProjection context supplied by the frontend selection router; bare `label …` remains a label command, while `select label …` matches rendered safe-label text. `pepseq` currently supports canonical one-letter motifs and the standard amino-acid mapping profile only; modified residues are represented as `X` and cannot satisfy an exact motif.
- `polymer.nucleic` and typed `polymer.protein` require complete source-backed `_entity_poly.type` mapping in mmCIF; legacy PDB inputs without that annotation intentionally retain the prior generic polymer behavior and report a truthful dependency diagnostic for nucleic selection.
- Native `like`, implicit adjacency, topology, corrected spatial forms, and the new object-lineage workflows now have direct coverage; the six native parser errors and the remaining conservative matrix rows are retained as evidence rather than treated as application support.
- PDB `segi` and `alt` now have exact pinned-oracle coverage. mmCIF segment fields remain canonical application data when the pinned PyMOL build does not expose an equivalent native selector, so that source-format difference is documented rather than hidden.
- Cross-object spatial queries require an explicit `LOCAL_SCIENTIFIC` or `EFFECTIVE_WORLD` declaration. `EFFECTIVE_WORLD` is currently an identity-transform policy because object-level scientific transforms are not yet admitted; no hidden presentation transform participates. Cartesian predicates use the named `cartesian-float64-v1` closed-boundary numerical tolerance.
- The production bundle retains the existing 3Dmol `eval` warning and exceeds the default 500 kB warning threshold; all build and runtime tests pass.

## Research-gated items

- `donors` / `acceptors`: the canonical contract now admits only a complete, revision-matched `canonical-chemistry-roles-v1` dataset and records its profile in selection plans/results; the remaining gap is a validated producer with complete bond order/valence, protonation/tautomer state, and provenance. Required next research fixture set: benzene, pyridine, pyrrole, amide, carboxylate, protonated amine, and unknown-component cases; suggested stage: R03-04 chemistry-perception addendum plus Research-02 chemical-graph/CCD integration.
- `pbc` / crystallographic symmetry: the remaining research question is whether future compatibility should expose symmetry mates or periodic-image expansion beyond the now-implemented source-backed unit-cell membership profile; suggested stage: SQ-R05 symmetry/PBC addendum with symmetry-operator fixtures and an explicit coordinate-frame policy for mates.
- `byfragment`: the exact question is whether the accepted profile should expose PyMOL editor fragment assignments directly or admit a different chemistry-defined fragment dataset. The pinned source uses editor fragment assignments, while current PDB/mmCIF ingestion supplies neither those assignments nor an equivalent canonical dataset; connected components are reserved for `bymolecule`. The source-level audit is recorded in [pymol-byfragment-source.md](../selection/pymol-byfragment-source.md). Required next research fixture: disconnected editor fragments and a source-backed fragment-assignment payload; suggested stage: R-PYMOL chemistry/fragment addendum.
- `partial_charge`: complete source-declared `_chem_comp_atom.partial_charge` values are now promoted when they cover every loaded atom, with charge model, units, provenance, and molecular-revision binding. The real 4DJW/1CRN mmCIF payloads contain no complete charge loop, so those ordinary loads still fail closed; no fallback charge is permitted.
- Additional `ORACLE_PENDING` rows require a matching direct pinned-PyMOL comparison or a documented native-equivalent mapping. The exact pinned probe is reproducible locally; the remaining pending row is retained because it requires a missing canonical data producer. Existing direct-probe artifacts remain preserved.
