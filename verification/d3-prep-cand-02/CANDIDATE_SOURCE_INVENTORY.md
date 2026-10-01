# Candidate source inventory

All nine coordinate artifacts were fetched from the official RCSB PDB file endpoint and retained byte-for-byte in source_artifacts. The read-only audit records entry title, method, resolution, model identifiers, deposition and revision dates, entity sequence observations, ligand component graph summary, exact ligand instance, non-polymer counts, and local geometry. Revision dates below come from artifact revision-history categories and are not described as deposition dates.

| PDB | Resolution; models | Protein entity / modeled chains | Ligand component and exact instance | Latest artifact revision | Bytes | SHA-256 |
|---|---|---|---|---|---:|---|
| 4W52 | X-ray, 1.5001 Å; 1 | T4 lysozyme, entity 1, chain A; 172 declared / 164 modeled | BNZ benzene, C6H6, 6 heavy atoms; label B / author A / 200 | 2023-09-27 | 216440 | 29636d4be96bd30079007ffd65835fc351bf751238e701068d1b4d924aaf8a22 |
| 4W54 | X-ray, 1.7901 Å; 1 | T4 lysozyme, entity 1, chain A; 172 / 164 | PYJ phenylethane (ethylbenzene), C8H10, 8 heavy atoms; label B / author A / 200 | 2023-09-27 | 217605 | e9a4807f1517a2faea469bab88b1d4c021ce19f6185f32b86d39b07c6cdbb9fb |
| 3ATL | X-ray, 1.74 Å; 1 | Cationic bovine trypsin, entity 1, chain A; 223 / 223 | BEN benzamidine, C7H8N2, 9 heavy atoms; label F / author A / 5 | 2024-11-20 | 263005 | 453f370fcccc9181ee64f664164372f0b6a1043cb7df66ba8da84f924e5a4b46 |
| 1M17 | X-ray, 2.60 Å; 1 | EGFR, entity 1, chain A; 333 / 312 | AQ4 erlotinib, C22H23N3O4, 29 heavy atoms; label B / author A / 999 | 2024-02-14 | 307709 | 849bd2548dffb7ddcb7229a05202c1e2e41019a1fd69ec39483654cf984fc4d0 |
| 3ERT | X-ray, 1.90 Å; 1 | Estrogen receptor alpha LBD, entity 1, chain A; 261 / 247 | OHT 4-hydroxytamoxifen, C26H29NO2, 29 heavy atoms; label B / author A / 600 | 2023-09-06 | 252502 | 93e5225a94e21f490089666c0cab160bcc33ee6701b0a44d69eb99cedf771427 |
| 1FJS | X-ray, 1.92 Å; 1 | Factor Xa entities 1/2, chains A/B; 234 / 234 and 52 / 52 | Z34, C25H24F2N6O5, 38 heavy atoms; label E / author A / 500 | 2024-11-20 | 309979 | 749e29d07fa1eefe6e4c51883d324444d8913b19bcf59daceec1142284e92d04 |
| 1HVR | X-ray, 1.80 Å; 1 | HIV-1 protease entity 1, chains A/B; each 99 / 99 | XK2 cyclic urea, C41H38N2O3, 46 heavy atoms; label C / author A / 263 | 2024-10-16 | 233902 | 88ae65ea8ab9756b408a94ab02fe922c1d80a79e6226d796f2a565aea3c0dda6 |
| 1EVE | X-ray, 2.50 Å; 1 | Torpedo acetylcholinesterase entity 1, chain A; 543 / 534 | E20 donepezil, C24H29NO3, 28 heavy atoms; label F / author A / 2001 | 2024-10-23 | 530862 | 69d709df8ec6bb947e800791c4f67aed7097ce876d15c4cd91c28227139ec085 |
| 1STP | X-ray, 2.60 Å; 1 | Streptavidin entity 1, chain A; 159 / 121 | BTN biotin, C10H16N2O3S, 16 heavy atoms; label B / author A / 300 | 2024-02-14 | 148195 | 36be77b9722ebb9f603b27bf16cbc30057f87ab9923a2d2adab0eadbdb30c30f |

The exact coordinate bytes are retained as source_artifacts/4W52.cif, 4W54.cif, 3ATL.cif, 1M17.cif, 3ERT.cif, 1FJS.cif, 1HVR.cif, 1EVE.cif, and 1STP.cif. Official source URL pattern: https://files.rcsb.org/download/{PDB}.cif. Candidate-specific RCSB pages and primary papers are linked in the report and matrices.

Source facts are reported from retained mmCIF and RCSB entry/experimental pages. Publication claims are separately labeled. The parser is an inventory aid, not a preparation tool. It preserves no transformed coordinates and creates no chemical state.


## Deposited assembly annotations

| PDB | Assembly 1 annotation in the retained mmCIF | Fixture implication |
|---|---|---|
| 4W52 | Monomeric, author/software-defined by PISA | Chain A is the deposited protein unit; engineered construct state still unresolved |
| 4W54 | Monomeric, author/software-defined by PISA | Same as 4W52 |
| 3ATL | Monomeric, author/software-defined by PISA | Chain A contains complete mature trypsin; verify no external assembly is required for S1 |
| 1M17 | Monomeric, author-defined | Single kinase chain; unresolved segments and site alternate states remain |
| 3ERT | Dimeric, author-defined | Review whether dimer context affects receptor identity and pocket state |
| 1FJS | Dimeric, author/software-defined by PISA | Retain Factor Xa chain/entity context and the observed autolytic/cleaved state |
| 1HVR | Dimeric, author/software-defined by PISA | Dimer is essential because XK2 bridges chains A and B |
| 1EVE | Monomeric, author-defined | Native enzyme chain; extensive solvent-mediated gorge environment remains |
| 1STP | Tetrameric, author/software-defined by PISA/PQS | Biological assembly and inter-subunit loop/conformation context are part of receptor identity |


Retrieval snapshot: the nine official mmCIF artifacts were freshly fetched and checked on 2026-10-02 from https://files.rcsb.org/download/{PDB}.cif. The revision dates in the table are the deposited artifact revision-history values, not this retrieval date.