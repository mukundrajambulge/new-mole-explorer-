# Open blockers

## B1 — Pinned RDKit Chem API blocked by host Application Control

CPython 3.13.16, the pinned wheel metadata, and `rdkit.rdBase` currently load, but importing `rdkit.Chem` is blocked at the unsigned pinned `rdkit\Chem\rdmolfiles.pyd` with an Application Control error. Its SHA-256 matches the installed wheel `RECORD`; no code-integrity policy was changed. The required AddHs wrapper cannot run, and the safe synthetic control stopped before any molecular operation. Earlier `rdBase.pyd` failures with events 3077 and 3033 remain preserved. Resume only on a policy-approved host/runtime that loads the complete pinned RDKit modules; do not disable or bypass Application Control and do not substitute another chemistry engine.

## Work not started because B1 is a hard stop

The synthetic control, CIF parsing, graph construction, chemical-state materialization, driver/profile sealing, any AddHs call, prepared-state envelopes/instances, SearchRegion, and full-pose direct/grid validation were not run or produced. A final independent scientific-acceptance review of execution outputs cannot be completed because those outputs do not exist; the blocked-state evidence-package audit passed. Source copies and their manifest are verified but unused by chemistry.
