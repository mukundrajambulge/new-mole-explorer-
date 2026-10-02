# Detailed shortlist

Ten entries received source-level review from official current mmCIF, RCSB entity/ligand metadata and a read-only local atom-distance audit. Raw source files, CCD components, UniProt sequence reference, wwPDB validation reports and audit JSON are in `source_artifacts/` and `audit/`; SHA-256 values are in the package manifest.

| PDB / ligand instance | Experimental snapshot | Local structure findings | Primary triage result |
|---|---|---|---|
| 4W52 / BNZ B, receptor A | X-ray 1.50 Å; 6 heavy atoms; occupancy 0.70 | 164/172 receptor positions; no waters ≤5 Å, 1 ≤8 Å; no metal; nearest EPE 12.45 Å | Best lead; tag cleavage and variant provenance unresolved; wwPDB RSCC 0.93 / RSR 0.10, no ligand bond/angle outlier; poor fit at terminal positions 162–164 |
| 5JWT / BNZ B, receptor A | X-ray 1.41 Å; 6 atoms; occupancy 1.0 | 161/164 receptor positions; two altloc residues within 5 Å; waters 1/2 ≤5/≤8 Å | Same cavity family; incomplete/local weak-fit state; wwPDB RSCC 0.96 / RSR 0.06, no ligand geometry outlier |
| 9BZT / BNZ C, receptor A | X-ray 0.82 Å; 6 atoms; occupancy 1.0 | 5/9 observed polymer residues; 4 missing; AIB-containing short peptide; I77 3.23 Å | Current scorer unsupported for polymer graph/co-ligand state |
| 4EMN / BEN E, receptor A | X-ray 1.17 Å; 9 atoms; occupancy 1.0 | 81/81 sequence positions; six Arg author-358 side-chain atoms unobserved; waters 7/21; sulfate 3.03 Å | BEN state and local water/component role need source resolution; selected BEN RSCC 0.97 / RSR 0.05, three angle outliers |
| 2OXS / BEN D, receptor A | X-ray 1.32 Å; 9 atoms; occupancy 1.0 | 223/223 residues; waters 9/19; sulfate 3.41 Å; Ca 22.53 Å | Water/site-component and BEN-state resolution required |
| 7BNH / BEZ C, receptor A | X-ray 0.84 Å; 9 atoms; occupancy 1.0 | 96/96 residues; waters 10/32; MES 3.50 Å; nearest Na 14.31 Å | Many local waters, buffer and benzoic-acid state unresolved |
| 6TGU / N92 B, receptor A | X-ray 0.83 Å; 23 atoms; alternate occupancies 0.452/0.548 | 327/364 residues; 37 missing; 3 altloc residues within 5 Å; waters 8/20 | Structurally incomplete and ligand-state ambiguous |
| 1MUP / TZL F, receptor A | X-ray 2.4 Å; 9 atoms; occupancy 0.4 | 157/166 residues; 9 missing; 2 waters ≤5 and ≤8 Å; nearest Cd 13.17 Å | Poor occupancy, incomplete receptor and cavity-water evidence |
| 7FEZ / 4I1 B, receptor A | X-ray 0.76 Å; 20 atoms; occupancy 1.0 | 133/133 sequence positions; three Met author-0 side-chain atoms unobserved; 4 altloc residues within 5 Å; waters 9/26 | Long-chain acid state and local hydration/disorder unresolved; 4I1 RSCC 0.99 / RSR 0.05, two torsion outliers |
| 3BCJ / FIS D, receptor A | X-ray 0.78 Å; 20 atoms; occupancy 0.58 | 316/316 residues; 2 altloc residues within 5 Å; waters 27/48; citrate 3.13 Å; NAP 8.56 Å | Cofactor/citrate/water environment and inhibitor state unsuitable for simple first fixture |

Water counts are geometric counts of deposited water residues by minimum heavy-atom distance, not a proof that each water is essential. An explicit primary-source water-role review would be required before any omission policy.
