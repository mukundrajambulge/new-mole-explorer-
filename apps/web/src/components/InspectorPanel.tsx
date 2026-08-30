import type { StructureLoadResult } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
import { BACKGROUND_PRESETS, COLOR_MODES, type BackgroundPreset, type ColorMode, type RenderProjection } from "../rendering/renderProjection";
import { colorModeLabel, colorRegistry } from "../rendering/colorRegistry";
import { Icon } from "./Icon";

type InspectorPanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  onAction: (actionId: ActionId) => void;
  structure: StructureLoadResult | null;
  projection: RenderProjection;
  onColorMode: (mode: ColorMode) => void;
  onNamedColor: (colorId: string) => void;
  onCustomColor: (hex: string) => void;
  onBackgroundPreset: (preset: BackgroundPreset) => void;
  onBackgroundColor: (hex: string) => void;
};

const styleLabel: Record<RenderProjection["representation"], string> = {
  lines: "Lines",
  sticks: "Sticks",
  spheres: "Spheres",
  "ball-and-stick": "Ball & Stick",
  licorice: "Licorice",
  cartoon: "Cartoon",
};

export const InspectorPanel = ({ collapsed, onToggle, onAction, structure, projection, onColorMode, onNamedColor, onCustomColor, onBackgroundPreset, onBackgroundColor }: InspectorPanelProps) => {
  if (collapsed) return <button className="collapsed-panel-tab collapsed-panel-tab--right" onClick={onToggle} aria-label="Expand inspector panel"><Icon name="panelRightOpen" size={17} /></button>;

  const toggleRow = (label: string, enabled: boolean, actionId: ActionId, tone: "cyan" | "orange") => (
    <button className="display-row display-row--button" onClick={() => onAction(actionId)} data-action-id={actionId} disabled={!structure}>
      <span>{label}</span><span className={`switch switch--${tone} ${enabled ? "switch--on" : ""}`} role="switch" aria-checked={enabled}><span /></span>
    </button>
  );

  return (
    <aside className="side-column side-column--right" aria-label="Selection inspector and display panel">
      <section className="panel-card inspector-card">
        <div className="panel-heading"><div><span className="eyebrow">CONTEXT</span><h2>Selection Inspector</h2></div><div className="panel-actions"><button className="icon-button" onClick={onToggle} aria-label="Collapse inspector panel"><Icon name="panelRightClose" size={16} /></button></div></div>
        <div className="inspector-selection"><span>Selection</span><span className="selection-chip">none</span></div>
        <div className="selection-meta">0 atoms · 0 residues</div>
        <div className="inspector-divider" />
        <span className="eyebrow">PROPERTIES</span>
        <div className="empty-inspector"><span className="empty-orbit"><Icon name="target" size={22} /></span><strong>No selection</strong><span>Selection is reserved for a future gate.</span></div>
      </section>
      <section className="panel-card display-card">
        <div className="panel-heading"><div><span className="eyebrow">PROJECTION</span><h2>Display</h2></div><Icon name="sliders" size={16} /></div>
        <button className="display-row display-row--button" onClick={() => onAction("REPRESENTATION.SET_STYLE")} data-action-id="REPRESENTATION.SET_STYLE"><span>Style</span><span className="select-value">{styleLabel[projection.representation]}<Icon name="arrowDown" size={14} /></span></button>
        <label className="display-row"><span>Color</span><select aria-label="Color mode" value={projection.color.mode} onChange={(event) => onColorMode(event.target.value as ColorMode)}>{COLOR_MODES.map((mode) => <option key={mode} value={mode}>{colorModeLabel(mode)}</option>)}</select></label>
        {projection.color.mode === "named" && <label className="display-row display-row--sub"><span>Named</span><select aria-label="Named color" value={projection.color.colorId ?? "pymol:marine"} onChange={(event) => onNamedColor(event.target.value)}>{colorRegistry.list().map((definition) => <option key={definition.colorId} value={definition.colorId}>{definition.canonicalName}</option>)}</select></label>}
        {projection.color.mode === "custom" && <label className="display-row display-row--sub"><span>HEX</span><input aria-label="Custom color" type="color" value={projection.color.customHex ?? "#d7e0ea"} onChange={(event) => onCustomColor(event.target.value)} /></label>}
        <label className="display-row"><span>Background</span><select aria-label="Background preset" value={projection.background.preset} onChange={(event) => onBackgroundPreset(event.target.value as BackgroundPreset)}>{BACKGROUND_PRESETS.map((preset) => <option key={preset} value={preset}>{preset}</option>)}</select></label>
        {projection.background.preset === "Custom" && <label className="display-row display-row--sub"><span>HEX</span><input aria-label="Custom background color" type="color" value={projection.background.color} onChange={(event) => onBackgroundColor(event.target.value)} /></label>}
        <div className="display-row"><span>Axes</span><span className="capability-tag">Coming Soon</span></div>
        <div className="display-row"><span>Orientation</span><span className="capability-tag">Coming Soon</span></div>
        {toggleRow("Water", projection.showWater, "REPRESENTATION.TOGGLE_WATER", "cyan")}
        {toggleRow("Ions", projection.showIons, "REPRESENTATION.TOGGLE_IONS", "orange")}
        <button className="reset-view" onClick={() => onAction("VIEW.RESET")} data-action-id="VIEW.RESET"><Icon name="undo" size={14} /> Reset view</button>
      </section>
    </aside>
  );
};
