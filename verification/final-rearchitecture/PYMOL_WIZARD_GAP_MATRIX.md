# PyMOL wizard gap matrix

This matrix keeps wizard work separate from the verified molecular core. No
wizard is exposed as an active placeholder in the normal UI.

| PyMOL functionality | Usefulness | Existing Mole capability | Required architecture | Risk | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Measurement wizard | Guided distance/angle/dihedral setup | Measure rail and console already create revision-bound measurement objects | Step state, atom-pick validation, canonical measurement actions, cancel/undo | Medium: partial measurements must not mutate state | P1 | PLANNED |
| Pair fitting wizard | Select mobile/target pairs before `pair_fit` | Analyze fitting service accepts explicit correspondence | Multi-step selection scopes, correspondence audit, preview, apply transaction | High: mismatched identities or coordinate frames | P1 | PLANNED |
| Protein mutagenesis | Guided residue replacement | Replace Atom is bounded; no residue mutagenesis workflow | Chemistry-aware residue templates, provenance, revision history, validation | High: chemistry and force-field assumptions | P2 | PLANNED |
| Nucleic-acid mutagenesis | Guided base editing | No nucleic mutagenesis action | Typed residue templates and canonical topology edits | High: base chemistry and alternate conformers | P3 | PLANNED |
| Density wizard | Map inspection and contour setup | DX/MRC/CCP4 typed map viewer exposes grid/slice metadata | Contour thresholds, map/structure registration, map scene state | High: registration and units must remain explicit | P2 | PLANNED |
| Label wizard | Safe label creation | Label expression parser and label projection are implemented | Guided expression builder with preview and safe token validation | Medium: expression escaping and stale references | P2 | PLANNED |
| Charge wizard | Charge inspection/assignment | Source partial-charge datasets are validated when present | Provenance-bound model selection and explicit write transaction | High: never infer or silently overwrite charges | P3 | PLANNED |
| Structure-editing wizard | Guided build/edit steps | Edit rail supports bounded atom, bond, and hydrogen operations | Transaction plan, preview, chemistry validation, exact undo/redo | High: partial topology commits | P1 | PLANNED |

Promotion rule: implement one wizard at a time only after its state contract,
scientific validation, visual evidence, and regression gate exist. Wizard work
does not authorize docking or HTS.
