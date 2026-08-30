import { Icon } from "./Icon";

export const StatusBar = ({ apiStatus }: { apiStatus: "checking" | "connected" | "offline" }) => (
  <footer className="status-bar">
    <div className={`status-ready status-ready--${apiStatus}`}><span className="status-dot" />{apiStatus === "connected" ? "API connected" : apiStatus === "checking" ? "Connecting" : "Local UI mode"}</div>
    <div className="status-metrics"><span><strong>Atoms</strong> —</span><span><strong>Residues</strong> —</span><span><strong>Chains</strong> —</span><span><strong>Selection</strong> 0</span></div>
    <div className="status-file"><Icon name="archive" size={13} /> No active object or file</div>
  </footer>
);
