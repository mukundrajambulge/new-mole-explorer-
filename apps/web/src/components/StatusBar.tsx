import { Icon } from "./Icon";
import type { ProjectRecord, StructureLoadResult } from "@molecular/contracts";

export const StatusBar = ({ apiStatus, structure, project, selectedAtomCount = 0, scientificRevision, canUndo = false, canRedo = false }: { apiStatus: "connected" | "checking" | "offline"; structure: StructureLoadResult | null; project: ProjectRecord | null; selectedAtomCount?: number; scientificRevision?: string | null; canUndo?: boolean; canRedo?: boolean }) => (
  <footer className="status-bar">
    <div className={`status-ready status-ready--${apiStatus}`}><span className="status-dot" />{apiStatus === "connected" ? "API connected" : apiStatus === "checking" ? "Connecting" : "Local UI mode"}</div>
    <div className="status-metrics"><span><strong>Atoms</strong> {structure ? structure.structure.counts.atoms.toLocaleString("en-US") : "—"}</span><span><strong>Residues</strong> {structure ? structure.structure.counts.residues.toLocaleString("en-US") : "—"}</span><span><strong>Chains</strong> {structure ? structure.structure.counts.chains.toLocaleString("en-US") : "—"}</span><span><strong>Selection</strong> {selectedAtomCount.toLocaleString("en-US")}</span>{scientificRevision && <span data-testid="scientific-history-state"><strong>Revision</strong> {scientificRevision.slice(0, 12)} · {canUndo ? "undo" : "root"}{canRedo ? " · redo" : ""}</span>}</div>
    <div className="status-file"><Icon name="archive" size={13} /> {project ? `${project.name} · r${project.revision}` : structure?.structure.source.originalFilename ?? "No active object or file"}</div>
  </footer>
);
