# Final D3 Blocker Register

| Historical/current blocker | Classification | Final evidence/disposition |
|---|---|---|
| D3-FP-01 candidate incompleteness; 181L/BNZ identity/construct and omissions | CANDIDATE-SPECIFIC / NO LONGER APPLICABLE | Not the selected fixture. No canonical D3 requirement requires multiple fixture candidates. |
| 181L/BNZ, 3ATL/BEN, 4W52/BNZ and 9I7O/RTL candidate rejections | CANDIDATE-SPECIFIC / NO LONGER APPLICABLE | Retained as historical evidence; active fixture is 3DMX/BNZ. |
| v1.0 source/profile incompleteness at ASN68, ASP72 and ARG76 | RESOLVED | Authorized v1.1 profile selects complete coherent A conformers and preserves approved chemical states; 164/164 residues and 418/418 components pass. |
| Preparation/replay never started in the v1.0 stop record | SUPERSEDED | Later v1.1 closure ran two pinned preparations, sealed states and replayed canonical digests. The old blocker file is a historical checkpoint. |
| Windows CPython/RDKit load blocked by Code Integrity | RESOLVED | Owner-authorized WSL2 Linux runtime loaded the pinned CPython/RDKit versions; no host security policy was changed. |
| Deterministic hydrogen-only preparation and heavy-atom invariance | RESOLVED | Two identical payload digests; zero heavy-atom additions, deletions, remappings, bond changes or coordinate-bit changes. |
| Direct/grid full-pose evidence absent during D3-SCI-04 research | SUPERSEDED | Later D3-CLOSURE-EXEC-01 records six sealed poses and machine-readable term/results outputs. D3-SCI-04 remains preserved research evidence. |
| Maximum-field production serializer/resource proof absent from D3-SCI-04 | SUPERSEDED | Implemented C++ field measurements in `RESOURCE_VALIDATION.md` and continuation output pass all four resource ceilings. |
| No pre-approved universal direct/grid approximation threshold | RESOLVED | Canonical D3-GRID v1.2 states no threshold is introduced; owner explicitly authorizes final acceptance of fixture-bounded measured evidence. No universal bound is claimed. |
| Final-mode selection and Q-score tie semantics | DEFERRED BY ACCEPTED ROADMAP | Current Roadmap assigns search/output modes and result semantics to D4/D5. They were not run in D3. |
| Separate pinned PyMOL executable oracle and a new manual retest | DEFERRED BY ACCEPTED ROADMAP | Existing PyMOL governance retains them; protected browser regressions/hashes pass and the D3 Roadmap only requires cumulative protected regression. |
| Pre-existing npm audit advisories (6 total: 3 moderate, 2 high, 1 critical) and 3Dmol.js eval / bundle-size build advisories | DEFERRED BY ACCEPTED ROADMAP | `npm ci`/`npm audit` on the final lane reports existing lockfile issues in Vitest/Vite dependency paths, brace-expansion, @vitest/mocker, esbuild and vite-node; the closure changed no dependency manifests or lockfiles. The critical Vitest fix requires a major upgrade; no D3 policy makes these existing development-dependency advisories a D3 acceptance blocker, and unrelated upgrades were excluded. Existing build advisories also remain. |
| AT-0141, AT-0146 and AT-0204 Gate D3 versus Roadmap/PHD-V2-15 D5/D6 authority mismatch | DEFERRED BY ACCEPTED ROADMAP | Their current Final Acceptance Specification labels say Gate D3 while the current Roadmap sequences the work into D5/D6. The table dispositions follow the Roadmap, but no approved amendment reconciling the labels was found; this remains an explicit traceability conflict and these tests are not claimed complete in D3. |
| D4-PREFLIGHT-01 contract-freeze package | DEFERRED BY ACCEPTED ROADMAP | No local checkout/worktree or Drive result found. D4 is not authorized under this HOLD; no preflight reference can be rebased. |
| AT-0058 / REQ-0058: prepared-state identity must include downstream typing/scoring dependencies | STILL BLOCKING | Prepared-state hash has no downstream dependency refs; field identity binds them separately. No superseding amendment or test closes this mandatory Gate D3 requirement. |

AT-0058 is the only blocker classified `STILL BLOCKING`; it is mandatory, so the definitive disposition is HOLD. No further D3 gate is proposed.
