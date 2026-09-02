# Selection + multi-object / multi-state closure report

## Verdict

**SELECTION + MULTI-OBJECT/MULTI-STATE CLOSURE INCOMPLETE — BLOCKED**

The implementation paths, live regressions, multi-object workspace, multi-state rendering, and visualization regression suite pass in the authoritative repository. The pinned PyMOL source has now executed against the shared fixture for 85 direct forms: 79 pass and 6 return native errors; the comparison ledger promotes only exact forms or documented aliases. The gate remains blocked because 28 of the 87 matrix rows remain oracle-pending, alongside explicitly unsupported or dependency-gated operators. Unsupported and dependency-gated operators remain fail-closed and are not presented as scientifically implemented.

## Repository and run evidence

- Repository: `mukundrajambulge/new-mole-explorer-`
- Remote: `new-origin https://github.com/mukundrajambulge/new-mole-explorer-.git`
- Local root: `C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation`
- Branch: `fix/visualization-final-closure`
- Starting SHA for this closure pass: `900552e18e5eccabaaaedbae0853ef9956585084`
- Ending evidence SHA: `3cf6b6c` (scientific workspace scope, revision-matched partial-charge selection, and regenerated live evidence)
- Working tree before commit: modified by this closure pass; no unrelated files were changed
- Development UI: `http://localhost:3101/molstudio`
- Landing app: `http://localhost:3100`
- API health: `http://localhost:8100/api/health`
- Port `5173` is intentionally untouched/reserved for the legacy application; it is not the authoritative workstation.

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
- `RenderProjection` is the renderer-neutral presentation boundary consumed by `ThreeDMolViewerAdapter`; UI components do not own 3Dmol scientific state.
- One mounted molecular canvas owns one authoritative adapter/viewer instance. Multiple workspace objects become separate 3Dmol models within that viewer.
- Durable `ObjectID`, display name, and renderer model identity are distinct. Duplicate names require an ObjectID and never silently select the first match.
- Multi-object selection uses a derived workspace universe containing every loaded object, including disabled presentation objects, with object-scoped atom IDs; source canonical IDs are unchanged. `enabled` and `visible` remain separate presentation-scoped selectors.
- Coordinate states use explicit `CoordinateStateID` and `StateOrder`. One-state structures receive a compatibility singleton state; renderer model order is never treated as scientific state identity.
- `all_states` is bounded to explicit auxiliary state models. State changes reconcile model coordinates in place when layout is unchanged.
- Object `copy` preserves canonical source, state order, current state, enablement, and projection while receiving a new durable ObjectID. `create`, `split_states`, and `join_states` remain explicitly gated where lineage semantics are not defined.
- Workspace presentation commands are applied per canonical object scope. The viewer adapter projects each object’s representation directives onto its own model, and single-object disable/enable transitions stay in the same workspace projection path.
- Selection cache identity includes canonical selector fields and workspace namespace metadata, including durable object ID, mutable display name, segment identity, and coordinate-state annotations; renaming cannot reuse a stale object-name result.
- Failed loads are non-destructive: the current workspace and viewer remain intact.

## Operator matrix

The machine-readable ledger is [selection-operator-matrix.json](../selection/selection-operator-matrix.json), generated from [SELECTION_OPERATOR_MATRIX.md](../selection/SELECTION_OPERATOR_MATRIX.md).

- Rows: **87**
- Implementation: **69 VERIFIED_WORKING**, **11 MISSING_DEPENDENCY**, **6 INTENTIONALLY_UNSUPPORTED**, **1 UNKNOWN_PROPERTY**
- Live-browser status: **85 pass/accepted diagnostic outcomes** across the expanded matrix exercise
- Live evidence: [selection-live-evidence.json](../selection/selection-live-evidence.json) records all **85** attempts, with **0 browser-console errors, 0 page errors, 0 network failures, 0 atom-count mismatches, 0 viewer/panel membership mismatches**, and subsequent targeting checks retaining the active selection hash.
- `in`, `bycalpha`, and `bymolecule` now use canonical tuple, residue-CA, and bond-component semantics respectively. `visible` is now bound to an explicit presentation context derived from render directives; it never aliases scientific `all`. `like`, the application implicit-adjacency profile, and the new spatial/topology forms are live-verified; malformed shorthand and missing scientific dependencies remain truthful diagnostics.
- Oracle comparison ledger: **18 ORACLE_PASS**, **13 ORACLE_EQUIVALENT**, **0 ORACLE_PENDING** across the intentionally conservative 31-row comparison ledger; the full direct probe is [pymol-matrix-probe.json](../selection/pymol-matrix-probe.json) (**85 forms: 79 successful, 6 native errors**).
- Pinned oracle evidence: [pymol-oracle-results.json](../selection/pymol-oracle-results.json); runner: [run-pymol-oracle.py](../selection/run-pymol-oracle.py)
- Missing dependency and research rows are explicit gates. No unsupported operator is silently aliased to a different scientific meaning.

## Files changed in this closure

Application/contracts:

- `apps/api/src/structures/ingestion.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/StatusBar.tsx`
- `apps/web/src/commands/commandRegistry.test.ts`
- `apps/web/src/commands/commandRegistry.ts`
- `apps/web/src/components/ContextToolbar.tsx`
- `apps/web/src/components/MolecularCanvas.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/interaction/measurements.ts`
- `apps/web/src/interaction/picking.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/rendering/surfaceProfiles.ts`
- `apps/web/src/selection/selectionEngine.ts`
- `apps/web/src/selection/selectionEngine.test.ts`
- `apps/web/src/styles/global.css`
- `apps/web/src/workspace/workspaceModel.ts`
- `apps/web/src/workspace/workspaceModel.test.ts`
- `apps/api/src/structures/ingestion.ts`
- `packages/contracts/src/index.ts`
- `package.json`

Verification:

- `tests/e2e/multi-object-state.spec.ts`
- `tests/e2e/real-structure-workspace.spec.ts`
- `tests/e2e/selection-closure.spec.ts`
- `tests/e2e/selection-matrix-live.spec.ts`
- `verification/selection/SELECTION_OPERATOR_MATRIX.md`
- `verification/selection/generate-matrix-summary.mjs`
- `verification/selection/selection-operator-matrix.json`
- `verification/selection/pymol-oracle-results.json`
- `verification/selection/pymol-matrix-probe.json`
- `verification/selection/run-pymol-oracle.py`
- `verification/selection/selection-live-evidence.json`
- `verification/evidence/closure-empty-state.png`
- `verification/evidence/closure-uploaded-cartoon-ligand-sticks.png`
- `verification/evidence/closure-rcsb-1crn-cartoon.png`
- `verification/evidence/closure-4djw-two-objects.png`
- `verification/evidence/selection-console-matrix.png`
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
- Object/state-scoped surfaces and unrelated-state cache isolation: **PASS**
- Object-scoped measurement picks reject mixed-object ambiguity and resolve against the canonical target object: **PASS**
- Cross-object spatial selection without an explicit coordinate frame: **BLOCKED / fail-closed with a structured dependency diagnostic**

## Multi-state closure

- `CoordinateStateID`, `StateOrder`, typed `StateSelector`, `ObjectDisplayState`, and `FrameStateResolver`: **PASS**
- Multi-model PDB and mmCIF ingestion coverage: **PASS**
- Explicit state UI, state commands in both accepted argument orders, and bounded `all_states`: **PASS**
- In-place state coordinate replacement without duplicate models: **PASS**
- State-aware derived selection metadata: **PASS**
- Heterogeneous object/state layout reconciliation: **PASS**

## Visualization regression closure

- Real 3Dmol viewer lifecycle and no duplicate models on remount: **PASS**
- Lines, Sticks, Spheres, Ball & Stick, Cartoon, Ribbon/Trace/Putty profiles: **PASS / explicitly limited where applicable**
- Protein Cartoon, organic ligand sticks, ion spheres, and presentation-only water hiding: **PASS**
- Independent representation, color, visibility, view, background, and labels: **PASS**
- VDW/SAS/SES/Mesh/Dots/analysis overlays and surface cache behavior: **PASS / bounded profiles**
- Resize, rotate, pan, zoom, focus, center, orient, origin, and reset: **PASS**
- Unavailable toolbar/menu features: **explicit Coming Soon/Unavailable**

## Tests and results

- `npm run typecheck` — **PASS**
- `npm run lint` — **PASS**
- `npm run test --workspace @molecular/web` — **PASS: 17 files / 71 tests**
- `npm run test --workspace @molecular/api` — **PASS: 2 files / 11 tests**
- `npm run verify:selection-matrix` — **PASS: 87 rows; JSON regenerated**
- `npx playwright test tests/e2e/multi-object-state.spec.ts` — **PASS: 6 / 6**
- `npx playwright test tests/e2e/selection-matrix-live.spec.ts` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/real-structure-workspace.spec.ts` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/closure-evidence.spec.ts` — **PASS: 1 / 1**
- `npm run test:e2e` — **PASS: 67 / 67**
- `npm run build` — **PASS**
- `git diff --check` — **PASS**

## Manual verification

1. Open `http://localhost:3101/molstudio` and confirm an empty canvas with no molecular geometry.
2. Import `tests/fixtures/mini-protein.pdb`; confirm polymer Cartoon, ligand sticks, ion spheres, and water hidden by presentation.
3. Use File → Fetch, enter `1CRN`, and confirm an official RCSB mmCIF load with source/provenance metadata.
4. Load 4DJW, run `select all`, then run bare `chain A and protein`; confirm 7,079 and 3,060 selections respectively.
5. Use RCSB Add for `1CRN`; confirm two object rows, one viewer, independent focus/style/enable controls, and object-qualified selection.
6. Import `tests/fixtures/multistate.pdb`; confirm `2 states`, switch state, toggle bounded all-state overlay, and run `count_states multistate.pdb`.
7. In a pinned PyMOL environment, run `python verification/selection/run-pymol-oracle.py tests/fixtures/mini-protein.pdb` and compare the emitted hashes with `pymol-oracle-results.json` and the direct probe evidence.

## Screenshot evidence

- [Empty state](../evidence/closure-empty-state.png)
- [Uploaded Cartoon + ligand sticks](../evidence/closure-uploaded-cartoon-ligand-sticks.png)
- [RCSB 1CRN Cartoon](../evidence/closure-rcsb-1crn-cartoon.png)
- [4DJW + 1CRN in one workspace](../evidence/closure-4djw-two-objects.png)
- [Selection console matrix](../evidence/selection-console-matrix.png)
- [Space-filling ligand presentation](../evidence/visualization-final/space-filling-ligand-only.png)

## Known limitations and blockers

- The pinned PyMOL source was executed in a temporary Ubuntu-20.04/Python-3.9.2 compatibility build. The 28 remaining `ORACLE_PENDING` matrix rows are not promoted without matching coverage; this is one reason for the blocked final verdict.
- `segi`, crystallographic `pbc`/`symmetry`/`bycell`, fragment/ring perception, donor/acceptor chemistry, and `gap` remain explicit unsupported or missing-dependency gates. Unknown properties fail closed.
- Partial-charge selection is implemented only when a complete, revision-matched canonical charge dataset is present; the admitted PDB/mmCIF ingestion path does not create one, so current loaded structures return a structured missing-dependency diagnostic. Peptide sequence and label-property selection likewise require datasets not present in this gate. `visible` requires the explicit presentation context supplied by the frontend selection router.
- Native `like`, implicit adjacency, topology, and corrected spatial forms now have direct probe coverage; the six native parser errors and the remaining conservative matrix rows are retained as evidence rather than treated as application support.
- Cross-object spatial queries are intentionally not evaluated until the workspace declares whether coordinates are `LOCAL_SCIENTIFIC` or `EFFECTIVE_WORLD`; same-object spatial queries remain supported.
- The production bundle retains the existing 3Dmol `eval` warning and exceeds the default 500 kB warning threshold; all build and runtime tests pass.
