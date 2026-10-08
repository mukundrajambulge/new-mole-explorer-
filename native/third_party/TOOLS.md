# External tools (DEC-2, DEC-3)

Pinned versions and licences of the third-party tools used by the docking pipeline.

## AutoDock Vina

| Field | Value |
|---|---|
| Version | 1.2.7 (`vina --version`: `AutoDock Vina v1.2.7`) |
| Binary | `vina_1.2.7_linux_x86_64` |
| Source | https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.7/vina_1.2.7_linux_x86_64 |
| sha256 | `f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644` (checked by `scripts/wsl-setup.sh`) |
| Licence | Apache-2.0 |
| Install | `scripts/wsl-setup.sh` -> `~/mole-tools/vina` (WSL Ubuntu-24.04) |
| Recorded | 2026-10-08 |

## Prep environment (`~/mole-prep`, Python 3.12.3)

Direct pins: `workers/prep/requirements.in`. Full transitive lock with sha256 hashes (19 packages):
`workers/prep/requirements.lock.txt`, generated and install-verified with `--require-hashes` by
`scripts/lock-prep.sh` on 2026-10-08. Licences below were read from each installed package's metadata
(`License-Expression`, `License` or the licence classifier) by that script.

| Package | Version | Licence (from package metadata) | Notes |
|---|---|---|---|
| RDKit | 2026.3.6 | BSD-3-Clause | |
| Meeko | 0.8.0 | LGPL-2.1 (classifier: LGPLv2+) | Run only as a separate process (no linking): acceptable. |
| Dimorphite-DL | 2.1.0 | Apache-2.0 | |
| PDBFixer | 1.12.0 | MIT | |
| OpenMM | 8.6.1 | "Python Software Foundation License (BSD-like)" in metadata | Transitive (PDBFixer). Metadata string is non-standard; confirm against upstream LICENSE files (believed MIT core, LGPL GPU platforms; not verified here). Separate process only. |
| PDB2PQR | 3.7.1 | BSD (classifier: BSD License) | |
| PROPKA | 3.5.1 | LGPL-2.1 (classifier: LGPLv2) | Called by PDB2PQR in a separate process: acceptable. |
| SciPy | 1.18.1 | BSD (classifier: BSD License) | Meeko imports it but does not declare it. |
| gemmi | 0.7.5 | MPL-2.0 | Meeko imports it but does not declare it. |

Licence check: no GPL code; the two LGPL tools (Meeko, PROPKA) and OpenMM are only ever run as separate
processes and are not linked into or bundled with our code.

## Preparation worker (task 5.2, profile ME_PREP_INTERIM_V0)

Machine-checked at API startup by `apps/api/src/jobs/prepPins.ts` (any mismatch fails closed: no prep jobs).

| Field | Value |
|---|---|
| Profile ID | `ME_PREP_INTERIM_V0` |
| Entry point | `workers/prep/run_prep.py` (`python -I`, `--plan` / `--apply`), spawned only by `tools/mole-dock/prep.mjs` |
| Interpreter | `~/mole-prep/bin/python` (WSL Ubuntu-24.04), env `PYTHONHASHSEED=0`, one thread |
| Seed | ETKDGv3 `randomSeed` `61453` (`0xF00D`, `workers/prep/mole_prep/ligand.py`) |
| Lock digest | `e9584f9e12a2dd2f554eb5d3bcd75865c08e55eea715c0d1963f34605e538ce9` (sha256 of `workers/prep/requirements.lock.txt`, LF-normalised) |
| Default protonation | `EXPLICIT_SUBMITTED`; PROPKA / Dimorphite-DL are opt-in and seal as PREVIEW_UNQUALIFIED |
