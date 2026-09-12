# Historical defect matrix

The prior manual acceptance ledger classifies defects A–O as PASS. This campaign rechecked the changed shell and added regressions for the multi-object and ligand-rail issues.

| Defect | Original symptom | Root cause / correction | Automated evidence | Screenshot | Status |
| --- | --- | --- | --- | --- | --- |
| A | Ligand became monochrome | Component color precedence retained | selection closure | `03-ligand-custom-color.png` | PASS |
| B | Rotation lag or hang | Bounded renderer updates and surface coordination | Gate 01 | `06-vdw-surface.png` | PASS |
| C | Representation changed only partly | Complete canonical target directives | G1C and Gate 03B | `04-protein-stick.png` | PASS |
| D | Ligand representation appeared inert | Component-scoped projection | Gate 03B | `11-selection-plus-representation.png` | PASS |
| E/F | Selection was tiny or broke after style changes | Dedicated selection overlay reapplied after presentation changes | Gate 03B; AT-FSR-F-001 | `08-residue-selection-focus.png` | PASS |
| G–I | Fit, center, orient, or pivot failed | Camera derives from workspace bounds | Gate 02 | `14-orthographic.png; 15-perspective.png` | PASS |
| J | Console clipped the canvas | Console is an overlay over the viewer row | AT-FSR-C-001 | `13-console-overlay-full-canvas.png` | PASS |
| K/L | VDW blank or stale surfaces remained | Surface lifecycle and material coordination | Gate 01/02; surface tests | `06-vdw-surface.png; 07-mesh.png` | PASS |
| M | Orthographic toggle ineffective | Projection mode applied to renderer camera | Gate 02 | `14-orthographic.png` | PASS |
| N | Unsafe custom labels | Safe, non-evaluating label parser | selection closure | `17-labels.png` | PASS |
| O | Analysis panel alignment inconsistent | Reserved panel rows and readable ownership | final acceptance suites | `32-final-cross-feature-workspace.png` | PASS |
| P | Second object loaded but was not visible | Resize-time camera translation and primary-object framing avoid composed-selection regressions | AT-FSR-H-001; AT-FSR-H-000 | `SLICE_H_BOTH_VISIBLE_FIT_ALL.png` | PASS |
| Q | Ligand actions required advanced console knowledge | Dedicated Ligand rail routes selection and bounded diagnostics | AT-FSR-I-001 | local ligand gate | PASS |

The inherited detailed reproduction ledger is [HISTORICAL_USER_DEFECT_RETEST.md](../final/HISTORICAL_USER_DEFECT_RETEST.md). No docking or HTS defect was introduced or tested.
