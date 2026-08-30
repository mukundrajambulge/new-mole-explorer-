import { useEffect, useRef, useState } from "react";
import type { StructureLoadResult } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
import type { RenderProjection } from "../rendering/renderProjection";
import { ThreeDMolViewerAdapter } from "../rendering/ThreeDMolViewerAdapter";
import { Icon } from "./Icon";

type CameraCommand = { actionId: ActionId; sequence: number };

type MolecularCanvasProps = {
  structure: StructureLoadResult | null;
  projection: RenderProjection;
  activeTool: string;
  cameraCommand?: CameraCommand;
  loading: boolean;
  error: string | null;
  onAction: (actionId: ActionId) => void;
  onImport: () => void;
  onFileDrop: (file: File) => void;
};

const toolIcon = (activeTool: string) => {
  if (activeTool === "Pan") return "hand" as const;
  if (activeTool === "Rotate") return "rotate" as const;
  if (activeTool === "Zoom") return "zoom" as const;
  return "pointer" as const;
};

export const MolecularCanvas = ({
  structure,
  projection,
  activeTool,
  cameraCommand,
  loading,
  error,
  onAction,
  onImport,
  onFileDrop,
}: MolecularCanvasProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<ThreeDMolViewerAdapter | null>(null);
  const projectionRef = useRef(projection);
  const [dragActive, setDragActive] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  projectionRef.current = projection;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const adapter = new ThreeDMolViewerAdapter();
    try {
      adapter.mount(host);
      adapterRef.current = adapter;
    } catch (mountError) {
      setViewerError(mountError instanceof Error ? mountError.message : "The molecular viewer could not be mounted.");
    }
    return () => {
      if (adapterRef.current === adapter) adapterRef.current = null;
      adapter.destroy();
    };
  }, []);

  useEffect(() => {
    if (!structure || !adapterRef.current) return;
    try {
      setViewerError(null);
      adapterRef.current.load(structure, projectionRef.current);
    } catch (loadError) {
      setViewerError(loadError instanceof Error ? loadError.message : "The structure could not be rendered.");
    }
  }, [structure]);

  useEffect(() => {
    if (!structure || !adapterRef.current) return;
    try {
      adapterRef.current.setProjection(projection);
    } catch (projectionError) {
      setViewerError(projectionError instanceof Error ? projectionError.message : "The display projection could not be applied.");
    }
  }, [projection, structure]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || !cameraCommand) return;
    if (cameraCommand.actionId === "CANVAS.ROTATE") adapter.rotate();
    if (cameraCommand.actionId === "CANVAS.PAN") adapter.pan();
    if (cameraCommand.actionId === "CANVAS.ZOOM") adapter.zoom();
    if (cameraCommand.actionId === "CANVAS.FOCUS" || cameraCommand.actionId === "VIEW.RESET") adapter.focus();
  }, [cameraCommand]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) onFileDrop(file);
  };

  return (
    <section className="canvas-stage" aria-label="Molecular render projection">
      <div className="canvas-status"><span className="live-dot" />3DMOL.JS <span className="canvas-status-separator">/</span> RENDER PROJECTION</div>
      <div
        className="molecular-canvas"
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragActive(false); }}
        onDrop={handleDrop}
      >
        <div ref={hostRef} className="viewer-host" data-testid="molecular-viewer" data-viewer-state={structure ? "loaded" : "empty"} data-projection={projection.representation} />
        {!structure && !loading && (
          <div className="empty-viewer-state">
            <div className="empty-viewer-card">
              <span className="empty-viewer-icon"><Icon name="atom" size={28} /></span>
              <strong>No structure loaded</strong>
              <span>Drop a PDB or mmCIF file here, or import one from the toolbar.</span>
              <button className="empty-viewer-action" type="button" onClick={onImport}><Icon name="upload" size={14} /> Import structure</button>
            </div>
          </div>
        )}
        {loading && <div className="viewer-message viewer-message--loading"><Icon name="loader" size={18} /> Loading structure…</div>}
        {(error || viewerError) && <div className="viewer-message viewer-message--error"><Icon name="circleHelp" size={17} /> {error ?? viewerError}</div>}
        {dragActive && <div className="drop-overlay"><Icon name="upload" size={24} /><strong>Drop PDB or mmCIF</strong><span>Backend validation will keep the current structure safe.</span></div>}
        <div className="canvas-axis-readout" aria-label="Orientation axes"><span className="axis-readout-y">Y</span><span className="axis-readout-x">X</span><span className="axis-readout-z">Z</span></div>
        <button className="canvas-reset" onClick={() => onAction("VIEW.RESET")} aria-label="Reset view" data-action-id="VIEW.RESET"><Icon name="plus" size={16} /></button>
        <div className="canvas-tool-readout"><span className="tool-readout-icon"><Icon name={toolIcon(activeTool)} size={13} /></span>{activeTool.toUpperCase()}</div>
      </div>
    </section>
  );
};
