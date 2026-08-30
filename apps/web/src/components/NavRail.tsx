import type { ActionId } from "../domain/registry";
import { Icon, type IconName } from "./Icon";

type NavItem = { label: string; icon: IconName; actionId: ActionId; active?: boolean };

const navItems: NavItem[] = [
  { label: "Home", icon: "grid", actionId: "WORKSPACE.HOME", active: true },
  { label: "Projects", icon: "folder", actionId: "WORKSPACE.PROJECTS" },
  { label: "Analysis", icon: "bars", actionId: "WORKSPACE.ANALYSIS" },
  { label: "Laboratory", icon: "beaker", actionId: "WORKSPACE.LABORATORY" },
  { label: "Molecular", icon: "atom", actionId: "WORKSPACE.MOLECULAR" },
  { label: "Console", icon: "command", actionId: "WORKSPACE.CONSOLE" },
];

export const NavRail = ({ activeItem, onAction }: { activeItem: string; onAction: (actionId: ActionId) => void }) => (
  <aside className="nav-rail" aria-label="Application navigation">
    <div className="brand-mark" aria-label="Molecular Workstation">
      <Icon name="atom" size={22} strokeWidth={1.6} />
    </div>
    <nav className="nav-stack">
      {navItems.map((item) => (
        <button
          className={`nav-item ${activeItem === item.label ? "nav-item--active" : ""}`}
          key={item.label}
          onClick={() => onAction(item.actionId)}
          aria-label={item.label}
          title={item.label}
          data-action-id={item.actionId}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
    <div className="nav-footer">
      <button className="nav-item" onClick={() => onAction("VIEW.THEME")} aria-label="Theme" title="Theme" data-action-id="VIEW.THEME">
        <Icon name="moon" size={19} />
      </button>
      <button className="nav-item" onClick={() => onAction("VIEW.THEME")} aria-label="Settings" title="Settings" data-action-id="VIEW.THEME">
        <Icon name="settings" size={19} />
      </button>
      <button className="nav-item" onClick={() => onAction("HELP.OPEN")} aria-label="Help" title="Help" data-action-id="HELP.OPEN">
        <Icon name="help" size={19} />
      </button>
      <div className="user-dot" aria-label="Workspace local mode"><span /></div>
    </div>
  </aside>
);
