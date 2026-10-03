# 3DMX / BNZ source and construct freeze

## Immutable source set

All source files below were retrieved from official RCSB endpoints on 2026-10-03 during D3-FIXTURE-READY-03. Exact bytes are copied unchanged into this lane. `SOURCE_MANIFEST.csv` is the byte-length/SHA-256 manifest; the lane `SHA256SUMS.txt` independently covers the copies and decision artifacts.

| Source | Official endpoint | Bytes | SHA-256 |
|---|---|---:|---|
| 3DMX deposited mmCIF | [download](https://files.rcsb.org/download/3DMX.cif) | 218104 | `e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef` |
| BNZ CCD component CIF | [download](https://files.rcsb.org/ligands/view/BNZ.cif) | 4633 | `01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61` |
| 3DMX entry metadata JSON | [RCSB API](https://data.rcsb.org/rest/v1/core/entry/3DMX) | 22036 | `e9b303678dab19908f7708201586e732caf1f015fde0e4d36c4d7c97bfbaad1b` |
| Assembly 1 metadata JSON | [RCSB API](https://data.rcsb.org/rest/v1/core/assembly/3DMX/1) | 3543 | `2accfe2d4b9eabc50c37932da6af4ce6b36ad0b0ee078192fd882fd005ea9670` |
| Polymer entity 1 JSON | [RCSB API](https://data.rcsb.org/rest/v1/core/polymer_entity/3DMX/1) | 50665 | `e016e357934b43d07c58e971720d800ba253b441b614dfd547933838226a508d` |
| Full validation PDF | [RCSB validation report](https://files.rcsb.org/pub/pdb/validation_reports/dm/3dmx/3dmx_full_validation.pdf) | 515092 | `e24681b6500f8489ad93b8ce747978b1346df2f2817aa208683a1b6656e47f62` |

The predecessor manifest contains 103 source rows; independent verification passed 103/103 file byte-length and digest checks. Its 136-row lane manifest passed 136/136 checks. This DEC-04 lane carries the six selected source artifacts above and verifies them again locally.

## Entry, version, experiment, and publication

- Entry: 3DMX, title “Benzene binding in the hydrophobic cavity of T4 lysozyme L99A mutant.” The deposited current record is revision 1.3 (revision history shows 2023-08-30 as the latest listed change); the exact mmCIF bytes above are the frozen source, not a moving `latest` URL.
- Method: X-ray diffraction; resolution 1.80 Å; deposited Rwork 0.182 and Rfree 0.208.
- The primary citation is Liu, Baase & Matthews, *J. Mol. Biol.* 385 (2009), 595–605, DOI [10.1016/j.jmb.2008.10.086](https://pubmed.ncbi.nlm.nih.gov/19014950/). The paper identifies benzene among ligands in the L99A T4 lysozyme hydrophobic cavity.
- RCSB experimental metadata gives crystal-growth method vapor diffusion/hanging drop, pH 6.9, 277 K and details 2.0–2.2 M K/Na phosphate, 5 mM BME and 5 mM oxidized BME. The same metadata says complexes were prepared by soaking or vapor diffusion, without identifying the route or a distinct 3DMX ligand-soak/binding-solution pH. Therefore pH 6.9 is a documented crystallization condition only.

## Frozen receptor occurrence

- Entity 1, chain/asym A, auth chain A, model 1, biological assembly 1 monomer A1.
- Full 164-position T4 lysozyme construct observed; source-level audit: 164/164 polymer positions; 0 missing residue positions; 0 missing receptor heavy-atom sites; 163/163 expected sequential peptide links; N terminus present; C terminus present with OXT.
- Exact construct substitutions: C54T, C97A, and L99A. The first two are part of the cysteine-free WT* background; the third creates the benzene-binding cavity. The chain begins at Met1 and ends at Leu164. No cysteine remains in the deposited entity sequence, so no disulfide assignment is present for this construct.
- Preserve deposited heavy atoms and source identifiers. Source record and all altloc occurrences remain immutable evidence.

## Frozen ligand occurrence

- Chemical component BNZ, label asym G, entity 5, author chain A, author residue 900, model 1.
- Six of six deposited carbon heavy atoms, occupancy 1.00, no alternate ligand state.
- CCD BNZ formula C6H6, formal charge 0, six aromatic carbons, six-member ring, no stereocenters, no protomer/tautomer ambiguity. Do not substitute BEN.
- Observed BNZ heavy-atom bounds in the deposited receptor frame are x 25.813–27.432 Å, y 5.062–7.329 Å, z 3.066–5.279 Å.

## Official records

RCSB entry: [3DMX](https://www.rcsb.org/structure/3DMX); revision history: [3DMX versions](https://www.rcsb.org/versions/3DMX); experimental conditions: [3DMX experiment](https://www.rcsb.org/experimental/3DMX). The primary article is [PubMed PMID 19014950](https://pubmed.ncbi.nlm.nih.gov/19014950/).
