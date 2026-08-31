# G1C pre-change impact report

## Audit snapshot

- Branch: `main`
- Starting SHA: `daa19b97cf928579cd365ba613943f4b7080133e`
- Remote: none configured
- Worktree before change: clean
- Baseline: lint, typecheck, 17 unit/API tests, build, and 29 Playwright/WebGL tests passed before G1C edits.

## Scope and change classification

### ALLOWED_TO_CHANGE

- `packages/contracts/src/index.ts`: additive canonical scientific-property contracts and G1C capability metadata only.
- `apps/api/src/structures/ingestion.ts` and its tests: additive parsing of authoritative PDB/mmCIF properties required by presentation schemes; preserve existing source/hash/topology behavior.
- `apps/web/src/rendering/*`: presentation state, representation profiles/directives, color schemes, surface profiles, and the renderer projection boundary.
- `apps/web/src/components/*`, `apps/web/src/App.tsx`, `apps/web/src/domain/registry.ts`, and presentation styles: wire shared presentation actions into the approved existing shell.
- `tests/fixtures/*`, `tests/e2e/*`, and frontend/backend tests: deterministic G1C coverage and fixture evidence.
- `docs/visualization/*`, `docs/verification/*`, and CI only where needed to document and execute G1C.

### PROTECTED_NO_CHANGE

- The approved overall GUI geometry and visual language: no redesign of the shell, panel placement, or canvas layout.
- Backend remote-ingestion/provenance/hash authority: no client-side fetch, source replacement, topology inference, or scientific mutation.
- 3Dmol lifecycle boundary: no React-owned viewer, duplicate mounted viewer, renderer index as durable identity, or automatic bond inference.
- Existing G0/G1B accepted tests and their scientific expectations: tests may receive only additive selectors/assertions when required by the new UI contract; no weakening or deletion.
- Project persistence/API route shape unless additive schema compatibility is required.
- Advanced selection, editing, measurements, analysis, docking, and HTS: explicitly out of scope for G1C.

## Expected impact

G1C will broaden the presentation vocabulary and property metadata while keeping the canonical structure object immutable by convention and by invariant tests. Existing load, RCSB, project, camera, visibility, and failure-preservation paths remain regression-gated. Surface modes will have distinct renderer-neutral profiles; any generator not scientifically implemented remains explicitly unavailable/coming-soon rather than being substituted.

## Research constraints applied

- R-PYMOL-02: canonical topology and hierarchy drive representation contributors; Ball-and-Stick is `STICKS + SPHERES`; Licorice is `STICKS + NB_SPHERES`; masks persist independently of visibility and color.
- R-PYMOL-03: color is durable presentation state over stable targets; base colors survive representation changes; property schemes must not coerce unknown values; the PyMOL named registry is source/profile-pinned.
- Master research index: native Google Docs are authoritative; prior repositories are semantic/reference evidence only.
