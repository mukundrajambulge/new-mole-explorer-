import type { IncomingMessage, ServerResponse } from "node:http";
import { pipeline } from "node:stream";
import {
  DOCK_JOB_ARTIFACTS,
  DOCK_JOB_TERMINAL_STATUSES,
  DOCKING_PREVIEW_NOTICE,
  DockJobRequestSchema,
  DockJobResultResponseV1Schema,
  JobIdSchema,
  JOB_CAPS,
  PrepareRequestSchema,
  VINA_SCORE_SEMANTICS,
  vinaComparatorCapability,
  type DockJobResultResponseV1,
  type DockJobResultV1,
  type DockJobStateV1,
  type DockJobStatusName,
  type DockJobSubmitResponseV1,
  type JobEvent,
} from "@molecular/contracts";
import { createPrepResolver, DockJobError, DockJobStore, type DockArtifactStream, type DockJobStoreOptions, type DockSubmitResult } from "../jobs/dockJobs.js";
import type { DockRunner } from "../jobs/dockRunner.js";
import { PREP_MAX_ARTIFACT_BYTES, PrepError, type PrepJobStore } from "../jobs/prepJobs.js";
import type { PrepArtifactStore } from "../jobs/prepArtifacts.js";
import { decodeSegment, parseOr400 } from "../projects/parseOr400.js";
import { IngestionError } from "../structures/ingestion.js";

/**
 * Preparation routes (task 5.2b, design 5.2 step 7). Mounted by server.ts under "/api":
 *   POST {prefix}/docking/prep/artifacts?format=sdf   raw bytes (<= 20 MB), streamed to disk; the server computes
 *                                            the sha256; 2 concurrent uploads, then 429 BUSY; quota -> 429 QUOTA_EXCEEDED
 *   POST {prefix}/docking/prep/artifacts/from-source  {sourceArtifactId}: maps an uploaded/fetched PDB structure
 *   POST {prefix}/docking/prep/plan          PrepareRequest (artifact ids + options only)
 *   POST {prefix}/docking/prep/:id/confirm   PrepConfirmationV1; 409 on planDigest mismatch; single-use
 *   GET  {prefix}/docking/prep/:id           PrepJobStateV1
 * zod-validated, 64 KB JSON body cap, ids are UUIDs (no path parts), error messages never contain paths.
 * Clients may not send sha256 values or profile digests (SECURITY_REJECTION). When the start-up pin check
 * failed every route answers 503 PROVENANCE_REPLAY. DOCKING.RUN stays fail-closed: nothing here docks or scores.
 */
export const PREP_BODY_CAP_BYTES = 64 * 1024;
const FORBIDDEN_KEYS = new Set(["sha256", "profileDigest", "profileId", "lockDigest", "relPath", "path", "outputs", "manifest"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Job ids in a path: server-minted UUIDs only (no path parts, no dots). */
const UuidIdSchema = JobIdSchema.regex(UUID_RE, "must be a server-minted job id");

const send = (res: ServerResponse, status: number, body: unknown) => {
  const s = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(s);
};
const fail = (res: ServerResponse, status: number, code: string, message: string) => send(res, status, { error: { code, message } });

const readRaw = async (req: IncomingMessage, cap: number): Promise<Buffer> => {
  const tooLarge = () => new PrepError("BODY_TOO_LARGE", 413, "The request body is too large.");
  if (Number(req.headers["content-length"] ?? 0) > cap) throw tooLarge();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += b.length;
    if (size > cap) throw tooLarge();
    chunks.push(b);
  }
  return Buffer.concat(chunks);
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const raw = await readRaw(req, PREP_BODY_CAP_BYTES);
  try {
    return JSON.parse(raw.toString("utf8") || "null");
  } catch {
    throw new PrepError("INVALID_INPUT", 400, "The request body must be JSON.");
  }
};

/** Any client-supplied digest or path key, at any depth, is a security rejection rather than a schema error. */
const hasForbiddenKey = (v: unknown, depth = 0): boolean => {
  if (depth > 8 || !v || typeof v !== "object") return false;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k) || /sha256|digest$/i.test(k)) {
      if (k !== "planDigest") return true;
    }
    if (hasForbiddenKey(x, depth + 1)) return true;
  }
  return false;
};

export type PrepRoutesOptions = Readonly<{
  store: PrepJobStore;
  artifacts?: PrepArtifactStore;
  /** Data root that holds structure source artifacts (for /artifacts/from-source). */
  dataRoot?: string;
  /** Pin mismatches from the start-up check; when set, every prep route fails closed. */
  unavailable?: readonly string[];
  prefix?: string;
}>;

/** Returns true when the request was handled (a prep route), false to let the caller continue routing. */
export const createPrepRoutes = (options: PrepRoutesOptions) => {
  const base = `${options.prefix ?? "/api"}/docking/prep`;
  return async (req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> => {
    if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
    const parts = pathname.slice(base.length).split("/").filter(Boolean);
    await handlePrep(options, req, res, parts, req.method ?? "GET");
    return true;
  };
};

const handlePrep = async (o: PrepRoutesOptions, req: IncomingMessage, res: ServerResponse, parts: string[], method: string): Promise<void> => {
  try {
    if (o.unavailable) return fail(res, 503, "PROVENANCE_REPLAY", `Preparation is unavailable: pinned toolchain mismatch (${o.unavailable.join(",").slice(0, 200)}).`);
    if (parts[0] === "artifacts") {
      if (!o.artifacts) return fail(res, 404, "NOT_FOUND", "Not found.");
      if (method === "POST" && parts.length === 1) {
        const format = new URL(req.url ?? "/", "http://localhost").searchParams.get("format") ?? "";
        const declared = req.headers["content-length"] === undefined ? undefined : Number(req.headers["content-length"]);
        if (declared !== undefined && !(Number.isSafeInteger(declared) && declared >= 0)) return fail(res, 400, "INVALID_INPUT", "The content-length header is invalid.");
        if (declared !== undefined && declared > PREP_MAX_ARTIFACT_BYTES) throw new PrepError("OVERSIZE_INPUT", 413, "An input artifact exceeds 20 MB.");
        // Streamed to a temp file under the artifact root (hashed per chunk, capped, concurrency-limited, quota-checked).
        return send(res, 201, await o.artifacts.putStream(req, format, declared));
      }
      if (method === "POST" && parts.length === 2 && parts[1] === "from-source" && o.dataRoot) {
        const body = await readBody(req);
        if (hasForbiddenKey(body)) return fail(res, 400, "SECURITY_REJECTION", "Clients send artifact ids only; digests and paths are computed by the server.");
        const keys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body) : [];
        if (keys.length !== 1 || keys[0] !== "sourceArtifactId") return fail(res, 400, "INVALID_INPUT", "The request must carry only sourceArtifactId.");
        return send(res, 201, o.artifacts.importSource(o.dataRoot, (body as { sourceArtifactId: unknown }).sourceArtifactId));
      }
      return fail(res, 404, "NOT_FOUND", "Not found.");
    }
    if (method === "POST" && parts.length === 1 && parts[0] === "plan") {
      const body = await readBody(req);
      if (hasForbiddenKey(body)) return fail(res, 400, "SECURITY_REJECTION", "Clients send artifact ids and options only; digests and paths are computed by the server.");
      // 1.7 follow-up: one validation helper (field + rule in the message, never the value or a path).
      const parsed = parseOr400(PrepareRequestSchema, body, "preparation request");
      const state = await o.store.plan(parsed);
      return send(res, state.state === "FAILED" ? 422 : 201, state);
    }
    const id = parseOr400(UuidIdSchema, decodeSegment(parts[0] ?? ""), "job id");
    if (method === "GET" && parts.length === 1) return send(res, 200, o.store.get(id));
    if (method === "POST" && parts.length === 2 && parts[1] === "confirm") {
      const body = await readBody(req);
      if (hasForbiddenKey(body)) return fail(res, 400, "SECURITY_REJECTION", "A confirmation carries only jobId, planDigest and acks.");
      const { state } = o.store.confirm(id, body);
      return send(res, 202, state);
    }
    return fail(res, 404, "NOT_FOUND", "Not found.");
  } catch (e) {
    // Discard (never buffer) whatever is left of a rejected body so the client still reads the answer.
    if (!req.readableEnded) req.resume();
    if (e instanceof PrepError) return fail(res, e.httpStatus, e.code, e.message);
    if (e instanceof IngestionError) return fail(res, e.status, e.code, e.message);
    return fail(res, 500, "INTERNAL_ERROR", "The request could not be completed.");
  }
};

// ---- Docking jobs (task 5.4) -------------------------------------------------------------------------------
// The job service only; HTTP and SSE routes over it are task 5.5. DockJobError carries code + httpStatus
// (400 BAD_INPUT, 404 NOT_FOUND, 409 ILLEGAL_TRANSITION/ALREADY_TERMINAL, 429 QUEUE_FULL, 503 ENGINE_PIN_MISMATCH).

export type DockJobServiceDeps = Readonly<{
  /** Fixed data dir without spaces, e.g. <dataRoot>/dock-jobs. */
  root: string;
  prep: PrepJobStore;
  runner?: DockRunner;
  /**
   * Store seam: the file store (DockJobStore) is an accepted interim deviation from the SQLite WAL requirement;
   * a SQLite store implementing DockJobService can be plugged in here without changing callers.
   */
  createStore?: (o: DockJobStoreOptions) => DockJobService;
}>;

export type DockJobService = Readonly<{
  init(): Promise<void>;
  submit(req: unknown): Promise<DockSubmitResult>;
  get(id: string): DockJobStateV1;
  list(): DockJobStateV1[];
  cancel(id: string): DockJobStateV1;
  events(id: string, afterSeq?: number): JobEvent[];
  subscribe(id: string, afterSeq: number, cb: (e: JobEvent) => void): () => void;
  result(id: string): DockJobResultV1;
  /** Task 5.5: a whitelisted, digest-checked output file of a COMPLETED job. */
  artifact(id: string, name: string): Promise<DockArtifactStream>;
  close(): Promise<void>;
}>;

export const createDockJobService = (deps: DockJobServiceDeps): DockJobService => {
  const options: DockJobStoreOptions = { root: deps.root, resolvePrepared: createPrepResolver(deps.prep), ...(deps.runner ? { runner: deps.runner } : {}) };
  const store: DockJobService = deps.createStore ? deps.createStore(options) : new DockJobStore(options);
  return Object.freeze({
    init: () => store.init(),
    submit: (req: unknown) => store.submit(req),
    get: (id: string) => store.get(id),
    list: () => store.list(),
    cancel: (id: string) => store.cancel(id),
    events: (id: string, afterSeq = 0) => store.events(id, afterSeq),
    subscribe: (id: string, afterSeq: number, cb: (e: JobEvent) => void) => store.subscribe(id, afterSeq, cb),
    result: (id: string) => store.result(id),
    artifact: (id: string, name: string) => store.artifact(id, name),
    close: () => store.close(),
  });
};

// ---- Docking job HTTP + SSE routes (task 5.5) --------------------------------------------------------------
// Mounted by server.ts under "/api" (behind the host, origin and token checks):
//   POST {prefix}/docking/jobs                      DockJobRequest (prepared ids + box + options) -> 202 {jobId, deduped, job}
//   GET  {prefix}/docking/jobs                      {jobs}
//   GET  {prefix}/docking/jobs/:id                  DockJobStateV1
//   GET  {prefix}/docking/jobs/:id/events           SSE: replay after Last-Event-ID (non-numeric -> 0), then live,
//                                                   heartbeat comments, closed once the job is terminal
//   POST {prefix}/docking/jobs/:id/cancel           DockJobStateV1 (409 when already terminal)
//   GET  {prefix}/docking/jobs/:id/result           COMPLETED only; PREVIEW_UNQUALIFIED, meScore null, score semantics
//   GET  {prefix}/docking/jobs/:id/artifacts/:name  poses.pdbqt | result.json | manifest.json (COMPLETED only)
//   GET  {prefix}/docking/capabilities              VINA_COMPARATOR_PREVIEW record + DOCKING.RUN (always UNAVAILABLE)
// The job routes exist only when FEATURE_DOCKING_RUN=1: otherwise they fall through to the server's 404 and the
// job store is never opened. Clients never send paths or digests (SECURITY_REJECTION).

export const DOCK_BODY_CAP_BYTES = 16 * 1024;
export const DOCK_SSE_MAX_CONNECTIONS = 16;
export const DOCK_SSE_HEARTBEAT_MS = 15_000;
/** A client that leaves the socket blocked (no drain) this long is dropped. */
export const DOCK_SSE_STALL_MS = 30_000;
/** A stream whose client stops reading is dropped once this much output is buffered. */
const SSE_MAX_BUFFERED = 1024 * 1024;
const TERMINAL_STATUSES = new Set<DockJobStatusName>(DOCK_JOB_TERMINAL_STATUSES);
/** A docking request never names files: any path-, file- or dir-like key at any depth is a security rejection. */
const DOCK_PATH_KEY = /(?:path|file|dir|directory|root|url)$/i;
const hasDockPathKey = (v: unknown, depth = 0): boolean => {
  if (depth > 8 || !v || typeof v !== "object") return false;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (DOCK_PATH_KEY.test(k) || hasDockPathKey(x, depth + 1)) return true;
  return false;
};

/** The feature flag: the run routes (and the job store) exist only when FEATURE_DOCKING_RUN is exactly "1". */
export const dockingRunEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.FEATURE_DOCKING_RUN === "1";

/** Hosted mode has no caller scope (dedupe and listing are global) until accounts exist (task 7.3): refuse there. */
export const DOCKING_HOSTED_REFUSAL = "Docking jobs are unavailable in hosted mode until per-user accounts exist (task 7.3); run the API in local mode.";

/** Capability records: VINA_COMPARATOR_PREVIEW follows the flag; DOCKING.RUN (Mole engine) stays UNAVAILABLE. */
export const dockingCapabilities = (enabled: boolean, refusal?: string) => ({
  VINA_COMPARATOR_PREVIEW: refusal ? { ...vinaComparatorCapability(false), unavailableReason: refusal } : vinaComparatorCapability(enabled),
  "DOCKING.RUN": { state: "UNAVAILABLE" as const, reason: "The Mole docking engine is not released (gate D8); only the separate Vina comparator preview can run." },
});

export type DockJobRoutesOptions = Readonly<{
  enabled: boolean;
  /** The opened service; only called when enabled (the server opens the store lazily, once). */
  service: () => Promise<DockJobService>;
  prefix?: string;
  maxSseConnections?: number;
  heartbeatMs?: number;
  stallMs?: number;
  /** Set when the routes are refused on purpose (hosted mode until accounts exist): job routes answer 404 UNAVAILABLE with this reason. */
  refusal?: string;
}>;

export type DockJobRoutes = ((req: IncomingMessage, res: ServerResponse, pathname: string) => Promise<boolean>) &
  Readonly<{ openStreams: () => number; closeStreams: () => void }>;

const lastEventId = (req: IncomingMessage): number => {
  const raw = req.headers["last-event-id"];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  return /^\d{1,9}$/.test(v) ? Math.min(Number(v), JOB_CAPS.eventsMax) : 0;
};

const resultResponse = (r: DockJobResultV1): DockJobResultResponseV1 =>
  DockJobResultResponseV1Schema.parse({ ...r, capability: vinaComparatorCapability(true, r.provenance.vinaPin.version), notice: DOCKING_PREVIEW_NOTICE, vinaScoreSemantics: { ...VINA_SCORE_SEMANTICS } });

export const createDockJobRoutes = (o: DockJobRoutesOptions): DockJobRoutes => {
  const prefix = o.prefix ?? "/api";
  const base = `${prefix}/docking/jobs`;
  const capabilitiesPath = `${prefix}/docking/capabilities`;
  const maxSse = o.maxSseConnections ?? DOCK_SSE_MAX_CONNECTIONS;
  const heartbeatMs = o.heartbeatMs ?? DOCK_SSE_HEARTBEAT_MS;
  const streams = new Set<() => void>();
  const stallMs = o.stallMs ?? DOCK_SSE_STALL_MS;

  const stream = (service: DockJobService, req: IncomingMessage, res: ServerResponse, id: string): void => {
    service.get(id); // 404 before any SSE header
    if (streams.size >= maxSse) {
      res.setHeader("retry-after", "5");
      return fail(res, 429, "SSE_BUSY", "Too many event streams are open; try again shortly.");
    }
    const after = lastEventId(req);
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.write("retry: 2000\n\n");
    let closed = false;
    const subscription: { off?: () => void } = {};
    // Events are queued and written only while the socket accepts data (backpressure): a replay larger than the
    // buffer cap is paged out on 'drain'. Only a client that stays blocked for stallMs is dropped.
    const queue: JobEvent[] = [];
    let waiting = false;
    let stall: NodeJS.Timeout | undefined;
    let reachedEnd = false;
    const heartbeat = setInterval(() => {
      if (!closed && !waiting) res.write(": heartbeat

");
    }, heartbeatMs);
    heartbeat.unref();
    const finish = () => {
      if (closed) return;
      closed = true;
      streams.delete(finish);
      clearInterval(heartbeat);
      if (stall) clearTimeout(stall);
      res.off("drain", onDrain);
      subscription.off?.();
      if (!res.writableEnded) res.end();
    };
    streams.add(finish);
    res.on("close", finish);
    const terminalAt = (): number | undefined => {
      try {
        const s = service.get(id);
        return TERMINAL_STATUSES.has(s.status) ? s.seq : undefined;
      } catch {
        return -1; // the job is gone (gc): nothing more will come
      }
    };
    const pump = (): void => {
      while (!closed && !waiting && queue.length) {
        const e = queue.shift()!;
        if (!res.write(`id: ${e.seq}
event: ${e.type}
data: ${JSON.stringify(e)}

`)) {
          waiting = true;
          res.once("drain", onDrain);
          stall = setTimeout(() => {
            res.destroy();
            finish();
          }, stallMs);
          stall.unref();
        }
      }
      if (!closed && !waiting && reachedEnd && queue.length === 0) finish();
    };
    function onDrain(): void {
      waiting = false;
      if (stall) clearTimeout(stall);
      if (!closed && res.writableLength > SSE_MAX_BUFFERED) {
        res.destroy();
        return finish();
      }
      pump();
    }
    const deliver = (e: JobEvent) => {
      if (closed) return;
      queue.push(e);
      if (queue.length > 2 * JOB_CAPS.eventsMax) {
        res.destroy();
        return finish();
      }
      // A terminal commit writes status, progress and result/error together: close after the last of them.
      const end = terminalAt();
      if (end !== undefined && e.seq >= end) reachedEnd = true;
      pump();
    };
    const u = service.subscribe(id, after, deliver);
    if (closed) return u();
    subscription.off = u;
    if (terminalAt() !== undefined) reachedEnd = true;
    pump();
  };

  const handle = async (req: IncomingMessage, res: ServerResponse, parts: string[], method: string): Promise<void> => {
    try {
      let service: DockJobService;
      try {
        service = await o.service();
      } catch (e) {
        if (e instanceof DockJobError) throw e;
        throw new DockJobError("UNAVAILABLE", 503, "Docking jobs are unavailable: the job store could not be opened.");
      }
      if (parts.length === 0) {
        if (method === "POST") {
          const raw = await readRaw(req, DOCK_BODY_CAP_BYTES);
          let body: unknown;
          try {
            body = JSON.parse(raw.toString("utf8") || "null");
          } catch {
            return fail(res, 400, "INVALID_INPUT", "The request body must be JSON.");
          }
          if (hasForbiddenKey(body) || hasDockPathKey(body)) return fail(res, 400, "SECURITY_REJECTION", "Clients send prepared ids, box and options only; paths and digests are computed by the server.");
          const parsed = parseOr400(DockJobRequestSchema, body, "docking request");
          const { job, deduped } = await service.submit(parsed);
          const answer: DockJobSubmitResponseV1 = { jobId: job.jobId, deduped, job };
          return send(res, 202, answer);
        }
        if (method === "GET") return send(res, 200, { jobs: service.list() });
        return fail(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      const id = parseOr400(UuidIdSchema, decodeSegment(parts[0]!), "job id");
      if (parts.length === 1 && method === "GET") return send(res, 200, service.get(id));
      if (parts.length === 2 && parts[1] === "events" && method === "GET") return stream(service, req, res, id);
      if (parts.length === 2 && parts[1] === "cancel" && method === "POST") {
        await readRaw(req, DOCK_BODY_CAP_BYTES); // a cancel carries no body; anything sent is drained under the cap
        // Over HTTP every terminal job (including an already CANCELLED one) answers 409; the store stays idempotent.
        const cur = service.get(id);
        if (TERMINAL_STATUSES.has(cur.status)) return fail(res, 409, "ALREADY_TERMINAL", `Docking job is already ${cur.status}.`);
        return send(res, 200, service.cancel(id));
      }
      if (parts.length === 2 && parts[1] === "result" && method === "GET") return send(res, 200, resultResponse(service.result(id)));
      if (parts.length === 3 && parts[1] === "artifacts" && method === "GET") {
        const name = decodeSegment(parts[2]!);
        if (!Object.hasOwn(DOCK_JOB_ARTIFACTS, name)) {
          service.get(id);
          return fail(res, 404, "NOT_FOUND", "Artifact not found.");
        }
        const a = await service.artifact(id, name);
        res.writeHead(200, {
          "content-type": a.contentType,
          "content-length": String(a.size),
          "content-disposition": `attachment; filename="${name}"`,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "x-mole-sha256": a.sha256,
          "x-mole-label": "PREVIEW_UNQUALIFIED",
        });
        // Streamed (never buffered); a client that disconnects destroys the file stream and frees the download slot.
        await new Promise<void>((done) => pipeline(a.stream, res, () => done()));
        return;
      }
      return fail(res, 404, "NOT_FOUND", "Not found.");
    } catch (e) {
      if (!req.readableEnded) req.resume();
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (e instanceof DockJobError) return fail(res, e.httpStatus, e.code, e.message);
      if (e instanceof PrepError) return fail(res, e.httpStatus, e.code, e.message);
      if (e instanceof IngestionError) return fail(res, e.status, e.code, e.message);
      return fail(res, 500, "INTERNAL_ERROR", "The request could not be completed.");
    }
  };

  const handler = async (req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> => {
    if (pathname === capabilitiesPath && (req.method ?? "GET") === "GET") {
      send(res, 200, dockingCapabilities(o.enabled, o.refusal));
      return true;
    }
    if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
    // Flag off: unreachable. The caller answers its plain 404, exactly as for an unknown route.
    if (!o.enabled) {
      if (!o.refusal) return false;
      fail(res, 404, "UNAVAILABLE", o.refusal);
      return true;
    }
    await handle(req, res, pathname.slice(base.length).split("/").filter(Boolean), req.method ?? "GET");
    return true;
  };
  return Object.assign(handler, {
    openStreams: () => streams.size,
    closeStreams: () => {
      for (const f of [...streams]) f();
    },
  });
};
