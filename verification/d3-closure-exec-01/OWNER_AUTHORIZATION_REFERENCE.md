# Owner authorization reference

## Frozen authorization

Source: `verification/d3-prep-auth-04/OWNER_AUTHORIZATION_RECORD.md` on the verified AUTH04 closeout branch, commit `64c75a2e52a7296477ad5e42b8a97351ae21d41` (the closure branch parent `2e05be567d96592e866ab13acb161c9eb3ae2953` contains the AUTH04 closeout evidence).

The owner authorized exactly one development-only 3DMX/BNZ bootstrap preparation under `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0`. It is single-use and expires after the completed run, material source/profile/toolchain change, or owner revocation. The freeze forbids a second fixture run/replay, production use, structural repair, minimization, scoring, grid/pose evaluation, docking, D4, PyMOL, and `DOCKING.RUN`.

The approval covers the stated chemical state, GLU128− correction, pH proxy interpretation, component/alternate policy, pinned CPython/RDKit versions, H-only operation, and heavy-atom invariants. It is not D2/D3 acceptance.

## Replay instruction conflict

The later integrated closure task §25 explicitly requests a second preparation run for deterministic replay. Its §2 also directs that the AUTH04 owner record remain authoritative and closed. The independent reviewer found no explicit sentence amending the one-run owner record. This execution therefore did not consume the single-use authorization and did not infer permission for the second fixture run.

Before replay, the owner record must explicitly authorize that second run, including its one additional `Chem.AddHs` invocation for the receptor and ligand. If the one-run boundary is to remain, the integrated replay acceptance condition must be changed by the task owner. Synthetic-control replay alone cannot establish fixture determinism.
