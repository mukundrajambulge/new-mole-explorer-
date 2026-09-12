# Slice D — Working Measure and Analyze rail panels

The Measure and Analyze rail buttons now open the established scientific controls directly. The left Objects & Selections panel no longer renders duplicate measurement or analysis controls.

- **Measure** starts Distance, Angle, or Dihedral atom-pick accumulation and lists persistent measurement objects.
- **Analyze** runs the existing H-bond, contact, clash, surface, and camera actions and presents analysis results.

Both panels use the existing canonical action handlers and renderer overlays. No new numerical algorithm was introduced during the relocation.

Verification: `AT-FSR-D-001` loads a real local protein, opens each panel from the rail, starts Angle measurement mode, runs H-bond analysis, and verifies the result panel. Visual evidence is `evidence/SLICE_D_ANALYZE_RAIL.png`.
