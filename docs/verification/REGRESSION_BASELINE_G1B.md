# G1B-R1 Presentation Regression Baseline

Status: verified locally on 2026-08-31. Final lock SHA is recorded in the task handoff after the evidence commit.

## Baseline identity

- Starting SHA: `914de2bbaa2e9118cbe672ac810138e2bbaf5ba3`
- Branch: `main`
- Starting worktree: clean
- Remote: none configured
- App route verified: `http://localhost:5174/molstudio` (the audited repository intentionally uses 5174 beside any existing 5173 app)
- Fixture: `tests/fixtures/mini-protein.pdb`
- Fixture SHA-256: `30e7eff33d94fb3b39f57a8a6f3e344da776ce1d237eb9ea56c6a44d543e268a`
- Fixture canonical counts: 12 atoms, 5 residues, 2 chains; protein 8, ligand 2, water 1, ion 1, other 0.

## Representation contract

| Presentation | Canonical projection | Expected renderer observable |
| --- | --- | --- |
| Lines | `LINES` | canonical bond line segments; no stick cylinders |
| Sticks | `STICKS` | canonical bond cylinders only; no coordinate-inferred bonds |
| Spheres | `SPHERES` | spheres only; stick cylinders `0` |
| Ball & Stick | `STICKS + SPHERES` | spheres and canonical stick cylinders both present |
| Licorice | `STICKS + NB_SPHERES` | sticks plus nonbonded spheres; distinct from Ball & Stick |
| Cartoon | polymer `CARTOON`, ligand `STICKS`, ions `SPHERES` | water hidden by layer default |
| Surface/Ribbon | unsupported in G1B | explicit Coming Soon notice; no silent substitution |

## Water/component contract

Water retains an explicit sphere mask and uses a documented small-sphere profile when `showWater` is ON. The default OFF state is a presentation visibility gate. Water and ion toggles do not change canonical counts, bonds, coordinates, scientific hash, or provenance.

## 4DJW live baseline

Fetched through the backend RCSB workflow on 2026-08-31. Source metadata reported `4DJW.cif`, `RCSB · MMCIF`, source SHA-256 `c816a3b9e947cc71bf5390b2d10aeb117f0b6a2e7b16efbba3bf4c56c8d044f2`, and scientific hash `88700717cdd733d68ee29b43b083d880a75262610f83c62c01fa348e7cf6a673`.

Canonical counts: 7,079 atoms, 786 residues, 9 chains; protein 6,112, ligand 82, water 885, ions 0, other 0. The live Cartoon projection reported 6,112 cartoon contributors, 85 canonical stick cylinders, zero water spheres, and zero ion spheres. Water ON was separately verified on the small fixture.

## Verification commands

Pre-change clean baseline:

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — 12 tests passed
- `npm run build` — pass; existing 3Dmol eval/large-chunk warnings only
- `npm run test:e2e` — 5 tests passed

G1B-R1 verification:

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — 17 tests passed (10 web, 7 API)
- `npx playwright test tests/e2e/g1b-r1.spec.ts` — 24 passed
- `npm run test:e2e` — 29 passed (5 accepted G0 cases plus 24 G1B-R1 cases)
- `npm run build` — pass; existing 3Dmol eval/large-chunk warnings only

The 24 regression IDs are machine-listed in `verification/regression/g1b.json` and map to the real browser spec. Browser tests use the real API, real 3Dmol canvas, and real WebGL-capable Chromium; no mocked renderer is used.

## Evidence screenshots

- `docs/screenshots/g1b-r1-empty.png`
- `docs/screenshots/g1b-r1-uploaded-protein.png`
- `docs/screenshots/g1b-r1-rcsb-4djw.png`
- `docs/screenshots/g1b-r1-cartoon-ligand-sticks.png`

## Known limitations

Surface, Ribbon, scientific selection, editing, measurements, docking, and analysis remain intentionally out of scope. The canonical render diagnostics count projection contributors, not GPU triangle/cylinder buffers. RCSB verification depends on live network access and remains a manual acceptance step in addition to the deterministic local fixture suite.
