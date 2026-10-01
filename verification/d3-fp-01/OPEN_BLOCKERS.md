# Open blockers

This lane is HOLD until the required scientific decisions and evidence are recorded.

| Blocker | Why it blocks admission | Smallest resolution |
|---|---|---|
| No existing sealed pair | No D2 PreparedReceptorState + PreparedLigandState pair with canonical state digests was found in repo or current Drive evidence. | Approve or reject a candidate for one development fixture, then separately prepare under an authorized profile. |
| Candidate selection | 181L/BNZ is proposed primary; 3ATL/BEN conditional backup only. Neither is approved as the lane's state. | Owner records selection or rejection with scope limited to one development fixture. |
| Receptor identity and construct | 181L construct observations T54/A97/A99 conflict with L99A annotation; exact accepted construct is unresolved. | Structural-biology reviewer validates source construct and assembly/model/chain mapping; owner approves. |
| Receptor missingness and coordinates | 181L lacks ASN163/LEU164; other candidates have missing atoms, residue coverage gaps, or alternate conformers. | Document exact keep/exclude/repair policy from evidence and freeze coordinate state; no silent modeling. |
| Receptor chemistry | pH, termini, histidine/protonation, disulfides, and explicit hydrogens/orientations are not authorized. | Owner and independent reviewer approve exact state policy and pH authority. |
| Components | Waters, chloride, HED, ions/cofactors, and candidate-specific components lack a fixture-bound role policy. | Approve explicit component inclusion/exclusion with provenance. |
| Ligand state | No admitted source-to-atom mapping, chemical/coordinate state, charge/bond/stereo resolution, typed ligand or kinematic state. | Approve exact component and state; preserve immutable heavy-atom coordinates under a recorded rule. |
| Toolchain/profile | D3-RA-01 tool checks are synthetic research, not an accepted production preparation profile or lock. | Approve tool names, exact versions and hashes, platform/container digest, settings, profile IDs and validation. |
| Search and experiment tuple | No SearchRegion or bound scoring/typing/grid/numeric/search/resource/result digest tuple exists for a candidate. | Freeze these exact objects after the state pair is admitted. |
| Independent review and ownership | No named reviewer or final owner authorization for state generation is present in reviewed evidence. | Record named, dated approvals and reviewer findings before running preparation. |
| Full-pose path consumption | No frozen states exist to demonstrate direct and grid consumers load the identical geometry and experiment tuple. | After authorization, run only read-only loadability verification against the same frozen state. |

The source and contract evidence is linked in D3_FP_01_REPORT.md and expanded in PREPARATION_AUTHORIZATION_MINIMUM.md. This finite HOLD does not indicate a conflict among controlling contracts.
