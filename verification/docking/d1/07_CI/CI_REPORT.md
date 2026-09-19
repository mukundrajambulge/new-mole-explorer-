# D1 Hosted CI Report

## Accepted run

- Candidate SHA: `26227a10416657d0c2518bd0b751a38693627d5b`
- Workflow run: [35470596791](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/35470596791)
- Job: [105970732184](https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/35470596791/job/105970732184)
- Result: **SUCCESS**
- Accepted tag: `mole-explorer-docking-d1-accepted-2026-09-19`

All workflow steps passed: checkout, Node setup, `npm ci`, Playwright browser
installation, lint, typecheck, unit/API tests, production build, and the full
hosted Playwright E2E suite.

## Local gates

- D1 contract unit suite: 14 passed.
- Full unit suite: 229 passed (web 150, API 79).
- Selection matrix: 87 rows; 85 verified working, 1 missing dependency, and
  1 intentionally unsupported; oracle results 51 pass, 35 equivalent, 1
  pending by design.
- R10 verification: passed.
- Full local E2E: 147 passed, 0 failed, 0 skipped in 54.8 minutes.
- Lint, typecheck, build, and production dependency audit: passed; the npm
  audit warning is limited to development dependencies.

## Repeated failure and repair

The earlier hosted runs failed only in
`tests/e2e/r07-b2-topology-edit.spec.ts` while waiting for the second uploaded
structure's renderer model count to become `2`:

- Run `35457932892` failed at the initial candidate because the viewer readiness
  transition was not awaited.
- Run `35464378760` failed after the first repair because hosted rendering could
  exceed the test's five-second assertion window.

The accepted test-only repair waits for viewer readiness and gives the second
upload's object/model-count assertions a 30-second hosted-safe timeout. No
scientific production feature or frozen upstream implementation was changed.

