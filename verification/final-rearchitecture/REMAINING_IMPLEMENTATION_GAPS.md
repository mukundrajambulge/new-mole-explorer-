# Remaining implementation gaps

The bounded campaign is implemented and verified below. The entries below are deliberate, evidence-based limits rather than product claims.

| Area | Current evidence | Remaining work |
| --- | --- | --- |
| Biological formats | PDB, mmCIF/CIF, PQR, SDF/MOL, bounded single-frame XYZ, MOL2, and PDBQT are admitted coordinate objects. | Add sequence-only, map, and trajectory adapters only with distinct viewers and corpus-backed validation; no coordinates are fabricated for those families. |
| Multi-object real structures | `AT-FSR-H-001` passes with current 4DJW→1CRN acquisitions, two renderer models, Display-rail Fit, independent hide/show screenshots, and object-qualified selection. `AT-FSR-H-000` covers a local two-object transition. | Keep the two-object visual gate in the final regression campaign; no remaining P0 defect is claimed here. |
| Selection visual behavior | The real 4DJW gate and local selection closure cover selected overlays, clear routes, rotation, representation changes, and object isolation. | Keep the real-structure and selection-closure suites in final regression. |
| Ligand context | Dedicated Ligand rail exposes ligand count, selection, proximity selection, H-bond, contact, and clash actions with explicit coordinate/chemistry limits. | Re-run the contextual ligand gate against a real protein-ligand acquisition and add source-backed interaction classification evidence. |
| PyMOL conformance | Existing command and selection infrastructure has bounded behavior. | Produce the requested command-by-command matrix against authoritative PyMOL documentation and executable oracle evidence; do not claim full compatibility. |
| Release evidence | Final report, historical defect matrix, performance report, user guide, Drive manifest, and slice screenshots are present locally. | Google Drive publication remains blocked by missing connector credentials/environment; local hashes are recorded in the manifest. |
