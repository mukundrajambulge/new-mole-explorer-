# D2 Clean-Branch Baseline Run

Executed from:

`C:\Users\mukun\.codex\worktrees\molecular-workstation-d2-explicit-state-site\molecular-workstation`

Starting commit:

`26227a10416657d0c2518bd0b751a38693627d5b`

Commands and results:

| Command | Result |
|---|---|
| `npm test -- --run` | PASS — web 150 tests, API 79 tests; 229 passed, 0 failed |
| `npm run typecheck` | PASS — API, app, web, contracts |
| `npm run lint` | PASS — API, app, web, contracts |
| `npm run build` | PASS — API, app, web, contracts |

The production build emitted the existing Vite warning for the bundled `3dmol` dependency and a large-chunk advisory; neither changes the D2 scientific scope. `npm ci` also reported five existing audit advisories (three moderate, one high, one critical). No dependency upgrade or unrelated hardening is included in D2.

The accepted D1 reports remain the source of the 14-test D1 contract-gate result and 147-test local E2E result. They will be treated as regression evidence and rerun at D2 closure.
