# Open blockers

## B1 — RDKit native module blocked by host code-integrity policy

Windows Code Integrity events 3077 and 3033 block the unsigned pinned `rdkit\rdBase.pyd` under enterprise signing-level requirements. CPython and pip work, but RDKit cannot be imported. The allowed chemistry operation cannot run under the approved toolchain on this host. Resume only after the device policy admits an authorized pinned RDKit binary; do not disable or bypass Code Integrity and do not substitute another chemistry engine.

## B2 — Deterministic fixture replay exceeds closed one-run authorization

AUTH04 authorizes exactly one 3DMX/BNZ bootstrap and its standalone prompt forbids a second fixture run/replay. Integrated task §25 requests a repeat, but the task also says the owner authorization record is closed and authoritative. No explicit owner-record amendment exists. Before a second fixture run, record an explicit owner amendment or revise the replay acceptance condition while preserving the one-run boundary.

## Work not started because B1 is a hard stop

The synthetic control, CIF parsing, graph construction, chemical-state materialization, driver/profile sealing, any AddHs call, prepared-state envelopes/instances, SearchRegion, full-pose direct/grid validation, and final independent evidence review were not run or produced. Source copies and their manifest are verified but unused by chemistry.
