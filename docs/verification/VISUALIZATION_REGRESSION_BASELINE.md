# G1C visualization regression baseline

## Scope

This is the G1C post-change evidence record for the new greenfield Molecular Workstation. The approved G1B shell, ingestion, project, camera, visibility, and failure-preservation behavior remain regression-gated. The G1C scope stops at visualization/presentation; advanced selection, editing, expanded measurement/analysis, docking, and HTS are not implemented.

## Baseline and source control

- Branch: `main`
- Starting SHA: `daa19b97cf928579cd365ba613943f4b7080133e`
- G1C implementation commit: `5ef3757d0e6b154b5318315f4a56088ec01343a5`
- Starting worktree: clean
- Previous baseline before edits: `npm run lint`, `npm run typecheck`, `npm test` (17 tests), `npm run build`, and `npm run test:e2e` (29 Playwright/WebGL tests) all passed.
- G1C fixture hashes and source metadata are produced by the ingestion service; local fixture names are listed below.

## G1C test matrix

- Frontend unit: representation directives, all style profiles, surface distinction, shared actions, color inventory/property readiness and negatives, and non-mutation.
- Backend unit: local PDB/mmCIF ingestion, provenance/hash, explicit topology, B-factor, formal charge, and secondary-structure assignment.
- Browser/WebGL: real 3Dmol mount, upload, RCSB fetch, line/stick topology, sphere vs Ball-and-Stick, cartoon/ligand layering, component visibility, camera controls, ribbon/style dropdown, color/background controls, non-destructive failure, and model-load count.

## Fixtures

`mini-protein.pdb` covers small protein + organic ligand + water + ion + explicit bonds. G1C additions cover `g1c-secondary-formal.pdb`, `g1c-isolated-atom.pdb`, `g1c-multichain-nucleic-acid.pdb`, `g1c-small-molecule.pdb`, `g1c-partial-charge.json`, and `g1c-malformed.pdb`. The RCSB browser path uses an official fetched mmCIF target (1CRN/4DJW depending on network run) and retains URI/hash provenance in the rendered structure metadata.

## Post-change results

- `npm run lint` — passed for API, web, and contracts.
- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 31 frontend tests and 9 backend tests.
- `npm run test:e2e` — passed: 37 real Chromium/WebGL tests (29 prior regression tests + 8 G1C tests).
- `npm run build` — passed. Vite reports the existing 3Dmol `eval` warning and a large JavaScript chunk warning; neither is a test failure.
- `git diff --check` — passed.

## Manual browser verification

Verified on `http://localhost:5174/molstudio` with the current new repository: empty state, local `mini-protein.pdb`, Cartoon with ligand sticks, Ball-and-Stick, Space-Filling, official RCSB `1CRN.cif`, style/color dropdowns, property-unavailable diagnostics, shared visibility controls, and one adapter model load across presentation changes. The page remained free of global horizontal overflow.

Port 5173 was intentionally not changed: it is owned by a separate legacy `D:\Projects\Molexplorer` Vite process. The current greenfield repository is configured for port 5174 because 5173 is occupied.

## Screenshot evidence

- `docs/screenshots/g1c-empty.png`
- `docs/screenshots/g1c-uploaded-protein.png`
- `docs/screenshots/g1c-cartoon-ligand-sticks.png`
- `docs/screenshots/g1c-ball-and-stick.png`
- `docs/screenshots/g1c-space-filling.png`
- `docs/screenshots/g1c-rcsb-1crn.png`

## Evidence summary

- Spheres vs Ball-and-Stick: fixture diagnostics show Spheres `11 spheres / 0 sticks`; Ball-and-Stick `11 spheres / 8 canonical sticks`.
- Lines/Sticks: the loaded fixture exposes 8 canonical bonds; Lines and Sticks both report 8 contributors and `data-renderer-canonical-bond-source=canonical`.
- Water: default hidden, then one water sphere when the Water layer is enabled; no canonical atom removal.
- Ions: the fixture contains one ion and the Ion toggle changes its visible sphere count from 1 to 0 and back.
- RCSB: `1CRN.cif` is fetched by the backend from `https://files.rcsb.org/download/1CRN.cif`, and the UI shows RCSB/mmCIF/hash provenance.
- Non-mutation: frontend and backend tests preserve scientific hash, stable identities, coordinates, topology, and source metadata across presentation operations.

## Known limitations and next-gate boundary

- VDW, SAS, SES, Mesh, Dots, and Dot Surface have distinct profiles but are `COMING_SOON` until governed generators exist.
- ESP is `EXPERIMENTAL` and unavailable without a registered potential-field engine; it never falls back to charge coloring.
- Cartoon/Ribbon/Trace/Putty are `SUPPORTED_WITH_LIMITATIONS` through canonical polymer targets and 3Dmol profiles. Putty requires source B-factors.
- The legacy G1B toolbar Ribbon item remains an explicit Coming Soon action for accepted regression compatibility; the G1C right-side Style dropdown provides the real Ribbon profile.
- Selection, editing, expanded measurement/analysis, docking, and HTS remain out of scope. This gate stops after G1C.
