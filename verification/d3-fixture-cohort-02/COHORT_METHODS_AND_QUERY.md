# Cohort methods and query

## Search definition

The search is the retained RCSB exact-component query for `RTL` (all-trans-retinol), X-ray structures, one deposited model, protein polymer plus non-polymer ligand, and resolution at or better than 2.5 Å. The raw response is `source_artifacts/queries/rcsb_RTL_search.json`; its result set contains 28 distinct entries. The query file is retained so the entry set can be rechecked. It is a bounded cohort rather than an open-ended search.

The query deliberately screens deposited complex structures. It does not assume every hit is a viable receptor: the protein identity/source, biological assembly, exact ligand instance, sequence completeness, alternates, ligand occupancy, non-water components, and water context are resolved from the deposited mmCIF and primary records.

## Staged review

1. **Fast source/record screen — 28 entries.** Identify protein family/species, source type and expression host when deposited, resolution, coordinate gaps, alternate-location flags, RTL instances/occupancy, and non-water components. Redundant pH-series or construct series are screened against a better-documented representative. Disposition for all 28 is recorded in `COHORT_SCREEN_DECISION_MATRIX.csv`.
2. **Detailed screen — 15 entries.** Review candidate sequence/construct evidence, modeled ligand state, missing-coordinate context, alternate states, assembly and components. The 10 `DETAILED_SCREEN` rows plus five `DEEP_FINALIST` rows comprise these 15.
3. **Deep finalists — five entries.** Compare `5LJB`, `1KT5`, `1GX8`, `6PY0`, and `9I7O` against the source, assembly, CORE_DRY_V1, water, and candidate-specific preparation-authorization criteria. `9I7N` is retained as a paired structure from the same paper, but is a detailed comparator, not a sixth finalist.
4. **Independent review.** An independent read-only structural/source review evaluated 9I7O's source lot ambiguity, natural sequence mixture, missing N terminus and internal segment, pH discrepancy, assembly, and ligand state. Its qualified-yes conditions are carried into the decision and prompt.

The counts and dispositions implement the predecessor strategy: source tractability first, then a bounded detailed review and a smaller finalist set. The search does not automatically expand to new domains, fabricated fixtures, or broader ligand classes.

## Reproducible evidence

- `COHORT_SOURCE_TRACTABILITY_MATRIX.csv` maps every exact hit to source/structure fields and retained evidence paths, with direct entry, coordinate, and DOI links.
- `COHORT_SCREEN_DECISION_MATRIX.csv` states each hit's stage and concise disposition reason.
- `audit/*.py` contains the local mmCIF audit and matrix-building scripts. They read the retained downloaded evidence and write only within this lane.
- `source_artifacts/SHA256SUMS.txt` records SHA-256 checksums for every retained source artifact.
- Raw exact queries, structure mmCIFs, metadata, CCD record, primary-source XML, biological assembly files where needed, and validation reports are kept under `source_artifacts/`.

## Search limits

This exact-ligand, X-ray, single-model, ≤2.5 Å cohort favors deposited high-resolution retinol complexes. It can miss structures under alternate ligand component IDs or other experimental modalities. Those expansions were not needed: the cohort yielded an admissible source-resolved CORE_DRY_V1 candidate. Water essentiality is not inferred from nearest-water distance alone; source-literature claims and direct water contacts are considered separately.
