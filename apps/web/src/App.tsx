import { useEffect, useRef, useState } from "react";
import type { StructureLoadResult } from "@molecular/contracts";
import { CapabilityNotice } from "./components/CapabilityNotice";
import { ConsolePanel } from "./components/ConsolePanel";
import { ContextToolbar } from "./components/ContextToolbar";
import { InspectorPanel } from "./components/InspectorPanel";
import { MenuBar } from "./components/MenuBar";
import { MolecularCanvas } from "./components/MolecularCanvas";
import { NavRail } from "./components/NavRail";
import { StatusBar } from "./components/StatusBar";
import { StructurePanel } from "./components/StructurePanel";
import { ACTION_IDS, ACTION_REGISTRY, type ActionId, type ActionDefinition } from "./domain/registry";
import { ApiClientError, apiClient } from "./lib/apiClient";
import { DEFAULT_RENDER_PROJECTION, REPRESENTATION_STYLES, type RenderProjection } from "./rendering/renderProjection";

const canvasTools: Record<string, string> = {
  [ACTION_IDS.CANVAS_SELECT]: "Select",
  [ACTION_IDS.CANVAS_PAN]: "Pan",
  [ACTION_IDS.CANVAS_ROTATE]: "Rotate",
  [ACTION_IDS.CANVAS_ZOOM]: "Zoom",
  [ACTION_IDS.CANVAS_FOCUS]: "Focus",
};

const representationActions: Record<string, RenderProjection["representation"]> = {
  [ACTION_IDS.REPRESENTATION_CARTOON]: "cartoon",
  [ACTION_IDS.REPRESENTATION_BALL_AND_STICK]: "ball-and-stick",
  [ACTION_IDS.REPRESENTATION_LICORICE]: "sticks",
  [ACTION_IDS.REPRESENTATION_SPHERES]: "spheres",
};

const isAdmittedFile = (file: File) => /\.(pdb|cif|mmcif)$/i.test(file.name);

export const App = () => {
  const [activeNav, setActiveNav] = useState("Home");
  const [activeTool, setActiveTool] = useState("Select");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [consoleExpanded, setConsoleExpanded] = useState(true);
  const [notice, setNotice] = useState<ActionDefinition | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "offline">("checking");
  const [structure, setStructure] = useState<StructureLoadResult | null>(null);
  const [projection, setProjection] = useState<RenderProjection>(DEFAULT_RENDER_PROJECTION);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
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
      setProjection(DEFAULT_RENDER_PROJECTION);
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
      setLoadError("Only PDB and mmCIF files are admitted in VIS-01. The current structure was kept.");
      return;
    }
    void runLoad(() => apiClient.uploadStructure(file));
  };

  const fetchRcsb = (pdbId: string) => void runLoad(() => apiClient.fetchRcsb(pdbId));

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
    if (actionId === ACTION_IDS.FILE_IMPORT) {
      fileInputRef.current?.click();
      return;
    }
    if (representationActions[actionId] && capability.state === "SUPPORTED") {
      setProjection((current) => ({ ...current, representation: representationActions[actionId] }));
    }
    if (actionId === ACTION_IDS.REPRESENTATION_SET_STYLE && capability.state !== "COMING_SOON") {
      setProjection((current) => {
        const index = REPRESENTATION_STYLES.indexOf(current.representation);
        return { ...current, representation: REPRESENTATION_STYLES[(index + 1) % REPRESENTATION_STYLES.length] };
      });
    }
    const visibilityActions: Partial<Record<ActionId, keyof Pick<RenderProjection, "showProtein" | "showLigand" | "showWater" | "showIons" | "showOther">>> = {
      [ACTION_IDS.REPRESENTATION_TOGGLE_PROTEIN]: "showProtein",
      [ACTION_IDS.REPRESENTATION_TOGGLE_LIGAND]: "showLigand",
      [ACTION_IDS.REPRESENTATION_TOGGLE_WATER]: "showWater",
      [ACTION_IDS.REPRESENTATION_TOGGLE_IONS]: "showIons",
      [ACTION_IDS.REPRESENTATION_TOGGLE_OTHER]: "showOther",
    };
    const visibilityKey = visibilityActions[actionId];
    if (visibilityKey && capability.state === "SUPPORTED") setProjection((current) => ({ ...current, [visibilityKey]: !current[visibilityKey] }));
    if (actionId === ACTION_IDS.VIEW_RESET && capability.state === "SUPPORTED") {
      commandSequence.current += 1;
      setCameraCommand({ actionId: ACTION_IDS.VIEW_RESET, sequence: commandSequence.current });
    }
    if (capability.state !== "SUPPORTED" || actionId === ACTION_IDS.REPRESENTATION_SET_STYLE) showNotice(capability);
  };

  return (
    <div className="app-shell">
      <input id="structure-file" ref={fileInputRef} className="visually-hidden-input" type="file" accept=".pdb,.cif,.mmcif,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }} />
      <NavRail activeItem={activeNav} onAction={handleAction} />
      <main className="app-main">
        <MenuBar onAction={handleAction} />
        <ContextToolbar activeTool={activeTool} onAction={handleAction} onImport={() => fileInputRef.current?.click()} />
        <div className={`workspace-grid ${leftCollapsed ? "workspace-grid--left-collapsed" : ""} ${rightCollapsed ? "workspace-grid--right-collapsed" : ""}`}>
          <StructurePanel collapsed={leftCollapsed} onToggle={() => setLeftCollapsed((value) => !value)} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onFetchRcsb={fetchRcsb} structure={structure} projection={projection} loading={loadState === "loading"} error={loadError} />
          <MolecularCanvas structure={structure} projection={projection} activeTool={activeTool} cameraCommand={cameraCommand} loading={loadState === "loading"} error={loadError} onAction={handleAction} onImport={() => fileInputRef.current?.click()} onFileDrop={importFile} />
          <InspectorPanel collapsed={rightCollapsed} onToggle={() => setRightCollapsed((value) => !value)} onAction={handleAction} structure={structure} projection={projection} />
        </div>
        <StatusBar apiStatus={apiStatus} structure={structure} />
        {notice && <CapabilityNotice capability={notice} onClose={() => setNotice(null)} />}
        <div className="console-layer"><ConsolePanel expanded={consoleExpanded} onToggle={() => setConsoleExpanded((value) => !value)} structure={structure} /></div>
      </main>
    </div>
  );
};
