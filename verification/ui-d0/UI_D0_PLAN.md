# Mole Explorer UI-D0 Plan and Traceability Matrix

## Bounded implementation plan

1. Add a first-class Docking workspace route/state to the existing active App
   shell without replacing the Molecular workspace.
2. Add a bounded `apps/web/src/docking/` module for UI state, D2 adapter
   integration, input panels, workflow status, SearchRegion form state, and
   renderer-neutral SearchRegion projection.
3. Reuse the existing `MolecularCanvas` and its mounted
   `ThreeDMolViewerAdapter`; add only a presentation overlay path for draft or
   committed SearchRegion geometry.
4. Integrate the accepted D2 preparation/sealing seam through an explicit API
   adapter. The UI will not duplicate D2 validation or manufacture prepared
   scientific state.
5. Keep Run, Results, Jobs, Events, and future execution actions visibly
   unavailable unless accepted backend capability truth says otherwise. Do not
   create fake jobs, scores, poses, or results.
6. Add focused UI-D0 tests, camera/SearchRegion authority regression tests, and
   scope-negative assertions before running the inherited suites.

## Traceability matrix

| Requirement | Planned implementation | Evidence/test |
| --- | --- | --- |
| Dedicated workspace in active shell | App-level workspace mode and Docking workspace composition | navigation test; existing molecular smoke test |
| One viewer only | Docking workspace renders the existing `MolecularCanvas` | viewer reuse test; no second adapter mount |
| Receptor D2 state visibility | D2 snapshot adapter and explicit receptor panel | receptor state/blocker test |
| Ligand hierarchy visibility | Explicit identity, chemical, coordinate, prepared, and kinematic sections | ligand hierarchy test; PDBQT authority test |
| Mutable SearchRegion draft | six Å-valued form fields kept outside authoritative state | draft/commit test |
| Authoritative SearchRegion commit | explicit adapter call to the accepted D2 sealing pathway | commit response and digest test |
| Camera non-authority | overlay projection consumes region; camera actions do not mutate region | rotate/zoom/fit/center/orient/projection/resize test |
| Truthful capability/preflight | registry/backend-derived capability and fail-closed workflow states | capability negative test |
| `DOCKING.RUN` unavailable | preserve frontend registry and backend dispatcher reservation | direct UI/console/API negative tests |
| Durable JobStatus vocabulary | use existing command/job status contracts without new JobStatus values | contract and scope-negative tests |
| No D3 science | no scoring/search/pose/worker/GPU/HTS changes | changed-file manifest and negative audit |

## Research reconciliation

The implementation follows the authoritative P2-S08, IA-01, IA-03, IA-06,
IA-09, R-PYMOL-10, PHD-V2 requirements/acceptance/synthesis/workflow and
receptor/ligand/site documents. Scientific state remains distinct from
presentation, camera, renderer, request/job, and diagnostics state. Invalid,
ambiguous, unsupported, and stale outcomes remain first-class and fail closed.
