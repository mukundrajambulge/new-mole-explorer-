# D2 Fixture Catalog

The catalog preserves the authoritative historical fixture IDs and expected outcome classes from PHD-V2-02 through PHD-V2-05.

| Family | Count | Source | Runtime catalog |
|---|---:|---|---|
| REP-FX | 10 representative adapter cases | PHD-V2-02 | `apps/api/src/docking/d2FixtureCatalog.ts` |
| REC-FX | 30 receptor preparation cases | PHD-V2-03 | `apps/api/src/docking/d2FixtureCatalog.ts` |
| LIG-FX | 35 ligand preparation cases | PHD-V2-04 | `apps/api/src/docking/d2FixtureCatalog.ts` |
| SITE-FX | 30 SearchRegion cases | PHD-V2-05 | `apps/api/src/docking/d2FixtureCatalog.ts` |
| INT-FX-001..004 | 4 D1 regression cases | final acceptance specification | D1 accepted tests |
| INT-FX-005 | explicit receptor state | final acceptance specification | receptor seal contract |
| INT-FX-006 | ambiguous receptor protonation | final acceptance specification | explicit chemical-state blocker |
| INT-FX-007 | explicit ligand ChemicalState + 3D CoordinateState | final acceptance specification | ligand seal contract |
| INT-FX-008 | missing stereo/tautomer resolution | final acceptance specification | explicit chemical-state blocker |
| INT-FX-009 | SMILES-only pending explicit 3D | final acceptance specification | SMILES adapter boundary |
| INT-FX-010 | closed SearchRegion boundary | final acceptance specification | inclusive containment + one-ULP test |

The runtime catalog contains the full REC-FX/LIG-FX/SITE-FX ID ranges and representative REP-FX cases. Full scientific fixture payloads remain source-controlled evidence inputs; no fixture is allowed to introduce hidden chemical-state generation or a later-gate docking engine.
