# External tools (DEC-2, DEC-3)

Pinned versions and licences of the third-party tools used by the docking pipeline.

## AutoDock Vina

| Field | Value |
|---|---|
| Version | 1.2.7 (`vina --version`: `AutoDock Vina v1.2.7`) |
| Binary | `vina_1.2.7_linux_x86_64` |
| Source | https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.7/vina_1.2.7_linux_x86_64 |
| sha256 | `f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644` (checked by `scripts/wsl-setup.sh`) |
| Source commit | `8eb40404f4f45608acb3b01427587ac049f27c1f`: the commit tag `v1.2.7` points to (GitHub API `repos/ccsb-scripps/AutoDock-Vina/git/ref/tags/v1.2.7`, checked 2026-10-09). It matches the research comparator pin (RESEARCH-DIGEST C12). The release binary is assumed to be built from this tag; this was not rebuilt or verified here. |
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
| Worker version | `0.1.0` (`mole_prep.manifest.WORKER_VERSION`; manifest stage `mole_prep.receptor_clean`) |
| Installed check | `run_prep.py --versions` (via `tools/mole-dock/prep.mjs` `probePrepVersions`) must report this lock digest, this worker version and, for every tool, the version in the lock and in the table above; checked before the first plan, any drift fails closed (PROVENANCE_REPLAY) |
| Manifest check | every `prep-manifest.json` `stages[].version` must equal the table above (PDB2PQR/PROPKA as `x/y`; PDBFixer's `params.openmm` against OpenMM); drift rejects the seal (`TOOL_VERSION_DRIFT:<tool>`) |
| Entry point | `workers/prep/run_prep.py` (`python -I`, `--plan` / `--apply`), spawned only by `tools/mole-dock/prep.mjs` |
| Interpreter | `~/mole-prep/bin/python` (WSL Ubuntu-24.04), env `PYTHONHASHSEED=0`, one thread |
| Seed | ETKDGv3 `randomSeed` `61453` (`0xF00D`, `workers/prep/mole_prep/ligand.py`) |
| Lock digest | `e9584f9e12a2dd2f554eb5d3bcd75865c08e55eea715c0d1963f34605e538ce9` (sha256 of `workers/prep/requirements.lock.txt`, LF-normalised) |
| Default protonation | `EXPLICIT_SUBMITTED`; PROPKA / Dimorphite-DL are opt-in and seal as PREVIEW_UNQUALIFIED |

## Docking job store (task 5.4)

| Item | Value |
| --- | --- |
| Store | Plain files under the API data dir (`<root>/<jobId>/state.json`, `events.ndjson`, `in/`, `out/`, `pid`; `<root>/.lock`), no new dependency |
| Rejected | `better-sqlite3` (native addon, no compiler on the host, no checked Node 24 win32 prebuild); `node:sqlite` (experimental on Node 24: warning, unstable API) |
| ADR (interim) | The research asks for SQLite in WAL mode; the file store is an accepted interim deviation (owner decision, sprint W10). The store sits behind `DockJobService` (`apps/api/src/docking/routes.ts`, `createStore` seam), so a SQLite WAL store can replace it without touching callers. |
| Engine launch | `wsl.exe --exec` + `PIDFILE_WRAPPER` in `tools/mole-dock/run.mjs`: `setsid -w /bin/sh` writes its pid (= pgid) to the pidfile, starts a watcher on the stdin pipe the API holds open (EOF when wsl.exe or the API dies, then it SIGKILLs the group), then execs `/usr/bin/timeout -k 5 ...`. Cancel kills `-<pgid>` only when a group member's cwd is the job's out dir (`-ef`, device + inode) and confirms with `pgrep -g` that the group is empty; the next job waits for that (or up to 20 s for a late pidfile). |
