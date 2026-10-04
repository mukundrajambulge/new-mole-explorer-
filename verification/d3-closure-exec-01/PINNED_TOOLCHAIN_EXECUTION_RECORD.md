# Pinned toolchain execution record

## Requested pins

| Component | Requested version/artifact | Expected SHA-256 | Acquisition check |
|---|---|---|---|
| CPython x64 full installer | `python-3.13.16-amd64.exe` | `fb4f9f5d438b2396da0086dc70b935c530cb578e37adc6d354f7ad2037fee83b` | PASS |
| RDKit | `rdkit-2026.3.6-cp313-cp313-win_amd64.whl` | `3765896e189a5dc4ef109a1ab81c375fb1e00185d52374ffc2128391bddd6b8f` | PASS |
| NumPy | `numpy-2.3.3-cp313-cp313-win_amd64.whl` | `f0dadeb302887f07431910f67a14d57209ed91130be0adea2f9793f1a4f817cf` | PASS |
| Pillow | `pillow-12.0.0-cp313-cp313-win_amd64.whl` | `4cf7fed4b4580601c4345ceb5d4cbf5a980d030fd5ad07c4d2ec589f95f09905` | PASS |
| pip | `pip-25.2-py3-none-any.whl` | `6d67a2b4e7f14d8b31b8b52648866fa717f45a1eb70e83002f4331d07e953717` | PASS |

Wheel hashes were cross-checked against the matching PyPI JSON release metadata before download and checked again on each downloaded file. The Python installer hash matched the AUTH04 pin and Python.org release page.

## Runtime attempts

1. The pinned full installer was run quietly with a user-scoped target at `C:\Users\mukun\AppData\Local\mole-explorer\d3-closure-exec-01\python313`, without PATH or launcher changes. It rolled back with bundle result `0x80070656`; its child MSI log reports Windows Installer main engine return 1622. The same result occurred after setting `TEMP` and `TMP` to a task-specific writable directory. No Python installation was left at the requested target.
2. The official CPython 3.13.16 x64 embeddable package was used as the task-permitted isolated portable runtime. Its SHA-256, verified against the Python.org release page, is `97dae5274cc54867065e8d5a3226e48c35017ed332a0fdb0e27d5b5821961297`. At `C:\Users\mukun\AppData\Local\mole-explorer\d3-closure-exec-01\python-embed\python.exe`, it reports CPython 3.13.16, 64-bit AMD64, and isolated mode enabled. This is the official embeddable distribution, not the full installer distribution. The executable SHA-256 is `31fe10b4ed82a2f960af0ef9931f46a4b84ff286f8b6ffd9dee098cf4f10f17f`.
3. pip 25.2 was bootstrapped from its pinned wheel. The exact RDKit, NumPy, and Pillow wheels were installed with `--no-index --no-deps --require-hashes --upgrade --force-reinstall` into the runtime's private `Lib\site-packages`. The command completed with exit 0 and the output is saved in `runtime_logs/pinned-wheel-install.txt`; the exact wheel URLs and observed hashes are in `runtime_logs/package-artifact-manifest.csv`.
4. Initial importing `rdkit.rdBase` failed with `ImportError: DLL load failed while importing rdBase: An Application Control policy has blocked this file.` Windows Code Integrity Operational events 3077 and 3033 identify `rdkit\rdBase.pyd` as not meeting enterprise signing-level requirements (policy ID `0283ac0f-fff1-49ae-ada1-8a933130cad6`). The `.pyd` is unsigned and its observed SHA-256 is `4ffc113eabdc59b79a6d8d120539d8a9ea082eb999916ebdf26df0cf13503305`. Moving `TEMP` did not affect that earlier block.
5. On 2026-10-04 at 08:41 UTC, `rdkit.rdBase` and the pinned package metadata imported successfully from the same private runtime. `rdkit.Chem` still fails before the required API can load: the §18 safe synthetic control reports `ImportError: DLL load failed while importing rdmolfiles: An Application Control policy has blocked this file.` The unsigned `rdkit\Chem\rdmolfiles.pyd` SHA-256 is `42f89f7f7b129b0b166af7bd46225beede035d0110b5ba64d8010a50d6244627`, exactly matching the installed distribution `RECORD` hash. A 30-minute query at 08:48 UTC found no matching Code Integrity events for these modules; the policy error is preserved in `runtime_logs/rdkit-chem-import-recheck.txt`. No molecular operation or `Chem.AddHs` call occurred.

At that Windows recheck, the pinned chemistry engine was not executable under the Windows host policy. No alternative engine or policy bypass was used. Runtime and wheel files are kept outside the Git worktree at `C:\Users\mukun\AppData\Local\mole-explorer\d3-closure-exec-01`; installer logs are copied into `runtime_logs/`. Host facts at capture time: Windows 11 Pro build 26200, 12th Gen Intel Core i5-12500H, 16 logical processors, `en-IN` locale, India Standard Time. Exact timestamps and executable/module hashes are in `runtime_logs/host-environment.json`. This Windows-only conclusion was superseded by the owner-authorized Linux continuation below; the historical evidence remains unchanged.

## Current continuation outcome (2026-10-05)

The owner-authorized Linux x86-64 relocation loaded the exact CPython 3.13.16 / RDKit 2026.03.6 runtime. The corrected v1.1 profile passed the source-only validator before each fixture run. Both hydrogen-only preparations, replay, D2 seals and digest recomputation, SearchRegion validation, and the six-pose full-pose run passed. Historical Windows Application Control evidence remains unchanged, and no Windows policy was altered. See LINUX_RUNTIME_RECORD.md, PREPARATION_REPLAY_REPORT.md, SEARCH_REGION_REPORT.md, and D3_CLOSURE_EXEC_01_REPORT.md.
