import type { SelectionResult } from "../selection/selectionEngine";
import type { ExportArtifact, ExportFormat, ExportLossPolicy, ExportStateScope } from "../lifecycle/export";
import type { WorkspaceObject } from "../workspace/workspaceModel";

type ExportPanelProps = {
  object: WorkspaceObject | undefined;
  selection: SelectionResult | null;
  format: ExportFormat;
  stateScope: ExportStateScope;
  lossPolicy: ExportLossPolicy;
  artifact: ExportArtifact | null;
  error: string | null;
  onClose: () => void;
  onFormat: (value: ExportFormat) => void;
  onStateScope: (value: ExportStateScope) => void;
  onLossPolicy: (value: ExportLossPolicy) => void;
  onExport: () => void;
  onDownload: () => void;
  onReimport: () => void;
};

export const ExportPanel = ({ object, selection, format, stateScope, lossPolicy, artifact, error, onClose, onFormat, onStateScope, onLossPolicy, onExport, onDownload, onReimport }: ExportPanelProps) => <div className="lifecycle-modal" role="dialog" aria-label="Export structure" data-testid="export-dialog">
  <div className="lifecycle-modal__card"><div className="panel-heading"><div><span className="eyebrow">NATIVE EXPORT</span><h2>Export structure</h2></div><button type="button" onClick={onClose} aria-label="Close export">×</button></div>
    <p className="lifecycle-modal__summary">{object ? `${object.displayName} · ${selection?.count ?? object.loadResult.structure.atoms.length} frozen atom${(selection?.count ?? object.loadResult.structure.atoms.length) === 1 ? "" : "s"}` : "Load a structure before exporting."}</p>
    <label>Format<select aria-label="Export format" value={format} onChange={(event) => onFormat(event.target.value as ExportFormat)}><option value="PDB">PDB</option><option value="MMCIF">mmCIF</option></select></label>
    <label>Coordinate states<select aria-label="Export state scope" value={stateScope} onChange={(event) => onStateScope(event.target.value as ExportStateScope)}><option value="CURRENT_RESOLVED">Current resolved</option><option value="EXPLICIT_STATE">Explicit state</option><option value="ALL_STATES">All states</option></select></label>
    <label>Loss policy<select aria-label="Export loss policy" value={lossPolicy} onChange={(event) => onLossPolicy(event.target.value as ExportLossPolicy)}><option value="ALLOW_WITH_MANIFEST">Allow with manifest</option><option value="FAIL_ON_LOSS">Fail on loss</option></select></label>
    {selection && <p className="lifecycle-modal__notice">Frozen selection {selection.resultId} · membership {selection.membershipHash}</p>}
    {error && <p className="lifecycle-modal__error" role="alert">{error}</p>}
    {artifact && <div className="lifecycle-modal__success" data-testid="export-success"><strong>{artifact.format} ready</strong><span>{artifact.byteLength.toLocaleString("en-US")} bytes · SHA-256 {artifact.sha256}</span><span>{artifact.lossManifest.entries.length ? `${artifact.lossManifest.entries.length} loss manifest entr${artifact.lossManifest.entries.length === 1 ? "y" : "ies"}` : "Loss manifest complete"}</span><button type="button" onClick={onDownload}>Download exact bytes</button><button type="button" onClick={onReimport}>Re-import as new source artifact</button></div>}
    <div className="lifecycle-modal__footer"><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={onExport} disabled={!object} data-testid="export-run">Create export artifact</button></div>
  </div>
</div>;
