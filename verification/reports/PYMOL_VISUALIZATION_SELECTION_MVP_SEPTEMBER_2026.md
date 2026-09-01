# PyMOL visualization and canonical selection MVP — September 2026

## Repository and evidence

- Repository: `mukundrajambulge/new-mole-explorer-`
- Remote: `https://github.com/mukundrajambulge/new-mole-explorer-.git` (`new-origin`)
- Branch: `fix/visualization-final-closure`
- Starting SHA: `49a5c6bc7deb443309c7bf2acd3fb429f2a1f858`
- Ending SHA: `b1ea920b97ae1348577f7003a105c668597871b3`
- The old `mole-explorer` and `Molexplorer` repositories were not modified.

## Architecture decisions

1. The canonical structure remains the scientific authority. Selection evaluation consumes canonical atoms, bonds, coordinates, structure identity, and molecular revision; no 3Dmol renderer index is used as identity.
2. `apps/web/src/selection/selectionEngine.ts` is the selection boundary: lexer → Pratt parser → normalized AST → canonical evaluation → stable membership → typed `SelectionResult` with scope, revision, dependencies, hashes, diagnostics, and provenance.
3. `apps/web/src/interaction/selectionResolver.ts` remains a compatibility facade for existing callers and representation parsing. It no longer contains raw whitespace/regex selection evaluation.
4. Command parsing is separate in `apps/web/src/commands/commandRegistry.ts`; presentation commands receive canonical selection results and only mutate renderer-neutral presentation state.
5. Selection snapshots store stable canonical IDs and are immutable for the active molecular revision. `not`, boolean algebra, by-residue/by-chain expansion, topology neighbors, and exact Float64 Cartesian `within`/`around` are bounded MVP behavior.
6. Color precedence is selection explicit → representation-specific explicit → component custom/mode → global scheme. Component colors are presentation-only and are persisted in the project presentation contract.
7. The side rails own scrolling. Analysis and measurement content is natural-height content in the left rail, preventing the former fixed-card clipping trap.

## Implemented behavior

- Boolean selection: `all`, `none`, `not`, `and`, `or`, parentheses, `!`, `&`, `|`.
- Canonical predicates: `name`, `resn`, insertion-aware `resi`, `chain`, `elem`, `alt`, `id`, 1-based `index`, 0-based `rank`, `model`, and `object`.
- Categories: `protein`/`polymer`, `ligand`/`organic`, `water`, `ion`/`ions`, and `other`.
- Topology: `neighbor` and `bound_to`, derived only from canonical bonds.
- Spatial MVP: exact `within` and `around`; invalid or gated spatial/profile operators fail explicitly.
- Named selection workflow: `select active_site, chain A and resi 50-80`; subsequent `show`, `hide`, `color`, `label`, `center`, and `zoom` commands can target `%active_site`/`active_site`.
- Objects & Selections panel with A/S/H/L/C presentation actions.
- Console history with Up/Down, Ctrl/Cmd+L clearing, Tab command completion, and explicit command suggestions.
- Safe non-evaluating label templates target canonical stable atom IDs and guard high-cardinality atom labels at 120 eligible atoms.
- Existing unavailable capabilities remain truthfully unavailable/coming soon.

## Files changed

- `apps/web/src/selection/selectionEngine.ts`
- `apps/web/src/selection/selectionEngine.test.ts`
- `apps/web/src/interaction/selectionResolver.ts`
- `apps/web/src/commands/commandRegistry.ts`
- `apps/web/src/commands/commandRegistry.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/ConsolePanel.tsx`
- `apps/web/src/components/InspectorPanel.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/domain/registry.ts`
- `apps/web/src/interaction/labels.ts`
- `apps/web/src/interaction/labels-picking.test.ts`
- `apps/web/src/rendering/colorSchemes.ts`
- `apps/web/src/rendering/colorSchemes.test.ts`
- `apps/web/src/rendering/presentationState.ts`
- `apps/web/src/rendering/renderProjection.ts`
- `apps/web/src/styles/global.css`
- `packages/contracts/src/index.ts`
- `verification/evidence/empty-state.png`
- `verification/evidence/rcsb-4djw-cartoon.png`
- `verification/evidence/cartoon-ligand-sticks.png`

## Tests and build

- `npm test`: PASS — web 16 files / 64 tests; API 2 files / 9 tests.
- `npm run typecheck --workspace @molecular/web`: PASS.
- `npm run build`: PASS for API, app, web, and contracts. Vite reports the existing 3Dmol bundle-size warning and its upstream `eval` warning.
- `npm run lint`: PASS for all workspaces.
- `git diff --check`: PASS.

## Manual verification

1. Started the current worktree with the existing dev configuration: landing app `http://localhost:3100`, web app `http://localhost:3101/molstudio`, API `http://localhost:8100`.
2. Opened `http://localhost:3101/molstudio` and verified a truthful empty state, import affordance, no scientific preview geometry, and no structure mutation.
3. Opened `http://localhost:3101/molstudio?demo=4DJW`; the backend fetched official RCSB mmCIF and the viewer displayed 4DJW with 7,079 atoms, 786 residues, and 9 chains.
4. Verified the left rail measurement card has `overflow: visible`, natural content height, and a parent scroll context (`clientHeight 906`, `scrollHeight 1124` in the loaded desktop view).
5. Ran `select active_site, chain A and resi 50-80`; the console reported 243 canonical atoms and the Objects & Selections panel showed the snapshot.
6. Ran `show sticks, active_site`, `label active_site, {resn}{resi}:{name}`, and `center active_site`; each reported the canonical target count and no raw selection was sent to 3Dmol.
7. Verified `select all` selected 7,079 atoms and updated the footer selection count.
8. Switched the Ligand component color control to Custom and verified the component override was separate from the global scheme; selection explicit color still won over the component override in tests.

## Screenshots

- Empty state: `verification/evidence/empty-state.png`
- RCSB 4DJW cartoon: `verification/evidence/rcsb-4djw-cartoon.png`
- Cartoon plus ligand sticks command state: `verification/evidence/cartoon-ligand-sticks.png`

## Known limitations

- The current canonical contract does not yet expose separate author/label chain namespaces, segment identity, or multi-model state. `segi` fails closed rather than being guessed as `chain`; model/object currently bind to the loaded structure identity.
- `gap`, PBC/bycell, symmetry, byring, byfragment, and other unvalidated spatial/topology profiles are explicitly gated.
- Named snapshots are session-scoped in this MVP; the project contract does not yet persist named-selection definitions.
- Scientific editing, docking, pocket detection, and other existing unavailable capabilities remain unavailable by design.
- The existing 3Dmol dependency emits the upstream bundle-size/eval warnings during production build.

## Verdict

PYMOL VISUALIZATION + SELECTION MVP COMPLETE — READY FOR USER ACCEPTANCE
