# Runtime installation record

## Historical Windows attempt

The Windows x64 run acquired the pinned CPython 3.13.16 installer and the exact RDKit 2026.3.6, NumPy 2.3.3, Pillow 12.0.0, and pip 25.2 artifacts. The full CPython installer rolled back (first `0x80070003`, then `0x80070656` / MSI return 1622). The official embeddable CPython 3.13.16 runtime was then installed in the task-local directory. Its isolated Python environment accepted the hash-pinned packages, but Windows Application Control blocked loading the RDKit native modules (`rdBase.pyd`, later `rdmolfiles.pyd`). Their hashes matched the installed wheel RECORD. No host policy was changed or bypassed. Original installer and Code Integrity evidence remains under `runtime_logs/`.

## Authorized Linux continuation

The owner authorized relocating only the execution environment for this D3-CLOSURE-EXEC-01 run. An existing WSL2 Ubuntu 24.04.5 x86-64 distribution was used. CPython 3.13.16 was built from its hash-verified official source archive in a private prefix, then isolated in a private virtual environment. RDKit 2026.03.6 and its pinned NumPy 2.3.3, Pillow 12.0.0, and pip 25.2 artifacts were installed offline with hash checking. `rdkit.rdBase`, `rdkit.Chem`, `rdkit.Chem.rdmolfiles`, and `rdkit.Chem.rdmolops` import successfully. The exact wheel and extension identities, environment, interpreter hash, package RECORD checks, and installation evidence are in `LINUX_RUNTIME_RECORD.md` and `runtime_logs/linux/`.

Safe synthetic ethane and aromatic-benzene AddHs controls both passed twice in separate processes with matching output signatures. The controls verify the bounded API operation only; they are not fixture preparation or fixture replay.

## Pre-correction fixture execution status (historical)

Windows input-side and WSL source-side hashes match for all six byte-exact manifest artifacts. Hash-gated CIF preflight found additional A/B alternates at ASN68, ASP72, and ARG76 beyond the only explicitly approved groups, MET106 and GLU108. The existing profile does not resolve the three additional coordinate states, and the relocation instruction forbids changing the alternate policy. The preflight therefore stopped before fixture graph construction or any fixture molecule was supplied to RDKit. No fixture AddHs operation or preparation ran. The Windows loader issue is no longer the active execution blocker; the unresolved source/profile coordinate-state conflict is.

## Current fixture execution status (2026-10-05)

The bounded owner authorization permitted corrected preparation profile v1.1 after the source-only validator established complete, unique A altloc selections and unchanged AUTH04 chemical states. The pinned Linux runtime was used for two preparation/replay runs; both passed. Prepared states, D2 seals, SearchRegion and full-pose results are complete. The previous no-run statement above records the v1.0 checkpoint only. See D3_CLOSURE_EXEC_01_REPORT.md and runtime_logs/FINAL_CLOSURE_RUN.md.
