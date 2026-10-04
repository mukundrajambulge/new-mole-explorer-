# Cumulative regression report

## Current D3-CLOSURE-EXEC-01 continuation

All required fixture and regression steps completed on the isolated continuation branch from exact base 783aa166d9d5790f798bff41444d6ba0fac7bd27. The original dirty checkout was preserved.

| Scope | Result |
|---|---|
| Source/profile completeness | PASS: 164/164 residues; 51/51 state-sensitive side chains; 5/5 altloc groups; 2 termini; 418/418 components; no extra or unlisted selected state |
| Hydrogen-only preparation | PASS: two runs, same canonical scientific payload SHA-256 212468a368eed75d9522819cb2f8d898d26167001f5dc9af7846fc4a79e1298f |
| Heavy-atom invariance | PASS: 1,306 receptor and 6 ligand heavy atoms unchanged bitwise; no additions, deletions, or remappings; maximum serialization displacement 0.0 Å |
| D2 states and independent digest replay | PASS: receptor, ligand, graph, identity, chemistry, coordinate, kinematic, prepared-state, and SearchRegion digests recomputed and matched |
| SearchRegion | PASS: all six cohort poses IN_DOMAIN; 11×22×10 nodes; below axis, center, and raw payload caps |
| Full-pose fixture direct/grid | PASS: six sealed-state poses, crystal/translation/rotation/combined/grid-phase/cutoff classes; five-term raw and weighted outputs retained; zero fallback on OOD |
| Pose order | PASS: no ties, no reversals, zero rank displacement |
| Workspace unit tests | PASS: 47 files, 254 tests (web 34 files/156; API 13 files/98); D1 contracts 14, D2 preparation 11, D3-TOR 8 are included |
| D3-GRID contract tests | PASS: 1 file, 5 tests |
| Native direct scorer and scoring field | PASS: CMake/CTest 2/2 targets under WSL2 Ubuntu 24.04.5 / GCC 13.3.0 |
| Protected PyMOL browser suite | PASS: Playwright 3/3; all 40 protected screenshot hashes match their pretest bytes after restoring the two generated images |
| Typecheck / lint / build | PASS across API, app, web, and contracts |
| Synthetic full-pose smoke | PASS: five marked synthetic control poses; no fixture evidence attributed to control |

The production scoring implementation was not modified. Native C++ work in this package is an execution-only full-pose comparison harness linked to the unchanged repository scorer/field library. Build completed with pre-existing 3Dmol.js eval and large-chunk advisories.

## Preserved predecessor evidence

The earlier D3-GRID report records six native direct-scoring and six field fixture groups, resource evidence, D1/D2/TOR tests, repository regression, and the protected PyMOL browser suite. Historical Windows Code Integrity and v1.0 source/profile stop evidence remain preserved. The profile-completeness correction is separately authorized and does not alter the original record.

## Numerical acceptance status

No approved D3 direct-versus-grid approximation or ranking threshold was found. This report does not create one or substitute the 1e-10/1e-12 backend-equivalence tolerances. The six-pose error distributions and no-reversal result are measured evidence for D3-FINAL-01. The exact closure classification is PASS — ready for final D3 acceptance; it is not final D3 acceptance itself.
