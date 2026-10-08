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

## Prep environment (`~/mole-prep`, Python 3.12.3): observed, not yet locked

Versions installed by `scripts/wsl-setup.sh` on 2026-10-08. Task 5.1 adds licences and the lock file.

| Package | Version |
|---|---|
| RDKit | 2026.3.6 |
| Meeko | 0.8.0 |
| Dimorphite-DL | 2.1.0 |
| PDB2PQR | 3.7.1 |
| PROPKA | 3.5.1 |
| PDBFixer | not installed |
