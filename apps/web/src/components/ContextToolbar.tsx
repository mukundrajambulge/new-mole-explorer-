import type { ActionId } from "../domain/registry";
import { COLOR_MODES, COLOR_SCHEMES, type ColorMode, type RepresentationStyle } from "../rendering/renderProjection";
import { Icon, type IconName } from "./Icon";
import { RIBBON_CATEGORIES, type RibbonCategory } from "./MenuBar";

type RibbonItem = { label: string; icon: IconName; actionId: ActionId; style?: RepresentationStyle; dividerAfter?: boolean; capability?: "Coming Soon" | "Unavailable" };

const ribbonItems: Record<Exclude<RibbonCategory, "Color">, RibbonItem[]> = {
  File: [
    { label: "New", icon: "filePlus", actionId: "FILE.NEW" }, { label: "Open", icon: "folder", actionId: "FILE.OPEN" }, { label: "Save", icon: "save", actionId: "FILE.SAVE" }, { label: "Import", icon: "upload", actionId: "FILE.IMPORT" }, { label: "Export", icon: "download", actionId: "FILE.EXPORT", capability: "Coming Soon", dividerAfter: true }, { label: "Fetch", icon: "cloudDownload", actionId: "STRUCTURE.FETCH_RCSB" },
  ],
  Edit: [{ label: "Delete atom", icon: "trash", actionId: "EDIT.ATOM_DELETE", capability: "Unavailable" }, { label: "Create bond", icon: "plus", actionId: "EDIT.BOND_CREATE", capability: "Unavailable" }],
  Select: [{ label: "Select", icon: "pointer", actionId: "CANVAS.SELECT", capability: "Coming Soon" }, { label: "Evaluate", icon: "command", actionId: "SELECTION.EVALUATE", capability: "Coming Soon" }],
  Display: [
    { label: "Lines", icon: "minus", actionId: "REPRESENTATION.LINES", style: "lines" }, { label: "Sticks", icon: "pencil", actionId: "REPRESENTATION.STICKS", style: "sticks" }, { label: "Spheres", icon: "circleUser", actionId: "REPRESENTATION.SPHERES", style: "spheres" }, { label: "Space Filling", icon: "circleUser", actionId: "REPRESENTATION.SPHERES", style: "space-filling" }, { label: "Cartoon", icon: "activity", actionId: "REPRESENTATION.CARTOON", style: "cartoon" },
    { label: "Ribbon", icon: "layers", actionId: "REPRESENTATION.RIBBON", capability: "Coming Soon" }, { label: "Trace", icon: "activity", actionId: "REPRESENTATION.CARTOON", style: "trace" }, { label: "Putty", icon: "activity", actionId: "REPRESENTATION.CARTOON", style: "putty" }, { label: "Ball & Stick", icon: "shapes", actionId: "REPRESENTATION.BALL_AND_STICK", style: "ball-and-stick" }, { label: "Licorice", icon: "sparkles", actionId: "REPRESENTATION.LICORICE", style: "licorice" }, { label: "Non-bonded crosses", icon: "plus", actionId: "REPRESENTATION.SET_STYLE", style: "nonbonded-crosses" }, { label: "Non-bonded spheres", icon: "circleUser", actionId: "REPRESENTATION.SET_STYLE", style: "nonbonded-spheres" },
    { label: "VDW", icon: "waves", actionId: "REPRESENTATION.SURFACE", capability: "Coming Soon" }, { label: "SAS", icon: "waves", actionId: "REPRESENTATION.SURFACE", capability: "Coming Soon" }, { label: "SES", icon: "waves", actionId: "REPRESENTATION.SURFACE", capability: "Coming Soon" }, { label: "Mesh", icon: "waves", actionId: "REPRESENTATION.SURFACE", capability: "Coming Soon" }, { label: "Dots", icon: "waves", actionId: "REPRESENTATION.SURFACE", capability: "Coming Soon" }, { label: "Dot Surface", icon: "waves", actionId: "REPRESENTATION.SURFACE", capability: "Coming Soon" },
    { label: "Protein", icon: "box", actionId: "REPRESENTATION.TOGGLE_PROTEIN" }, { label: "Ligand", icon: "shapes", actionId: "REPRESENTATION.TOGGLE_LIGAND" }, { label: "Water", icon: "waves", actionId: "REPRESENTATION.TOGGLE_WATER" }, { label: "Ions", icon: "sparkles", actionId: "REPRESENTATION.TOGGLE_IONS" }, { label: "Other", icon: "circleHelp", actionId: "REPRESENTATION.TOGGLE_OTHER" },
  ],
  Measure: [{ label: "Distance", icon: "ruler", actionId: "MEASURE.DISTANCE", capability: "Coming Soon" }],
  Analyze: [{ label: "Selection", icon: "command", actionId: "SELECTION.EVALUATE", capability: "Coming Soon" }],
  Dock: [{ label: "Configure", icon: "settings", actionId: "DOCKING.CONFIGURE", capability: "Coming Soon" }, { label: "Run", icon: "activity", actionId: "DOCKING.RUN", capability: "Unavailable" }],
  View: [{ label: "Pan", icon: "hand", actionId: "CANVAS.PAN" }, { label: "Rotate", icon: "rotate", actionId: "CANVAS.ROTATE" }, { label: "Zoom", icon: "zoom", actionId: "CANVAS.ZOOM" }, { label: "Focus", icon: "target", actionId: "CANVAS.FOCUS" }, { label: "Center", icon: "target", actionId: "CANVAS.FOCUS" }, { label: "Reset View", icon: "plus", actionId: "VIEW.RESET" }, { label: "Projection", icon: "layers", actionId: "VIEW.THEME", capability: "Coming Soon" }, { label: "Clipping", icon: "layers", actionId: "VIEW.THEME", capability: "Coming Soon" }, { label: "Background", icon: "circleUser", actionId: "VIEW.THEME", capability: "Coming Soon" }, { label: "Axes", icon: "target", actionId: "VIEW.THEME", capability: "Coming Soon" }],
  Help: [{ label: "G1C help", icon: "help", actionId: "HELP.OPEN" }],
};

const representationByAction: Partial<Record<ActionId, RepresentationStyle>> = { "REPRESENTATION.LINES": "lines", "REPRESENTATION.STICKS": "sticks", "REPRESENTATION.SPHERES": "spheres", "REPRESENTATION.CARTOON": "cartoon", "REPRESENTATION.BALL_AND_STICK": "ball-and-stick", "REPRESENTATION.LICORICE": "licorice" };
const quickColorSchemes: Array<[ColorMode, string]> = [["classic-cpk", "Classic CPK"], ["chain", "Chain"], ["monochrome", "Uniform"], ["hydrophobicity", "Hydrophobicity"], ["secondary-structure-standard", "Secondary Structure"]];

type ContextToolbarProps = { activeTool: string; activeCategory: RibbonCategory; collapsed: boolean; representation: RepresentationStyle; colorMode: ColorMode; onAction: (actionId: ActionId) => void; onImport?: () => void; onColorMode: (mode: ColorMode) => void; onStyleChange: (style: RepresentationStyle) => void; onToggleCollapsed: () => void };

export const ContextToolbar = ({ activeTool, activeCategory, collapsed, representation, colorMode, onAction, onImport, onColorMode, onStyleChange, onToggleCollapsed }: ContextToolbarProps) => {
  const items = activeCategory === "Color" ? [] : ribbonItems[activeCategory] ?? [];
  const actionForItem = (item: RibbonItem) => { if (item.actionId === "FILE.IMPORT" && onImport) onImport(); else if (item.style && !item.capability) onStyleChange(item.style); else onAction(item.actionId); };
  return (
    <section className={`context-toolbar ${collapsed ? "context-toolbar--collapsed" : ""}`} aria-label="Contextual toolbar" data-ribbon-category={activeCategory}>
      <div className="ribbon-heading"><div><span className="eyebrow">PRESENTATION RIBBON</span><strong>{activeCategory}</strong></div><button className="icon-button ribbon-toggle" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand ribbon" : "Collapse ribbon"} title={collapsed ? "Expand ribbon" : "Collapse ribbon"}><Icon name={collapsed ? "panelLeftOpen" : "panelLeftClose"} size={15} /></button></div>
      {!collapsed && <div className="ribbon-scroll">
        {activeCategory === "Color" ? <div className="ribbon-color-controls" role="group" aria-label="Color controls">
          <label className="ribbon-select-label">Scheme<select aria-label="Ribbon color scheme" value={colorMode} onChange={(event) => onColorMode(event.target.value as ColorMode)}>{COLOR_SCHEMES.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}</option>)}</select></label>
          <div className="ribbon-color-gallery" role="group" aria-label="Quick color schemes">{quickColorSchemes.map(([mode, label]) => <button key={mode} className={`ribbon-color-button ${colorMode === mode ? "ribbon-color-button--active" : ""}`} type="button" onClick={() => onColorMode(mode)} aria-pressed={colorMode === mode} data-color-mode={mode}>{label}</button>)}</div>
          <span className="ribbon-scheme-count">{COLOR_MODES.length} schemes</span>
        </div> : items.map((item) => {
          const active = item.style ? item.style === representation : representationByAction[item.actionId] === representation;
          return <div className={`toolbar-group ${item.dividerAfter ? "toolbar-group--divider" : ""}`} key={`${activeCategory}-${item.label}`}><button className={`tool-button ${active || activeTool === item.label ? "tool-button--active" : ""} ${item.capability ? "tool-button--capability" : ""}`} type="button" onClick={() => actionForItem(item)} aria-label={item.label} title={item.capability ? `${item.label} — ${item.capability}` : item.label} data-action-id={item.actionId} data-style-profile={item.style ?? ""} data-capability-state={item.capability ?? "SUPPORTED"}><Icon name={item.icon} size={20} /><span>{item.label}</span>{item.capability && <small>{item.capability}</small>}</button></div>;
        })}
      </div>}
    </section>
  );
};

export { RIBBON_CATEGORIES };
