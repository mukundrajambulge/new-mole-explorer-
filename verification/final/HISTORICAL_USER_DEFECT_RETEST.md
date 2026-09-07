# Historical user defect retest

Campaign: final Molexplorer PyMOL acceptance  
Branch: `fix/final-pymol-manual-acceptance`  
Base: `617da648edd06c0cb6dc0632b57a9a2645d88bdc`

| Defect | Original symptom | Current reproduction steps | Current status | Root cause if still failing | Fix | Regression test | Screenshot | Final verdict |
|---|---|---|---|---|---|---|---|---|
| A | Ligand became monochrome and could not be recolored | Load 4DJW, set ligand color repeatedly, change global scheme, restore ligand override | PASS | — | Existing component color precedence retained | `selection-closure.spec.ts` component color test | `03-ligand-custom-color.png` | Retested and passed |
| B | Viewer lagged or hung during rotation | Load 4DJW, VDW, rotate and zoom repeatedly | PASS | — | Bounded renderer updates and surface coordination | `manual-gate-01-viewer.spec.ts` | `06-vdw-surface.png` | Retested and passed |
| C | Representation changed only part of molecule | Apply Cartoon → Stick → Mesh → Cartoon to protein | PASS | — | Canonical target directives cover the complete target | `g1c-visualization.spec.ts`, `manual-gate-03b-selection-presentation.spec.ts` | `04-protein-stick.png`, `07-mesh.png` | Retested and passed |
| D | Ligand representation appeared to do nothing | Change ligand representation with protein active | PASS | — | Component-scoped representation projection | `manual-gate-03b-selection-presentation.spec.ts` | `11-selection-plus-representation.png` | Retested and passed |
| E | Residue selection was tiny cyan lines inside Cartoon | Select residue 50 and inspect focus/overlay | PASS | — | Selection overlay uses an appropriate representation and focus | `manual-gate-03b-selection-presentation.spec.ts` | `08-residue-selection-focus.png` | Retested and passed |
| F | Representation changes broke selection highlight | Select chain, change representation and color, clear selection | PASS | — | Selection overlay is reapplied after presentation changes | `manual-gate-03b-selection-presentation.spec.ts` | `11-selection-plus-representation.png` | Retested and passed |
| G | Molecule looked cut or corrupted | Fit, center, orient, resize, and switch representations | PASS | — | Camera clipping and full-canvas sizing remain governed | `manual-gate-02-camera-viewport.spec.ts` | `13-console-overlay-full-canvas.png` | Retested and passed |
| H | Fit/Center were ineffective | Pan then invoke Center and Fit | PASS | — | Camera controller targets workspace bounds | `manual-gate-02-camera-viewport.spec.ts` | `15-perspective.png` | Retested and passed |
| I | Rotation pivoted around one atom | Rotate after global camera actions and selections | PASS | — | Camera pivot derives from workspace/object bounds | `manual-gate-02-camera-viewport.spec.ts` | `14-orthographic.png` | Retested and passed |
| J | Console caused horizontal viewer cutoff | Expand and collapse console at supported sizes | PASS | — | Console is an overlay over the viewer row | `final-pymol-acceptance.spec.ts` | `13-console-overlay-full-canvas.png` | Retested and passed |
| K | VDW surface was blank | Apply VDW and wait for ready state | PASS | — | Surface lifecycle reports ready only with accepted geometry | `manual-gate-01-viewer.spec.ts`, `v-final.spec.ts` | `06-vdw-surface.png` | Retested and passed |
| L | Rapid representation switching left stale surfaces | Switch dots → mesh → SAS → Cartoon | PASS | — | Surface request coordinator rejects stale generations | `v-final.spec.ts` | `07-mesh.png` | Retested and passed |
| M | Orthographic did not become orthographic | Toggle Projection mode and fit | PASS | — | Projection mode is applied to the renderer camera | `manual-gate-02-camera-viewport.spec.ts` | `14-orthographic.png` | Retested and passed |
| N | Custom labels had unsafe or unreliable behavior | Apply an unsafe expression, then a safe expression, then clear | PASS | — | Safe label parser rejects arbitrary expressions | `selection-closure.spec.ts` custom labels test | `17-labels.png` | Retested and passed |
| O | Analysis/Interaction panel alignment was inconsistent | Inspect panel alignment, scrolling, controls, and results at supported sizes | PASS | — | Final layout reserves a visible scene row and preserves readable ownership | `final-pymol-acceptance.spec.ts`, `selection-closure.spec.ts` | `32-final-cross-feature-workspace.png` | Retested and passed |

All A–O historical defects are classified. No additional in-scope fix remained after the final manual retest.
