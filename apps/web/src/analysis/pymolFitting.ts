import type { Coordinate3D } from "@molecular/contracts";
import { createRigidTransformCommand, type EditResult, type ScientificHistoryService, type ScientificRevision } from "../editing/editFoundation";
import { coordinateContextFor } from "../interaction/picking";
import { selectionForStableIds } from "../selection/selectionEngine";
import {
  analyzeAlignment,
  buildAlignmentMapping,
  coordinatePatchForTransform,
  createAlignmentObject,
  createDefaultAlignmentRequest,
  type AlignmentMapping,
  type AlignmentObject,
  type AlignmentRequest,
  type AlignmentResult,
  type AlignmentServiceResult,
  type AlignmentOperationKind,
  type PyMOLCompatibilityTuple,
  pyMolCompatibilityTuple,
  PYMOL_FIT_PROFILE,
  PYMOL_PAIR_FIT_PROFILE,
  PYMOL_RMS_CUR_PROFILE,
  PYMOL_RMS_PROFILE,
  type FittingProfile,
} from "./alignment";

export type FittingAnalysis = Readonly<{
  profile: FittingProfile;
  mapping: AlignmentMapping;
  result: AlignmentResult;
  numericValue: number | null;
  compatibilityTuple: PyMOLCompatibilityTuple | null;
  alignmentObject?: AlignmentObject;
}>;

export type FittingFailure = { ok: false; error: AlignmentResult["error"] };
export type FittingResult = { ok: true; value: FittingAnalysis } | FittingFailure;

const failureForResult = (result: AlignmentResult): FittingFailure => ({ ok: false, error: result.error ?? { code: "NUMERICAL_FAILURE", message: "The fitting operation failed without a structured diagnostic.", disposition: "FAILED" } });

const run = (request: AlignmentRequest, profile: FittingProfile, frame: "LOCAL_SCIENTIFIC" | "EFFECTIVE_WORLD" = "LOCAL_SCIENTIFIC"): FittingResult => {
  const mapping = buildAlignmentMapping(request); if (!mapping.ok) return { ok: false, error: mapping.error };
  const result = analyzeAlignment(request, mapping.value, frame); if (result.resultDisposition !== "VALID") return failureForResult(result);
  return { ok: true, value: { profile, mapping: mapping.value, result, numericValue: request.operationKind === "RMS_CUR" || request.operationKind === "INTRA_RMS_CUR" ? result.currentRmsd : result.refinedCoreRmsd ?? result.evaluationRmsd, compatibilityTuple: pyMolCompatibilityTuple(result), ...(request.alignmentObjectRequested ? { alignmentObject: createAlignmentObject(result, mapping.value) } : {}) } };
};

export const runRmsCur = (request: AlignmentRequest): FittingResult => run({ ...request, operationKind: "RMS_CUR", transformRequested: false }, PYMOL_RMS_CUR_PROFILE);
export const runRms = (request: AlignmentRequest): FittingResult => run({ ...request, operationKind: "RMS", transformRequested: false }, PYMOL_RMS_PROFILE);
export const runFit = (request: AlignmentRequest): FittingResult => run({ ...request, operationKind: "FIT" }, PYMOL_FIT_PROFILE);
export const runPairFit = (request: AlignmentRequest): FittingResult => {
  if (!request.explicitPairs?.length) return { ok: false, error: { code: "NO_CORRESPONDENCE", message: "pair_fit requires explicit source/target pair endpoints.", disposition: "FAILED" } };
  return run({ ...request, operationKind: "PAIR_FIT", mappingMode: "EXPLICIT", transformRequested: true, compatibilityProfile: "pymol-5e8bfca:pair_fit" }, PYMOL_PAIR_FIT_PROFILE);
};

export type IntraFittingResult = Readonly<{
  profile: FittingProfile;
  referenceStateId: string;
  states: readonly FittingAnalysis[];
  stateErrors: readonly { stateId: string; error: FittingFailure["error"] }[];
}>;

const intraRequest = (request: AlignmentRequest, stateId: string, operationKind: AlignmentOperationKind): AlignmentRequest => {
  const sourceSelection = request.sourceSelection; const targetSelection = request.targetSelection;
  return createDefaultAlignmentRequest({ ...request, operationKind, mappingMode: "EXPLICIT", explicitPairs: sourceSelection.stableAtomIds.map((atomId) => ({ sourceAtomUid: atomId, targetAtomUid: atomId })), sourceObjectId: request.sourceObjectId, targetObjectId: request.sourceObjectId, targetRevisionId: request.sourceRevisionId, targetStructure: request.sourceStructure, sourceStateId: stateId, targetStateId: request.sourceStateId, targetSelection: targetSelection.structureId === request.sourceStructure.id ? targetSelection : selectionForStableIds(sourceSelection.stableAtomIds, request.sourceStructure), sourceCoordinateContext: coordinateContextFor(request.sourceStructure, request.sourceObjectId, stateId), targetCoordinateContext: coordinateContextFor(request.sourceStructure, request.sourceObjectId, request.sourceStateId) });
};

const runIntra = (request: AlignmentRequest, operationKind: "INTRA_RMS_CUR" | "INTRA_RMS" | "INTRA_FIT", profile: FittingProfile): AlignmentServiceResult<IntraFittingResult> => {
  const states = request.sourceStructure.coordinateStates?.length ? request.sourceStructure.coordinateStates : [{ id: `${request.sourceStructure.id}:state:1`, ordinal: 1, coordinates: Object.fromEntries(request.sourceStructure.atoms.map((atom) => [atom.stableId, { x: atom.x, y: atom.y, z: atom.z }])), coordinateHash: request.sourceStructure.scientificHash }]; const statesWithResults: FittingAnalysis[] = []; const stateErrors: { stateId: string; error: FittingFailure["error"] }[] = [];
  for (const state of states) { const result = run(intraRequest(request, state.id, operationKind), profile); if (result.ok) statesWithResults.push(result.value); else stateErrors.push({ stateId: state.id, error: result.error }); }
  return { ok: true, value: { profile, referenceStateId: request.sourceStateId, states: statesWithResults, stateErrors } };
};

export const runIntraRmsCur = (request: AlignmentRequest): AlignmentServiceResult<IntraFittingResult> => runIntra(request, "INTRA_RMS_CUR", PYMOL_RMS_CUR_PROFILE);
export const runIntraRms = (request: AlignmentRequest): AlignmentServiceResult<IntraFittingResult> => runIntra(request, "INTRA_RMS", PYMOL_RMS_PROFILE);
export const runIntraFit = (request: AlignmentRequest): AlignmentServiceResult<IntraFittingResult> => runIntra(request, "INTRA_FIT", PYMOL_FIT_PROFILE);

export type AppliedIntraFitResult = { ok: true; analysis: IntraFittingResult; transaction: Extract<EditResult, { ok: true }> } | { ok: false; error: string; analysis?: IntraFittingResult };

export const applyIntraFittingResults = (history: ScientificHistoryService, revision: ScientificRevision, request: AlignmentRequest, analysis: IntraFittingResult, atomIds: readonly string[] = request.sourceSelection.stableAtomIds): AppliedIntraFitResult => {
  if (analysis.stateErrors.length) return { ok: false, error: "One or more coordinate states failed structurally; the multi-state fit was not partially applied.", analysis };
  if (revision.revisionId !== request.sourceRevisionId) return { ok: false, error: "STALE_BASE_REVISION: expected " + request.sourceRevisionId + ", current revision is " + revision.revisionId + ".", analysis };
  const coordinatesByState: Record<string, Readonly<Record<string, Coordinate3D>>> = {};
  for (const entry of analysis.states) {
    if (!entry.result.rotationMatrix || !entry.result.translationVector) return { ok: false, error: "State " + entry.result.sourceCoordinateContext.stateId + " has no applicable transform.", analysis };
    coordinatesByState[entry.result.sourceCoordinateContext.stateId] = coordinatePatchForTransform(revision.loadResult.structure, entry.result.sourceCoordinateContext.stateId, atomIds, { rotation: entry.result.rotationMatrix, translation: entry.result.translationVector });
  }
  const first = analysis.states[0]?.result; if (!first || Object.keys(coordinatesByState).length !== (revision.stateOrder.length || 1)) return { ok: false, error: "STATE_SCOPE_INVALID: every retained coordinate state requires an explicit transform patch.", analysis };
  const selection = selectionForStableIds(atomIds, revision.loadResult.structure); const command = createRigidTransformCommand({ objectId: revision.objectId, baseRevisionId: revision.revisionId, selectionResult: selection, stableAtomIds: atomIds, stateScope: { kind: "ALL" }, coordinatesByState, transform: { rotation: first.rotationMatrix!, translation: first.translationVector! }, origin: { channel: "API", actionId: "ANALYSIS.APPLY_INTRA_RIGID_TRANSFORM" }, provenance: { producerId: "molecular-workstation.r08.fitting", producerVersion: request.algorithmVersion, metadata: { transformConvention: "COLUMN_VECTOR_X_PRIME_EQUALS_R_X_PLUS_T", referenceStateId: analysis.referenceStateId } } });
  const transaction = history.execute(command); return transaction.ok ? { ok: true, analysis, transaction } : { ok: false, error: transaction.code + ": " + transaction.message, analysis };
};

export type AppliedFitResult = { ok: true; analysis: FittingAnalysis; transaction: Extract<EditResult, { ok: true }> } | { ok: false; error: string; analysis?: FittingAnalysis };

/** Apply only after analysis has succeeded and the caller has confirmed the base revision still matches. */
export const applyFittingResult = (history: ScientificHistoryService, revision: ScientificRevision, request: AlignmentRequest, analysis: FittingAnalysis, atomIds: readonly string[] = request.sourceSelection.stableAtomIds): AppliedFitResult => {
  if (analysis.result.resultDisposition !== "VALID" || !analysis.result.rotationMatrix || !analysis.result.translationVector) return { ok: false, error: "The immutable alignment result is not a valid applicable fit.", analysis };
  if (revision.revisionId !== request.sourceRevisionId) return { ok: false, error: `STALE_BASE_REVISION: expected ${request.sourceRevisionId}, current revision is ${revision.revisionId}.`, analysis };
  if (request.sourceObjectId !== revision.objectId) return { ok: false, error: "The mobile object does not match the retained scientific revision." , analysis };
  const transform = { rotation: analysis.result.rotationMatrix, translation: analysis.result.translationVector }; const coordinates = coordinatePatchForTransform(revision.loadResult.structure, request.sourceStateId, atomIds, transform); if (Object.keys(coordinates).length !== atomIds.length) return { ok: false, error: "MISSING_COORDINATE: one or more mobile atoms have no finite coordinate.", analysis };
  const selection = selectionForStableIds(atomIds, revision.loadResult.structure); const command = createRigidTransformCommand({ objectId: revision.objectId, baseRevisionId: revision.revisionId, selectionResult: selection, stableAtomIds: atomIds, stateScope: { kind: "COORDINATE_STATE_ID", stateId: request.sourceStateId }, coordinates, transform, origin: { channel: "API", actionId: "ANALYSIS.APPLY_RIGID_TRANSFORM" }, provenance: { producerId: "molecular-workstation.r08.fitting", producerVersion: request.algorithmVersion, metadata: { alignmentResultId: analysis.result.resultId, mappingHash: analysis.mapping.mappingHash, transformConvention: "COLUMN_VECTOR_X_PRIME_EQUALS_R_X_PLUS_T" } } });
  const transaction = history.execute(command); return transaction.ok ? { ok: true, analysis, transaction } : { ok: false, error: `${transaction.code}: ${transaction.message}`, analysis };
};

export type StructuralAlignmentResult = FittingResult & { compatibilityTuple?: PyMOLCompatibilityTuple | null };
const nativeAlignmentCompatibility = "MOLEXPLORER_NATIVE_FIXED_CORRESPONDENCE_V1";
export const runAlign = (request: AlignmentRequest): StructuralAlignmentResult => run({ ...request, operationKind: "ALIGN", mappingMode: request.compatibilityProfile === nativeAlignmentCompatibility ? "SEQUENCE_GUIDED" : request.mappingMode, compatibilityProfile: "pymol-5e8bfca:align", alignmentObjectRequested: request.alignmentObjectRequested }, { id: "PYMOL_ALIGN_PROFILE", operation: "ALIGN", mutatesCoordinates: request.transformRequested, compatibility: "pymol-5e8bfca:align" });
export const runSuper = (request: AlignmentRequest): StructuralAlignmentResult => run({ ...request, operationKind: "SUPER", mappingMode: request.compatibilityProfile === nativeAlignmentCompatibility ? "SEQUENCE_GUIDED" : request.mappingMode, compatibilityProfile: "pymol-5e8bfca:super", refinementProfile: request.refinementProfile.cycles === 0 ? { ...request.refinementProfile, cycles: 5 } : request.refinementProfile }, { id: "PYMOL_SUPER_PROFILE", operation: "SUPER", mutatesCoordinates: request.transformRequested, compatibility: "pymol-5e8bfca:super" });
export const runCEAlign = (): { ok: false; error: { code: "UNSUPPORTED_CAPABILITY"; message: string; disposition: "UNSUPPORTED" } } => ({ ok: false, error: { code: "UNSUPPORTED_CAPABILITY", message: "CE align is not enabled: the pinned CE incremental-extension algorithm and its returned guide mapping are not implemented in this gate.", disposition: "UNSUPPORTED" } });

export type PyMOLCommandName = "rms_cur" | "rms" | "fit" | "pair_fit" | "align" | "super" | "cealign" | "intra_rms_cur" | "intra_rms" | "intra_fit";
export const fittingProfileFor = (command: PyMOLCommandName): FittingProfile | null => command === "rms_cur" || command === "intra_rms_cur" ? PYMOL_RMS_CUR_PROFILE : command === "rms" || command === "intra_rms" ? PYMOL_RMS_PROFILE : command === "fit" || command === "intra_fit" ? PYMOL_FIT_PROFILE : command === "pair_fit" ? PYMOL_PAIR_FIT_PROFILE : command === "align" ? { id: "PYMOL_ALIGN_PROFILE", operation: "ALIGN", mutatesCoordinates: true, compatibility: "pymol-5e8bfca:align" } : command === "super" ? { id: "PYMOL_SUPER_PROFILE", operation: "SUPER", mutatesCoordinates: true, compatibility: "pymol-5e8bfca:super" } : null;

export const fitTransformCoordinates = (structure: AlignmentRequest["sourceStructure"], stateId: string, result: AlignmentResult, atomIds: readonly string[]): Readonly<Record<string, Coordinate3D>> => result.rotationMatrix && result.translationVector ? coordinatePatchForTransform(structure, stateId, atomIds, { rotation: result.rotationMatrix, translation: result.translationVector }) : {};
