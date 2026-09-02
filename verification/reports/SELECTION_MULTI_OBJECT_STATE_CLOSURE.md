# Selection + multi-object / multi-state closure report

## Verdict

**SELECTION + MULTI-OBJECT/MULTI-STATE CLOSURE INCOMPLETE — BLOCKED**

The live regressions and the newly required workspace paths are closed in the authoritative implementation. The product gate remains blocked from a complete conformance verdict because the operator matrix still contains explicit `MISSING_DEPENDENCY`, `RESEARCH_REQUIRED`, and `ORACLE_PENDING` rows. Those rows are fail-closed and truthful; they are not silently mapped to another scientific meaning.

## Repository evidence

- Repository: `mukundrajambulge/new-mole-explorer-`
- Remote: `new-origin https://github.com/mukundrajambulge/new-mole-explorer-.git`
- Worktree: `C:\Users\mukun\Documents\Codex\2026-08-30\files-pasted-by-the-user-new\outputs\molecular-workstation`
- Branch: `fix/visualization-final-closure`
- Starting SHA: `d02be7db6b8467797a3398269025763d22c7f8c0`
- Implementation ending SHA: `11a086b7c5c2c703fc1a14cacda5e91eeaee2ad3`
- Working tree at implementation commit: clean

## Reproduced failures and fixes

The live console was reproduced against the running application before changes:

1. `select all` selected 7,079 atoms successfully.
2. Bare `chain A and protein` was incorrectly routed to the command parser and returned `Unknown command \`chain\``.

The input boundary now routes only registered command verbs to the command parser. All other text is evaluated by the canonical selection parser. The same live query then selected 3,060 atoms and remained visible as the active selection.

## Architecture decisions

- Backend canonical structure, topology, coordinates, provenance, source hash, and coordinate-state metadata remain the scientific authority.
- `RenderProjection` is the only presentation boundary consumed by `ThreeDMolViewerAdapter`; 3Dmol model indices are never scientific identity.
- A mounted molecular canvas owns one viewer adapter. Workspace objects are rendered as multiple models inside that viewer.
- Workspace `ObjectID`, display name, and renderer model are separate identities. Duplicate display names require a durable ObjectID.
- Multi-object selection uses a derived workspace universe with object-scoped atom IDs; source canonical IDs are unchanged.
- Coordinate states use explicit `CoordinateStateID` and `StateOrder`. One-state structures receive a compatibility singleton state; no state identity is inferred from renderer order.
- `all_states` is bounded to an explicit auxiliary-model overlay. `frame N` resolves through explicit per-object state order.
- Object `copy` creates a second workspace view over the same canonical load result. `create`, `split_states`, and `join_states` are explicitly gated until their canonical lineage policies are defined.
- Failed loads remain non-destructive; the prior workspace and viewer state are retained.

## Files changed

Application and contracts:

- `apps/api/src/structures/ingestion.ts`
- `apps/api/src/structures/ingestion.test.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/commands/commandRegistry.ts`
- `apps/web/src/components/ConsolePanel.tsx`
- `apps/web/src/components/ContextToolbar.tsx`
- `apps/web/src/components/MolecularCanvas.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/domain/registry.ts`
- `apps/web/src/interaction/picking.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/selection/selectionEngine.ts`
- `apps/web/src/selection/selectionEngine.test.ts`
- `apps/web/src/styles/global.css`
- `apps/web/src/workspace/workspaceModel.ts`

Verification and evidence:

- `tests/fixtures/multistate.pdb`
- `tests/e2e/closure-evidence.spec.ts`
- `tests/e2e/multi-object-state.spec.ts`
- `tests/e2e/selection-matrix-live.spec.ts`
- `verification/selection/SELECTION_OPERATOR_MATRIX.md`
- `verification/evidence/closure-empty-state.png`
- `verification/evidence/closure-uploaded-cartoon-ligand-sticks.png`
- `verification/evidence/closure-rcsb-1crn-cartoon.png`
- `verification/evidence/selection-console-matrix.png`
- refreshed visualization evidence under `verification/evidence/` and `verification/evidence/visualization-final/`

## Validation

- `npm run typecheck` — PASS
- `npm test` — PASS: web 16 files / 66 tests; API 2 files / 10 tests
- `npm run lint` — PASS
- `npm run build` — PASS
- `npm run test:e2e` — PASS: 62 / 62
- `npx playwright test tests/e2e/multi-object-state.spec.ts` — PASS: 3 / 3
- `npx playwright test tests/e2e/selection-matrix-live.spec.ts` — PASS: full expanded live matrix case
- `git diff --check` — PASS

## Manual verification

1. Start the repository with `npm run dev`.
2. Open `http://localhost:3101/molstudio` (the authoritative workstation). The landing app is at `http://localhost:3100`; the API health endpoint is `http://localhost:8100/api/health`.
3. Confirm the empty state has no molecular geometry.
4. Import `tests/fixtures/mini-protein.pdb`; confirm polymer Cartoon, organic ligand sticks, ion spheres when present, and water hidden by presentation.
5. Use File → Fetch from RCSB and enter `1CRN`; confirm an official mmCIF load and provenance-backed structure metadata.
6. Enter `select all`, then enter the bare query `chain A and protein`; confirm structured selection feedback and visible highlight markers.
7. Use File → Add Structure twice; confirm two rows, one viewer, independent focus/style/enable controls, and object-scoped selection.
8. Import `tests/fixtures/multistate.pdb`; confirm `2 states`, switch state, toggle the bounded all-state overlay, and run `count_states multistate.pdb`.

## Evidence screenshots

- [Empty state](../evidence/closure-empty-state.png)
- [Local Cartoon + ligand sticks](../evidence/closure-uploaded-cartoon-ligand-sticks.png)
- [RCSB 1CRN Cartoon](../evidence/closure-rcsb-1crn-cartoon.png)
- [Selection console matrix](../evidence/selection-console-matrix.png)

## Known limitations / remaining gate blockers

- `segi`, crystallographic `pbc`/`symmetry`/`bycell`, fragment/ring perception, arbitrary properties, donor/acceptor chemistry, and several spatial expansion operators remain explicit unsupported gates.
- Partial-charge, label, peptide-sequence, and presentation-visibility selection require canonical or presentation datasets that are not present in this gate; they return structured missing-dependency diagnostics.
- `in`/`like` tuple grammar and exact PyMOL semantics still require a pinned research decision.
- The matrix records oracle status honestly; a pinned PyMOL oracle run has not been added.
- The production bundle retains the existing 3Dmol `eval` warning and is larger than the default 500 kB warning threshold; this does not affect the local validation pass.
- The configured development ports intentionally leave 5173 untouched for a legacy application. Opening that legacy port can show a white screen; use the authoritative 3101 workstation URL above.
