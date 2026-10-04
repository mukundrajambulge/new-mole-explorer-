# Open blockers

## B1 — RDKit native module blocked by host code-integrity policy

Windows Code Integrity events 3077 and 3033 block the unsigned pinned `rdkit\rdBase.pyd` under enterprise signing-level requirements. CPython and pip work, but RDKit cannot be imported. The allowed chemistry operation cannot run under the approved toolchain on this host. Resume only after the device policy admits an authorized pinned RDKit binary; do not disable or bypass Code Integrity and do not substitute another chemistry engine.

## Work not started because B1 is a hard stop

The synthetic control, CIF parsing, graph construction, chemical-state materialization, driver/profile sealing, any AddHs call, prepared-state envelopes/instances, SearchRegion, and full-pose direct/grid validation were not run or produced. A final independent scientific-acceptance review of execution outputs cannot be completed because those outputs do not exist; the blocked-state evidence-package audit passed. Source copies and their manifest are verified but unused by chemistry.
