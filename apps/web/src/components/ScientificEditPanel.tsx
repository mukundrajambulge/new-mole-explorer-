import type { BondOrder } from "@molecular/contracts";
import type { ActionId } from "../domain/registry";
import { Icon } from "./Icon";

type ScientificEditPanelProps = {
  selectionCount: number;
  objectName?: string;
  selectionReady: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAction: (actionId: ActionId) => void;
  onBondOrder: (order: Exclude<BondOrder, "UNKNOWN">) => void;
};

export const ScientificEditPanel = ({ selectionCount, objectName, selectionReady, canUndo, canRedo, onAction, onBondOrder }: ScientificEditPanelProps) => (
  <section className="panel-card scientific-edit-panel" aria-label="Edit panel" data-testid="edit-state" data-edit-selection-ready={selectionReady ? "true" : "false"}>
    <div className="panel-heading"><div><h2>Edit</h2></div></div>
    <div className="scientific-edit-summary"><strong>{selectionCount} atom{selectionCount === 1 ? "" : "s"} selected</strong><span>{objectName ?? "No active object"}</span></div>
    <div className="scientific-edit-grid">
      <button type="button" data-action-id="HISTORY.UNDO" onClick={() => onAction("HISTORY.UNDO")} disabled={!canUndo}><Icon name="undo" size={16} />Undo</button>
      <button type="button" data-action-id="HISTORY.REDO" onClick={() => onAction("HISTORY.REDO")} disabled={!canRedo}><Icon name="redo" size={16} />Redo</button>
      <button type="button" onClick={() => onAction("EDIT.ATOM_DELETE")} disabled={!selectionReady || selectionCount < 1}><Icon name="trash" size={16} />Delete atoms</button>
      <button type="button" onClick={() => onAction("EDIT.BOND_CREATE")} disabled={!selectionReady || selectionCount !== 2}><Icon name="plus" size={16} />Create bond</button>
      <button type="button" onClick={() => onAction("EDIT.BOND_DELETE")} disabled={!selectionReady || selectionCount !== 2}><Icon name="minus" size={16} />Delete bond</button>
      <button type="button" onClick={() => onAction("EDIT.HYDROGEN_ADD")} disabled={!selectionReady || selectionCount < 1}><Icon name="beaker" size={16} />Add hydrogens</button>
      <button type="button" onClick={() => onAction("EDIT.HYDROGEN_REFILL")} disabled={!selectionReady || selectionCount < 1}><Icon name="rotate" size={16} />Refill Hydrogens</button>
      <button type="button" onClick={() => onAction("EDIT.HYDROGEN_REMOVE")} disabled={!selectionReady || selectionCount < 1}><Icon name="trash" size={16} />Remove Hydrogens</button>
      <button type="button" onClick={() => onAction("EDIT.ATOM_ATTACH")} disabled={!selectionReady || selectionCount !== 1}><Icon name="atom" size={16} />Attach Atom</button>
      <button type="button" onClick={() => onAction("EDIT.ATOM_REPLACE")} disabled={!selectionReady || selectionCount !== 1}><Icon name="shapes" size={16} />Replace Atom</button>
    </div>
    <label className="scientific-edit-order">Bond order<select aria-label="Bond order" disabled={!selectionReady || selectionCount !== 2} defaultValue="SINGLE" onChange={(event) => onBondOrder(event.target.value as Exclude<BondOrder, "UNKNOWN">)}>{["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"].map((order) => <option key={order} value={order}>{order}</option>)}</select></label>
  </section>
);
