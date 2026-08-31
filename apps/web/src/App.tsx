import { useEffect, useRef, useState } from "react";
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
import { applyRepresentationToSelection, createDefaultRenderProjection, DEFAULT_CAMERA, fromProjectPresentation, maskForStyle, setCameraState, setCategoryRepresentation, setColorForSelection, setInteractionState, setLabelState, setProjectionStyle, setRepresentationParameters, toProjectPresentation, type BackgroundPreset, type ColorMode, type RenderProjection, type RepresentationParameters, type RepresentationStyle } from "./rendering/renderProjection";
import { applyPresentationAction, type PresentationComponent } from "./rendering/presentationActions";
import { STYLE_DEFINITIONS, representationCapabilityFor, representationStyleForCommand } from "./rendering/styleProfiles";
import { resolveSelection, parseRepresentationCommand, type SelectionResult } from "./interaction/selectionResolver";
import { LabelExpressionError, labelExpressionForMode, parseSafeLabelExpression, type LabelMode } from "./interaction/labels";
import { MeasurementAccumulator, createMeasurementObject, measurementCardinality, type MeasurementKind, type MeasurementObject } from "./interaction/measurements";
import type { PickResult } from "./interaction/picking";
import { colorRegistry } from "./rendering/colorRegistry";

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
  const [projection, setProjection] = useState<RenderProjection>(createDefaultRenderProjection());
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openRcsbRequest, setOpenRcsbRequest] = useState(0);
  const [measurementMode, setMeasurementModeState] = useState<MeasurementKind | null>(null);
  const [measurementSlots, setMeasurementSlots] = useState<readonly string[]>([]);
  const [measurements, setMeasurements] = useState<readonly MeasurementObject[]>([]);
  const [targetStyles, setTargetStyles] = useState<Record<"protein" | "ligand" | "water" | "ions" | "other", RepresentationStyle>>({ protein: "cartoon", ligand: "ball-and-stick", water: "spheres", ions: "spheres", other: "sticks" });
  const [cameraCommand, setCameraCommand] = useState<{ actionId: ActionId; sequence: number }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandSequence = useRef(0);
  const measurementAccumulatorRef = useRef(new MeasurementAccumulator());
  const measurementSequenceRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    apiClient.health().then(() => mounted && setApiStatus("connected")).catch(() => mounted && setApiStatus("offline"));
    return () => { mounted = false; };
  }, []);

  const showNotice = (capability: ActionDefinition) => {
    setNotice(capability);
    window.setTimeout(() => setNotice((current) => current?.id === capability.id ? null : current), 4600);
  };

  const runLoad = async (loader: () => Promise<StructureLoadResult>) => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const result = await loader();
      setStructure(result);
      setProjection(createDefaultRenderProjection(result.structure));
      setTargetStyles({ protein: "cartoon", ligand: "ball-and-stick", water: "spheres", ions: "spheres", other: "sticks" });
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurements([]);
      setLoadState("idle");
      commandSequence.current += 1;
      setCameraCommand({ actionId: ACTION_IDS.CANVAS_FOCUS, sequence: commandSequence.current });
    } catch (error) {
      setLoadState("error");
      setLoadError(error instanceof ApiClientError ? error.message : "The structure could not be loaded. The current structure was kept.");
    }
  };

  const importFile = (file: File) => {
    if (!isAdmittedFile(file)) {
      setLoadState("error");
      setLoadError("Only PDB and mmCIF files are admitted in G1C. The current structure was kept.");
      return;
    }
    void runLoad(() => apiClient.uploadStructure(file));
  };

  const fetchRcsb = (pdbId: string) => void runLoad(() => apiClient.fetchRcsb(pdbId));

  const createProject = async () => {
    try {
      const created = await apiClient.createProject();
      setProject(created);
      setStructure(null);
      setProjection(createDefaultRenderProjection());
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurements([]);
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
      setStructure(opened.structure);
      setProjection(opened.structure ? fromProjectPresentation(opened.presentation, opened.structure.structure) : createDefaultRenderProjection());
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurements([]);
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
    if (structure) setProjection((current) => setCategoryRepresentation(current, structure.structure, category, maskForStyle(style)));
  };

  const setLabelMode = (mode: LabelMode) => setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "LABELS.SET", labels: { mode, expression: labelExpressionForMode(mode) } }));
  const setLabelExpression = (input: string) => {
    try {
      const expression = parseSafeLabelExpression(input);
      setProjection((current) => setLabelState(current, { mode: "custom", expression }));
    } catch (error) {
      showNotice({ id: ACTION_IDS.LABELS_SET, group: "VIEW", state: "SUPPORTED_WITH_LIMITATIONS", label: "Invalid label expression", description: error instanceof LabelExpressionError ? error.message : "The label expression was rejected by the safe field parser." });
    }
  };
  const setCameraProjection = (projectionMode: RenderProjection["camera"]["projectionMode"]) => setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "CAMERA.SET", camera: { projectionMode } }));
  const setCameraSettings = (camera: Partial<RenderProjection["camera"]>) => setProjection((current) => setCameraState(current, camera));
  const setRepresentationSettings = (settings: Partial<RepresentationParameters>) => setProjection((current) => setRepresentationParameters(current, settings));

  const setMeasurementMode = (kind: MeasurementKind | null) => {
    measurementAccumulatorRef.current.clear();
    setMeasurementSlots([]);
    setMeasurementModeState(kind);
  };

  const handlePick = (pick: PickResult) => {
    if (pick.pickKind !== "ATOM" || !structure) return;
    const stableAtomId = pick.atomRef.stableAtomId;
    setProjection((current) => setInteractionState(current, { pickedAtomId: stableAtomId, selectedAtomIds: [stableAtomId] }));
    if (!measurementMode) return;
    const slots = measurementAccumulatorRef.current.add(stableAtomId, measurementMode);
    setMeasurementSlots([...slots]);
    if (slots.length !== measurementCardinality(measurementMode)) return;
    try {
      measurementSequenceRef.current += 1;
      const measurement = createMeasurementObject(measurementMode, slots, structure.structure, pick.coordinateContext, measurementSequenceRef.current);
      setMeasurements((current) => [...current, measurement]);
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
      setMeasurementModeState(null);
    } catch (error) {
      showNotice({ id: ACTION_IDS.MEASURE_DISTANCE, group: "MEASURE", state: "SUPPORTED_WITH_LIMITATIONS", label: "Measurement rejected", description: error instanceof Error ? error.message : "The selected coordinates could not form a measurement." });
      measurementAccumulatorRef.current.clear();
      setMeasurementSlots([]);
    }
  };

  const handleHover = (pick: PickResult | null) => setProjection((current) => setInteractionState(current, { hoveredAtomId: pick?.pickKind === "ATOM" ? pick.atomRef.stableAtomId : null }));
  const clearMeasurementPicks = () => { measurementAccumulatorRef.current.clear(); setMeasurementSlots([]); };
  const updateMeasurementVisibility = (id: string, visible: boolean) => setMeasurements((current) => current.map((measurement) => measurement.id === id ? { ...measurement, presentation: { ...measurement.presentation, visible }, status: visible ? "CURRENT" : "HIDDEN" } : measurement));
  const deleteMeasurement = (id: string) => setMeasurements((current) => current.filter((measurement) => measurement.id !== id));

  const runConsoleCommand = (input: string): ConsoleCommandResult => {
    const trimmed = input.trim();
    if (/^(select|select\s+all)\b/i.test(trimmed)) {
      if (!structure) return { category: "SELECTION", status: "No structure loaded; selection was not changed." };
      const query = trimmed.replace(/^select\s+/i, "").trim() || "all";
      try {
        const result: SelectionResult = resolveSelection(query, structure.structure);
        setProjection((current) => setInteractionState(current, { selectedAtomIds: result.stableAtomIds, pickedAtomId: result.stableAtomIds[0] ?? null }));
        return { category: "SELECTION", status: `Selected ${result.stableAtomIds.length} atoms · revision ${result.molecularRevision.slice(0, 10)}…` };
      } catch (error) {
        return { category: "SELECTION", status: error instanceof Error ? error.message : "Selection query rejected." };
      }
    }
    if (/^unpick$/i.test(trimmed)) { setProjection((current) => setInteractionState(current, { pickedAtomId: null, selectedAtomIds: [] })); return { category: "SELECTION", status: "Selection cleared." }; }
    try {
      const representationCommand = parseRepresentationCommand(trimmed);
      if (representationCommand) {
        if (!structure) return { category: "PRESENTATION", status: "No structure loaded; presentation was not changed." };
        const target = resolveSelection(representationCommand.query, structure.structure);
        const capability = representationCapabilityFor(representationStyleForCommand(representationCommand.representation) ?? "cartoon", structure.structure);
        if (!capability.maySelect) return { category: "PRESENTATION", status: `${capability.label} unavailable: ${capability.diagnostic ?? capability.unsupportedReason ?? "canonical capability is not implemented"}` };
        setProjection((current) => applyRepresentationToSelection(current, representationCommand.operation, representationCommand.mask, target.stableAtomIds));
        const capabilityNote = capability.status === "VALID_EMPTY" ? ` · ${capability.diagnostic ?? "valid empty result"}` : "";
        return { category: "PRESENTATION", status: `${representationCommand.operation} ${representationCommand.representation} on ${target.stableAtomIds.length} atoms${capabilityNote}.` };
      }
      const colorMatch = trimmed.match(/^color\s+([^,]+?)(?:\s*,\s*(.+))?$/i);
      if (colorMatch) {
        if (!structure) return { category: "PRESENTATION", status: "No structure loaded; color was not changed." };
        const color = colorRegistry.resolveInputWithDiagnostic(colorMatch[1].trim());
        if (!color.definition) return { category: "PRESENTATION", status: "COLOR_NOT_FOUND" };
        const target = resolveSelection(colorMatch[2]?.trim() || "all", structure.structure);
        setProjection((current) => setColorForSelection(current, target.stableAtomIds, `#${color.definition!.rgbSrgb.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`));
        return { category: "PRESENTATION", status: `Applied ${color.definition.canonicalName} to ${target.stableAtomIds.length} atoms.` };
      }
      if (/^get_view$/i.test(trimmed)) return { category: "PRESENTATION", status: JSON.stringify(projection.camera.view ?? { projection: projection.camera.projectionMode }) };
      if (/^measure\s+(distance|angle|dihedral)$/i.test(trimmed)) { setMeasurementMode(trimmed.split(/\s+/)[1].toUpperCase() as MeasurementKind); return { category: "MEASURE", status: `Measurement mode started: ${trimmed.split(/\s+/)[1].toUpperCase()}.` }; }
      if (/^measure\s+clear$/i.test(trimmed)) { clearMeasurementPicks(); return { category: "MEASURE", status: "Measurement picks cleared." }; }
    } catch (error) {
      return { category: "PRESENTATION", status: error instanceof Error ? error.message : "Command rejected." };
    }
    return { category: "CAPABILITY", status: "Command is not implemented in the current bounded presentation/interaction gate." };
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
      setOpenRcsbRequest((value) => value + 1);
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
  const selectedAtom = structure?.structure.atoms.find((atom) => atom.stableId === projection.interaction.pickedAtomId) ?? null;

  return (
    <div className="app-shell">
      <input id="structure-file" ref={fileInputRef} className="visually-hidden-input" type="file" accept=".pdb,.cif,.mmcif,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }} />
      <NavRail activeItem={activeNav} onAction={handleAction} />
      <main className="app-main">
        <MenuBar activeCategory={activeRibbon} onCategory={selectRibbon} />
        <ContextToolbar activeTool={activeTool} activeCategory={activeRibbon} collapsed={ribbonCollapsed} representation={projection.representation} colorMode={projection.color.mode} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onColorMode={setColorMode} onStyleChange={applyStyle} onToggleCollapsed={() => setRibbonCollapsed((value) => !value)} />
        <div className={`workspace-grid ${leftCollapsed ? "workspace-grid--left-collapsed" : ""} ${rightCollapsed ? "workspace-grid--right-collapsed" : ""}`}>
          <StructurePanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed((value) => !value)} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onFetchRcsb={fetchRcsb} openRcsbRequest={openRcsbRequest} structure={structure} projection={projection} selectedAtom={selectedAtom} measurementMode={measurementMode} measurementSlots={measurementSlots} measurements={measurements} onMeasurementMode={setMeasurementMode} onMeasurementVisibility={updateMeasurementVisibility} onMeasurementDelete={deleteMeasurement} onMeasurementClear={clearMeasurementPicks} loading={loadState === "loading"} error={loadError} />
          <MolecularCanvas structure={structure} projection={projection} activeTool={activeTool} cameraCommand={cameraCommand} loading={loadState === "loading"} error={loadError} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onFileDrop={importFile} consoleExpanded={consoleExpanded} onPick={handlePick} onHover={handleHover} measurements={measurements} measurementMode={measurementMode} />
          <InspectorPanel collapsed={rightCollapsed} onToggle={() => setRightCollapsed((value) => !value)} onAction={handleAction} structure={structure} projection={projection} onColorMode={setColorMode} onStyleChange={applyStyle} onTargetStyle={onTargetStyle} targetStyles={targetStyles} onNamedColor={updateNamedColor} onCustomColor={updateCustomColor} onBackgroundPreset={setBackgroundPreset} onBackgroundColor={(color) => setProjection((current) => ({ ...current, background: { preset: "Custom", color } }))} onLabelMode={setLabelMode} onLabelExpression={setLabelExpression} onCameraProjection={setCameraProjection} onCameraSettings={setCameraSettings} onRepresentationSettings={setRepresentationSettings} />
        </div>
        <StatusBar apiStatus={apiStatus} structure={structure} project={project} selectedAtomCount={projection.interaction.selectedAtomIds.length} />
        {notice && <CapabilityNotice capability={notice} onClose={() => setNotice(null)} />}
        <div className="console-layer"><ConsolePanel expanded={consoleExpanded} onToggle={() => setConsoleExpanded((value) => !value)} structure={structure} onCommand={runConsoleCommand} /></div>
      </main>
    </div>
  );
};
