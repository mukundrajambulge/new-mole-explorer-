import type { StructureLoadResult } from "@molecular/contracts";
import type { D2AdaptedSnapshot, D2DiagnosticView } from "./dockingApiAdapter";
import type { SearchRegionDraft } from "./dockingUiState";
import { SearchRegionEditor } from "./SearchRegionEditor";
import type { D2SearchRegionAuthority } from "./dockingApiAdapter";

type DockingInputsPanelProps = {
  structure: StructureLoadResult | null;
  adaptation: D2AdaptedSnapshot | null;
  adaptationPhase: string;
  diagnostics: readonly D2DiagnosticView[];
  draft: SearchRegionDraft;
  coordinateFrame: string;
  committedRegion: D2SearchRegionAuthority | null;
  commitMessage: string | null;
  commitBusy: boolean;
  onImport: () => void;
  onDraftChange: (field: keyof SearchRegionDraft, value: string) => void;
  onShowDraft: () => void;
  onCommit: () => void;
};

const Digest = ({ label, value }: { label: string; value?: string }) => <div className="docking-digest"><span>{label}</span><code>{value ? `${value.slice(0, 18)}…` : "Not available"}</code></div>;

const StateRow = ({ label, value, detail }: { label: string; value: string; detail?: string }) => <div className="docking-state-row"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;

const D2StateCard = ({ title, snapshot, kind }: { title: string; snapshot: D2AdaptedSnapshot | null; kind: "RECEPTOR" | "LIGAND" }) => {
  const identity = snapshot?.identity;
  const chemical = snapshot?.chemicalState;
  const coordinate = snapshot?.coordinateStates[0];
  const pdbqt = snapshot?.executionRepresentation;
  return <section className="docking-card docking-state-card" data-testid={`docking-${kind.toLowerCase()}-state`}><div className="docking-card-heading"><div><span className="docking-eyebrow">{kind}</span><h3>{title}</h3></div><span className={`docking-status-dot docking-status-dot--${snapshot?.status.toLowerCase() ?? "idle"}`} /></div><StateRow label="Source / evidence" value={snapshot ? `${snapshot.sourceFormat.toUpperCase()} · ${snapshot.sourceArtifactId}` : "No D2 adaptation"} />{pdbqt ? <StateRow label="MolecularIdentity" value="Not authoritative" detail="PDBQT is retained only as execution evidence." /> : <StateRow label="MolecularIdentity" value={identity ? "Adapted from source" : "Not available"} detail={identity?.identityId} />}<StateRow label="ChemicalState" value={chemical ? chemical.resolution : "Not sealed"} detail={chemical ? `${chemical.protonationStatus} · ${chemical.tautomerStatus}` : "No automatic protonation or tautomer generation."} /><StateRow label="CoordinateState" value={coordinate ? "Explicit source frame" : "Not available"} detail={coordinate?.coordinateFrame} /><StateRow label={kind === "RECEPTOR" ? "PreparedReceptorState" : "PreparedLigandState"} value="Not sealed" detail="Explicit D2 choices are required; no silent preparation." />{kind === "LIGAND" && <StateRow label="LigandKinematicModel" value="Not sealed" detail="No generated torsions or fallback model." />}<div className="docking-digest-stack"><Digest label="Graph" value={snapshot?.graph?.digest} /><Digest label="Identity" value={identity?.digest} /><Digest label="Coordinate" value={coordinate?.digest} /></div></section>;
};

export const DockingInputsPanel = ({ structure, adaptation, adaptationPhase, diagnostics, draft, coordinateFrame, committedRegion, commitMessage, commitBusy, onImport, onDraftChange, onShowDraft, onCommit }: DockingInputsPanelProps) => <aside className="docking-inputs-panel" aria-label="Docking inputs"><div className="docking-panel-heading"><span className="docking-eyebrow">INPUTS</span><h2>Scientific objects</h2></div>{!structure && <div className="docking-empty-input"><strong>Load explicit source evidence</strong><span>The D2 adapter does not infer receptor or ligand state from an empty workspace.</span><button type="button" onClick={onImport}>Import structure</button></div>}{structure && <div className="docking-source-strip"><strong>{structure.structure.source.originalFilename}</strong><span>{structure.structure.counts.atoms.toLocaleString("en-US")} atoms · {adaptationPhase}</span></div>}<D2StateCard title="Receptor candidate" snapshot={adaptation} kind="RECEPTOR" /><D2StateCard title="Ligand candidate" snapshot={adaptation} kind="LIGAND" /><SearchRegionEditor draft={draft} coordinateFrame={coordinateFrame} committedRegion={committedRegion} commitMessage={commitMessage} commitBusy={commitBusy} onDraftChange={onDraftChange} onShowDraft={onShowDraft} onCommit={onCommit} />{diagnostics.length > 0 && <section className="docking-card docking-diagnostics"><div className="docking-card-heading"><div><span className="docking-eyebrow">D2 DIAGNOSTICS</span><h3>Validation truth</h3></div></div>{diagnostics.map((diagnostic) => <div className={`docking-diagnostic docking-diagnostic--${diagnostic.severity.toLowerCase()}`} key={`${diagnostic.code}-${diagnostic.message}`}><strong>{diagnostic.code}</strong><span>{diagnostic.message}</span></div>)}</section>}</aside>;
