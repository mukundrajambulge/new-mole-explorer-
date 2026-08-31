import { useEffect, useRef, useState } from "react";
import type { StructureLoadResult } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
import type { RenderProjection } from "../rendering/renderProjection";
import { ThreeDMolViewerAdapter } from "../rendering/ThreeDMolViewerAdapter";
import type { PickResult } from "../interaction/picking";
import type { MeasurementKind, MeasurementObject } from "../interaction/measurements";
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
  consoleExpanded: boolean;
  onPick: (result: PickResult) => void;
  onHover: (result: PickResult | null) => void;
  onBackgroundPick: () => void;
  measurements: readonly MeasurementObject[];
  measurementMode: MeasurementKind | null;
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
  consoleExpanded,
  onPick,
  onHover,
  onBackgroundPick,
  measurements,
  measurementMode,
}: MolecularCanvasProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<ThreeDMolViewerAdapter | null>(null);
  const projectionRef = useRef(projection);
  const [dragActive, setDragActive] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerBottomInset, setViewerBottomInset] = useState(0);
  const pickRef = useRef(onPick);
  const hoverRef = useRef(onHover);
  const pointerGestureRef = useRef(false);
  pickRef.current = onPick;
  hoverRef.current = onHover;
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
    adapterRef.current?.setInteractionHandlers({ onPick: (result) => pickRef.current(result), onHover: (result) => hoverRef.current(result) });
  }, []);

  useEffect(() => {
    const adapter = adapterRef.current;
    const host = hostRef.current;
    if (!adapter || !host) return undefined;
    const updateViewport = () => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const width = hostRect.width;
      const height = hostRect.height;
      const visible = { top: 0, bottom: height, left: 0, right: width };
      const occluder = document.querySelector<HTMLElement>(".console-layer")?.getBoundingClientRect();
      let bottomInset = 0;
      if (canvasRect && occluder && occluder.left < canvasRect.right && occluder.right > canvasRect.left && occluder.top < canvasRect.bottom && occluder.bottom > canvasRect.top) bottomInset = Math.max(0, Math.min(canvasRect.height, canvasRect.bottom - occluder.top));
      setViewerBottomInset((current) => Math.abs(current - bottomInset) < 1 ? current : bottomInset);
      if (occluder && occluder.left < hostRect.right && occluder.right > hostRect.left && occluder.top < hostRect.bottom && occluder.bottom > hostRect.top) {
        const left = Math.max(0, occluder.left - hostRect.left);
        const right = Math.min(width, occluder.right - hostRect.left);
        const top = Math.max(0, occluder.top - hostRect.top);
        const bottom = Math.min(height, occluder.bottom - hostRect.top);
        if (bottom - top >= height / 2) visible.bottom = top;
        else if (top <= height / 2) visible.top = bottom;
        if (right - left >= width / 2) {
          visible.left = left;
          visible.right = right;
        }
      }
      adapter.setViewport({ width, height, visibleTop: visible.top, visibleBottom: visible.bottom, visibleLeft: visible.left, visibleRight: visible.right });
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(host);
    const consoleLayer = document.querySelector<HTMLElement>(".console-layer");
    if (consoleLayer) observer.observe(consoleLayer);
    window.addEventListener("resize", updateViewport);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, [consoleExpanded, structure, viewerBottomInset]);

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
    if (!adapterRef.current) return;
    try {
      adapterRef.current.setProjection(projection);
    } catch (projectionError) {
      setViewerError(projectionError instanceof Error ? projectionError.message : "The display projection could not be applied.");
    }
  }, [projection, structure]);

  useEffect(() => {
    adapterRef.current?.setMeasurements(measurements);
  }, [measurements]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || !cameraCommand) return;
    if (cameraCommand.actionId === "CANVAS.ROTATE") adapter.rotate();
    if (cameraCommand.actionId === "CANVAS.PAN") adapter.pan();
    if (cameraCommand.actionId === "CANVAS.ZOOM") adapter.zoom();
    if (cameraCommand.actionId === "CANVAS.FOCUS" || cameraCommand.actionId === "VIEW.FIT") adapter.focus();
    if (cameraCommand.actionId === "VIEW.CENTER") adapter.center();
    if (cameraCommand.actionId === "VIEW.ORIENT") adapter.orient();
    if (cameraCommand.actionId === "VIEW.RESET") adapter.resetView();
    if (cameraCommand.actionId === "VIEW.ORIGIN") adapter.origin();
  }, [cameraCommand]);

  const gestureMode = activeTool === "Rotate" ? "rotate" : activeTool === "Pan" ? "pan" : activeTool === "Zoom" ? "zoom" : null;
  const beginPointerGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gestureMode && event.button === 0 && event.target instanceof HTMLCanvasElement) onBackgroundPick();
    if (!gestureMode || event.button !== 0 || (event.target instanceof HTMLElement && Boolean(event.target.closest("button")))) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerGestureRef.current = true;
    adapterRef.current?.beginGesture(gestureMode, event.clientX, event.clientY);
  };
  const movePointerGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerGestureRef.current) return;
    event.preventDefault();
    adapterRef.current?.updateGesture(event.clientX, event.clientY);
  };
  const endPointerGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerGestureRef.current) return;
    pointerGestureRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    adapterRef.current?.endGesture();
  };

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
        ref={canvasRef}
        className="molecular-canvas"
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragActive(false); }}
        onDrop={handleDrop}
        onPointerDown={beginPointerGesture}
        onPointerMove={movePointerGesture}
        onPointerUp={endPointerGesture}
        onPointerCancel={endPointerGesture}
      >
        <div ref={hostRef} className="viewer-host" style={{ bottom: `${viewerBottomInset}px` }} data-testid="molecular-viewer" data-viewer-state={structure ? "loaded" : "empty"} data-projection={projection.representation} />
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
        <div className="canvas-tool-readout"><span className="tool-readout-icon"><Icon name={toolIcon(activeTool)} size={13} /></span>{measurementMode ? `MEASURE ${measurementMode}` : activeTool.toUpperCase()}</div>
      </div>
    </section>
  );
};
