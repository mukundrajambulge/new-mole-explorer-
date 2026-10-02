# D3-EXT-FIX-01 preflight record

Preflight evidence was captured before lane package authoring. Remote heads were rechecked read-only on 2026-10-02.

| Item | Observation |
|---|---|
| Repository | mukundrajambulge/new-mole-explorer- |
| Authoritative remote | new-origin → https://github.com/mukundrajambulge/new-mole-explorer-.git |
| Remote main | c219d5fcfcbe71537fb8e0139cdef495a9f1f504 |
| Remote feature/d3-scoring-field-core | 24c2bf28b811af21c22693091f80f2e47e84fc80 |
| Remote research/d3-sci04-sparse-grid-proof | 6769f00cbfd4486a86c7512030b4cf942a9244a8 |
| Remote feature/d3-vina-torsion-profile | f0bd2eaf47b02faab4dea694e7c2677094969076 |
| D3-EXT-FIX-01 base | 3a9cb844f82898df2cfba43cd19e859ee4db0832, the D3-PREP-DEC-02 closure commit |
| Lane branch | research/d3-ext-fix-01-core-dry-discovery |
| Lane worktree | C:\Users\mukun\.codex\worktrees\d3-ext-fix-01-core-dry-discovery\molecular-workstation |
| Initial lane status | Clean at worktree creation; no pre-existing lane edits. |
| Current status before commit | Only verification/d3-ext-fix-01/ is untracked; no tracked production or other verification path is changed. |

The remote heads were read from new-origin and match the values above. D3-FP-01, D3-PREP-DEC-01, D3-PREP-CAND-02, D3-PREP-DEC-02 and D3-SCI-04 worktrees were visible and their evidence commits remained intact. The D3 scoring-field implementation worktree is at 24c2bf28b811af21c22693091f80f2e47e84fc80; the D3 torsion worktree is at f0bd2eaf47b02faab4dea694e7c2677094969076.

Several older detached Desktop worktree records were marked prunable because their gitdir targets no longer exist. They were not pruned or modified. This task preserves all extant predecessor worktrees and does not reset, clean, stash, rewrite or delete historical state.

Canonical Drive master/roadmap and applicable preparation, state, provenance, scoring, validation and acceptance documents were reviewed on 2026-10-02 from the [Mole Explorer canonical master folder](https://drive.google.com/drive/folders/1xEzwWnU1VCv3BHtemD-NDXTvVitvczuT). The [Global Master Plan](https://docs.google.com/document/d/1iaA9GTDupbPAEV1yKCK6cLE5yAWxmNoRfV4PM9-r5wk/edit), [Execution Roadmap](https://docs.google.com/document/d/1YDNaYI9xe9lL3L1e3zjGjTGOWe6hSN4o5ggfd3q7HBhU/edit), [PHD-V2-08 provenance research](https://docs.google.com/document/d/1zq4OFNh_Vg4OmZPPn1jBoyLyI7awHxlO3uXjpqJNR5g/edit), and [Normalized Docking Requirements](https://docs.google.com/document/d/1_MRzFxcg0wgNAeyo5mFKHI8HA6JTtJiGPtZ79nuddY/edit) were among the linked source materials. The current CORE_DRY_V1 interpretation used here is: rigid receptor; explicit prepared receptor and ligand states; no explicit scoring water; no coordination-aware metal scoring; no receptor motion; no covalent scoring. Water/component omission must be explicit, role-based, evidenced and provenance-bearing. The current scorer architecture remains 16 XS types, five terms, 80 logical channels and conditional 59 arrays. See the project source citations in D3_EXT_FIX_01_REPORT.md and DISCOVERY_SEARCH_PROTOCOL.md.

Search query requests/responses and entry metadata are retained in source_artifacts/. Raw official mmCIF files and audit output are retained for all ten detailed candidates. Their digests are listed in SHA256SUMS.txt.
