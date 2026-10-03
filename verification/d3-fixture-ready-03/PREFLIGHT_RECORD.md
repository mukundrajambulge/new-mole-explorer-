# D3-FIXTURE-READY-03 preflight record

## Repository and isolation

- Repository: `mukundrajambulge/new-mole-explorer-`.
- Authoritative remote: `new-origin` → `https://github.com/mukundrajambulge/new-mole-explorer-.git`.
- `git fetch new-origin` completed before worktree creation. No reset, clean, stash, rebase, squash, history rewrite, deletion, or push was performed.
- Fetched `new-origin/main`: `c219d5fcfcbe71537fb8e0139cdef495a9f1f504`. Local `main` was `b436c91c1fe425e981818c51a7fcf122475a5a8a`; the fetched remote ref was used as the authoritative remote state.
- Required evidence base: `79ff8463f93f36a19b7a97bcfdb33aaa5e7fb173` (`docs: record D3 prep DEC-03 HOLD rerun`), parent `6b4c8843265d1e160213828376f152ff81f18995`.
- Relevant preserved commits: D3-FIXTURE-COHORT-02 `6b4c8843265d1e160213828376f152ff81f18995`; D3-4W52-SRC-01 `fc687c5aebab248cf8f0a58631b6cfe78420d30c`; D3-EXT-FIX-01 `697f6074fa1869bf120d537cbcffd7d85c006981`; D3-TOR-01 `f0bd2eaf47b02faab4dea694e7c2677094969076`; D3-SCI-04 `6769f00cbfd4486a86c7512030b4cf942a9244a8`; D3-GRID-01 `24c2bf28b811af21c22693091f80f2e47e84fc80`.
- Suggested branch `research/d3-fixture-ready-03` was already checked out in the separate worktree `C:\Users\mukun\.codex\worktrees\d3-fixture-ready-03\molecular-workstation` at `ee046917743b9eb564d12cfb077ac4965fad77d2` and had pre-existing local changes. That worktree and branch were left untouched. This isolated rerun uses `research/d3-fixture-ready-03-rerun` at the exact requested base.
- New worktree: `C:\Users\mukun\.codex\worktrees\d3-fixture-ready-03-research\molecular-workstation`.

## Existing worktree preservation

The pre-existing D3-related worktrees were inspected read-only. The D3-4W52 resolution, D3-EXT-FIX-01, D3-FIXTURE-COHORT-02, D3-FP-01, D3-PREP-DEC-01/02/03, D3-SCI-04, D3-GRID, and D3-TOR worktrees were present on their recorded branches. The separate suggested-name D3-FIXTURE-READY-03 worktree was dirty with an existing Python cache modification and untracked files in its own `verification/d3-fixture-ready-03/` lane. Those files were used only as leads and were not edited, staged, cleaned, or deleted. The desktop worktree also contained extensive pre-existing user changes and was not touched. Five pre-existing detached desktop worktree registrations were marked prunable; they were left in place.

## Canonical project review

Before candidate screening, the current live Drive folder and the current v1.2 Global Master Plan and Execution Roadmap were read:

- [Mole Explorer — Project Source of Truth folder](https://drive.google.com/drive/folders/1xEzwWnU1VCv3BHtemD-NXTvVitvczuT)
- [Global Master Plan and Source of Truth](https://docs.google.com/document/d/1iaA9GTDupbPAEV1yKCK6cLE5yAWxmNoRfV4PM9-r5wk/edit)
- [Execution Roadmap and Master Plan](https://docs.google.com/document/d/1YDNaYI9xe9l3L1e3zjGjTGOWe6hSN4o5ggfd3q7HBhU/edit)
- [PHD-V2-06: type and scoring support](https://docs.google.com/document/d/14vb5hf4Nb5vZKlSqayX1bW-bAh9o073i6ueace0NERM/edit)
- [PHD-V2-08: waters, metals, and components](https://docs.google.com/document/d/1zq4OFNh_Vg4OmZPPn1jBoyLyI7awHxlO3uXjpqJNR5g/edit)
- [D3-GRID-DEC-02](https://docs.google.com/document/d/1eAGdTZhDEBmSYzbBy4zfeLADQDnjDeGA6Sg-XmhmJIg/edit) and [its reconciliation](https://docs.google.com/document/d/1xcJnrNK6bni-_3GZfJEkHIKLHyOoZl9uCGGV6upCG6w/edit)
- [Normalized docking requirements](https://docs.google.com/document/d/1_MRzFxcg0wgNAeyo5mFKHI8HA6JTtJiGPtZ79nuddY/edit) and [final acceptance specification](https://docs.google.com/document/d/1QjuDYapWNc2bRX4CUpa5w57iJP0evMc9SnSDqu8rFrg/edit)

The current PHD-V2-03/04/05/10/13/15 materials were also read from the live canonical folder: receptor/assembly identity, ligand and coordinate state, SearchRegion, provenance, numerical semantics, and synthesis/acceptance constraints. Repository evidence was cross-checked in `docs/docking/D3-TOR-01.md`, `verification/d3-grid/D3_GRID_01_REPORT.md`, and the D3-FP-01 records. Current policy remains a rigid explicit prepared receptor/ligand pair; no explicit water scoring, metal coordination model, receptor motion, or covalent scoring. The field has 16 canonical XS types, five terms, 80 logical channels, and 59 conditional physical arrays, with 0.375 Å spacing, an 8 Å pair cutoff, one-cell interpolation halo, and the existing 110-node dimension limit.

## Prior evidence reviewed

The following preserved evidence was read before selection: `verification/d3-prep-dec-01-181l-bnz/`; `verification/d3-prep-dec-02-3atl-ben/`; `verification/d3-4w52-src-01/`; `verification/d3-ext-fix-01/`; `verification/d3-fixture-cohort-02/`; and the latest `verification/d3-prep-dec-03-9i7o/`, including `SOURCE_AUDIT_RECONCILIATION.md`. 9I7O remains closed and is not a candidate in this rerun.

## Scope and verification boundary

All authored files and retained current RCSB data are in `verification/d3-fixture-ready-03/`. The official coordinates were parsed read-only against embedded PDB CCD heavy-atom definitions. Missing coordinate residues were separated from incomplete modeled residues; OXT was checked only at the deposited polymer C terminus; alternate atom names were unioned for heavy-atom completeness and separately analyzed by conformer; peptide C–N links were measured. No coordinates were edited, repaired, minimized, protonated, hydrogenated, typed into prepared states, serialized to PDBQT, scored, docked, or used to create a field.

The new branch is based on the requested immutable predecessor SHA. The final local integrity check is `git diff --check`; source and artifact digests are recorded in `SHA256SUMS.txt`.
