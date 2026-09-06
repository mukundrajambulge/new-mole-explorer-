import type { AlignmentObject, AlignmentResult } from "./alignment";

/** Renderer-neutral presentation data derived from immutable alignment artifacts. */
export type AlignmentOverlay = Readonly<{
  resultId: string;
  alignmentObjectId: string;
  sourceObjectId: string;
  targetObjectId: string;
  sourceStateId: string;
  targetStateId: string;
  sourceAtomUid: string;
  targetAtomUid: string;
  retained: boolean;
  residual: number | null;
}>;

type AlignmentPresentationEntry = Readonly<{
  result: AlignmentResult;
  alignmentObject?: AlignmentObject;
  applyStatus?: "ANALYZED" | "APPLIED" | "STALE";
}>;

/**
 * Projects only immutable pair data into a renderer-neutral overlay list.
 * Scientific results remain the source of truth; this list is disposable.
 */
export const overlaysForAlignment = (entries: readonly AlignmentPresentationEntry[]): AlignmentOverlay[] => entries
  .filter((entry) => entry.result.resultDisposition === "VALID" && entry.applyStatus !== "STALE" && Boolean(entry.alignmentObject))
  .flatMap((entry) => {
    const alignmentObject = entry.alignmentObject!;
    return alignmentObject.links.map((link) => ({
      resultId: entry.result.resultId,
      alignmentObjectId: alignmentObject.alignmentObjectId,
      sourceObjectId: alignmentObject.sourceObjectId,
      targetObjectId: alignmentObject.targetObjectId,
      sourceStateId: entry.result.sourceCoordinateContext.stateId,
      targetStateId: entry.result.targetCoordinateContext.stateId,
      sourceAtomUid: link.sourceAtomUid,
      targetAtomUid: link.targetAtomUid,
      retained: link.retained,
      residual: link.residual,
    }));
  });
