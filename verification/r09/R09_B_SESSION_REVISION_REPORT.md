# R09-B Native Session Revision Store

Status: PASS

## Implemented

- `SessionStore` persists an immutable revision file plus an atomically published head index under the project session directory.
- Each save creates a new `SessionRevision` with parent revision IDs, saved time, build/profile versions, object records, selections, results, scenes, dependencies, migration history, and integrity entries.
- Session objects retain durable object IDs, scientific revision IDs, coordinate state refs, enabled state, presentation, lineage, and exact `StructureLoadResult` provenance.
- Save uses expected-revision protection, staged revision publication, post-write integrity verification, and a simulated interruption path that leaves the existing head unchanged.
- Open validates schema, manifest hash, source-artifact bytes, and dependency mode before publishing a restored workspace candidate.

## Evidence and verification

- API session-store suite: 4/4 passed for immutable revisions, multi-object-capable reopen, stale writer conflict, interrupted save, future schema rejection, manifest/source corruption, and legacy migration.
- Browser evidence: `sessions/02-save-session-revision.png`, `sessions/03-modified-workspace-second-save.png`, `sessions/04-reopen-first-revision.png`, `sessions/05-reopen-latest-revision.png`, and `restore/12-restored-selection-result.png`.
- Full browser regression: 113/113 passed, including the R09 save/open workflow.

## Acceptance mapping

AT-R09-09 through AT-R09-15: PASS. S1 remains readable after S2, stale writers receive `REVISION_CONFLICT`, interrupted saves do not advance the head, multi-object scientific heads reopen, durable selections/results are retained with disposition, and renderer caches are not session authority.

R07 fine-grained undo/redo history is not fabricated as part of R09 session history. The session stores the governed current/retained scientific references and durable result records; UI restore reports scope honestly.
