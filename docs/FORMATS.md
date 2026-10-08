# Structure formats: ingestion rules

## mmCIF (PDBx)
- Tokenizer: `;` text fields start only at line start and end at the next line-start `;`. Quotes open at a token start and close only when followed by whitespace (so `O5'` and `C1"x` survive). Quoted and text tokens are never keywords (`loop_`, `data_`, `_name`).
- Categories may be loops or single-row `_cat.item value` pairs; both reach the parser as the same one-row shape (including `_atom_site` and `_cell`).
- `.` and `?` mean null.
- Identity: `auth_asym_id`, `auth_seq_id`, `auth_comp_id`, `auth_atom_id` plus `pdbx_PDB_ins_code` are the primary residue identity (they match PDB files). `label_asym_id`, `label_seq_id`, `label_comp_id`, `label_atom_id`, `label_entity_id` are kept on each atom as `label*` fields. Bonds and secondary structure resolve through auth ids (and the insertion code).
- Models: `pdbx_PDB_model_num` becomes one coordinate state per model. Atom correspondence between models is checked by name, residue, insertion code, chain and alt loc (serials differ per model in mmCIF).

## PDB
- Serials (5 wide) and residue numbers (4 wide) accept hybrid-36 (`A0000` = 100000 / 10000, lowercase continues after `Zzzzz`). CONECT serials use the same decoding.
- Insertion code is column 27; MODEL/ENDMDL give coordinate states.

## Test fixtures
Real RCSB files live in `tests/fixtures/rcsb/` and are pinned in `manifest.json` (URL, download date, sha256, size). `node scripts/fetch-fixtures.mjs` verifies them and downloads the untracked large entry 4V6F (git-ignored) with a sha256 check; `--verify-only` skips downloads. Fixtures are marked `-text` in `.gitattributes` so line endings never change the hash.
The golden test (`ingestion.rcsb.test.ts`) ingests each entry as PDB and as mmCIF and requires identical chains, residues and atoms.
