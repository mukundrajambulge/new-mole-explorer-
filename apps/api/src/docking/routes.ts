import type { IncomingMessage, ServerResponse } from "node:http";
import { JobIdSchema, PrepareRequestSchema } from "@molecular/contracts";
import { PREP_MAX_ARTIFACT_BYTES, PrepError, type PrepJobStore } from "../jobs/prepJobs.js";
import type { PrepArtifactStore } from "../jobs/prepArtifacts.js";

/**
 * Preparation routes (task 5.2b, design 5.2 step 7). Mounted by server.ts under "/api":
 *   POST {prefix}/docking/prep/artifacts?format=sdf   raw bytes (<= 20 MB); the server computes the sha256
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
        const bytes = await readRaw(req, PREP_MAX_ARTIFACT_BYTES);
        return send(res, 201, o.artifacts.put(bytes, format));
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
      const parsed = PrepareRequestSchema.safeParse(body);
      if (!parsed.success) return fail(res, 400, "INVALID_INPUT", "The preparation request is invalid.");
      const state = await o.store.plan(parsed.data);
      return send(res, state.state === "FAILED" ? 422 : 201, state);
    }
    const id = parts[0];
    if (!id || !JobIdSchema.safeParse(id).success || !UUID_RE.test(id)) return fail(res, 400, "INVALID_INPUT", "The job id is invalid.");
    if (method === "GET" && parts.length === 1) return send(res, 200, o.store.get(id));
    if (method === "POST" && parts.length === 2 && parts[1] === "confirm") {
      const body = await readBody(req);
      if (hasForbiddenKey(body)) return fail(res, 400, "SECURITY_REJECTION", "A confirmation carries only jobId, planDigest and acks.");
      const { state } = o.store.confirm(id, body);
      return send(res, 202, state);
    }
    return fail(res, 404, "NOT_FOUND", "Not found.");
  } catch (e) {
    if (e instanceof PrepError) return fail(res, e.httpStatus, e.code, e.message);
    return fail(res, 500, "INTERNAL_ERROR", "The request could not be completed.");
  }
};
