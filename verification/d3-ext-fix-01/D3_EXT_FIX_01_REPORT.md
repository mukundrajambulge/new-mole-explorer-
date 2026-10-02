# D3-EXT-FIX-01 — External CORE_DRY_V1 full-pose fixture discovery

## Final classification

**D3-EXT-FIX-01 HOLD — PROMISING CANDIDATES REQUIRE SOURCE RESOLUTION**

No candidate is classified `CORE_DRY_V1_ADMISSIBLE`, so none is selected for D3-PREP-DEC-03. 4W52/BNZ is the strongest current lead, but its physical construct and unmodeled C-terminal extension still lack primary-source resolution. No preparation authorization or D3-PREP-DEC-03 prompt is issued.

## Scope and gate state

This is external discovery and read-only structural triage. No preparation, protonation, hydrogen addition, PDBQT, coordinate editing, scoring, direct/grid comparison, docking, or production change occurred. Full D3 remains HOLD; D4 remains BLOCKED; `DOCKING.RUN` remains unavailable.

The controlling canonical profile reviewed for this task is `CORE_DRY_V1`: rigid receptor; explicit prepared receptor/ligand state; no explicit scoring water; no coordination-aware metal chemistry; no receptor motion; no covalent scoring. Waters may be omitted only when role and reason are recorded and evidence supports their dispensability. A conserved/recognition bridge or pocket-dependent water is unsupported under ordinary dry V1. The current 16 XS types / five terms / 80 logical channels / conditional 59 arrays remain unchanged. The Drive master plan, roadmap, D3-GRID-01, D3-TOR-01, D3-FP-01, D3-PREP-DEC-01/02, D3-RA-01, D3-VAL-01, PHD-V2 research, normalized requirements and final acceptance sources were reviewed on 2026-10-02; see `PREFLIGHT_RECORD.md`.

## Search funnel

The reproducible Stage A core contains 99 distinct entries: the 81-entry first page of an RCSB X-ray / resolution ≤2.0 Å / one deposited model / protein present / non-polymer subject-of-investigation query, plus 19 exact CCD BNZ entries, with one overlap. Four directed follow-up hits were then added for candidate-specific comparison (4EMN and 2OXS from exact BEN search; 1MUP from exact TZL search with the resolution ceiling relaxed to 2.5 Å; 3BCJ from exact FIS search). `DISCOVERY_POOL.csv` therefore contains 103 unique rows: 99 core plus four explicit supplements. The fast screen excluded 93 entries and advanced 10 to source-level detailed audit; four finalists received comparative deep review. The raw queries, responses, GraphQL metadata, mmCIF source files and parser outputs are retained under `source_artifacts/` and `audit/`.

## Strongest lead: 4W52 / BNZ

4W52 is an X-ray T4 lysozyme/benzene structure at 1.50 Å. The selected deposited instance is BNZ, label asym B / author chain A / author residue 200; receptor is label asym A / author chain A, model 1. The retained mmCIF has six BNZ heavy atoms at occupancy 0.70. The receptor has 164 modeled positions of 172 deposited sequence positions; positions 165–172 are unobserved and annotated as expression-tag residues LEHHHHHH. The retained official UniProt P00720 reference is 164 residues. The mmCIF maps reference R12G and I137R as variants and L99A as engineered, while the entity mutation field reports L99A; RCSB summarizes three sequence differences. Thus the exact deposited sequence is explicit, but source-sample provenance of the two variants and whether the C-terminal tag was cleaved before crystallization remain unresolved. The paper main text says T4L/L99A was cloned and purified as described in its SI; that SI was unavailable from attempted endpoints.

Its local dry-pocket evidence is favorable: zero waters within 5 Å and one within 8 Å (nearest 7.84 Å); no metal; the nearest deposited EPE component is 12.45 Å away. No receptor alternate-location residue is within 5 Å of BNZ, though alternate states exist elsewhere. The 1.60 × 2.22 × 2.27 Å ligand bounding box plus 8 Å pair cutoff and a one-cell 0.375 Å interpolation halo yields a conservative aligned field estimate around 52 × 54 × 54 nodes, below the existing 110 × 110 × 110 maximum. This is geometry feasibility only: no SearchRegion was sealed and no grid was built.

BNZ is the neutral CCD benzene graph, C6H6, a rigid six-carbon ring with no donor/acceptor atoms. Its chemistry is simple for the existing XS/Vina domain, but no prepared state or atom typing has been created or approved. The receptor record still needs a source-grounded construct/mutation/terminal decision, a component policy, explicit receptor chemical-state review, and an owner-approved reproducible preparation profile.

## Independent finalist validation

Current official wwPDB full validation reports for 4W52, 5JWT, 4EMN and 7FEZ were inspected and retained under source_artifacts/validation/. The reports confirm good ligand density fit for benzene in 4W52 and 5JWT, but the 4W52 BNZ has occupancy 0.70 for all six atoms and its modeled terminal residues 162–164 have poor density fit. The selected 4EMN BEN instance has three bond-angle outliers; 7FEZ 4I1 has two ligand torsion outliers. Full metrics and per-instance identifiers are in FINALIST_COMPARISON.md and STRUCTURE_QUALITY_MATRIX.md. Validation reports do not resolve the source, chemical-state or component blockers.

## Finalist outcomes

- **4W52 / BNZ — `PROMISING_BUT_REQUIRES_SOURCE_RESOLUTION`.** Best local water/metal and ligand-graph fit; unresolved variant provenance and C-terminal tag cleavage block admission.
- **5JWT / BNZ — `STRUCTURALLY_INCOMPLETE`.** 1.41 Å and ligand occupancy 1.0, but three receptor sequence positions are unobserved and alternate residues 102/111 lie within 5 Å; one water is within 5 Å. Same T4L cavity family.
- **4EMN / BEN — `CHEMICAL_STATE_AMBIGUOUS`.** Complete polymer sequence and full ligand, but six Arg author-358 side-chain heavy atoms are unobserved and BEN formal state is not frozen; seven waters are within 5 Å and sulfate is 3.03 Å from BEN. Water count is a concern, not proof by itself of essentiality.
- **7FEZ / 4I1 — `CHEMICAL_STATE_AMBIGUOUS`.** 0.76 Å and complete sequence, but three Met author-0 side-chain atoms are unobserved and the ligand is a long-chain fatty acid; four receptor alternate residues lie within 5 Å and 9/26 waters are within 5/8 Å.

The other detailed candidates 9BZT, 2OXS, 7BNH, 6TGU, 1MUP and 3BCJ are dispositions in the matrices. Their non-standard peptide, direct water/component, disorder/completeness, fatty-acid microstate, or cofactor context is not a fit for an ordinary first dry fixture. Crystallographic water presence alone was never treated as automatic rejection.

## Candidate decision and next step

Select none. Keep 181L/BNZ rejected for its unresolved physical construct/terminal state and 3ATL/BEN rejected for the documented recognition-water network; neither rejection is weakened. If primary construction records resolve 4W52’s sequence extension and variant provenance, a separate candidate-specific authorization review may reconsider 4W52. If they do not, continue external discovery or request formal scientific research/authorization for a different fixture strategy. `D3_FIXTURE_STRATEGY_ESCALATION.md` records those finite paths without choosing one.

## Evidence and verification

RCSB Search API and Data API records, official mmCIF source files, official CCD component files, UniProt P00720 reference JSON, read-only audit JSON and the parser are included in this package. Hashes are in `SHA256SUMS.txt`; changed paths are in `CHANGED_PATHS.txt`. Only `verification/d3-ext-fix-01/**` changed. `git diff --check` was run before commit. No software tests were run because this lane is evidence-only and does not modify implementation.

External source references: [RCSB 4W52](https://www.rcsb.org/structure/4W52), [official 4W52 mmCIF](https://files.rcsb.org/download/4W52.cif), [Merski et al. 2015](https://doi.org/10.1073/pnas.1500806112), [Timm et al. 2001](https://doi.org/10.1110/ps.52201), and [RCSB Search API](https://search.rcsb.org/).
