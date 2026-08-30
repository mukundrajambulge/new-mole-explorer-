import type { ActionId } from "../domain/registry";
import { Icon, type IconName } from "./Icon";

type ToolbarItem = { label: string; icon: IconName; actionId: ActionId; active?: boolean; dividerAfter?: boolean };

const toolbarItems: ToolbarItem[] = [
  { label: "New", icon: "filePlus", actionId: "FILE.NEW" },
  { label: "Open", icon: "folder", actionId: "FILE.OPEN" },
  { label: "Save", icon: "save", actionId: "FILE.SAVE" },
  { label: "Import", icon: "upload", actionId: "FILE.IMPORT" },
  { label: "Export", icon: "download", actionId: "FILE.EXPORT", dividerAfter: true },
  { label: "Select", icon: "pointer", actionId: "CANVAS.SELECT", active: true },
  { label: "Pan", icon: "hand", actionId: "CANVAS.PAN" },
  { label: "Rotate", icon: "rotate", actionId: "CANVAS.ROTATE" },
  { label: "Zoom", icon: "zoom", actionId: "CANVAS.ZOOM" },
  { label: "Focus", icon: "target", actionId: "CANVAS.FOCUS", dividerAfter: true },
  { label: "Surface", icon: "waves", actionId: "REPRESENTATION.SURFACE" },
  { label: "Cartoon", icon: "activity", actionId: "REPRESENTATION.CARTOON" },
  { label: "Ball & Stick", icon: "shapes", actionId: "REPRESENTATION.BALL_AND_STICK" },
  { label: "Licorice", icon: "sparkles", actionId: "REPRESENTATION.LICORICE" },
  { label: "Spheres", icon: "circleUser", actionId: "REPRESENTATION.SPHERES", dividerAfter: true },
  { label: "Theme", icon: "moon", actionId: "VIEW.THEME" },
  { label: "Settings", icon: "settings", actionId: "VIEW.THEME" },
  { label: "Help", icon: "help", actionId: "HELP.OPEN" },
];

export const ContextToolbar = ({ activeTool, onAction }: { activeTool: string; onAction: (actionId: ActionId) => void }) => (
  <div className="context-toolbar" aria-label="Contextual toolbar">
    <div className="toolbar-scroll">
      {toolbarItems.map((item) => (
        <div className={`toolbar-group ${item.dividerAfter ? "toolbar-group--divider" : ""}`} key={`${item.label}-${item.actionId}`}>
          <button
            className={`tool-button ${activeTool === item.label ? "tool-button--active" : ""}`}
            onClick={() => onAction(item.actionId)}
            data-action-id={item.actionId}
            aria-label={item.label}
            title={item.label}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  </div>
);
