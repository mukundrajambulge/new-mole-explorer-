# D3-CLOSURE-EXEC-01 requirement traceability

| User request section | Status | Evidence / disposition |
|---|---|---|
| §§1–4 — continue same closure, preserve frozen decisions | SATISFIED | Continued exact base 783aa166d9d5790f798bff41444d6ba0fac7bd27 in the same package; did not reopen fixture, pH, component, chemistry, scorer, or capability decisions. |
| §5 — residue-by-residue omission cause | SATISFIED | PROFILE_OMISSION_ROOT_CAUSE.md records source atoms, alternate occupancies, missing-atom check, BNZ distances, local context, state sensitivity, and distinct omission cause for each residue. |
| §6 — full source/profile reconciliation | SATISFIED | 164-row matrix; 164/164 source residues, 418/418 components, 51 explicit side-chain states, both termini; no fourth omission. |
| §§7–10 — uniquely support ASN68/ASP72/ARG76 and bounded profile amendment | SATISFIED | ASN68 neutral CCD amide orientation retained; ASP72− and ARG76+ already determined by AUTH04; unique complete A maxima applied only under explicit bounded owner authorization. v1.0 preserved; v1.1 exact delta documented. |
| §11 — complete coverage before chemistry | SATISFIED | Same fail-closed source/profile validator passed before RDKit import and graph construction; no hidden defaults or unlisted state. |
| §§12–13 — pinned Linux runtime and byte-exact inputs | SATISFIED | WSL2 Ubuntu 24.04.5 x86-64, CPython 3.13.16, RDKit 2026.03.6; exact 3DMX/BNZ hashes verified before each run. |
| §§14–15 — hydrogen-only preparation and deterministic replay | SATISFIED | Two identical canonical preparation payloads; no heavy-atom addition/deletion/remapping/coordinate change; round-trip maximum 0.0 Å; hydrogen-parent manifests complete. |
| §16 — canonical SearchRegion and resource limits | SATISFIED | SearchRegion sealed; all six poses in-domain; interpolation halo and receptor support horizon recorded; 11×22×10 points, below axis and raw payload limits. |
| §§17–18 — deterministic same-state full-pose direct/grid evidence | SATISFIED | Six sealed fixture poses cover crystal, translation, rotation, combined, grid phase, and cutoff stress; all five raw/weighted terms and statistics recorded; no stochastic search. |
| §19 — numerical criterion handling | SATISFIED | No approved approximation/ranking threshold found; no threshold invented. D3-FINAL-01 recommendation is evidence-backed and scoped to the measured cohort. |
| §20 — cumulative regression | SATISFIED | Workspace 254 tests, D3-GRID contract 5, native CTest 2/2, protected PyMOL 3/3, typecheck/lint/build, profile validator, preparation/replay, D2 seals, and full-pose all pass. |
| §§21–22 — same package; no micro-gates | SATISFIED | All continuation evidence stays under verification/d3-closure-exec-01/. No new D3 stage, prompt, or intermediate gate was created. |
| §§23–24 — exact final classification | SATISFIED | PASS conditions are supported. No unresolved hard scientific, numerical, or regression failure remains. |
| §§25–26 — base, checksums, changed paths, clean worktree, final response | SATISFIED | Exact base and branch are verified; checksum/changed-path manifests, diff check, commit, and clean status are completed for this handoff. |

Final D3 acceptance remains D3-FINAL-01. D4 stays blocked; DOCKING.RUN remains unavailable.
