# MOLEXPLORER final scientific UI rearchitecture report

Status: **bounded implementation verified; full binary trajectory decoding and executable PyMOL oracle remain pending**
Commit: `8e6a89e` (`docs: seal final biological data release`)
Branch: `feature/final-scientific-ui-pymol-conformance`

## Delivered behavior

The workbench now uses the approved scientific workspace shell: File, Select, Display, Color, Measure, Analyze, View, and Help menus; a persistent Objects & Selections panel; a molecular canvas; inward right-rail panels; a collapsed command console; and a status bar. Display, Color, Select, Measure, Analyze, Ligand, Edit, and Session are working rail panels. Movie and Settings remain explicitly unavailable.

The bounded coordinate ingestion surface admits PDB, mmCIF/CIF, PQR, SDF/MOL, single-frame XYZ, MOL2, and PDBQT. The parser preserves canonical atom identity, coordinate provenance, object/state lineage, source metadata, and fail-closed diagnostics. File → Import now provides Local file, Online ID, and Paste / text routes for typed FASTA/FASTQ/GenBank/EMBL sequence data, MRC/CCP4/DX maps, multi-frame XYZ/GRO trajectories, PSF/PRMTOP topology metadata, and SMILES notation. These sources use dedicated viewers and never become fabricated molecular coordinates. DCD is validated as header-only; XTC/TRR are validated as metadata-only registry entries.

The workspace supports multiple canonical objects and coordinate states in one viewer, explicit cross-object coordinate-frame policy, object-qualified selection, independent enable/disable state, state switching, object copy/rename/create/split/join, groups, and full-canvas Fit. The Ligand rail provides ligand selection, binding-shell selection, H-bond, contact, and clash actions with bounded coordinate/chemistry diagnostics. It does not infer docking scores, affinity, or unvalidated chemical interaction classes.

Selection, presentation, camera, measurement, analysis, alignment, topology editing, hydrogen editing, exact undo/redo, sessions, scenes, export, and the safe tokenized console converge on canonical state. Unsupported operations return explicit capability outcomes. Host Python, shell, arbitrary process, filesystem, and network execution remain rejected by design.

## Evidence and verification

The final rearchitecture shell suite passes 18/18, including the new biological import and viewer cases. The biological adapter unit suite passes 6/6 and the browser J acceptance suite passes 7/7, covering the import dialog, paste routing, FASTA, FASTQ, OpenDX, multi-frame XYZ, UniProt, and PubChem routes. The final PyMOL acceptance suite passes 3/3. Multi-object state coverage passes 11/11. The live selection matrix passes 1/1 across its representative command families; the generated matrix contains 87 rows: 85 verified working, one dependency-gated row (`byfragment`), and one intentionally unsupported arbitrary-property row. The selection oracle ledger records 51 direct oracle passes, 35 documented/application equivalents, and one pending row.

The R07 edit/topology/hydrogen suites, R08 structural analysis suite, and R09 native lifecycle suite pass after the rail-state and menu-overlay corrections. Manual viewer, camera, selection highlighting, selection presentation, and real 4DJW plus 1CRN workspace gates pass. The final full Chromium regression covers the legacy G0, G1B, G1C, IMP-PRES, V-FINAL, V2, real-structure, and biological-data suites: **138/138 passed** with one worker.

Repository checks pass:

- `npm run typecheck`
- `npm run lint`
- `npm test` — 147 web tests and 64 API tests
- `npm run build`
- `npm run verify:selection-matrix`
- `npm run verify:r10`
- `git diff --check`

Local visual evidence is stored under `verification/final-rearchitecture/evidence/` and the inherited acceptance evidence directories. J-slice evidence covers the open biological-data dialog, sequence viewer, density-map viewer, and trajectory viewer. The three R07 console/action harness paths were corrected to expand the intentionally collapsed console and use the visible scientific action labels; their isolated rerun passes 4/4 and the final full regression passes 138/138. The machine-readable inventories are `FEATURE_INVENTORY.json`, `UI_CONTROL_INVENTORY.json`, `PYMOL_CONFORMANCE_MATRIX.json`, and `GOOGLE_DRIVE_EVIDENCE_MANIFEST.json`; the required mirrored PyMOL artifacts are also present under `verification/pymol/`. Wizard and Movie scope are recorded in `PYMOL_WIZARD_GAP_MATRIX.md` and `PYMOL_MOVIE_IMPLEMENTATION_PLAN.md`. The user guide is in `docs/user-guide/` with a coverage index in `USER_GUIDE_COVERAGE.md`.

## Conformance and release limits

The PyMOL comparison is source/documentation grounded and bounded. No executable `pymol`, `pymol.exe`, or importable pinned module is installed in this environment, so executable parity is `BLOCKED_ENVIRONMENT`; `super` remains pending that oracle and `cealign` is explicitly unavailable. Renderer-qualified profiles are validated behavior, not a claim of pixel-identical PyMOL output.

Google Drive publication is `BLOCKED_CREDENTIAL_OR_ENVIRONMENT`; local evidence hashes and the required upload manifest are recorded without claiming an upload. Main-branch merge, docking, virtual screening, and HTS are outside this bounded implementation and remain intentionally unclaimed. Full DCD/XTC/TRR frame decoding, topology-coordinate pairing, larger corpus/performance gates, wizard work, and movie playback are itemized in `NEXT_PHASE_IMPLEMENTATION_PLAN.md`.

The current release record therefore seals the implemented scientific workspace and its evidence while keeping every unimplemented or externally blocked capability visible and fail closed.
