# Slice A — Scientific shell foundation

The accepted baseline was retained on `feature/final-scientific-ui-pymol-conformance`. The application now opens with File, Select, Display, Color, Measure, Analyze, View, and Help; a permanent Objects & Selections panel; an unrestricted center canvas; a fixed right-edge scientific tool rail; a status bar; and a collapsed command console.

`Dock` and the permanent scene manager were removed from the normal workspace. Scenes are available through the rail's Session panel. The rail opens its panel toward the canvas. Display and Color reuse the established renderer-neutral presentation controls, and Session reuses the existing renderer-neutral scene controls. The other rail entries are explicitly marked transitional in the inventory; no unsupported scientific behavior is represented as complete.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx playwright test tests/e2e/final-rearchitecture-shell.spec.ts --config playwright.config.ts` — 2 passed.
- Visual inspection: `evidence/SLICE_A_EMPTY_WORKSPACE.png` (`FCFF9618CCF7891127CFACADA2EB46BF1BDFB49CE951C29AAFD8ED58AFF4A4F3`).

The baseline evidence remains at `evidence/BASELINE_WORKSPACE.png`; this slice intentionally does not claim completion of the remaining rail panels, universal data adapters, or PyMOL conformance expansion.
