# D3-CLOSURE-EXEC-01 report

**Disposition:** `D3-CLOSURE-EXEC-01 HOLD — HARD SCIENTIFIC OR NUMERICAL FAILURE`

**Current blocker:** the verified 3DMX source has three additional A/B polymer alternate-location groups that the owner-approved preparation profile does not resolve. The frozen profile approves coherent A plus common atoms only for MET106 and GLU108. Selecting A at ASN68, ASP72, and ARG76 would change the approved coordinate-state/profile content; preserving both alternatives or dropping their atoms would also change the input state. The hash-gated preflight therefore stopped before receptor graph construction and before any fixture molecule was supplied to RDKit. The chemistry workflow cannot be executed faithfully under the current authorization.

The Windows Application Control restriction was an execution-host restriction, not evidence of a molecular or numerical failure. The owner-authorized Linux relocation resolved that restriction: the exact pinned CPython 3.13.16 and RDKit 2026.03.6 runtime loads and passes safe synthetic controls. It does not resolve the source/profile coordinate-state conflict. No policy was weakened, no alternate chemistry engine or RDKit release was used, and the approved alternate policy was not extended.

## Completed in this continuation

- Continued from `feature/d3-closure-exec-01` with the predecessor closure evidence intact.
- Built and captured a private CPython 3.13.16 x86-64 runtime in existing WSL2 Ubuntu 24.04.5; installed the exact RDKit 2026.03.6 Linux wheel and hash-pinned dependencies offline. The Linux wheel is the PyPI `rdkit` artifact; its metadata identifies `kuelumbus/rdkit-pypi` as the wheel packaging project. It is not described as upstream-signed. Runtime and artifact identities are in `LINUX_RUNTIME_RECORD.md`.
- Reviewed pinned RDKit 2026.03.6 source/API semantics for the approved `Chem.AddHs` signature, `skipQueries` default, and hydrogen-coordinate operation. The review is bounded to API/operation semantics and does not claim Windows/Linux binary equivalence.
- Ran safe synthetic ethane AddHs and aromatic benzene AddHs controls twice in separate processes. Both controls passed with identical canonical signatures across their two runs. Query atom and query bond guards rejected their test inputs. Heavy-atom coordinates/bonds remained unchanged and only expected hydrogens were added.
- Rehashed all six source artifacts on Windows and inside WSL; byte lengths and SHA-256 values matched the frozen manifest. The parser verifies each source hash before parsing the same bytes in memory.
- Ran a fail-closed hash-gated 3DMX/BNZ source/profile preflight. It found alternates at ASN68 (A .70/B .30), ASP72 (A .80/B .20), and ARG76 (A .60/B .40), in addition to the already approved MET106 and GLU108 groups. It rejected the first unresolved group at ASN68 before accepting a receptor atom graph. Row-level evidence is `runtime_logs/linux/source-altloc-preflight.json`; the disposition is `SOURCE_PROFILE_MISMATCH.md`.
- Preserved the predecessor code-review, independent blocked-state evidence-review, and 47-file/254-test regression evidence. No application scoring or capability code changed in this continuation.

## Not performed

No fixture-derived graph was supplied to RDKit and no fixture `Chem.AddHs` call occurred. No run configuration or sealed run-input record was created. No receptor or ligand preparation, heavy-atom invariance measurement, hydrogen provenance output, prepared-state/envelope sealing, SearchRegion, deterministic fixture replay, direct/grid scorer evaluation, full-pose statistics, or fixture-specific resource measurement was produced. Existing header-only pose tables remain empty. Safe synthetic controls are not fixture evidence.

The single-use owner-approved preparation remains unconsumed. Regressions from the corrected TOR parser are preserved; this continuation made no application code changes and did not repeat the repository regression commands. Fixture preparation/full-pose regression tests could not run because the fixture state is unresolved.

## Required disposition

Do not infer the three unlisted residue states from the unique maximum occupancy alone. A written owner decision must either extend the preparation profile to explicitly select coherent A at ASN68, ASP72, and ARG76 for this fixture, or retain the existing authorization and stop. The previous continuation requested that exact choice; until it is answered, the frozen profile and its authorization remain unchanged. This is an outstanding resolution inside D3-CLOSURE-EXEC-01, not a new D3 stage or gate.

The only allowed successful classification is not supported. D3-FINAL-01 is not ready; D4 remains blocked and `DOCKING.RUN` remains unavailable.
