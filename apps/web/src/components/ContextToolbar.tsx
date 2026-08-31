import type { ActionId } from "../domain/registry";
import { COLOR_MODES, type ColorMode, type RepresentationStyle } from "../rendering/renderProjection";
import { Icon, type IconName } from "./Icon";
import { RIBBON_CATEGORIES, type RibbonCategory } from "./MenuBar";

type RibbonItem = { label: string; icon: IconName; actionId: ActionId; dividerAfter?: boolean; capability?: "Coming Soon" | "Unavailable" };

const ribbonItems: Record<Exclude<RibbonCategory, "Color">, RibbonItem[]> = {
  File: [
    { label: "New", icon: "filePlus", actionId: "FILE.NEW" },
    { label: "Open", icon: "folder", actionId: "FILE.OPEN" },
    { label: "Save", icon: "save", actionId: "FILE.SAVE" },
    { label: "Import", icon: "upload", actionId: "FILE.IMPORT" },
    { label: "Export", icon: "download", actionId: "FILE.EXPORT", capability: "Coming Soon", dividerAfter: true },
    { label: "Fetch", icon: "cloudDownload", actionId: "STRUCTURE.FETCH_RCSB" },
  ],
  Edit: [
    { label: "Delete atom", icon: "trash", actionId: "EDIT.ATOM_DELETE", capability: "Unavailable" },
    { label: "Create bond", icon: "plus", actionId: "EDIT.BOND_CREATE", capability: "Unavailable" },
  ],
  Select: [
    { label: "Select", icon: "pointer", actionId: "CANVAS.SELECT", capability: "Coming Soon" },
    { label: "Evaluate", icon: "command", actionId: "SELECTION.EVALUATE", capability: "Coming Soon" },
  ],
  Display: [
    { label: "Lines", icon: "minus", actionId: "REPRESENTATION.LINES" },
    { label: "Sticks", icon: "pencil", actionId: "REPRESENTATION.STICKS" },
    { label: "Spheres", icon: "circleUser", actionId: "REPRESENTATION.SPHERES" },
    { label: "Cartoon", icon: "activity", actionId: "REPRESENTATION.CARTOON" },
    { label: "Ribbon", icon: "layers", actionId: "REPRESENTATION.RIBBON", capability: "Coming Soon" },
    { label: "Surface", icon: "waves", actionId: "REPRESENTATION.SURFACE", capability: "Coming Soon" },
    { label: "Ball & Stick", icon: "shapes", actionId: "REPRESENTATION.BALL_AND_STICK" },
    { label: "Licorice", icon: "sparkles", actionId: "REPRESENTATION.LICORICE" },
  ],
  Measure: [
    { label: "Distance", icon: "ruler", actionId: "MEASURE.DISTANCE", capability: "Coming Soon" },
  ],
  Analyze: [
    { label: "Selection", icon: "command", actionId: "SELECTION.EVALUATE", capability: "Coming Soon" },
  ],
  Dock: [
    { label: "Configure", icon: "settings", actionId: "DOCKING.CONFIGURE", capability: "Coming Soon" },
    { label: "Run", icon: "activity", actionId: "DOCKING.RUN", capability: "Unavailable" },
  ],
  View: [
    { label: "Pan", icon: "hand", actionId: "CANVAS.PAN" },
    { label: "Rotate", icon: "rotate", actionId: "CANVAS.ROTATE" },
    { label: "Zoom", icon: "zoom", actionId: "CANVAS.ZOOM" },
    { label: "Focus", icon: "target", actionId: "CANVAS.FOCUS" },
    { label: "Center", icon: "target", actionId: "CANVAS.FOCUS" },
    { label: "Reset View", icon: "plus", actionId: "VIEW.RESET" },
  ],
  Help: [
    { label: "G1B help", icon: "help", actionId: "HELP.OPEN" },
  ],
};

const colorLabels: Record<ColorMode, string> = {
  element: "Element",
  chain: "Chain",
  object: "Object",
  residue: "Residue",
  "secondary-structure": "Secondary structure",
  uniform: "Uniform",
  named: "Named",
  custom: "Custom",
};

const representationByAction: Partial<Record<ActionId, RepresentationStyle>> = {
  "REPRESENTATION.LINES": "lines",
  "REPRESENTATION.STICKS": "sticks",
  "REPRESENTATION.SPHERES": "spheres",
  "REPRESENTATION.CARTOON": "cartoon",
  "REPRESENTATION.BALL_AND_STICK": "ball-and-stick",
  "REPRESENTATION.LICORICE": "licorice",
};

type ContextToolbarProps = {
  activeTool: string;
  activeCategory: RibbonCategory;
  collapsed: boolean;
  representation: RepresentationStyle;
  colorMode: ColorMode;
  onAction: (actionId: ActionId) => void;
  onImport?: () => void;
  onColorMode: (mode: ColorMode) => void;
  onToggleCollapsed: () => void;
};

export const ContextToolbar = ({ activeTool, activeCategory, collapsed, representation, colorMode, onAction, onImport, onColorMode, onToggleCollapsed }: ContextToolbarProps) => {
  const items = activeCategory === "Color" ? [] : ribbonItems[activeCategory] ?? [];
  const actionForItem = (item: RibbonItem) => {
    if (item.actionId === "FILE.IMPORT" && onImport) onImport();
    else onAction(item.actionId);
  };

  return (
    <section className={`context-toolbar ${collapsed ? "context-toolbar--collapsed" : ""}`} aria-label="Contextual toolbar" data-ribbon-category={activeCategory}>
      <div className="ribbon-heading">
        <div><span className="eyebrow">PRESENTATION RIBBON</span><strong>{activeCategory}</strong></div>
        <button className="icon-button ribbon-toggle" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand ribbon" : "Collapse ribbon"} title={collapsed ? "Expand ribbon" : "Collapse ribbon"}><Icon name={collapsed ? "panelLeftOpen" : "panelLeftClose"} size={15} /></button>
      </div>
      {!collapsed && <div className="ribbon-scroll">
        {activeCategory === "Color" ? (
          <div className="ribbon-color-controls" role="group" aria-label="Color controls">
            {COLOR_MODES.map((mode) => <button key={mode} className={`ribbon-color-button ${colorMode === mode ? "ribbon-color-button--active" : ""}`} type="button" onClick={() => onColorMode(mode)} aria-pressed={colorMode === mode} data-color-mode={mode}>{colorLabels[mode]}</button>)}
          </div>
        ) : items.map((item) => {
          const active = representationByAction[item.actionId] === representation;
          return <div className={`toolbar-group ${item.dividerAfter ? "toolbar-group--divider" : ""}`} key={`${activeCategory}-${item.label}`}>
            <button className={`tool-button ${active || activeTool === item.label ? "tool-button--active" : ""} ${item.capability ? "tool-button--capability" : ""}`} type="button" onClick={() => actionForItem(item)} aria-label={item.label} title={item.capability ? `${item.label} — ${item.capability}` : item.label} data-action-id={item.actionId} data-capability-state={item.capability ?? "SUPPORTED"}>
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {item.capability && <small>{item.capability}</small>}
            </button>
          </div>;
        })}
      </div>}
    </section>
  );
};

export { RIBBON_CATEGORIES };
