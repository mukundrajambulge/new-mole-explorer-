# MOLEXPLORER final scientific UI rearchitecture report

Status: **bounded implementation verified; universal bio-data and executable PyMOL oracle remain pending**  
Commit: `fa995f4` (`feat: complete scientific workspace rearchitecture evidence`)  
Branch: `feature/final-scientific-ui-pymol-conformance`

## Delivered behavior

The workbench now uses the approved scientific workspace shell: File, Select, Display, Color, Measure, Analyze, View, and Help menus; a persistent Objects & Selections panel; a molecular canvas; inward right-rail panels; a collapsed command console; and a status bar. Display, Color, Select, Measure, Analyze, Ligand, Edit, and Session are working rail panels. Movie and Settings remain explicitly unavailable.

The bounded coordinate ingestion surface admits PDB, mmCIF/CIF, PQR, SDF/MOL, XYZ, MOL2, and PDBQT. The parser preserves canonical atom identity, coordinate provenance, object/state lineage, source metadata, and fail-closed diagnostics. FASTA/FASTQ/GenBank/EMBL sequence data, MRC/CCP4/DX maps, and DCD/XTC/TRR/GRO/PSF/PRMTOP trajectories are not silently treated as molecules; they require their own viewers and are recorded in the next-phase plan.

The workspace supports multiple canonical objects and coordinate states in one viewer, explicit cross-object coordinate-frame policy, object-qualified selection, independent enable/disable state, state switching, object copy/rename/create/split/join, groups, and full-canvas Fit. The Ligand rail provides ligand selection, binding-shell selection, H-bond, contact, and clash actions with bounded coordinate/chemistry diagnostics. It does not infer docking scores, affinity, or unvalidated chemical interaction classes.

Selection, presentation, camera, measurement, analysis, alignment, topology editing, hydrogen editing, exact undo/redo, sessions, scenes, export, and the safe tokenized console converge on canonical state. Unsupported operations return explicit capability outcomes. Host Python, shell, arbitrary process, filesystem, and network execution remain rejected by design.

## Evidence and verification

The final shell and ligand acceptance suite passes 14/14. The final PyMOL acceptance suite passes 3/3. Multi-object state coverage passes 11/11. The live selection matrix passes 1/1 across its representative command families; the generated matrix contains 87 rows: 85 verified working, one dependency-gated row (`byfragment`), and one intentionally unsupported arbitrary-property row. The selection oracle ledger records 51 direct oracle passes, 35 documented/application equivalents, and one pending row.

The R07 edit/topology/hydrogen suites, R08 structural analysis suite, and R09 native lifecycle suite pass after the rail-state and menu-overlay corrections. Manual viewer, camera, selection highlighting, selection presentation, and real 4DJW plus 1CRN workspace gates pass. The final targeted run also covers the legacy G0, G1B, G1C, IMP-PRES, V-FINAL, V2, and real-structure suites.

Repository checks pass:

- `npm run typecheck`
- `npm run lint`
- `npm test` — 141 web tests and 64 API tests
- `npm run build`
- `npm run verify:selection-matrix`
- `npm run verify:r10`
- `git diff --check`

Local visual evidence is stored under `verification/final-rearchitecture/evidence/` and the inherited acceptance evidence directories. The machine-readable inventories are `FEATURE_INVENTORY.json`, `UI_CONTROL_INVENTORY.json`, `PYMOL_CONFORMANCE_MATRIX.json`, and `GOOGLE_DRIVE_EVIDENCE_MANIFEST.json`. The user guide is in `docs/user-guide/` with a coverage index in `USER_GUIDE_COVERAGE.md`.

## Conformance and release limits

The PyMOL comparison is source/documentation grounded and bounded. No executable `pymol`, `pymol.exe`, or importable pinned module is installed in this environment, so executable parity is `BLOCKED_ENVIRONMENT`; `super` remains pending that oracle and `cealign` is explicitly unavailable. Renderer-qualified profiles are validated behavior, not a claim of pixel-identical PyMOL output.

Google Drive publication is `BLOCKED_CREDENTIAL_OR_ENVIRONMENT`; local evidence hashes and the required upload manifest are recorded without claiming an upload. Main-branch merge, docking, virtual screening, and HTS are outside this bounded implementation and remain intentionally unclaimed. Sequence, map, trajectory, wizard, and movie work is itemized in `NEXT_PHASE_IMPLEMENTATION_PLAN.md`.

The current release record therefore seals the implemented scientific workspace and its evidence while keeping every unimplemented or externally blocked capability visible and fail closed.
