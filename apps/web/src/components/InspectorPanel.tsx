import type { ActionId } from "../domain/registry";
import { Icon } from "./Icon";

const displayRows = [
  { label: "Style", value: "Projection preview", actionId: "REPRESENTATION.SET_STYLE" as ActionId },
  { label: "Color", value: "Element", actionId: "COLOR.APPLY" as ActionId },
];

export const InspectorPanel = ({ collapsed, onToggle, onAction }: { collapsed: boolean; onToggle: () => void; onAction: (actionId: ActionId) => void }) => {
  if (collapsed) {
    return <button className="collapsed-panel-tab collapsed-panel-tab--right" onClick={onToggle} aria-label="Expand inspector panel"><Icon name="panelRightOpen" size={17} /></button>;
  }

  return (
    <aside className="side-column side-column--right" aria-label="Selection inspector and display panel">
      <section className="panel-card inspector-card">
        <div className="panel-heading"><div><span className="eyebrow">CONTEXT</span><h2>Selection Inspector</h2></div><div className="panel-actions"><button className="icon-button" onClick={onToggle} aria-label="Collapse inspector panel"><Icon name="panelRightClose" size={16} /></button></div></div>
        <div className="inspector-selection"><span>Selection</span><span className="selection-chip">none</span></div>
        <div className="selection-meta">0 atoms · 0 residues</div>
        <div className="inspector-divider" />
        <span className="eyebrow">PROPERTIES</span>
        <div className="empty-inspector"><span className="empty-orbit"><Icon name="target" size={22} /></span><strong>No selection</strong><span>Select atoms to view properties.</span></div>
      </section>
      <section className="panel-card display-card">
        <div className="panel-heading"><div><span className="eyebrow">PROJECTION</span><h2>Display</h2></div><Icon name="sliders" size={16} /></div>
        {displayRows.map((row) => <button className="display-row" key={row.label} onClick={() => onAction(row.actionId)} data-action-id={row.actionId}><span>{row.label}</span><span className="select-value">{row.value}<Icon name="arrowDown" size={14} /></span></button>)}
        <div className="display-row"><span>Background</span><span className="color-swatch" /></div>
        <div className="display-row"><span>Axes</span><span className="switch switch--blue switch--on" role="switch" aria-checked="true"><span /></span></div>
        <div className="display-row"><span>Orientation</span><span className="switch switch--blue switch--on" role="switch" aria-checked="true"><span /></span></div>
        <div className="display-row"><span>Water</span><span className="switch switch--cyan" role="switch" aria-checked="false"><span /></span></div>
        <div className="display-row"><span>Ions</span><span className="switch switch--orange" role="switch" aria-checked="false"><span /></span></div>
        <button className="reset-view" onClick={() => onAction("VIEW.RESET")} data-action-id="VIEW.RESET"><Icon name="undo" size={14} /> Reset view</button>
      </section>
    </aside>
  );
};
