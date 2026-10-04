# Runtime installation record

**Host target:** Windows x64, task-specific user-local runtime directory `C:\Users\mukun\AppData\Local\mole-explorer\d3-closure-exec-01`.

The standard pinned CPython 3.13.16 x64 installer was acquired and hash-verified. The earlier attempt named by the task rolled back with `0x80070003`. Its child MSI log records Note 1:2203 for `C:\Users\mukun\AppData\Local\Package Cache\{BEFCA6D5-EC1C-4350-8313-C794A552FFC2}v3.13.16150.0\core.msi` and error `-2147287037` when Windows Installer tried to open that cached package. The bundle log shows it acquired and moved `core_JustForMe` to that cache path immediately before invocation; the MSI could not open it. The original parent and child logs are preserved under `runtime_logs/`.

A fresh quiet user-scoped install to the task runtime directory then rolled back with `0x80070656`; the child Windows Installer log ends with main engine return `1622`. Retrying with `TEMP` and `TMP` set to a known writable task-specific directory produced the same result. These later logs do not establish why Windows Installer returned 1622; no more specific cause is inferred.

The approved task permits a local/portable/user-scoped environment when compatible with the pin. The official Python.org embeddable package was therefore downloaded, verified against the release-page SHA-256, extracted under the task runtime directory, and configured to use only its bundled standard library and private site-packages directory. It starts as CPython 3.13.16 x64 in isolated mode.

The pinned pip and dependency wheels were installed offline by exact hash. Importing RDKit fails because enterprise Code Integrity blocks the unsigned `rdkit\rdBase.pyd`. Events 3077 and 3033 in `Microsoft-Windows-CodeIntegrity/Operational` state that the module does not meet enterprise signing-level requirements. The environment is not usable for the approved AddHs operation until the device policy permits an authorized RDKit binary to load.

The system Code Integrity policy was not changed or bypassed. No molecular operation was attempted. See `PINNED_TOOLCHAIN_EXECUTION_RECORD.md` for versions, hashes, paths, and exact failure evidence.

Raw installer logs, the runtime identity transcript, the failed RDKit import transcript, installed-package list, Code Integrity event transcripts, host environment facts, and package artifact hash manifest are preserved under `runtime_logs/`.
