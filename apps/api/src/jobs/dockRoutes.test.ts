import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DockJobResultResponseV1Schema, DockJobStateV1Schema, DOCKING_PREVIEW_NOTICE, JobEventSchema } from "@molecular/contracts";
import { createDockJobRoutes, createDockJobService, type DockJobRoutes, type DockJobService } from "../docking/routes.js";
import { DockJobStore } from "./dockJobs.js";
import { createMoleDockRunner, type DockEngine } from "./dockRunner.js";
import { PrepJobStore } from "./prepJobs.js";
import { dockRequest, readSse, seedPrepJob, sha, statuses, type PreparedIds } from "./dockRoutes.fixture.js";
// @ts-expect-error: plain .mjs test support (no types)
import { fakeEngine } from "./dockCrash.fixture.mjs";

// Task 5.5: the docking job HTTP + SSE routes over the 5.4 store. Real tests/fixtures PDBQTs; the fake engine
// spawns a real node process (dockCrash.fixture.mjs) and writes the real Vina poses fixture.
type Fake = DockEngine & { calls: { dock: number } };
const ABS_PATH = /[A-Za-z]:[\\/]|\/(?:mnt|home|tmp|Users)\//;

const temps: string[] = [];
const cleanups: Array<() => Promise<void>> = [];
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  temps.push(d);
  return d;
};
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c().catch(() => undefined);
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Setup = { base: string; service: DockJobService; routes: DockJobRoutes; ids: PreparedIds; preview: PreparedIds; blocked: PreparedIds; engine: Fake; root: string; opened: () => number };
const setup = async (o: { engine?: Fake; enabled?: boolean; maxSse?: number; heartbeatMs?: number; maxQueue?: number } = {}): Promise<Setup> => {
  const prepRoot = tmp("dockroutes-prep-");
  const ids = seedPrepJob(prepRoot, "SEALED", "11111111-2222-4333-8444-555555555555");
  const preview = seedPrepJob(prepRoot, "PREVIEW_UNQUALIFIED", "21111111-2222-4333-8444-555555555555");
  const blocked = seedPrepJob(prepRoot, "BLOCKED", "31111111-2222-4333-8444-555555555555");
  const prep = new PrepJobStore({ root: prepRoot, resolveArtifact: async () => undefined, installedTools: async () => [] });
  prep.init();
  const engine = o.engine ?? (fakeEngine({ holdMs: 200 }) as Fake);
  const root = tmp("dockroutes-jobs-");
  const service = createDockJobService({
    root,
    prep,
    runner: createMoleDockRunner({ engine }),
    ...(o.maxQueue ? { createStore: (opts) => new DockJobStore({ ...opts, maxQueue: o.maxQueue }) } : {}),
  });
  let opened = 0;
  let ready: Promise<DockJobService> | undefined;
  const routes = createDockJobRoutes({
    enabled: o.enabled ?? true,
    service: () => {
      opened++;
      return (ready ??= service.init().then(() => service));
    },
    ...(o.maxSse ? { maxSseConnections: o.maxSse } : {}),
    ...(o.heartbeatMs ? { heartbeatMs: o.heartbeatMs } : {}),
  });
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    routes(req, res, url.pathname)
      .then((handled) => {
        if (handled) return;
        res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route was not found." } }));
      })
      .catch(() => res.destroy());
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  cleanups.push(async () => {
    routes.closeStreams();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    if (ready) await service.close();
  });
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/docking`, service, routes, ids, preview, blocked, engine, root, opened: () => opened };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test JSON is checked by assertions
type Json = Record<string, any>;
const call = async (base: string, method: string, path: string, body?: unknown, raw?: string): Promise<{ status: number; json: Json; headers: Headers; text: string }> => {
  const init: RequestInit = { method, headers: { "content-type": "application/json" } };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const r = await fetch(`${base}${path}`, init);
  const text = await r.text();
  expect(text).not.toMatch(ABS_PATH);
  let json: Json = {};
  try {
    json = JSON.parse(text) as Json;
  } catch {
    json = {};
  }
  return { status: r.status, json, headers: r.headers, text };
};
const waitStatus = async (s: Setup, id: string, status: string, ms = 15_000) => {
  const t0 = Date.now();
  for (;;) {
    const r = await call(s.base, "GET", `/jobs/${id}`);
    if (r.json.status === status) return r.json;
    if (Date.now() - t0 > ms) throw new Error(`job stayed ${r.json.status}, wanted ${status}`);
    await new Promise((x) => setTimeout(x, 25));
  }
};
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

describe("docking job routes (5.5)", () => {
  it("runs CREATED -> QUEUED -> RUNNING -> COMPLETED over HTTP, streams it live and serves the labelled result and artifacts", async () => {
    const s = await setup();
    const sub = await call(s.base, "POST", "/jobs", dockRequest(s.ids));
    expect(sub.status).toBe(202);
    expect(sub.json).toMatchObject({ deduped: false, job: { status: "QUEUED" } });
    const id = sub.json.jobId as string;
    expect(DockJobStateV1Schema.parse(sub.json.job).jobId).toBe(id);
    // Live: the stream starts mid-run (replay from 0), follows the job and closes itself at the terminal state.
    const live = await readSse(`${s.base}/jobs/${id}/events`, {});
    expect(live.status).toBe(200);
    expect(live.contentType).toMatch(/^text\/event-stream/);
    expect(live.ended).toBe(true);
    expect(statuses(live.events)).toEqual(["CREATED", "QUEUED", "RUNNING", "COMPLETED"]);
    expect(live.events.map((e) => e.id)).toEqual(live.events.map((_, i) => i + 1));
    for (const e of live.events) expect(JobEventSchema.parse(e.data).seq).toBe(e.id);
    expect(live.events.at(-1)).toMatchObject({ event: "result", data: { resultReady: true } });
    expect(live.events.filter((e) => e.event === "stage").map((e) => e.data.stage)).toEqual(["DOCKING"]);

    const state = await call(s.base, "GET", `/jobs/${id}`);
    expect(state.json).toMatchObject({ status: "COMPLETED", progress: 1 });
    expect((await call(s.base, "GET", "/jobs")).json.jobs.map((j: Json) => j.jobId)).toEqual([id]);

    const res = await call(s.base, "GET", `/jobs/${id}/result`);
    expect(res.status).toBe(200);
    const result = DockJobResultResponseV1Schema.parse(res.json);
    expect(result).toMatchObject({ label: "PREVIEW_UNQUALIFIED", meScore: null, meScoreStatus: { status: "UNAVAILABLE" }, notice: DOCKING_PREVIEW_NOTICE, jobId: id });
    expect(result.capability).toMatchObject({ id: "VINA_COMPARATOR_PREVIEW", capability: "EXPERIMENTAL", implementation: "IMPLEMENTED_UNVERIFIED", validation: "NOT_EVALUATED" });
    expect(result.vinaScoreSemantics).toMatchObject({ kind: "EMPIRICAL_RANKING_SCORE", direction: "LOWER_IS_BETTER" });
    expect(result.poses.every((p) => p.meScore === null)).toBe(true);
    // No affinity / free-energy / confidence claims anywhere in the result keys.
    expect(res.text).not.toMatch(/"(?:affinity|bindingAffinity|freeEnergy|deltaG|confidence|probability)"/i);

    const poses = await fetch(`${s.base}/jobs/${id}/artifacts/poses.pdbqt`);
    expect(poses.status).toBe(200);
    expect(poses.headers.get("content-type")).toBe("chemical/x-pdbqt; charset=utf-8");
    expect(poses.headers.get("x-content-type-options")).toBe("nosniff");
    expect(poses.headers.get("x-mole-label")).toBe("PREVIEW_UNQUALIFIED");
    const posesBytes = Buffer.from(await poses.arrayBuffer());
    expect(sha(posesBytes)).toBe(result.posesSha256);
    expect(poses.headers.get("x-mole-sha256")).toBe(result.posesSha256);
    for (const name of ["result.json", "manifest.json"]) {
      const a = await call(s.base, "GET", `/jobs/${id}/artifacts/${name}`);
      expect(a.status).toBe(200);
      expect(a.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(a.json.label).toBe("PREVIEW_UNQUALIFIED");
    }
    // Whitelist only: other files in the job dir, traversal and encoded traversal are 404; bad escapes 400.
    for (const name of ["job.json", "vina.log", "..%2Fstate.json", "..%2F..%2Fpid", "%2e%2e%2Fjob.json", "inputs%2Freceptor.pdbqt", "POSES.PDBQT"]) {
      const a = await call(s.base, "GET", `/jobs/${id}/artifacts/${name}`);
      expect(a.status, name).toBe(404);
    }
    expect((await call(s.base, "GET", `/jobs/${id}/artifacts/%E0%A4%A`)).status).toBe(400);
    // A tampered stored artifact is refused, never served.
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(s.root, id, "out", "poses.pdbqt"), "tampered\n");
    expect((await call(s.base, "GET", `/jobs/${id}/artifacts/poses.pdbqt`)).status).toBe(409);

    // Already terminal: cancel is 409; replay of a terminal job closes right after the replay.
    const again = await call(s.base, "POST", `/jobs/${id}/cancel`);
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("ALREADY_TERMINAL");
  }, 30_000);

  it("dedupes identical submits (concurrent too), not different ones, and not a resubmit after CANCELLED", async () => {
    const s = await setup({ engine: fakeEngine({ holdMs: 60_000 }) as Fake });
    const [a, b] = await Promise.all([call(s.base, "POST", "/jobs", dockRequest(s.ids)), call(s.base, "POST", "/jobs", dockRequest(s.ids))]);
    expect([a.status, b.status]).toEqual([202, 202]);
    expect(a.json.jobId).toBe(b.json.jobId);
    expect([a.json.deduped, b.json.deduped].sort()).toEqual([false, true]);
    const other = await call(s.base, "POST", "/jobs", dockRequest(s.ids, { seed: 7 }));
    expect(other.json.jobId).not.toBe(a.json.jobId);
    expect(other.json.deduped).toBe(false);
    // A PREVIEW_UNQUALIFIED preparation is allowed (labelled) and never dedupes onto the SEALED job.
    const pv = await call(s.base, "POST", "/jobs", dockRequest(s.preview));
    expect(pv.status).toBe(202);
    expect(pv.json.job.provenance.prepSealStatus).toBe("PREVIEW_UNQUALIFIED");
    expect(pv.json.jobId).not.toBe(a.json.jobId);
    expect((await call(s.base, "POST", `/jobs/${a.json.jobId}/cancel`)).json.status).toBe("CANCELLED");
    const after = await call(s.base, "POST", "/jobs", dockRequest(s.ids));
    expect(after.json.deduped).toBe(false);
    expect(after.json.jobId).not.toBe(a.json.jobId);
    for (const j of (await call(s.base, "GET", "/jobs")).json.jobs as Json[]) if (j.status !== "CANCELLED") await call(s.base, "POST", `/jobs/${j.jobId}/cancel`);
  }, 30_000);

  it("cancels RUNNING and QUEUED jobs, answers 409 on terminal jobs and never serves a cancelled result", async () => {
    const s = await setup({ engine: fakeEngine({ holdMs: 60_000 }) as Fake });
    const first = (await call(s.base, "POST", "/jobs", dockRequest(s.ids))).json.jobId as string;
    const second = (await call(s.base, "POST", "/jobs", dockRequest(s.ids, { seed: 9 }))).json.jobId as string;
    await waitStatus(s, first, "RUNNING");
    const running = await call(s.base, "GET", `/jobs/${first}`);
    expect(running.json).toMatchObject({ status: "RUNNING" });
    expect(["PREPARING", "DOCKING"]).toContain(running.json.stage);
    expect((await call(s.base, "GET", `/jobs/${second}`)).json.status).toBe("QUEUED");
    // Not finished: no result and no artifacts.
    expect((await call(s.base, "GET", `/jobs/${first}/result`)).status).toBe(409);
    expect((await call(s.base, "GET", `/jobs/${first}/artifacts/poses.pdbqt`)).status).toBe(409);

    const q = await call(s.base, "POST", `/jobs/${second}/cancel`);
    expect(q.status).toBe(200);
    expect(q.json).toMatchObject({ status: "CANCELLED", cancelRequested: true });
    const t0 = Date.now();
    const r = await call(s.base, "POST", `/jobs/${first}/cancel`);
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("CANCELLED");
    expect(Date.now() - t0).toBeLessThan(2000);
    for (const id of [first, second]) {
      const again = await call(s.base, "POST", `/jobs/${id}/cancel`);
      expect(again.status).toBe(409);
      expect(again.json.error.code).toBe("ALREADY_TERMINAL");
      const res = await call(s.base, "GET", `/jobs/${id}/result`);
      expect(res.status).toBe(409);
      expect(res.json.error.code).toBe("RESULT_UNAVAILABLE");
    }
    const replay = await readSse(`${s.base}/jobs/${first}/events`, {});
    expect(replay.ended).toBe(true);
    expect(statuses(replay.events)).toEqual(["CREATED", "QUEUED", "RUNNING", "CANCELLED"]);
  }, 30_000);

  it("reports FAILED with a scrubbed error and no result", async () => {
    const s = await setup({ engine: fakeEngine({ failWith: "VINA_FAILED", failMessage: (dir: string) => `vina crashed in ${dir}` }) as Fake });
    const id = (await call(s.base, "POST", "/jobs", dockRequest(s.ids))).json.jobId as string;
    const st = await waitStatus(s, id, "FAILED");
    expect(st.error.code).toBeTruthy();
    const evs = await readSse(`${s.base}/jobs/${id}/events`, {});
    expect(evs.ended).toBe(true);
    expect(statuses(evs.events)).toEqual(["CREATED", "QUEUED", "RUNNING", "FAILED"]);
    expect(evs.events.some((e) => e.event === "error")).toBe(true);
    expect(JSON.stringify(evs.events)).not.toMatch(ABS_PATH);
    expect((await call(s.base, "GET", `/jobs/${id}/result`)).status).toBe(409);
    expect((await call(s.base, "GET", `/jobs/${id}/artifacts/manifest.json`)).status).toBe(409);
  }, 30_000);

  it("SSE: replays after Last-Event-ID, treats a non-numeric id as 0, sends heartbeats, reconnects without gaps or duplicates", async () => {
    const s = await setup({ engine: fakeEngine({ holdMs: 60_000 }) as Fake, heartbeatMs: 40 });
    const id = (await call(s.base, "POST", "/jobs", dockRequest(s.ids))).json.jobId as string;
    await waitStatus(s, id, "RUNNING");
    // First connection: live, read until the docking stage arrives, then drop the connection.
    const one = await readSse(`${s.base}/jobs/${id}/events`, {}, { until: (ev, comments) => ev.some((e) => e.event === "stage") && comments.includes("heartbeat") });
    expect(one.ended).toBe(false);
    expect(one.comments).toContain("heartbeat");
    const lastId = one.events.at(-1)!.id;
    await new Promise((r) => setTimeout(r, 100));
    expect(s.routes.openStreams()).toBe(0); // the dropped stream released its slot
    // Reconnect from the last seen id; cancel while connected: the stream carries the tail live and closes.
    const reconnect = readSse(`${s.base}/jobs/${id}/events`, { "last-event-id": String(lastId) });
    await new Promise((r) => setTimeout(r, 150));
    expect(s.routes.openStreams()).toBe(1);
    await call(s.base, "POST", `/jobs/${id}/cancel`);
    const two = await reconnect;
    expect(two.ended).toBe(true);
    expect(two.events.every((e) => e.id > lastId)).toBe(true);
    expect(statuses(two.events)).toEqual(["CANCELLED"]);
    const all = [...one.events, ...two.events].map((e) => e.id);
    expect(all).toEqual(all.map((_, i) => i + 1));
    // Replay of a terminal job from a numeric id, from a non-numeric id (-> 0) and from past the end.
    const full = await readSse(`${s.base}/jobs/${id}/events`, { "last-event-id": "abc" });
    expect(full.events.map((e) => e.id)).toEqual(all);
    const tail = await readSse(`${s.base}/jobs/${id}/events`, { "last-event-id": "3" });
    expect(tail.events.map((e) => e.id)).toEqual(all.filter((x) => x > 3));
    const none = await readSse(`${s.base}/jobs/${id}/events`, { "last-event-id": "99999999" });
    expect(none.ended).toBe(true);
    expect(none.events).toEqual([]);
    expect((await readSse(`${s.base}/jobs/${id}/events`, { "last-event-id": "-5" })).events.length).toBe(all.length);
  }, 30_000);

  it("SSE: caps concurrent streams (429) and frees the slot when a client goes away", async () => {
    const s = await setup({ engine: fakeEngine({ holdMs: 60_000 }) as Fake, maxSse: 1 });
    const id = (await call(s.base, "POST", "/jobs", dockRequest(s.ids))).json.jobId as string;
    const first = readSse(`${s.base}/jobs/${id}/events`, {}, { ms: 600 });
    await new Promise((r) => setTimeout(r, 150));
    const busy = await readSse(`${s.base}/jobs/${id}/events`, {});
    expect(busy.status).toBe(429);
    expect(busy.body).toMatchObject({ error: { code: "SSE_BUSY" } });
    await first;
    await new Promise((r) => setTimeout(r, 100));
    expect(s.routes.openStreams()).toBe(0);
    const ok = readSse(`${s.base}/jobs/${id}/events`, {}, { until: (ev) => statuses(ev).includes("CANCELLED") });
    await new Promise((r) => setTimeout(r, 100));
    await call(s.base, "POST", `/jobs/${id}/cancel`);
    expect((await ok).status).toBe(200);
  }, 30_000);

  it("rejects bad input with 400 (field-named, never echoing paths), oversize bodies with 413 and unsealed preparations", async () => {
    const s = await setup();
    const good = dockRequest(s.ids);
    const bad: Array<[string, unknown]> = [
      ["missing ligand", { ...good, ligandPreparedId: undefined }],
      ["seed 0", { ...good, seed: 0 }],
      ["box edge 41", { ...good, boxSize: [41, 22, 22] }],
      ["poses 0", { ...good, numPoses: 0 }],
      ["exhaustiveness 65", { ...good, exhaustiveness: 65 }],
      ["extra key", { ...good, cpu: 64 }],
      ["traversal id", { ...good, receptorPreparedId: "../../etc/passwd" }],
      ["array body", [good]],
      ["null body", null],
    ];
    for (const [what, body] of bad) {
      const r = await call(s.base, "POST", "/jobs", body);
      expect(r.status, what).toBe(400);
      expect(r.json.error.code, what).toBe("INVALID_INPUT");
      expect(r.json.error.message, what).toMatch(/^Invalid docking request: /);
    }
    for (const extra of [{ sha256: "a".repeat(64) }, { inputDigest: "a".repeat(64) }, { receptorPath: "/tmp/x.pdbqt" }, { path: "C:\\x" }, { outputs: {} }]) {
      const r = await call(s.base, "POST", "/jobs", { ...good, ...extra });
      expect(r.status).toBe(400);
      expect(r.json.error.code).toBe("SECURITY_REJECTION");
    }
    const notJson = await call(s.base, "POST", "/jobs", undefined, "{nope");
    expect(notJson.status).toBe(400);
    const big = await call(s.base, "POST", "/jobs", undefined, JSON.stringify({ ...good, pad: "x".repeat(20 * 1024) }));
    expect(big.status).toBe(413);
    // Server-minted but BLOCKED: refused; a malformed job id in the path is 400.
    expect((await call(s.base, "POST", "/jobs", dockRequest(s.blocked))).status).toBe(400);
    for (const p of ["/jobs/..%2F..%2Fstate.json", "/jobs/not-a-uuid", "/jobs/%E0%A4%A", "/jobs/not-a-uuid/events", "/jobs/x/result"]) {
      expect((await call(s.base, "GET", p)).status, p).toBe(400);
    }
    expect((await call(s.base, "POST", "/jobs/not-a-uuid/cancel")).status).toBe(400);
    expect((await call(s.base, "GET", "/jobs")).json.jobs).toEqual([]);
  }, 30_000);

  it("answers 404 for unknown jobs, unknown prepared ids and unknown sub-routes", async () => {
    const s = await setup();
    for (const p of [`/jobs/${UNKNOWN}`, `/jobs/${UNKNOWN}/events`, `/jobs/${UNKNOWN}/result`, `/jobs/${UNKNOWN}/artifacts/poses.pdbqt`, `/jobs/${UNKNOWN}/artifacts/job.json`, `/jobs/${UNKNOWN}/nope`]) {
      const r = await call(s.base, "GET", p);
      expect(r.status, p).toBe(404);
    }
    expect((await call(s.base, "POST", `/jobs/${UNKNOWN}/cancel`)).status).toBe(404);
    const unknownPrep = await call(s.base, "POST", "/jobs", dockRequest({ receptorPreparedId: `prec_${"9".repeat(32)}`, ligandPreparedId: `plig_${"9".repeat(32)}` }));
    expect(unknownPrep.status).toBe(404);
    expect((await call(s.base, "DELETE", "/jobs")).status).toBe(405);
  });

  it("flag off: every run route is unreachable (plain 404), the store is never opened, the capability says UNAVAILABLE", async () => {
    const s = await setup({ enabled: false });
    for (const [m, p] of [
      ["POST", "/jobs"],
      ["GET", "/jobs"],
      ["GET", `/jobs/${UNKNOWN}`],
      ["GET", `/jobs/${UNKNOWN}/events`],
      ["POST", `/jobs/${UNKNOWN}/cancel`],
      ["GET", `/jobs/${UNKNOWN}/result`],
      ["GET", `/jobs/${UNKNOWN}/artifacts/poses.pdbqt`],
    ] as const) {
      const r = await call(s.base, m, p, m === "POST" ? dockRequest(s.ids) : undefined);
      expect(r.status, `${m} ${p}`).toBe(404);
      expect(r.json.error).toEqual({ code: "NOT_FOUND", message: "Route was not found." });
    }
    expect(s.opened()).toBe(0);
    expect(existsSync(join(s.root, ".lock"))).toBe(false);
    const cap = await call(s.base, "GET", "/capabilities");
    expect(cap.json.VINA_COMPARATOR_PREVIEW).toMatchObject({ available: false, capability: "UNAVAILABLE", implementation: "IMPLEMENTED_UNVERIFIED", validation: "NOT_EVALUATED" });
    expect(cap.json.VINA_COMPARATOR_PREVIEW.unavailableReason).toMatch(/FEATURE_DOCKING_RUN=1/);
    expect(cap.json["DOCKING.RUN"].state).toBe("UNAVAILABLE");
  });

  it("flag on: the capability is EXPERIMENTAL and DOCKING.RUN stays UNAVAILABLE", async () => {
    const s = await setup();
    const cap = await call(s.base, "GET", "/capabilities");
    expect(cap.json.VINA_COMPARATOR_PREVIEW).toMatchObject({ available: true, capability: "EXPERIMENTAL", resultLabel: "PREVIEW_UNQUALIFIED", notice: DOCKING_PREVIEW_NOTICE });
    expect(cap.json["DOCKING.RUN"].state).toBe("UNAVAILABLE");
  });

  it("answers 429 QUEUE_FULL when the queue is full", async () => {
    const s = await setup({ engine: fakeEngine({ holdMs: 60_000 }) as Fake, maxQueue: 1 });
    const a = await call(s.base, "POST", "/jobs", dockRequest(s.ids));
    await waitStatus(s, a.json.jobId, "RUNNING");
    expect((await call(s.base, "POST", "/jobs", dockRequest(s.ids, { seed: 2 }))).status).toBe(202);
    const full = await call(s.base, "POST", "/jobs", dockRequest(s.ids, { seed: 3 }));
    expect(full.status).toBe(429);
    expect(full.json.error.code).toBe("QUEUE_FULL");
    for (const j of (await call(s.base, "GET", "/jobs")).json.jobs as Json[]) await call(s.base, "POST", `/jobs/${j.jobId}/cancel`);
  }, 30_000);
});
