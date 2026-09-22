# Repository, worktree, branch, and CI consolidation

Audit date: 2026-09-21. The exact protected tag commits were verified locally and through dereferenced remote tag refs:

| Baseline | Local commit | Remote dereferenced tag |
| --- | --- | --- |
| D1 `mole-explorer-docking-d1-accepted-2026-09-19` | `26227a10416657d0c2518bd0b751a38693627d5b` | exact match |
| D2 `mole-explorer-docking-d2-accepted-2026-09-20` | `ba2ffb4eb28a00ee945086b24f39bf639ca2250c` | exact match |
| UI-D0 `mole-explorer-docking-ui-d0-accepted-2026-09-20` | `d63c2126bb27d6513166e5f90375c213c314fa0c` | exact match |

The accepted UI-D0 branch was pushed and verified at `new-origin/feature/docking-ui-d0-workspace`; the D2 and UI-D0 tags are remote-protected, and D1 is also remote-protected.

## Canonical checkout decision

`C:\Users\mukun\.codex\worktrees\molecular-workstation-p0-perf` on `codex/p0-perf-consolidation` is the canonical P0 implementation checkout. It is clean except for the three intended source changes and six P0 evidence artifacts. The preferred Desktop checkout cannot safely be made canonical yet because `C:\Users\mukun\Desktop\molecular-workstation` contains unique, uncommitted LM-IMP-001/performance/selection evidence (`661` modified entries and `1,255` untracked entries). That original checkout is retained as an evidence-recovery workspace and was not reset, reverted, or overwritten.

## Worktree inventory and action

| Checkout | HEAD/branch | State | Action |
| --- | --- | --- | --- |
| `Desktop/molecular-workstation` | `53ea465` / `fix/lm-imp-001-canonical-large-ingestion` | dirty evidence | retained; do not mutate |
| `.codex/worktrees/molecular-workstation-p0-perf` | `d63c212` / `codex/p0-perf-consolidation` | intended P0 changes | canonical |
| `Desktop/molecular-workstation-ci-fix-validation` | `53ea465` / detached | `637` modified entries | retained; CI/evidence recovery |
| `Desktop/molecular-workstation-pre-docking-validation` | `0184d44` / detached | one untracked artifact | retained |
| `...-2` | `385d9cf` / detached | one untracked artifact | retained |
| `...-3` | `bb55174` / detached | one untracked artifact | retained |
| `...-4` | `f9f86cc` / detached | `80` modified, `48` untracked | retained |
| `...-5` | `28a8dca` / detached | `679` modified, `2` untracked | retained |

Four clean duplicate checkout folders were removed after exact clean-state and commit-retention checks: the UI-D0 worktree, the D2 explicit-state worktree, the architectural-fixes worktree, and the D1 sealed-core worktree. Their branches/commits remain available; protected accepted tags remain immutable. No dirty checkout was deleted.

## Remote branch report

- Promotion anchors: `main` and `dev` remain separate remote branches and are not ancestor-equivalent to UI-D0. They must be reconciled through a deliberate promotion PR; neither was deleted.
- Active accepted feature: `feature/docking-ui-d0-workspace` points exactly to UI-D0 and is retained.
- Historical branches `feature/r07-*`, `feature/r08-*`, `feature/r09-*`, `feature/r10-*`, the manual-gate fixes, the R07/R08/R09 integration branches, and the QA closure branch all have tips reachable from UI-D0 and no commits newer than UI-D0. They are superseded/archive candidates, but were not remotely deleted without explicit branch-owner authorization.
- D1/D2 contract branches, `repair/e2e-readiness-2026-09-19`, and `seal/pre-docking-pymol-core-2026-09-19` carry unique gate/evidence commits outside UI-D0. They remain preserved.
- The only active implementation branch created for this work is `codex/p0-perf-consolidation`; it must be pushed and protected before final closure.

## CI strategy

`.github/workflows/ci.yml` now has an explicit matrix:

| Event/ref | Fast lint/typecheck/unit/build | Full serialized browser acceptance |
| --- | --- | --- |
| Pull request to `main` or `dev` | yes | no |
| Push to any branch | yes | no |
| Push to `dev` or `main` | yes | yes, 90-minute budget |
| Manual dispatch with `full_acceptance=true` | yes | yes |
| Manual dispatch with default input | yes | no |

Concurrency cancels superseded non-manual runs. The full acceptance command remains `npm run test:e2e -- --reporter=github`; it was not removed or weakened.
