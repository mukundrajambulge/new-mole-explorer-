# MOLEXPLORER Final Scientific Re-architecture Baseline

**Captured:** 2026-09-12  
**Repository root:** `C:\Users\mukun\Desktop\molecular-workstation`  
**Remote:** `new-origin` → `https://github.com/mukundrajambulge/new-mole-explorer-.git`  
**Campaign branch:** `feature/final-scientific-ui-pymol-conformance`  
**Baseline SHA:** `3cb632770b8be70a3fc45c4809706c0b58f8a6cb`  
**Worktree at branch creation:** clean

## Acceptance ancestry

`3cb6327` descends from the accepted closure `bf742ff896a289492990744be9f34ec1898c54b3` through the previous autonomous-conformance campaign. The immediately preceding campaign report is `verification/autonomous-pymol/FINAL_AUTONOMOUS_PYMOL_CAMPAIGN_REPORT.md`; it records a bounded PyMOL-compatible surface, 120/120 Chromium E2E tests, no executable PyMOL runtime, CEALIGN unavailable, and docking/HTS not started.

## Environment

- Windows 11 Pro 10.0.26200, 64-bit
- Node `v24.14.1`; npm `11.11.0`; Python `3.14.2`
- Playwright `1.62.1`; Chromium browser target
- Intel Core i5-12500H (12 cores, 16 logical processors); 16,781,881,344 bytes RAM

## Real-app baseline inspection

The local app launched successfully at `http://localhost:3101/molstudio` and the API reported connected. Before any source change, visual inspection found that the current presentation does **not** meet the approved re-architecture:

- the permanent `NATIVE LIFECYCLE / Scenes` block occupies the lower right workspace;
- the console is expanded by default and consumes vertical canvas space;
- the Display menu opens an in-flow presentation pane instead of a permanent far-right rail with panels opening inward;
- internal labels such as `R08 STRUCTURAL ANALYSIS`, `ORACLE PENDING`, `CANONICAL`, and `PRESENTATION` are exposed in the normal UI;
- import copy advertises only PDB/mmCIF;
- the Dock menu is visible despite docking being unavailable.

These are baseline findings, not regressions to suppress. The campaign must replace them while retaining the accepted scientific behavior.

## Known scientific limits inherited from the previous campaign

- Executable pinned PyMOL oracle unavailable in this environment.
- CEALIGN registered but runtime unavailable.
- PSE/PZE, movie/imaging, docking, and HTS remain unimplemented or reference-only.
- XL/XXL stress cases were bounded; no fabricated performance claims are allowed.

## Baseline evidence

`evidence/BASELINE_WORKSPACE.png` is a local Playwright capture of the launched workspace. It is retained until remote archival is verified.
