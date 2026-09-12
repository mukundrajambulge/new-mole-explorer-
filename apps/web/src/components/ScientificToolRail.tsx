import { Icon, type IconName } from "./Icon";
import type { ReactNode } from "react";

export const SCIENTIFIC_TOOL_PANELS = ["Display", "Color", "Select", "Measure", "Analyze", "Ligand", "Edit", "Session", "Movie", "Settings"] as const;
export type ScientificToolPanel = (typeof SCIENTIFIC_TOOL_PANELS)[number];

const icons: Record<ScientificToolPanel, IconName> = {
  Display: "layers",
  Color: "circleUser",
  Select: "pointer",
  Measure: "ruler",
  Analyze: "bars",
  Ligand: "shapes",
  Edit: "pencil",
  Session: "folder",
  Movie: "activity",
  Settings: "settings",
};

type ScientificToolRailProps = {
  activePanel: ScientificToolPanel | null;
  onPanelChange: (panel: ScientificToolPanel | null) => void;
  children?: ReactNode;
};

/** A persistent right-edge launcher. Its working panel expands toward the canvas. */
export const ScientificToolRail = ({ activePanel, onPanelChange, children }: ScientificToolRailProps) => (
  <aside className={`scientific-tool-rail ${activePanel ? "scientific-tool-rail--open" : ""}`} aria-label="Scientific tools">
    <nav className="scientific-tool-rail__buttons" aria-label="Scientific tool panels">
      {SCIENTIFIC_TOOL_PANELS.map((panel) => (
        <button
          key={panel}
          type="button"
          className={activePanel === panel ? "scientific-tool-rail__button scientific-tool-rail__button--active" : "scientific-tool-rail__button"}
          aria-label={`${panel} panel`}
          aria-pressed={activePanel === panel}
          title={panel}
          onClick={() => onPanelChange(activePanel === panel ? null : panel)}
        >
          <Icon name={icons[panel]} size={17} />
          <span>{panel}</span>
        </button>
      ))}
    </nav>
    {activePanel && <div className="scientific-tool-rail__panel" data-rail-panel={activePanel}>{children}</div>}
  </aside>
);
