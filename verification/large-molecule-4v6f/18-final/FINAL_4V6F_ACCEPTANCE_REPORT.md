# MOLEXPLORER 4V6F large-molecule acceptance report

## Scope and provenance

- Repository: `C:\Users\mukun\Desktop\molecular-workstation`
- Branch: `qa/final-large-molecule-4v6f-acceptance`
- Base SHA: `a9c8667304cc07158fecbd935f3eb314d515c55d`
- Remote: `https://github.com/mukundrajambulge/new-mole-explorer-.git` (`new-origin`)
- Official source: `verification/large-molecule-4v6f/01-source/4v6f.cif`
- Source SHA256: `a48b6f9865ed1dff0e45d1992b9d20633582de6675c16d0b9a4abc75d595e56f`

## Outcome

The former exact 25 MiB upload blocker is resolved. The 38,137,644-byte official 4V6F source is accepted by the new 512 MiB transport ceiling, and a deterministic lightweight source scan reports 307,345 atom rows, 26,941 residues, and 5,467 chains.

Full acceptance is **blocked** by `LM-IMP-001`: canonical `StructureIngestionService` identity construction did not return within repeated bounded observations. The latest attempt, after parser, streaming-hash, and lazy-payload optimizations, was cancelled after approximately four minutes at approximately 1.5–1.85 GiB Node memory. Lightweight source-scan counts are therefore not presented as canonical import, render, or interaction passes.

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| Old 25 MiB blocker | PASS / RESOLVED | API ingestion tests and `00-baseline/BASELINE.json` |
| Official 4V6F acquisition | PASS | `01-source/4V6F_SOURCE_IDENTITY.json` |
| Lightweight source identity | PASS, source-scan only | `03-identity/4V6F_PARSED_IDENTITY.json` |
| Canonical 4V6F import | FAIL / BLOCKED | `16-defects/LM-IMP-001` |
| Canonical first render | NOT RUN | blocked by canonical import |
| Canonical interactive selection/render | NOT RUN | blocked by canonical import |
| Responsive layout regression | PASS | `16-defects/LM-RESP-001`, 147/147 E2E |
| Pinned PyMOL oracle | BLOCKED_ENVIRONMENT | `15-oracle/4V6F_PYMOL_ORACLE_MATRIX.md` |
| Google Drive evidence | see manifest | `17-drive/4V6F_DRIVE_MANIFEST.json` |

## Source-scan identity

The source scan records 301,988 polymer atoms, 95,280 protein atoms, 206,708 nucleic atoms, 5,351 inorganic/metal atoms, 6 solvent atoms, 5,531 HETATM rows, zero hydrogens, 197,622 backbone atoms, and 21,574 guide atoms. It reports 100 protein chains, 14 nucleic chains, and 114 polymer chains. Membership hashes and the full chain inventory are preserved in `02-import/` and `03-identity/`.

## Selection and feature coverage

The previous 523 A→BF definitions were classified semantically: 491 are applicable in principle to 4V6F and 32 remain retained as prior-fixture-only cases (charge, multi-state, or small-edit fixtures). Zero applicable rows were executed against the canonical 4V6F model because of LM-IMP-001. See `05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.*`.

The ordinary application regression is healthy: `npm run test:e2e` completed with **147 passed, 0 failed** in 39.5 minutes, including the repaired responsive case, 4DJW/1CRN workspace cases, exhaustive A→BF replay, and live representative selection matrix. This validates the existing standard fixtures, not canonical 4V6F acceptance.

## Verification commands

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS, 215 tests
- `npm run build` — PASS (existing 3Dmol eval and large-chunk warnings remain)
- `npm run test:e2e` — PASS, 147/147
- `npm run verify:selection-matrix` — PASS, 87 rows
- `npm run verify:r10` — PASS

## Defects and lock decision

- `LM-RESP-001`: fixed. The stale responsive root-grid rule had reduced `.app-main` to 56px; after the fix, the 720×800 canvas measured 478×702 CSS pixels with a 956×1404 backing buffer.
- `LM-IMP-001`: open P1 acceptance blocker. Canonical identity construction must become bounded/streaming for this structure class.

No `4V6F_LARGE_MOLECULE_LOCK.json` was created. The branch is not ready to lock large-molecule support or claim canonical 4V6F interactive acceptance. No merge to main and no docking work were performed.

