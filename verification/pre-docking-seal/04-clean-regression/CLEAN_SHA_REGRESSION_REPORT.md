# Clean SHA Regression Report

## Scope

- Committed source SHA: `28a8dca64a4711ca4b9e00e13e19601e56404709`
- Validation worktree: `C:\Users\mukun\Desktop\molecular-workstation-pre-docking-validation-5`
- Validation checkout began with an empty `git status --porcelain`.
- Remote: `new-origin https://github.com/mukundrajambulge/new-mole-explorer-.git`
- Runtime: Node `v24.14.1`, npm `11.11.0`
- Install authority: root `package-lock.json`

The validation worktree was separate from the user's dirty source worktree. Test-generated evidence changes stayed in that validation worktree and were not staged into the seal.

## Regression gates

| Gate | Result | Notes |
|---|---|---|
| `npm ci` | PASS | 248 packages added; npm reported five existing audit findings (3 moderate, 1 high, 1 critical); no audit remediation was applied. |
| `npm run lint` | PASS | No warnings. |
| `npm run typecheck` | PASS | No errors. |
| `npm test` | PASS | Web: 31 files / 150 tests; API: 10 files / 65 tests; 215/215 total. |
| `npm run build` | PASS | Existing 3Dmol `eval` and large-chunk warnings only. |
| `npm run test:e2e` | PASS | 147/147 passed, including exhaustive A→BF replay, responsive cases, 1CRN/4DJW, multi-object, R07–R10, and final presentation coverage. |
| `npm run verify:selection-matrix` | PASS | 87 rows; 85 implementation-verified, 1 missing dependency, 1 intentional unsupported; oracle summary 51 pass, 35 equivalent, 1 pending. |
| `npm run verify:r10` | PASS | No errors. |

## Hosted CI result

The push-triggered GitHub workflow was allowed to finish on both relevant refs:

- Tested tag SHA `28a8dca64a4711ca4b9e00e13e19601e56404709`: run `35423013895`, failure after 58m 6s; 146 passed and one R07-B2 test failed at `tests/e2e/r07-b2-topology-edit.spec.ts:76` because the second object had not yet raised `data-renderer-model-count` from 1 to 2 within 5 seconds.
- Documentation-bearing seal branch `af5793363e5e23cb461e3429c2ac157440b78795`: run `35423079246`, failure after 1h 0m 4s; the same single R07-B2 readiness assertion failed, with 146 passed.

The identical narrow readiness race is not reproduced locally: the separate clean validation worktree passed 147/147, including R07-B2 and the adjacent R07 multi-object tests. GitHub’s available browser session is signed out, so no authentication or automatic CI retry was attempted. This is recorded as a hosted-environment timing limitation, not an unexplained source failure.

## Runtime smoke

- API health: HTTP 200, `{ "service": "molecular-api", "status": "ok", "gate": "G1C" }`.
- Web root: HTTP 200.
- `/molstudio`: HTTP 200.
- Required responsive sizes were covered by the passing E2E suite: `1440x900`, `1366x768`, `900x900`, and `430x932`.
- 1CRN, 4DJW, multi-object workspace, right-rail, console, canvas, status bar, and object-panel coverage passed in the E2E suite.

## Frozen 4V6F large-structure smoke

The accepted 4V6F fixture remains user-owned and is deliberately not part of the scoped commit. The final smoke used the frozen fixture at:

`C:\Users\mukun\Desktop\molecular-workstation\verification\large-molecule-4v6f\01-source\4v6f.cif`

- Fixture SHA-256: `a48b6f9865ed1dff0e45d1992b9d20633582de6675c16d0b9a4abc75d595e56f`
- Canonical revision: `20b7c8468b598ce6272d83709eba7454505881b43d5083c85df50735e801d913`
- Transport: `compact-canonical-v1`
- Counts: 307,345 atoms; 318,270 bonds; 26,941 residues; 5,467 chains.
- Detailed lifecycle: `ready`; coarse compatibility state: `loaded`.
- Renderer: one model, 307,345 rendered atoms, `full` progressive stage, generation 1, one canvas, active object render-ready.
- Camera checks: reset, zoom, fit/focus, and center all completed while preserving canonical and renderer counts.

The validation checkout also contains a different tracked historical fixture copy (`7aab1288…`). It was not used for the accepted smoke or fingerprint comparison; the accepted `a48b6f…` frozen fixture was used explicitly.

## Compact selection fingerprint subset

The clean source SHA was exercised against the frozen `a48b6f…` fixture through the compact selection engine. The following six locked cases matched status, classification, selected count, and SHA-256 ordered membership hash exactly:

`A-001`, `A-019`, `AF-001`, `X-003`, `Z-004`, `LMX-SP-006`.

The subset result was `all_exact: true`. The known AF-001 performance concern remains a semantic-path limitation only; the locked result is scientifically correct and empty-valid.

## Interpretation

The accepted source SHA passes the release-quality regression suite and the focused large-structure smoke. PyMOL remains `BLOCKED_ENVIRONMENT` as documented by the accepted evidence, and the existing compact-selection chemistry-property limitations remain explicit rather than treated as unexplained failures.
