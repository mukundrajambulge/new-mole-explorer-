# D3-CLOSURE-EXEC-01 requirement traceability

Statuses use the task's required vocabulary. `FAILED` here means the required evidence or execution was not completed in this task; it does not assert that a scientific hypothesis was falsified. Bounded prior implementation evidence is explicitly limited to the listed commits/reports.

| Requirement scope | Status | Evidence / disposition |
|---|---|---|
| §§1–4 — preserve program, fixture, D1/D2, PyMOL and capability boundaries | `SATISFIED_WITH_EVIDENCE` | A strict fixed-width TOR atom-serial parser correction was made from code review; no scientific scoring rule, application feature, or capability registry changed. `DOCKING.RUN` remains unavailable; active fixture stays 3DMX/BNZ. |
| §§5–6 — current canonical documents and complete local AUTH04 package | `SATISFIED_WITH_EVIDENCE` | Current Drive read recorded in `DRIVE_SOURCE_REVIEW.md`; AUTH04/DEC04 evidence remains in repository. |
| §§7–8 — repository preflight and isolated branch/base | `SATISFIED_WITH_EVIDENCE` | `PREFLIGHT_RECORD.md`; required AUTH04 commit is an ancestor; primary dirty checkout preserved. |
| §9 — prove exact source bytes immediately before preparation use | `FAILED` | Six source copies match recorded byte lengths and hashes, but no source was parsed/used; the required immediately-before-use verification is absent. |
| Phase A / §§11–13 — exact Roadmap review contract, code review and pre-execution review | `SATISFIED_WITH_EVIDENCE` | `D3_REQUIRED_GATE_REVIEW.md`; independent pre-execution review, corrected-revision code review, and blocked-state evidence-package audit PASS. Scientific closure remains unsupported while preparation/full-pose outputs are absent. |
| §§14–18 — pinned runtime, dependencies, safe-control validation and AddHs preconditions | `FAILED` | Python/pinned wheels are verified, but RDKit import is blocked by Enterprise Code Integrity before any molecule operation; no dry-run or AddHs call occurred. |
| §§19–25 — source heavy-atom invariant, receptor/BNZ prep, seals, SearchRegion and replay | `FAILED` | No chemistry operation or state instance exists because the pinned RDKit extension was blocked at import. Deterministic replay is required by AUTH04 execution preconditions and integrated task §25, but was not run. |
| §§26–32 — same-state deterministic full-pose cohort, statistics, ordering and acceptance recommendation | `FAILED` | No sealed states/poses or scores; results tables are header-only. No scalar approximation threshold is approved by current canonical amendments. |
| §33 — cumulative regression | `SATISFIED_WITH_EVIDENCE` (software only) | Workspace tests, typecheck, lint, build and preserved bounded native/PyMOL test records are itemized in `CUMULATIVE_REGRESSION_REPORT.md`. Chemistry/preparation/full-pose suites did not run. |
| §34 — resources | `SATISFIED_WITH_EVIDENCE` (bounded grid implementation only) | Prior D3-GRID maximum-field measures are preserved in `RESOURCE_VALIDATION.md`; no fixture-specific SearchRegion/full-pose resources were measured. |
| §§35,37 — traceability/evidence package | `SATISFIED_WITH_EVIDENCE` | This matrix and the task-required status artifacts are committed or being added in the same package; no missing measurements are imputed. |
| §36 — no new intermediate gate | `SATISFIED` | Open execution dependencies stay within this integrated task; no intermediate gate/prompt is proposed. |
| §38 — successful closure exit criteria | `FAILED` | Required preparation, deterministic replay, prepared-state/SearchRegion seals and full-pose evidence are absent. |
| §39 — hard-failure classification | `SATISFIED_WITH_EVIDENCE` | The approved pinned engine cannot reproduce the approved runtime state on this host because Code Integrity blocks `rdBase.pyd`; current event IDs 3033/3077 are preserved. |
| §40 — final classification/handoff | `FAILED` for PASS; `SATISFIED_WITH_EVIDENCE` for HOLD reporting | Exact HOLD classification is recorded. D3-FINAL-01 is not ready; D4/`DOCKING.RUN` remain blocked/unavailable. |
