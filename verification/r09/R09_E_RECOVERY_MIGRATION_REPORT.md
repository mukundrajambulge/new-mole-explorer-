# R09-E Recovery, Migration, Integrity, and Lifecycle Closure

Status: PASS

## Implemented

- The File workflow now distinguishes New, Open Project/Session, Save, Import/Add, Fetch, Export, and unsupported foreign-session behavior.
- Dirty state is derived from a saved workspace fingerprint and is visible alongside session revision and restore status. Saves are explicit checkpoints with conflict/error reporting.
- Open is staged: schema validation, integrity/dependency checks, session decode, selection/result/scene restoration, candidate publication, then render. Failure does not replace the current workspace.
- Supported legacy project records migrate into a new `MIGRATION` session revision while preserving source scientific identity. Future schemas fail closed with `SCHEMA_UNSUPPORTED`.
- Self-contained source artifacts reopen from local storage without network. Referenced dependencies carry expected provider/URI/digest and are verified; missing references degrade with status, wrong bytes fail with `INTEGRITY_MISMATCH`.
- Foreign PyMOL `.pse`/`.pze` containers are rejected with `SECURITY_REJECTED`; no pickle, arbitrary object deserialization, command execution, or foreign object graph is admitted.

## Evidence and verification

- Browser evidence: `restore/13-r08-result-restored.png`, `restore/14-degraded-or-failed-restore.png`, and `migration/15-revision-conflict.png`.
- API session/integrity suite: 4/4 passed.
- Full browser regression: 113/113 passed. Focused R09 browser suite: 3/3 passed.
- R09-A through R09-E local gates: typecheck, lint, unit, and build all passed.

## Acceptance mapping

AT-R09-27 through AT-R09-32: PASS. Migration, future-schema rejection, integrity failure, offline/self-contained restore, referenced digest validation, and secure foreign-session rejection are covered.

R09-F status: deferred/unavailable. `PYMOL_SESSION_ORACLE = ORACLE_PENDING`; no PyMOL PSE/PZE compatibility or exact conformance claim is made.
