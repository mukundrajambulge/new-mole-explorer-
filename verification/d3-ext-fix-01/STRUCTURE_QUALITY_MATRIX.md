# Structure quality matrix

All values below come from the retained current RCSB mmCIF and the read-only parser output in source_artifacts/cif/ and audit/. Model count and resolution are from the retained RCSB search/Data API response. The audit uses deposited model 1. Ligand occupancy is not a measure of affinity. A one-model deposition may still contain alternate conformations.

| Entry / ligand | Method; resolution | Models | Ligand heavy atoms; occupancy | Ligand alternate locations | Structure-quality observations | Triage |
|---|---:|---:|---|---|---|---|
| 4W52 / BNZ B | X-ray; 1.50 Å | 1 | 6; 0.70 | None deposited | Clear small benzene graph and clean immediate shell; receptor sequence has eight unobserved C-terminal tag residues; mmCIF maps two reference-sequence variants plus engineered L99A, but sample provenance and tag cleavage remain unresolved. | PROMISING_BUT_REQUIRES_SOURCE_RESOLUTION |
| 5JWT / BNZ B | X-ray; 1.41 Å | 1 | 6; 1.00 | None deposited | High-resolution ligand, but three C-terminal residues are unobserved and two receptor residues in the 5 Å shell have alternate conformations. | STRUCTURALLY_INCOMPLETE |
| 9BZT / BNZ C | X-ray; 0.82 Å | 1 | 6; 1.00 | None deposited | Excellent ligand diffraction statistics; receptor is a nine-residue nonstandard peptide system with multiple co-ligands and missing polymer residues. | CURRENT_SCORER_UNSUPPORTED |
| 4EMN / BEN E | X-ray; 1.17 Å | 1 | 9; 1.00 | None deposited | Fully modeled ligand and all 81 polymer positions; six Arg heavy atoms are unobserved and sulfate is 3.03 Å from BEN. | CHEMICAL_STATE_AMBIGUOUS |
| 2OXS / BEN D | X-ray; 1.32 Å | 1 | 9; 1.00 | None deposited | Fully modeled ligand and 223/223 polymer positions; nine waters are within 5 Å and sulfate is 3.41 Å away. | PROMISING_BUT_REQUIRES_SOURCE_RESOLUTION |
| 7BNH / BEZ C | X-ray; 0.84 Å | 1 | 9; 1.00 | None deposited | Ligand and 96/96 polymer positions are modeled; 10 waters are within 5 Å and MES is 3.50 Å away. | CHEMICAL_STATE_AMBIGUOUS |
| 6TGU / N92 B | X-ray; 0.83 Å | 1 | 23; 0.452 and 0.548 | Ligand atoms split across two occupancies | 37 polymer positions are unobserved, three nearby receptor residues have alternate conformations, and ligand occupancy is split. | STRUCTURALLY_INCOMPLETE |
| 1MUP / TZL F | X-ray; 2.40 Å | 1 | 9; 0.40 | None deposited | Lower resolution, ligand occupancy 0.40, nine missing polymer residues, and two cavity waters in the ligand shell. | WATER_DEPENDENT |
| 7FEZ / 4I1 B | X-ray; 0.76 Å | 1 | 20; 1.00 | None deposited | Very high resolution and complete sequence, but four nearby receptor residues have alternate conformations and ligand is a long-chain fatty acid. | CHEMICAL_STATE_AMBIGUOUS |
| 3BCJ / FIS D | X-ray; 0.78 Å | 1 | 20; 0.58 | None deposited | High resolution but ligand occupancy is 0.58; two nearby residues have alternate conformations, 27 waters lie within 5 Å, and citrate is 3.13 Å away. | NOT_SUITABLE |

The ligand atom counts and occupancy values are deposited-coordinate observations, not prepared-ligand assertions. Water counts are geometric counts and do not establish essentiality. Detailed entries are cross-referenced in DETAILED_SHORTLIST.md and the individual audit JSON files.

## Independent wwPDB validation reports

Official full validation PDFs for all four finalists are retained in source_artifacts/validation/ and included in SHA256SUMS.txt. They report ligand density fit and geometry as follows: 4W52 BNZ has RSCC 0.93, RSR 0.10, B min/median/95th-percentile/max 12/12/14/15 Å², no bond/angle outliers, and all six atoms at occupancy below 0.9; the protein has RSRZ outliers at terminal residues 162–164, including Leu164 at 10.0. 5JWT BNZ has RSCC 0.96, RSR 0.06, B 12/12/13/15 Å² and no geometry outliers; protein RSRZ outliers include residues 109–114 around the ligand shell. For author-chain A residue 401 in 4EMN, BEN has RSCC 0.97, RSR 0.05, B 10/12/19/21 Å², no bond-length outlier and three angle outliers among seven assessed angles. In 7FEZ, 4I1 has RSCC 0.99, RSR 0.05, B 4/7/9/9 Å², no bond/angle outliers and two ligand torsion outliers. These results add experimental fit/geometry context; they do not resolve chemical-state or construct blockers.
