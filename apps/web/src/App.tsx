import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectRecord, StructureLoadResult } from "@molecular/contracts";
import { CapabilityNotice } from "./components/CapabilityNotice";
import { ConsolePanel, type ConsoleCommandResult } from "./components/ConsolePanel";
import { ContextToolbar } from "./components/ContextToolbar";
import { InspectorPanel } from "./components/InspectorPanel";
import { MenuBar, RIBBON_CATEGORIES, type RibbonCategory } from "./components/MenuBar";
import { MolecularCanvas } from "./components/MolecularCanvas";
import { NavRail } from "./components/NavRail";
import { StatusBar } from "./components/StatusBar";
import { StructurePanel } from "./components/StructurePanel";
import { ACTION_IDS, ACTION_REGISTRY, type ActionId, type ActionDefinition } from "./domain/registry";
import { ApiClientError, apiClient } from "./lib/apiClient";
import { applyRepresentationToSelection, clearColorForSelection, createDefaultRenderProjection, DEFAULT_CAMERA, fromProjectPresentation, maskForStyle, setCameraState, setCategoryRepresentation, setColorForSelection, setComponentColor, setInteractionState, setLabelState, setProjectionStyle, setRepresentationParameters, toProjectPresentation, type BackgroundPreset, type ColorMode, type RenderProjection, type RepresentationParameters, type RepresentationStyle } from "./rendering/renderProjection";
import { applyPresentationAction, type PresentationComponent } from "./rendering/presentationActions";
import { buildRenderProjectionDiagnostics } from "./rendering/renderDirectives";
import { STYLE_DEFINITIONS, representationCapabilityFor, representationStyleForCommand } from "./rendering/styleProfiles";
import { combineSelections, evaluateSelectionQuery, NamedSelectionStore, resolveSelection, parseRepresentationCommand, requireValidSelection, SelectionResolutionError, selectionForStableIds, type SelectionPresentationContext, type SelectionResult } from "./interaction/selectionResolver";
import { LabelExpressionError, labelExpressionForMode, parseSafeLabelExpression, type LabelMode } from "./interaction/labels";
import { MeasurementAccumulator, createMeasurementObject, measurementCardinality, type MeasurementKind, type MeasurementObject } from "./interaction/measurements";
import type { PickResult } from "./interaction/picking";
import { colorRegistry } from "./rendering/colorRegistry";
import { analyzeStructure, overlaysForAnalysis, type StructuralAnalysisKind, type StructuralAnalysisResult } from "./analysis/structuralAnalysis";
import { commandHelp, isRecognizedCommandVerb, parseCommand } from "./commands/commandRegistry";
import { createWorkspaceObject, cycleWorkspaceObjectState, renameWorkspaceObject, resolveGlobalFrameState, setWorkspaceObjectAllStates, setWorkspaceObjectEnabled, setWorkspaceObjectState, structureForWorkspaceObjectState, workspaceScopedStableAtomId, workspaceSelectionStructure, type WorkspaceObject } from "./workspace/workspaceModel";

const canvasTools: Record<string, string> = {
  [ACTION_IDS.CANVAS_SELECT]: "Select",
  [ACTION_IDS.CANVAS_PAN]: "Pan",
  [ACTION_IDS.CANVAS_ROTATE]: "Rotate",
  [ACTION_IDS.CANVAS_ZOOM]: "Zoom",
  [ACTION_IDS.CANVAS_FOCUS]: "Focus",
};

const isAdmittedFile = (file: File) => /\.(pdb|cif|mmcif)$/i.test(file.name);
const initialRibbonCategory = (): RibbonCategory => {
  const saved = window.sessionStorage.getItem("molecular-workstation.ribbon") as RibbonCategory | null;
  return saved && RIBBON_CATEGORIES.includes(saved) ? saved : "Display";
};

export const App = () => {
  const [activeNav, setActiveNav] = useState("Home");
  const [activeTool, setActiveTool] = useState("Select");
  const [activeRibbon, setActiveRibbon] = useState<RibbonCategory>(initialRibbonCategory);
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [consoleExpanded, setConsoleExpanded] = useState(true);
  const [notice, setNotice] = useState<ActionDefinition | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "offline">("checking");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [structure, setStructure] = useState<StructureLoadResult | null>(null);
  const [workspaceObjects, setWorkspaceObjects] = useState<WorkspaceObject[]>([]);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [globalFrameIndex, setGlobalFrameIndex] = useState(0);
  const [projection, setProjection] = useState<RenderProjection>(createDefaultRenderProjection());
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [measurementMode, setMeasurementModeState] = useState<MeasurementKind | null>(null);
  const [measurementSlots, setMeasurementSlots] = useState<readonly string[]>([]);
  const [measurements, setMeasurements] = useState<readonly MeasurementObject[]>([]);
  const [analysisResults, setAnalysisResults] = useState<readonly StructuralAnalysisResult[]>([]);
  const [namedSelections, setNamedSelections] = useState<readonly { name: string; count: number }[]>([]);
  const [activeSelection, setActiveSelectionState] = useState<SelectionResult | null>(null);
  const [targetStyles, setTargetStyles] = useState<Record<"protein" | "ligand" | "water" | "ions" | "other", RepresentationStyle>>({ protein: "cartoon", ligand: "ball-and-stick", water: "spheres", ions: "spheres", other: "sticks" });
  const [cameraCommand, setCameraCommand] = useState<{ actionId: ActionId; sequence: number }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandSequence = useRef(0);
  const measurementAccumulatorRef = useRef(new MeasurementAccumulator());
  const measurementSequenceRef = useRef(0);
  const demoLoadStartedRef = useRef(false);
  const namedSelectionsRef = useRef<NamedSelectionStore | null>(null);
  const activeSelectionResultRef = useRef<SelectionResult | null>(null);
  const workspaceObjectsRef = useRef<WorkspaceObject[]>([]);
  const pendingImportModeRef = useRef<"replace" | "add">("replace");
  const analysisOverlays = useMemo(() => overlaysForAnalysis(analysisResults), [analysisResults]);
  const viewerWorkspaceObjects = useMemo(() => workspaceObjects.map((object) => object.objectId === activeObjectId ? { ...object, projection } : object), [activeObjectId, projection, workspaceObjects]);

  const presentationSelectionContext = (): SelectionPresentationContext | undefined => {
    if (!viewerWorkspaceObjects.length) return undefined;
    const multiObject = viewerWorkspaceObjects.length > 1;
    const visibleStableAtomIds = viewerWorkspaceObjects.flatMap((object) => {
      if (!object.enabled) return [];
      const diagnostics = buildRenderProjectionDiagnostics(structureForWorkspaceObjectState(object), object.projection);
      const ids = [...new Set(diagnostics.directives.flatMap((directive) => directive.targetStableAtomIds))];
      return multiObject ? ids.map((stableId) => workspaceScopedStableAtomId(object.objectId, stableId)) : ids;
    });
    const revision = JSON.stringify(viewerWorkspaceObjects.map((object) => ({
      objectId: object.objectId,
      enabled: object.enabled,
      stateId: object.currentStateId,
      presentationRevision: object.projection.representationState.presentationRevision,
      visibility: [object.projection.showProtein, object.projection.showLigand, object.projection.showWater, object.projection.showIons, object.projection.showOther],
      visibleStableAtomIds: multiObject ? visibleStableAtomIds.filter((stableId) => stableId.startsWith(`${object.objectId}::`)) : visibleStableAtomIds,
    })));
    return { visibleStableAtomIds, revision };
  };

  const setActiveSelection = (result: SelectionResult | null) => {
    activeSelectionResultRef.current = result;
    setActiveSelectionState(result);
    setProjection((current) => setInteractionState(current, { selectedAtomIds: result?.stableAtomIds ?? [], pickedAtomId: null, measurementPickAtomIds: [] }));
  };

  useEffect(() => {
    let mounted = true;
    apiClient.health().then(() => mounted && setApiStatus("connected")).catch(() => mounted && setApiStatus("offline"));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!activeObjectId) return;
    const current = workspaceObjectsRef.current;
    const active = current.find((object) => object.objectId === activeObjectId);
    if (!active || active.projection === projection) return;
    const next = current.map((object) => object.objectId === activeObjectId ? { ...object, projection } : object);
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
  }, [activeObjectId, projection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurementModeState(null);
      setProjection((current) => setInteractionState(current, { hoveredAtomId: null, pickedAtomId: null, measurementPickAtomIds: [] }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showNotice = (capability: ActionDefinition) => {
    setNotice(capability);
    window.setTimeout(() => setNotice((current) => current?.id === capability.id ? null : current), 4600);
  };

  const runLoad = useCallback(async (loader: () => Promise<StructureLoadResult>, mode: "replace" | "add" = "replace") => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const result = await loader();
      const workspaceObject = createWorkspaceObject(result, mode === "add" ? workspaceObjectsRef.current.map((object) => object.objectId) : []);
      const nextWorkspace = mode === "add" ? [...workspaceObjectsRef.current, workspaceObject] : [workspaceObject];
      workspaceObjectsRef.current = nextWorkspace;
      setWorkspaceObjects(nextWorkspace);
      setActiveObjectId(workspaceObject.objectId);
      setStructure(result);
      namedSelectionsRef.current = new NamedSelectionStore(result.structure);
      setProjection(createDefaultRenderProjection(result.structure));
      setTargetStyles({ protein: "cartoon", ligand: "ball-and-stick", water: "spheres", ions: "spheres", other: "sticks" });
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurements([]);
      setAnalysisResults([]);
      setActiveSelection(null);
      setNamedSelections([]);
      setLoadState("idle");
      commandSequence.current += 1;
      setCameraCommand({ actionId: ACTION_IDS.CANVAS_FOCUS, sequence: commandSequence.current });
    } catch (error) {
      setLoadState("error");
      setLoadError(error instanceof ApiClientError ? error.message : "The structure could not be loaded. The current structure was kept.");
    }
  }, []);

  const importFile = (file: File, mode: "replace" | "add" = pendingImportModeRef.current) => {
    pendingImportModeRef.current = "replace";
    if (!isAdmittedFile(file)) {
      setLoadState("error");
      setLoadError("Only PDB and mmCIF files are admitted in G1C. The current structure was kept.");
      return;
    }
    void runLoad(() => apiClient.uploadStructure(file), mode);
  };

  const fetchRcsb = (pdbId: string, mode: "replace" | "add" = "replace") => void runLoad(() => apiClient.fetchRcsb(pdbId), mode);

  const activateWorkspaceObject = (objectId: string) => {
    const current = workspaceObjectsRef.current.map((object) => object.objectId === activeObjectId ? { ...object, projection } : object);
    workspaceObjectsRef.current = current;
    setWorkspaceObjects(current);
    const next = current.find((object) => object.objectId === objectId);
    if (!next) return;
    setActiveObjectId(next.objectId);
    setStructure(next.loadResult);
    setProjection(next.projection);
    namedSelectionsRef.current = new NamedSelectionStore(next.loadResult.structure);
    setNamedSelections([]);
    setActiveSelection(null);
  };

  const toggleWorkspaceObject = (objectId: string) => {
    const next = workspaceObjectsRef.current.map((object) => object.objectId === objectId ? setWorkspaceObjectEnabled(object, !object.enabled) : object);
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
  };

  const cycleObjectState = (objectId: string, direction: -1 | 1) => {
    const next = workspaceObjectsRef.current.map((object) => object.objectId === objectId ? cycleWorkspaceObjectState(object, direction) : object);
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
    const active = next.find((object) => object.objectId === activeObjectId);
    if (active) setStructure(active.loadResult);
  };

  const renameObject = (objectId: string, displayName: string) => {
    const next = workspaceObjectsRef.current.map((object) => object.objectId === objectId ? renameWorkspaceObject(object, displayName) : object);
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
  };

  const toggleObjectAllStates = (objectId: string) => {
    const next = workspaceObjectsRef.current.map((object) => object.objectId === objectId ? setWorkspaceObjectAllStates(object, !object.allStates) : object);
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
  };

  useEffect(() => {
    if (demoLoadStartedRef.current) return;
    const demoId = new URLSearchParams(window.location.search).get("demo")?.trim().toUpperCase();
    if (!demoId || !/^[A-Z0-9]{4}$/.test(demoId)) return;
    demoLoadStartedRef.current = true;
    void runLoad(() => apiClient.fetchRcsb(demoId));
  }, [runLoad]);

  const createProject = async () => {
    try {
      const created = await apiClient.createProject();
      setProject(created);
      workspaceObjectsRef.current = [];
      setWorkspaceObjects([]);
      setActiveObjectId(null);
      setStructure(null);
      setProjection(createDefaultRenderProjection());
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurements([]);
      setAnalysisResults([]);
      setActiveSelection(null);
      setNamedSelections([]);
      setLoadError(null);
      setLoadState("idle");
    } catch (error) {
      setLoadState("error");
      setLoadError(error instanceof ApiClientError ? error.message : "The new project could not be created.");
    }
  };

  const openProject = async () => {
    const id = window.prompt("Project ID to open");
    if (!id) return;
    try {
      const opened = await apiClient.openProject(id.trim());
      setProject(opened);
      const openedWorkspace = opened.structure ? [createWorkspaceObject(opened.structure)] : [];
      workspaceObjectsRef.current = openedWorkspace;
      setWorkspaceObjects(openedWorkspace);
      setActiveObjectId(openedWorkspace[0]?.objectId ?? null);
      setStructure(opened.structure);
      namedSelectionsRef.current = opened.structure ? new NamedSelectionStore(opened.structure.structure) : null;
      setProjection(opened.structure ? fromProjectPresentation(opened.presentation, opened.structure.structure) : createDefaultRenderProjection());
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurements([]);
      setAnalysisResults([]);
      setActiveSelection(null);
      setNamedSelections([]);
      setLoadError(null);
      setLoadState("idle");
    } catch (error) {
      setLoadState("error");
      setLoadError(error instanceof ApiClientError ? error.message : "The project could not be opened. The current workspace was kept.");
    }
  };

  const saveProject = async () => {
    try {
      const target = project ?? await apiClient.createProject();
      const saved = await apiClient.saveProject(target.id, { name: target.name, structure, presentation: toProjectPresentation(projection), expectedRevision: project ? project.revision : target.revision });
      setProject(saved);
      setLoadError(null);
      setLoadState("idle");
    } catch (error) {
      setLoadState("error");
      setLoadError(error instanceof ApiClientError ? error.message : "The project could not be saved. The current workspace was kept.");
    }
  };

  const setColorMode = (mode: ColorMode) => setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "COLOR.APPLY_SCHEME", mode }));

  const applyStyle = (style: RepresentationStyle) => {
    const definition = representationCapabilityFor(style, structure?.structure ?? null);
    if (!definition.maySelect) {
      showNotice({ id: ACTION_IDS.REPRESENTATION_SET_STYLE, group: "REPRESENTATION", state: definition.capability, label: definition.label, description: definition.diagnostic ?? definition.unsupportedReason ?? `${definition.label} is not available in this gate.` });
      return;
    }
    if (definition.status === "VALID_EMPTY") showNotice({ id: ACTION_IDS.REPRESENTATION_SET_STYLE, group: "REPRESENTATION", state: "SUPPORTED_WITH_LIMITATIONS", label: definition.label, description: definition.diagnostic ?? "This representation has no eligible atoms in the current structure." });
    setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "REPRESENTATION.APPLY", style }));
  };

  const setBackgroundPreset = (preset: BackgroundPreset) => setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "BACKGROUND.SET", preset }));

  const onTargetStyle = (category: "protein" | "ligand" | "water" | "ions" | "other", style: RepresentationStyle) => {
    const definition = representationCapabilityFor(style, structure?.structure ?? null);
    if (!definition.maySelect) {
      showNotice({ id: ACTION_IDS.REPRESENTATION_SET_STYLE, group: "REPRESENTATION", state: definition.capability, label: definition.label, description: definition.diagnostic ?? definition.unsupportedReason ?? `${definition.label} is not available in this gate.` });
      return;
    }
    if (definition.status === "VALID_EMPTY") showNotice({ id: ACTION_IDS.REPRESENTATION_SET_STYLE, group: "REPRESENTATION", state: "SUPPORTED_WITH_LIMITATIONS", label: definition.label, description: definition.diagnostic ?? "This representation has no eligible atoms in the current structure." });
    setTargetStyles((current) => ({ ...current, [category]: style }));
    if (structure) setProjection((current) => setCategoryRepresentation(current, structure.structure, category, maskForStyle(style), style));
  };

  const setLabelMode = (mode: LabelMode) => setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "LABELS.SET", labels: { mode, expression: labelExpressionForMode(mode), targetStableAtomIds: undefined } }));
  const setLabelExpression = (input: string): boolean => {
    try {
      const expression = parseSafeLabelExpression(input);
      setProjection((current) => setLabelState(current, { mode: "custom", expression }));
      return true;
    } catch (error) {
      showNotice({ id: ACTION_IDS.LABELS_SET, group: "VIEW", state: "SUPPORTED_WITH_LIMITATIONS", label: "Invalid label expression", description: error instanceof LabelExpressionError ? error.message : "The label expression was rejected by the safe field parser." });
      return false;
    }
  };
  const setCameraProjection = (projectionMode: RenderProjection["camera"]["projectionMode"]) => setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "CAMERA.SET", camera: { projectionMode } }));
  const setCameraSettings = (camera: Partial<RenderProjection["camera"]>) => setProjection((current) => setCameraState(current, camera));
  const setRepresentationSettings = (settings: Partial<RepresentationParameters>) => setProjection((current) => setRepresentationParameters(current, settings));

  const setMeasurementMode = (kind: MeasurementKind | null) => {
    measurementAccumulatorRef.current.clear();
    setMeasurementSlots([]);
    setMeasurementModeState(kind);
    setProjection((current) => setInteractionState(current, { pickedAtomId: null, measurementPickAtomIds: [] }));
  };

  const handlePick = (pick: PickResult) => {
    if (pick.pickKind !== "ATOM" || !structure) return;
    const pickedObject = workspaceObjectsRef.current.find((object) => object.objectId === pick.atomRef.objectId);
    const targetStructure = pickedObject ? { ...pickedObject.loadResult, structure: structureForWorkspaceObjectState(pickedObject) } : structure;
    const stableAtomId = pick.atomRef.stableAtomId;
    if (pickedObject && pickedObject.objectId !== activeObjectId) {
      const current = workspaceObjectsRef.current.map((object) => object.objectId === activeObjectId ? { ...object, projection } : object);
      workspaceObjectsRef.current = current;
      setWorkspaceObjects(current);
      setActiveObjectId(pickedObject.objectId);
      setStructure(pickedObject.loadResult);
      setProjection(pickedObject.projection);
      namedSelectionsRef.current = new NamedSelectionStore(pickedObject.loadResult.structure);
      setNamedSelections([]);
    }
    if (!measurementMode) {
      setActiveSelection(selectionForStableIds([stableAtomId], targetStructure.structure));
      const projectedId = pickedObject ? workspaceScopedStableAtomId(pickedObject.objectId, stableAtomId) : stableAtomId;
      setProjection((current) => setInteractionState(current, { pickedAtomId: stableAtomId, selectedAtomIds: [projectedId], measurementPickAtomIds: [] }));
      return;
    }
    let slots: readonly string[];
    try {
      slots = measurementAccumulatorRef.current.add(stableAtomId, measurementMode, pickedObject?.objectId);
    } catch (error) {
      showNotice({ id: ACTION_IDS.MEASURE_DISTANCE, group: "MEASURE", state: "SUPPORTED_WITH_LIMITATIONS", label: "Measurement pick rejected", description: error instanceof Error ? error.message : "The selected atom belongs to a different workspace object." });
      return;
    }
    setMeasurementSlots([...slots]);
    setProjection((current) => setInteractionState(current, { pickedAtomId: stableAtomId, measurementPickAtomIds: [...slots] }));
    if (slots.length !== measurementCardinality(measurementMode)) return;
    try {
      measurementSequenceRef.current += 1;
      const measurementObjectId = measurementAccumulatorRef.current.currentObjectId();
      const measurement = createMeasurementObject(measurementMode, slots, targetStructure.structure, pick.coordinateContext, measurementSequenceRef.current, measurementObjectId);
      setMeasurements((current) => [...current, measurement]);
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurementModeState(null);
      setProjection((current) => setInteractionState(current, { pickedAtomId: null, measurementPickAtomIds: [] }));
    } catch (error) {
      showNotice({ id: ACTION_IDS.MEASURE_DISTANCE, group: "MEASURE", state: "SUPPORTED_WITH_LIMITATIONS", label: "Measurement rejected", description: error instanceof Error ? error.message : "The selected coordinates could not form a measurement." });
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setProjection((current) => setInteractionState(current, { pickedAtomId: null, measurementPickAtomIds: [] }));
    }
  };

  const handleHover = (pick: PickResult | null) => setProjection((current) => {
    const object = pick?.pickKind === "ATOM" ? workspaceObjectsRef.current.find((candidate) => candidate.objectId === pick.atomRef.objectId) : undefined;
    return setInteractionState(current, { hoveredAtomId: pick?.pickKind === "ATOM" ? object ? workspaceScopedStableAtomId(object.objectId, pick.atomRef.stableAtomId) : pick.atomRef.stableAtomId : null });
  });
  const clearMeasurementPicks = () => { measurementAccumulatorRef.current.clear(); setMeasurementSlots([]); setProjection((current) => setInteractionState(current, { pickedAtomId: null, measurementPickAtomIds: [] })); };
  const clearTransientInteraction = () => setProjection((current) => setInteractionState(current, { hoveredAtomId: null, pickedAtomId: null, measurementPickAtomIds: [] }));
  const clearSelection = () => { setActiveSelection(null); setProjection((current) => setInteractionState(current, { hoveredAtomId: null, pickedAtomId: null, selectedAtomIds: [], measurementPickAtomIds: [] })); };
  const updateMeasurementVisibility = (id: string, visible: boolean) => setMeasurements((current) => current.map((measurement) => measurement.id === id ? { ...measurement, presentation: { ...measurement.presentation, visible }, status: visible ? "CURRENT" : "HIDDEN" } : measurement));
  const deleteMeasurement = (id: string) => setMeasurements((current) => current.filter((measurement) => measurement.id !== id));

  const runAnalysis = (kind: StructuralAnalysisKind) => {
    if (!structure) {
      showNotice({ id: ACTION_IDS.ANALYSIS_CONTACTS, group: "ANALYSIS", state: "SUPPORTED_WITH_LIMITATIONS", label: "Analysis requires a structure", description: "Load a PDB or mmCIF structure before running this diagnostic." });
      return;
    }
    const result = analyzeStructure(structure.structure, kind);
    setAnalysisResults((current) => [...current.filter((entry) => entry.kind !== kind), result]);
  };

  const commandError = (error: unknown, category: ConsoleCommandResult["category"]): ConsoleCommandResult => {
    if (error instanceof SelectionResolutionError && error.result) return { category, status: error.message, count: error.result.count, diagnostics: error.result.diagnostics.map((diagnostic) => ({ message: diagnostic.message, span: diagnostic.span })) };
    return { category, status: error instanceof Error ? error.message : "Command rejected." };
  };

  const commandSelectionContext = () => {
    const activeObject = workspaceObjectsRef.current.find((object) => object.objectId === activeObjectId);
    const current = workspaceObjectsRef.current.length > 1 ? workspaceSelectionStructure(workspaceObjectsRef.current) : activeObject && activeObject.enabled ? structureForWorkspaceObjectState(activeObject) : activeObject ? null : structure?.structure ?? null;
    return { structure: current, named: current?.id === structure?.structure.id || current?.id === `${structure?.structure.id}:state:${activeObject?.currentStateId}` ? namedSelectionsRef.current ?? undefined : undefined, coordinateStateId: activeObject?.currentStateId, stateOrdinal: activeObject ? Math.max(1, activeObject.stateOrder.indexOf(activeObject.currentStateId) + 1) : undefined, presentation: presentationSelectionContext() };
  };

  const workspaceObjectCandidates = (name: string) => {
    const normalized = name.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    return workspaceObjectsRef.current.filter((object) => [object.objectId, object.displayName, object.loadResult.structure.id, object.loadResult.structure.name].some((value) => value.toLowerCase() === normalized));
  };

  const resolveWorkspaceObject = (name: string) => {
    const candidates = workspaceObjectCandidates(name);
    return { object: candidates.length === 1 ? candidates[0] : undefined, ambiguous: candidates.length > 1 };
  };

  const updateWorkspaceProjections = (targetStableIds: readonly string[], update: (projection: RenderProjection, objectStableIds: readonly string[]) => RenderProjection) => {
    const multipleObjects = workspaceObjectsRef.current.length > 1;
    const next = workspaceObjectsRef.current.map((object) => {
      const prefix = `${object.objectId}::`;
      const objectStableIds = multipleObjects
        ? targetStableIds.filter((stableId) => stableId.startsWith(prefix)).map((stableId) => stableId.slice(prefix.length))
        : [...targetStableIds];
      if (!objectStableIds.length) return object;
      const baseProjection = object.objectId === activeObjectId ? projection : object.projection;
      return { ...object, projection: update(baseProjection, objectStableIds) };
    });
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
    const active = next.find((object) => object.objectId === activeObjectId);
    if (active) setProjection(active.projection);
  };

  const ambiguousObjectStatus = (name: string) => `Object reference ${name} is ambiguous; use a durable ObjectID (object:<structure-id>[:suffix]) and no object state changed.`;

  const appendWorkspaceObject = (object: WorkspaceObject) => {
    const next = [...workspaceObjectsRef.current, object];
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
    return next;
  };

  const runConsoleCommand = (input: string): ConsoleCommandResult => {
    const trimmed = input.trim();
    const head = trimmed.match(/^([^\s]+)/)?.[1] ?? "";

    // A registered verb owns command syntax.  Everything else is deliberately
    // handed to the canonical selection parser as a bare selection query.
    // This keeps the textbox promise truthful and prevents command-parser
    // diagnostics from masking valid molecular expressions.
    if (!isRecognizedCommandVerb(head)) {
      const context = commandSelectionContext();
      if (!context.structure) return { category: "SELECTION", status: "No structure loaded; selection was not changed." };
      try {
        const result = requireValidSelection(evaluateSelectionQuery(trimmed, context.structure, { named: context.named, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, presentation: context.presentation }));
        setActiveSelection(result);
        setProjection((current) => setInteractionState(current, { selectedAtomIds: result.stableAtomIds, pickedAtomId: result.stableAtomIds[0] ?? null, measurementPickAtomIds: [] }));
        return { category: "SELECTION", status: `Selected ${result.count} atoms · replace · revision ${result.molecularRevision.slice(0, 10)}…`, count: result.count };
      } catch (error) {
        return commandError(error, "SELECTION");
      }
    }
    const parsedResult = parseCommand(trimmed);
    if (parsedResult.error) return { category: "CAPABILITY", status: `${parsedResult.error.message}${parsedResult.error.span ? ` (characters ${parsedResult.error.span.start + 1}–${parsedResult.error.span.end})` : ""}` };
    const parsed = parsedResult.command;
    if (!parsed) return { category: "CAPABILITY", status: "Command was not parsed and no state was changed." };
    if (parsed.verb === "help") return { category: "SYSTEM", status: commandHelp(parsed.argument).map((definition) => `${definition.synopsis} — ${definition.description}`).join(" · ") || "No command matches that help topic." };
    if (parsed.verb === "select") {
      const context = commandSelectionContext();
      if (!context.structure) return { category: "SELECTION", status: "No structure loaded; selection was not changed." };
      try {
        const namedMatch = trimmed.match(/^select\s+([A-Za-z_][A-Za-z0-9_]*)\s*,\s*(.+)$/i);
        const operationMatch = trimmed.match(/^select(?:\s+(replace|add|subtract|intersect))?\s+(.+)$/i);
        if (namedMatch) {
          const result = requireValidSelection(evaluateSelectionQuery(namedMatch[2], context.structure, { named: context.named, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, presentation: context.presentation }));
          const snapshot = namedSelectionsRef.current?.createSnapshot(namedMatch[1], result);
          if (snapshot) setNamedSelections(namedSelectionsRef.current?.list().map((selection) => ({ name: selection.name, count: selection.stableAtomIds.length })) ?? []);
          setActiveSelection(result);
          setProjection((current) => setInteractionState(current, { selectedAtomIds: result.stableAtomIds, pickedAtomId: result.stableAtomIds[0] ?? null, measurementPickAtomIds: [] }));
          return { category: "SELECTION", status: `Named selection ${namedMatch[1]} created · ${result.count} atoms.` };
        }
        const query = operationMatch?.[2]?.trim() || "all";
        const operation = (operationMatch?.[1]?.toLowerCase() ?? "replace") as "replace" | "add" | "subtract" | "intersect";
        const target = requireValidSelection(evaluateSelectionQuery(query, context.structure, { named: context.named, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, presentation: context.presentation }));
        const currentSelection = activeSelectionResultRef.current;
        const result = operation === "replace" || !currentSelection ? target : combineSelections(currentSelection, target, operation);
        setActiveSelection(result);
        setProjection((current) => setInteractionState(current, { selectedAtomIds: result.stableAtomIds, pickedAtomId: result.stableAtomIds[0] ?? null, measurementPickAtomIds: [] }));
        return { category: "SELECTION", status: `Selected ${result.count} atoms · ${operation} · revision ${result.molecularRevision.slice(0, 10)}…` };
      } catch (error) {
        return commandError(error, "SELECTION");
      }
    }
    if (parsed.verb === "unpick") { clearSelection(); return { category: "SELECTION", status: "Selection cleared." }; }
    if (parsed.verb === "enable" || parsed.verb === "disable") {
      const resolved = resolveWorkspaceObject(parsed.argument);
      if (resolved.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.argument) };
      const target = resolved.object;
      if (!target) return { category: "OBJECT", status: `Object ${parsed.argument} does not exist; no object state changed.` };
      const enabled = parsed.verb === "enable";
      const next = workspaceObjectsRef.current.map((object) => object.objectId === target.objectId ? setWorkspaceObjectEnabled(object, enabled) : object);
      workspaceObjectsRef.current = next;
      setWorkspaceObjects(next);
      return { category: "OBJECT", status: `${enabled ? "Enabled" : "Disabled"} object ${target.displayName}; canonical structure preserved.` };
    }
    if (parsed.verb === "state") {
      if (!parsed.target && /^\d+$/.test(parsed.argument.trim())) {
        const context = commandSelectionContext();
        if (!context.structure) return { category: "SELECTION", status: "No structure loaded; state selection was not changed." };
        try {
          const result = requireValidSelection(evaluateSelectionQuery(`state ${parsed.argument.trim()}`, context.structure, { named: context.named, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, presentation: context.presentation }));
          setActiveSelection(result);
          setProjection((current) => setInteractionState(current, { selectedAtomIds: result.stableAtomIds, pickedAtomId: result.stableAtomIds[0] ?? null, measurementPickAtomIds: [] }));
          return { category: "SELECTION", status: `State ${parsed.argument.trim()} selected ${result.count} atoms.`, count: result.count };
        } catch (error) { return commandError(error, "SELECTION"); }
      }
      const objectReference = parsed.target && /^\d+$/.test(parsed.argument.trim()) ? parsed.target : parsed.argument;
      const requestedState = parsed.target && /^\d+$/.test(parsed.argument.trim()) ? parsed.argument.trim() : parsed.target?.trim();
      const resolved = resolveWorkspaceObject(objectReference);
      if (resolved.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.argument) };
      const target = resolved.object;
      if (!target || !requestedState) return { category: "OBJECT", status: "state requires `state object, state-id` or `state state-id, object` and an existing object." };
      const requested = requestedState;
      const ordinal = /^\d+$/.test(requested) ? Number(requested) : null;
      const stateId = ordinal ? target.stateOrder[ordinal - 1] : target.stateOrder.find((id) => id.toLowerCase() === requested.toLowerCase());
      if (!stateId) return { category: "OBJECT", status: `State ${requested} is not available for ${target.displayName}; no state changed.` };
      const next = workspaceObjectsRef.current.map((object) => object.objectId === target.objectId ? setWorkspaceObjectState(object, stateId) : object);
      workspaceObjectsRef.current = next;
      setWorkspaceObjects(next);
      if (target.objectId === activeObjectId) setStructure(next.find((object) => object.objectId === target.objectId)!.loadResult);
      return { category: "OBJECT", status: `Object ${target.displayName} now uses state ${stateId}.` };
    }
    if (parsed.verb === "frame") {
      const requested = Number(parsed.argument.trim());
      if (!Number.isInteger(requested) || requested < 1) return { category: "OBJECT", status: "frame requires a positive one-based ordinal." };
      const next = workspaceObjectsRef.current.map((object) => {
        const state = resolveGlobalFrameState(object, requested - 1);
        return state ? setWorkspaceObjectState(object, state.id) : object;
      });
      workspaceObjectsRef.current = next;
      setWorkspaceObjects(next);
      setGlobalFrameIndex(requested - 1);
      const active = next.find((object) => object.objectId === activeObjectId);
      if (active) setStructure(active.loadResult);
      return { category: "OBJECT", status: `Global frame ${requested} resolved through explicit per-object state order.` };
    }
    if (parsed.verb === "all_states") {
      const resolved = resolveWorkspaceObject(parsed.argument);
      if (resolved.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.argument) };
      const target = resolved.object;
      if (!target) return { category: "OBJECT", status: `Object ${parsed.argument} does not exist; all_states was not changed.` };
      const next = workspaceObjectsRef.current.map((object) => object.objectId === target.objectId ? setWorkspaceObjectAllStates(object, !object.allStates) : object);
      workspaceObjectsRef.current = next;
      setWorkspaceObjects(next);
      return { category: "OBJECT", status: `${next.find((object) => object.objectId === target.objectId)!.allStates ? "Showing" : "Hiding"} bounded all-state overlay for ${target.displayName}.` };
    }
    if (parsed.verb === "count_states") {
      const resolved = resolveWorkspaceObject(parsed.argument);
      if (resolved.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.argument) };
      const target = resolved.object;
      return target ? { category: "OBJECT", status: `${target.displayName} has ${target.stateOrder.length} canonical coordinate state${target.stateOrder.length === 1 ? "" : "s"}.`, count: target.stateOrder.length } : { category: "OBJECT", status: `Object ${parsed.argument} does not exist.` };
    }
    if (parsed.verb === "copy" || parsed.verb === "create" || parsed.verb === "split_states" || parsed.verb === "join_states") {
      if (parsed.verb === "create") return { category: "OBJECT", status: "create is unavailable without a canonical structure source; no object was created." };
      if (parsed.verb === "split_states") return { category: "OBJECT", status: "split_states is unavailable until canonical state-to-object lineage is defined; no object was created." };
      if (parsed.verb === "join_states") return { category: "OBJECT", status: "join_states is unavailable until compatible canonical state lineage is validated; no object was changed." };
      const left = resolveWorkspaceObject(parsed.argument);
      const right = parsed.target ? resolveWorkspaceObject(parsed.target) : { object: undefined, ambiguous: false };
      if (left.ambiguous || right.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(left.ambiguous ? parsed.argument : parsed.target ?? "") };
      const source = left.object ?? right.object;
      const displayName = left.object ? parsed.target?.trim() : parsed.argument.trim();
      if (!source || !displayName) return { category: "OBJECT", status: "copy requires `copy target, source` and an existing unambiguous source object." };
      const copiedBase = createWorkspaceObject(source.loadResult, workspaceObjectsRef.current.map((object) => object.objectId));
      const copied = renameWorkspaceObject({ ...copiedBase, enabled: source.enabled, projection: source.projection, stateOrder: [...source.stateOrder], currentStateId: source.currentStateId, allStates: source.allStates }, displayName);
      appendWorkspaceObject(copied);
      return { category: "OBJECT", status: `Copied ${source.displayName} to ${copied.displayName}; canonical source and state order preserved.` };
    }
    if (parsed.verb === "rename" || parsed.verb === "set_name") {
      const resolved = resolveWorkspaceObject(parsed.argument);
      if (resolved.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.argument) };
      if (resolved.object) {
        if (!parsed.target) return { category: "OBJECT", status: `${parsed.verb} requires ${parsed.verb} object, new_name.` };
        renameObject(resolved.object.objectId, parsed.target);
        return { category: "OBJECT", status: `Object ${resolved.object.displayName} renamed to ${parsed.target.trim()}.` };
      }
      if (!structure || !namedSelectionsRef.current) return { category: "OBJECT", status: "No structure loaded; the named-selection namespace was not changed." };
      try {
        if (parsed.verb === "rename" || parsed.verb === "set_name") {
          if (!parsed.target) return { category: "OBJECT", status: `${parsed.verb} requires ${parsed.verb} old_name, new_name.` };
          namedSelectionsRef.current.rename(parsed.argument, parsed.target);
          setNamedSelections(namedSelectionsRef.current.list().map((selection) => ({ name: selection.name, count: selection.stableAtomIds.length })));
          return { category: "OBJECT", status: `Named selection ${parsed.argument} renamed to ${parsed.target}.` };
        }
      } catch (error) { return commandError(error, "OBJECT"); }
    }
    if (parsed.verb === "delete" || parsed.verb === "update") {
      if (!structure || !namedSelectionsRef.current) return { category: "OBJECT", status: "No structure loaded; the named-selection namespace was not changed." };
      try {
        if (parsed.verb === "delete") {
          if (!namedSelectionsRef.current.delete(parsed.argument)) return { category: "OBJECT", status: `Named selection ${parsed.argument} does not exist.` };
          setNamedSelections(namedSelectionsRef.current.list().map((selection) => ({ name: selection.name, count: selection.stableAtomIds.length })));
          return { category: "OBJECT", status: `Named selection ${parsed.argument} deleted.` };
        }
        if (!parsed.target) return { category: "OBJECT", status: "update requires `update name, query`." };
        const result = requireValidSelection(evaluateSelectionQuery(parsed.target, structure.structure, { named: namedSelectionsRef.current }));
        const snapshot = namedSelectionsRef.current.updateSnapshot(parsed.argument, result);
        setNamedSelections(namedSelectionsRef.current.list().map((selection) => ({ name: selection.name, count: selection.stableAtomIds.length })));
        return { category: "OBJECT", status: `Named selection ${snapshot.name} updated · ${snapshot.stableAtomIds.length} atoms.` };
      } catch (error) { return commandError(error, "OBJECT"); }
    }
    try {
      const representationCommand = parseRepresentationCommand(trimmed);
      if (representationCommand) {
        const context = commandSelectionContext();
        if (!context.structure) return { category: "PRESENTATION", status: "No structure loaded; presentation was not changed." };
        const target = resolveSelection(representationCommand.query, context.structure, { named: context.named, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, presentation: context.presentation });
        const style = representationStyleForCommand(representationCommand.representation) ?? undefined;
        const capability = representationCapabilityFor(style ?? "cartoon", context.structure);
        if (!capability.maySelect) return { category: "PRESENTATION", status: `${capability.label} unavailable: ${capability.diagnostic ?? capability.unsupportedReason ?? "canonical capability is not implemented"}` };
        updateWorkspaceProjections(target.stableAtomIds, (current, objectStableIds) => applyRepresentationToSelection(current, representationCommand.operation, representationCommand.mask, objectStableIds, style));
        const capabilityNote = capability.status === "VALID_EMPTY" ? ` · ${capability.diagnostic ?? "valid empty result"}` : "";
        return { category: "PRESENTATION", status: `${representationCommand.operation} ${representationCommand.representation} on ${target.stableAtomIds.length} atoms${capabilityNote}.` };
      }
      const colorMatch = trimmed.match(/^color\s+([^,]+?)(?:\s*,\s*(.+))?$/i);
      if (colorMatch) {
        if (!structure) return { category: "PRESENTATION", status: "No structure loaded; color was not changed." };
        if (/^(inherit|default|reset)$/i.test(colorMatch[1].trim())) {
          const context = commandSelectionContext();
          if (!context.structure) return { category: "PRESENTATION", status: "No structure loaded; color was not changed." };
          const target = resolveSelection(colorMatch[2]?.trim() || "all", context.structure, { named: context.named, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, presentation: context.presentation });
          updateWorkspaceProjections(target.stableAtomIds, (current, objectStableIds) => clearColorForSelection(current, objectStableIds));
          return { category: "PRESENTATION", status: `Cleared explicit colors for ${target.stableAtomIds.length} atoms; inherited scheme restored.` };
        }
        const color = colorRegistry.resolveInputWithDiagnostic(colorMatch[1].trim());
        if (!color.definition) return { category: "PRESENTATION", status: "COLOR_NOT_FOUND" };
        const context = commandSelectionContext();
        if (!context.structure) return { category: "PRESENTATION", status: "No structure loaded; color was not changed." };
        const target = resolveSelection(colorMatch[2]?.trim() || "all", context.structure, { named: context.named, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, presentation: context.presentation });
        const colorHex = `#${color.definition.rgbSrgb.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;
        updateWorkspaceProjections(target.stableAtomIds, (current, objectStableIds) => setColorForSelection(current, objectStableIds, colorHex));
        return { category: "PRESENTATION", status: `Applied ${color.definition.canonicalName} to ${target.stableAtomIds.length} atoms.` };
      }
      const labelMatch = trimmed.match(/^label\s+([^,]+?)\s*,\s*(.+)$/i);
      if (labelMatch) {
        if (!structure) return { category: "PRESENTATION", status: "No structure loaded; labels were not changed." };
        const target = resolveSelection(labelMatch[1].trim(), structure.structure, { named: namedSelectionsRef.current ?? undefined });
        const expression = parseSafeLabelExpression(labelMatch[2].trim());
        setProjection((current) => setLabelState(current, { mode: "custom", expression, targetStableAtomIds: target.stableAtomIds }));
        return { category: "PRESENTATION", status: `Applied safe labels to ${target.count} atoms.` };
      }
      if (/^label\s+(off|none)$/i.test(trimmed)) {
        setProjection((current) => setLabelState(current, { mode: "off", expression: null, targetStableAtomIds: [] }));
        return { category: "PRESENTATION", status: "Labels hidden." };
      }
      const viewTarget = trimmed.match(/^(center|zoom)\s+(.+)$/i);
      if (viewTarget) {
        if (!structure) return { category: "PRESENTATION", status: "No structure loaded; the view was not changed." };
        const target = resolveSelection(viewTarget[2], structure.structure, { named: namedSelectionsRef.current ?? undefined });
        commandSequence.current += 1;
        setCameraCommand({ actionId: viewTarget[1].toLowerCase() === "center" ? ACTION_IDS.VIEW_CENTER : ACTION_IDS.VIEW_FIT, sequence: commandSequence.current });
        return { category: "PRESENTATION", status: `${viewTarget[1]} applied to ${target.count} canonical atoms.` };
      }
      if (parsed.verb === "get_view") return { category: "VIEW", status: JSON.stringify(projection.camera.view ?? { projection: projection.camera.projectionMode }) };
      if (/^measure\s+(distance|angle|dihedral)$/i.test(trimmed)) { setMeasurementMode(trimmed.split(/\s+/)[1].toUpperCase() as MeasurementKind); return { category: "MEASURE", status: `Measurement mode started: ${trimmed.split(/\s+/)[1].toUpperCase()}.` }; }
      if (/^measure\s+clear$/i.test(trimmed)) { clearMeasurementPicks(); return { category: "MEASURE", status: "Measurement picks cleared." }; }
    } catch (error) {
      return commandError(error, "PRESENTATION");
    }
    return { category: "CAPABILITY", status: "Command is not implemented in the current bounded presentation/interaction gate." };
  };

  const handleNamedSelectionAction = (name: string, action: "A" | "S" | "H" | "L" | "C") => {
    if (!structure) return;
    const snapshot = namedSelectionsRef.current?.get(name);
    if (!snapshot) return;
    const target = snapshot.selectionResult;
    if (action === "A" || action === "S") {
      const currentSelection = activeSelectionResultRef.current;
      const result = action === "S" || !currentSelection ? target : combineSelections(currentSelection, target, "add");
      setActiveSelection(result);
      setProjection((current) => setInteractionState(current, { selectedAtomIds: result.stableAtomIds, pickedAtomId: result.stableAtomIds[0] ?? null, measurementPickAtomIds: [] }));
    } else if (action === "H") {
      setProjection((current) => applyRepresentationToSelection(current, "HIDE", (1 << 10) - 1, target.stableAtomIds));
    } else if (action === "L") {
      setProjection((current) => setLabelState(current, { mode: "custom", expression: parseSafeLabelExpression("{name}"), targetStableAtomIds: target.stableAtomIds }));
    } else {
      setProjection((current) => setColorForSelection(current, target.stableAtomIds, "#31d8c4"));
    }
  };

  const selectRibbon = (category: RibbonCategory) => {
    setActiveRibbon(category);
    setRibbonCollapsed(false);
    window.sessionStorage.setItem("molecular-workstation.ribbon", category);
  };

  const handleAction = (actionId: ActionId) => {
    const capability = ACTION_REGISTRY[actionId];
    if (actionId.startsWith("WORKSPACE.")) {
      const workspaceName = actionId.replace("WORKSPACE.", "").toLowerCase();
      const labels: Record<string, string> = { home: "Home", projects: "Projects", analysis: "Analysis", laboratory: "Laboratory", molecular: "Molecular", console: "Console" };
      if (capability.state === "SUPPORTED") setActiveNav(labels[workspaceName] ?? "Home");
    }
    if (canvasTools[actionId] && capability.state === "SUPPORTED") {
      setActiveTool(canvasTools[actionId]);
      if (actionId !== ACTION_IDS.CANVAS_SELECT) {
        commandSequence.current += 1;
        setCameraCommand({ actionId, sequence: commandSequence.current });
      }
    }
    if (actionId === ACTION_IDS.FILE_NEW || actionId === ACTION_IDS.PROJECT_CREATE) {
      void createProject();
      return;
    }
    if (actionId === ACTION_IDS.PROJECT_OPEN) {
      void openProject();
      return;
    }
    if (actionId === ACTION_IDS.STRUCTURE_FETCH_RCSB) {
      return;
    }
    if (actionId === ACTION_IDS.STRUCTURE_ADD) {
      pendingImportModeRef.current = "add";
      fileInputRef.current?.click();
      return;
    }
    if (actionId === ACTION_IDS.SELECTION_EVALUATE || actionId === ACTION_IDS.SELECTION_CREATE_NAMED) {
      setActiveNav("Console");
      setConsoleExpanded(true);
      return;
    }
    if (actionId === ACTION_IDS.ANALYSIS_H_BONDS || actionId === ACTION_IDS.ANALYSIS_CONTACTS || actionId === ACTION_IDS.ANALYSIS_CLASH) {
      runAnalysis(actionId === ACTION_IDS.ANALYSIS_H_BONDS ? "H_BONDS" : actionId === ACTION_IDS.ANALYSIS_CONTACTS ? "CONTACTS" : "CLASH");
      return;
    }
    if (actionId === ACTION_IDS.REPRESENTATION_SURFACE && capability.state === "SUPPORTED") {
      applyStyle("van-der-waals-surface");
      return;
    }
    if (actionId === ACTION_IDS.FILE_OPEN || actionId === ACTION_IDS.FILE_IMPORT || actionId === ACTION_IDS.STRUCTURE_IMPORT) {
      fileInputRef.current?.click();
      return;
    }
    if (actionId === ACTION_IDS.FILE_SAVE || actionId === ACTION_IDS.PROJECT_SAVE) {
      void saveProject();
      return;
    }
    if (actionId === ACTION_IDS.REPRESENTATION_SET_STYLE && capability.state === "SUPPORTED") {
      setProjection((current) => {
        const supportedStyles = STYLE_DEFINITIONS.filter((definition) => representationCapabilityFor(definition.id, structure?.structure ?? null).maySelect).map((definition) => definition.id as RepresentationStyle);
        const index = supportedStyles.indexOf(current.representation);
        return setProjectionStyle(current, structure?.structure ?? null, supportedStyles[(index + 1) % supportedStyles.length]);
      });
    }
    const visibilityActions: Partial<Record<ActionId, PresentationComponent>> = {
      [ACTION_IDS.REPRESENTATION_TOGGLE_PROTEIN]: "protein",
      [ACTION_IDS.REPRESENTATION_TOGGLE_LIGAND]: "ligand",
      [ACTION_IDS.REPRESENTATION_TOGGLE_WATER]: "water",
      [ACTION_IDS.REPRESENTATION_TOGGLE_IONS]: "ions",
      [ACTION_IDS.REPRESENTATION_TOGGLE_OTHER]: "other",
    };
    const visibilityComponent = visibilityActions[actionId];
    if (visibilityComponent && capability.state === "SUPPORTED") setProjection((current) => {
      const key = ({ protein: "showProtein", ligand: "showLigand", water: "showWater", ions: "showIons", other: "showOther" } as const)[visibilityComponent];
      return applyPresentationAction(current, structure?.structure ?? null, { type: "COMPONENT_VISIBILITY.SET", component: visibilityComponent, visible: !current[key] });
    });
    if (actionId === ACTION_IDS.VIEW_RESET && capability.state === "SUPPORTED") {
      setProjection((current) => setCameraState(current, { projectionMode: DEFAULT_CAMERA.projectionMode, fov: DEFAULT_CAMERA.fov, nearClip: DEFAULT_CAMERA.nearClip, farClip: DEFAULT_CAMERA.farClip, clippingMode: "auto", view: null, defaultView: null }));
      commandSequence.current += 1;
      setCameraCommand({ actionId: ACTION_IDS.VIEW_RESET, sequence: commandSequence.current });
    }
    const cameraActions = [ACTION_IDS.VIEW_FIT, ACTION_IDS.VIEW_CENTER, ACTION_IDS.VIEW_ORIENT, ACTION_IDS.VIEW_ORIGIN] as ActionId[];
    if (cameraActions.includes(actionId) && capability.state === "SUPPORTED") {
      commandSequence.current += 1;
      setCameraCommand({ actionId, sequence: commandSequence.current });
    }
    const implementedMeasurement = actionId === ACTION_IDS.MEASURE_DISTANCE || actionId === ACTION_IDS.MEASURE_ANGLE || actionId === ACTION_IDS.MEASURE_DIHEDRAL || actionId === ACTION_IDS.MEASURE_CLEAR;
    if (actionId === ACTION_IDS.MEASURE_DISTANCE) setMeasurementMode("DISTANCE");
    if (actionId === ACTION_IDS.MEASURE_ANGLE && capability.state === "SUPPORTED") setMeasurementMode("ANGLE");
    if (actionId === ACTION_IDS.MEASURE_DIHEDRAL && capability.state === "SUPPORTED") setMeasurementMode("DIHEDRAL");
    if (actionId === ACTION_IDS.MEASURE_CLEAR && capability.state === "SUPPORTED") clearMeasurementPicks();
    if (capability.state !== "SUPPORTED" && !implementedMeasurement) showNotice(capability);
  };

  const updateCustomColor = (hex: string) => setProjection((current) => ({ ...current, color: { ...current.color, mode: "custom", customHex: hex }, colorDiagnostic: null }));
  const updateNamedColor = (colorId: string) => setProjection((current) => ({ ...current, color: { ...current.color, mode: "named", colorId }, colorDiagnostic: null }));
  const updateComponentColor = (category: "protein" | "ligand" | "water" | "ions" | "other", mode: "inherit" | "element" | "chain" | "custom", customHex?: string) => setProjection((current) => setComponentColor(current, category, mode, customHex ?? current.color.componentColors[category]?.customHex ?? "#d7e0ea"));
  const selectedAtom = structure?.structure.atoms.find((atom) => atom.stableId === (projection.interaction.pickedAtomId ?? projection.interaction.selectedAtomIds[0])) ?? null;

  return (
    <div className="app-shell">
      <input id="structure-file" ref={fileInputRef} className="visually-hidden-input" type="file" accept=".pdb,.cif,.mmcif,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }} />
      <NavRail activeItem={activeNav} onAction={handleAction} />
      <main className="app-main">
        <MenuBar activeCategory={activeRibbon} onCategory={selectRibbon} />
        <ContextToolbar activeTool={activeTool} activeCategory={activeRibbon} collapsed={ribbonCollapsed} representation={projection.representation} colorMode={projection.color.mode} onAction={handleAction} onImport={() => { pendingImportModeRef.current = "replace"; fileInputRef.current?.click(); }} onFetchRcsb={fetchRcsb} onColorMode={setColorMode} onStyleChange={applyStyle} onToggleCollapsed={() => setRibbonCollapsed((value) => !value)} />
        <div className={`workspace-grid ${leftCollapsed ? "workspace-grid--left-collapsed" : ""} ${rightCollapsed ? "workspace-grid--right-collapsed" : ""}`}>
          <StructurePanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed((value) => !value)} onAction={handleAction} structure={structure} workspaceObjects={workspaceObjects} activeObjectId={activeObjectId} onObjectSelect={activateWorkspaceObject} onObjectToggle={toggleWorkspaceObject} onObjectStateCycle={cycleObjectState} onObjectAllStatesToggle={toggleObjectAllStates} projection={projection} selectedAtom={selectedAtom} activeSelection={activeSelection} onClearSelection={clearSelection} measurementMode={measurementMode} measurementSlots={measurementSlots} measurements={measurements} onMeasurementMode={setMeasurementMode} onMeasurementVisibility={updateMeasurementVisibility} onMeasurementDelete={deleteMeasurement} onMeasurementClear={clearMeasurementPicks} analysisResults={analysisResults} loading={loadState === "loading"} error={loadError} namedSelections={namedSelections} onNamedSelectionAction={handleNamedSelectionAction} />
          <MolecularCanvas structure={structure} workspaceObjects={viewerWorkspaceObjects} globalFrameIndex={globalFrameIndex} projection={projection} activeSelectionMembershipHash={activeSelection?.membershipHash} activeTool={activeTool} cameraCommand={cameraCommand} loading={loadState === "loading"} error={loadError} onAction={handleAction} onImport={() => { pendingImportModeRef.current = "replace"; fileInputRef.current?.click(); }} onFileDrop={importFile} consoleExpanded={consoleExpanded} onPick={handlePick} onHover={handleHover} onBackgroundPick={clearTransientInteraction} measurements={measurements} measurementMode={measurementMode} analysisOverlays={analysisOverlays} />
          <InspectorPanel collapsed={rightCollapsed} onToggle={() => setRightCollapsed((value) => !value)} onAction={handleAction} structure={structure} projection={projection} onColorMode={setColorMode} onStyleChange={applyStyle} onTargetStyle={onTargetStyle} targetStyles={targetStyles} onNamedColor={updateNamedColor} onCustomColor={updateCustomColor} onComponentColor={updateComponentColor} onBackgroundPreset={setBackgroundPreset} onBackgroundColor={(color) => setProjection((current) => ({ ...current, background: { preset: "Custom", color } }))} onLabelMode={setLabelMode} onLabelExpression={setLabelExpression} onLabelClear={() => setLabelMode("off")} onCameraProjection={setCameraProjection} onCameraSettings={setCameraSettings} onRepresentationSettings={setRepresentationSettings} />
        </div>
        <StatusBar apiStatus={apiStatus} structure={structure} project={project} selectedAtomCount={projection.interaction.selectedAtomIds.length} />
        {notice && <CapabilityNotice capability={notice} onClose={() => setNotice(null)} />}
        <div className="console-layer"><ConsolePanel expanded={consoleExpanded} onToggle={() => setConsoleExpanded((value) => !value)} structure={structure} namedSelections={namedSelections} onCommand={runConsoleCommand} /></div>
      </main>
    </div>
  );
};
