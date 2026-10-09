import { Readable } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { DockJobResultV1, DockJobStateV1, DockJobStatusName, DockJobStage, JobEvent } from "@molecular/contracts";
import { createDockJobRoutes, type DockJobService } from "../../../api/src/docking/routes";
import { applyJobEvent, createDockingClient, DockingClientError, scrubPaths, splitPdbqtModels, type WizardJob } from "./dockingClient";

// Real 5.5 routes (createDockJobRoutes) over an in-memory job service: the web client must speak the real HTTP/SSE
// surface (DockJobStateV1, DockJobResultResponseV1, Last-Event-ID, capabilities). Poses are the real 1STP Vina fixture.
const POSES = readFileSync(fileURLToPath(new URL("../../../../tests/fixtures/dock/1STP-BTN-vina-poses.pdbqt", import.meta.url)));
const hex = (s: string) => createHash("sha256").update(s).digest("hex");
const sig = () => new AbortController().signal;

type Fake = { service: DockJobService; advance: (status: DockJobStatusName, progress: number, stage?: DockJobStage) => void; jobId: string; failWith?: { code: string; message: string } };

const makeFake = (): Fake => {
  const jobId = randomUUID();
  const t = new Date().toISOString();
  const events: JobEvent[] = [];
  const subs = new Set<{ after: number; cb: (e: JobEvent) => void }>();
  const provenance = { preparedReceptorId: `prec_${"a".repeat(32)}`, preparedLigandId: `plig_${"a".repeat(32)}`, prepJobId: jobId, ligandPrepJobId: jobId, prepSealStatus: "SEALED" as const, prepQualification: "INTERIM" as const, receptorSha256: hex("r"), ligandSha256: hex("l"), seed: 42, vinaPin: { version: "1.2.7", sha256: hex("v") }, vina: null };
  let state: DockJobStateV1 = { schemaVersion: 1, jobId, inputDigest: hex("in"), status: "CREATED", bootId: randomUUID(), cancelRequested: false, progress: 0, provenance, seq: 0, createdAt: t, updatedAt: t };
  const emit = (e: Omit<JobEvent, "jobId" | "seq" | "at"> & Record<string, unknown>) => {
    const ev = { ...e, jobId, seq: events.length + 1, at: new Date().toISOString() } as JobEvent;
    events.push(ev);
    state = { ...state, seq: ev.seq };
    for (const s of subs) s.cb(ev);
  };
  const fake: Fake = {
    jobId,
    advance: (status, progress, stage) => {
      const { stage: _s, ...rest } = state;
      void _s;
      state = { ...rest, status, progress, ...(stage ? { stage } : {}), ...(status === "FAILED" && fake.failWith ? { error: fake.failWith } : {}) };
      emit({ type: "status", status, ...(stage ? { stage } : {}) });
      emit({ type: "progress", progress });
      if (status === "COMPLETED") emit({ type: "result", resultReady: true });
    },
    service: {
      init: async () => undefined,
      submit: async () => ({ job: state, deduped: false }),
      get: (id) => {
        if (id !== jobId) throw Object.assign(new Error("Docking job not found."), { code: "NOT_FOUND" });
        return state;
      },
      list: () => [state],
      cancel: () => { fake.advance("CANCELLED", state.progress); return state; },
      events: (_id, after = 0) => events.filter((e) => e.seq > after),
      subscribe: (_id, after, cb) => {
        for (const e of events) if (e.seq > after) cb(e);
        const s = { after, cb };
        subs.add(s);
        return () => subs.delete(s);
      },
      result: (): DockJobResultV1 => ({
        schemaVersion: 1, jobId, inputDigest: state.inputDigest, label: "PREVIEW_UNQUALIFIED", vinaScore: -7.241, meScore: null, meScoreStatus: { status: "UNAVAILABLE", reason: "MOLE_ENGINE_UNAVAILABLE" },
        poses: [-7.241, -5.853, -5.845].map((v, i) => ({ rank: i + 1, vinaScore: v, rmsdLbFromBest: i === 0 ? 0 : 4, rmsdUbFromBest: i === 0 ? 0 : 6, atomCount: 16, meScore: null })),
        posesSha256: createHash("sha256").update(POSES).digest("hex"), provenance,
      }),
      // 5.5 follow-up: artifacts are streamed (DockArtifactStream), not returned as a buffer.
      artifact: async (_id, name) => {
        const body = name === "poses.pdbqt" ? POSES : Buffer.from("{}");
        return { stream: Readable.from([body]), size: body.length, contentType: name === "poses.pdbqt" ? "chemical/x-pdbqt" : "application/json", sha256: name === "poses.pdbqt" ? hex("p") : hex("{}") };
      },
      close: async () => undefined,
    },
  };
  return fake;
};

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => { if (!server) return r(); server.close(() => r()); server.closeAllConnections(); }));

const serve = async (enabled: boolean, fake: Fake, wrap?: (req: IncomingMessage, res: ServerResponse) => boolean): Promise<string> => {
  const routes = createDockJobRoutes({ enabled, service: async () => fake.service, heartbeatMs: 50 });
  server = createServer((req, res) => {
    if (wrap?.(req, res)) return;
    const path = new URL(req.url ?? "/", "http://x").pathname;
    void routes(req, res, path).then((handled) => { if (!handled) { res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found." } })); } });
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api`;
};

describe("dockingClient against the real 5.5 routes", () => {
  it("reads capabilities: VINA_COMPARATOR_PREVIEW follows the flag, DOCKING.RUN stays UNAVAILABLE", async () => {
    const fake = makeFake();
    const off = createDockingClient(await serve(false, fake), false);
    const c = await off.getCapabilities(sig());
    expect(c).toMatchObject({ mode: "real", vina: { capability: "UNAVAILABLE", available: false, implementation: "IMPLEMENTED_UNVERIFIED", validation: "NOT_EVALUATED" }, dockingRun: { state: "UNAVAILABLE" } });
    if (c.mode === "real") expect(c.vina.unavailableReason).toContain("FEATURE_DOCKING_RUN=1");
    await expect(off.getJob(fake.jobId, sig())).rejects.toMatchObject({ status: 404 });
  });

  it("streams job events over fetch to COMPLETED, then loads the labelled result and splits the real poses file", async () => {
    const fake = makeFake();
    const c = createDockingClient(await serve(true, fake), false);
    expect((await c.getCapabilities(sig())).mode).toBe("real");
    const seen: WizardJob[] = [];
    setTimeout(() => fake.advance("QUEUED", 0), 30);
    setTimeout(() => fake.advance("RUNNING", 0.1, "DOCKING"), 60);
    setTimeout(() => fake.advance("COMPLETED", 1), 90);
    const modes: string[] = [];
    const final = await c.watchJob(fake.jobId, { signal: sig(), onJob: (j) => seen.push(j), onMode: (m) => modes.push(m) });
    expect(final.status).toBe("COMPLETED");
    expect(modes).toEqual(["stream"]);
    expect(seen.some((j) => j.status === "RUNNING" && j.stage === "DOCKING")).toBe(true);
    const result = await c.getResult(fake.jobId, sig());
    expect(result).toMatchObject({ label: "PREVIEW_UNQUALIFIED", vinaScore: -7.241, meScoreReason: "MOLE_ENGINE_UNAVAILABLE", engine: "AutoDock Vina 1.2.7", downloads: ["poses.pdbqt", "result.json", "manifest.json"], mock: false });
    const texts = await c.getPoseTexts(result, sig());
    expect(Object.keys(texts)).toEqual(["1", "2", "3"]);
    expect(texts[1]).toContain("REMARK VINA RESULT:    -7.241");
    expect(await c.download(result, "poses.pdbqt", sig())).toBe(POSES.toString("utf8"));
  });

  it("falls back to polling when the event stream keeps failing", async () => {
    const fake = makeFake();
    const base = await serve(true, fake, (req, res) => {
      if (!req.url?.endsWith("/events")) return false;
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "SSE_BUSY", message: "Too many event streams are open; try again shortly." } }));
      return true;
    });
    const c = createDockingClient(base, false);
    const modes: string[] = [];
    setTimeout(() => fake.advance("RUNNING", 0.1, "DOCKING"), 20);
    setTimeout(() => fake.advance("COMPLETED", 1), 80);
    const final = await c.watchJob(fake.jobId, { signal: sig(), onJob: () => undefined, onMode: (m) => modes.push(m), backoffMs: 5, pollMs: 10, maxStreamFailures: 2 });
    expect(final.status).toBe("COMPLETED");
    expect(modes).toEqual(["stream", "polling"]);
  });

  it("reconnects with Last-Event-ID and never re-applies replayed events", async () => {
    const fake = makeFake();
    const lastIds: (string | undefined)[] = [];
    let first = true;
    const base = await serve(true, fake, (req, res) => {
      if (!req.url?.endsWith("/events")) return false;
      lastIds.push(req.headers["last-event-id"] as string | undefined);
      if (first) {
        first = false;
        fake.advance("QUEUED", 0);
        res.writeHead(200, { "content-type": "text/event-stream" });
        // one real event, then the connection drops before the job is terminal
        res.end(`id: 1\nevent: status\ndata: ${JSON.stringify({ jobId: fake.jobId, seq: 1, at: new Date().toISOString(), type: "status", status: "QUEUED" })}\n\n`);
        setTimeout(() => fake.advance("COMPLETED", 1), 20);
        return true;
      }
      return false;
    });
    const c = createDockingClient(base, false);
    const statuses: string[] = [];
    const final = await c.watchJob(fake.jobId, { signal: sig(), onJob: (j) => statuses.push(j.status), backoffMs: 40 });
    expect(final.status).toBe("COMPLETED");
    expect(lastIds).toEqual([undefined, "1"]);
    // replayed events never move the job back: nothing after the first COMPLETED
    expect(statuses.slice(statuses.indexOf("COMPLETED")).every((s) => s === "COMPLETED")).toBe(true);
  });

  it("aborts the watcher on leave and shows real API errors (relative, no paths)", async () => {
    const fake = makeFake();
    const c = createDockingClient(await serve(true, fake), false);
    const ac = new AbortController();
    const p = c.watchJob(fake.jobId, { signal: ac.signal, onJob: () => undefined });
    setTimeout(() => ac.abort(), 30);
    await expect(p).rejects.toSatisfy((e: unknown) => e instanceof DOMException && e.name === "AbortError");
    fake.advance("COMPLETED", 1);
    await expect(c.cancelJob(fake.jobId, sig())).rejects.toMatchObject({ status: 409, code: "ALREADY_TERMINAL" });
    await expect(c.cancelJob(fake.jobId, sig())).rejects.toBeInstanceOf(DockingClientError);
    expect(scrubPaths("failed at C:\\Users\\x\\job\\out.json and /home/u/.mole/x")).toBe("failed at <path> and <path>");
  });
});

describe("pure helpers", () => {
  it("splits the real multi-model Vina file into ranked blocks", () => {
    const blocks = splitPdbqtModels(POSES.toString("utf8"));
    expect(blocks).toHaveLength(9);
    expect(blocks[0]).toMatch(/^MODEL/);
    expect(blocks[8]).toMatch(/ENDMDL$/);
  });
  it("keeps status and stage on separate axes", () => {
    const j: WizardJob = { jobId: "j", status: "RUNNING", stage: "DOCKING", progress: 0.1 };
    const done = applyJobEvent(j, { jobId: "j", seq: 3, at: "", type: "status", status: "COMPLETED" });
    expect(done).toEqual({ jobId: "j", status: "COMPLETED", progress: 0.1 });
    expect(applyJobEvent(done, { jobId: "j", seq: 4, at: "", type: "progress", progress: 1 }).progress).toBe(1);
  });
});
