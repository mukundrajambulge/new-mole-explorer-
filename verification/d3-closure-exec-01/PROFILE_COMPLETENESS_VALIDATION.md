# Source/profile completeness validation

**Result: PASS before RDKit import or fixture graph construction.** The same fail-closed source residue inventory that detected the predecessor mismatch was updated to consume the exact versioned altloc list and then run against the byte-verified source. It still rejects every source alternate that is not individually enumerated.

## Reconciliation

- Selected source polymer residues: 164.
- Profile-dispositioned residues: 164.
- Equality: `SOURCE_SELECTED_RESIDUES == PROFILE_DISPOSITIONED_RESIDUES` — PASS.
- Expected/selected receptor heavy atoms: 1,306 / 1,306.
- Chemical-state side chains: 51 / 51 explicit; both termini explicit.
- Altloc sites: exactly ASN68, ASP72, ARG76, MET106, GLU108; all complete, coherent and with one unique selected A maximum.
- Component occurrences: 418, all dispositioned: 164 receptor residues, 1 selected BNZ ligand, 248 CORE_DRY_V1 water exclusions, and 5 explicitly classified nonpolymer exclusions.
- Unlisted atoms, residues, alternate sites, component occurrences, chemical states, and default states: zero.
- Matrix: `SOURCE_PROFILE_COMPLETENESS_MATRIX.csv`, 164 rows; SHA-256 `703ddb058982b972807d5b7dc26cda34a094f0414ded1de8980d6fe1cd7ce979`.
- Machine result: `PROFILE_COMPLETENESS_VALIDATION.json`; it records all source hashes, source component occurrences, state-sensitive sites, alternate source rows, matrix hash, and local contact audit.

## Exact input evidence

| Input | Byte length | SHA-256 |
|---|---:|---|
| 3DMX.cif | 218,104 | `e070bcf1424fd555b5faa7a2c689c586e4adc8575bdcdad9221e80a8ed806aef` |
| BNZ.cif | 4,633 | `01bcf7c3ce9befdb4078e9832252eb5fe99e2598f320f87358ea1a9a247f7c61` |

The validator confirmed the bytes at the Linux-mounted worktree path before parsing. It recorded `rdkit_imported: false` and `molecules_constructed: false`. The CIF and CCD BNZ heavy graph signatures agree; nonsemantic CCD row/ordinal ordering is not used as graph identity.

## Disposition

There is no fourth omitted polymer state. The residue-level selections and all occurrence-level component decisions are covered in the matrix and machine result. The corrected v1.1 profile then passed two controlled preparation runs. See PREPARATION_REPLAY_REPORT.md and PREPARATION_REPLAY_VALIDATION.json.
