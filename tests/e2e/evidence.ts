import { resolve } from "node:path";

/** Throw-away evidence location; set EVIDENCE_DIR to collect evidence for a gate. */
export function evidencePath(...parts: string[]): string {
  return resolve(process.env.EVIDENCE_DIR ?? "test-results/evidence", ...parts);
}
