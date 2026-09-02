import type { CanonicalAtom, StructureLoadResult } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
import { formatMeasurement, measurementStatus, type MeasurementKind, type MeasurementObject } from "../interaction/measurements";
import type { RenderProjection } from "../rendering/renderProjection";
import type { StructuralAnalysisResult } from "../analysis/structuralAnalysis";
import type { WorkspaceGroup, WorkspaceObject } from "../workspace/workspaceModel";
import type { CoordinateFramePolicy, SelectionResult } from "../interaction/selectionResolver";
import { Icon } from "./Icon";

const analysisTools: Array<{ label: string; icon: "target" | "activity" | "waves" | "shapes" | "box" | "circleHelp"; actionId: ActionId; capability?: string }> = [
  { label: "H-Bonds", icon: "waves", actionId: "ANALYSIS.H_BONDS" },
  { label: "Contacts", icon: "shapes", actionId: "ANALYSIS.CONTACTS" },
  { label: "Clash", icon: "activity", actionId: "ANALYSIS.CLASH" },
  { label: "Pocket", icon: "box", actionId: "ANALYSIS.POCKET", capability: "Unavailable" },
  { label: "Surface", icon: "circleHelp", actionId: "REPRESENTATION.SURFACE" },
  { label: "Center", icon: "target", actionId: "VIEW.CENTER" },
];

type StructurePanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  onAction: (actionId: ActionId) => void;
  structure: StructureLoadResult | null;
  workspaceObjects: readonly WorkspaceObject[];
  workspaceGroups: readonly WorkspaceGroup[];
  activeObjectId: string | null;
  coordinateFramePolicy: CoordinateFramePolicy | null;
  onCoordinateFrameChange: (policy: CoordinateFramePolicy | null) => void;
  onObjectSelect: (objectId: string) => void;
  onObjectToggle: (objectId: string) => void;
  onObjectStateCycle: (objectId: string, direction: -1 | 1) => void;
  onObjectAllStatesToggle: (objectId: string) => void;
  projection: RenderProjection;
  selectedAtom: CanonicalAtom | null;
  activeSelection: Pick<SelectionResult, "count" | "status" | "membershipHash" | "query" | "coordinateContext"> | null;
  onClearSelection: () => void;
  measurementMode: MeasurementKind | null;
  measurementSlots: readonly string[];
  measurements: readonly MeasurementObject[];
  onMeasurementMode: (kind: MeasurementKind | null) => void;
  onMeasurementVisibility: (id: string, visible: boolean) => void;
  onMeasurementDelete: (id: string) => void;
  onMeasurementClear: () => void;
  analysisResults: readonly StructuralAnalysisResult[];
  loading: boolean;
  error: string | null;
  namedSelections: readonly { name: string; count: number }[];
  onNamedSelectionAction: (name: string, action: "A" | "S" | "H" | "L" | "C") => void;
};

const formatCount = (value: number) => value.toLocaleString("en-US");
const formatCoordinate = (value: number) => Number.isFinite(value) ? value.toFixed(3) : "—";
const formatOptional = (value: number | null | undefined, digits = 2) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);
const measurementLabel = (kind: MeasurementKind) => kind === "DISTANCE" ? "Distance" : kind === "ANGLE" ? "Angle" : "Dihedral";
const coordinateScopeLabel = (selection: Pick<SelectionResult, "coordinateContext">) => {
  const scopes = selection.coordinateContext?.stateScopes ?? [];
  if (!scopes.length) return null;
  return `${scopes.length === 1 ? "state" : "states"} ${scopes.map((scope) => scope.ordinal).join(", ")}`;
};

const ContextCard = ({ selectedAtom, onAction, onClearSelection }: { selectedAtom: CanonicalAtom | null; onAction: (actionId: ActionId) => void; onClearSelection: () => void }) => (
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
      <div className="inspector-inline-actions"><button type="button" onClick={() => onAction("CANVAS.SELECT")}>Inspect in canvas</button><button type="button" onClick={() => onAction("MEASURE.DISTANCE")}>Measure</button><button type="button" onClick={onClearSelection}>Clear selection</button></div>
    </div> : <div className="empty-inspector"><span className="empty-orbit"><Icon name="target" size={19} /></span><strong>No atom selected</strong><span>Pick an atom in the canvas to inspect canonical properties.</span></div>}
  </section>
);

const MeasurementCard = ({ measurementMode, measurementSlots, measurements, structure, onAction, onMeasurementMode, onMeasurementVisibility, onMeasurementDelete, onMeasurementClear, analysisResults }: { measurementMode: MeasurementKind | null; measurementSlots: readonly string[]; measurements: readonly MeasurementObject[]; structure: StructureLoadResult | null; onAction: (actionId: ActionId) => void; onMeasurementMode: (kind: MeasurementKind | null) => void; onMeasurementVisibility: (id: string, visible: boolean) => void; onMeasurementDelete: (id: string) => void; onMeasurementClear: () => void; analysisResults: readonly StructuralAnalysisResult[] }) => {
  const measurementKinds: MeasurementKind[] = ["DISTANCE", "ANGLE", "DIHEDRAL"];
  return <section className="panel-card analysis-card measurement-card" data-testid="measurements-panel">
    <div className="panel-heading"><div><span className="eyebrow">ANALYSIS &amp; INTERACTION</span><h2>Analysis &amp; Interaction</h2></div><span className="measurement-count" aria-label={`${measurements.length} measurements`}>{measurements.length}</span></div>
    <div className="analysis-tool-grid">{analysisTools.map((tool) => <button className="quick-tool" key={tool.label} onClick={() => onAction(tool.actionId)} data-action-id={tool.actionId} title={tool.capability ? `${tool.label} — ${tool.capability}` : tool.label}><span className="quick-icon"><Icon name={tool.icon} size={18} /></span><span>{tool.label}</span>{tool.capability && <small>{tool.capability}</small>}</button>)}</div>
    {analysisResults.length > 0 && <div className="analysis-results" data-testid="analysis-results">{analysisResults.map((result) => <div className="analysis-result" key={result.kind} data-analysis-kind={result.kind}><div><strong>{result.kind === "H_BONDS" ? "H-BONDS" : result.kind} · {result.status === "VALID_EMPTY" ? "EMPTY" : result.items.length}</strong><span>{result.diagnostic}</span></div><small>{result.profileId}</small></div>)}</div>}
    <div className="analysis-divider" />
    <div className="analysis-subheading"><span>Measurements</span><span className="capability-tag">CANONICAL PICKS</span></div>
    <div className="measurement-toolbar">{measurementKinds.map((kind) => <button type="button" className={`measurement-button ${measurementMode === kind ? "measurement-button--active" : ""}`} key={kind} aria-pressed={measurementMode === kind} onClick={() => { if (!structure) { onAction(`MEASURE.${kind}` as ActionId); return; } onMeasurementMode(measurementMode === kind ? null : kind); }}>{measurementLabel(kind)}</button>)}</div>
    {measurementMode && <div className="measurement-hint" role="status">Pick {measurementMode === "DISTANCE" ? "2" : measurementMode === "ANGLE" ? "3" : "4"} atoms in order. {measurementSlots.length} picked. <button type="button" onClick={onMeasurementClear}>Clear picks</button></div>}
    {measurements.length === 0 ? <div className="measurement-empty">No measurements yet<span>Results remain tied to the canonical coordinate revision.</span></div> : <div className="measurement-list">{measurements.map((measurement) => { const status = measurementStatus(measurement, structure?.structure ?? null); return <div className={`measurement-result measurement-result--${status.toLowerCase()}`} key={measurement.id} data-measurement-id={measurement.id}><div><strong>{measurementLabel(measurement.kind).toUpperCase()} · {status}</strong><span>{formatMeasurement(measurement)}</span><small>{measurement.participants.map((participant) => `${participant.atomName} ${participant.residueName}${participant.residueNumber}`).join(" → ")}</small></div><div className="measurement-actions"><button type="button" onClick={() => onMeasurementVisibility(measurement.id, !measurement.presentation.visible)}>{measurement.presentation.visible ? "Hide" : "Show"}</button><button type="button" onClick={() => onMeasurementDelete(measurement.id)}>Delete</button></div></div>; })}</div>}
    {measurements.length > 0 && <button type="button" className="measurement-clear-all" onClick={() => onAction("MEASURE.CLEAR")}>Clear measurement picks</button>}
  </section>;
};

export const StructurePanel = ({ collapsed, onToggle, onAction, structure, workspaceObjects, workspaceGroups, activeObjectId, coordinateFramePolicy, onCoordinateFrameChange, onObjectSelect, onObjectToggle, onObjectStateCycle, onObjectAllStatesToggle, projection, selectedAtom, activeSelection, onClearSelection, measurementMode, measurementSlots, measurements, onMeasurementMode, onMeasurementVisibility, onMeasurementDelete, onMeasurementClear, analysisResults, loading, error, namedSelections, onNamedSelectionAction }: StructurePanelProps) => {
  const counts = structure?.structure.counts;
  const components = [
    { label: "Protein", count: counts?.polymerAtoms ?? 0, tone: "blue", visible: projection.showProtein },
    { label: "Ligand", count: counts?.ligandAtoms ?? 0, tone: "purple", visible: projection.showLigand },
    { label: "Water", count: counts?.waterAtoms ?? 0, tone: "cyan", visible: projection.showWater },
    { label: "Ions", count: counts?.ionAtoms ?? 0, tone: "orange", visible: projection.showIons },
    { label: "Other", count: counts?.otherAtoms ?? 0, tone: "slate", visible: projection.showOther },
  ];

  if (collapsed) return <button className="collapsed-panel-tab collapsed-panel-tab--left" onClick={onToggle} aria-label="Expand structure panel"><Icon name="panelLeftOpen" size={17} /></button>;
  return <aside className="side-column side-column--left" aria-label="Structure, context and analysis panel">
    <section className="panel-card structure-card">
      <div className="panel-heading"><div><span className="eyebrow">PROJECT TREE</span><h2>Structure</h2></div><div className="panel-actions"><button className="icon-button" onClick={onToggle} aria-label="Collapse structure panel"><Icon name="panelLeftClose" size={16} /></button></div></div>
      {loading && <div className="ingestion-status"><Icon name="loader" size={14} /> Ingesting structure…</div>}
      {error && <div className="ingestion-error" role="alert">{error}</div>}
      {!structure && !loading && <div className="structure-empty">No structure loaded<span>Use File → Import or File → Fetch. Admitted formats: PDB · mmCIF</span></div>}
      {structure && <><div className="tree-item tree-item--root"><span className="tree-badge tree-badge--blue">P</span><span className="tree-label" title={structure.structure.source.originalFilename}>{structure.structure.source.originalFilename}</span><Icon name="eye" size={16} /></div><div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Polymer <span className="muted">({formatCount(structure.structure.counts.polymerAtoms)} atoms)</span></span><span className="tag tag--green">P</span><Icon name="eye" size={16} /></div><div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Non-polymer <span className="muted">({formatCount(structure.structure.counts.ligandAtoms)} atoms)</span></span><span className="tag tag--purple">L</span><Icon name="eye" size={16} /></div><div className="structure-source-meta">{structure.structure.source.kind === "RCSB" ? "RCSB" : "LOCAL FILE"} · {structure.structure.format.toUpperCase()} · sha256 {structure.structure.source.sha256.slice(0, 10)}…</div></>}
    </section>
    <section className="panel-card selections-card" data-testid="objects-selections-panel">
      <div className="panel-heading"><div><span className="eyebrow">CANONICAL SCOPE</span><h2>Objects &amp; Selections</h2></div><span className="capability-tag">SNAPSHOTS</span></div>
      {workspaceObjects.length === 0 && <div className="selection-empty">No molecular objects loaded.</div>}
      {workspaceObjects.map((object) => <div className={`selection-object-row ${object.objectId === activeObjectId ? "selection-object-row--active" : ""}`} key={object.objectId} data-object-id={object.objectId}>
        <button type="button" className="object-select-button" onClick={() => onObjectSelect(object.objectId)} aria-label={`Focus ${object.displayName}`}><span className="tree-badge tree-badge--blue">O</span><span className="tree-label" title={object.objectId}>{object.displayName}</span></button>
        <span className="muted">{object.loadResult.structure.counts.atoms.toLocaleString("en-US")} · {object.stateOrder.length} state{object.stateOrder.length === 1 ? "" : "s"}{object.stateOrder.length > 1 && <> · {Math.max(1, object.stateOrder.indexOf(object.currentStateId) + 1)}/{object.stateOrder.length}</>}</span>
        {object.stateOrder.length > 1 && <span className="object-state-actions"><button type="button" onClick={() => onObjectStateCycle(object.objectId, -1)} aria-label={`Previous state for ${object.displayName}`}>‹</button><button type="button" onClick={() => onObjectStateCycle(object.objectId, 1)} aria-label={`Next state for ${object.displayName}`}>›</button><button type="button" onClick={() => onObjectAllStatesToggle(object.objectId)} aria-label={`${object.allStates ? "Hide" : "Show"} all states for ${object.displayName}`}>{object.allStates ? "Σ" : "∑"}</button></span>}
        <button type="button" className="object-enable-button" onClick={() => onObjectToggle(object.objectId)} aria-label={`${object.enabled ? "Disable" : "Enable"} ${object.displayName}`}>{object.enabled ? "ON" : "OFF"}</button>
      </div>)}
      {workspaceGroups.length > 0 && <div className="workspace-group-list" data-testid="workspace-groups"><div className="analysis-subheading"><span>Groups</span><span className="capability-tag">ORGANIZATIONAL</span></div>{workspaceGroups.map((group) => <div className="workspace-group-row" key={group.groupId} data-group-id={group.groupId}><span className="tree-badge tree-badge--purple">G</span><span className="tree-label" title={group.groupId}>{group.name}</span><span className="muted">{group.open ? "open" : "closed"} · {group.objectIds.length} object{group.objectIds.length === 1 ? "" : "s"}</span></div>)}</div>}
      <div className="coordinate-frame-control" data-testid="coordinate-frame"><div className="analysis-subheading"><span>Spatial coordinate frame</span><span className="capability-tag">EXPLICIT</span></div><select aria-label="Spatial coordinate frame" value={coordinateFramePolicy ?? ""} onChange={(event) => onCoordinateFrameChange((event.target.value || null) as CoordinateFramePolicy | null)}><option value="">Undeclared (cross-object spatial blocked)</option><option value="LOCAL_SCIENTIFIC">LOCAL_SCIENTIFIC · raw canonical Å</option><option value="EFFECTIVE_WORLD">EFFECTIVE_WORLD · identity transforms</option></select><small>{coordinateFramePolicy === "LOCAL_SCIENTIFIC" ? "Compare raw canonical coordinates." : coordinateFramePolicy === "EFFECTIVE_WORLD" ? "Compare effective world coordinates; current object transforms are identity." : "Declare a policy before comparing coordinates across objects."}</small></div>
      {activeSelection ? <div className="active-selection-summary" data-testid="active-selection" data-membership-hash={activeSelection.membershipHash} data-coordinate-state-scopes={activeSelection.coordinateContext ? JSON.stringify(activeSelection.coordinateContext.stateScopes) : undefined}><span className="tree-badge tree-badge--cyan">A</span><span className="tree-label">Active selection</span><span className="muted">{formatCount(activeSelection.count)} atoms · {activeSelection.status.replaceAll("_", " ")}</span>{coordinateScopeLabel(activeSelection) && <span className="muted" title={JSON.stringify(activeSelection.coordinateContext?.stateScopes)}>· {coordinateScopeLabel(activeSelection)}</span>}</div> : <div className="selection-empty">No active selection.</div>}
      {namedSelections.length === 0 ? <div className="selection-empty">No named selections. Use <code>select active_site, …</code>.</div> : <div className="named-selection-list">{namedSelections.map((selection) => <div className="named-selection-row" key={selection.name}><span className="tree-badge tree-badge--purple">S</span><span className="tree-label" title={selection.name}>{selection.name}</span><span className="muted">{selection.count}</span><div className="named-selection-actions">{(["A", "S", "H", "L", "C"] as const).map((action) => <button type="button" key={action} title={`${action} ${selection.name}`} aria-label={`${action} ${selection.name}`} onClick={() => onNamedSelectionAction(selection.name, action)}>{action}</button>)}</div></div>)}</div>}
    </section>
    <section className="panel-card components-card"><div className="panel-heading"><div><span className="eyebrow">STRUCTURE INVENTORY</span><h2>Components</h2></div><span className="capability-tag">Projection only</span></div><div className="component-list">{components.map((component) => <div className="component-row" key={component.label}><span className={`component-dot component-dot--${component.tone} ${component.visible ? "component-dot--visible" : "component-dot--hidden"}`} aria-hidden="true" /><span>{component.label}</span><span className="component-count">{formatCount(component.count)}</span></div>)}</div></section>
    <ContextCard selectedAtom={selectedAtom} onAction={onAction} onClearSelection={onClearSelection} />
    <MeasurementCard measurementMode={measurementMode} measurementSlots={measurementSlots} measurements={measurements} structure={structure} onAction={onAction} onMeasurementMode={onMeasurementMode} onMeasurementVisibility={onMeasurementVisibility} onMeasurementDelete={onMeasurementDelete} onMeasurementClear={onMeasurementClear} analysisResults={analysisResults} />
  </aside>;
};
