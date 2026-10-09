import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { createPrepRoutes } from "../docking/routes.js";
import { PrepArtifactStore } from "./prepArtifacts.js";
import { PrepJobStore, type PrepRunner } from "./prepJobs.js";
import { repoPrepPins, type PrepPinReport } from "./prepPins.js";
import { prepSummarySealer } from "./prepSeal.js";

/**
 * Server wiring for preparation (task 5.2b). Built once at server start-up:
 * - the pin check against native/third_party/TOOLS.md runs here, at start-up; a mismatch disables every prep
 *   route (503 PROVENANCE_REPLAY), it never falls back to an unpinned worker
 * - the installed venv is probed once (worker --versions) before the first plan; drift answers 503 PROVENANCE_REPLAY
 * - job store under <dataRoot>/prep-jobs (in-flight jobs from a previous process become FAILED, then gc)
 * - artifact store under <dataRoot>/prep-artifacts (server-computed sha256, short ids, streamed uploads,
 *   2 concurrent, quota 64 files / 512 MB, 24 h retention)
 * - the sealer uses server constants only: the receptor stays BLOCKED until its dependency digests are published
 * DOCKING.RUN is untouched and stays UNAVAILABLE.
 */
export type PrepService = Readonly<{
  pins: PrepPinReport;
  store: PrepJobStore;
  artifacts: PrepArtifactStore;
  handle: (req: IncomingMessage, res: ServerResponse, pathname: string) => Promise<boolean>;
}>;

export const createPrepService = (options: { dataRoot: string; pins?: () => PrepPinReport; runner?: PrepRunner }): PrepService => {
  const dataRoot = resolve(options.dataRoot);
  const pinsFn = options.pins ?? repoPrepPins;
  const pins = pinsFn();
  const artifacts = new PrepArtifactStore(join(dataRoot, "prep-artifacts"));
  const store = new PrepJobStore({ root: join(dataRoot, "prep-jobs"), resolveArtifact: artifacts.resolve, sealer: prepSummarySealer, pins: pinsFn, ...(options.runner ? { runner: options.runner } : {}) });
  store.init();
  const handle = createPrepRoutes({ store, artifacts, dataRoot, ...(pins.ok ? {} : { unavailable: pins.mismatches }) });
  return Object.freeze({ pins, store, artifacts, handle });
};
