# G1C representation capability matrix

The canonical representation masks are `LINES`, `STICKS`, `SPHERES`, `CARTOON`, `RIBBON`, `SURFACE`, `MESH`, `DOTS`, `NONBONDED`, and `NB_SPHERES`. Stable atom IDs and canonical bond IDs are the only targets. Lines and sticks consume `CanonicalBond`; no distance-based bond inference is performed.

| UI style | Stable profile | Target / contributors | Renderer projection | Status |
| --- | --- | --- | --- | --- |
| Line | `canonical-bond-lines.v1` | active atoms + canonical bonds | 3Dmol `line` | SUPPORTED |
| Stick | `canonical-bond-sticks.v1` | active atoms + canonical bonds | 3Dmol `stick` cylinders | SUPPORTED |
| Ball-and-Stick | `canonical-stick-plus-small-sphere.v1` | canonical bonds + all eligible atoms | sticks + 0.28-radius spheres | SUPPORTED |
| Space-Filling | `canonical-element-vdw-full-radius.v1` | all eligible atoms | full-radius atom spheres | SUPPORTED |
| Van der Waals Surface | `surface.vdw.element-vdw.v1` | target + canonical coordinate occluders | 3Dmol native surface | SUPPORTED_WITH_LIMITATIONS |
| Solvent-Accessible Surface | `surface.sas.element-vdw.probe-1.4A.v1` | target + canonical coordinate occluders | 3Dmol native surface with explicit probe | SUPPORTED_WITH_LIMITATIONS |
| Solvent-Excluded Surface | `surface.ses.element-vdw.probe-1.4A.v1` | target + canonical coordinate occluders | 3Dmol native surface with explicit probe | SUPPORTED_WITH_LIMITATIONS |
| Mesh | `surface-mesh.v2` | target + canonical coordinate occluders | application-native exposed VDW sample points joined as a wire/lattice network | SUPPORTED_WITH_LIMITATIONS |
| Dots | `surface-dots.v1` | target + canonical coordinate occluders | deterministic canonical exposed-point projection | SUPPORTED_WITH_LIMITATIONS |
| Dot Surface | `surface-dot-surface.v1` | target + canonical coordinate occluders | deterministic probe-expanded exposed-point projection | SUPPORTED_WITH_LIMITATIONS |
| Cartoon | `canonical-polymer-cartoon.v1` | canonical polymer hierarchy/order | 3Dmol cartoon | SUPPORTED_WITH_LIMITATIONS |
| Ribbon | `canonical-polymer-ribbon-oval.v1` | canonical polymer hierarchy/order | 3Dmol cartoon `style=oval` | SUPPORTED_WITH_LIMITATIONS |
| Trace | `canonical-polymer-trace.v1` | canonical polymer/backbone targets | 3Dmol cartoon `style=trace` | SUPPORTED_WITH_LIMITATIONS |
| Putty | `canonical-polymer-putty-bfactor.v1` | polymer atoms with source B-factor | 3Dmol cartoon `style=putty` | SUPPORTED_WITH_LIMITATIONS |
| Non-bonded (crosses) | `canonical-zero-bond-crosses.v1` | atoms with zero canonical bonded neighbors | 3Dmol `cross` | SUPPORTED_WITH_LIMITATIONS |
| Non-bonded (spheres) | `canonical-zero-bond-spheres.v1` | atoms with zero canonical bonded neighbors | small 3Dmol spheres | SUPPORTED_WITH_LIMITATIONS |

Presets are explicit and intentionally distinct: `WIRE = LINES + NONBONDED`, `LICORICE = STICKS + NB_SPHERES`, and `BALL_AND_STICK = STICKS + SPHERES`. A target with no canonical bonds reports `No authoritative bond geometry is available for this target.` rather than receiving inferred geometry. Missing B-factors report `PUTTY_PROPERTY_UNAVAILABLE` and do not fabricate a scalar. Large selections retain complete canonical membership but cap per-atom highlight markers for renderer responsiveness.
