import { useState } from "react";
import { Icon } from "./Icon";
import type { ActionId } from "../domain/registry";

const components = [
  { label: "Protein", count: "6,997", tone: "blue", enabled: true },
  { label: "Ligand", count: "43", tone: "purple", enabled: true },
  { label: "Water", count: "512", tone: "cyan", enabled: false },
  { label: "Ions", count: "24", tone: "orange", enabled: false },
  { label: "Other", count: "7", tone: "slate", enabled: false },
];

const quickTools: Array<{ label: string; icon: "ruler" | "target" | "activity" | "waves" | "shapes" | "sparkles" | "box" | "circleHelp" | "move3d" | "rotate"; actionId: ActionId }> = [
  { label: "Distance", icon: "ruler", actionId: "MEASURE.DISTANCE" },
  { label: "Angle", icon: "move3d", actionId: "MEASURE.DISTANCE" },
  { label: "Dihedral", icon: "rotate", actionId: "MEASURE.DISTANCE" },
  { label: "H-Bonds", icon: "waves", actionId: "REPRESENTATION.SURFACE" },
  { label: "Contacts", icon: "shapes", actionId: "SELECTION.EVALUATE" },
  { label: "Clash", icon: "activity", actionId: "SELECTION.EVALUATE" },
  { label: "Pocket", icon: "box", actionId: "SELECTION.EVALUATE" },
  { label: "Surface", icon: "circleHelp", actionId: "REPRESENTATION.SURFACE" },
  { label: "Center", icon: "target", actionId: "CANVAS.FOCUS" },
];

export const StructurePanel = ({ collapsed, onToggle, onAction }: { collapsed: boolean; onToggle: () => void; onAction: (actionId: ActionId) => void }) => {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(components.map((component) => [component.label, component.enabled])),
  );

  if (collapsed) {
    return <button className="collapsed-panel-tab collapsed-panel-tab--left" onClick={onToggle} aria-label="Expand structure panel"><Icon name="panelLeftOpen" size={17} /></button>;
  }

  return (
    <aside className="side-column side-column--left" aria-label="Structure and tools panel">
      <section className="panel-card structure-card">
        <div className="panel-heading"><div><span className="eyebrow">PROJECT TREE</span><h2>Structure</h2></div><div className="panel-actions"><button className="icon-button" onClick={() => onAction("FILE.IMPORT")} aria-label="Add structure" data-action-id="FILE.IMPORT"><Icon name="plus" size={16} /></button><button className="icon-button" onClick={onToggle} aria-label="Collapse structure panel"><Icon name="panelLeftClose" size={16} /></button></div></div>
        <div className="tree-item tree-item--root"><span className="tree-badge tree-badge--blue">P</span><span className="tree-label">1hsg_protein.pdb</span><Icon name="eye" size={16} /></div>
        <div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Heme <span className="muted">(HEM)</span></span><span className="tag tag--green">L</span><Icon name="eye" size={16} /></div>
        <div className="tree-item tree-item--child"><span className="tree-plus">+</span><span className="tree-label">Ligand <span className="muted">(UNL)</span></span><span className="tag tag--purple">L</span><Icon name="eye" size={16} /></div>
      </section>

      <section className="panel-card components-card">
        <div className="panel-heading"><div><span className="eyebrow">VISIBILITY LAYERS</span><h2>Components</h2></div><div className="panel-actions"><button className="icon-button" onClick={() => onAction("SELECTION.EVALUATE")} aria-label="Filter components" data-action-id="SELECTION.EVALUATE"><Icon name="sliders" size={15} /></button><button className="icon-button" onClick={() => onAction("FILE.IMPORT")} aria-label="Add component" data-action-id="FILE.IMPORT"><Icon name="plus" size={16} /></button></div></div>
        <div className="component-list">
          {components.map((component) => (
            <div className="component-row" key={component.label}>
              <button className={`switch switch--${component.tone} ${enabled[component.label] ? "switch--on" : ""}`} onClick={() => setEnabled((current) => ({ ...current, [component.label]: !current[component.label] }))} aria-label={`Toggle ${component.label}`}><span /></button>
              <span>{component.label}</span><span className="component-count">{component.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-card quick-card">
        <div className="panel-heading"><div><span className="eyebrow">WORKBENCH</span><h2>Quick tools</h2></div><span className="capability-tag">G0</span></div>
        <div className="quick-grid">
          {quickTools.map((tool) => <button className="quick-tool" key={tool.label} onClick={() => onAction(tool.actionId)} data-action-id={tool.actionId}><span className="quick-icon"><Icon name={tool.icon} size={18} /></span><span>{tool.label}</span></button>)}
        </div>
      </section>
    </aside>
  );
};
