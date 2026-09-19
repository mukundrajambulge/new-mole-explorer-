# Final 4V6F Selection Seal Audit

## Seal decision

**SEALED_INTERNAL_PASS_WITH_LIMITATIONS**

The A→BF selection campaign is internally sealed at `PASS_WITH_LIMITATIONS`. The complete 523-case A→BF corpus plus 9 LMX cases reconciles to 532/532 executions with no missing, duplicate, or unexpected test IDs. No P0/P1 correctness defect was observed.

## Evidence and hierarchy

- Fixture: `4v6f.cif`, SHA-256 `a48b6f9865ed1dff0e45d1992b9d20633582de6675c16d0b9a4abc75d595e56f`.
- Canonical revision: `20b7c8468b598ce6272d83709eba7454505881b43d5083c85df50735e801d913`.
- Results: 251 PASS, 243 EMPTY_VALID, 9 IMPLEMENTED_WITH_LIMITATION, 29 INVALID_EXPECTED.
- Visual evidence: 532/532 screenshots captured, non-zero, uniquely mapped, and visually reviewed across 34 contact sheets.
- Drive hierarchy: 66/66 category folders found; all 532 primary evidence files are in their expected folders and all 532 read back with matching hashes, filenames, parents, and sizes.
- One renamed Z-004 misrouting trace and five baseline/corpus support files remain as documented non-primary extras. `65_FINAL_REPORT` is reserved for the closure package.

## Performance tail

The exact historical maximum is `AF-001` (`model mini-protein.pdb like model mini-protein.pdb`) at 29,813 ms, with a valid empty selection of zero atoms. Its prior UI replay reached the ready state. The three-run semantic retest measured 11,251 ms, 11,783 ms, and 11,056 ms (median 11,251 ms; maximum 11,783 ms), with zero atoms and a stable retest membership hash. This is classified as a performance concern, not a scientific correctness defect. The historical 523-case campaign was not rerun.

## Lock and reproducibility

- Subsystem lock: `41-final/4V6F_SELECTION_SUBSYSTEM_LOCK.json` — locked, `PASS_WITH_LIMITATIONS`.
- Reproducibility fingerprint: `41-final/4V6F_SELECTION_REPRODUCIBILITY_FINGERPRINT.json`.
- Scoped commit plan: `41-final/4V6F_SELECTION_SCOPED_COMMIT_PLAN.md`.
- Baseline state was preserved: 684 starting status paths remain represented in the current worktree; no commit, push, merge, or docking was performed.

Known limitations remain explicit for revision-matched chemistry-role vectors, segment identity, and formal/partial charge predicates. PyMOL conformance remains `BLOCKED_ENVIRONMENT` and is not represented as a passing oracle result.

The closure package is uploaded and verified in `65_FINAL_REPORT`, including the final evidence-readback summary. The package contains 18 expected files with no missing, unexpected, or size-mismatched entries.
