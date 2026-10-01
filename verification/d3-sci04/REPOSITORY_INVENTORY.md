# D3-SCI-04 Preservation Preflight — Repository Inventory

Snapshot date: 2026-10-01. Repository remote: `new-origin` → `https://github.com/mukundrajambulge/new-mole-explorer-.git`.

## Original Desktop checkout

- Path: `C:\Users\mukun\Desktop\molecular-workstation`
- Branch/HEAD: `fix/lm-imp-001-canonical-large-ingestion` at `c93643f83e68f656ec40980e36aebe9f4ace56df`
- Upstream: none configured.
- Status inventory: 1,940 entries; 677 modified/deleted tracked paths, 1,263 untracked paths, zero staged changes.
- These pre-existing dirty paths include verification images, reports, and other evidence. This checkout was not modified or cleaned for D3-SCI-04.

## Relevant live remote refs

Read-only `git ls-remote` confirmed:

- `main`: `c219d5fcfcbe71537fb8e0139cdef495a9f1f504` (expected current integration baseline).
- `feature/d3-vina-torsion-profile`: `f0bd2eaf47b02faab4dea694e7c2677094969076` (D3-TOR-01).
- `preserve/d3-reference-scoring-evidence-2026-09-28-d30c41f1`: `d30c41f1ba438be8c104c8fc7902d14fe49fdc74`.
- `mole-explorer-docking-d2-accepted-2026-09-20` dereferences to accepted D2 commit `ba2ffb4eb28a00ee945086b24f39bf639ca2250c`.
- `mole-explorer-p0-perf-accepted-2026-09-21` dereferences to protected P0 commit `f773b7fcf0a6f16b23f9abc760fa9d2292b63061`.
- No D3 acceptance tag was returned by the relevant remote tag inventory.

## Worktrees

- D3-SCI-04 evidence worktree: `C:\Users\mukun\.codex\worktrees\d3-sci04-proof\molecular-workstation`, detached at D3-TOR-01 `f0bd2eaf47b02faab4dea694e7c2677094969076`; before preservation packaging its only untracked subtree was `verification/d3-sci04/`.
- Existing D3-TOR-01 worktree: `C:\Users\mukun\.codex\worktrees\d3-vina-torsion-profile\molecular-workstation`, branch `feature/d3-vina-torsion-profile`, clean at the same `f0bd2ea` commit.
- Other registered P0 worktree: `C:\Users\mukun\.codex\worktrees\molecular-workstation-p0-perf`, `codex/p0-perf-consolidation` at `e4119a6224aa4f63bd692024b74e5ef43ff822aa`.
- Five older `molecular-workstation-pre-docking-validation*` entries are reported by Git as prunable because their gitdir targets are missing. They were left untouched; no worktree was removed or pruned.

## Preservation interpretation

Remote `main` still matches the expected integration baseline, and the D3-TOR-01 and preservation refs still resolve to the recorded SHAs. D3-SCI-04 evidence remains an isolated test-only change based on the pinned D3-TOR-01 commit. The Desktop checkout's dirty inventory was preserved as found.
