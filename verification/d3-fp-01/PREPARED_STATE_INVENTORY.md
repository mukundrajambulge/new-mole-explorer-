# Prepared-state inventory

## Inventory result
No candidate receptor or ligand has an existing D2-sealed PreparedReceptorState / PreparedLigandState pair in the checked repository or current canonical Drive evidence. Consequently there are no qualifying state object IDs, state digests, source-to-state digest chains, SearchRegion digest, or direct/grid shared experiment manifest to inventory.

The candidate identities and raw structure audit findings below are evidence about possible source material only. They are not prepared states.

## Candidate inventory
| Candidate / source identity | Raw-source evidence currently available | State inventory result |
|---|---|---|
| 181L / BNZ | D3-VAL source mmCIF SHA-256 7ef097473b7f0c906f10e4016e4b6e5973abf4e47bf910699912913404dbb671. Model 1, author assembly 1 monomer, protein entity 1 / chain A. BNZ entity 4, asym E / author chain A, residue 400. 162/164 protein residues modeled; ASN163 and LEU164 absent. T54/A97/A99 construct discrepancy versus L99A annotation. | No receptor or ligand prepared-state object, profile digest, canonical state digest, SearchRegion, or shared experiment identity. NOT_PREPARED. |
| 4W52 / BNZ | D3-VAL source mmCIF SHA-256 29636d4be96bd30079007ffd65835fc351bf751238e701068d1b4d924aaf8a22. Met106 A/B occupancy 0.6/0.4 and Arg119 A/B 0.5/0.5 are in the scoring neighborhood; C-terminal missingness. | No sealed state pair or shared digests. NOT_PREPARED. |
| 4W54 / PYJ | D3-VAL source mmCIF SHA-256 e9a4807f1517a2faea469bab88b1d4c021ce19f6185f32b86d39b07c6cdbb9fb. Receptor alternate locations; ligand PYJ has A/B coordinates; Lys83 has missing heavy atoms within 8 Å. | No sealed state pair or shared digests. NOT_PREPARED. |
| 3ATL / BEN | D3-VAL source mmCIF SHA-256 453f370fcccc9181ee64f664164372f0b6a1043cb7df66ba8da84f924e5a4b46. One model, 223/223 residues, BEN has 9/9 heavy atoms. Eight waters within 5 Å, nearest 2.747 Å. | No sealed state pair or shared digests. BEN charge/protomer and water/component policies unresolved. NOT_PREPARED. |
| 1M17 / AQ4 | D3-DATA raw-source SHA-256 849bd2548dffb7ddcb7229a05202c1e2e41019a1fd69ec39483654cf984fc4d0. Audit reports 21 missing residues, site water HOH A10, ASP A831 altloc occupancy 0.5/0.5 at 3.105 Å. | Raw source only. No sealed state pair or shared digests. NOT_PREPARED. |
| 3ERT / OHT | Prior-screen summary only; reported 247/261 residues, dimer context, tertiary-amine state question. | Raw provenance not re-established for this lane; no prepared state. NOT_PREPARED. |
| 1FJS / Z34 | Prior-screen summary only; amidine/hydroxy ligand state and calcium/chloride/glycerol component questions. | Raw provenance not re-established for this lane; no prepared state. NOT_PREPARED. |
| 1HVR / XK2 | Prior-screen summary only; water mimic, CSO residues, dimer context. | Raw provenance not re-established for this lane; no prepared state. NOT_PREPARED. |
| 1EVE / E20 | Prior-screen summary only; 534/543 residues, glycans, solvent-mediated site. | Raw provenance not re-established for this lane; no prepared state. NOT_PREPARED. |
| 1STP / BTN | Prior-screen summary only; tetramer assembly, 121/159 positions, loop/water context. | Raw provenance not re-established for this lane; no prepared state. NOT_PREPARED. |

## Repository state-object and fixture checks
- D2 object definitions are in packages/contracts/src/docking/d2.ts. They require identities, chemical and coordinate states, profile and validation/provenance digests, component roles, typing/kinematics fields, and final state digests.
- verification/docking/d2/03_FIXTURES/D2_FIXTURE_CATALOG.md is a fixture contract/test catalog; it does not contain a prepared experimental receptor–ligand dataset.
- verification/docking/d2/02_IMPLEMENTATION_INDEX/D2_IMPLEMENTATION_INDEX.md documents the sealing boundary and service layer; implementation evidence does not create a candidate molecular pair.
- apps/api/src/docking/fixtures/d3-ir-02/ contains synthetic scorer-input SDF/PDBQT cases and provenance metadata, not full receptor–ligand states.
- verification/d3-grid/D3_GRID_01_REPORT.md records bounded scoring-field evidence while full-pose state admission remains open.

## Canonical external fixture status
The current D3-SCI-03 prepared-fixture manifest says no qualifying fixture is admitted and the development and confirmatory cohorts are both empty: https://drive.google.com/file/d/1khcukrEnWgHyBcZ6SOm7hwBb2Hj-W0M8/view. D3-VAL-01 records its audited candidates as NOT PREPARED / NOT ELIGIBLE. D3-RA-01 proposes 181L/BNZ as primary and 3ATL/BEN as conditional backup only; neither is an authorized state.
