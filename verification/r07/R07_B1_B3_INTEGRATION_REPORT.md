# MOLEXPLORER R07 B1+B2+B3 Integration Report

## Scope

This report records the final R07 integration of the visualization closure baseline with the B1, B2, and B3 editing line. The authoritative local checkout was `C:\Users\mukun\Desktop\molecular-workstation`; no R08 or docking work was included.

## Git topology

| Item | Value |
| --- | --- |
| Visualization base | `fix/visualization-final-closure` at `c677c61131eaa0b363d93edd3ec12479cc711db0` |
| B3 source | `feature/r07-hydrogen-picked-editing` at `dba3518f8b9690d283ab4dbc0a715942de775cac` |
| Merge base | `5aced1b45f8997a9efef90928e6da306e53989e9` |
| Integration branch | `integration/r07-b1-b3` |
| Merge strategy | Real `--no-ff` merge of the B3 source into the visualization baseline |

There were no textual merge conflicts. Semantic integration fixes preserved object-scoped projections, routed the active object identity through the canvas adapter, synchronized camera/background/labels after projection changes, guarded asynchronous surface generations and stale handles, made mesh-generation diagnostics deterministic, and aligned the presentation assertion with the canonical `Delete Selected` control.

## Verification gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Typecheck | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint`, zero warnings |
| Unit | PASS | 116 web tests + 22 API tests |
| Build | PASS | `npm run build` |
| Focused R07 + visualization + selection | PASS | 42/42 |
| Targeted presentation regressions | PASS | 13/13 |
| Full E2E | PASS | 89/89 |
| Rotation/performance | PASS | G1C-PERF-001, camera suite, V-FINAL rapid-switching and cache suites |
| Visualization/selection closure | PASS | G1C visualization, V-FINAL, multi-object/state, and selection closure suites |

The six inherited post-merge presentation failures were resolved without weakening test coverage: stale edit wording, label eligibility/cardinality, camera projection synchronization, surface/mesh bookkeeping, rapid representation switching, and stale surface-ready state.

## Manual test build

The live build was started from the integration checkout with `npm run dev` and exercised at:

`http://localhost:3101/molstudio`

Manual results:

- B1: loaded `mini-protein.pdb`, ran `select id 1` and `edit_test`, then used the Edit ribbon Undo and Redo controls. History returned to root and back to the R07 child revision.
- B2: loaded `r07-b2-topology.pdb`, selected atom 2, used Edit → Delete Selected, and verified 4 atoms/2 bonds → 3 atoms/0 bonds → exact undo → exact redo.
- B3: loaded `r07-b3-explicit-h.pdb`, switched to Van der Waals Surface, By Molecule color, Orthographic projection, ran `h_fill id 1`, and verified 5 atoms/4 bonds with a ready surface; exact undo and redo restored 2 and 5 atoms respectively.
- Cross-feature stress: representation, color, camera, surface, scientific edit, undo, and redo remained live in one session.

Committed evidence:

- [B1 live history](../evidence/r07-integration/b1-history.png)
- [B2 topology deletion](../evidence/r07-integration/b2-topology-delete.png)
- [B3 hydrogen + surface + camera](../evidence/r07-integration/b3-hydrogen-surface-camera.png)
- [Cross-feature redo](../evidence/r07-integration/cross-feature-redo.png)

## Known issues and oracle status

- `PYMOL_ORACLE_PENDING`: no independent PyMOL oracle comparison was run in this integration gate.
- The documented bounded/limited 3Dmol visualization profiles remain explicit in the UI and closure reports; this is not an integration regression.
- The selection closure report's external `byfragment` dependency remains pending.

## Release disposition

The integration branch is ready for user manual approval. It is not approved to merge to `main` until that approval is given.

### Current status

`GITHUB CI: PENDING UNTIL PUSH`

The final report is updated with the Actions result and run URL after the integration branch is pushed.
