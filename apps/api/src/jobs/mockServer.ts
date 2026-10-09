import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import {
  DockJobRequestSchema,
  PrepConfirmationV1Schema,
  PrepareRequestSchema,
  type DockJobStage,
  type DockJobStatusName,
  DOCK_SCORE_LABEL,
  type DockResult,
  type JobEvent,
  type JobStatus,
  type PrepJobStateV1,
  type PrepPlanV1,
} from "@molecular/contracts";

/**
 * Mock docking-job server for UI development (task 5.0). In-memory only; it
 * produces clearly fake numbers and never claims scientific validity.
 * Routes: POST /docking/prep/plan, POST /docking/prep/:id/confirm,
 * GET /docking/prep/:id, POST /docking/jobs, GET /docking/jobs/:id,
 * GET /docking/artifacts/:id (MOCK pose PDBQT), GET /docking/jobs/:id/events (SSE), GET /docking/jobs/:id/result,
 * POST /docking/jobs/:id/cancel.
 */

const BODY_CAP = 64 * 1024;

/** MOCK pose: a fixed 6 atom ring placed at the requested box center, shifted per rank. Not a docking result. */
const mockPosePdbqt = (rank: number, center: readonly [number, number, number]): string => {
  const lines = ["REMARK MOCK POSE (fake test data, not a docking result)", "MODEL 1"];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * 2 * Math.PI;
    const x = center[0] + 1.4 * Math.cos(a) + 0.5 * (rank - 1);
    const y = center[1] + 1.4 * Math.sin(a);
    const z = center[2];
    const el = i === 0 ? "OA" : i === 3 ? "NA" : "C";
    const num = String(i + 1).padStart(5);
    const name = (i === 0 ? "O" : i === 3 ? "N" : "C").padEnd(4);
    lines.push(`HETATM${num} ${name} MCK A   1    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00  0.00    +0.000 ${el.padEnd(2)}`);
  }
  lines.push("ENDMDL");
  return lines.join("\n") + "\n";
};
const ID = /^[A-Za-z0-9-]{1,64}$/;

type Job = { status: JobStatus; events: JobEvent[]; listeners: Set<ServerResponse>; timer?: NodeJS.Timeout; result?: DockResult };

export type MockServerOptions = { stepMs?: number; failSeed?: number };

export function createMockJobServer(options: MockServerOptions = {}): Server {
  const stepMs = options.stepMs ?? 300;
  const preps = new Map<string, { state: PrepJobStateV1; confirmed: boolean }>();
  const jobs = new Map<string, Job>();
  const poseTexts = new Map<string, string>();

  const now = () => new Date().toISOString();
  const send = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(body));
  };
  const err = (res: ServerResponse, code: number, message: string) => send(res, code, { error: message });

  const readBody = (req: IncomingMessage): Promise<unknown> =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size <= BODY_CAP) chunks.push(c);
      });
      req.on("end", () => {
        if (size > BODY_CAP) return reject(new Error("body too large"));
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
        } catch {
          reject(new Error("invalid json"));
        }
      });
      req.on("error", () => reject(new Error("read error")));
    });

  const emit = (job: Job, partial: Omit<JobEvent, "jobId" | "seq" | "at"> & Record<string, unknown>) => {
    const event = { ...partial, jobId: job.status.jobId, seq: job.events.length, at: now() } as JobEvent;
    job.events.push(event);
    for (const l of job.listeners) l.write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const setStatus = (job: Job, status: DockJobStatusName, progress: number, message?: string, error?: string, stage?: DockJobStage) => {
    const rest = { ...job.status };
    delete rest.stage; // the previous stage must not leak into the new status
    job.status = { ...rest, status, progress, updatedAt: now(), ...(stage ? { stage } : {}), ...(message ? { message } : {}), ...(error ? { error } : {}) };
    emit(job, { type: "status", status, ...(stage ? { stage } : {}) });
    emit(job, { type: "progress", progress, ...(message ? { message } : {}) });
    if (status === "COMPLETED") emit(job, { type: "result", resultReady: true });
    if (status === "FAILED" && error) emit(job, { type: "error", message: error });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) {
      for (const l of job.listeners) l.end();
      job.listeners.clear();
    }
  };

  const runJob = (job: Job, seed: number, center: readonly [number, number, number]) => {
    const steps: Array<() => void> = [
      () => setStatus(job, "QUEUED", 0, "queued (mock)"),
      () => setStatus(job, "RUNNING", 0.1, "preparing inputs (mock)", undefined, "PREPARING"),
      () => setStatus(job, "RUNNING", 0.4, "search (mock)", undefined, "DOCKING"),
      () => setStatus(job, "RUNNING", 0.8, "re-scoring (mock)", undefined, "RESCORING"),
      () => {
        if (seed === options.failSeed) return setStatus(job, "FAILED", 0.8, undefined, "mock failure");
        job.result = {
          jobId: job.status.jobId,
          poses: [1, 2, 3].map((rank) => ({
            rank,
            vinaScore: -9 + rank * 0.5,
            meScore: -9 + rank * 0.5,
            meTerms: { gauss1: -1.0 * rank, gauss2: -2.0, repulsion: 0.1, hydrophobic: -0.5, hbond: -0.3 },
            poseArtifactId: `mock-pose-${job.status.jobId.slice(0, 8)}-${rank}`,
          })),
          manifestRef: { artifactId: `mock-manifest-${job.status.jobId.slice(0, 8)}` },
          scoreStatus: "PREVIEW_UNQUALIFIED",
          scoreLabel: { ...DOCK_SCORE_LABEL },
        };
        for (const pose of job.result.poses) poseTexts.set(pose.poseArtifactId, mockPosePdbqt(pose.rank, center));
        setStatus(job, "COMPLETED", 1);
      },
    ];
    let i = 0;
    const tick = () => {
      if (job.status.status === "CANCELLED") return;
      steps[i++]?.();
      if (i < steps.length) job.timer = setTimeout(tick, stepMs);
    };
    job.timer = setTimeout(tick, stepMs);
  };

  const server = createServer((req, res) => {
    // Browsers preflight cross-origin JSON POSTs (the dev UI on :3101 calls this server directly).
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, last-event-id", "access-control-max-age": "600" });
      res.end();
      return;
    }
    void handle(req, res).catch((e: unknown) => {
      const m = e instanceof Error ? e.message : "error";
      if (!res.headersSent) err(res, m === "body too large" ? 413 : 400, m);
    });
  });

  server.on("close", () => {
    for (const j of jobs.values()) {
      if (j.timer) clearTimeout(j.timer);
      for (const l of j.listeners) l.end();
    }
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    const method = req.method ?? "GET";
    if (parts[0] !== "docking") return err(res, 404, "not found");

    if (parts[1] === "prep") {
      if (method === "POST" && parts[2] === "plan" && parts.length === 3) {
        const parsed = PrepareRequestSchema.safeParse(await readBody(req));
        if (!parsed.success) return err(res, 400, "invalid request");
        const jobId = randomUUID();
        const body = {
          schemaVersion: 1 as const,
          jobId,
          receptorArtifactId: parsed.data.receptorArtifactId,
          ligandArtifactId: parsed.data.ligandArtifactId,
          pH: parsed.data.pH,
          protonationSource: parsed.data.protonation,
          chargeModel: "mock-gasteiger",
          tautomer: "as-submitted",
          rotatableBonds: 3,
          decisions: [{ key: "waters", choice: parsed.data.keepWaters ? "keep" : "remove", atomsBefore: 100, atomsAfter: 90, requiresAck: false }],
          warnings: ["mock server: values are not scientific"],
        };
        const plan: PrepPlanV1 = { ...body, planDigest: createHash("sha256").update(JSON.stringify(body)).digest("hex") };
        const state: PrepJobStateV1 = {
          schemaVersion: 1,
          jobId,
          state: "AWAITING_CONFIRMATION",
          plan,
          createdAt: now(),
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        };
        preps.set(jobId, { state, confirmed: false });
        return send(res, 201, state);
      }
      const id = parts[2];
      if (!id || !ID.test(id)) return err(res, 400, "invalid id");
      const prep = preps.get(id);
      if (!prep) return err(res, 404, "not found");
      if (method === "GET" && parts.length === 3) return send(res, 200, prep.state);
      if (method === "POST" && parts[3] === "confirm" && parts.length === 4) {
        const parsed = PrepConfirmationV1Schema.safeParse(await readBody(req));
        if (!parsed.success || parsed.data.jobId !== id) return err(res, 400, "invalid request");
        if (prep.confirmed || prep.state.state !== "AWAITING_CONFIRMATION") return err(res, 409, "already confirmed");
        if (parsed.data.planDigest !== prep.state.plan?.planDigest) return err(res, 409, "plan digest mismatch");
        prep.confirmed = true;
        prep.state = { ...prep.state, state: "APPLYING" };
        setTimeout(() => {
          prep.state = { ...prep.state, state: "SUCCEEDED", preparedReceptorId: `prep-rec-${id.slice(0, 8)}`, preparedLigandId: `prep-lig-${id.slice(0, 8)}` };
        }, stepMs);
        return send(res, 202, prep.state);
      }
      return err(res, 404, "not found");
    }

    if (parts[1] === "artifacts" && method === "GET" && parts.length === 3) {
      const text = ID.test(parts[2] ?? "") ? poseTexts.get(parts[2]!) : undefined;
      if (!text) return err(res, 404, "not found");
      if (url.searchParams.get("format") === "sdf") return err(res, 404, "mock server only has PDBQT poses");
      res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
      return res.end(text);
    }

    if (parts[1] !== "jobs") return err(res, 404, "not found");
    if (method === "POST" && parts.length === 2) {
      const parsed = DockJobRequestSchema.safeParse(await readBody(req));
      if (!parsed.success) return err(res, 400, "invalid request");
      const jobId = randomUUID();
      const t = now();
      const job: Job = { status: { jobId, status: "CREATED", progress: 0, createdAt: t, updatedAt: t }, events: [], listeners: new Set() };
      jobs.set(jobId, job);
      emit(job, { type: "status", status: "CREATED" });
      runJob(job, parsed.data.seed, parsed.data.boxCenter);
      return send(res, 202, job.status);
    }
    const id = parts[2];
    if (!id || !ID.test(id)) return err(res, 400, "invalid id");
    const job = jobs.get(id);
    if (!job) return err(res, 404, "not found");
    if (method === "GET" && parts.length === 3) return send(res, 200, job.status);
    if (method === "GET" && parts[3] === "result") {
      return job.result ? send(res, 200, job.result) : err(res, 409, "result not available");
    }
    if (method === "POST" && parts[3] === "cancel") {
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status.status)) return err(res, 409, "job already finished");
      if (job.timer) clearTimeout(job.timer);
      setStatus(job, "CANCELLED", job.status.progress);
      return send(res, 200, job.status);
    }
    if (method === "GET" && parts[3] === "events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", "access-control-allow-origin": "*" });
      const last = Number(req.headers["last-event-id"] ?? -1);
      for (const e of job.events) if (e.seq > last) res.write(`id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status.status)) return res.end();
      job.listeners.add(res);
      req.on("close", () => job.listeners.delete(res));
      return;
    }
    return err(res, 404, "not found");
  }

  return server;
}

if (process.argv[1] && /mockServer\.[tj]s$/.test(process.argv[1])) {
  const port = Number(process.env.MOCK_JOBS_PORT ?? 8101);
  createMockJobServer().listen(port, "127.0.0.1", () => console.log(`mock docking jobs on http://127.0.0.1:${port}`));
}
