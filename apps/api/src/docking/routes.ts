import type { IncomingMessage, ServerResponse } from "node:http";
import { JobIdSchema, PrepareRequestSchema } from "@molecular/contracts";
import { PrepError, type PrepJobStore } from "../jobs/prepJobs.js";

/**
 * Preparation routes (task 5.2b, design 5.2 step 7). Mounted under a prefix (default "/api"):
 *   POST {prefix}/docking/prep/plan          PrepareRequest (artifact ids + options only)
 *   POST {prefix}/docking/prep/:id/confirm   PrepConfirmationV1; 409 on planDigest mismatch; single-use
 *   GET  {prefix}/docking/prep/:id           PrepJobStateV1
 * zod-validated, 64 KB body cap, ids are UUIDs (no path parts), error messages never contain paths.
 * Clients may not send sha256 values or profile digests (SECURITY_REJECTION). DOCKING.RUN stays fail-closed:
 * nothing here runs docking or produces scores.
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

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  if (Number(req.headers["content-length"] ?? 0) > PREP_BODY_CAP_BYTES) throw new PrepError("BODY_TOO_LARGE", 413, "The request body is too large.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += b.length;
    if (size > PREP_BODY_CAP_BYTES) throw new PrepError("BODY_TOO_LARGE", 413, "The request body is too large.");
    chunks.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
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

export type PrepRoutesOptions = Readonly<{ store: PrepJobStore; prefix?: string }>;

/** Returns true when the request was handled (a prep route), false to let the caller continue routing. */
export const createPrepRoutes = ({ store, prefix = "/api" }: PrepRoutesOptions) => async (req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> => {
  const base = `${prefix}/docking/prep`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
  const parts = pathname.slice(base.length).split("/").filter(Boolean);
  await handlePrep(store, req, res, parts, req.method ?? "GET");
  return true;
};

const handlePrep = async (store: PrepJobStore, req: IncomingMessage, res: ServerResponse, parts: string[], method: string): Promise<void> => {
  try {
    if (method === "POST" && parts.length === 1 && parts[0] === "plan") {
      const body = await readBody(req);
      if (hasForbiddenKey(body)) return fail(res, 400, "SECURITY_REJECTION", "Clients send artifact ids and options only; digests and paths are computed by the server.");
      const parsed = PrepareRequestSchema.safeParse(body);
      if (!parsed.success) return fail(res, 400, "INVALID_INPUT", "The preparation request is invalid.");
      const state = await store.plan(parsed.data);
      return send(res, state.state === "FAILED" ? 422 : 201, state);
    }
    const id = parts[0];
    if (!id || !JobIdSchema.safeParse(id).success || !UUID_RE.test(id)) return fail(res, 400, "INVALID_INPUT", "The job id is invalid.");
    if (method === "GET" && parts.length === 1) return send(res, 200, store.get(id));
    if (method === "POST" && parts.length === 2 && parts[1] === "confirm") {
      const body = await readBody(req);
      if (hasForbiddenKey(body)) return fail(res, 400, "SECURITY_REJECTION", "A confirmation carries only jobId, planDigest and acks.");
      const { state } = store.confirm(id, body);
      return send(res, 202, state);
    }
    return fail(res, 404, "NOT_FOUND", "Not found.");
  } catch (e) {
    if (e instanceof PrepError) return fail(res, e.httpStatus, e.code, e.message);
    return fail(res, 500, "INTERNAL_ERROR", "The request could not be completed.");
  }
};
