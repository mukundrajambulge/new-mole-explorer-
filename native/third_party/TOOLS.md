# External tools (DEC-2, DEC-3)

Pinned versions of third-party tools used by the docking pipeline. Task 5.1 owns this file
and completes the prep-environment section (exact versions, licences, lock file).

## AutoDock Vina

| Field | Value |
|---|---|
| Version | 1.2.7 (`vina --version`: `AutoDock Vina v1.2.7`) |
| Binary | `vina_1.2.7_linux_x86_64` |
| Source | https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.7/vina_1.2.7_linux_x86_64 |
| sha256 | `f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644` |
| Licence | Apache-2.0 |
| Install | `scripts/wsl-setup.sh` -> `~/mole-tools/vina` (WSL Ubuntu-24.04) |
| Recorded | 2026-10-08 |

## Prep environment (`~/mole-prep`, Python 3.12.3)

Pins in `workers/prep/requirements.in`; lock in `workers/prep/requirements.lock.txt` (see `workers/prep/README.md`).
The lock currently holds direct pins only; the full transitive freeze must still be generated in WSL.

| Package | Version | Licence | Notes |
|---|---|---|---|
| RDKit | 2026.3.6 | BSD-3-Clause | |
| Meeko | 0.8.0 | LGPL-2.1 | Run only as a separate process (no linking): acceptable. |
| Dimorphite-DL | 2.1.0 | Apache-2.0 | |
| PDB2PQR | 3.7.1 | BSD-3-Clause | |
| PROPKA | 3.5.1 | MIT | |
| PDBFixer | NOT INSTALLED (pin pending) | MIT | Add to `scripts/wsl-setup.sh`, then pin. |

Licences are from upstream metadata as known at writing; reviewer to confirm against `pip show` in WSL.
