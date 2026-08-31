import type { ActionId } from "../domain/registry";
import { COLOR_MODES, COLOR_SCHEMES, styleProfileFor, type ColorMode, type RepresentationStyle } from "../rendering/renderProjection";
import { representationCapabilityFor, STYLE_DEFINITIONS } from "../rendering/styleProfiles";
import { Icon, type IconName } from "./Icon";
import { RIBBON_CATEGORIES, type RibbonCategory } from "./MenuBar";

type RibbonItem = { label: string; icon: IconName; actionId: ActionId; style?: RepresentationStyle; dividerAfter?: boolean; capability?: "Coming Soon" | "Unavailable"; representationStatus?: string };

const ribbonItems: Partial<Record<Exclude<RibbonCategory, "Color" | "Display">, RibbonItem[]>> = {
  File: [
    { label: "New", icon: "filePlus", actionId: "FILE.NEW" },
    { label: "Open Project", icon: "folder", actionId: "PROJECT.OPEN" },
    { label: "Save", icon: "save", actionId: "PROJECT.SAVE" },
    { label: "Open", icon: "folder", actionId: "FILE.OPEN" },
    { label: "Import", icon: "upload", actionId: "FILE.IMPORT" },
    { label: "Fetch", icon: "cloudDownload", actionId: "STRUCTURE.FETCH_RCSB", dividerAfter: true },
    { label: "Export", icon: "download", actionId: "FILE.EXPORT", capability: "Coming Soon" },
  ],
  Edit: [{ label: "Delete atom", icon: "trash", actionId: "EDIT.ATOM_DELETE", capability: "Unavailable" }, { label: "Create bond", icon: "plus", actionId: "EDIT.BOND_CREATE", capability: "Unavailable" }],
  Select: [{ label: "Select", icon: "pointer", actionId: "CANVAS.SELECT" }, { label: "Evaluate", icon: "command", actionId: "SELECTION.EVALUATE", capability: "Coming Soon" }],
  Measure: [{ label: "Distance", icon: "ruler", actionId: "MEASURE.DISTANCE" }, { label: "Angle", icon: "move3d", actionId: "MEASURE.ANGLE" }, { label: "Dihedral", icon: "rotate", actionId: "MEASURE.DIHEDRAL" }, { label: "Clear picks", icon: "trash", actionId: "MEASURE.CLEAR" }],
  Analyze: [{ label: "Selection", icon: "command", actionId: "SELECTION.EVALUATE", capability: "Coming Soon" }],
  Dock: [{ label: "Configure", icon: "settings", actionId: "DOCKING.CONFIGURE", capability: "Coming Soon" }, { label: "Run", icon: "activity", actionId: "DOCKING.RUN", capability: "Unavailable" }],
  View: [{ label: "Pan", icon: "hand", actionId: "CANVAS.PAN" }, { label: "Rotate", icon: "rotate", actionId: "CANVAS.ROTATE" }, { label: "Zoom", icon: "zoom", actionId: "CANVAS.ZOOM" }, { label: "Focus", icon: "target", actionId: "CANVAS.FOCUS" }, { label: "Center", icon: "target", actionId: "VIEW.CENTER" }, { label: "Reset View", icon: "plus", actionId: "VIEW.RESET" }, { label: "Projection", icon: "layers", actionId: "VIEW.PROJECTION" }, { label: "Clipping", icon: "layers", actionId: "VIEW.CAMERA", capability: "Coming Soon" }, { label: "Background", icon: "circleUser", actionId: "VIEW.CAMERA", capability: "Coming Soon" }, { label: "Axes", icon: "target", actionId: "VIEW.CAMERA", capability: "Coming Soon" }],
  Help: [{ label: "G1C help", icon: "help", actionId: "HELP.OPEN" }],
};

const displayIconFor = (id: string): IconName => id.includes("surface") || id === "dots" || id === "mesh" || id === "dot-surface" ? "waves" : id === "cartoon" || id === "trace" || id === "putty" ? "activity" : id === "ribbon" ? "layers" : id.includes("sphere") || id === "space-filling" ? "circleUser" : id === "ball-and-stick" ? "shapes" : id === "licorice" ? "sparkles" : id.includes("nonbonded") ? "plus" : id === "line" ? "minus" : "pencil";
const displayLabelFor = (id: string, label: string): string => id === "line" ? "Lines" : id === "stick" ? "Sticks" : id === "space-filling" ? "Spheres" : id === "ball-and-stick" ? "Ball & Stick" : label;
const displayItems = (): RibbonItem[] => STYLE_DEFINITIONS.map((definition) => ({ label: displayLabelFor(definition.id, definition.label), icon: displayIconFor(definition.id), actionId: definition.actionId as ActionId, style: definition.id as RepresentationStyle, capability: definition.maySelect ? undefined : definition.capability === "UNAVAILABLE" ? "Unavailable" : "Coming Soon", representationStatus: definition.status }));
const quickColorSchemes: Array<[ColorMode, string]> = [["classic-cpk", "Classic CPK"], ["chain", "Chain"], ["monochrome", "Uniform"], ["hydrophobicity", "Hydrophobicity"], ["secondary-structure-standard", "Secondary Structure"]];

type ContextToolbarProps = { activeTool: string; activeCategory: RibbonCategory; collapsed: boolean; representation: RepresentationStyle; colorMode: ColorMode; onAction: (actionId: ActionId) => void; onImport?: () => void; onColorMode: (mode: ColorMode) => void; onStyleChange: (style: RepresentationStyle) => void; onToggleCollapsed: () => void };

export const ContextToolbar = ({ activeTool, activeCategory, collapsed, representation, colorMode, onAction, onImport, onColorMode, onStyleChange, onToggleCollapsed }: ContextToolbarProps) => {
  const items = activeCategory === "Display" ? displayItems() : activeCategory === "Color" ? [] : ribbonItems[activeCategory] ?? [];
  const actionForItem = (item: RibbonItem) => { if (item.actionId === "FILE.IMPORT" && onImport) onImport(); else if (item.style) onStyleChange(item.style); else onAction(item.actionId); };
  return (
    <section className={`context-toolbar ${collapsed ? "context-toolbar--collapsed" : ""}`} aria-label="Contextual toolbar" data-ribbon-category={activeCategory}>
      <div className="ribbon-heading"><div><span className="eyebrow">PRESENTATION RIBBON</span><strong>{activeCategory}</strong></div><button className="icon-button ribbon-toggle" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand ribbon" : "Collapse ribbon"} title={collapsed ? "Expand ribbon" : "Collapse ribbon"}><Icon name={collapsed ? "panelLeftOpen" : "panelLeftClose"} size={15} /></button></div>
      {!collapsed && <div className="ribbon-scroll">
        {activeCategory === "Color" ? <div className="ribbon-color-controls" role="group" aria-label="Color controls">
          <label className="ribbon-select-label">Scheme<select aria-label="Ribbon color scheme" value={colorMode} onChange={(event) => onColorMode(event.target.value as ColorMode)}>{COLOR_SCHEMES.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}</option>)}</select></label>
          <div className="ribbon-color-gallery" role="group" aria-label="Quick color schemes">{quickColorSchemes.map(([mode, label]) => <button key={mode} className={`ribbon-color-button ${colorMode === mode ? "ribbon-color-button--active" : ""}`} type="button" onClick={() => onColorMode(mode)} aria-pressed={colorMode === mode} data-color-mode={mode}>{label}</button>)}</div>
          <span className="ribbon-scheme-count">{COLOR_MODES.length} schemes</span>
        </div> : items.map((item) => {
          const active = item.style ? styleProfileFor(representation) === styleProfileFor(item.style) : activeTool === item.label;
          const resolved = item.style ? representationCapabilityFor(item.style) : null;
          return <div className={`toolbar-group ${item.dividerAfter ? "toolbar-group--divider" : ""}`} key={`${activeCategory}-${item.label}`}><button className={`tool-button ${active ? "tool-button--active" : ""} ${item.capability ? "tool-button--capability" : ""}`} type="button" onClick={() => actionForItem(item)} aria-label={item.label} title={item.capability ? `${item.label} — ${item.capability}` : item.label} data-action-id={item.actionId} data-style-profile={item.style ?? ""} data-capability-state={item.capability ?? resolved?.capability ?? "SUPPORTED"} data-representation-status={item.representationStatus ?? resolved?.status ?? ""}><Icon name={item.icon} size={20} /><span>{item.label}</span>{(item.capability || item.representationStatus === "VALID_EMPTY") && <small>{item.capability ?? item.representationStatus}</small>}</button></div>;
        })}
      </div>}
    </section>
  );
};

export { RIBBON_CATEGORIES };
