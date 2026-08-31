import { useEffect, useState } from "react";
import type { CanonicalAtom, StructureLoadResult } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
import { formatMeasurement, measurementStatus, type MeasurementKind, type MeasurementObject } from "../interaction/measurements";
import type { RenderProjection } from "../rendering/renderProjection";
import { Icon } from "./Icon";

const quickTools: Array<{ label: string; icon: "ruler" | "target" | "activity" | "waves" | "shapes" | "sparkles" | "box" | "circleHelp" | "move3d" | "rotate"; actionId: ActionId }> = [
  { label: "Distance", icon: "ruler", actionId: "MEASURE.DISTANCE" },
  { label: "Angle", icon: "move3d", actionId: "MEASURE.ANGLE" },
  { label: "Dihedral", icon: "rotate", actionId: "MEASURE.DIHEDRAL" },
  { label: "H-Bonds", icon: "waves", actionId: "REPRESENTATION.SURFACE" },
  { label: "Contacts", icon: "shapes", actionId: "SELECTION.EVALUATE" },
  { label: "Clash", icon: "activity", actionId: "SELECTION.EVALUATE" },
  { label: "Pocket", icon: "box", actionId: "SELECTION.EVALUATE" },
  { label: "Surface", icon: "circleHelp", actionId: "REPRESENTATION.SURFACE" },
  { label: "Center", icon: "target", actionId: "CANVAS.FOCUS" },
];

type StructurePanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  onAction: (actionId: ActionId) => void;
  onImport: () => void;
  onFetchRcsb: (pdbId: string) => void;
  openRcsbRequest: number;
  structure: StructureLoadResult | null;
  projection: RenderProjection;
  selectedAtom: CanonicalAtom | null;
  measurementMode: MeasurementKind | null;
  measurementSlots: readonly string[];
  measurements: readonly MeasurementObject[];
  onMeasurementMode: (kind: MeasurementKind | null) => void;
  onMeasurementVisibility: (id: string, visible: boolean) => void;
  onMeasurementDelete: (id: string) => void;
  onMeasurementClear: () => void;
  loading: boolean;
  error: string | null;
};

const formatCount = (value: number) => value.toLocaleString("en-US");
const formatCoordinate = (value: number) => Number.isFinite(value) ? value.toFixed(3) : "—";
const formatOptional = (value: number | null | undefined, digits = 2) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);
const measurementLabel = (kind: MeasurementKind) => kind === "DISTANCE" ? "Distance" : kind === "ANGLE" ? "Angle" : "Dihedral";

const ContextCard = ({ selectedAtom, onAction }: { selectedAtom: CanonicalAtom | null; onAction: (actionId: ActionId) => void }) => (
  <section className="panel-card context-card" data-testid="context-panel">
    <div className="panel-heading"><div><span className="eyebrow">CONTEXT</span><h2>Context</h2></div><span className="capability-tag">CANONICAL</span></div>
    {selectedAtom ? <div className="atom-inspector">
      <div className="atom-inspector-title"><strong>{selectedAtom.atomName}</strong><span>{selectedAtom.residueName} {selectedAtom.residueNumber} · chain {selectedAtom.chain || "—"}</span></div>
      <div className="atom-property-grid">
        <span>Element</span><strong>{selectedAtom.element}</strong>
        <span>Coordinates</span><strong>{formatCoordinate(selectedAtom.x)}, {formatCoordinate(selectedAtom.y)}, {formatCoordinate(selectedAtom.z)} Å</strong>
        <span>Occupancy</span><strong>{formatOptional(selectedAtom.occupancy)}</strong>
        <span>B-factor</span><strong>{formatOptional(selectedAtom.bFactor)}</strong>
        <span>Formal charge</span><strong>{selectedAtom.formalCharge ?? "—"}</strong>
        <span>Stable atom ID</span><strong title={selectedAtom.stableId}>{selectedAtom.stableId}</strong>
        <span>Source serial</span><strong>{selectedAtom.serial}</strong>
      </div>
      <div className="inspector-inline-actions"><button type="button" onClick={() => onAction("CANVAS.SELECT")}>Inspect in canvas</button><button type="button" onClick={() => onAction("MEASURE.DISTANCE")}>Measure</button></div>
    </div> : <div className="empty-inspector"><span className="empty-orbit"><Icon name="target" size={19} /></span><strong>No atom selected</strong><span>Pick an atom in the canvas to inspect canonical properties.</span></div>}
  </section>
);

const MeasurementCard = ({ measurementMode, measurementSlots, measurements, structure, onAction, onMeasurementMode, onMeasurementVisibility, onMeasurementDelete, onMeasurementClear }: { measurementMode: MeasurementKind | null; measurementSlots: readonly string[]; measurements: readonly MeasurementObject[]; structure: StructureLoadResult | null; onAction: (actionId: ActionId) => void; onMeasurementMode: (kind: MeasurementKind | null) => void; onMeasurementVisibility: (id: string, visible: boolean) => void; onMeasurementDelete: (id: string) => void; onMeasurementClear: () => void }) => {
  const measurementKinds: MeasurementKind[] = ["DISTANCE", "ANGLE", "DIHEDRAL"];
  return <section className="panel-card measurement-card" data-testid="measurements-panel">
    <div className="panel-heading"><div><span className="eyebrow">ANALYSIS</span><h2>Interaction / Measurements</h2></div><span className="measurement-count" aria-label={`${measurements.length} measurements`}>{measurements.length}</span></div>
    <div className="measurement-toolbar">{measurementKinds.map((kind) => <button type="button" className={`measurement-button ${measurementMode === kind ? "measurement-button--active" : ""}`} key={kind} aria-pressed={measurementMode === kind} onClick={() => { if (!structure) { onAction(`MEASURE.${kind}` as ActionId); return; } onMeasurementMode(measurementMode === kind ? null : kind); }}>{measurementLabel(kind)}</button>)}</div>
    {measurementMode && <div className="measurement-hint" role="status">Pick {measurementMode === "DISTANCE" ? "2" : measurementMode === "ANGLE" ? "3" : "4"} atoms in order. {measurementSlots.length} picked. <button type="button" onClick={onMeasurementClear}>Clear picks</button></div>}
    {measurements.length === 0 ? <div className="measurement-empty">No measurements yet<span>Results remain tied to the canonical coordinate revision.</span></div> : <div className="measurement-list">{measurements.map((measurement) => { const status = measurementStatus(measurement, structure?.structure ?? null); return <div className={`measurement-result measurement-result--${status.toLowerCase()}`} key={measurement.id} data-measurement-id={measurement.id}><div><strong>{measurementLabel(measurement.kind).toUpperCase()} · {status}</strong><span>{formatMeasurement(measurement)}</span><small>{measurement.participants.map((participant) => `${participant.atomName} ${participant.residueName}${participant.residueNumber}`).join(" → ")}</small></div><div className="measurement-actions"><button type="button" onClick={() => onMeasurementVisibility(measurement.id, !measurement.presentation.visible)}>{measurement.presentation.visible ? "Hide" : "Show"}</button><button type="button" onClick={() => onMeasurementDelete(measurement.id)}>Delete</button></div></div>; })}</div>}
    {measurements.length > 0 && <button type="button" className="measurement-clear-all" onClick={() => onAction("MEASURE.CLEAR")}>Clear measurement picks</button>}
  </section>;
};

export const StructurePanel = ({ collapsed, onToggle, onAction, onImport, onFetchRcsb, openRcsbRequest, structure, projection, selectedAtom, measurementMode, measurementSlots, measurements, onMeasurementMode, onMeasurementVisibility, onMeasurementDelete, onMeasurementClear, loading, error }: StructurePanelProps) => {
  const [showRcsb, setShowRcsb] = useState(false);
  const [pdbId, setPdbId] = useState("");
  useEffect(() => { if (openRcsbRequest > 0) setShowRcsb(true); }, [openRcsbRequest]);
  const counts = structure?.structure.counts;
  const components = [
    { label: "Protein", count: counts?.polymerAtoms ?? 0, tone: "blue", visible: projection.showProtein },
    { label: "Ligand", count: counts?.ligandAtoms ?? 0, tone: "purple", visible: projection.showLigand },
    { label: "Water", count: counts?.waterAtoms ?? 0, tone: "cyan", visible: projection.showWater },
    { label: "Ions", count: counts?.ionAtoms ?? 0, tone: "orange", visible: projection.showIons },
    { label: "Other", count: counts?.otherAtoms ?? 0, tone: "slate", visible: projection.showOther },
  ];

  if (collapsed) return <button className="collapsed-panel-tab collapsed-panel-tab--left" onClick={onToggle} aria-label="Expand structure panel"><Icon name="panelLeftOpen" size={17} /></button>;
  const submitRcsb = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (pdbId.trim()) onFetchRcsb(pdbId.trim()); };
  return <aside className="side-column side-column--left" aria-label="Structure, context and tools panel">
    <section className="panel-card structure-card">
      <div className="panel-heading"><div><span className="eyebrow">PROJECT TREE</span><h2>Structure</h2></div><div className="panel-actions"><button className="icon-button" onClick={onImport} aria-label="Add structure" data-action-id="FILE.IMPORT"><Icon name="plus" size={16} /></button><button className="icon-button" onClick={onToggle} aria-label="Collapse structure panel"><Icon name="panelLeftClose" size={16} /></button></div></div>
      <div className="ingestion-actions"><label className="source-button" htmlFor="structure-file"><Icon name="upload" size={14} /> Import PDB/mmCIF</label><button className={`source-button ${showRcsb ? "source-button--active" : ""}`} type="button" onClick={() => setShowRcsb((value) => !value)}><Icon name="cloudDownload" size={14} /> RCSB fetch</button></div>
      {showRcsb && <form className="rcsb-form" onSubmit={submitRcsb}><input aria-label="PDB ID" placeholder="PDB ID" value={pdbId} onChange={(event) => setPdbId(event.target.value)} maxLength={4} /><button type="submit" disabled={loading}>Fetch</button></form>}
      {loading && <div className="ingestion-status"><Icon name="loader" size={14} /> Ingesting structure…</div>}
      {error && <div className="ingestion-error" role="alert">{error}</div>}
      {!structure && !loading && <div className="structure-empty">No structure loaded<span>Admitted formats: PDB · mmCIF</span></div>}
      {structure && <><div className="tree-item tree-item--root"><span className="tree-badge tree-badge--blue">P</span><span className="tree-label" title={structure.structure.source.originalFilename}>{structure.structure.source.originalFilename}</span><Icon name="eye" size={16} /></div><div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Polymer <span className="muted">({formatCount(structure.structure.counts.polymerAtoms)} atoms)</span></span><span className="tag tag--green">P</span><Icon name="eye" size={16} /></div><div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Non-polymer <span className="muted">({formatCount(structure.structure.counts.ligandAtoms)} atoms)</span></span><span className="tag tag--purple">L</span><Icon name="eye" size={16} /></div><div className="structure-source-meta">{structure.structure.source.kind === "RCSB" ? "RCSB" : "LOCAL FILE"} · {structure.structure.format.toUpperCase()} · sha256 {structure.structure.source.sha256.slice(0, 10)}…</div></>}
    </section>
    <section className="panel-card components-card"><div className="panel-heading"><div><span className="eyebrow">STRUCTURE INVENTORY</span><h2>Components</h2></div><span className="capability-tag">Projection only</span></div><div className="component-list">{components.map((component) => <div className="component-row" key={component.label}><span className={`component-dot component-dot--${component.tone} ${component.visible ? "component-dot--visible" : "component-dot--hidden"}`} aria-hidden="true" /><span>{component.label}</span><span className="component-count">{formatCount(component.count)}</span></div>)}</div></section>
    <ContextCard selectedAtom={selectedAtom} onAction={onAction} />
    <section className="panel-card quick-card"><div className="panel-heading"><div><span className="eyebrow">WORKBENCH</span><h2>Quick tools</h2></div><span className="capability-tag">G1C</span></div><div className="quick-grid">{quickTools.map((tool) => <button className="quick-tool" key={tool.label} onClick={() => onAction(tool.actionId)} data-action-id={tool.actionId}><span className="quick-icon"><Icon name={tool.icon} size={18} /></span><span>{tool.label}</span></button>)}</div></section>
    <MeasurementCard measurementMode={measurementMode} measurementSlots={measurementSlots} measurements={measurements} structure={structure} onAction={onAction} onMeasurementMode={onMeasurementMode} onMeasurementVisibility={onMeasurementVisibility} onMeasurementDelete={onMeasurementDelete} onMeasurementClear={onMeasurementClear} />
  </aside>;
};
