const tabs = [
  ["Console", true, "Use the existing safe command console."],
  ["Preflight", false, "Unavailable until explicit D2 states are sealed."],
  ["Jobs", false, "No jobs are created in UI-D0."],
  ["Events", false, "No execution events are produced in UI-D0."],
  ["Results", false, "No docking results exist in UI-D0."],
  ["Provenance", false, "D2 provenance is shown with accepted states."],
] as const;

export const DockingBottomPanel = () => <section className="docking-bottom-panel" aria-label="Docking supporting surfaces" data-testid="docking-bottom-panel"><div className="docking-bottom-tabs">{tabs.map(([label, active, title]) => <button type="button" key={label} className={active ? "docking-bottom-tab docking-bottom-tab--active" : "docking-bottom-tab"} disabled={!active} title={title} aria-disabled={!active}>{label}</button>)}</div><span className="docking-bottom-note">No execution jobs, scores, poses, or results are fabricated.</span></section>;
