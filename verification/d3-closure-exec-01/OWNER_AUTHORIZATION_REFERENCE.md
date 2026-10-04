# Owner authorization reference

## Frozen authorization

Source: `verification/d3-prep-auth-04/OWNER_AUTHORIZATION_RECORD.md` in verified AUTH04 closeout commit `2e05be567d96592e866ab13acb161c9eb3ae2953`, which is the base of this closure branch.

The owner authorized exactly one development-only 3DMX/BNZ bootstrap preparation under `ME_DOCKING_V1_3DMX_BNZ_PREP_RDKIT_2026_03_6_HONLY_1_0`. It is single-use and expires after the completed run, material source/profile/toolchain change, or owner revocation. The authorization excludes production use, structural repair, minimization, scoring, grid/pose evaluation, docking, D4, PyMOL, and `DOCKING.RUN`.

The approval covers the stated chemical state, GLU128− correction, pH proxy interpretation, component/alternate policy, pinned CPython/RDKit versions, H-only operation, and heavy-atom invariants. It is not D2/D3 acceptance.

## Deterministic replay status

AUTH04 lists deterministic replay, hydrogen-parent provenance, and the zero-change heavy-atom invariant as mandatory execution preconditions. Integrated closure task §25 directs running preparation again from the same byte-exact inputs and profile, with identical canonical outputs/digests. This package makes no claim that fixture replay passed or that any preparation use was consumed. The exact pinned Linux runtime imported successfully and repeated safe synthetic AddHs controls passed, but the hash-gated fixture preflight stopped at unapproved alternate coordinate groups before any fixture graph reached RDKit.

The required fixture replay remains outstanding with the other chemistry execution steps. Repeated synthetic controls are runtime evidence only and cannot substitute for fixture replay.
