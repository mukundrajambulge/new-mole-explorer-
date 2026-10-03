# Open blockers and scope boundary

## Fixture selection

No source or structural blocker remains for the selected 3DMX/BNZ pair under the current `CORE_DRY_V1` profile. The only remaining local state choices are preparation-decision items explicitly assigned to DEC-04: pH and protonation, hydrogens, deterministic toolchain, the remote components, the two remote majority-occupancy alternate residues, serialization/provenance, and geometry-only SearchRegion definition. They do not require another source-resolution or missing-atom gate.

The following authorization remains intentionally unmade: molecular preparation execution. Do not add hydrogens, choose production protonation, alter coordinates, create prepared receptor/ligand files, score the pose, build a field, or dock in this lane. Generate the candidate-specific DEC-04 prompt and let that decision gate identify any required owner/reviewer approval.

## Program state preserved

- PyMOL: PROTECTED.
- D1: ACCEPTED.
- D2: ACCEPTED.
- D3-TOR and D3-SCI: preserved.
- D3-GRID: bounded PASS.
- Full D3: **HOLD**; full-pose numerical validation remains incomplete.
- D4: **BLOCKED**.
- `DOCKING.RUN`: **UNAVAILABLE**.

This fixture selection neither accepts D3 nor starts D4. No scorer, PyMOL, or production code was changed.
