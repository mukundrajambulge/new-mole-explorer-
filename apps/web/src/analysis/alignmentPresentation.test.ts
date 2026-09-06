import { describe, expect, it } from "vitest";
import { createAlignmentObject, type AlignmentMapping, type AlignmentResult } from "./alignment";
import { overlaysForAlignment } from "./alignmentPresentation";

const mapping = { sourceSnapshotRef: { objectId: "mobile", revisionId: "r1", structureId: "s1", molecularRevision: "m1", stateId: "state:1", context: {} as never }, targetSnapshotRef: { objectId: "target", revisionId: "r2", structureId: "s2", molecularRevision: "m2", stateId: "state:1", context: {} as never }, pairRecords: [{ pairId: "pair:1", sourceObjectId: "mobile", sourceAtomUid: "a1", targetObjectId: "target", targetAtomUid: "b1", mappingReason: "test", weight: 1, retainedStatus: "RETAINED", rejectionCycle: null, residual: 0 }], residueMapping: [], chainMapping: [], atomTemplate: "CA", symmetryPolicy: "NONE", altlocPolicy: "FAIL_AMBIGUOUS", missingCoordinatePolicy: "FAIL", coverage: { source: 1, target: 1, paired: 1 }, diagnostics: [], mappingHash: "map" } as unknown as AlignmentMapping;
const result = { resultId: "result:1", resultDisposition: "VALID", sourceCoordinateContext: { stateId: "state:1" }, targetCoordinateContext: { stateId: "state:1" }, fitPairIds: ["pair:1"], rejectedPairIds: [], perPairResiduals: { "pair:1": 0.25 } } as unknown as AlignmentResult;

describe("alignment presentation", () => {
  it("projects immutable retained links without changing the result", () => {
    const object = createAlignmentObject(result, mapping);
    const overlays = overlaysForAlignment([{ result, alignmentObject: object, applyStatus: "ANALYZED" }]);
    expect(overlays).toEqual([expect.objectContaining({ sourceObjectId: "mobile", targetObjectId: "target", retained: true, residual: 0.25 })]);
    expect(Object.isFrozen(object)).toBe(true);
  });

  it("does not project stale results", () => {
    const object = createAlignmentObject(result, mapping);
    expect(overlaysForAlignment([{ result, alignmentObject: object, applyStatus: "STALE" }])).toEqual([]);
  });
});
