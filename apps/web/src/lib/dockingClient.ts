import {
  ArtifactIdSchema,
  DOCK_JOB_TERMINAL_STATUSES,
  DockJobResultResponseV1Schema,
  DockJobStateV1Schema,
  DockJobSubmitResponseV1Schema,
  DockResultSchema,
  JobEventSchema,
  JobStatusSchema,
  PrepJobStateV1Schema,
  VinaComparatorCapabilityV1Schema,
  type DockJobArtifactName,
  type DockJobRequest,
  type DockJobStage,
  type DockJobStateV1,
  type DockJobStatusName,
  type DockResult,
  type JobEvent,
  type JobStatus,
  type PrepConfirmationV1,
  type PrepJobStateV1,
  type PrepareRequest,
  type VinaComparatorCapabilityV1,
} from "@molecular/contracts";
import { z, type ZodType } from "zod";
import { readSse } from "./sseClient";

/**
 * Client for the docking job API (task 5.7c). Two backends behind one interface:
 *  - real (default): apps/api 5.5 routes under /api (the Vite proxy adds x-mole-token); replies validated with the
 *    5.5 contract schemas (DockJobStateV1, DockJobResultResponseV1, capabilities).
 *  - mock (only with VITE_DOCKING_MOCK=1, scripts/dev-docking-mock.mjs): the 5.0 mock job server; labelled MOCK.
 * Every call takes an AbortSignal; a reply that fails validation is an error, never a result.
 */

/** True only when the UI is pointed at the 5.0 mock job server (VITE_DOCKING_MOCK=1). */
export const DOCKING_BACKEND_IS_MOCK = (import.meta.env.VITE_DOCKING_MOCK as string | undefined) === "1";
const envBase = DOCKING_BACKEND_IS_MOCK
  ? ((import.meta.env.VITE_DOCKING_API_BASE_URL as string | undefined) ?? "/api")
  : ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api");

export class DockingClientError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = "DockingClientError";
  }
}

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

/** Removes anything that looks like an absolute path from a server message (defence in depth; the API never sends one). */
export const scrubPaths = (s: string): string =>
  s.replace(/[A-Za-z]:[\\/][^\s"'<>]*/g, "<path>").replace(/(?<![\w.])\/(?:home|mnt|tmp|Users|var|root|usr|opt|etc)\/[^\s"'<>]*/g, "<path>");

const messageFor = async (response: Response): Promise<{ message: string; code?: string }> => {
  try {
    const body = (await response.json()) as { error?: unknown };
    const e = body.error as { message?: unknown; code?: unknown } | string | undefined;
    const detail = typeof e === "string" ? e : typeof e?.message === "string" ? e.message : null;
    const code = typeof e === "object" && typeof e?.code === "string" ? e.code.slice(0, 64) : undefined;
    if (detail) return { message: `${scrubPaths(detail).slice(0, 300)} (HTTP ${response.status}${code ? `, ${code}` : ""})`, ...(code ? { code } : {}) };
  } catch {
    // fall through to the generic message
  }
  return { message: `Docking service request failed (HTTP ${response.status}).` };
};

const send = async (url: string, init: RequestInit): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new DockingClientError(0, "Cannot reach the docking service. Check that the API is running.");
  }
  if (!response.ok) {
    const { message, code } = await messageFor(response);
    throw new DockingClientError(response.status, message, code);
  }
  return response;
};

const call = async <T>(url: string, schema: ZodType<T>, init: RequestInit): Promise<T> => {
  const response = await send(url, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new DockingClientError(response.status, "The docking service sent a reply that is not JSON; it was discarded.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new DockingClientError(response.status, "The docking service sent a reply that does not match the job contract; it was discarded.");
  return parsed.data;
};

const TEXT_CAP = 5_000_000;
const callText = async (url: string, init: RequestInit): Promise<string> => {
  const response = await send(url, init);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > TEXT_CAP) throw new DockingClientError(response.status, "The file is larger than the 5 MB limit.");
  const text = await response.text();
  if (text.length > TEXT_CAP) throw new DockingClientError(response.status, "The file is larger than the 5 MB limit.");
  return text;
};

const json = (method: string, body: unknown, signal: AbortSignal): RequestInit => ({ method, signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// ---- normalised view models (what the wizard renders) ----

/** One docking job as the wizard shows it: status axis + stage field + real progress points only. */
export type WizardJob = Readonly<{ jobId: string; status: DockJobStatusName; stage?: DockJobStage; progress: number; message?: string; error?: string }>;
export type WizardPose = Readonly<{ rank: number; vinaScore: number; rmsdLbFromBest: number | null; rmsdUbFromBest: number | null }>;
export type DownloadName = DockJobArtifactName;
export type WizardResult = Readonly<{
  jobId: string;
  inputDigest: string | null;
  label: "PREVIEW_UNQUALIFIED";
  vinaScore: number | null;
  /** Why the ME score is absent (always: the Mole engine is UNAVAILABLE). */
  meScoreReason: string;
  poses: readonly WizardPose[];
  engine: string | null;
  seed: number | null;
  prepQualification: string | null;
  prepSealStatus: string | null;
  /** Files the backend offers for this job; nothing else is shown. */
  downloads: readonly DownloadName[];
  mock: boolean;
}>;

export type DockingRunCapability = Readonly<{ state: "UNAVAILABLE"; reason: string }>;
export type DockingCapabilities =
  | Readonly<{ mode: "mock" }>
  | Readonly<{ mode: "real"; vina: VinaComparatorCapabilityV1; dockingRun: DockingRunCapability }>;

export const DockingCapabilitiesResponseSchema = z
  .object({
    VINA_COMPARATOR_PREVIEW: VinaComparatorCapabilityV1Schema,
    "DOCKING.RUN": z.object({ state: z.literal("UNAVAILABLE"), reason: z.string().max(500) }).strict(),
  })
  .passthrough();

export type PrepArtifactFormat = "pdb" | "sdf" | "mol" | "mol2" | "smi";
const PrepArtifactReplySchema = z.object({ artifactId: ArtifactIdSchema }).passthrough();

export type WatchMode = "stream" | "polling";
export type WatchOptions = Readonly<{
  signal: AbortSignal;
  onJob: (job: WizardJob) => void;
  onMode?: (mode: WatchMode, reason?: string) => void;
  /** Test seams. */
  pollMs?: number;
  backoffMs?: number;
  maxStreamFailures?: number;
}>;

export type DockingJobsClient = {
  isMock: boolean;
  getCapabilities: (signal: AbortSignal) => Promise<DockingCapabilities>;
  /** Maps a loaded structure's source artifact to a preparation artifact (receptor). */
  importReceptor: (sourceArtifactId: string, signal: AbortSignal) => Promise<string>;
  /** Uploads raw bytes (ligand PDB/SDF/MOL/MOL2 or a SMILES template) as a preparation artifact. */
  uploadPrepArtifact: (body: Blob | string, format: PrepArtifactFormat, signal: AbortSignal) => Promise<string>;
  planPrep: (request: PrepareRequest, signal: AbortSignal) => Promise<PrepJobStateV1>;
  confirmPrep: (confirmation: PrepConfirmationV1, signal: AbortSignal) => Promise<PrepJobStateV1>;
  getPrep: (jobId: string, signal: AbortSignal) => Promise<PrepJobStateV1>;
  startJob: (request: DockJobRequest, signal: AbortSignal) => Promise<{ job: WizardJob; deduped: boolean }>;
  getJob: (jobId: string, signal: AbortSignal) => Promise<WizardJob>;
  cancelJob: (jobId: string, signal: AbortSignal) => Promise<WizardJob>;
  /** Follows a job until it is terminal: SSE over fetch with Last-Event-ID reconnect, then polling as fallback. */
  watchJob: (jobId: string, options: WatchOptions) => Promise<WizardJob>;
  getResult: (jobId: string, signal: AbortSignal) => Promise<WizardResult>;
  /** Pose coordinate text per rank (PDBQT). */
  getPoseTexts: (result: WizardResult, signal: AbortSignal) => Promise<Readonly<Record<number, string>>>;
  download: (result: WizardResult, name: DownloadName, signal: AbortSignal) => Promise<string>;
};

const TERMINAL = new Set<string>(DOCK_JOB_TERMINAL_STATUSES);
export const isTerminal = (status: string): boolean => TERMINAL.has(status);

const fromState = (s: DockJobStateV1): WizardJob => ({
  jobId: s.jobId,
  status: s.status,
  ...(s.stage ? { stage: s.stage } : {}),
  progress: s.progress,
  ...(s.error ? { error: `${scrubPaths(s.error.message)} (${s.error.code})` } : {}),
});
const fromStatus = (s: JobStatus): WizardJob => ({
  jobId: s.jobId,
  status: s.status,
  ...(s.stage ? { stage: s.stage } : {}),
  progress: s.progress,
  ...(s.message ? { message: s.message } : {}),
  ...(s.error ? { error: scrubPaths(s.error) } : {}),
});

/** Applies one job event to the job view. The status axis and the stage field stay separate. */
export const applyJobEvent = (job: WizardJob, e: JobEvent): WizardJob => {
  switch (e.type) {
    case "status": {
      const { stage: _old, ...rest } = job;
      void _old;
      return { ...rest, status: e.status, ...(e.stage ? { stage: e.stage } : {}) };
    }
    case "stage":
      return { ...job, stage: e.stage };
    case "progress":
      return { ...job, progress: e.progress, ...(e.message ? { message: e.message } : {}) };
    case "error":
      return { ...job, error: scrubPaths(e.message) };
    default:
      return job;
  }
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
    const t = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(new DOMException("aborted", "AbortError")); };
    signal.addEventListener("abort", onAbort, { once: true });
  });

/** Splits a multi-model PDBQT into MODEL blocks (rank = block index + 1). A file without MODEL records is one pose. */
export const splitPdbqtModels = (text: string): string[] => {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let cur: string[] | null = null;
  for (const l of lines) {
    if (l.startsWith("MODEL")) { cur = [l]; continue; }
    if (cur) {
      cur.push(l);
      if (l.startsWith("ENDMDL")) { blocks.push(cur.join("\n")); cur = null; }
    }
  }
  if (blocks.length === 0 && /^(ATOM|HETATM)/m.test(text)) return [text];
  return blocks;
};

const watchJobWith = (base: string, getJob: DockingJobsClient["getJob"]) => async (jobId: string, o: WatchOptions): Promise<WizardJob> => {
  const { signal } = o;
  const pollMs = o.pollMs ?? 1000;
  const baseBackoff = o.backoffMs ?? 500;
  const maxFailures = o.maxStreamFailures ?? 3;
  let job = await getJob(jobId, signal);
  o.onJob(job);
  let lastEventId: string | undefined;
  let lastSeq = -1;
  let failures = 0;
  let backoff = baseBackoff;
  let lastReason = "";
  o.onMode?.("stream");
  while (!isTerminal(job.status)) {
    let got = false;
    try {
      lastEventId = await readSse(
        `${base}/docking/jobs/${encodeURIComponent(jobId)}/events`,
        (m) => {
          let raw: unknown;
          try { raw = JSON.parse(m.data); } catch { return; }
          const parsed = JobEventSchema.safeParse(raw);
          // Ignore events for another job and replays we already applied (stale or duplicated replies).
          if (!parsed.success || parsed.data.jobId !== jobId || parsed.data.seq <= lastSeq) return;
          lastSeq = parsed.data.seq;
          got = true;
          job = applyJobEvent(job, parsed.data);
          o.onJob(job);
        },
        { signal, ...(lastEventId !== undefined ? { lastEventId } : {}) },
      );
      // The server closes the stream once the job is terminal: confirm with the authoritative state.
      job = await getJob(jobId, signal);
      o.onJob(job);
      if (isTerminal(job.status)) break;
      if (got) { failures = 0; backoff = baseBackoff; } else { failures += 1; lastReason = "the event stream closed without events"; }
    } catch (e) {
      if (isAbortError(e) || signal.aborted) throw e;
      failures += 1;
      lastReason = e instanceof Error ? scrubPaths(e.message).slice(0, 200) : "stream error";
      if (got) { failures = 1; backoff = baseBackoff; }
    }
    if (failures >= maxFailures) {
      o.onMode?.("polling", lastReason);
      while (!isTerminal(job.status)) {
        await sleep(pollMs, signal);
        job = await getJob(jobId, signal);
        o.onJob(job);
      }
      return job;
    }
    await sleep(backoff, signal);
    backoff = Math.min(backoff * 2, 8000);
  }
  return job;
};

const REAL_DOWNLOADS: readonly DownloadName[] = ["poses.pdbqt", "result.json", "manifest.json"];

export const createDockingClient = (base: string = envBase, isMock: boolean = DOCKING_BACKEND_IS_MOCK): DockingJobsClient => (isMock ? createMockClient(base) : createRealClient(base));

const createRealClient = (base: string): DockingJobsClient => {
  const enc = encodeURIComponent;
  const getJob: DockingJobsClient["getJob"] = async (jobId, signal) => fromState(await call(`${base}/docking/jobs/${enc(jobId)}`, DockJobStateV1Schema, { signal }));
  return {
    isMock: false,
    getCapabilities: async (signal) => {
      const c = await call(`${base}/docking/capabilities`, DockingCapabilitiesResponseSchema, { signal });
      return { mode: "real", vina: c.VINA_COMPARATOR_PREVIEW, dockingRun: c["DOCKING.RUN"] };
    },
    importReceptor: async (sourceArtifactId, signal) => (await call(`${base}/docking/prep/artifacts/from-source`, PrepArtifactReplySchema, json("POST", { sourceArtifactId }, signal))).artifactId,
    uploadPrepArtifact: async (body, format, signal) =>
      (await call(`${base}/docking/prep/artifacts?format=${format}`, PrepArtifactReplySchema, { method: "POST", signal, headers: { "content-type": "application/octet-stream" }, body })).artifactId,
    planPrep: (request, signal) => planCall(base, request, signal),
    confirmPrep: (confirmation, signal) => call(`${base}/docking/prep/${enc(confirmation.jobId)}/confirm`, PrepJobStateV1Schema, json("POST", confirmation, signal)),
    getPrep: (jobId, signal) => call(`${base}/docking/prep/${enc(jobId)}`, PrepJobStateV1Schema, { signal }),
    startJob: async (request, signal) => {
      const r = await call(`${base}/docking/jobs`, DockJobSubmitResponseV1Schema, json("POST", request, signal));
      return { job: fromState(r.job), deduped: r.deduped };
    },
    getJob,
    cancelJob: async (jobId, signal) => fromState(await call(`${base}/docking/jobs/${enc(jobId)}/cancel`, DockJobStateV1Schema, { method: "POST", signal })),
    watchJob: watchJobWith(base, getJob),
    getResult: async (jobId, signal) => {
      const r = await call(`${base}/docking/jobs/${enc(jobId)}/result`, DockJobResultResponseV1Schema, { signal });
      if (r.jobId !== jobId) throw new DockingClientError(200, "The docking service returned the result of another job; it was discarded.");
      return {
        jobId: r.jobId,
        inputDigest: r.inputDigest,
        label: r.label,
        vinaScore: r.vinaScore,
        meScoreReason: r.meScoreStatus.reason,
        poses: r.poses.map((p) => ({ rank: p.rank, vinaScore: p.vinaScore, rmsdLbFromBest: p.rmsdLbFromBest, rmsdUbFromBest: p.rmsdUbFromBest })),
        engine: `${r.capability.engine.name} ${r.capability.engine.version}`,
        seed: r.provenance.seed,
        prepQualification: r.provenance.prepQualification,
        prepSealStatus: r.provenance.prepSealStatus,
        downloads: REAL_DOWNLOADS,
        mock: false,
      };
    },
    getPoseTexts: async (result, signal) => {
      const text = await callText(`${base}/docking/jobs/${enc(result.jobId)}/artifacts/poses.pdbqt`, { signal });
      const blocks = splitPdbqtModels(text);
      const out: Record<number, string> = {};
      const ranks = result.poses.map((p) => p.rank).sort((a, b) => a - b);
      for (let i = 0; i < ranks.length && i < blocks.length; i += 1) out[ranks[i]!] = blocks[i]!;
      return out;
    },
    download: (result, name, signal) => callText(`${base}/docking/jobs/${enc(result.jobId)}/artifacts/${enc(name)}`, { signal }),
  };
};

/** A plan the worker refused (state FAILED) comes back as 422 with the job state: show it, it carries the reasons. */
const planCall = async (base: string, request: PrepareRequest, signal: AbortSignal): Promise<PrepJobStateV1> => {
  let response: Response;
  try {
    response = await fetch(`${base}/docking/prep/plan`, { cache: "no-store", ...json("POST", request, signal) });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new DockingClientError(0, "Cannot reach the docking service. Check that the API is running.");
  }
  if (response.status === 422) {
    const body: unknown = await response.clone().json().catch(() => null);
    const parsed = PrepJobStateV1Schema.safeParse(body);
    if (parsed.success) return parsed.data;
  }
  if (!response.ok) {
    const { message, code } = await messageFor(response);
    throw new DockingClientError(response.status, message, code);
  }
  const parsed = PrepJobStateV1Schema.safeParse(await response.json());
  if (!parsed.success) throw new DockingClientError(response.status, "The docking service sent a reply that does not match the job contract; it was discarded.");
  return parsed.data;
};

/** The 5.0 mock job server (old JobStatus/DockResult contract). Everything it returns is labelled MOCK. */
const createMockClient = (base: string): DockingJobsClient => {
  const enc = encodeURIComponent;
  const raw = new Map<string, DockResult>();
  let n = 0;
  const getJob: DockingJobsClient["getJob"] = async (jobId, signal) => fromStatus(await call(`${base}/docking/jobs/${enc(jobId)}`, JobStatusSchema, { signal }));
  const poseTexts = async (result: WizardResult, signal: AbortSignal) => {
    const r = raw.get(result.jobId);
    const out: Record<number, string> = {};
    for (const p of r?.poses ?? []) out[p.rank] = await callText(`${base}/docking/artifacts/${enc(p.poseArtifactId)}?format=pdbqt`, { signal });
    return out;
  };
  return {
    isMock: true,
    getCapabilities: async () => ({ mode: "mock" }),
    importReceptor: async (sourceArtifactId) => `mock-rec-${sourceArtifactId.replace(/[^A-Za-z0-9]/g, "").slice(-40)}`,
    uploadPrepArtifact: async (_body, format) => `mock-${format}-${(n += 1)}`,
    planPrep: (request, signal) => call(`${base}/docking/prep/plan`, PrepJobStateV1Schema, json("POST", request, signal)),
    confirmPrep: (confirmation, signal) => call(`${base}/docking/prep/${enc(confirmation.jobId)}/confirm`, PrepJobStateV1Schema, json("POST", confirmation, signal)),
    getPrep: (jobId, signal) => call(`${base}/docking/prep/${enc(jobId)}`, PrepJobStateV1Schema, { signal }),
    startJob: async (request, signal) => ({ job: fromStatus(await call(`${base}/docking/jobs`, JobStatusSchema, json("POST", request, signal))), deduped: false }),
    getJob,
    cancelJob: async (jobId, signal) => fromStatus(await call(`${base}/docking/jobs/${enc(jobId)}/cancel`, JobStatusSchema, { method: "POST", signal })),
    watchJob: watchJobWith(base, getJob),
    getResult: async (jobId, signal) => {
      const r = await call(`${base}/docking/jobs/${enc(jobId)}/result`, DockResultSchema, { signal });
      raw.set(jobId, r);
      const best = r.poses.slice().sort((a, b) => a.rank - b.rank)[0];
      return {
        jobId: r.jobId,
        inputDigest: null,
        label: "PREVIEW_UNQUALIFIED",
        vinaScore: best ? best.vinaScore : null,
        meScoreReason: "MOCK_SERVER",
        poses: r.poses.map((p) => ({ rank: p.rank, vinaScore: p.vinaScore, rmsdLbFromBest: null, rmsdUbFromBest: null })),
        engine: "mock job server",
        seed: null,
        prepQualification: null,
        prepSealStatus: null,
        downloads: ["poses.pdbqt", "result.json"],
        mock: true,
      };
    },
    getPoseTexts: poseTexts,
    download: async (result, name, signal) => {
      if (name === "result.json") return JSON.stringify({ mock: true, note: "MOCK SERVER: fake test data, not docking results", result: raw.get(result.jobId) ?? null }, null, 2);
      if (name === "poses.pdbqt") return Object.values(await poseTexts(result, signal)).join("\n");
      throw new DockingClientError(404, "The mock server has no manifest.");
    },
  };
};

export const dockingClient = createDockingClient();
