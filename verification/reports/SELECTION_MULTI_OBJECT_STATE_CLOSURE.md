# Selection + multi-object / multi-state closure report

## Verdict

**SELECTION + MULTI-OBJECT/MULTI-STATE CLOSURE INCOMPLETE — BLOCKED**

The implementation paths, live regressions, multi-object workspace, multi-state rendering, and visualization regression suite pass in the authoritative repository. The pinned PyMOL source has now executed against the shared fixture for 23 representative forms: 13 exact forms pass and 6 application aliases match documented native equivalents. The gate remains blocked because 60 of the 79 matrix rows still require a pinned oracle result or a deliberately unresolved native grammar decision. Unsupported and research-dependent operators remain fail-closed and are not presented as scientifically implemented.

## Repository and run evidence

- Repository: `mukundrajambulge/new-mole-explorer-`
- Remote: `new-origin https://github.com/mukundrajambulge/new-mole-explorer-.git`
- Local root: `C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation`
- Branch: `fix/visualization-final-closure`
- Starting SHA for this closure pass: `e6ab3a781f9db8f3ed39c37e08003476eed88703`
- Ending implementation SHA: `3b49e10` (includes the active-selection/status-bar closure fix)
- Working tree before commit: modified by this closure pass; no unrelated files were changed
- Development UI: `http://localhost:3101/molstudio`
- Landing app: `http://localhost:3100`
- API health: `http://localhost:8100/api/health`
- Port `5173` is intentionally untouched/reserved for the legacy application; it is not the authoritative workstation.

## Reproduced failures and live results

The current application was exercised with a real 4DJW RCSB load:

- `select all` selected **7,079 atoms** and remained the active selection.
- Bare `chain A and protein` selected **3,060 atoms**. It is routed by the typed InputRouter to the canonical selection parser, not the command parser.
- A second live RCSB load (`1CRN`) was added without replacing 4DJW. Both objects rendered in one mounted viewer and `object 4DJW.cif` selected 7,079 atoms.

## Architecture decisions

- Backend canonical structure, topology, coordinates, provenance, source hash, and coordinate-state metadata remain the scientific authority.
- `RenderProjection` is the renderer-neutral presentation boundary consumed by `ThreeDMolViewerAdapter`; UI components do not own 3Dmol scientific state.
- One mounted molecular canvas owns one authoritative adapter/viewer instance. Multiple workspace objects become separate 3Dmol models within that viewer.
- Durable `ObjectID`, display name, and renderer model identity are distinct. Duplicate names require an ObjectID and never silently select the first match.
- Multi-object selection uses a derived workspace universe with object-scoped atom IDs; source canonical IDs are unchanged.
- Coordinate states use explicit `CoordinateStateID` and `StateOrder`. One-state structures receive a compatibility singleton state; renderer model order is never treated as scientific state identity.
- `all_states` is bounded to explicit auxiliary state models. State changes reconcile model coordinates in place when layout is unchanged.
- Object `copy` preserves canonical source, state order, current state, enablement, and projection while receiving a new durable ObjectID. `create`, `split_states`, and `join_states` remain explicitly gated where lineage semantics are not defined.
- Failed loads are non-destructive: the current workspace and viewer remain intact.

## Operator matrix

The machine-readable ledger is [selection-operator-matrix.json](../selection/selection-operator-matrix.json), generated from [SELECTION_OPERATOR_MATRIX.md](../selection/SELECTION_OPERATOR_MATRIX.md).

- Rows: **79**
- Implementation: **57 VERIFIED_WORKING**, **10 MISSING_DEPENDENCY**, **10 INTENTIONALLY_UNSUPPORTED**, **2 RESEARCH_REQUIRED**
- Live-browser status: **79 pass/accepted diagnostic outcomes** across the expanded matrix exercise
- Oracle status: **13 ORACLE_PASS**, **6 ORACLE_EQUIVALENT**, **60 ORACLE_PENDING**
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
- `apps/web/src/interaction/measurements.ts`
- `apps/web/src/interaction/picking.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/rendering/surfaceProfiles.ts`
- `apps/web/src/selection/selectionEngine.ts`
- `apps/web/src/workspace/workspaceModel.ts`
- `packages/contracts/src/index.ts`
- `package.json`

Verification:

- `tests/e2e/multi-object-state.spec.ts`
- `tests/e2e/real-structure-workspace.spec.ts`
- `tests/e2e/selection-matrix-live.spec.ts`
- `verification/selection/SELECTION_OPERATOR_MATRIX.md`
- `verification/selection/generate-matrix-summary.mjs`
- `verification/selection/selection-operator-matrix.json`
- `verification/selection/pymol-oracle-results.json`
- `verification/selection/run-pymol-oracle.py`
- `verification/evidence/closure-empty-state.png`
- `verification/evidence/closure-uploaded-cartoon-ligand-sticks.png`
- `verification/evidence/closure-rcsb-1crn-cartoon.png`
- `verification/evidence/closure-4djw-two-objects.png`
- `verification/evidence/selection-console-matrix.png`
- this report

## Multi-object closure

- Durable object registry and duplicate-name ambiguity handling: **PASS**
- Simultaneous objects in one mounted viewer: **PASS**
- Independent object enable/disable and projection/style/color state: **PASS**
- Cross-object selection and object-qualified queries: **PASS**
- Reverse picking identity map with object and coordinate-state context: **PASS**
- Object/state-scoped surfaces and unrelated-state cache isolation: **PASS**
- Object-scoped measurement picks reject mixed-object ambiguity and resolve against the canonical target object: **PASS**

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
- `npm run test --workspace @molecular/web` — **PASS: 16 files / 66 tests**
- `npm run test --workspace @molecular/api` — **PASS: 2 files / 11 tests**
- `npm run verify:selection-matrix` — **PASS: 79 rows; JSON regenerated**
- `npx playwright test tests/e2e/multi-object-state.spec.ts` — **PASS: 4 / 4**
- `npx playwright test tests/e2e/selection-matrix-live.spec.ts` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/real-structure-workspace.spec.ts` — **PASS: 1 / 1**
- `npx playwright test tests/e2e/closure-evidence.spec.ts` — **PASS: 1 / 1**
- `npm run test:e2e` — **PASS: 64 / 64**
- `npm run build` — **PASS**
- `git diff --check` — **PASS**

## Manual verification

1. Open `http://localhost:3101/molstudio` and confirm an empty canvas with no molecular geometry.
2. Import `tests/fixtures/mini-protein.pdb`; confirm polymer Cartoon, ligand sticks, ion spheres, and water hidden by presentation.
3. Use File → Fetch, enter `1CRN`, and confirm an official RCSB mmCIF load with source/provenance metadata.
4. Load 4DJW, run `select all`, then run bare `chain A and protein`; confirm 7,079 and 3,060 selections respectively.
5. Use RCSB Add for `1CRN`; confirm two object rows, one viewer, independent focus/style/enable controls, and object-qualified selection.
6. Import `tests/fixtures/multistate.pdb`; confirm `2 states`, switch state, toggle bounded all-state overlay, and run `count_states multistate.pdb`.
7. In a pinned PyMOL environment, run `python verification/selection/run-pymol-oracle.py tests/fixtures/mini-protein.pdb` and compare the emitted hashes with `pymol-oracle-results.json`.

## Screenshot evidence

- [Empty state](../evidence/closure-empty-state.png)
- [Uploaded Cartoon + ligand sticks](../evidence/closure-uploaded-cartoon-ligand-sticks.png)
- [RCSB 1CRN Cartoon](../evidence/closure-rcsb-1crn-cartoon.png)
- [4DJW + 1CRN in one workspace](../evidence/closure-4djw-two-objects.png)
- [Selection console matrix](../evidence/selection-console-matrix.png)

## Known limitations and blockers

- The pinned PyMOL source was executed in a temporary Ubuntu-20.04/Python-3.9.2 compatibility build. The 60 remaining `ORACLE_PENDING` rows are not promoted without matching coverage; this is the reason for the blocked final verdict.
- `segi`, crystallographic `pbc`/`symmetry`/`bycell`, fragment/ring perception, arbitrary properties, donor/acceptor chemistry, and several spatial expansion operators remain explicit unsupported gates.
- Partial charge, peptide sequence, label-property, and presentation-visibility selection require datasets not present in this gate and return structured missing-dependency diagnostics.
- `in`/`like` tuple grammar and exact PyMOL semantics require a pinned research decision.
- The production bundle retains the existing 3Dmol `eval` warning and exceeds the default 500 kB warning threshold; all build and runtime tests pass.
