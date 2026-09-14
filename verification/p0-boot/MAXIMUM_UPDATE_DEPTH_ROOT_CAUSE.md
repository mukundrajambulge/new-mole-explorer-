# MOLEXPLORER P0 boot runtime loop correction

Date: 2026-09-14  
Repository: `https://github.com/mukundrajambulge/new-mole-explorer-.git`  
Branch: `fix/p0-react-maximum-update-depth`  
Fix commit: `f775bbdd58e7db5be17a4ec53f6f24b2ad7a5815`

## Status

The P0 blocker is corrected in the local source and passes the complete Chromium acceptance suite. The reported React `Maximum update depth exceeded` failure could not be reproduced in the current checkout, so no failing DOM or React stack trace exists to attach. The root cause below is established by static control-flow audit of the active synchronization seam and by the before/after runtime matrix.

## Reproduction and evidence

The live stack was started with the repository dev command and remained healthy throughout validation:

| Service | Port | Result |
| --- | ---: | --- |
| Web | 3101 | listening and serving `/molstudio` |
| API | 8100 | listening and healthy |
| Landing/app | 3100 | listening and healthy |

The runtime matrix exercised:

- ten fresh `/molstudio` mounts and five reloads;
- fresh `/molstudio?demo=4DJW` boot;
- persisted project `project_1cc81696-e57b-4be1-b2fe-8e8995e7783e`;
- right-rail Display, Color, Select, Measure, Analyze, and Session panels;
- repeated Select all/Clear, Color/Display actions, console expand/collapse, and Fit;
- adding 1CRN to 4DJW and verifying two live renderer models.

The browser captured no `pageerror`, no console message containing `Maximum update depth`, and no uncaught React error in this matrix. Headless WebGL emitted only GPU-stall performance warnings. Because the failure did not occur, `verification/p0-boot/evidence/before/` is intentionally empty; an invented failure screenshot would misrepresent the evidence. After-state screenshots are in `verification/p0-boot/evidence/after/`.

## Root cause

`App` held the active presentation in global React state (`projection`) while each `WorkspaceObject` also held a presentation snapshot (`object.projection`). A `useLayoutEffect` synchronized the active global value back into `workspaceObjects` whenever the two object identities differed:

```text
user presentation action
  -> setProjection(next)
  -> layout effect observes projection/object mismatch
  -> clone active WorkspaceObject and setWorkspaceObjects(nextObjects)
  -> StructurePanel/MolecularCanvas reconcile new workspace identity
  -> another derived presentation/update reaches the same layout effect
  -> nested synchronous state write repeats until React reports
     “Maximum update depth exceeded”
```

This was a duplicate-state write-back cycle. The layout effect ran during React's synchronous layout phase, so StrictMode and renderer reconciliation made the cycle especially sensitive to identity changes. The cycle was not caused by a single panel button; any active presentation update could enter it.

The audited component and state seam is `App` in `apps/web/src/App.tsx`: `projection`, `workspaceObjects`, `workspaceObjectsRef`, `viewerWorkspaceObjects`, and the removed `useLayoutEffect` write-back. Explicit workspace actions still update durable object snapshots when a user or command changes an object. Those event-driven writes are not effects and do not form a render-to-state loop.

## Correction

The fix removes `projectionStateRef` and the `useLayoutEffect` write-back. `projection` is now the single authoritative active-object presentation. `viewerWorkspaceObjects` is a derived overlay that supplies that active projection to the viewer without mutating workspace state during render or layout:

```text
user presentation action
  -> canonical App projection state
  -> derived active overlay for MolecularCanvas
  -> UI/renderer
```

Inactive objects retain durable snapshots, and explicit activate/switch/save/recall/workspace actions continue to update those snapshots through their existing handlers. This preserves object identity and makes the data flow one-way.

## Regression coverage

The new test file `tests/e2e/p0-boot-runtime.spec.ts` provides three P0 checks:

1. ten fresh boots plus reload stress, with console/page-error guards;
2. ribbon persistence hydration plus invalid-record fallback;
3. 4DJW right-rail/panel/console stress, 1CRN add, and two-object renderer count.

Evidence captured by the P0 tests:

- `verification/p0-boot/evidence/after/00-boot-stable.png`
- `verification/p0-boot/evidence/after/persisted-ribbon-restored.png`
- `verification/p0-boot/evidence/after/panel-display.png`
- `verification/p0-boot/evidence/after/panel-color.png`
- `verification/p0-boot/evidence/after/panel-select.png`
- `verification/p0-boot/evidence/after/panel-measure.png`
- `verification/p0-boot/evidence/after/panel-analyze.png`
- `verification/p0-boot/evidence/after/panel-session.png`
- `verification/p0-boot/evidence/after/console-expanded.png`
- `verification/p0-boot/evidence/after/console-collapsed.png`
- `verification/p0-boot/evidence/after/two-object-workspace.png`

## Validation gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS (Vite warning only for the existing large 3D bundle and `eval` in 3Dmol) |
| `npm test` | PASS — 215 tests (150 web, 65 API) |
| Focused P0 suite | PASS — 3 tests in 2.9 minutes |
| Focused historical acceptance/IMP-PRES/multi-object suite | PASS — 19 tests in 3.7 minutes |
| Full Chromium E2E | PASS — 145 tests in 32.6 minutes |

## Delivery

The branch is kept separate from `main` and points at the exact requested remote. Local evidence is retained in this directory. Google Drive upload was not attempted because no authorized Drive connector is available in this session.

