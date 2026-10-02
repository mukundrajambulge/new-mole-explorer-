# Source artifact freeze

Retrieval and audit date: 2026-10-02. Raw source bytes are retained unchanged under source_artifacts/. The official current coordinate source and component dictionary were retrieved directly from wwPDB/RCSB; the metadata snapshots, UniProt response, publication copies and current validation report are separately retained. Derived audit outputs are identified as derived and are not substituted for primary sources.

## 4W52 record freeze

| Field | Frozen value |
|---|---|
| PDB accession / DOI | 4W52 / 10.2210/pdb4w52/pdb |
| Current official coordinate source | https://files.rcsb.org/download/4W52.cif |
| Local source | source_artifacts/cif/4W52_current.cif |
| Raw bytes / SHA-256 | 216,440 / 29636d4be96bd30079007ffd65835fc351bf751238e701068d1b4d924aaf8a22 |
| Entry version | 1.6 (major 1, minor 6) |
| Latest revision | 2023-09-27 |
| Initial release | 2015-04-01; deposited 2014-08-16 |
| Experimental method / reported resolution | X-ray diffraction / 1.50 Å |
| Model / biological assembly | Model 1 / assembly 1, monomer A1 |
| Polymer | Entity 1, label asym A, author chain A; deposited sequence 172 positions |
| Modeled protein coordinates | Residues 1–164; 164 residues; 1,358 heavy atoms |
| BNZ instance | Label asym B, author chain A, author residue 200; 6 heavy atoms |
| EPE instance | Label asym C, author chain A, author residue 201; 15 heavy atoms |
| Water | Label asym D, author chain A; 146 water sites |
| Other non-polymers / metal atoms | None beyond BNZ, EPE and water; zero metal atoms |
| Structure factors | Not retrieved or used in this gate |

## Retained source files

| Artifact | Source / role |
|---|---|
| source_artifacts/cif/4W52_current.cif | Current official PDBx/mmCIF coordinates and deposition annotations |
| source_artifacts/ccd/BNZ_current.cif | Current official Chemical Component Dictionary definition for BNZ |
| source_artifacts/rcsb_api/entry_4w52.json | RCSB entry metadata snapshot |
| source_artifacts/rcsb_api/polymer_entity_4w52_1.json | RCSB polymer entity, sequence, construct and host metadata snapshot |
| source_artifacts/rcsb_api/assembly_4w52_1.json | Assembly 1 metadata snapshot |
| source_artifacts/validation/4w52_full_validation_current.pdf and .txt | Current full wwPDB X-ray validation report and extracted searchable text; report generated 2026-03-09, validation pipeline 2.49; PDF SHA-256 8531e81f81f8740bb534edad7b402ed23d58606f12c6db108e91c0f84eb5ccfa |
| source_artifacts/uniprot/P00720_current.json | Current UniProt reference sequence record |
| source_artifacts/publication/pnas_1500806112_article.html | Merski et al. primary article full text |
| source_artifacts/publication/pnas_1514835112_si_correction.html | Correction notice for the article SI; this is the notice, not the corrected SI file |
| source_artifacts/publication/addgene_18110.html | Addgene record for plasmid 18110, corroborative but not linked to the 4W52 construct |
| source_artifacts/publication/bradford_2021_temperature_artifacts.html | Later construct-related literature retained as secondary context; not proof of the 4W52 sample |
| source_artifacts/derived/4W52_coordinate_audit.json | Read-only geometry, missing-atom, BNZ, water, EPE and protein-altloc results |
| source_artifacts/derived/4W52_water_altloc_audit.json | Read-only audit of 18 water sites bearing alternate-location records |
| source_artifacts/derived/4W52_predecessor_source_comparison.json | Reproducible comparison to the D3-EXT-FIX-01 CIF |

Hashes and byte counts for every retained file, including these scripts and reports, are in SHA256SUMS.txt. The checksum file excludes itself by definition; all other files below this lane are manifested.

## Reconciliation with predecessor

The fresh official download is byte-for-byte identical to verification/d3-ext-fix-01/source_artifacts/cif/4W52.cif at predecessor commit 697f6074fa1869bf120d537cbcffd7d85c006981. Both are 216,440 bytes with SHA-256 29636d4be96bd30079007ffd65835fc351bf751238e701068d1b4d924aaf8a22; both contain 1,525 atom_site rows. The comparison result is retained in source_artifacts/derived/4W52_predecessor_source_comparison.json. No difference required reconciliation.

## Access limitation

The 2015 main article explicitly delegates cloning, purification and crystallization details to its SI Appendix, Methods. The article record links a 2.6 MB SI PDF. The correction notice says the SI was corrected online. Attempts to retrieve the official PNAS supplement returned HTTP 403; the tested PMC binary paths returned HTTP 404. The actual corrected SI was not reviewed and no claim in this package depends on having read it.

## Public source endpoints

- PDB entry: https://www.rcsb.org/structure/4W52
- Current mmCIF: https://files.rcsb.org/download/4W52.cif
- RCSB entry API: https://data.rcsb.org/rest/v1/core/entry/4W52
- RCSB polymer entity API: https://data.rcsb.org/rest/v1/core/polymer_entity/4W52/1
- RCSB assembly API: https://data.rcsb.org/rest/v1/core/assembly/4W52/1
- BNZ CCD: https://files.rcsb.org/ligands/download/BNZ.cif
- Full validation report: https://files.rcsb.org/validation/view/4w52_full_validation.pdf
- UniProt P00720: https://www.uniprot.org/uniprotkb/P00720/entry
- Primary article: https://doi.org/10.1073/pnas.1500806112
- SI correction notice: https://doi.org/10.1073/pnas.1514835112
