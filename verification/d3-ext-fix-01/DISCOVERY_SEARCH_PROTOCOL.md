# Discovery search protocol

## Authority and date

Searches used current RCSB PDB Search and Data APIs and official wwPDB/RCSB mmCIF downloads on 2026-10-02. Search is discovery only. Every detailed candidate was re-audited from the retained raw mmCIF; no benchmark-prepared receptor or ligand was used. RCSB documents the JSON Search API and GraphQL Data API at [search.rcsb.org](https://search.rcsb.org/) and [data.rcsb.org](https://data.rcsb.org/).

## Stage A core query

The exact JSON request is `source_artifacts/rcsb_broad_query.json`; the reproduced response is `source_artifacts/rcsb_broad_search_reproduced.json`; GraphQL page metadata is `source_artifacts/rcsb_broad_entries.json`. Predicates: `exptl.method = X-RAY DIFFRACTION`; resolution ≤2.0 Å; deposited model count =1; protein entity count ≥1; non-polymer annotation type `SUBJECT_OF_INVESTIGATION`. Results sorted ascending by `rcsb_entry_info.resolution_combined`; first 81 hit IDs fetched, matching the preserved 81-ID response and its total count 24,581. This page is a bounded first-page sample, not a random sample of the archive.

A separate exact `BNZ` component query used the same experimental predicates plus `rcsb_nonpolymer_entity_container_identifiers.nonpolymer_comp_id = BNZ`. It returned all 19 hits. Its exact request is `source_artifacts/rcsb_bnz_query.json`, response `rcsb_bnz_search.json`, and metadata `rcsb_bnz_entries.json`. The broad and BNZ result sets overlap at 9BZT; the Stage A core is therefore 99 distinct PDB IDs.

## Directed component follow-up

To avoid T4 lysozyme fixation, targeted exact-component searches were run and their query/response JSON retained: BEN (257 hits under the 2.0 Å filter), BEZ (144), FIS (2), plus a combined discovery query for BNZ/BEN/BEZ/N92/TZL/IPH/IND/NAP/TOL/4I1/IPB/PYJ (1,552 total, first 100 fetched). BEN and BEZ full result sets were fetched where ≤500 hits. Four explicit follow-up structures were added to the pool: 4EMN and 2OXS from the complete BEN list; 3BCJ from FIS; 1MUP from TZL after relaxing the resolution ceiling to 2.5 Å (the task permits a slightly lower resolution when useful). Exact requests are `rcsb_ben_all_query.json`, `rcsb_bez_all_query.json`, `rcsb_fis_query.json`, and `rcsb_tzl_25_query.json`; their responses and corresponding entry metadata are retained.

The final pool file has 103 unique rows: 99 core plus the four targeted additions. Stage B fast dispositions are per row in `DISCOVERY_POOL.csv` and grouped in `FAST_EXCLUSION_LOG.md`. 93 candidates were fast-excluded and 10 advanced to source-level detailed audit; four finalists received comparative deep review. This is categorical triage, not an arbitrary numeric ranking.

## Raw source and audit procedure

Official downloads: `https://files.rcsb.org/download/{PDB}.cif`. Official current CCD component files for BNZ, BEN, BEZ, N92, TZL, 4I1, FIS, AIB and I77 are retained in `source_artifacts/ccd/`. The UniProt reference JSON for P00720 was retrieved because the 4W52 construct mapping is material; it is retained in `source_artifacts/uniprot/`. Official wwPDB validation PDFs for finalists 4W52, 5JWT, 4EMN and 7FEZ were retrieved from `https://files.rcsb.org/validation/view/{lowercase_PDB}_full_validation.pdf` and retained in `source_artifacts/validation/`; their report dates are 2026-03-09 or 2026-03-10. The raw CIF artifacts are marked binary in the lane-local Git attributes so their deposited bytes, spacing and line endings are preserved. The retained `audit/audit_mmcif.py` reads deposited model 1 only and reports ligand heavy-atom completeness/occupancy, polymer sequence coverage, deposited unobserved residues/atoms, alternate locations within 5 Å, nearest waters/non-polymers/metals, ligand bounding box, and geometry-only ligand–water–receptor neighbor context for waters within 8 Å. The water-neighbor output is not a hydrogen-bond or essential-water assignment. The parser does not add hydrogens, assign protonation, alter coordinates, or score. For each finalist the report links the exact retained artifact and SHA-256 manifest. Local audit output is structured evidence, not a prepared-state object.

## Limits

Search ranking and RCSB subject annotations are discovery aids. They do not establish biological relevance, construct identity, water dispensability, ligand protomer, XS typing, preparation readiness, or fixture eligibility. Page limits, search date, focused component seeds, and all exclusions are recorded so later work can reproduce the same funnel.
