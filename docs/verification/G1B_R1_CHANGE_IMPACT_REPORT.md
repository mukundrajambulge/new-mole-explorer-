# G1B-R1 Change Impact Report

Prepared from the clean pre-change audit at `914de2bbaa2e9118cbe672ac810138e2bbaf5ba3` on branch `main`. The repository has no configured Git remote. The worktree was clean before implementation.

## Required change set

- `apps/web/src/components/ContextToolbar.tsx`: replace the mixed permanent toolbar with a category-driven, collapsible ribbon and explicit capability labels.
- `apps/web/src/components/MenuBar.tsx`, `apps/web/src/App.tsx`, `apps/web/src/components/StructurePanel.tsx`: route top-level categories, persist the active ribbon category for the session, and bridge File → Fetch to the existing RCSB form.
- `apps/web/src/rendering/presentationState.ts`, `apps/web/src/rendering/renderDirectives.ts`: keep water sphere-eligible while hidden by presentation visibility and add a canonical render-directive diagnostic boundary.
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`: use `assignBonds: false`, canonical stable-ID projection planning, additive 3Dmol styles, water sizing, and renderer observables.
- `apps/web/src/domain/registry.ts`, `apps/web/src/components/Icon.tsx`, `apps/web/src/styles/global.css`: expose Lines/Sticks/Ribbon capability state and support the ribbon layout.
- `tests/e2e/g0.spec.ts`, `tests/e2e/g1b-r1.spec.ts`, `apps/web/src/rendering/renderDirectives.test.ts`: keep the accepted G0 flows aligned with the explicit contextual File ribbon and add real-browser/pure projection regression coverage.
- `docs/verification/*`, `.github/workflows/ci.yml`: record the baseline and run the verification pipeline.

## Protected no-change set

Backend ingestion, RCSB retrieval, provenance/hash calculation, canonical contracts, API client, project persistence, package versions/lockfile, fixture data, and scientific selection/editing/analysis behavior were not changed.

## Change-safety notes

All presentation actions operate on `RenderProjection`/`RenderProjectionDiagnostics`. They do not write canonical atom coordinates, bonds, hierarchy, scientific hash, source metadata, or provenance. Ribbon is explicitly Coming Soon and has no renderer substitution.
