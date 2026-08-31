import { useEffect, useState } from "react";
import type { StructureLoadResult } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
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
  loading: boolean;
  error: string | null;
};

const formatCount = (value: number) => value.toLocaleString("en-US");

export const StructurePanel = ({
  collapsed,
  onToggle,
  onAction,
  onImport,
  onFetchRcsb,
  openRcsbRequest,
  structure,
  projection,
  loading,
  error,
}: StructurePanelProps) => {
  const [showRcsb, setShowRcsb] = useState(false);
  const [pdbId, setPdbId] = useState("");
  useEffect(() => {
    if (openRcsbRequest > 0) setShowRcsb(true);
  }, [openRcsbRequest]);
  const counts = structure?.structure.counts;
  const components = [
    { label: "Protein", count: counts?.polymerAtoms ?? 0, tone: "blue", visible: projection.showProtein },
    { label: "Ligand", count: counts?.ligandAtoms ?? 0, tone: "purple", visible: projection.showLigand },
    { label: "Water", count: counts?.waterAtoms ?? 0, tone: "cyan", visible: projection.showWater },
    { label: "Ions", count: counts?.ionAtoms ?? 0, tone: "orange", visible: projection.showIons },
    { label: "Other", count: counts?.otherAtoms ?? 0, tone: "slate", visible: projection.showOther },
  ];

  if (collapsed) {
    return <button className="collapsed-panel-tab collapsed-panel-tab--left" onClick={onToggle} aria-label="Expand structure panel"><Icon name="panelLeftOpen" size={17} /></button>;
  }

  const submitRcsb = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pdbId.trim()) onFetchRcsb(pdbId.trim());
  };

  return (
    <aside className="side-column side-column--left" aria-label="Structure and tools panel">
      <section className="panel-card structure-card">
        <div className="panel-heading"><div><span className="eyebrow">PROJECT TREE</span><h2>Structure</h2></div><div className="panel-actions"><button className="icon-button" onClick={onImport} aria-label="Add structure" data-action-id="FILE.IMPORT"><Icon name="plus" size={16} /></button><button className="icon-button" onClick={onToggle} aria-label="Collapse structure panel"><Icon name="panelLeftClose" size={16} /></button></div></div>
        <div className="ingestion-actions">
          <label className="source-button" htmlFor="structure-file"><Icon name="upload" size={14} /> Import PDB/mmCIF</label>
          <button className={`source-button ${showRcsb ? "source-button--active" : ""}`} type="button" onClick={() => setShowRcsb((value) => !value)}><Icon name="cloudDownload" size={14} /> RCSB fetch</button>
        </div>
        {showRcsb && <form className="rcsb-form" onSubmit={submitRcsb}><input aria-label="PDB ID" placeholder="PDB ID" value={pdbId} onChange={(event) => setPdbId(event.target.value)} maxLength={4} /><button type="submit" disabled={loading}>Fetch</button></form>}
        {loading && <div className="ingestion-status"><Icon name="loader" size={14} /> Ingesting structure…</div>}
        {error && <div className="ingestion-error" role="alert">{error}</div>}
        {!structure && !loading && <div className="structure-empty">No structure loaded<span>Admitted formats: PDB · mmCIF</span></div>}
        {structure && <>
          <div className="tree-item tree-item--root"><span className="tree-badge tree-badge--blue">P</span><span className="tree-label" title={structure.structure.source.originalFilename}>{structure.structure.source.originalFilename}</span><Icon name="eye" size={16} /></div>
          <div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Polymer <span className="muted">({formatCount(structure.structure.counts.polymerAtoms)} atoms)</span></span><span className="tag tag--green">P</span><Icon name="eye" size={16} /></div>
          <div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Non-polymer <span className="muted">({formatCount(structure.structure.counts.ligandAtoms)} atoms)</span></span><span className="tag tag--purple">L</span><Icon name="eye" size={16} /></div>
          <div className="structure-source-meta">{structure.structure.source.kind === "RCSB" ? "RCSB" : "LOCAL FILE"} · {structure.structure.format.toUpperCase()} · sha256 {structure.structure.source.sha256.slice(0, 10)}…</div>
        </>}
      </section>

      <section className="panel-card components-card">
        <div className="panel-heading"><div><span className="eyebrow">STRUCTURE INVENTORY</span><h2>Components</h2></div><span className="capability-tag">View in Projection &amp; Display</span></div>
        <div className="component-list">
          {components.map((component) => (
            <div className="component-row" key={component.label}>
              <span className={`component-dot component-dot--${component.tone} ${component.visible ? "component-dot--visible" : "component-dot--hidden"}`} aria-hidden="true" />
              <span>{component.label}</span><span className="component-count">{formatCount(component.count)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-card quick-card">
        <div className="panel-heading"><div><span className="eyebrow">WORKBENCH</span><h2>Quick tools</h2></div><span className="capability-tag">G1C</span></div>
        <div className="quick-grid">
          {quickTools.map((tool) => <button className="quick-tool" key={tool.label} onClick={() => onAction(tool.actionId)} data-action-id={tool.actionId}><span className="quick-icon"><Icon name={tool.icon} size={18} /></span><span>{tool.label}</span></button>)}
        </div>
      </section>
    </aside>
  );
};
