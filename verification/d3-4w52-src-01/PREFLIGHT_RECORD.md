# Repository and task preflight

## Scope and initial state

Repository: mukundrajambulge/new-mole-explorer-. Research worktree: C:/Users/mukun/.codex/worktrees/d3-4w52-src-01-resolution/molecular-workstation. Branch: research/d3-4w52-src-01-resolution. The worktree was created from predecessor commit 697f6074fa1869bf120d537cbcffd7d85c006981, whose parent is 3a9cb844f82898df2cfba43cd19e859ee4db0832. The initial research checkout was clean. All authored and retrieved files for this gate are confined to verification/d3-4w52-src-01/.

The user's source-only restrictions were preserved: no preparation, protonation, added hydrogens, PDBQT, direct/grid score validation, docking, scorer changes, water/metal implementation, PyMOL changes or D4 work. Existing worktrees were inspected and left untouched, including the dirty desktop checkout and the D3-FP, D3-EXT-FIX, D3-PREP-DEC-01/02, scoring, torsion and SCI-04 worktrees. The already-running local server was left untouched.

## Remote/ref check

Authoritative configured remote: new-origin, https://github.com/mukundrajambulge/new-mole-explorer-. A fresh fetch and remote ref listing recorded:

| Ref | Remote commit |
|---|---|
| main | c219d5fcfcbe71537fb8e0139cdef495a9f1f504 |
| feature/d3-scoring-field-core | 24c2bf28b811af21c22693091f80f2e47e84fc80 |
| feature/d3-vina-torsion-profile | f0bd2eaf47b02faab4dea694e7c2677094969076 |
| research/d3-sci04-sparse-grid-proof | 6769f00cbfd4486a86c7512030b4cf942a9244a8 |

The predecessor commit 697f6074fa1869bf120d537cbcffd7d85c006981 was verified locally and was not present as a remote branch ref at preflight. The remote research/d3-ext-fix-01-core-dry-discovery ref was absent, consistent with the predecessor report that it was local-only. The TOR and GRID refs are ancestors of the chosen base; SCI-04 is preserved separately and is not an ancestor. No reset, clean, stash, branch rewrite, force push, or other worktree mutation was performed.

## Project gate state carried forward

181L/BNZ remains rejected under D3-PREP-DEC-01; 3ATL/BEN remains rejected under D3-PREP-DEC-02. D3-EXT-FIX-01 remains HOLD, with no candidate admitted. PyMOL is protected; D1/D2 accepted; D3-TOR-01 and D3-SCI-04 preserved; D3-GRID-01 bounded PASS; full D3 HOLD; D4 BLOCKED; DOCKING.RUN unavailable.

## End-state verification

Only the allowed verification lane is changed in this commit. Source comparison and sequence consistency scripts are read-only except for outputs within this lane. The final commit hash and clean-worktree result are recorded in the completion response and verified from Git after commit.
