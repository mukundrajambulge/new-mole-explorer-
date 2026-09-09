# PyMOL source and documentation comparison

The campaign used the pinned open-source PyMOL keyword inventory at commit `5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69`, plus the pinned selection oracle ledgers already checked into `verification/selection/`. No executable PyMOL binary or importable `pymol` module is installed on this host, so this comparison is source/documentation grounded and does not claim executable conformance.

| Topic | Authority | Comparison result | Campaign disposition |
|---|---|---|---|
| CEALIGN signature and target/mobile semantics | PyMOL Wiki Cealign (`https://wiki.pymol.org/index.php/Cealign`) | Documentation describes target/mobile selections, optional states, transform, and alignment object; Molexplorer runtime probe returns `UNSUPPORTED_CAPABILITY`. | Registered, visibly unavailable, P1 implementation gap |
| Fitting API surface | PyMOL open-source `modules/pymol/api.py` at the pinned source repository | Source exports `align`, `super`, `rms`, `rms_cur`, `intra_fit`, `intra_rms`, `intra_rms_cur`, `cealign`, and `pair_fit`; Molexplorer translates only the explicitly supported safe subset. | Safe boundary or oracle-pending per matrix row |
| Command reference | Official PyMOL command reference (`https://pymol.org/pymol-command-ref.html`) | Used to anchor command names and documented syntax families. | Reference evidence only; no runtime claim |
| Selection language | Pinned oracle ledgers under `verification/selection/` | 51 direct PyMOL rows and 35 documented equivalents are preserved with membership hashes. | ORACLE_VERIFIED / ORACLE_EQUIVALENT |
| Unsafe Python/shell/filesystem escape hatches | Pinned keyword inventory plus Molexplorer security contract | Molexplorer rejects these before execution. | Intentional safety divergence; never implement |

## Explicit limitations

- `PYMOL_EXECUTABLE_ORACLE` is `BLOCKED` because neither `pymol` nor `pymol.exe` is present and the Python import probe was false.
- Source/doc presence is not behavior equivalence. Rows without a direct pinned result remain `ORACLE_PENDING`.
- The CEALIGN row is intentionally not `SAFE_TRANSLATABLE`; the runtime status is authoritative for this branch.
