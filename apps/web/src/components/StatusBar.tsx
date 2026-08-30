import { Icon } from "./Icon";
import type { StructureLoadResult } from "@molecular/contracts";
import type { ProjectRecord } from "@molecular/contracts";

export const StatusBar = ({ apiStatus, structure, project }: { apiStatus: "checking" | "connected" | "offline"; structure: StructureLoadResult | null; project: ProjectRecord | null }) => (
  <footer className="status-bar">
    <div className={`status-ready status-ready--${apiStatus}`}><span className="status-dot" />{apiStatus === "connected" ? "API connected" : apiStatus === "checking" ? "Connecting" : "Local UI mode"}</div>
    <div className="status-metrics"><span><strong>Atoms</strong> {structure ? structure.structure.counts.atoms.toLocaleString("en-US") : "—"}</span><span><strong>Residues</strong> {structure ? structure.structure.counts.residues.toLocaleString("en-US") : "—"}</span><span><strong>Chains</strong> {structure ? structure.structure.counts.chains.toLocaleString("en-US") : "—"}</span><span><strong>Selection</strong> 0</span></div>
    <div className="status-file"><Icon name="archive" size={13} /> {project ? `${project.name} · r${project.revision}` : structure?.structure.source.originalFilename ?? "No active object or file"}</div>
  </footer>
);
