# Remaining implementation gaps

The bounded campaign is implemented and verified below. The entries below are deliberate, evidence-based limits rather than product claims.

| Area | Current evidence | Remaining work |
| --- | --- | --- |
| Biological formats | Coordinate objects remain PDB, mmCIF/CIF, PQR, SDF/MOL, bounded single-frame XYZ, MOL2, and PDBQT. FASTA/FASTQ/GenBank/EMBL, DX/MRC/CCP4, multi-frame XYZ, GRO, PSF, PRMTOP, and SMILES now route to typed dedicated viewers without coordinate fabrication. DCD is validated as header-only; XTC/TRR are explicit metadata-only entries. | Add larger corpus and performance gates; implement full DCD/XTC/TRR frame decoding and topology-coordinate pairing before making research trajectory claims. |
| Multi-object real structures | `AT-FSR-H-001` passes with current 4DJW→1CRN acquisitions, two renderer models, Display-rail Fit, independent hide/show screenshots, and object-qualified selection. `AT-FSR-H-000` covers a local two-object transition. | Keep the two-object visual gate in the final regression campaign; no remaining P0 defect is claimed here. |
| Selection visual behavior | The real 4DJW gate and local selection closure cover selected overlays, clear routes, rotation, representation changes, and object isolation. | Keep the real-structure and selection-closure suites in final regression. |
| Ligand context | Dedicated Ligand rail exposes ligand count, selection, proximity selection, H-bond, contact, and clash actions with explicit coordinate/chemistry limits. | Re-run the contextual ligand gate against a real protein-ligand acquisition and add source-backed interaction classification evidence. |
| PyMOL conformance | The requested bounded command/feature matrix is present under `verification/pymol/` and grounded in the pinned source/documentation comparison. | Provision the executable PyMOL oracle, run semantic comparisons, and reconcile the remaining pending rows; do not claim full compatibility. |
| Release evidence | Final report, historical defect matrix, performance report, user guide, biological adapter tests, and J-slice screenshots are present locally. | Google Drive publication remains blocked by missing connector credentials/environment; local hashes are recorded in the manifest. |
