import type { Capability } from "@molecular/contracts";
import { Icon } from "./Icon";

export const CapabilityNotice = ({ capability, onClose }: { capability: Capability; onClose: () => void }) => (
  <div className={`capability-notice capability-notice--${capability.state.toLowerCase()}`} role="status">
    <span className="notice-mark"><Icon name={capability.state === "UNAVAILABLE" ? "lock" : "sparkles"} size={15} /></span>
    <span className="notice-copy">
      <strong>{capability.state === "COMING_SOON" ? "Coming Soon" : capability.state === "UNAVAILABLE" ? "Unavailable" : capability.label}</strong>
      <span>{capability.label} · {capability.description}</span>
    </span>
    <button className="icon-button icon-button--quiet" onClick={onClose} aria-label="Dismiss capability message">
      <Icon name="x" size={15} />
    </button>
  </div>
);
