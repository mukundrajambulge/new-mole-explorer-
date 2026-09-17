# 4V6F responsive report

The 4V6F-specific responsive render was not run because canonical import is blocked. The responsive layout regression was nevertheless reproduced and fixed with the mini-protein fixture:

- 720×800 before: canvas CSS width 0; app-main width 56px.
- 720×800 after: canvas CSS size 478×702; WebGL backing buffer 956×1404.
- Focused Playwright test: `G1C-UI-003` PASS.
- Before/after evidence: `evidence/16-defects-before/LM-RESP-001__mini-protein-720x800__FAIL.png` and `evidence/17-defects-after/LM-RESP-001__mini-protein-720x800__PASS.png`.

Canonical 4V6F responsive acceptance remains blocked by LM-IMP-001, not by the repaired root-grid defect.
