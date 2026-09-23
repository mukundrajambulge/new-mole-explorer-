import type { DurableResultRecord, DurableSelectionRecord, JsonRecord, JsonValue, ProjectRecord, SessionDraft, SessionManifest } from "@molecular/contracts";
import type { StructuralAnalysisResult } from "../analysis/structuralAnalysis";
import type { FittingAnalysis } from "../analysis/pymolFitting";
import type { MeasurementObject } from "../interaction/measurements";
import { NamedSelectionStore, type NamedSelectionSnapshot, type SelectionResult } from "../selection/selectionEngine";
import { toProjectPresentation, type RenderProjection } from "../rendering/renderProjection";
import { restoreWorkspaceObject, type WorkspaceGroup, type WorkspaceObject } from "../workspace/workspaceModel";
import type { ScientificHistoryService } from "../editing/editFoundation";
import type { SceneStore } from "./scenes";

export type SessionCodecInput = {
  project: ProjectRecord | null;
  workspaceObjects: readonly WorkspaceObject[];
  workspaceGroups: readonly WorkspaceGroup[];
  activeObjectId: string | null;
  globalFrameIndex: number;
  coordinateFramePolicy: string | null;
  activeSelection: SelectionResult | null;
  namedSelectionStore: NamedSelectionStore | null;
  measurements: readonly MeasurementObject[];
  analysisResults: readonly StructuralAnalysisResult[];
  fittingResults: readonly (FittingAnalysis & { applyStatus: "ANALYZED" | "APPLIED" | "STALE" })[];
  sceneStore: SceneStore;
  history: ScientificHistoryService;
  projection: RenderProjection;
};

export type RestoredSession = {
  objects: WorkspaceObject[];
  activeObjectId: string | null;
  globalFrameIndex: number;
  coordinateFramePolicy: string | null;
  activeSelection: SelectionResult | null;
  namedSelectionStore: NamedSelectionStore | null;
  namedSelections: readonly { name: string; count: number }[];
  measurements: MeasurementObject[];
  analysisResults: StructuralAnalysisResult[];
  fittingResults: (FittingAnalysis & { applyStatus: "ANALYZED" | "APPLIED" | "STALE" })[];
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const json = (value: unknown): JsonValue => clone(value) as JsonValue;
const record = (value: unknown): JsonRecord => clone(value) as JsonRecord;

const currentRevisionFor = (object: WorkspaceObject, history: ScientificHistoryService): string => history.currentRevision(object.objectId)?.revisionId ?? object.loadResult.structure.scientificHash;
const objectById = (objects: readonly WorkspaceObject[]) => new Map(objects.map((object) => [object.objectId, object]));

const refsFor = (objects: readonly WorkspaceObject[], result: { objectId?: string; molecularRevision?: string; coordinateContext?: { stateId?: string; modelId?: string; objectId?: string }; sourceSnapshotRef?: { objectId: string; molecularRevision: string }; targetSnapshotRef?: { objectId: string; molecularRevision: string } }, history: ScientificHistoryService, fallbackObjectId: string | null): { objectId: string; scientificRevisionId: string }[] => {
  const refs = new Map<string, string>();
  const candidates = [result.objectId, result.coordinateContext?.objectId, result.coordinateContext?.modelId, result.sourceSnapshotRef?.objectId, result.targetSnapshotRef?.objectId, fallbackObjectId].filter((value): value is string => Boolean(value));
  if (result.sourceSnapshotRef) refs.set(result.sourceSnapshotRef.objectId, result.sourceSnapshotRef.molecularRevision);
  if (result.targetSnapshotRef) refs.set(result.targetSnapshotRef.objectId, result.targetSnapshotRef.molecularRevision);
  for (const objectId of candidates) {
    const object = objects.find((candidate) => candidate.objectId === objectId);
    if (object && !refs.has(objectId)) refs.set(objectId, currentRevisionFor(object, history));
  }
  return [...refs].map(([objectId, scientificRevisionId]) => ({ objectId, scientificRevisionId }));
};

const selectionRecordFor = (result: SelectionResult, name: string | undefined, objects: readonly WorkspaceObject[], history: ScientificHistoryService, fallbackObjectId: string | null): DurableSelectionRecord => {
  const refs = refsFor(objects, { molecularRevision: result.molecularRevision, coordinateContext: result.coordinateContext ?? undefined }, history, result.objectScope.objectId || fallbackObjectId);
  const normalizedRefs = refs.length ? refs : (fallbackObjectId ? [{ objectId: fallbackObjectId, scientificRevisionId: result.molecularRevision }] : []);
  return {
    selectionId: result.resultId,
    ...(name ? { name } : {}),
    definition: record({ query: result.query, normalizedAst: result.normalizedAst, boundPlan: result.boundPlan, dependencyVector: result.dependencyVector, grammarVersion: result.grammarVersion, profile: result.profile }),
    snapshot: record(result),
    sourceRevisionRefs: normalizedRefs,
    membershipHash: result.membershipHash,
    disposition: result.status === "VALID_NONEMPTY" || result.status === "VALID_EMPTY" ? "VALID" : result.status === "STALE_REVISION" ? "STALE" : "UNVALIDATED",
    ...(result.status === "STALE_REVISION" ? { staleReason: "Selection was saved from a stale scientific revision." } : {}),
  };
};

const resultRecordFor = (kind: DurableResultRecord["kind"], value: unknown, refs: readonly { objectId: string; scientificRevisionId: string }[], id: string, disposition: DurableResultRecord["disposition"] = "VALID"): DurableResultRecord => ({ resultId: id, kind, payload: json(value), sourceRevisionRefs: refs, disposition });

export const buildSessionDraft = (input: SessionCodecInput): SessionDraft => {
  const objects = objectById(input.workspaceObjects);
  const sessionSelections: DurableSelectionRecord[] = [];
  for (const snapshot of input.namedSelectionStore?.list() ?? []) sessionSelections.push(selectionRecordFor(snapshot.selectionResult, snapshot.name, input.workspaceObjects, input.history, input.activeObjectId));
  if (input.activeSelection && !sessionSelections.some((selection) => selection.selectionId === input.activeSelection!.resultId)) sessionSelections.push(selectionRecordFor(input.activeSelection, undefined, input.workspaceObjects, input.history, input.activeObjectId));
  const results: DurableResultRecord[] = [];
  for (const measurement of input.measurements) {
    const object = measurement.objectId ? objects.get(measurement.objectId) : undefined;
    results.push(resultRecordFor("MEASUREMENT", measurement, refsFor(input.workspaceObjects, { objectId: measurement.objectId, molecularRevision: measurement.molecularRevision, coordinateContext: { modelId: measurement.coordinateContext.modelId, stateId: measurement.coordinateContext.stateId } }, input.history, object?.objectId ?? input.activeObjectId), measurement.id, measurement.status === "STALE" ? "STALE" : "VALID"));
  }
  for (const analysis of input.analysisResults) results.push(resultRecordFor("STRUCTURAL_ANALYSIS", analysis, refsFor(input.workspaceObjects, { molecularRevision: analysis.molecularRevision, coordinateContext: { modelId: analysis.coordinateContext } }, input.history, input.activeObjectId), `analysis:${analysis.kind}`, analysis.status === "STALE" ? "STALE" : "VALID"));
  for (const entry of input.fittingResults) {
    const refs = refsFor(input.workspaceObjects, entry.result, input.history, input.activeObjectId);
    const disposition = entry.applyStatus === "STALE" || entry.result.resultDisposition === "STALE" ? "STALE" : entry.result.resultDisposition;
    results.push(resultRecordFor("ALIGNMENT", entry, refs, entry.result.resultId, disposition));
    if (entry.alignmentObject) results.push(resultRecordFor("ALIGNMENT_OBJECT", entry.alignmentObject, refs, entry.alignmentObject.alignmentObjectId, "VALID"));
  }
  const persistedObjects = input.workspaceObjects.map((object) => {
    const revision = input.history.currentRevision(object.objectId);
    return {
      objectId: object.objectId,
      displayName: object.displayName,
      enabled: object.enabled,
      currentStateId: object.currentStateId,
      stateOrder: [...object.stateOrder],
      allStates: object.allStates,
      loadResult: clone(object.loadResult),
      projection: record(object.projection),
      lineage: record(object.lineage),
      molecularIdentityId: revision?.molecularIdentityId ?? object.loadResult.structure.id,
      scientificRevisionId: currentRevisionFor(object, input.history),
      retainedScientificRevisionIds: input.history.persistenceManifest(object.objectId)?.retainedRevisionIds ?? [currentRevisionFor(object, input.history)],
    };
  });
  return {
    sessionFormatVersion: 2,
    sessionId: input.project?.session?.sessionId ?? input.project?.id,
    name: input.project?.name ?? "Untitled Project",
    documents: [],
    objects: persistedObjects,
    activeObjectId: input.activeObjectId,
    globalFrameIndex: input.globalFrameIndex,
    workspaceGroups: input.workspaceGroups.map(record),
    coordinateFramePolicy: input.coordinateFramePolicy,
    selections: sessionSelections,
    activeSelection: input.activeSelection ? record(input.activeSelection) : null,
    namedSelectionSnapshots: (input.namedSelectionStore?.list() ?? []).map(record),
    results,
    sceneCollection: input.sceneStore.value,
    presentationState: record(toProjectPresentation(input.projection)),
    dependencyMode: input.workspaceObjects.every((object) => Boolean(object.loadResult.sourceArtifact?.rawStorageRef)) ? "SELF_CONTAINED" : "REFERENCED",
    requiredCapabilities: [],
    optionalCapabilities: ["FOREIGN_PSE_IMPORT"],
    commandAudit: [],
    provenanceRefs: [],
    scientificPolicyVersion: "molexplorer-scientific-canonical-json-v1",
    canonicalizationProfileVersion: "molexplorer-session-canonical-json-v1",
    applicationBuildId: "molecular-workstation-r09",
    recoveryMetadata: null,
  };
};

const staleRefs = (refs: readonly { objectId: string; scientificRevisionId: string }[], objects: readonly WorkspaceObject[]): boolean => refs.some((ref) => objects.find((object) => object.objectId === ref.objectId)?.loadResult.structure.scientificHash !== ref.scientificRevisionId);

export const restoreSession = (manifest: SessionManifest): RestoredSession => {
  const objects = manifest.objects.map(restoreWorkspaceObject);
  const activeObject = objects.find((object) => object.objectId === manifest.activeObjectId) ?? objects[0];
  const namedStore = activeObject ? new NamedSelectionStore(activeObject.loadResult.structure) : null;
  const namedSnapshots = (manifest.namedSelectionSnapshots ?? []).flatMap((value) => {
    if (!value || typeof value !== "object" || !("name" in value) || !("selectionResult" in value)) return [];
    return [value as unknown as NamedSelectionSnapshot];
  });
  for (const snapshot of namedSnapshots) {
    try { namedStore?.restoreSnapshot(snapshot); } catch { /* failed snapshots stay visible as unvalidated durable records */ }
  }
  const objectIds = new Set(objects.map((object) => object.objectId));
  const activeSelection = manifest.activeSelection && typeof manifest.activeSelection === "object" ? clone(manifest.activeSelection) as unknown as SelectionResult : null;
  const measurements: MeasurementObject[] = [];
  const analysisResults: StructuralAnalysisResult[] = [];
  const fittingResults: (FittingAnalysis & { applyStatus: "ANALYZED" | "APPLIED" | "STALE" })[] = [];
  for (const entry of manifest.results) {
    if (!entry.payload || typeof entry.payload !== "object") continue;
    const stale = staleRefs(entry.sourceRevisionRefs, objects);
    if (entry.kind === "MEASUREMENT") measurements.push({ ...(clone(entry.payload) as unknown as MeasurementObject), status: stale ? "STALE" : (clone(entry.payload) as unknown as MeasurementObject).status });
    if (entry.kind === "STRUCTURAL_ANALYSIS") analysisResults.push({ ...(clone(entry.payload) as unknown as StructuralAnalysisResult), status: stale ? "STALE" : (clone(entry.payload) as unknown as StructuralAnalysisResult).status });
    if (entry.kind === "ALIGNMENT") fittingResults.push({ ...(clone(entry.payload) as unknown as FittingAnalysis & { applyStatus: "ANALYZED" | "APPLIED" | "STALE" }), applyStatus: stale ? "STALE" : (clone(entry.payload) as unknown as { applyStatus: "ANALYZED" | "APPLIED" | "STALE" }).applyStatus });
  }
  return {
    objects,
    activeObjectId: objectIds.has(manifest.activeObjectId ?? "") ? manifest.activeObjectId : activeObject?.objectId ?? null,
    globalFrameIndex: manifest.globalFrameIndex,
    coordinateFramePolicy: manifest.coordinateFramePolicy ?? null,
    activeSelection,
    namedSelectionStore: namedStore,
    namedSelections: namedStore?.list().map((snapshot) => ({ name: snapshot.name, count: snapshot.stableAtomIds.length })) ?? [],
    measurements,
    analysisResults,
    fittingResults,
  };
};
