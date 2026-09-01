# PyMOL visualization + canonical selection MVP — September 2026

## Repository identity

- Authoritative repository: `mukundrajambulge/new-mole-explorer-`
- Remote: `https://github.com/mukundrajambulge/new-mole-explorer-.git` (`new-origin`)
- Branch: `fix/visualization-final-closure`
- Starting SHA for this closure pass: `49a5c6bc7deb443309c7bf2acd3fb429f2a1f858`
- Ending SHA: `e7196bd0c8ab229ab9c55373f615b56b53cbbeb8`
- The old `mole-explorer` and `Molexplorer` repositories were not modified.

## Visualization corrections

- The molecular canvas is backed by one lifecycle-owned `ThreeDMolViewerAdapter` per mounted canvas and uses the canonical backend load result as its model source.
- Placeholder molecular geometry is not used for loaded structures. Re-mounting destroys the prior adapter and model; loading a new structure clears the prior renderer scene before projection.
- Initial protein presentation is polymer Cartoon, organic ligand Ball & Stick, ion Spheres, and water hidden by presentation state.
- Lines, Sticks, Spheres, Ball & Stick, Cartoon, Ribbon, Trace, Putty, VDW, SAS, SES, Mesh, Dots, Dot Surface, non-bonded crosses, and non-bonded spheres retain explicit renderer profiles and capability diagnostics.
- Camera rotate/pan/zoom, fit, center, orient, origin, projection mode, clipping, resize observation, and console occlusion handling remain presentation-only.
- Surface geometry and material updates are keyed separately; camera movement, highlighting, color changes, and label changes do not regenerate canonical molecular data.
- Component color precedence is selection-atom override → representation-scoped selection override → component custom/mode → global scheme → default. Component overrides persist through representation, visibility, camera, background, and global color changes.
- Safe custom labels use an allow-listed template parser, visible Apply/Enter and Clear actions, inline validation, cardinality reporting, and a 120-atom safety guard. Invalid input leaves the last valid renderer label state intact.
- Analysis & Interaction and Measurements now occupy natural-height cards inside a scrollable left rail. The former overlapping/clipped card layout is fixed.

## Selection architecture

The selection path is explicitly separated from 3Dmol internals:

`lexer → parser → Parsed AST → normalization → profile binding → canonical object scope/universe → molecular revision binding → coordinate/topology/namespace dependencies → BoundSelectionPlan → evaluator → stable membership → deterministic SelectionResult → presentation projection`

`apps/web/src/selection/selectionEngine.ts` is the authoritative client selection boundary over backend-provided canonical atoms, coordinates, bonds, structure identity, and molecular revision. Renderer indices are never treated as scientific identity. `SelectionResult` carries status, diagnostics with source spans, provenance, normalized AST/hash, structure/revision, object scope, universe fingerprint, coordinate/topology/namespace dependencies, stable IDs, membership hash, and an explicit `BoundSelectionPlan`.

Supported canonical semantics:

- `all`, `none`, `not`/`!`, `and`/`&`, `or`/`|`, parentheses, with `not` strongest and `and` stronger than `or`.
- Properties `name`, `resn`, insertion-aware `resi`, `chain`, `segi`, `elem`, `id`, `index`, `rank`, `model`, `object`, and `alt`.
- `id`, one-based `index`, zero-based load-order `rank`, and stable canonical IDs remain distinct.
- Categories `protein`/`polymer`, `ligand`/`organic`, `water`, `ion`/`ions`, and `other`.
- Topology-bounded `neighbor` and `bound_to` from canonical bonds only.
- Exact Cartesian Float64 `within` and `around`, including boundary equality and reference exclusion for `around`.
- Snapshot named selections with immutable stable membership, namespace revision changes, rename, delete, update/re-evaluate, and stale-revision protection.
- Parsed ASTs and evaluated memberships are cached with query, structure revision, namespace revision, topology revision, and profile dependencies.

## Command architecture

`apps/web/src/commands/commandRegistry.ts` owns command lexing/splitting, typed domains, definitions, help, and context-aware completion. The selection parser is not reused as a command parser. Current domains are SYSTEM, SELECTION, PRESENTATION, VIEW, LABEL, MEASURE, and OBJECT.

Supported command workflows include:

```text
select active_site, chain A and resi 50-80
show sticks, active_site
hide cartoon, active_site
color red, active_site
color inherit, active_site
label active_site, {resn}{resi}:{name}
center active_site
zoom active_site
rename active_site, binding_site
update binding_site, chain A and resi 60-90
delete binding_site
help select
```

The console provides Up/Down history, Enter submission, Ctrl/Cmd+L clearing, Tab completion, structured category/count/diagnostic output, help, and suggestions for representations, colors, selection categories, object names, named selections, chains, residues, and atom names.

## Objects & Selections

The left Structure panel includes the canonical object scope and named snapshot rows. Each snapshot exposes:

- A — add to the active selection
- S — select exactly
- H — hide the targeted representation mask
- L — apply a safe `{name}` label target
- C — apply a presentation-only cyan color target

These actions mutate only `RenderProjection` and interaction state. Canonical atoms, bonds, coordinates, source metadata, and scientific revision remain unchanged.

## Operator matrix

| Operator/profile | Status | Binding |
| --- | --- | --- |
| Boolean and parentheses | Supported | Canonical stable-ID set algebra |
| `name`, `resn`, `resi`, `chain`, `elem`, `alt` | Supported | Canonical atom/residue fields; wildcard matching where applicable |
| `id`, `index`, `rank` | Supported | Distinct stable/source/order semantics |
| `model`, `object` | Supported, bounded | Active structure identity/name |
| `segi` | Fail-closed | No segment namespace in current canonical contract; never guessed as chain |
| `byres`, `bychain` | Supported | Insertion-aware residue and chain grouping |
| `neighbor`, `bound_to` | Supported | Canonical bond topology |
| `within`, `around` | Supported | Exact Cartesian coordinate context |
| `gap`, PBC/`bycell`, symmetry | Gated | No validated profile admitted |
| `byring`, `byfragment` | Gated | No canonical ring/fragment profile admitted |

## Explicit gated items

Scientific editing, docking, pocket detection, export writers, future workspace modules, segment namespaces, author/label chain namespaces, multi-model state, periodic/symmetry semantics, ring/fragment semantics, ESP fields, partial-charge datasets when absent, and secondary-structure color datasets when absent remain explicitly unavailable, coming soon, experimental, or limited. No toolbar/menu item performs fake scientific behavior.

## Verification

- `npm test -- --run`: PASS — web 16 files / 65 tests; API 2 files / 9 tests.
- `npm run lint`: PASS — API, app, web, and contracts.
- `npm run typecheck`: PASS — API, app, web, and contracts.
- `npm run build`: PASS — API, app, web, and contracts. Existing warnings are the upstream 3Dmol `eval` warning and the large renderer bundle warning.
- `npm run test:e2e`: PASS — 57/57 Chromium tests.
- Browser evidence covers empty state, local PDB ingestion, failed-load preservation, official RCSB mmCIF ingestion, representation matrix, color schemes, component visibility, camera actions, surface profiles/cache behavior, safe labels, analysis diagnostics, command selection, named-selection actions, component color persistence, and left-rail measurement reachability.
- Manual RCSB check: `http://localhost:3101/molstudio?demo=4DJW` loaded official `4DJW.cif`; footer showed 7,079 atoms, 786 residues, and 9 chains.
- Runtime ports: landing `3100`, workstation `3101/molstudio`, API `8100`.
- `git diff --check`: PASS at the verified worktree state.

## Git

- Implementation commit: `231eaf96e93c75c301e64492d2fd6de9fb941562` — `feat: close canonical selection interaction`.
- Evidence refresh commit: `e7196bd0c8ab229ab9c55373f615b56b53cbbeb8` — `test: refresh visualization evidence`.
- Both commits are pushed to `new-origin/fix/visualization-final-closure`.
- Final worktree is clean before this documentation update.

## Screenshots and evidence

- Empty state: `verification/evidence/empty-state.png`
- Local uploaded protein: `verification/evidence/uploaded-cartoon-ligand-sticks.png`
- RCSB protein Cartoon: `verification/evidence/rcsb-4djw-cartoon.png`
- Cartoon + ligand sticks: `verification/evidence/cartoon-ligand-sticks.png`
- Analysis/Measurements scrolled state: `verification/evidence/analysis-interaction-scroll.png`
- Additional representation, surface, label, analysis, and persistence captures are under `verification/evidence/visualization-final/` and `verification/evidence/september-1-current/`.

## Known limitations

- Named selections are session-scoped; the current project presentation contract does not yet persist named-selection definitions.
- The canonical contract does not yet expose author/label chain namespaces, segment identity, or multi-model coordinates.
- `segi` intentionally fails closed; `model` and `object` are bounded to the loaded structure identity.
- `gap`, PBC/bycell, symmetry, byring, byfragment, editing, docking, pocket detection, and other unvalidated scientific operations remain gated.
- The 3Dmol dependency retains its upstream production-build `eval` and bundle-size warnings.

## Final verdict

PYMOL VISUALIZATION + SELECTION MVP COMPLETE — READY FOR USER ACCEPTANCE
