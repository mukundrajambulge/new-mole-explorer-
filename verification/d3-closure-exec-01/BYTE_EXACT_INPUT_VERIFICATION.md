# Byte-exact input verification

The six files in this package's `source_artifacts/current_rcsb/` were checked byte-for-byte against the source lengths and SHA-256 values in the committed DEC04 `SOURCE_MANIFEST.csv`; all six passed. The same six files in the dedicated DEC04 worktree at `C:\Users\mukun\.codex\worktrees\d3-prep-dec-04-3dmx-bnz\molecular-workstation\verification\d3-prep-dec-04-3dmx-bnz\source_artifacts\current_rcsb\` were independently checked against that manifest; all six passed there as well.

| Input | Bytes | SHA-256 | Closure package | Dedicated DEC04 worktree |
|---|---:|---|---|---|
| `3DMX.cif` | 218104 | `e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef` | PASS | PASS |
| `3DMX_assembly_1.json` | 3543 | `2accfe2d4b9eabc50c37932da6af4ce6b36ad0b0ee078192fd882fd005ea9670` | PASS | PASS |
| `3DMX_entry.json` | 22036 | `e9b303678dab19908f7708201586e732caf1f015fde0e4d36c4d7c97bfbaad1b` | PASS | PASS |
| `3DMX_full_validation.pdf` | 515092 | `e24681b6500f8489ad93b8ce747978b1346df2f2817aa208683a1b6656e47f62` | PASS | PASS |
| `3DMX_polymer_entity_1.json` | 50665 | `e016e357934b43d07c58e971720d800ba253b441b614dfd547933838226a508d` | PASS | PASS |
| `BNZ.cif` | 4633 | `01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61` | PASS | PASS |

The raw source bytes remain unchanged. They were **not parsed, used as chemistry inputs, or passed to RDKit**. Consequently, this report records verified source copies, not a successful byte-exact preparation run. The required immediate pre-use rehash remains outstanding because no chemistry operation occurred.
