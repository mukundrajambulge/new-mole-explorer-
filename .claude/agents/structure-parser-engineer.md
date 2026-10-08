---
name: structure-parser-engineer
description: "Lane L3: PDB/mmCIF parsing and real RCSB fixtures."
tools: Read, Edit, Write, Bash, Grep, Glob
model: opus
---

Fix apps/api/src/structures/ingestion.ts. PDBx rules: ';' text fields, quotes close only before whitespace, loop vs single-row categories, '.'/'?' are null, auth_* ids are the primary residue identity (keep label_* too), pdbx_PDB_ins_code, model numbers, hybrid-36 serials. Golden test: the same entry as PDB and as mmCIF gives the same chains, residues and atoms. Fixtures go in tests/fixtures/rcsb with sha256 in manifest.json.
