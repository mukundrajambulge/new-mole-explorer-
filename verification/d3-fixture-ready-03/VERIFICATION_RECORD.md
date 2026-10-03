# Verification record

- Re-ran `audit/audit_fixture_sources.py` against the retained official source set: 23 open candidates completed; the closed 9I7O record was not parsed into the new matrix.
- Rebuilt the required top-level matrices from those atom-level audit outputs with `audit/build_matrices.py`.
- `source_artifacts/SOURCE_MANIFEST.csv` records 103 retained RCSB source files. Its file hashes were checked against the bytes on disk.
- `CHANGED_PATHS.txt` enumerates the files in this evidence lane. `SHA256SUMS.txt` covers every other lane file, including all source artifacts and both reproducibility scripts; the checksum file excludes itself by definition. Hash verification passed.
- `git diff --check` and the staged equivalent passed. The commit contains only `verification/d3-fixture-ready-03/**`; no production code or other worktree was changed.
- No molecular preparation, hydrogen addition, production protonation, coordinate editing, component removal, PDBQT generation, field creation, scoring, docking, or D4 work occurred.
