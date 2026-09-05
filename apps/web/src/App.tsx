import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BondOrder, ProjectRecord, StructureLoadResult } from "@molecular/contracts";
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
import { applyRepresentationToSelection, clearColorForSelection, createDefaultRenderProjection, DEFAULT_CAMERA, fromProjectPresentation, maskForStyle, setCameraState, setCategoryRepresentation, setColorForSelection, setComponentColor, setInteractionState, setLabelState, setProjectionStyle, setRepresentationColorForSelection, setRepresentationParameters, toProjectPresentation, type BackgroundPreset, type ColorMode, type RenderProjection, type RepresentationParameters, type RepresentationStyle } from "./rendering/renderProjection";
import { applyPresentationAction, type PresentationComponent } from "./rendering/presentationActions";
import { buildRenderProjectionDiagnostics } from "./rendering/renderDirectives";
import { representationTypeFor, resolveProjectedAtomColor } from "./rendering/colorSchemes";
import { STYLE_DEFINITIONS, representationCapabilityFor, representationStyleForCommand } from "./rendering/styleProfiles";
import { combineSelections, evaluateSelectionQuery, NamedSelectionStore, resolveSelection, parseRepresentationCommand, requireValidSelection, SelectionResolutionError, selectionForStableIds, type CoordinateFramePolicy, type SelectionPresentationContext, type SelectionResult } from "./interaction/selectionResolver";
import { LabelExpressionError, labelExpressionForMode, labelPlanForState, parseSafeLabelExpression, resolveSafeLabel, type LabelMode } from "./interaction/labels";
import { MeasurementAccumulator, createMeasurementObject, measurementCardinality, type MeasurementKind, type MeasurementObject } from "./interaction/measurements";
import type { PickResult } from "./interaction/picking";
import { colorRegistry } from "./rendering/colorRegistry";
import { analyzeStructure, overlaysForAnalysis, type StructuralAnalysisKind, type StructuralAnalysisResult } from "./analysis/structuralAnalysis";
import { commandHelp, isRecognizedCommandVerb, parseCommand } from "./commands/commandRegistry";
import { copyWorkspaceObject, createWorkspaceGroup, createWorkspaceObject, createWorkspaceObjectFromSelection, cycleWorkspaceObjectState, joinWorkspaceObjectStates, renameWorkspaceObject, resolveGlobalFrameState, setWorkspaceObjectAllStates, setWorkspaceObjectEnabled, setWorkspaceObjectState, splitWorkspaceObjectStates, structureForWorkspaceObjectState, updateWorkspaceGroup, workspaceScopedStableAtomId, workspaceSelectionStructure, type WorkspaceGroup, type WorkspaceObject } from "./workspace/workspaceModel";
import { createAddBondCommand, createAddHydrogensCommand, createAttachAtomCommand, createCoordinateEditCommand, createDeleteAtomsCommand, createDeleteBondCommand, createRefillHydrogensCommand, createRemoveHydrogensCommand, createReplaceAtomCommand, createReplaceBondSemanticsCommand, ScientificHistoryService, type ScientificRevision } from "./editing/editFoundation";

const canvasTools: Record<string, string> = {
  [ACTION_IDS.CANVAS_SELECT]: "Select",
  [ACTION_IDS.CANVAS_PAN]: "Pan",
  [ACTION_IDS.CANVAS_ROTATE]: "Rotate",
  [ACTION_IDS.CANVAS_ZOOM]: "Zoom",
  [ACTION_IDS.CANVAS_FOCUS]: "Focus",
};

const isAdmittedFile = (file: File) => /\.(pdb|cif|mmcif)$/i.test(file.name);
const splitCommandArguments = (value: string): string[] => {
  const parts: string[] = [];
  let start = 0;
  let quote = "";
  let braces = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) { if (char === "\\") index += 1; else if (char === quote) quote = ""; continue; }
    if (char === "\"" || char === "'") { quote = char; continue; }
    if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (char === "," && braces === 0) { parts.push(value.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
};
const supportedEditBondOrders: readonly Exclude<BondOrder, "UNKNOWN">[] = ["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"];
const parseEditBondOrder = (value: string | undefined): Exclude<BondOrder, "UNKNOWN"> | null => {
  const normalized = value?.trim().toUpperCase();
  return supportedEditBondOrders.includes(normalized as Exclude<BondOrder, "UNKNOWN">) ? normalized as Exclude<BondOrder, "UNKNOWN"> : null;
};
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
  const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [globalFrameIndex, setGlobalFrameIndex] = useState(0);
  const [coordinateFramePolicy, setCoordinateFramePolicy] = useState<CoordinateFramePolicy | null>(null);
  const [projection, setProjection] = useState<RenderProjection>(createDefaultRenderProjection());
  const projectionStateRef = useRef(projection);
  projectionStateRef.current = projection;
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
  const activePickResultRef = useRef<PickResult | null>(null);
  const workspaceObjectsRef = useRef<WorkspaceObject[]>([]);
  const workspaceGroupsRef = useRef<WorkspaceGroup[]>([]);
  const pendingImportModeRef = useRef<"replace" | "add">("replace");
  const historyServiceRef = useRef(new ScientificHistoryService());
  const analysisOverlays = useMemo(() => overlaysForAnalysis(analysisResults), [analysisResults]);
  const viewerWorkspaceObjects = useMemo(() => workspaceObjects.map((object) => object.objectId === activeObjectId ? { ...object, projection } : object), [activeObjectId, projection, workspaceObjects]);
  const activeHistoryState = activeObjectId ? historyServiceRef.current.historyState(activeObjectId) : null;

  const presentationSelectionContext = (): SelectionPresentationContext | undefined => {
    if (!viewerWorkspaceObjects.length) return undefined;
    const multiObject = viewerWorkspaceObjects.length > 1;
    const visibleStableAtomIds: string[] = [];
    const representationTokensByStableAtomId: Record<string, string[]> = {};
    const colorTokensByStableAtomId: Record<string, string[]> = {};
    const representationColorTokensByStableAtomId: Record<string, Record<string, string[]>> = {};
    const labelTokensByStableAtomId: Record<string, string[]> = {};
    const addToken = (target: Record<string, string[]>, stableId: string, token: string) => { if (!target[stableId]) target[stableId] = []; if (!target[stableId].includes(token)) target[stableId].push(token); };
    const addRepresentationTokens = (stableId: string, representation: string, styleProfile?: string) => {
      const normalized = representation.toLowerCase().replaceAll("_", "-");
      const tokens = new Set<string>([normalized, ...(styleProfile ? [styleProfile.toLowerCase().replaceAll("_", "-")] : [])]);
      const aliases: Record<string, readonly string[]> = {
        lines: ["line"], line: ["lines"], sticks: ["stick"], stick: ["sticks"], spheres: ["sphere", "space-filling"], sphere: ["spheres", "space-filling"],
        cartoon: [], ribbon: [], nonbonded: ["nonbonded-crosses"], "nb-spheres": ["nonbonded-spheres"], surface: ["van-der-waals-surface"], dots: ["dot-surface"],
      };
      for (const token of aliases[normalized] ?? []) tokens.add(token);
      for (const token of tokens) addToken(representationTokensByStableAtomId, stableId, token);
    };
    const colorTokens = (color: string): string[] => {
      const normalized = color.trim().toLowerCase();
      const tokens = new Set<string>([normalized]);
      for (const definition of colorRegistry.list()) {
        const hex = `#${definition.rgbSrgb.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`.toLowerCase();
        if (hex === normalized) { tokens.add(definition.canonicalName.toLowerCase()); tokens.add(definition.colorId.toLowerCase()); }
      }
      return [...tokens];
    };
    for (const object of viewerWorkspaceObjects) {
      if (!object.enabled) continue;
      const canonical = structureForWorkspaceObjectState(object);
      const diagnostics = buildRenderProjectionDiagnostics(canonical, object.projection);
      const canonicalAtoms = new Map(canonical.atoms.map((atom) => [atom.stableId, atom]));
      const projectedAtomIds = new Set(diagnostics.directives.flatMap((directive) => directive.targetStableAtomIds));
      const labelPlan = labelPlanForState(object.projection.labels, canonical.atoms.filter((atom) => projectedAtomIds.has(atom.stableId)));
      if (labelPlan.status === "READY" && object.projection.labels.expression) {
        for (const atom of labelPlan.atoms) {
          const scopedStableId = multiObject ? workspaceScopedStableAtomId(object.objectId, atom.stableId) : atom.stableId;
          addToken(labelTokensByStableAtomId, scopedStableId, resolveSafeLabel(object.projection.labels.expression, atom, canonical));
        }
      }
      const explicitGlobalColor = colorRegistry.cssColor(object.projection.color);
      for (const directive of diagnostics.directives) {
        for (const stableId of directive.targetStableAtomIds) {
          const scopedStableId = multiObject ? workspaceScopedStableAtomId(object.objectId, stableId) : stableId;
          if (!visibleStableAtomIds.includes(scopedStableId)) visibleStableAtomIds.push(scopedStableId);
          addRepresentationTokens(scopedStableId, directive.representation, directive.styleProfile);
          const atom = canonicalAtoms.get(stableId);
          if (!atom) continue;
          const resolvedColor = resolveProjectedAtomColor(object.projection.color, directive.representation, atom, canonical, explicitGlobalColor).color;
          for (const token of colorTokens(resolvedColor)) addToken(colorTokensByStableAtomId, scopedStableId, token);
          const explicitRepresentationColor = object.projection.color.representationOverrides[stableId]?.[representationTypeFor(directive.representation)];
          if (explicitRepresentationColor) {
            const byRepresentation = representationColorTokensByStableAtomId[scopedStableId] ?? (representationColorTokensByStableAtomId[scopedStableId] = {});
            const representationTokens = byRepresentation[directive.representation] ?? (byRepresentation[directive.representation] = []);
            for (const token of colorTokens(explicitRepresentationColor)) if (!representationTokens.includes(token)) representationTokens.push(token);
          }
        }
      }
    }
    const revision = JSON.stringify(viewerWorkspaceObjects.map((object) => ({
      objectId: object.objectId,
      enabled: object.enabled,
      stateId: object.currentStateId,
      presentationRevision: object.projection.representationState.presentationRevision,
      color: object.projection.color,
      labels: object.projection.labels,
      visibility: [object.projection.showProtein, object.projection.showLigand, object.projection.showWater, object.projection.showIons, object.projection.showOther],
      visibleStableAtomIds: multiObject ? visibleStableAtomIds.filter((stableId) => stableId.startsWith(`${object.objectId}::`)) : visibleStableAtomIds,
    })));
    return { visibleStableAtomIds, representationTokensByStableAtomId, colorTokensByStableAtomId, representationColorTokensByStableAtomId, labelTokensByStableAtomId, revision };
  };

  const setActiveSelection = (result: SelectionResult | null, pickResult: PickResult | null = null) => {
    activeSelectionResultRef.current = result;
    activePickResultRef.current = pickResult;
    setActiveSelectionState(result);
    setProjection((current) => setInteractionState(current, { selectedAtomIds: result?.stableAtomIds ?? [], pickedAtomId: null, measurementPickAtomIds: [] }));
  };

  const resetScientificHistory = useCallback(() => {
    historyServiceRef.current = new ScientificHistoryService();
  }, []);

  const registerScientificRoot = useCallback((object: WorkspaceObject) => {
    historyServiceRef.current.registerRoot(object.objectId, object.loadResult, object.currentStateId);
  }, []);

  useEffect(() => {
    let mounted = true;
    apiClient.health().then(() => mounted && setApiStatus("connected")).catch(() => mounted && setApiStatus("offline"));
    return () => { mounted = false; };
  }, []);

  useLayoutEffect(() => {
    if (!activeObjectId) return;
    // Keep the active workspace object authoritative before the canvas effects
    // run. A large 4DJW projection can otherwise let the adapter see the old
    // object presentation after the visible projection state has advanced.
    if (projectionStateRef.current !== projection) return;
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
      if (mode === "replace") resetScientificHistory();
      registerScientificRoot(workspaceObject);
      workspaceObjectsRef.current = nextWorkspace;
      setWorkspaceObjects(nextWorkspace);
       if (mode === "replace") { workspaceGroupsRef.current = []; setWorkspaceGroups([]); setCoordinateFramePolicy(null); }
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
  }, [registerScientificRoot, resetScientificHistory]);

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

  const clearInteractionForObject = (objectId: string) => {
    const selection = activeSelectionResultRef.current;
    const pick = activePickResultRef.current;
    const selectionTouchesObject = Boolean(selection?.stableAtomIds.some((stableId) => stableId.startsWith(`${objectId}::`)) || (workspaceObjectsRef.current.length === 1 && activeObjectId === objectId && selection?.stableAtomIds.length));
    const pickObjectId = pick?.pickKind === "ATOM" ? pick.atomRef.objectId : pick?.pickKind === "BOND" ? pick.bondRef.objectId : undefined;
    if (!selectionTouchesObject && pickObjectId !== objectId) return;
    activeSelectionResultRef.current = null;
    activePickResultRef.current = null;
    setActiveSelectionState(null);
    setProjection((current) => setInteractionState(current, { hoveredAtomId: null, pickedAtomId: null, selectedAtomIds: [], measurementPickAtomIds: [] }));
  };

  const setWorkspaceObjectEnabledById = (objectId: string, enabled: boolean) => {
    const target = workspaceObjectsRef.current.find((object) => object.objectId === objectId);
    if (!target || target.enabled === enabled) return;
    if (!enabled) clearInteractionForObject(objectId);
    const next = workspaceObjectsRef.current.map((object) => object.objectId === objectId ? setWorkspaceObjectEnabled(object, enabled) : object);
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
  };

  const toggleWorkspaceObject = (objectId: string) => {
    const target = workspaceObjectsRef.current.find((object) => object.objectId === objectId);
    if (target) setWorkspaceObjectEnabledById(objectId, !target.enabled);
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
      resetScientificHistory();
      workspaceObjectsRef.current = [];
      setWorkspaceObjects([]);
      workspaceGroupsRef.current = [];
      setWorkspaceGroups([]);
      setActiveObjectId(null);
      setCoordinateFramePolicy(null);
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
      resetScientificHistory();
      if (openedWorkspace[0]) registerScientificRoot(openedWorkspace[0]);
      workspaceObjectsRef.current = openedWorkspace;
      setWorkspaceObjects(openedWorkspace);
      workspaceGroupsRef.current = [];
      setWorkspaceGroups([]);
      setActiveObjectId(openedWorkspace[0]?.objectId ?? null);
      setCoordinateFramePolicy(null);
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
    if (!structure || pick.pickKind === "BACKGROUND") return;
    const pickedObjectId = pick.pickKind === "ATOM" ? pick.atomRef.objectId : pick.bondRef.objectId;
    const pickedObject = workspaceObjectsRef.current.find((object) => object.objectId === pickedObjectId || object.loadResult.structure.id === pick.structureId);
    if (!pickedObject) return;
    if (!pickedObject.enabled) {
      clearInteractionForObject(pickedObject.objectId);
      const capability = ACTION_REGISTRY[ACTION_IDS.CANVAS_SELECT];
      showNotice({ ...capability, state: "SUPPORTED_WITH_LIMITATIONS", description: `Object ${pickedObject.displayName} is OFF; enable it before picking or editing.` });
      return;
    }
    const targetStructure = pickedObject ? { ...pickedObject.loadResult, structure: structureForWorkspaceObjectState(pickedObject) } : structure;
    const stableAtomId = pick.pickKind === "ATOM" ? pick.atomRef.stableAtomId : "";
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
      if (pick.pickKind === "BOND") {
        setActiveSelection(selectionForStableIds([...pick.bondRef.endpoints], targetStructure.structure), pick);
        setProjection((current) => setInteractionState(current, { pickedAtomId: pick.bondRef.endpoints[0] ?? null, selectedAtomIds: pick.bondRef.endpoints, measurementPickAtomIds: [] }));
        return;
      }
      setActiveSelection(selectionForStableIds([stableAtomId], targetStructure.structure), pick);
      const projectedId = pickedObject ? workspaceScopedStableAtomId(pickedObject.objectId, stableAtomId) : stableAtomId;
      setProjection((current) => setInteractionState(current, { pickedAtomId: stableAtomId, selectedAtomIds: [projectedId], measurementPickAtomIds: [] }));
      return;
    }
    if (pick.pickKind !== "ATOM") return;
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
  const clearSelection = () => { activePickResultRef.current = null; setActiveSelection(null); setProjection((current) => setInteractionState(current, { hoveredAtomId: null, pickedAtomId: null, selectedAtomIds: [], measurementPickAtomIds: [] })); };
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
    const current = workspaceObjectsRef.current.length > 0 ? workspaceSelectionStructure(workspaceObjectsRef.current) : structure?.structure ?? null;
    return { structure: current, named: workspaceObjectsRef.current.length === 1 ? namedSelectionsRef.current ?? undefined : undefined, groups: workspaceGroupsRef.current, coordinateStateId: activeObject?.currentStateId, stateOrdinal: activeObject ? Math.max(1, activeObject.stateOrder.indexOf(activeObject.currentStateId) + 1) : undefined, coordinateFrame: workspaceObjectsRef.current.length > 1 ? coordinateFramePolicy ?? undefined : "LOCAL_SCIENTIFIC" as CoordinateFramePolicy, presentation: presentationSelectionContext() };
  };

  const selectionOptionsFor = (context: ReturnType<typeof commandSelectionContext>) => ({ named: context.named, groups: context.groups, coordinateStateId: context.coordinateStateId, stateOrdinal: context.stateOrdinal, coordinateFrame: context.coordinateFrame, presentation: context.presentation });

  const workspaceObjectCandidates = (name: string) => {
    const normalized = name.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    const stem = (value: string) => value.replace(/\.(?:pdb|cif|mmcif)$/i, "");
    return workspaceObjectsRef.current.filter((object) => [object.objectId, object.displayName, object.loadResult.structure.id, object.loadResult.structure.name, object.loadResult.structure.source.originalFilename].some((value) => {
      const lower = value.toLowerCase();
      return lower === normalized || stem(lower) === normalized;
    }));
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
    registerScientificRoot(object);
    const next = [...workspaceObjectsRef.current, object];
    workspaceObjectsRef.current = next;
    setWorkspaceObjects(next);
    return next;
  };

  const applyScientificRevisionToWorkspace = (revision: ScientificRevision): void => {
    activePickResultRef.current = null;
    const currentObjects = workspaceObjectsRef.current;
    const target = currentObjects.find((object) => object.objectId === revision.objectId);
    if (!target) return;
    const nextStateOrder = [...revision.stateOrder];
    const nextStateId = nextStateOrder.includes(target.currentStateId) ? target.currentStateId : revision.currentStateId;
    const nextTarget = { ...target, loadResult: revision.loadResult, stateOrder: nextStateOrder, currentStateId: nextStateId };
    const nextObjects = currentObjects.map((object) => object.objectId === revision.objectId ? nextTarget : object);
    workspaceObjectsRef.current = nextObjects;
    setWorkspaceObjects(nextObjects);
    if (revision.objectId !== activeObjectId) {
      return;
    }

    const survivingIds = activeSelectionResultRef.current?.structureId === revision.loadResult.structure.id
      ? activeSelectionResultRef.current.stableAtomIds.filter((stableId) => revision.loadResult.structure.atoms.some((atom) => atom.stableId === stableId))
      : [];
    const reboundSelection = survivingIds.length ? selectionForStableIds(survivingIds, revision.loadResult.structure) : null;
    activeSelectionResultRef.current = reboundSelection;
    setActiveSelectionState(reboundSelection);
    const projectedSelectionIds = nextObjects.length > 1 ? survivingIds.map((stableId) => workspaceScopedStableAtomId(revision.objectId, stableId)) : survivingIds;
    const baseProjection = revision.objectId === activeObjectId ? projection : nextTarget.projection;
    const nextProjection = setInteractionState(baseProjection, { selectedAtomIds: projectedSelectionIds, pickedAtomId: survivingIds[0] ?? null, hoveredAtomId: null, measurementPickAtomIds: [] });
    const oldNamedSnapshots = namedSelectionsRef.current?.list() ?? [];
    const reboundNamedSelections = new NamedSelectionStore(revision.loadResult.structure);
    for (const snapshot of oldNamedSnapshots) {
      const ids = snapshot.stableAtomIds.filter((stableId) => revision.loadResult.structure.atoms.some((atom) => atom.stableId === stableId));
      try { reboundNamedSelections.createSnapshot(snapshot.name, selectionForStableIds(ids, revision.loadResult.structure)); } catch { /* stale names remain safely unavailable in the new revision */ }
    }
    namedSelectionsRef.current = reboundNamedSelections;
    setNamedSelections(reboundNamedSelections.list().map((selection) => ({ name: selection.name, count: selection.stableAtomIds.length })));
    setStructure(nextTarget.loadResult);
    setProjection(nextProjection);
    setMeasurements((current) => current.map((measurement) => measurement.objectId === revision.objectId ? { ...measurement, status: "STALE" } : measurement));
    setAnalysisResults((current) => current.map((result) => result.status === "STALE" ? result : { ...result, status: "STALE", diagnostic: `STALE after scientific revision ${revision.revisionId}. Re-run this analysis on the restored revision.` }));
  };

  const runHistoryAction = (actionId: typeof ACTION_IDS.HISTORY_UNDO | typeof ACTION_IDS.HISTORY_REDO): ConsoleCommandResult => {
    if (!activeObjectId) return { category: "HISTORY", status: "HISTORY_UNAVAILABLE: no active workspace object is loaded." };
    const result = actionId === ACTION_IDS.HISTORY_UNDO ? historyServiceRef.current.undo(activeObjectId) : historyServiceRef.current.redo(activeObjectId);
    if (!result.ok) return { category: "HISTORY", status: `${result.code}: ${result.message}` };
    applyScientificRevisionToWorkspace(result.revision);
    return { category: "HISTORY", status: `${result.operation} restored exact scientific revision ${result.toRevisionId} · parent ${result.revision.parentRevisionId ?? "none"}.` };
  };

  const runDeterministicCoordinateEdit = (): ConsoleCommandResult => {
    if (!activeObjectId) return { category: "EDIT", status: "INVALID_EDIT_INPUT: load a structure before running the B1 integration edit." };
    const object = workspaceObjectsRef.current.find((candidate) => candidate.objectId === activeObjectId);
    const current = historyServiceRef.current.currentRevision(activeObjectId);
    const selection = activeSelectionResultRef.current;
    if (!object || !current) return { category: "EDIT", status: "HISTORY_UNAVAILABLE: the active object has no scientific revision history." };
    if (!object.enabled) return { category: "EDIT", status: `OBJECT_DISABLED: ${object.displayName} is OFF; enable the object before editing.` };
    const workspaceStructure = workspaceSelectionStructure(workspaceObjectsRef.current);
    if (!selection || !workspaceStructure || selection.structureId !== workspaceStructure.id || selection.molecularRevision !== workspaceStructure.scientificHash) return { category: "EDIT", status: "INVALID_SELECTION: select one canonical atom in the active object before running edit_test." };
    const workspaceScoped = workspaceStructure.id === "workspace";
    const scopedPrefix = `${activeObjectId}::`;
    const selectedObjectIds = workspaceScoped ? selection.stableAtomIds.filter((stableId) => stableId.startsWith(scopedPrefix)) : selection.stableAtomIds;
    if (selection.stableAtomIds.length !== 1 || selectedObjectIds.length !== 1) return { category: "EDIT", status: "AMBIGUOUS_TARGET: edit_test requires exactly one selected canonical atom in the active object." };
    const canonicalStableId = workspaceScoped ? selectedObjectIds[0].slice(scopedPrefix.length) : selectedObjectIds[0];
    const canonicalSelection = selectionForStableIds([canonicalStableId], object.loadResult.structure);
    const atom = object.loadResult.structure.atoms.find((candidate) => candidate.stableId === canonicalStableId);
    if (!atom) return { category: "EDIT", status: "TARGET_NOT_FOUND: the selected stable AtomUID is not present in the active revision." };
    const command = createCoordinateEditCommand({
      objectId: activeObjectId,
      baseRevisionId: current.revisionId,
      selectionResult: canonicalSelection,
      stateScope: { kind: "COORDINATE_STATE_ID", stateId: object.currentStateId },
      coordinates: { [atom.stableId]: { x: atom.x + 0.25, y: atom.y - 0.125, z: atom.z + 0.5 } },
      origin: { channel: "CONSOLE", actionId: "EDIT.TEST_COORDINATE", rawCommand: "edit_test" },
      provenance: { producerId: "molecular-workstation.r07.integration", producerVersion: "1" },
    });
    const result = historyServiceRef.current.execute(command);
    if (!result.ok) return { category: "EDIT", status: `${result.code}: ${result.message}` };
    applyScientificRevisionToWorkspace(result.revision);
    return { category: "EDIT", status: `COMMITTED coordinate test edit · ${result.baseRevisionId} → ${result.resultRevisionId}`, count: 1 };
  };

  type CanonicalEditTargetContext = { object: WorkspaceObject; selection: SelectionResult; atomIds: string[] };
  const localizeEditSelection = (result: SelectionResult): CanonicalEditTargetContext | ConsoleCommandResult => {
    const groups = new Map<string, string[]>();
    for (const stableId of result.stableAtomIds) {
      const separator = stableId.indexOf("::");
      const objectId = separator >= 0 ? stableId.slice(0, separator) : activeObjectId;
      const atomId = separator >= 0 ? stableId.slice(separator + 2) : stableId;
      if (!objectId) continue;
      groups.set(objectId, [...(groups.get(objectId) ?? []), atomId]);
    }
    if (groups.size > 1) return { category: "EDIT", status: "CROSS_OBJECT_TOPOLOGY_UNSUPPORTED: topology edits require one workspace object; no object changed." };
    const objectId = [...groups.keys()][0] ?? activeObjectId;
    const object = objectId ? workspaceObjectsRef.current.find((candidate) => candidate.objectId === objectId) : undefined;
    if (!object) return { category: "EDIT", status: "HISTORY_UNAVAILABLE: the selection does not resolve to a loaded workspace object." };
    if (!object.enabled) return { category: "EDIT", status: `OBJECT_DISABLED: ${object.displayName} is OFF; enable the object before editing.` };
    const atomIds = groups.get(object.objectId) ?? [];
    const selection = selectionForStableIds(atomIds, object.loadResult.structure);
    return { object, selection, atomIds };
  };

  const editSelectionFromQuery = (query: string): CanonicalEditTargetContext | ConsoleCommandResult => {
    const context = commandSelectionContext();
    if (!context.structure) return { category: "EDIT", status: "INVALID_EDIT_INPUT: load a structure before editing." };
    try {
      return localizeEditSelection(evaluateSelectionQuery(query.trim(), context.structure, selectionOptionsFor(context)));
    } catch (error) {
      return commandError(error, "EDIT");
    }
  };

  const executeTopologyEdit = (operation: "EDIT_DELETE_ATOMS" | "EDIT_ADD_BOND" | "EDIT_DELETE_BOND" | "EDIT_REPLACE_BOND_SEMANTICS", target: CanonicalEditTargetContext, order?: Exclude<BondOrder, "UNKNOWN">): ConsoleCommandResult => {
    const current = historyServiceRef.current.currentRevision(target.object.objectId);
    if (!current) return { category: "EDIT", status: "HISTORY_UNAVAILABLE: the target object has no scientific revision history." };
    const origin = { channel: "UI" as const, actionId: operation };
    const command = operation === "EDIT_DELETE_ATOMS"
      ? createDeleteAtomsCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, origin, provenance: { producerId: "molecular-workstation.r07.ui", producerVersion: "2" } })
      : operation === "EDIT_ADD_BOND"
        ? createAddBondCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, order: order ?? "SINGLE", origin, provenance: { producerId: "molecular-workstation.r07.ui", producerVersion: "2" } })
        : operation === "EDIT_DELETE_BOND"
          ? createDeleteBondCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, origin, provenance: { producerId: "molecular-workstation.r07.ui", producerVersion: "2" } })
          : createReplaceBondSemanticsCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, order: order ?? "SINGLE", origin, provenance: { producerId: "molecular-workstation.r07.ui", producerVersion: "2" } });
    const result = historyServiceRef.current.execute(command);
    if (!result.ok) return { category: "EDIT", status: `${result.code}: ${result.message}` };
    applyScientificRevisionToWorkspace(result.revision);
    setActiveSelection(null);
    const description = operation === "EDIT_DELETE_ATOMS" ? `deleted ${target.atomIds.length} atom${target.atomIds.length === 1 ? "" : "s"}` : operation === "EDIT_ADD_BOND" ? `created ${order ?? "SINGLE"} bond` : operation === "EDIT_DELETE_BOND" ? "deleted canonical bond" : `replaced bond order with ${order ?? "SINGLE"}`;
    return { category: "EDIT", status: `COMMITTED ${description} · ${result.baseRevisionId} → ${result.resultRevisionId}`, count: target.atomIds.length };
  };

  const runTopologyCommand = (verb: "remove" | "bond" | "unbond" | "set_bond", parsedArgument: string, parsedTarget: string | null): ConsoleCommandResult => {
    const parts = splitCommandArguments([parsedArgument, parsedTarget ?? ""].filter(Boolean).join(", "));
    if (verb === "remove") {
      if (parsedTarget) return { category: "EDIT", status: "remove accepts one canonical selection expression; no topology changed." };
      const target = editSelectionFromQuery(parsedArgument);
      if ("category" in target) return target;
      return executeTopologyEdit("EDIT_DELETE_ATOMS", target);
    }
    const expected = verb === "bond" ? [2, 3] : verb === "unbond" ? [2] : [4];
    const validArity = expected.length === 2 ? (parts.length === expected[0] || parts.length === expected[1]) : parts.length === expected[0];
    if (!validArity) return { category: "EDIT", status: verb === "bond" ? "bond requires `bond <selection1>, <selection2>[, single|double|triple|aromatic]`." : verb === "unbond" ? "unbond requires `unbond <selection1>, <selection2>`." : "set_bond requires `set_bond order, <single|double|triple|aromatic>, <selection1>, <selection2>`." };
    const offset = verb === "set_bond" ? 2 : 0;
    const order = verb === "bond" ? parseEditBondOrder(parts[2]) ?? (parts.length === 2 ? "SINGLE" : null) : verb === "set_bond" ? parseEditBondOrder(parts[1]) : undefined;
    if ((verb === "bond" || verb === "set_bond") && !order) return { category: "EDIT", status: "UNSUPPORTED_BOND_ORDER: supported values are SINGLE, DOUBLE, TRIPLE, and AROMATIC." };
    const left = editSelectionFromQuery(parts[offset]);
    if ("category" in left) return left;
    const right = editSelectionFromQuery(parts[offset + 1]);
    if ("category" in right) return right;
    if (left.atomIds.length !== 1 || right.atomIds.length !== 1) return { category: "EDIT", status: "AMBIGUOUS_TARGET: bond operations require two exact singleton endpoint selections." };
    if (left.object.objectId !== right.object.objectId) return { category: "EDIT", status: "CROSS_OBJECT_TOPOLOGY_UNSUPPORTED: bond endpoints must belong to one canonical object; no topology changed." };
    const selection = combineSelections(left.selection, right.selection, "add");
    return executeTopologyEdit(verb === "bond" ? "EDIT_ADD_BOND" : verb === "unbond" ? "EDIT_DELETE_BOND" : "EDIT_REPLACE_BOND_SEMANTICS", { object: left.object, selection, atomIds: [left.atomIds[0]!, right.atomIds[0]!] }, order ?? undefined);
  };

  const runTopologyAction = (actionId: typeof ACTION_IDS.EDIT_ATOM_DELETE | typeof ACTION_IDS.EDIT_BOND_CREATE | typeof ACTION_IDS.EDIT_BOND_DELETE, order?: Exclude<BondOrder, "UNKNOWN">): ConsoleCommandResult => {
    const result = activeSelectionResultRef.current ? localizeEditSelection(activeSelectionResultRef.current) : { category: "EDIT" as const, status: "INVALID_SELECTION: select the exact canonical atom target(s) before editing." };
    if ("category" in result) return result;
    const operation = actionId === ACTION_IDS.EDIT_ATOM_DELETE ? "EDIT_DELETE_ATOMS" : actionId === ACTION_IDS.EDIT_BOND_CREATE ? "EDIT_ADD_BOND" : "EDIT_DELETE_BOND";
    if (operation !== "EDIT_DELETE_ATOMS" && result.atomIds.length !== 2) return { category: "EDIT", status: "AMBIGUOUS_TARGET: bond editing requires exactly two selected endpoint atoms." };
    return executeTopologyEdit(operation, result, order);
  };

  const runBondOrderAction = (order: Exclude<BondOrder, "UNKNOWN">): ConsoleCommandResult => {
    const result = activeSelectionResultRef.current ? localizeEditSelection(activeSelectionResultRef.current) : { category: "EDIT" as const, status: "INVALID_SELECTION: select exactly two canonical endpoint atoms before changing bond order." };
    if ("category" in result) return result;
    if (result.atomIds.length !== 2) return { category: "EDIT", status: "AMBIGUOUS_TARGET: bond order editing requires exactly two selected endpoint atoms." };
    return executeTopologyEdit("EDIT_REPLACE_BOND_SEMANTICS", result, order);
  };

  type ChemistryEditOperation = "EDIT_ADD_HYDROGENS" | "EDIT_REFILL_HYDROGENS" | "EDIT_REMOVE_HYDROGENS" | "EDIT_ADD_ATOM_AND_BOND" | "EDIT_REPLACE_ATOM";
  const executeChemistryEdit = (operation: ChemistryEditOperation, target: CanonicalEditTargetContext, element?: string): ConsoleCommandResult => {
    const current = historyServiceRef.current.currentRevision(target.object.objectId);
    if (!current) return { category: "EDIT", status: "HISTORY_UNAVAILABLE: the target object has no scientific revision history." };
    const pick = activePickResultRef.current;
    const command = operation === "EDIT_ADD_HYDROGENS"
      ? createAddHydrogensCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, pickResult: pick ?? undefined, origin: { channel: "UI", actionId: ACTION_IDS.EDIT_HYDROGEN_ADD }, provenance: { producerId: "molecular-workstation.r07.b3.ui", producerVersion: "1" } })
      : operation === "EDIT_REFILL_HYDROGENS"
        ? createRefillHydrogensCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, bondIds: pick?.pickKind === "BOND" ? [pick.bondRef.bondId] : undefined, pickResult: pick ?? undefined, origin: { channel: "UI", actionId: ACTION_IDS.EDIT_HYDROGEN_REFILL }, provenance: { producerId: "molecular-workstation.r07.b3.ui", producerVersion: "1" } })
        : operation === "EDIT_REMOVE_HYDROGENS"
          ? createRemoveHydrogensCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, origin: { channel: "UI", actionId: ACTION_IDS.EDIT_HYDROGEN_REMOVE }, provenance: { producerId: "molecular-workstation.r07.b3.ui", producerVersion: "1" } })
          : operation === "EDIT_ADD_ATOM_AND_BOND"
            ? createAttachAtomCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, pickResult: pick ?? undefined, element: element ?? "H", bondOrder: "SINGLE", valence: 1, geometry: "deterministic-local-frame", origin: { channel: "UI", actionId: ACTION_IDS.EDIT_ATOM_ATTACH }, provenance: { producerId: "molecular-workstation.r07.b3.ui", producerVersion: "1" } })
            : createReplaceAtomCommand({ objectId: target.object.objectId, baseRevisionId: current.revisionId, selectionResult: target.selection, atomIds: target.atomIds, pickResult: pick ?? undefined, element: element ?? "N", hFill: true, origin: { channel: "UI", actionId: ACTION_IDS.EDIT_ATOM_REPLACE }, provenance: { producerId: "molecular-workstation.r07.b3.ui", producerVersion: "1" } });
    const result = historyServiceRef.current.execute(command);
    if (!result.ok) return { category: "EDIT", status: `${result.code}: ${result.message}` };
    applyScientificRevisionToWorkspace(result.revision);
    clearSelection();
    return { category: "EDIT", status: `COMMITTED ${operation.replace("EDIT_", "").toLowerCase().replaceAll("_", " ")} · ${result.baseRevisionId} → ${result.resultRevisionId}`, count: result.revision.loadResult.structure.atoms.length };
  };

  const chemistrySelectionFromQuery = (query: string | null, fallbackMessage: string): CanonicalEditTargetContext | ConsoleCommandResult => {
    if (query?.trim()) return editSelectionFromQuery(query);
    const result = activeSelectionResultRef.current ? localizeEditSelection(activeSelectionResultRef.current) : { category: "EDIT" as const, status: `INVALID_SELECTION: ${fallbackMessage}` };
    return result;
  };

  const runChemistryCommand = (verb: "h_add" | "h_fill" | "h_remove" | "attach" | "replace", parsedArgument: string, parsedTarget: string | null): ConsoleCommandResult => {
    if (verb === "attach" || verb === "replace") {
      const element = parsedArgument.trim().toUpperCase();
      if (!element || !parsedTarget) return { category: "EDIT", status: `${verb} requires '${verb} <element>, <exact parent selection>'; no chemistry changed.` };
      const target = chemistrySelectionFromQuery(parsedTarget, "select one exact parent AtomUID before attaching or replacing an atom.");
      if ("category" in target) return target;
      return executeChemistryEdit(verb === "attach" ? "EDIT_ADD_ATOM_AND_BOND" : "EDIT_REPLACE_ATOM", target, element);
    }
    const target = chemistrySelectionFromQuery(parsedArgument, `${verb} requires an exact canonical atom/bond selection.`);
    if ("category" in target) return target;
    return executeChemistryEdit(verb === "h_add" ? "EDIT_ADD_HYDROGENS" : verb === "h_fill" ? "EDIT_REFILL_HYDROGENS" : "EDIT_REMOVE_HYDROGENS", target);
  };

  const runChemistryAction = (actionId: typeof ACTION_IDS.EDIT_HYDROGEN_ADD | typeof ACTION_IDS.EDIT_HYDROGEN_REFILL | typeof ACTION_IDS.EDIT_HYDROGEN_REMOVE | typeof ACTION_IDS.EDIT_ATOM_ATTACH | typeof ACTION_IDS.EDIT_ATOM_REPLACE): ConsoleCommandResult => {
    const result = chemistrySelectionFromQuery(null, "select the exact canonical target before editing.");
    if ("category" in result) return result;
    const operation = actionId === ACTION_IDS.EDIT_HYDROGEN_ADD ? "EDIT_ADD_HYDROGENS" : actionId === ACTION_IDS.EDIT_HYDROGEN_REFILL ? "EDIT_REFILL_HYDROGENS" : actionId === ACTION_IDS.EDIT_HYDROGEN_REMOVE ? "EDIT_REMOVE_HYDROGENS" : actionId === ACTION_IDS.EDIT_ATOM_ATTACH ? "EDIT_ADD_ATOM_AND_BOND" : "EDIT_REPLACE_ATOM";
    return executeChemistryEdit(operation, result, operation === "EDIT_ADD_ATOM_AND_BOND" ? "H" : operation === "EDIT_REPLACE_ATOM" ? "N" : undefined);
  };

  const resolveWorkspaceGroup = (name: string) => {
    const normalized = name.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    const candidates = workspaceGroupsRef.current.filter((group) => group.groupId.toLowerCase() === normalized || group.name.toLowerCase() === normalized);
    return { group: candidates.length === 1 ? candidates[0] : undefined, ambiguous: candidates.length > 1 };
  };

  const setWorkspaceGroupsSafe = (groups: WorkspaceGroup[]) => {
    workspaceGroupsRef.current = groups;
    setWorkspaceGroups(groups);
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
        const result = requireValidSelection(evaluateSelectionQuery(trimmed, context.structure, selectionOptionsFor(context)));
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
    if (parsed.verb === "history") {
      if (!activeObjectId) return { category: "HISTORY", status: "HISTORY_UNAVAILABLE: no active workspace object is loaded." };
      const history = historyServiceRef.current.historyState(activeObjectId);
      return { category: "HISTORY", status: history ? JSON.stringify(history) : "HISTORY_UNAVAILABLE: no retained history is available for the active object." };
    }
    if (parsed.verb === "undo") return runHistoryAction(ACTION_IDS.HISTORY_UNDO);
    if (parsed.verb === "redo") return runHistoryAction(ACTION_IDS.HISTORY_REDO);
    if (parsed.verb === "edit_test") return runDeterministicCoordinateEdit();
    if (parsed.verb === "remove" || parsed.verb === "bond" || parsed.verb === "unbond" || parsed.verb === "set_bond") return runTopologyCommand(parsed.verb, parsed.argument, parsed.target);
    if (parsed.verb === "h_add" || parsed.verb === "h_fill" || parsed.verb === "h_remove" || parsed.verb === "attach" || parsed.verb === "replace") return runChemistryCommand(parsed.verb, parsed.argument, parsed.target);
    if (parsed.verb === "coordinate_frame") {
      const value = parsed.argument.trim().toLowerCase();
      const policy = value === "local_scientific" ? "LOCAL_SCIENTIFIC" : value === "effective_world" ? "EFFECTIVE_WORLD" : null;
      if (!policy) return { category: "SELECTION", status: "coordinate_frame accepts only local_scientific or effective_world; the current frame declaration was preserved." };
      setCoordinateFramePolicy(policy);
      return { category: "SELECTION", status: `Declared ${policy} coordinate context for cross-object spatial selection. ${policy === "EFFECTIVE_WORLD" ? "Current workspace object transforms are identity, so canonical coordinates are used." : "Raw canonical coordinates are compared in their declared local scientific frame."}` };
    }
    if (parsed.verb === "set") {
      const representation = parsed.argument.trim().toLowerCase();
      if (representation !== "cartoon_color" && representation !== "ribbon_color") return { category: "PRESENTATION", status: `Setting ${parsed.argument} is not implemented in the current bounded presentation gate; no state changed.` };
      const setting = parsed.target?.match(/^([^,]+?)(?:\s*,\s*(.+))?$/);
      if (!setting) return { category: "PRESENTATION", status: `set ${representation} requires set ${representation}, <color>, <query>; no state changed.` };
      const color = colorRegistry.resolveInputWithDiagnostic(setting[1].trim());
      if (!color.definition) return { category: "PRESENTATION", status: "COLOR_NOT_FOUND" };
      const context = commandSelectionContext();
      if (!context.structure) return { category: "PRESENTATION", status: "No structure loaded; representation color was not changed." };
      const target = requireValidSelection(resolveSelection(setting[2]?.trim() || "all", context.structure, selectionOptionsFor(context)));
      const colorHex = `#${color.definition.rgbSrgb.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;
      const representationType = representation === "cartoon_color" ? "CARTOON" : "RIBBON";
      updateWorkspaceProjections(target.stableAtomIds, (current, objectStableIds) => setRepresentationColorForSelection(current, objectStableIds, representationType, colorHex));
      return { category: "PRESENTATION", status: `Applied ${color.definition.canonicalName} to ${target.stableAtomIds.length} ${representationType} atoms.` };
    }
    if (parsed.verb === "select") {
      const context = commandSelectionContext();
      if (!context.structure) return { category: "SELECTION", status: "No structure loaded; selection was not changed." };
      try {
        const namedMatch = trimmed.match(/^select\s+([A-Za-z_][A-Za-z0-9_]*)\s*,\s*(.+)$/i);
        const operationMatch = trimmed.match(/^select(?:\s+(replace|add|subtract|intersect))?\s+(.+)$/i);
        if (namedMatch) {
          const result = requireValidSelection(evaluateSelectionQuery(namedMatch[2], context.structure, selectionOptionsFor(context)));
          const snapshot = namedSelectionsRef.current?.createSnapshot(namedMatch[1], result);
          if (snapshot) setNamedSelections(namedSelectionsRef.current?.list().map((selection) => ({ name: selection.name, count: selection.stableAtomIds.length })) ?? []);
          setActiveSelection(result);
          setProjection((current) => setInteractionState(current, { selectedAtomIds: result.stableAtomIds, pickedAtomId: result.stableAtomIds[0] ?? null, measurementPickAtomIds: [] }));
          return { category: "SELECTION", status: `Named selection ${namedMatch[1]} created · ${result.count} atoms.` };
        }
        const query = operationMatch?.[2]?.trim() || "all";
        const operation = (operationMatch?.[1]?.toLowerCase() ?? "replace") as "replace" | "add" | "subtract" | "intersect";
        const target = requireValidSelection(evaluateSelectionQuery(query, context.structure, selectionOptionsFor(context)));
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
      setWorkspaceObjectEnabledById(target.objectId, enabled);
      return { category: "OBJECT", status: `${enabled ? "Enabled" : "Disabled"} object ${target.displayName}; canonical structure preserved.` };
    }
    if (parsed.verb === "state") {
      if (!parsed.target && /^\d+$/.test(parsed.argument.trim())) {
        const context = commandSelectionContext();
        if (!context.structure) return { category: "SELECTION", status: "No structure loaded; state selection was not changed." };
        try {
          const result = requireValidSelection(evaluateSelectionQuery(`state ${parsed.argument.trim()}`, context.structure, selectionOptionsFor(context)));
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
    if (parsed.verb === "group") {
      const groupInput = parsed.argument.trim();
      const subcommand = groupInput.match(/^(\S+)(?:\s+(.+))?$/s);
      const action = subcommand?.[1]?.toLowerCase() ?? "";
      const name = subcommand?.[2]?.trim() ?? "";
      if (!subcommand) return { category: "OBJECT", status: "group requires create, add, remove, open, close, toggle, or empty." };
      if (action === "create") {
        if (parsed.target) return { category: "OBJECT", status: "group create accepts only a name; no group was created." };
        const created = createWorkspaceGroup(name, workspaceGroupsRef.current.map((group) => group.groupId));
        if (!created.ok) return { category: "OBJECT", status: created.message };
        setWorkspaceGroupsSafe([...workspaceGroupsRef.current, created.value]);
        return { category: "OBJECT", status: `Created workspace group ${created.value.name}.` };
      }
      if (["purge", "excise", "delete"].includes(action)) return { category: "OBJECT", status: `group ${action} is unavailable because destructive group lifecycle is not enabled; no group or object changed.` };
      const targetGroup = resolveWorkspaceGroup(name);
      if (targetGroup.ambiguous) return { category: "OBJECT", status: `Group reference ${name} is ambiguous; use a durable GroupID and no group state changed.` };
      if (!targetGroup.group) return { category: "OBJECT", status: `Group ${name} does not exist; no group state changed.` };
      if (action === "add" || action === "remove") {
        if (!parsed.target) return { category: "OBJECT", status: `group ${action} requires a group and object target; no group state changed.` };
        const resolvedObject = resolveWorkspaceObject(parsed.target);
        if (resolvedObject.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.target) };
        if (!resolvedObject.object) return { category: "OBJECT", status: `Object ${parsed.target} does not exist; no group state changed.` };
        const memberIds = new Set(targetGroup.group.objectIds);
        if (action === "add") memberIds.add(resolvedObject.object.objectId); else memberIds.delete(resolvedObject.object.objectId);
        setWorkspaceGroupsSafe(workspaceGroupsRef.current.map((group) => group.groupId === targetGroup.group!.groupId ? updateWorkspaceGroup(group, { objectIds: [...memberIds] }) : group));
        return { category: "OBJECT", status: `${action === "add" ? "Added" : "Removed"} ${resolvedObject.object.displayName} ${action === "add" ? "to" : "from"} group ${targetGroup.group.name}.` };
      }
      if (["open", "close", "toggle", "empty"].includes(action)) {
        const nextOpen = action === "open" ? true : action === "close" ? false : action === "toggle" ? !targetGroup.group.open : targetGroup.group.open;
        const nextMembers = action === "empty" ? [] : targetGroup.group.objectIds;
        setWorkspaceGroupsSafe(workspaceGroupsRef.current.map((group) => group.groupId === targetGroup.group!.groupId ? updateWorkspaceGroup(group, { open: nextOpen, objectIds: nextMembers }) : group));
        return { category: "OBJECT", status: action === "empty" ? `Emptied group ${targetGroup.group.name}; objects remain loaded.` : `${nextOpen ? "Opened" : "Closed"} group ${targetGroup.group.name}.` };
      }
      return { category: "OBJECT", status: `Unknown group action ${action}; no group state changed.` };
    }
    if (parsed.verb === "copy" || parsed.verb === "create" || parsed.verb === "split_states" || parsed.verb === "join_states") {
      if (parsed.verb === "create") {
        if (!parsed.target) return { category: "OBJECT", status: "create requires `create target, selection`; no object was created." };
        const context = commandSelectionContext();
        if (!context.structure) return { category: "OBJECT", status: "No structure loaded; no object was created." };
        try {
          const result = requireValidSelection(evaluateSelectionQuery(parsed.target, context.structure, selectionOptionsFor(context)));
          const scopedObjectIds = new Set(result.stableAtomIds.map((stableId) => stableId.includes("::") ? stableId.split("::", 1)[0] : activeObjectId).filter((value): value is string => Boolean(value)));
          if (scopedObjectIds.size > 1) return { category: "OBJECT", status: "create requires a selection from one workspace object; cross-object creation is not supported and no object was created." };
          const source = [...scopedObjectIds][0] ? workspaceObjectsRef.current.find((object) => object.objectId === [...scopedObjectIds][0]) : workspaceObjectsRef.current.find((object) => object.objectId === activeObjectId);
          if (!source) return { category: "OBJECT", status: "create could not resolve one source workspace object; no object was created." };
          const canonicalIds = result.stableAtomIds.map((stableId) => stableId.startsWith(`${source.objectId}::`) ? stableId.slice(source.objectId.length + 2) : stableId);
          const created = createWorkspaceObjectFromSelection(source, canonicalIds, parsed.argument, workspaceObjectsRef.current.map((object) => object.objectId));
          if (!created.ok) return { category: "OBJECT", status: created.message };
          appendWorkspaceObject(created.value);
          setActiveObjectId(created.value.objectId);
          setStructure(created.value.loadResult);
          setProjection(created.value.projection);
          namedSelectionsRef.current = new NamedSelectionStore(created.value.loadResult.structure);
          setNamedSelections([]);
          setActiveSelection(null);
          return { category: "OBJECT", status: `Created ${created.value.displayName} from ${result.count} canonical atoms with new identities; source object preserved.`, count: result.count };
        } catch (error) { return commandError(error, "OBJECT"); }
      }
      if (parsed.verb === "split_states") {
        const resolved = resolveWorkspaceObject(parsed.argument);
        if (resolved.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.argument) };
        if (!resolved.object) return { category: "OBJECT", status: `Object ${parsed.argument} does not exist; split_states made no changes.` };
        const split = splitWorkspaceObjectStates(resolved.object, parsed.target, workspaceObjectsRef.current.map((object) => object.objectId));
        if (!split.ok) return { category: "OBJECT", status: split.message };
        split.value.forEach((object) => registerScientificRoot(object));
        const next = [...workspaceObjectsRef.current, ...split.value];
        workspaceObjectsRef.current = next;
        setWorkspaceObjects(next);
        const first = split.value[0]!;
        setActiveObjectId(first.objectId);
        setStructure(first.loadResult);
        setProjection(first.projection);
        namedSelectionsRef.current = new NamedSelectionStore(first.loadResult.structure);
        setNamedSelections([]);
        setActiveSelection(null);
        return { category: "OBJECT", status: `Split ${resolved.object.displayName} into ${split.value.length} new one-state object${split.value.length === 1 ? "" : "s"}; source object preserved.`, count: split.value.length };
      }
      if (parsed.verb === "join_states") {
        if (!parsed.target) return { category: "OBJECT", status: "join_states requires `join_states object, other`; no object was created." };
        const left = resolveWorkspaceObject(parsed.argument);
        const right = resolveWorkspaceObject(parsed.target);
        if (left.ambiguous || right.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(left.ambiguous ? parsed.argument : parsed.target) };
        if (!left.object || !right.object) return { category: "OBJECT", status: "join_states requires two existing unambiguous workspace objects; no object was created." };
        const joined = joinWorkspaceObjectStates(left.object, right.object, workspaceObjectsRef.current.map((object) => object.objectId));
        if (!joined.ok) return { category: "OBJECT", status: joined.message };
        appendWorkspaceObject(joined.value);
        setActiveObjectId(joined.value.objectId);
        setStructure(joined.value.loadResult);
        setProjection(joined.value.projection);
        namedSelectionsRef.current = new NamedSelectionStore(joined.value.loadResult.structure);
        setNamedSelections([]);
        setActiveSelection(null);
        return { category: "OBJECT", status: `Joined ${left.object.displayName} and ${right.object.displayName} into ${joined.value.displayName} with strict atom/topology correspondence; sources preserved.`, count: joined.value.stateOrder.length };
      }
      if (!parsed.target) return { category: "OBJECT", status: "copy requires `copy target, source` and an existing unambiguous source object." };
      const sourceResolution = resolveWorkspaceObject(parsed.target);
      if (sourceResolution.ambiguous) return { category: "OBJECT", status: ambiguousObjectStatus(parsed.target) };
      if (!sourceResolution.object) return { category: "OBJECT", status: `Source object ${parsed.target} does not exist; copy made no changes.` };
      const targetResolution = resolveWorkspaceObject(parsed.argument);
      if (targetResolution.object || targetResolution.ambiguous) return { category: "OBJECT", status: `Target object name ${parsed.argument} is already in use; copy made no changes.` };
      const copied = copyWorkspaceObject(sourceResolution.object, parsed.argument, workspaceObjectsRef.current.map((object) => object.objectId));
      appendWorkspaceObject(copied);
      return { category: "OBJECT", status: `Copied ${sourceResolution.object.displayName} to ${copied.displayName}; canonical source and state order preserved.` };
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
        const target = resolveSelection(representationCommand.query, context.structure, selectionOptionsFor(context));
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
          const target = resolveSelection(colorMatch[2]?.trim() || "all", context.structure, selectionOptionsFor(context));
          updateWorkspaceProjections(target.stableAtomIds, (current, objectStableIds) => clearColorForSelection(current, objectStableIds));
          return { category: "PRESENTATION", status: `Cleared explicit colors for ${target.stableAtomIds.length} atoms; inherited scheme restored.` };
        }
        const color = colorRegistry.resolveInputWithDiagnostic(colorMatch[1].trim());
        if (!color.definition) return { category: "PRESENTATION", status: "COLOR_NOT_FOUND" };
        const context = commandSelectionContext();
        if (!context.structure) return { category: "PRESENTATION", status: "No structure loaded; color was not changed." };
        const target = resolveSelection(colorMatch[2]?.trim() || "all", context.structure, selectionOptionsFor(context));
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
    if (actionId === ACTION_IDS.HISTORY_UNDO || actionId === ACTION_IDS.HISTORY_REDO) {
      const result = runHistoryAction(actionId);
      setNotice({ ...capability, state: result.status.startsWith("UNDO") || result.status.startsWith("REDO") || result.status.startsWith("HISTORY") ? "SUPPORTED_WITH_LIMITATIONS" : capability.state, description: result.status });
      return;
    }
    if (actionId === ACTION_IDS.EDIT_ATOM_DELETE || actionId === ACTION_IDS.EDIT_BOND_CREATE || actionId === ACTION_IDS.EDIT_BOND_DELETE) {
      const result = runTopologyAction(actionId);
      setNotice({ ...capability, state: result.status.startsWith("COMMITTED") ? "SUPPORTED" : "SUPPORTED_WITH_LIMITATIONS", description: result.status });
      return;
    }
    if (actionId === ACTION_IDS.EDIT_HYDROGEN_ADD || actionId === ACTION_IDS.EDIT_HYDROGEN_REFILL || actionId === ACTION_IDS.EDIT_HYDROGEN_REMOVE || actionId === ACTION_IDS.EDIT_ATOM_ATTACH || actionId === ACTION_IDS.EDIT_ATOM_REPLACE) {
      const result = runChemistryAction(actionId);
      setNotice({ ...capability, state: result.status.startsWith("COMMITTED") ? "SUPPORTED" : "SUPPORTED_WITH_LIMITATIONS", description: result.status });
      return;
    }
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
  const handleBondOrderAction = (order: Exclude<BondOrder, "UNKNOWN">) => {
    const result = runBondOrderAction(order);
    const capability = ACTION_REGISTRY[ACTION_IDS.EDIT_BOND_ORDER_SET];
    setNotice({ ...capability, state: result.status.startsWith("COMMITTED") ? "SUPPORTED" : "SUPPORTED_WITH_LIMITATIONS", description: result.status });
  };
  const activeWorkspaceObject = workspaceObjects.find((object) => object.objectId === activeObjectId);
  const editTargetObject = (() => {
    if (!activeSelection) return activeWorkspaceObject;
    const targetObjectIds = new Set(activeSelection.stableAtomIds.map((stableId) => stableId.includes("::") ? stableId.slice(0, stableId.indexOf("::")) : activeObjectId).filter((objectId): objectId is string => Boolean(objectId)));
    return targetObjectIds.size === 1 ? workspaceObjects.find((object) => object.objectId === [...targetObjectIds][0]) : undefined;
  })();
  const editSelectionReady = Boolean(activeSelection && editTargetObject?.enabled);
  const inspectorObject = editTargetObject ?? activeWorkspaceObject;
  const inspectorStructure = inspectorObject ? structureForWorkspaceObjectState(inspectorObject) : structure?.structure;
  const inspectorAtomId = projection.interaction.pickedAtomId ?? projection.interaction.selectedAtomIds[0];
  const inspectorCanonicalAtomId = inspectorAtomId?.includes("::") ? inspectorAtomId.slice(inspectorAtomId.indexOf("::") + 2) : inspectorAtomId;
  const selectedAtom = inspectorStructure?.atoms.find((atom) => atom.stableId === inspectorCanonicalAtomId) ?? null;

  return (
    <div className="app-shell">
      <input id="structure-file" ref={fileInputRef} className="visually-hidden-input" type="file" accept=".pdb,.cif,.mmcif,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }} />
      <NavRail activeItem={activeNav} onAction={handleAction} />
      <main className="app-main">
        <MenuBar activeCategory={activeRibbon} onCategory={selectRibbon} />
        <ContextToolbar activeTool={activeTool} activeCategory={activeRibbon} collapsed={ribbonCollapsed} representation={projection.representation} colorMode={projection.color.mode} onAction={handleAction} onImport={() => { pendingImportModeRef.current = "replace"; fileInputRef.current?.click(); }} onFetchRcsb={fetchRcsb} onColorMode={setColorMode} onStyleChange={applyStyle} onToggleCollapsed={() => setRibbonCollapsed((value) => !value)} editSelectionCount={activeSelection?.stableAtomIds.length ?? 0} editObjectName={editTargetObject?.displayName ?? activeWorkspaceObject?.displayName} editSelectionReady={editSelectionReady} canUndo={activeHistoryState?.canUndo} canRedo={activeHistoryState?.canRedo} onEditBondOrder={handleBondOrderAction} />
        <div className={`workspace-grid ${leftCollapsed ? "workspace-grid--left-collapsed" : ""} ${rightCollapsed ? "workspace-grid--right-collapsed" : ""}`}>
          <StructurePanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed((value) => !value)} onAction={handleAction} structure={structure} workspaceObjects={workspaceObjects} workspaceGroups={workspaceGroups} activeObjectId={activeObjectId} coordinateFramePolicy={coordinateFramePolicy} onCoordinateFrameChange={setCoordinateFramePolicy} onObjectSelect={activateWorkspaceObject} onObjectToggle={toggleWorkspaceObject} onObjectStateCycle={cycleObjectState} onObjectAllStatesToggle={toggleObjectAllStates} projection={projection} selectedAtom={selectedAtom} activeSelection={activeSelection} onClearSelection={clearSelection} measurementMode={measurementMode} measurementSlots={measurementSlots} measurements={measurements} onMeasurementMode={setMeasurementMode} onMeasurementVisibility={updateMeasurementVisibility} onMeasurementDelete={deleteMeasurement} onMeasurementClear={clearMeasurementPicks} analysisResults={analysisResults} loading={loadState === "loading"} error={loadError} namedSelections={namedSelections} onNamedSelectionAction={handleNamedSelectionAction} />
          <MolecularCanvas structure={structure} workspaceObjects={viewerWorkspaceObjects} globalFrameIndex={globalFrameIndex} projection={projection} activeSelectionMembershipHash={activeSelection?.membershipHash} activeTool={activeTool} cameraCommand={cameraCommand} loading={loadState === "loading"} error={loadError} onAction={handleAction} onImport={() => { pendingImportModeRef.current = "replace"; fileInputRef.current?.click(); }} onFileDrop={importFile} consoleExpanded={consoleExpanded} onPick={handlePick} onHover={handleHover} onBackgroundPick={clearTransientInteraction} measurements={measurements} measurementMode={measurementMode} analysisOverlays={analysisOverlays} />
          <InspectorPanel collapsed={rightCollapsed} onToggle={() => setRightCollapsed((value) => !value)} onAction={handleAction} structure={structure} projection={projection} onColorMode={setColorMode} onStyleChange={applyStyle} onTargetStyle={onTargetStyle} targetStyles={targetStyles} onNamedColor={updateNamedColor} onCustomColor={updateCustomColor} onComponentColor={updateComponentColor} onBackgroundPreset={setBackgroundPreset} onBackgroundColor={(color) => setProjection((current) => ({ ...current, background: { preset: "Custom", color } }))} onLabelMode={setLabelMode} onLabelExpression={setLabelExpression} onLabelClear={() => setLabelMode("off")} onCameraProjection={setCameraProjection} onCameraSettings={setCameraSettings} onRepresentationSettings={setRepresentationSettings} />
        </div>
        <StatusBar apiStatus={apiStatus} structure={structure} project={project} selectedAtomCount={projection.interaction.selectedAtomIds.length} scientificRevision={activeHistoryState?.currentRevisionId ?? null} canUndo={activeHistoryState?.canUndo} canRedo={activeHistoryState?.canRedo} activeObjectName={activeWorkspaceObject?.displayName} activeObjectId={activeWorkspaceObject?.objectId} activeObjectEnabled={activeWorkspaceObject?.enabled} />
        {notice && <CapabilityNotice capability={notice} onClose={() => setNotice(null)} />}
        <div className="console-layer"><ConsolePanel expanded={consoleExpanded} onToggle={() => setConsoleExpanded((value) => !value)} structure={structure} namedSelections={namedSelections} onCommand={runConsoleCommand} /></div>
      </main>
    </div>
  );
};
