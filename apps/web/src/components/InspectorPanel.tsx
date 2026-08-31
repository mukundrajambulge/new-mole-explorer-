import type { StructureLoadResult } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
import { BACKGROUND_PRESETS, COLOR_SCHEMES, type BackgroundPreset, type ColorMode, type RenderProjection, type RepresentationStyle } from "../rendering/renderProjection";
import { colorRegistry } from "../rendering/colorRegistry";
import { styleLabel, STYLE_DEFINITIONS } from "../rendering/styleProfiles";
import { styleProfileFor } from "../rendering/renderProjection";
import { Icon } from "./Icon";

type InspectorPanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  onAction: (actionId: ActionId) => void;
  structure: StructureLoadResult | null;
  projection: RenderProjection;
  onStyleChange: (style: RepresentationStyle) => void;
  onColorMode: (mode: ColorMode) => void;
  onNamedColor: (colorId: string) => void;
  onCustomColor: (hex: string) => void;
  onBackgroundPreset: (preset: BackgroundPreset) => void;
  onBackgroundColor: (hex: string) => void;
};

const styleOptions = STYLE_DEFINITIONS.filter((definition) => definition.id !== "licorice");
const toggleAction = (label: string): ActionId => ({ Protein: "REPRESENTATION.TOGGLE_PROTEIN", Ligand: "REPRESENTATION.TOGGLE_LIGAND", Water: "REPRESENTATION.TOGGLE_WATER", Ions: "REPRESENTATION.TOGGLE_IONS", Other: "REPRESENTATION.TOGGLE_OTHER" }[label] as ActionId);

export const InspectorPanel = ({ collapsed, onToggle, onAction, structure, projection, onStyleChange, onColorMode, onNamedColor, onCustomColor, onBackgroundPreset, onBackgroundColor }: InspectorPanelProps) => {
  if (collapsed) return <button className="collapsed-panel-tab collapsed-panel-tab--right" onClick={onToggle} aria-label="Expand inspector panel"><Icon name="panelRightOpen" size={17} /></button>;
  const toggleRow = (label: string, enabled: boolean, tone: "cyan" | "orange" | "blue" | "purple" | "slate") => { const actionId = toggleAction(label); return <button className="display-row display-row--button" onClick={() => onAction(actionId)} data-action-id={actionId} disabled={!structure}><span>{label}</span><span className={`switch switch--${tone} ${enabled ? "switch--on" : ""}`} role="switch" aria-checked={enabled}><span /></span></button>; };
  const selectedStyle = styleOptions.some((definition) => definition.id === projection.representation) ? projection.representation : styleProfileFor(projection.representation);

  return (
    <aside className="side-column side-column--right" aria-label="Selection inspector and display panel">
      <section className="panel-card inspector-card">
        <div className="panel-heading"><div><span className="eyebrow">CONTEXT</span><h2>Selection Inspector</h2></div><div className="panel-actions"><button className="icon-button" onClick={onToggle} aria-label="Collapse inspector panel"><Icon name="panelRightClose" size={16} /></button></div></div>
        <div className="inspector-selection"><span>Selection</span><span className="selection-chip">none</span></div>
        <div className="selection-meta">0 atoms · 0 residues</div><div className="inspector-divider" /><span className="eyebrow">PROPERTIES</span>
        <div className="empty-inspector"><span className="empty-orbit"><Icon name="target" size={22} /></span><strong>No selection</strong><span>Selection is reserved for a future gate.</span></div>
      </section>
      <section className="panel-card display-card">
        <div className="panel-heading"><div><span className="eyebrow">PROJECTION</span><h2>Display</h2></div><Icon name="sliders" size={16} /></div>
        <label className="display-row"><span>Style</span><select aria-label="Style" value={selectedStyle} onChange={(event) => onStyleChange(event.target.value as RepresentationStyle)}>{styleOptions.map((definition) => <option key={definition.id} value={definition.id} data-capability-state={definition.capability}>{definition.label}</option>)}</select></label>
        <div className="display-capability" data-style-profile={styleProfileFor(projection.representation)}>{styleLabel(styleProfileFor(projection.representation))} · {STYLE_DEFINITIONS.find((definition) => definition.id === styleProfileFor(projection.representation))?.capability.replaceAll("_", " ")}</div>
        <label className="display-row"><span>Color</span><select aria-label="Color mode" value={projection.color.mode} onChange={(event) => onColorMode(event.target.value as ColorMode)}>{COLOR_SCHEMES.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}</option>)}</select></label>
        {projection.color.mode === "named" && <label className="display-row display-row--sub"><span>Named</span><select aria-label="Named color" value={projection.color.colorId ?? "pymol:marine"} onChange={(event) => onNamedColor(event.target.value)}>{colorRegistry.list().map((definition) => <option key={definition.colorId} value={definition.colorId}>{definition.canonicalName}</option>)}</select></label>}
        {projection.color.mode === "custom" && <label className="display-row display-row--sub"><span>HEX</span><input aria-label="Custom color" type="color" value={projection.color.customHex ?? "#d7e0ea"} onChange={(event) => onCustomColor(event.target.value)} /></label>}
        {projection.colorDiagnostic && <div className="presentation-diagnostic" role="alert">{projection.colorDiagnostic}</div>}
        <label className="display-row"><span>Background</span><select aria-label="Background preset" value={projection.background.preset} onChange={(event) => onBackgroundPreset(event.target.value as BackgroundPreset)}>{BACKGROUND_PRESETS.map((preset) => <option key={preset} value={preset}>{preset}</option>)}</select></label>
        {projection.background.preset === "Custom" && <label className="display-row display-row--sub"><span>HEX</span><input aria-label="Custom background color" type="color" value={projection.background.color} onChange={(event) => onBackgroundColor(event.target.value)} /></label>}
        <div className="inspector-divider" /><span className="eyebrow">VISIBILITY</span>
        {toggleRow("Protein", projection.showProtein, "blue")}{toggleRow("Ligand", projection.showLigand, "purple")}{toggleRow("Water", projection.showWater, "cyan")}{toggleRow("Ions", projection.showIons, "orange")}{toggleRow("Other", projection.showOther, "slate")}
        <div className="inspector-divider" /><span className="eyebrow">VIEW</span>
        <div className="display-row"><span>Axes</span><span className="capability-tag">Coming Soon</span></div><div className="display-row"><span>Orientation</span><span className="capability-tag">Coming Soon</span></div>
        <button className="reset-view" onClick={() => onAction("VIEW.RESET")} data-action-id="VIEW.RESET"><Icon name="undo" size={14} /> Reset view</button>
      </section>
    </aside>
  );
};
