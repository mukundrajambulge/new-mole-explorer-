# 4V6F Selection Campaign — Scoped Commit Plan

Status: planning only. No commit, push, merge, or docking action was performed by this audit.

## Scope rule

The campaign began from `fix/lm-imp-001-canonical-large-ingestion` at `1b44780c214e83c4d864bb94ecd49132d59b09c3`. The authoritative starting-state record is `00-baseline/WORKTREE_BASELINE.json`. Any path present in that baseline is pre-existing to this campaign and must be preserved unless the owner explicitly reviews and stages it. Generated evidence is not a substitute for production-code review.

## 1. Pre-existing user changes — exclude from a campaign commit

Preserve all 684 baseline status entries exactly as user-owned starting state. This includes the existing `verification/evidence/`, `verification/final-rearchitecture/`, `verification/r10/`, `verification/selection-exhaustive/`, and other baseline paths recorded in `WORKTREE_BASELINE.json`. The campaign must not reset, clean, stage, or commit these paths.

The baseline also includes the following untracked production paths; they remain excluded until separately reviewed:

- `apps/api/src/structures/compactCanonical.ts`
- `apps/api/src/structures/ingestionProfiler.ts`
- `apps/web/src/structures/`

## 2. LM-IMP-001 implementation changes — separate review scope

These production paths were already modified at campaign start and belong to the LM-IMP-001 implementation review, not to the A→BF evidence commit:

- `apps/api/src/server.ts`
- `apps/api/src/structures/ingestion.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/ConsolePanel.tsx`
- `apps/web/src/components/InspectorPanel.tsx`
- `apps/web/src/components/MolecularCanvas.tsx`
- `apps/web/src/components/StatusBar.tsx`
- `apps/web/src/components/StructurePanel.tsx`
- `apps/web/src/editing/editFoundation.ts`
- `apps/web/src/interaction/picking.ts`
- `apps/web/src/lib/apiClient.ts`
- `apps/web/src/rendering/ThreeDMolViewerAdapter.ts`
- `apps/web/src/rendering/presentationState.ts`
- `apps/web/src/rendering/styleProfiles.ts`
- `apps/web/src/workspace/workspaceModel.ts`
- `packages/contracts/src/index.ts`

The current working tree also contains selection-related production paths (`apps/web/src/selection/selectionEngine.ts` and `apps/web/src/selection/compactSelectionEngine.ts`). Treat them as implementation scope and review them with LM-IMP-001; do not fold them into a report-only evidence commit without explicit owner approval.

## 3. A→BF test and harness scope

If the owner later chooses to commit the campaign harness, the intended test-only set is:

- `apps/web/src/selection/selectionEngine.test.ts`
- `tests/e2e/real-structure-workspace.spec.ts`
- `verification/large-molecule-4v6f/20-selection-a-bf-4v6f/`

The campaign directory contains the corpus, replay scripts, local evidence, Drive manifests and readback audits, performance retest, final reports, lock, fingerprint, and seal package. Stage only the files needed for the agreed archival policy; do not stage unrelated baseline evidence.

## 4. Report and evidence metadata

The final archival set is limited to the campaign’s `41-final/` reports and the supporting `37-performance/` and `40-drive/` audit artifacts referenced by the seal. The key closure files are:

- `41-final/FINAL_4V6F_SELECTION_A_BF_REPORT.md`
- `41-final/FINAL_4V6F_SELECTION_A_BF_REPORT.json`
- `41-final/FINAL_4V6F_SELECTION_SEAL_AUDIT.md`
- `41-final/FINAL_4V6F_SELECTION_SEAL_AUDIT.json`
- `41-final/4V6F_SELECTION_SUBSYSTEM_LOCK.json`
- `41-final/4V6F_SELECTION_REPRODUCIBILITY_FINGERPRINT.json`
- `41-final/4V6F_SELECTION_SCOPED_COMMIT_PLAN.md`
- `40-drive/4V6F_SELECTION_DRIVE_MANIFEST.json`
- `40-drive/4V6F_SELECTION_DRIVE_READBACK_AUDIT.json`
- `40-drive/4V6F_DRIVE_HIERARCHY_AUDIT.json`
- `37-performance/4V6F_SELECTION_TAIL_REVIEW.md`
- `37-performance/4V6F_SELECTION_TAIL_REVIEW.json`

## Recommendation

Do not commit during this seal audit. After owner review, make separate, narrowly scoped commits for (a) LM-IMP-001 production implementation, (b) A→BF tests/harness, and (c) archival reports/evidence metadata. Keep the baseline snapshot and this plan attached to the review so pre-existing changes remain attributable and recoverable.
