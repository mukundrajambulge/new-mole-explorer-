import type { ActionId } from "../domain/registry";

const menus: Array<{ label: string; actionId: ActionId }> = [
  { label: "File", actionId: "FILE.OPEN" },
  { label: "Edit", actionId: "EDIT.ATOM_DELETE" },
  { label: "Select", actionId: "SELECTION.EVALUATE" },
  { label: "Display", actionId: "REPRESENTATION.SET_STYLE" },
  { label: "Color", actionId: "COLOR.APPLY" },
  { label: "Measure", actionId: "MEASURE.DISTANCE" },
  { label: "Analyze", actionId: "SELECTION.EVALUATE" },
  { label: "Dock", actionId: "DOCKING.CONFIGURE" },
  { label: "View", actionId: "VIEW.RESET" },
  { label: "Help", actionId: "HELP.OPEN" },
];

export const MenuBar = ({ onAction }: { onAction: (actionId: ActionId) => void }) => (
  <header className="menu-bar">
    <div className="menu-brand"><span className="brand-pulse" /> <span>WORKSTATION</span></div>
    <nav className="menu-links" aria-label="Application menu">
      {menus.map((menu) => (
        <button key={`${menu.label}-${menu.actionId}`} onClick={() => onAction(menu.actionId)} data-action-id={menu.actionId}>
          {menu.label}
        </button>
      ))}
    </nav>
    <div className="menu-context"><span className="context-pill">G0</span><span className="context-label">FOUNDATION</span></div>
  </header>
);
