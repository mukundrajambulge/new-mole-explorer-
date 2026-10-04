# Byte-exact input verification

**Continuation result (2026-10-05):** The byte-pinned 3DMX/BNZ inputs were verified again by each v1.1 preparation run before parsing. Both prepared outputs and the full-pose bundle bind the same hashes below. The predecessor stop note at the end of this file records the earlier v1.0 preflight and is historical.

The six immutable DEC04 source artifacts in this closure package were checked on Windows and inside Ubuntu/WSL2 on 2026-10-04. The Windows and WSL SHA-256 values agree for all six files and match the committed DEC04 `SOURCE_MANIFEST.csv` byte lengths/digests. The source hashes were then checked again inside the Python adapter immediately before it parsed the mmCIF/CCD byte buffers; the same in-memory bytes were passed to the CIF parser. See `runtime_logs/linux/windows-source-hashes.json`, `runtime_logs/linux/wsl-source-hashes.txt`, and `runtime_logs/linux/source-altloc-preflight.json`.

| Input | Bytes | SHA-256 | Windows | WSL2 | DEC04 manifest |
|---|---:|---|---|---|---|
| `3DMX.cif` | 218104 | `e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef` | PASS | PASS | PASS |
| `3DMX_assembly_1.json` | 3543 | `2accfe2d4b9eabc50c37932da6af4ce6b36ad0b0ee078192fd882fd005ea9670` | PASS | PASS | PASS |
| `3DMX_entry.json` | 22036 | `e9b303678dab19908f7708201586e732caf1f015fde0e4d36c4d7c97bfbaad1b` | PASS | PASS | PASS |
| `3DMX_full_validation.pdf` | 515092 | `e24681b6500f8489ad93b8ce747978b1346df2f2817aa208683a1b6656e47f62` | PASS | PASS | PASS |
| `3DMX_polymer_entity_1.json` | 50665 | `e016e357934b43d07c58e971720d800ba253b441b614dfd547933838226a508d` | PASS | PASS | PASS |
| `BNZ.cif` | 4633 | `01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61` | PASS | PASS | PASS |

Byte identity is established for these source copies. The adapter parsed the 3DMX entity-1 atom inventory and the BNZ/component definitions after the hash gate, but stopped at additional, unapproved receptor alternate conformers documented in `SOURCE_PROFILE_MISMATCH.md`. No source-derived molecule was constructed, no fixture bytes were passed to an RDKit molecular operation, and no `Chem.AddHs` call was made on a fixture graph. This is not a completed preparation run.
