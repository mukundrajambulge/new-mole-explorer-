import { Icon } from "./Icon";
import type { StructureLoadResult } from "@molecular/contracts";

export const StatusBar = ({ apiStatus, structure }: { apiStatus: "checking" | "connected" | "offline"; structure: StructureLoadResult | null }) => (
  <footer className="status-bar">
    <div className={`status-ready status-ready--${apiStatus}`}><span className="status-dot" />{apiStatus === "connected" ? "API connected" : apiStatus === "checking" ? "Connecting" : "Local UI mode"}</div>
    <div className="status-metrics"><span><strong>Atoms</strong> {structure ? structure.structure.counts.atoms.toLocaleString("en-US") : "—"}</span><span><strong>Residues</strong> {structure ? structure.structure.counts.residues.toLocaleString("en-US") : "—"}</span><span><strong>Chains</strong> {structure ? structure.structure.counts.chains.toLocaleString("en-US") : "—"}</span><span><strong>Selection</strong> 0</span></div>
    <div className="status-file"><Icon name="archive" size={13} /> {structure?.structure.source.originalFilename ?? "No active object or file"}</div>
  </footer>
);
