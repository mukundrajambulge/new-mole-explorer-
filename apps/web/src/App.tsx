import { useEffect, useRef, useState } from "react";
import type { ProjectRecord, StructureLoadResult } from "@molecular/contracts";
import { CapabilityNotice } from "./components/CapabilityNotice";
import { ConsolePanel } from "./components/ConsolePanel";
import { ContextToolbar } from "./components/ContextToolbar";
import { InspectorPanel } from "./components/InspectorPanel";
import { MenuBar, RIBBON_CATEGORIES, type RibbonCategory } from "./components/MenuBar";
import { MolecularCanvas } from "./components/MolecularCanvas";
import { NavRail } from "./components/NavRail";
import { StatusBar } from "./components/StatusBar";
import { StructurePanel } from "./components/StructurePanel";
import { ACTION_IDS, ACTION_REGISTRY, type ActionId, type ActionDefinition } from "./domain/registry";
import { ApiClientError, apiClient } from "./lib/apiClient";
import { createDefaultRenderProjection, fromProjectPresentation, setProjectionStyle, styleProfileFor, toProjectPresentation, type BackgroundPreset, type ColorMode, type RenderProjection, type RepresentationStyle } from "./rendering/renderProjection";
import { applyPresentationAction, type PresentationComponent } from "./rendering/presentationActions";
import { STYLE_DEFINITIONS, styleDefinition } from "./rendering/styleProfiles";

const canvasTools: Record<string, string> = {
  [ACTION_IDS.CANVAS_SELECT]: "Select",
  [ACTION_IDS.CANVAS_PAN]: "Pan",
  [ACTION_IDS.CANVAS_ROTATE]: "Rotate",
  [ACTION_IDS.CANVAS_ZOOM]: "Zoom",
  [ACTION_IDS.CANVAS_FOCUS]: "Focus",
};

const representationActions: Record<string, RepresentationStyle> = {
  [ACTION_IDS.REPRESENTATION_LINES]: "lines",
  [ACTION_IDS.REPRESENTATION_STICKS]: "sticks",
  [ACTION_IDS.REPRESENTATION_CARTOON]: "cartoon",
  [ACTION_IDS.REPRESENTATION_BALL_AND_STICK]: "ball-and-stick",
  [ACTION_IDS.REPRESENTATION_LICORICE]: "licorice",
  [ACTION_IDS.REPRESENTATION_SPHERES]: "spheres",
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
  const [cameraCommand, setCameraCommand] = useState<{ actionId: ActionId; sequence: number }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandSequence = useRef(0);

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
    const definition = styleDefinition(styleProfileFor(style));
    if (definition.capability === "COMING_SOON" || definition.capability === "UNAVAILABLE") {
      showNotice({ id: ACTION_IDS.REPRESENTATION_SET_STYLE, group: "REPRESENTATION", state: definition.capability === "COMING_SOON" ? "COMING_SOON" : "UNAVAILABLE", label: definition.label, description: definition.unsupportedReason ?? `${definition.label} is not available in this gate.` });
      return;
    }
    setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "REPRESENTATION.APPLY", style }));
  };

  const setBackgroundPreset = (preset: BackgroundPreset) => setProjection((current) => applyPresentationAction(current, structure?.structure ?? null, { type: "BACKGROUND.SET", preset }));

  const selectRibbon = (category: RibbonCategory) => {
    setActiveRibbon(category);
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
    if (representationActions[actionId] && capability.state === "SUPPORTED") applyStyle(representationActions[actionId]);
    if (actionId === ACTION_IDS.REPRESENTATION_SET_STYLE && capability.state === "SUPPORTED") {
      setProjection((current) => {
        const supportedStyles = STYLE_DEFINITIONS.filter((definition) => definition.capability !== "COMING_SOON" && definition.capability !== "UNAVAILABLE").map((definition) => definition.id as RepresentationStyle);
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
      commandSequence.current += 1;
      setCameraCommand({ actionId: ACTION_IDS.VIEW_RESET, sequence: commandSequence.current });
    }
    if (capability.state !== "SUPPORTED") showNotice(capability);
  };

  const updateCustomColor = (hex: string) => setProjection((current) => ({ ...current, color: { ...current.color, mode: "custom", customHex: hex }, colorDiagnostic: null }));
  const updateNamedColor = (colorId: string) => setProjection((current) => ({ ...current, color: { ...current.color, mode: "named", colorId }, colorDiagnostic: null }));

  return (
    <div className="app-shell">
      <input id="structure-file" ref={fileInputRef} className="visually-hidden-input" type="file" accept=".pdb,.cif,.mmcif,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }} />
      <NavRail activeItem={activeNav} onAction={handleAction} />
      <main className="app-main">
        <MenuBar activeCategory={activeRibbon} onCategory={selectRibbon} />
        <ContextToolbar activeTool={activeTool} activeCategory={activeRibbon} collapsed={ribbonCollapsed} representation={projection.representation} colorMode={projection.color.mode} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onColorMode={setColorMode} onStyleChange={applyStyle} onToggleCollapsed={() => setRibbonCollapsed((value) => !value)} />
        <div className={`workspace-grid ${leftCollapsed ? "workspace-grid--left-collapsed" : ""} ${rightCollapsed ? "workspace-grid--right-collapsed" : ""}`}>
          <StructurePanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed((value) => !value)} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onFetchRcsb={fetchRcsb} openRcsbRequest={openRcsbRequest} structure={structure} projection={projection} loading={loadState === "loading"} error={loadError} />
          <MolecularCanvas structure={structure} projection={projection} activeTool={activeTool} cameraCommand={cameraCommand} loading={loadState === "loading"} error={loadError} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onFileDrop={importFile} consoleExpanded={consoleExpanded} />
          <InspectorPanel collapsed={rightCollapsed} onToggle={() => setRightCollapsed((value) => !value)} onAction={handleAction} structure={structure} projection={projection} onColorMode={setColorMode} onStyleChange={applyStyle} onNamedColor={updateNamedColor} onCustomColor={updateCustomColor} onBackgroundPreset={setBackgroundPreset} onBackgroundColor={(color) => setProjection((current) => ({ ...current, background: { preset: "Custom", color } }))} />
        </div>
        <StatusBar apiStatus={apiStatus} structure={structure} project={project} />
        {notice && <CapabilityNotice capability={notice} onClose={() => setNotice(null)} />}
        <div className="console-layer"><ConsolePanel expanded={consoleExpanded} onToggle={() => setConsoleExpanded((value) => !value)} structure={structure} /></div>
      </main>
    </div>
  );
};
