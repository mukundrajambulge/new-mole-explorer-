import type { ActionId } from "../domain/registry";
import type { SelectionResult } from "../interaction/selectionResolver";
import { Icon } from "./Icon";

type ScientificSelectionPanelProps = {
  activeSelection: Pick<SelectionResult, "count" | "status" | "query"> | null;
  canSelect: boolean;
  onAction: (actionId: ActionId) => void;
  onClearSelection: () => void;
};

/** Selection controls are a view onto the same canonical selection state as the console and canvas. */
export const ScientificSelectionPanel = ({ activeSelection, canSelect, onAction, onClearSelection }: ScientificSelectionPanelProps) => (
  <section className="panel-card scientific-selection-panel" aria-label="Select panel">
    <div className="panel-heading"><div><h2>Select</h2></div></div>
    <div className="scientific-selection-summary" aria-live="polite">
      <strong>{activeSelection ? `${activeSelection.count.toLocaleString("en-US")} atom${activeSelection.count === 1 ? "" : "s"} selected` : "No active selection"}</strong>
      <span>{activeSelection ? activeSelection.status.replaceAll("_", " ") : "Pick atoms in the canvas or use the command console."}</span>
    </div>
    <div className="scientific-selection-actions">
      <button type="button" onClick={() => onAction("SELECTION.EVALUATE")} disabled={!canSelect}><Icon name="square" size={16} />Select all</button>
      <button type="button" onClick={onClearSelection} disabled={!activeSelection}><Icon name="x" size={16} />Clear selection</button>
    </div>
    <p className="scientific-selection-help">Press Esc or click an empty canvas area to clear the active selection. These controls preserve object, representation, color, and saved measurement state.</p>
  </section>
);
