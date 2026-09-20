import type { D2AdaptedSnapshot } from "./dockingApiAdapter";

type DockingWorkflowPanelProps = { adaptation: D2AdaptedSnapshot | null; adaptationPhase: string; committed: boolean };

const stages = ["Receptor", "Ligand", "Search Region", "Configuration", "Preflight", "Freeze", "Run", "Results"] as const;

export const DockingWorkflowPanel = ({ adaptation, adaptationPhase, committed }: DockingWorkflowPanelProps) => (
  <aside className="docking-workflow-panel" aria-label="Docking workflow" data-testid="docking-workflow">
    <div className="docking-panel-heading"><span className="docking-eyebrow">WORKFLOW</span><h2>Docking path</h2></div>
    <div className="docking-stage-list">
      {stages.map((stage, index) => {
        const available = stage === "Receptor" || stage === "Ligand" || stage === "Search Region";
        const current = stage === "Search Region";
        const detail = stage === "Receptor" || stage === "Ligand" ? adaptation ? `${adaptation.status} · explicit preparation required` : adaptationPhase : stage === "Search Region" ? committed ? "D2 authority selected" : "Draft only" : stage === "Run" ? "Unavailable · no docking engine" : "Reserved for a later gate";
        return <div className={`docking-stage ${current ? "docking-stage--current" : ""} ${available ? "" : "docking-stage--unavailable"}`} key={stage} data-stage={stage} data-stage-available={available ? "true" : "false"}><span className="docking-stage-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{stage}</strong><small>{detail}</small></div>{stage === "Run" && <span className="docking-unavailable-badge">OFF</span>}</div>;
      })}
    </div>
    <div className="docking-capability-callout" data-testid="docking-run-capability"><strong>Execution boundary</strong><span>DOCKING.RUN remains registered as unavailable and non-executable in D2.</span></div>
  </aside>
);
