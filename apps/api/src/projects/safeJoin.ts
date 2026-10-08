import { resolve, sep } from "node:path";
import { IngestionError } from "../structures/ingestion.js";

/** Resolve parts under root; throw if the result escapes root. Error text never includes a path. */
export const safeJoin = (root: string, ...parts: readonly string[]): string => {
  const base = resolve(root);
  const target = resolve(base, ...parts);
  if (target !== base && !target.startsWith(base.endsWith(sep) ? base : base + sep)) throw new IngestionError("SECURITY_REJECTED", "The requested path is not allowed.");
  return target;
};

export const SOURCE_ARTIFACT_ID_PATTERN = /^source_[a-z_]+_[0-9a-f]{64}$/;
export const SESSION_REVISION_ID_PATTERN = /^session-revision-(migration-)?[0-9a-f-]+$/;
