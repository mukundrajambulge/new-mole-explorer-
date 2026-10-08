import {
  DockResultSchema,
  JobStatusSchema,
  PrepJobStateV1Schema,
  type DockJobRequest,
  type DockResult,
  type JobStatus,
  type PrepConfirmationV1,
  type PrepJobStateV1,
  type PrepareRequest,
} from "@molecular/contracts";
import type { ZodType } from "zod";

/**
 * Client for the docking job contract (packages/contracts/src/docking/jobs.ts).
 * Every call takes an AbortSignal; every reply is validated with the contract
 * schemas, so a malformed reply is shown as an error and never as a result.
 */

const envBase = (import.meta.env.VITE_DOCKING_API_BASE_URL as string | undefined) ?? (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";
/** True when the UI is pointed at the 5.0 mock job server (set VITE_DOCKING_MOCK=1). */
export const DOCKING_BACKEND_IS_MOCK = (import.meta.env.VITE_DOCKING_MOCK as string | undefined) === "1";

export class DockingClientError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "DockingClientError";
  }
}

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

const messageFor = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: unknown };
    const detail = typeof body.error === "string" ? body.error : typeof (body.error as { message?: unknown } | undefined)?.message === "string" ? (body.error as { message: string }).message : null;
    if (detail) return `${detail.slice(0, 300)} (HTTP ${response.status})`;
  } catch {
    // fall through to the generic message
  }
  return `Docking service request failed (HTTP ${response.status}).`;
};

const call = async <T>(base: string, path: string, schema: ZodType<T>, init: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new DockingClientError(0, "Cannot reach the docking service. Check that it is running.");
  }
  if (!response.ok) throw new DockingClientError(response.status, await messageFor(response));
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new DockingClientError(response.status, "The docking service sent a reply that does not match the job contract; it was discarded.");
  return parsed.data;
};

const json = (method: string, body: unknown, signal: AbortSignal): RequestInit => ({ method, signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export type PoseFormat = "sdf" | "pdbqt";

export type DockingJobsClient = {
  isMock: boolean;
  planPrep: (request: PrepareRequest, signal: AbortSignal) => Promise<PrepJobStateV1>;
  confirmPrep: (confirmation: PrepConfirmationV1, signal: AbortSignal) => Promise<PrepJobStateV1>;
  getPrep: (jobId: string, signal: AbortSignal) => Promise<PrepJobStateV1>;
  startJob: (request: DockJobRequest, signal: AbortSignal) => Promise<JobStatus>;
  getJob: (jobId: string, signal: AbortSignal) => Promise<JobStatus>;
  cancelJob: (jobId: string, signal: AbortSignal) => Promise<JobStatus>;
  getResult: (jobId: string, signal: AbortSignal) => Promise<DockResult>;
  /** Fetches the text of a pose artifact. The service must expose GET /docking/artifacts/:id?format=. */
  getPoseText: (artifactId: string, format: PoseFormat, signal: AbortSignal) => Promise<string>;
};

export const createDockingClient = (base: string = envBase, isMock: boolean = DOCKING_BACKEND_IS_MOCK): DockingJobsClient => {
  const enc = encodeURIComponent;
  return {
    isMock,
    planPrep: (request, signal) => call(base, "/docking/prep/plan", PrepJobStateV1Schema, json("POST", request, signal)),
    confirmPrep: (confirmation, signal) => call(base, `/docking/prep/${enc(confirmation.jobId)}/confirm`, PrepJobStateV1Schema, json("POST", confirmation, signal)),
    getPrep: (jobId, signal) => call(base, `/docking/prep/${enc(jobId)}`, PrepJobStateV1Schema, { signal }),
    startJob: (request, signal) => call(base, "/docking/jobs", JobStatusSchema, json("POST", request, signal)),
    getJob: (jobId, signal) => call(base, `/docking/jobs/${enc(jobId)}`, JobStatusSchema, { signal }),
    cancelJob: (jobId, signal) => call(base, `/docking/jobs/${enc(jobId)}/cancel`, JobStatusSchema, { method: "POST", signal }),
    getResult: (jobId, signal) => call(base, `/docking/jobs/${enc(jobId)}/result`, DockResultSchema, { signal }),
    getPoseText: async (artifactId, format, signal) => {
      let response: Response;
      try {
        response = await fetch(`${base}/docking/artifacts/${enc(artifactId)}?format=${format}`, { signal });
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new DockingClientError(0, "Cannot reach the docking service. Check that it is running.");
      }
      if (!response.ok) throw new DockingClientError(response.status, await messageFor(response));
      const text = await response.text();
      if (text.length > 5_000_000) throw new DockingClientError(response.status, "Pose file is larger than the 5 MB limit.");
      return text;
    },
  };
};

export const dockingClient = createDockingClient();
