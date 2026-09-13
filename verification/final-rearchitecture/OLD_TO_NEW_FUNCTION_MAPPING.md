# Old-to-new function mapping

| Previous surface | Current location | Canonical route | Status | Evidence |
| --- | --- | --- | --- | --- |
| Permanent lifecycle/scenes block | Session rail; File save/load | Scene/session services | PASS | AT-FSR-A-002; R09 suites |
| Expanded command workspace | Collapsed bottom Command Console | Tokenizer → dispatcher → state | PASS | AT-FSR-C-001 |
| PDB/mmCIF import | File Open/Import and Add Structure | Structure ingestion adapters | PASS, expanded | B/G ingestion suites |
| Protein/ligand/water display | Display rail | Presentation actions | PASS | R01–R06 suites |
| Global and scoped color | Color rail | ColorRegistry and presentation actions | PASS | selection closure |
| Selection grammar | Select rail and Console | Selection engine | PASS, bounded | AT-FSR-F-001; selection matrix |
| Distance/angle/dihedral | Measure rail | Measurement objects | PASS | V-FINAL suites |
| H-bonds/contacts/clashes | Analyze and Ligand rails | Structural analysis | PASS, bounded | AT-FSR-D-001; AT-FSR-I-001 |
| RMSD/alignment | Analyze alignment workflow | Fitting analysis service | PASS, oracle pending | R08 suites |
| R07 editing | Edit rail | Scientific revision/history | PASS | AT-FSR-E-001; R07 suites |
| Fit/center/orient/projection | View and Display panels | Camera controller | PASS | Gate 02 |
| Object visibility/focus | Objects & Selections | Workspace object state | PASS | AT-FSR-H-001 |
| Docking/HTS | No active route | None | Deferred | Explicitly not started |
| Sequence/maps/trajectories | File → Import dialog; typed center viewers | Biological adapter registry → sequence/map/trajectory/topology/SMILES viewers | PASS, bounded | AT-FSR-J-001–011; adapter tests; BIOLOGICAL_DATA.lock.json |
| Full binary trajectory playback | No active route | Future Movie/States subsystem | Planned | PYMOL_MOVIE_IMPLEMENTATION_PLAN.md |
