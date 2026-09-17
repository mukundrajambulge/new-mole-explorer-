# LM-RESP-001 — responsive root grid collapsed the viewer

Status: **FIXED**

At a 720×800 viewport the responsive media query assigned `.app-shell` a two-column grid even though the current React shell renders no navigation-rail child. The first grid item (`.app-main`) therefore received only 56px of width, and the molecular canvas reported a zero-width client rectangle after loading the mini-protein fixture.

The fix keeps `.app-shell` single-column at both responsive breakpoints. The existing workspace rule then collapses the side column and leaves the canvas plus scientific rail in the available width.

Evidence:

- Before: `LM-RESP-001__before__mini-protein-720x800.png`
- After: `LM-RESP-001__after__mini-protein-720x800.png`
- Focused test: `tests/e2e/g1c-visualization.spec.ts:113` — PASS

