# Molexplorer — Final Autonomous PyMOL Campaign Report

**Campaign date:** 2026-09-09  
**Status:** PASS WITH EXPLICIT LIMITATIONS  
**Decision:** `READY TO SEAL PYMOL CORE: NO`

The requested autonomous conformance campaign was completed on branch `qa/final-pymol-autonomous-conformance-2026-09-09`, created from the required acceptance tip `bf742ff896a289492990744be9f34ec1898c54b3`. The implementation and evidence commit is `227da51`. The repository remote is `new-origin` at `https://github.com/mukundrajambulge/new-mole-explorer-.git`; no main branch, docking, or HTS work was performed.

## Repository and environment audit

The starting worktree was clean and the requested branch/HEAD were verified before branching. Local verification used Node `v24.14.1`, npm `11.11.0`, Python `3.14.2`, Windows 11 Pro 64-bit, an Intel i5-12500H (16 logical processors), ~15.6 GiB RAM, and Intel Iris Xe graphics. Hosted CI is configured for Node 22; that local/hosted difference is recorded rather than hidden.

No `pymol` executable, `pymol.exe`, or importable `pymol` module was present. Therefore `PYMOL_EXECUTABLE_ORACLE: BLOCKED`. The pinned source/documentation comparison is recorded in `PYMOL_SOURCE_DOC_COMPARISON.md/json`, and no source-only row is presented as executable parity.

## Correctness and metadata closure

The runtime probe for `cealign all, all` returned `UNSUPPORTED_CAPABILITY` and the registered `analysis.cealign` handler is unavailable. The generated 345-keyword matrix now records CEALIGN as `SAFE_BUT_NOT_IMPLEMENTED`, `REGISTERED_ONLY`, `UNAVAILABLE`, and `ORACLE_PENDING`; the previous `SAFE_TRANSLATABLE` contradiction is removed. A regression test locks this state.

The complete inventory contains 345 source keywords and 348 runtime command specs. Source dispositions are 44 `SAFE_TRANSLATABLE`, 1 `SAFE_BUT_NOT_IMPLEMENTED`, 228 `ORACLE_PENDING`, 26 `UNSAFE_REJECTED`, and 46 `REFERENCE_ONLY_OUT_OF_SCOPE`. Unsafe Python/shell/system/filesystem/network escape hatches remain rejected by the safety boundary.

The feature inventory contains 220 feature rows, all mapped to contract or live evidence (`FEATURE_COVERAGE_PERCENT: 100`). It includes 87 selection operators, 18 rendering styles, 15 color schemes, camera/visibility/labels/measurements, R07–R10 lifecycle and command surfaces, and performance observations.

## Scientific corpus and query campaign

`DATASET_MANIFEST.json` contains 22 structures: 18 PASS and 4 BLOCKED, from 3 to 58,870 atoms, spanning XS, S, S/M, M, L, XL, and XXL classes. Real RCSB structures include 1CRN, 1UBQ, 4DJW, 1BNA, 1TRA, 1EH1, 1G6V, 1C3W, 1AON, and 5LE5. The malformed local fixture and real 1AFO multi-model correspondence failure are retained as negative cases. 3J9M was stopped after 995.1 seconds without a validated result; 4V6F is blocked by the 26,214,400-byte application ingestion limit.

`QUERY_CORPUS.json` contains 266 cases over the 87 maintained operators: 88 positive, 88 zero-result, and 90 malformed/invalid controls. The pinned ledger supplies 88 directly verified observations and 35 documented equivalents; 92 generated or unavailable-executable cases remain `ORACLE_PENDING`. Invalid syntax is never treated as an empty result.

## Real-app visual and performance evidence

The real app was exercised through the running browser workspace. 4DJW loaded with 7,079 atoms, 786 residues, and 9 chains; `select chain A` reported 3,060 atoms; the 3Dmol.js adapter and explicit docking-unavailable state were visible. Ten canonical, checksummed screenshots are archived under `evidence/` and prior Gate 01/02/03B evidence remains available under `verification/evidence/`.

Measured local API ingestion was 1CRN 327 atoms in 237 ms and 4DJW 7,079 atoms in 5,284 ms in this run. The performance report records architecture/invariant checks from Gate 01 rather than inventing an FPS threshold. XS through L passed bounded ingestion/render tests; XL and XXL are explicitly blocked as described above.

## Verification results

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 138 web + 57 API |
| `npm run build` | PASS (existing 3Dmol eval/chunk warnings only) |
| Full Chromium E2E | PASS — 120/120 |
| `npm run verify:selection-matrix` | PASS — 87 rows; 85 working, 1 missing dependency, 1 intentionally unsupported |
| `npm run verify:r10` | PASS — regenerated 345-keyword matrix |
| Focused final acceptance | PASS — 3/3 for 3 consecutive runs |
| Gate 01 | PASS |
| Gate 02 | PASS |
| Gate 03B | PASS — 2/3 in combined run plus isolated retry PASS; all three cases pass in the final evidence set |

Hosted GitHub Actions run [34358363969](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/34358363969) completed successfully on exact tip `ee513f80ce74f0a94223a2bc45ed51224672ecbf` with Node 22.

No P0 defect remains in the claimed surface. CEALIGN is the single P1 implementation gap; the remaining 228 source rows are explicitly coming-soon/oracle-pending rather than implied support.

## Evidence archive

Drive archive status is `UPLOADED_SELECTED_EVIDENCE`. Folder: [MOLEXPLORER_Final_PyMOL_Autonomous_Acceptance_2026-09-09](https://drive.google.com/drive/folders/1Pzt1KBGdA6ZIFbh9gg1WFlqYGhSztfy1). Unique run folder: [RUN_START_bf742ff_FINAL_227da51_20260909](https://drive.google.com/drive/folders/1ibe0bIIaUdNNpUKNekAB1syMUzkHZ3E-). The run is organized into the requested 00–14 subfolders. Manifests, reports, gap ledgers, performance data, and the canonical screenshot subset are uploaded; raw RCSB downloads remain local and ignored by Git.

## Limitations and promotion decision

This branch proves a bounded, safe PyMOL-compatible translation surface. It does not prove executable PyMOL conformance because the executable oracle is unavailable. The 228 pending source commands, CEALIGN, XL/XXL stress limits, PSE/PZE/movie/imaging references, and any docking/HTS behavior remain visibly bounded. `READY TO SEAL PYMOL CORE: NO`; `READY TO MERGE MAIN: NO`; `DOCKING_OR_HTS_STARTED: NO`.

Machine-readable campaign data is in `FINAL_AUTONOMOUS_PYMOL_CAMPAIGN_SUMMARY.json` and the adjacent inventory, corpus, query, source-comparison, gap, performance, and visual-evidence artifacts.
