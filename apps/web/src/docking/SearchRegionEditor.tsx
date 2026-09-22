import type { D2SearchRegionAuthority } from "./dockingApiAdapter";
import type { SearchRegionDraft } from "./dockingUiState";
import { numericSearchRegionDraft } from "./dockingUiState";

type SearchRegionEditorProps = {
  draft: SearchRegionDraft;
  coordinateFrame: string;
  committedRegion: D2SearchRegionAuthority | null;
  commitMessage: string | null;
  commitBusy: boolean;
  onDraftChange: (field: keyof SearchRegionDraft, value: string) => void;
  onShowDraft: () => void;
  onCommit: () => void;
};

const fields: readonly [keyof SearchRegionDraft, string][] = [
  ["centerX", "Center X"], ["centerY", "Center Y"], ["centerZ", "Center Z"],
  ["sizeX", "Size X"], ["sizeY", "Size Y"], ["sizeZ", "Size Z"],
];

export const SearchRegionEditor = ({ draft, coordinateFrame, committedRegion, commitMessage, commitBusy, onDraftChange, onShowDraft, onCommit }: SearchRegionEditorProps) => {
  const numeric = numericSearchRegionDraft(draft);
  return (
    <section className="docking-card docking-search-region" data-testid="docking-search-region">
      <div className="docking-card-heading"><div><span className="docking-eyebrow">SEARCH REGION</span><h3>Explicit box</h3></div><span className="docking-unit-badge">Å</span></div>
      <p className="docking-help">Draft geometry is presentation state until an explicit D2 commit. Camera actions never edit these values.</p>
      <div className="docking-region-grid">
        {fields.map(([field, label]) => <label key={field}><span>{label}</span><input aria-label={label} inputMode="decimal" type="number" step="any" value={draft[field]} onChange={(event) => onDraftChange(field, event.target.value)} /></label>)}
      </div>
      <div className="docking-coordinate-frame"><span>Coordinate frame</span><strong>{coordinateFrame}</strong></div>
      <div className="docking-region-actions"><button type="button" onClick={onShowDraft} disabled={!numeric}>Show draft</button><button className="docking-primary-action" type="button" onClick={onCommit} disabled={!numeric || commitBusy}>{commitBusy ? "Committing…" : "Commit Search Region"}</button></div>
      {committedRegion ? <div className="docking-commit-summary" data-testid="committed-search-region"><strong>Committed D2 SearchRegion</strong><span>{committedRegion.digest.slice(0, 20)}… · {committedRegion.coordinateFrame}</span></div> : <div className="docking-uncommitted">No authoritative SearchRegion committed.</div>}
      {commitMessage && <div className="docking-inline-diagnostic" role="status">{commitMessage}</div>}
    </section>
  );
};
