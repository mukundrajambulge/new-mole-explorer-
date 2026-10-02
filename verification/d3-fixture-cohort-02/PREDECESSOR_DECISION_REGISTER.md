# Predecessor decisions carried forward

The cohort starts at exact predecessor `fc687c5aebab248cf8f0a58631b6cfe78420d30c` and follows its `verification/d3-4w52-src-01/NEXT_FIXTURE_STRATEGY.md`. The existing rejection evidence is preserved and not reopened as a candidate-search task.

| Prior candidate or lane | Carried-forward disposition | Reason relevant to this cohort |
|---|---|---|
| 181L / BNZ | Rejected | Sample genotype/construct unresolved against UniProt; substitutions T54, A97, A99 and residues 163–164 unresolved. |
| 3ATL / BEN | Rejected | Binding-site water network is material, while CORE_DRY_V1 has no water representation. |
| 4W52 / BNZ | Retired | R12G/I137R origins, tag cleavage/retention, L164 terminal chemistry, and alternate occupancy/state unresolved. |
| D3-EXT-FIX-01 | Closed, no candidate selected | 103 screened, 93 quick excludes, 10 detailed, four finalists. 4W52 had strongest geometry but unresolved source; 5JWT incomplete; 4EMN/7FEZ had ligand-state ambiguity. No result is reused as a positive fixture. |

The current review searched exact `RTL` complex entries in a distinct, bounded cohort. It selects 9I7O only for a later, explicit preparation-authorization decision. Existing project gate states remain unchanged: full D3 HOLD, D4 BLOCKED, `DOCKING.RUN` unavailable.
