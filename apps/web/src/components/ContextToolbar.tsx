import { useRef, useState } from "react";
import type { BondOrder } from "@molecular/contracts";
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
    { label: "Add Structure", icon: "plus", actionId: "STRUCTURE.ADD" },
    { label: "Fetch", icon: "cloudDownload", actionId: "STRUCTURE.FETCH_RCSB", dividerAfter: true },
    { label: "Export", icon: "download", actionId: "FILE.EXPORT", capability: "Coming Soon" },
  ],
  Edit: [],
  Select: [{ label: "Select", icon: "pointer", actionId: "CANVAS.SELECT" }, { label: "Evaluate", icon: "command", actionId: "SELECTION.EVALUATE" }],
  Measure: [{ label: "Distance", icon: "ruler", actionId: "MEASURE.DISTANCE" }, { label: "Angle", icon: "move3d", actionId: "MEASURE.ANGLE" }, { label: "Dihedral", icon: "rotate", actionId: "MEASURE.DIHEDRAL" }, { label: "Clear picks", icon: "trash", actionId: "MEASURE.CLEAR" }],
  Analyze: [{ label: "Selection", icon: "command", actionId: "SELECTION.EVALUATE" }],
  Dock: [{ label: "Configure", icon: "settings", actionId: "DOCKING.CONFIGURE", capability: "Coming Soon" }, { label: "Run", icon: "activity", actionId: "DOCKING.RUN", capability: "Unavailable" }],
  View: [{ label: "Pan", icon: "hand", actionId: "CANVAS.PAN" }, { label: "Rotate", icon: "rotate", actionId: "CANVAS.ROTATE" }, { label: "Zoom", icon: "zoom", actionId: "CANVAS.ZOOM" }, { label: "Focus", icon: "target", actionId: "CANVAS.FOCUS" }, { label: "Center", icon: "target", actionId: "VIEW.CENTER" }, { label: "Reset View", icon: "plus", actionId: "VIEW.RESET" }, { label: "Projection", icon: "layers", actionId: "VIEW.PROJECTION" }, { label: "Clipping", icon: "layers", actionId: "VIEW.CAMERA", capability: "Coming Soon" }, { label: "Background", icon: "circleUser", actionId: "VIEW.CAMERA", capability: "Coming Soon" }, { label: "Axes", icon: "target", actionId: "VIEW.CAMERA", capability: "Coming Soon" }],
  Help: [{ label: "G1C help", icon: "help", actionId: "HELP.OPEN" }],
};

const displayIconFor = (id: string): IconName => id.includes("surface") || id === "dots" || id === "mesh" || id === "dot-surface" ? "waves" : id === "cartoon" || id === "trace" || id === "putty" ? "activity" : id === "ribbon" ? "layers" : id.includes("sphere") || id === "space-filling" ? "circleUser" : id === "ball-and-stick" ? "shapes" : id === "licorice" ? "sparkles" : id.includes("nonbonded") ? "plus" : id === "line" ? "minus" : "pencil";
const displayLabelFor = (id: string, label: string): string => id === "line" ? "Lines" : id === "stick" ? "Sticks" : id === "space-filling" ? "Spheres" : id === "ball-and-stick" ? "Ball & Stick" : label;
const displayItems = (): RibbonItem[] => STYLE_DEFINITIONS.map((definition) => ({ label: displayLabelFor(definition.id, definition.label), icon: displayIconFor(definition.id), actionId: definition.actionId as ActionId, style: definition.id as RepresentationStyle, capability: definition.maySelect ? undefined : definition.capability === "UNAVAILABLE" ? "Unavailable" : "Coming Soon", representationStatus: definition.status }));
const quickColorSchemes: Array<[ColorMode, string]> = [["classic-cpk", "Classic CPK"], ["chain", "Chain"], ["monochrome", "Uniform"], ["hydrophobicity", "Hydrophobicity"], ["secondary-structure-standard", "Secondary Structure"]];

type ContextToolbarProps = { activeTool: string; activeCategory: RibbonCategory; collapsed: boolean; representation: RepresentationStyle; colorMode: ColorMode; onAction: (actionId: ActionId) => void; onImport?: () => void; onFetchRcsb: (pdbId: string, mode?: "replace" | "add") => void; onColorMode: (mode: ColorMode) => void; onStyleChange: (style: RepresentationStyle) => void; onToggleCollapsed: () => void; editSelectionCount?: number; editObjectName?: string; canUndo?: boolean; canRedo?: boolean; onEditBondOrder?: (order: Exclude<BondOrder, "UNKNOWN">) => void };

export const ContextToolbar = ({ activeTool, activeCategory, collapsed, representation, colorMode, onAction, onImport, onFetchRcsb, onColorMode, onStyleChange, onToggleCollapsed, editSelectionCount = 0, editObjectName, canUndo = false, canRedo = false, onEditBondOrder }: ContextToolbarProps) => {
  const [pdbId, setPdbId] = useState("");
  const [showRcsb, setShowRcsb] = useState(false);
  const rcsbInputRef = useRef<HTMLInputElement>(null);
  const items = activeCategory === "Display" ? displayItems() : activeCategory === "Color" ? [] : ribbonItems[activeCategory] ?? [];
  const actionForItem = (item: RibbonItem) => { if (item.actionId === "FILE.IMPORT" && onImport) onImport(); else if (item.actionId === "STRUCTURE.FETCH_RCSB") { setShowRcsb(true); window.setTimeout(() => rcsbInputRef.current?.focus(), 0); } else if (item.style) onStyleChange(item.style); else onAction(item.actionId); };
  const submitRcsb = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const normalized = pdbId.trim().toUpperCase(); if (normalized) onFetchRcsb(normalized, "replace"); };
  const addRcsb = () => { const normalized = pdbId.trim().toUpperCase(); if (normalized) onFetchRcsb(normalized, "add"); };
  return (
    <section className={`context-toolbar ${collapsed ? "context-toolbar--collapsed" : ""}`} aria-label="Contextual toolbar" data-ribbon-category={activeCategory}>
      <div className="ribbon-heading"><div><span className="eyebrow">PRESENTATION RIBBON</span><strong>{activeCategory}</strong></div><button className="icon-button ribbon-toggle" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand ribbon" : "Collapse ribbon"} title={collapsed ? "Expand ribbon" : "Collapse ribbon"}><Icon name={collapsed ? "panelLeftOpen" : "panelLeftClose"} size={15} /></button></div>
      {!collapsed && <div className="ribbon-scroll">
        {activeCategory === "Color" ? <div className="ribbon-color-controls" role="group" aria-label="Color controls">
          <label className="ribbon-select-label">Scheme<select aria-label="Ribbon color scheme" value={colorMode} onChange={(event) => onColorMode(event.target.value as ColorMode)}>{COLOR_SCHEMES.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}</option>)}</select></label>
          <div className="ribbon-color-gallery" role="group" aria-label="Quick color schemes">{quickColorSchemes.map(([mode, label]) => <button key={mode} className={`ribbon-color-button ${colorMode === mode ? "ribbon-color-button--active" : ""}`} type="button" onClick={() => onColorMode(mode)} aria-pressed={colorMode === mode} data-color-mode={mode}>{label}</button>)}</div>
          <span className="ribbon-scheme-count">{COLOR_MODES.length} schemes</span>
        </div> : activeCategory === "Edit" ? <div className="ribbon-edit-controls" role="group" aria-label="Scientific topology editing">
          <div className="ribbon-edit-summary"><span className="eyebrow">CANONICAL EDIT</span><strong>{editSelectionCount} atom{editSelectionCount === 1 ? "" : "s"} selected</strong><small>{editObjectName ?? "Select a workspace object"}</small></div>
          <button className="tool-button" type="button" onClick={() => onAction("HISTORY.UNDO")} disabled={!canUndo} aria-label="Undo" data-action-id="HISTORY.UNDO"><Icon name="undo" size={20} /><span>Undo</span></button>
          <button className="tool-button" type="button" onClick={() => onAction("HISTORY.REDO")} disabled={!canRedo} aria-label="Redo" data-action-id="HISTORY.REDO"><Icon name="redo" size={20} /><span>Redo</span></button>
          <button className="tool-button" type="button" onClick={() => onAction("EDIT.ATOM_DELETE")} disabled={editSelectionCount < 1} aria-label="Delete Selected" data-action-id="EDIT.ATOM_DELETE"><Icon name="trash" size={20} /><span>Delete Selected</span></button>
          <button className="tool-button" type="button" onClick={() => onAction("EDIT.BOND_CREATE")} disabled={editSelectionCount !== 2} aria-label="Create Bond" data-action-id="EDIT.BOND_CREATE"><Icon name="plus" size={20} /><span>Create Bond</span></button>
          <button className="tool-button" type="button" onClick={() => onAction("EDIT.BOND_DELETE")} disabled={editSelectionCount !== 2} aria-label="Delete Bond" data-action-id="EDIT.BOND_DELETE"><Icon name="minus" size={20} /><span>Delete Bond</span></button>
          <label className="ribbon-select-label">Bond order<select aria-label="Bond order" disabled={editSelectionCount !== 2 || !onEditBondOrder} defaultValue="SINGLE" onChange={(event) => onEditBondOrder?.(event.target.value as Exclude<BondOrder, "UNKNOWN">)}>{["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"].map((order) => <option key={order} value={order}>{order}</option>)}</select></label>
        </div> : <>
          {activeCategory === "File" && showRcsb && <form className="ribbon-rcsb-form" onSubmit={submitRcsb} aria-label="RCSB structure fetch"><label htmlFor="ribbon-pdb-id">RCSB PDB ID</label><input id="ribbon-pdb-id" ref={rcsbInputRef} aria-label="RCSB PDB ID" placeholder="4DJW" value={pdbId} onChange={(event) => setPdbId(event.target.value)} maxLength={4} /><button type="submit" aria-label="RCSB fetch">Fetch</button><button type="button" aria-label="RCSB add" onClick={addRcsb}>Add</button><span>Official mmCIF via backend</span></form>}
          {items.map((item) => {
          const active = item.style ? styleProfileFor(representation) === styleProfileFor(item.style) : activeTool === item.label;
          const resolved = item.style ? representationCapabilityFor(item.style) : null;
          return <div className={`toolbar-group ${item.dividerAfter ? "toolbar-group--divider" : ""}`} key={`${activeCategory}-${item.label}`}><button className={`tool-button ${active ? "tool-button--active" : ""} ${item.capability ? "tool-button--capability" : ""}`} type="button" onClick={() => actionForItem(item)} aria-label={item.label} title={item.capability ? `${item.label} — ${item.capability}` : item.label} data-action-id={item.actionId} data-style-profile={item.style ?? ""} data-capability-state={item.capability ?? resolved?.capability ?? "SUPPORTED"} data-representation-status={item.representationStatus ?? resolved?.status ?? ""}><Icon name={item.icon} size={20} /><span>{item.label}</span>{(item.capability || item.representationStatus === "VALID_EMPTY") && <small>{item.capability ?? item.representationStatus}</small>}</button></div>;
          })}
        </>}
      </div>}
    </section>
  );
};

export { RIBBON_CATEGORIES };
