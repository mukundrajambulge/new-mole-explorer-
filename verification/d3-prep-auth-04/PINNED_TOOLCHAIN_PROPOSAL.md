# Pinned hydrogen-only toolchain proposal

Status: exact candidate stack/configuration OWNER APPROVED — YES for the 3DMX/BNZ development fixture; no runtime/wheels installed and no molecule processed in this gate. See `OWNER_AUTHORIZATION_RECORD.md` and `TOOLCHAIN_API_VERIFICATION.md`.

## Toolchain identity

- Operating environment: host reports Windows 10 Pro, build 26200, 64-bit. Current device is the only target. Capture processor model, OS build, locale, and run timestamp in the eventual manifest. Do not claim cross-platform bitwise reproducibility without separate conformance evidence.
- Runtime: CPython 3.13.16, 64-bit standard build, from the official Windows installer. SHA-256: fb4f9f5d438b2396da0086dc70b935c530cb578e37adc6d354f7ad2037fee83b. [Python release page](https://www.python.org/downloads/release/python-31316/)
- Hydrogen-coordinate engine: RDKit 2026.03.6 stable release, tag Release_2026_03_6, full tag commit 0e0d85f4ca34aeae15dfc0f7cf5503bdb0a8e985. [Release](https://github.com/rdkit/rdkit/releases/tag/Release_2026_03_6)
- Dependency installer: pip 25.2 wheel, SHA-256 6d67a2b4e7f14d8b31b8b52648866fa717f45a1eb70e83002f4331d07e953717.
- Runtime wheels, acquired to a local wheelhouse and checked before installation:

| Package | Exact artifact | SHA-256 |
|---|---|---|
| RDKit | rdkit-2026.3.6-cp313-cp313-win_amd64.whl | 3765896e189a5dc4ef109a1ab81c375fb1e00185d52374ffc2128391bddd6b8f |
| NumPy | numpy-2.3.3-cp313-cp313-win_amd64.whl | f0dadeb302887f07431910f67a14d57209ed91130be0adea2f9793f1a4f817cf |
| Pillow | pillow-12.0.0-cp313-cp313-win_amd64.whl | 4cf7fed4b4580601c4345ceb5d4cbf5a980d030fd5ad07c4d2ec589f95f09905 |
| pip | pip-25.2-py3-none-any.whl | 6d67a2b4e7f14d8b31b8b52648866fa717f45a1eb70e83002f4331d07e953717 |

Wheel file hashes were read from the version-specific PyPI JSON API on 2026-10-03 and cross-checked against the package file pages for RDKit/OpenMM. Fetch these exact files from PyPI, verify SHA-256, and run with no package index or service access. No other transitive wheel is accepted. Install all listed wheels explicitly with no dependency resolution; any missing runtime dependency is a profile mismatch, not permission to resolve a new version.

- RDKit package source and license: BSD-3-Clause.
- Python runtime: PSF license.
- NumPy: BSD license family.
- Pillow: HPND/MIT-CMU license.
- pip: MIT license.
- OpenMM is not part of the selected stack.
- Review all licenses before bundling these packages into a distributed application; this gate only proposes a local development toolchain.

## Input artifacts

Use only the immutable predecessor payloads at verification/d3-prep-dec-04-3dmx-bnz/source_artifacts/current_rcsb:

| Input | Source identity | SHA-256 |
|---|---|---|
| 3DMX mmCIF | RCSB deposited 3DMX model/assembly source | e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef |
| BNZ CCD CIF | RCSB Chemical Component Dictionary BNZ definition | 01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61 |

Additional source metadata used for role/context must retain the exact six-entry SOURCE_MANIFEST.csv hashes from DEC04. The generated input-state manifest must bind those files, the selected atom rows, the explicit graph and state, and the profile. Reject any hash mismatch before parsing.

**Byte-exact source requirement:** the AUTH04 Windows worktree has `core.autocrlf=true`; its checked-out 3DMX.cif and BNZ.cif bytes are CRLF-converted and currently fail the SHA-256 values above. The exact DEC04 predecessor worktree at `C:\Users\mukun\.codex\worktrees\d3-prep-dec-04-3dmx-bnz\molecular-workstation` was verified against its DEC04 SHA256SUMS.txt (19/19) and SOURCE_MANIFEST.csv (6/6). A future execution must read those exact predecessor source bytes or verified byte-identical copies, check all hashes before parsing, and stop on any mismatch. Do not silently normalize, rewrite, or accept the AUTH04-worktree CIF files when their raw-byte hashes do not match.

## Frozen algorithm and configuration

1. Parse the exact CIF input without normalizing or rewriting its bytes. Select model 1, polymer entity 1, assembly 1 monomer A1, label/auth chain A. For the receptor retain common blank-altloc atoms and the coherent A conformer for MET106 and GLU108 only. For the ligand retain the six BNZ atom-site rows in the ligand source occurrence. Reject any unlisted atom, duplicate identity, coordinate omission, graph mismatch, nonunique occupancy maximum, or missing standard heavy atom.
2. Construct explicit receptor and BNZ RDKit graphs from the deposited source/CCD component atom and bond definitions plus source-supported polymer connectivity. Do not use spatial proximity bonding to guess graph edges. Apply the explicit, owner-approved formal-state map from CHEMICAL_STATE_DECISION.md before calling the hydrogen operation. Preserve stable heavy-atom AtomUIDs and source binary64 coordinates in the graph conformer.
3. Verify the pre-H graphs against the exact selected source identity/mapping, all expected component bonds, full standard residue heavy-atom inventory, exact BNZ C1–C6 graph, and explicit formal-state table. Missing/extra heavy atoms or unresolved edges/states fail closed.
4. Verify that the input graph contains no query atoms or query bonds, then call the pinned Python wrapper exactly as `Chem.AddHs(molecule, explicitOnly=False, addCoords=True, onlyOnAtoms=None, addResidueInfo=True)`. In RDKit 2026.03.6 the wrapper constructs the C++ AddHsParameters with `skipQueries=False` by its default; the AddHsParameters object is not passed as the second Python argument. Keep the original molecule object and compare all source heavy-atom IDs, map numbers, element/residue/atom identities, bonds and coordinate bits against the returned molecule. The atom order of hydrogens must not be used as their scientific identity. This API-signature correction preserves the approved effective flags and chemistry; see TOOLCHAIN_API_VERIFICATION.md.
5. Do not call RDKit sanitization routines that rewrite state, RDKit standardization/tautomer tools, PDB atom proximity bond perception, coordinate embedding, force-field assignment or optimization, MMFF/UFF, conformer generation, OpenMM, PDBFixer, Reduce, PDB2PQR, PROPKA, Meeko, Open Babel, or an external service.
6. Assign stable H identity only after addition using parent AtomUID, residue/atom naming policy and unique ordinal. Validate that receptor hydrogens match the exact state-specific expected inventory; BNZ has exactly one generated H per C1–C6. Any unparented, duplicate, missing, extra, or ambiguously named H fails.
7. Keep source heavy-atom records immutable. Store generated hydrogens and prepared-state/provenance payloads separately or in canonical state objects, retaining the original source numeric coordinates exactly. Do not round or overwrite source rows.

The RDKit AddHs API generates H coordinates from the supplied 3D conformer when addCoords=True. It does not choose protonation or tautomer states; it adds hydrogens implied by the explicit graph. The cited pinned source implements an H-appending coordinate operation and does not call a geometry optimizer. All input graph and formal-state construction remains part of the bounded adapter and is validated before use.

## Invocation and offline environment

Provision the signed/hash-verified CPython installer and wheels before execution. Create a dedicated virtual environment and install only the four locked wheels from the local wheelhouse. Do not use a global Python site-packages directory.

PowerShell setup:

    py -3.13 -m venv .venv
    .\.venv\Scripts\python.exe -m pip install --no-index --no-deps --require-hashes --force-reinstall -r .\wheelhouse\pip-bootstrap.lock
    .\.venv\Scripts\python.exe -m pip --version
    .\.venv\Scripts\python.exe -m pip install --no-index --no-deps --require-hashes -r .\wheelhouse\requirements.lock
    $env:TZ = "UTC"
    $env:LC_ALL = "C"
    .\.venv\Scripts\python.exe -I .\prepare_3dmx_bnz_hydrogens.py --profile-id ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0 --source-manifest .\verification\d3-prep-dec-04-3dmx-bnz\SOURCE_MANIFEST.csv --input-cif .\verification\d3-prep-dec-04-3dmx-bnz\source_artifacts\current_rcsb\3DMX.cif --ligand-ccd .\verification\d3-prep-dec-04-3dmx-bnz\source_artifacts\current_rcsb\BNZ.cif --out-dir .\prepared\d3-prep-exec-04

The pip-bootstrap.lock contains only pip==25.2 and its listed SHA-256. The runtime requirements.lock contains only RDKit, NumPy, and Pillow at the exact versions and hashes above. Verify each wheel file hash before pip reads it, then verify pip and runtime package versions after installation. The Python venv's initial bundled pip is bootstrap-only and is replaced by the pinned pip wheel before any other package installation.

The exact executable driver source is a run input and must be created/reviewed/sealed as a file and have its SHA-256 written to the run manifest before step 4 performs any AddHs operation. If the driver does not implement every frozen step, or if the recorded digest is absent, execution stops before molecular operations. This authorization lane deliberately does not create or run that driver.

After install, verify Python 3.13.16, pip 25.2, RDKit 2026.03.6, NumPy 2.3.3, and Pillow 12.0.0 exactly. Verify every local wheel hash again. The driver sets the RDKit log level explicitly to WARNING and fails on any warning or error not explicitly listed in the profile. It records Python/RDKit build identifiers, host processor/OS facts, environment variables, all invocation arguments, source hashes, driver/profile/config hashes, and full stdout/stderr. The currently observed host processor is 12th Gen Intel Core i5-12500H, 12 cores/16 logical processors; the run manifest must re-read the host rather than assume it has not changed.

The RDKit operation is single-process and uses no RNG. Invoke Python in isolated mode; sort every input/output sequence explicitly and do not depend on set or hash-table iteration order. Python's PYTHONHASHSEED variable is not used because isolated mode ignores Python environment variables. Pin locale and timezone for logs; no GPU is used. The run is offline. Preserve wheelhouse hash manifest and installation output with the run. Do not treat the local Python 3.14.2 used by the DEC04 read-only coordinate audit as this preparation runtime.

## Required run outputs and logs

- immutable source input manifest and selected heavy-atom row/AtomUID manifest;
- exact explicit receptor and ligand graph/state manifest;
- profile identity/content and all package/driver/input hashes;
- receptor generated-H manifest and BNZ H1–H6 manifest, each with parent UID and exact generated coordinate bits;
- source-versus-output heavy-atom invariant report;
- explicit altloc and component disposition report, including excluded water/non-polymer occurrences;
- canonical PreparedReceptorState and PreparedLigandState only if the applicable canonical serializers are implemented and all preflight checks pass;
- SHA-256 for every output, captured stdout/stderr, warning/error inventory and execution summary.

No PDBQT, score, scoring field, docked pose or D3 acceptance output is in scope.

## Allowed and forbidden changes

Allowed changes: addition of mapped, profile-authorized hydrogen atoms to the derived receptor and BNZ states; creation of profile/run/provenance/report files.

Forbidden changes: every unapproved heavy-atom addition, deletion, rename, remap or coordinate change; graph repair; source mutation; residue/sidechain rebuilding; minimization; Asn/Gln/His flip; pKa/protonation prediction; tautomer or conformer enumeration; alternate mixing/averaging; silent component/water changes; output that cannot preserve source atom mapping; scoring/docking or later-gate work.

## Package file URLs

- [Python 3.13.16 x64 installer](https://www.python.org/downloads/release/python-31316/)
- [OpenMM 8.6.1 PyPI release page, comparison only](https://pypi.org/project/OpenMM/8.6.1/)
- [RDKit 2026.3.6 PyPI release page](https://pypi.org/project/rdkit/2026.3.6/)
- [NumPy 2.3.3 PyPI JSON](https://pypi.org/pypi/numpy/2.3.3/json)
- [Pillow 12.0.0 PyPI JSON](https://pypi.org/pypi/pillow/12.0.0/json)
- [pip 25.2 PyPI JSON](https://pypi.org/pypi/pip/25.2/json)
