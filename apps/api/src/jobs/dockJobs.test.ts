import { afterEach, describe, expect, it } from "vitest";
import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PrepJobStateV1 } from "@molecular/contracts";
import { createPrepResolver, DOCK_TRANSITIONS, DockJobError, DockJobStore } from "./dockJobs.js";
import { createMoleDockRunner, type DockEngine } from "./dockRunner.js";
import { PrepJobStore } from "./prepJobs.js";
// @ts-expect-error: plain .mjs test support (no types)
import { fakeEngine, PIN } from "./dockCrash.fixture.mjs";

// Task 5.4: docking job store + runner. Real tests/fixtures PDBQTs; the fake engine spawns a real node process.
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const fx = join(repo, "tests", "fixtures");
const REC = readFileSync(join(fx, "multitype-receptor.pdbqt"));
const LIG = readFileSync(join(fx, "dock", "1STP-BTN-ligand.pdbqt"));
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
type Fake = DockEngine & { calls: { dock: number } };
const mkFake = (o: Record<string, unknown> = {}) => fakeEngine(o) as Fake;

const temps: string[] = [];
const stores: DockJobStore[] = [];
const orphans: number[] = [];
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  temps.push(d);
  return d;
};
afterEach(async () => {
  for (const s of stores.splice(0)) await s.close().catch(() => undefined);
  for (const pid of orphans.splice(0)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone (expected)
    }
  }
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A prep job dir as PrepJobStore persists it (SUCCEEDED + manifest + seal); returns the prepared ids. */
const seedPrepJob = (prepRoot: string, seal: "SEALED" | "PREVIEW_UNQUALIFIED" | "BLOCKED", jobId: string) => {
  const dir = join(prepRoot, jobId);
  mkdirSync(join(dir, "out"), { recursive: true });
  writeFileSync(join(dir, "out", "receptor.pdbqt"), REC);
  writeFileSync(join(dir, "out", "ligand.pdbqt"), LIG);
  const compact = jobId.replace(/-/g, "");
  const t = new Date().toISOString();
  const state: PrepJobStateV1 = {
    schemaVersion: 1,
    jobId,
    state: "SUCCEEDED",
    manifest: {
      schemaVersion: 1,
      jobId,
      status: "PREPARED",
      stages: [],
      outputs: [
        { role: "RECEPTOR_PDBQT", relPath: "out/receptor.pdbqt", sha256: sha(REC), bytes: REC.length },
        { role: "LIGAND_PDBQT", relPath: "out/ligand.pdbqt", sha256: sha(LIG), bytes: LIG.length },
      ],
      diagnostics: [],
    },
    seal: { status: seal, qualification: seal === "SEALED" ? "INTERIM" : "PREVIEW_UNQUALIFIED", reasonCodes: [], verifiedOutputs: 2 },
    ...(seal === "SEALED" ? { preparedReceptorId: `prec_${compact}`, preparedLigandId: `plig_${compact}` } : {}),
    createdAt: t,
    expiresAt: t,
    updatedAt: t,
  };
  writeFileSync(join(dir, "state.json"), JSON.stringify(state));
  return { receptorPreparedId: `prec_${compact}`, ligandPreparedId: `plig_${compact}` };
};

const SEALED_ID = "11111111-2222-4333-8444-555555555555";
const PREVIEW_ID = "21111111-2222-4333-8444-555555555555";
const BLOCKED_ID = "31111111-2222-4333-8444-555555555555";
const setup = async (o: { engine?: Fake; maxQueue?: number; maxJobs?: number; now?: () => number; root?: string; prepRoot?: string } = {}) => {
  const prepRoot = o.prepRoot ?? tmp("dockprep-");
  const ids = seedPrepJob(prepRoot, "SEALED", SEALED_ID);
  const preview = seedPrepJob(prepRoot, "PREVIEW_UNQUALIFIED", PREVIEW_ID);
  const blocked = seedPrepJob(prepRoot, "BLOCKED", BLOCKED_ID);
  const prep = new PrepJobStore({ root: prepRoot, resolveArtifact: async () => undefined, installedTools: async () => [] });
  prep.init();
  const engine = o.engine ?? mkFake({ holdMs: 200 });
  const root = o.root ?? tmp("dockjobs-");
  const store = new DockJobStore({ root, resolvePrepared: createPrepResolver(prep), runner: createMoleDockRunner({ engine }), ...(o.maxQueue ? { maxQueue: o.maxQueue } : {}), ...(o.maxJobs ? { maxJobs: o.maxJobs } : {}), ...(o.now ? { now: o.now } : {}) });
  await store.init();
  stores.push(store);
  return { store, engine, ids, preview, blocked, root, prepRoot };
};
const req = (ids: { receptorPreparedId: string; ligandPreparedId: string }, extra: Record<string, unknown> = {}) => ({ ...ids, boxCenter: [11.4, 2.4, -11.4], boxSize: [22, 22, 22], exhaustiveness: 1, numPoses: 3, seed: 42, ...extra });
const waitFor = async (pred: () => boolean, ms = 10_000) => {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 20));
  }
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== "ESRCH";
  }
};
const pidOf = (store: DockJobStore, id: string) => Number(readFileSync(join(store.jobDir(id), "pid"), "utf8").trim());
const expectCode = async (p: Promise<unknown> | (() => unknown), code: string, status: number) => {
  try {
    await (typeof p === "function" ? p() : p);
  } catch (e) {
    expect(e).toBeInstanceOf(DockJobError);
    expect((e as DockJobError).code).toBe(code);
    expect((e as DockJobError).httpStatus).toBe(status);
    expect((e as Error).message).not.toMatch(/[A-Za-z]:[\\/]|\/(?:mnt|home|tmp|Users)\//);
    return;
  }
  throw new Error(`expected ${code}`);
};

describe("dock job store (5.4)", () => {
  it("runs a job to SUCCEEDED with a PREVIEW_UNQUALIFIED result, meScore null and full provenance", async () => {
    const { store, ids } = await setup();
    const { job, deduped } = await store.submit(req(ids));
    expect(deduped).toBe(false);
    await waitFor(() => store.get(job.jobId).status === "SUCCEEDED");
    const r = store.result(job.jobId);
    expect(r).toMatchObject({ label: "PREVIEW_UNQUALIFIED", meScore: null, jobId: job.jobId, inputDigest: job.inputDigest });
    expect(r.poses.every((p) => p.meScore === null)).toBe(true);
    expect(r.provenance).toMatchObject({ receptorSha256: sha(REC), ligandSha256: sha(LIG), seed: 42, prepSealStatus: "SEALED", prepQualification: "INTERIM", vinaPin: { sha256: PIN, version: "1.2.7" }, vina: { binarySha256: PIN } });
    const evs = store.events(job.jobId);
    expect(evs.filter((e) => e.type === "status").map((e) => (e as { status: string }).status)).toEqual(["QUEUED", "PREPARING", "RUNNING", "SUCCEEDED"]);
    expect(evs.filter((e) => e.type === "progress").map((e) => (e as { progress: number }).progress)).toEqual([0.05, 0.1, 1]);
    expect(evs.map((e) => e.seq)).toEqual(evs.map((_e, i) => i + 1));
    expect(store.get(job.jobId).seq).toBe(evs.length);
  });

  it("cancel while RUNNING: CANCELLED and the engine process is gone within 2 s", async () => {
    const { store, ids } = await setup({ engine: mkFake({ holdMs: 60_000 }) });
    const { job } = await store.submit(req(ids));
    await waitFor(() => store.get(job.jobId).status === "RUNNING" && existsSync(join(store.jobDir(job.jobId), "pid")) && readFileSync(join(store.jobDir(job.jobId), "pid"), "utf8").trim() !== "");
    const pid = pidOf(store, job.jobId);
    expect(alive(pid)).toBe(true);
    const t0 = Date.now();
    const s = store.cancel(job.jobId);
    expect(s).toMatchObject({ status: "CANCELLED", cancelRequested: true });
    await waitFor(() => !alive(pid), 2000);
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(2000);
    expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    await store.idle();
    expect(store.get(job.jobId).status).toBe("CANCELLED");
    await expectCode(() => store.result(job.jobId), "RESULT_UNAVAILABLE", 409);
    console.log(`[5.4] cancel-to-dead: ${ms} ms`);
  });

  it("cancel QUEUED is immediate and idempotent; cancel of a terminal job is 409; late exit 0 is discarded", async () => {
    const engine = mkFake({ holdMs: 400, ignoreSignal: true, noKill: true });
    const { store, ids } = await setup({ engine });
    const a = (await store.submit(req(ids))).job;
    const b = (await store.submit(req(ids, { seed: 7 }))).job;
    expect(store.cancel(b.jobId).status).toBe("CANCELLED");
    expect(store.cancel(b.jobId).status).toBe("CANCELLED");
    await waitFor(() => store.get(a.jobId).status === "RUNNING");
    store.cancel(a.jobId); // the fake ignores the signal and exits 0 later
    await store.idle();
    await new Promise((r) => setTimeout(r, 600));
    expect(store.get(a.jobId).status).toBe("CANCELLED");
    expect(existsSync(join(store.jobDir(a.jobId), "out", "job-result.json"))).toBe(false);
    expect(engine.calls.dock).toBe(1); // b never ran
    const c = (await store.submit(req(ids, { seed: 9 }))).job;
    await waitFor(() => store.get(c.jobId).status === "SUCCEEDED");
    await expectCode(() => store.cancel(c.jobId), "ALREADY_TERMINAL", 409);
  });

  it("two identical concurrent submits make one job, one dir and one engine call; other inputs make new jobs", async () => {
    const engine = mkFake({ holdMs: 300 });
    const { store, ids, root } = await setup({ engine });
    const [x, y] = await Promise.all([store.submit(req(ids)), store.submit(req(ids))]);
    expect(x.job.jobId).toBe(y.job.jobId);
    expect([x.deduped, y.deduped].sort()).toEqual([false, true]);
    expect(readdirSync(root).filter((n) => !n.startsWith("."))).toHaveLength(1);
    await waitFor(() => store.get(x.job.jobId).status === "SUCCEEDED");
    expect((await store.submit(req(ids))).deduped).toBe(true); // SUCCEEDED is reused
    expect(engine.calls.dock).toBe(1);
    const other = await store.submit(req(ids, { boxSize: [20, 22, 22] }));
    expect(other.deduped).toBe(false);
    expect(other.job.inputDigest).not.toBe(x.job.inputDigest);
    store.cancel(other.job.jobId);
    await store.idle();
    const again = await store.submit(req(ids, { boxSize: [20, 22, 22] }));
    expect(again.deduped).toBe(false);
    expect(again.job.jobId).not.toBe(other.job.jobId);
  });

  it("killing the API mid-job then restarting: FAILED API_RESTARTED, child dead, QUEUED resumes, seq monotonic, stale lock taken", async () => {
    const root = tmp("dockcrash-");
    const prepRoot = tmp("dockprep-");
    const ids = seedPrepJob(prepRoot, "SEALED", SEALED_ID);
    const cfgPath = join(root, "..", `${root.split(/[\\/]/).pop()}-cfg.json`);
    temps.push(cfgPath);
    writeFileSync(cfgPath, JSON.stringify({ root: join(root, "jobs"), prepRoot, requests: [req(ids), req(ids, { seed: 5 })] }));
    const tsx = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
    const child = fork(join(here, "dockCrash.fixture.mjs"), ["harness", cfgPath], { execArgv: ["--import", tsx], stdio: "inherit" });
    const msg = await new Promise<{ jobs: string[]; childPid: number }>((ok, fail) => {
      const t = setTimeout(() => fail(new Error("harness did not reach RUNNING")), 60_000);
      child.once("message", (m) => {
        clearTimeout(t);
        ok(m as { jobs: string[]; childPid: number });
      });
      child.once("exit", (c) => fail(new Error(`harness exited ${c}`)));
    });
    orphans.push(msg.childPid);
    child.kill("SIGKILL");
    await new Promise((r) => child.once("exit", r));
    expect(alive(msg.childPid)).toBe(true); // orphaned engine process
    expect(existsSync(join(root, "jobs", ".lock"))).toBe(true); // stale lock left behind
    const [a, b] = msg.jobs;
    const seqBefore = readFileSync(join(root, "jobs", a!, "events.ndjson"), "utf8").trim().split("\n").length;
    const { store } = await setup({ root: join(root, "jobs"), prepRoot, engine: mkFake({ holdMs: 100 }) });
    expect(JSON.parse(readFileSync(join(root, "jobs", ".lock"), "utf8"))).toMatchObject({ pid: process.pid, bootId: store.bootId });
    const sa = store.get(a!);
    expect(sa).toMatchObject({ status: "FAILED", error: { code: "API_RESTARTED" }, bootId: store.bootId });
    await waitFor(() => !alive(msg.childPid), 5000);
    await waitFor(() => store.get(b!).status === "SUCCEEDED", 15_000);
    const evs = store.events(a!);
    expect(evs.map((e) => e.seq)).toEqual(evs.map((_e, i) => i + 1));
    expect(evs.length).toBeGreaterThan(seqBefore);
    expect(evs.at(-1)).toMatchObject({ type: "error" });
    expect(store.result(b!).label).toBe("PREVIEW_UNQUALIFIED");
  }, 90_000);

  it("rejects bad input: BLOCKED, traversal and unknown ids, seed 0, box edge 41; PREVIEW_UNQUALIFIED prep is accepted", async () => {
    const { store, ids, preview, blocked } = await setup();
    await expectCode(store.submit(req(blocked)), "BAD_INPUT", 400);
    await expectCode(store.submit(req({ receptorPreparedId: "../x", ligandPreparedId: ids.ligandPreparedId })), "BAD_INPUT", 400);
    await expectCode(store.submit(req({ receptorPreparedId: "prec_" + "9".repeat(32), ligandPreparedId: "plig_" + "9".repeat(32) })), "NOT_FOUND", 404);
    await expectCode(store.submit(req({ receptorPreparedId: "prep-rec-1", ligandPreparedId: "prep-lig-1" })), "BAD_INPUT", 400);
    await expectCode(store.submit(req(ids, { seed: 0 })), "BAD_INPUT", 400);
    await expectCode(store.submit(req(ids, { boxSize: [41, 20, 20] })), "BAD_INPUT", 400);
    await expectCode(store.submit({ ...req(ids), sha256: PIN }), "BAD_INPUT", 400);
    await expectCode(() => store.get("../../etc"), "NOT_FOUND", 404);
    const p = await store.submit(req(preview));
    expect(p.job.provenance).toMatchObject({ prepSealStatus: "PREVIEW_UNQUALIFIED", prepQualification: "PREVIEW_UNQUALIFIED" });
  });

  it("rejects a prepared output whose bytes no longer match the manifest", async () => {
    const { store, ids, prepRoot } = await setup();
    appendFileSync(join(prepRoot, SEALED_ID, "out", "ligand.pdbqt"), "REMARK tampered\n");
    await expectCode(store.submit(req(ids)), "BAD_INPUT", 400);
  });

  it("transition table: illegal moves are 409; terminal states have no outgoing moves", async () => {
    for (const t of ["SUCCEEDED", "FAILED", "CANCELLED"] as const) expect(DOCK_TRANSITIONS[t]).toEqual([]);
    const { store, ids } = await setup({ engine: mkFake({ holdMs: 60_000 }) });
    const a = (await store.submit(req(ids))).job;
    const b = (await store.submit(req(ids, { seed: 3 }))).job;
    await expectCode(() => store.move(b.jobId, "SUCCEEDED"), "ILLEGAL_TRANSITION", 409);
    await expectCode(() => store.move(b.jobId, "RUNNING"), "ILLEGAL_TRANSITION", 409);
    store.cancel(b.jobId);
    await expectCode(() => store.move(b.jobId, "QUEUED"), "ALREADY_TERMINAL", 409);
    store.cancel(a.jobId);
    await store.idle();
  });

  it("queue full is 429 QUEUE_FULL; quota and gc spare live jobs", async () => {
    let now = Date.now();
    const { store, ids } = await setup({ engine: mkFake({ holdMs: 60_000 }), maxQueue: 1, maxJobs: 3, now: () => now });
    const running = (await store.submit(req(ids))).job;
    await waitFor(() => store.get(running.jobId).status === "RUNNING");
    const queued = (await store.submit(req(ids, { seed: 2 }))).job;
    await expectCode(store.submit(req(ids, { seed: 3 })), "QUEUE_FULL", 429);
    store.cancel(queued.jobId);
    const third = (await store.submit(req(ids, { seed: 3 }))).job; // 3 jobs: running, cancelled, queued
    await expectCode(store.submit(req(ids, { seed: 4 })), "QUEUE_FULL", 429);
    store.cancel(third.jobId);
    // over quota: the oldest terminal job goes, live ones stay
    const fourth = (await store.submit(req(ids, { seed: 4 }))).job;
    expect(() => store.get(queued.jobId)).toThrow();
    expect(store.get(running.jobId).status).toBe("RUNNING");
    expect(store.get(fourth.jobId).status).toBe("QUEUED");
    now += 2 * 60 * 60_000; // past FAILED/CANCELLED retention
    store.gc();
    expect(() => store.get(third.jobId)).toThrow();
    expect(store.get(running.jobId).status).toBe("RUNNING");
    expect(store.get(fourth.jobId).status).toBe("QUEUED");
    store.cancel(fourth.jobId);
    store.cancel(running.jobId);
    await store.idle();
  });

  it("event replay from afterSeq drops a torn last line; subscribe replays then attaches with no gap", async () => {
    const { store, ids, root, prepRoot, engine } = await setup({ engine: mkFake({ holdMs: 60_000 }) });
    const a = (await store.submit(req(ids))).job;
    const b = (await store.submit(req(ids, { seed: 8 }))).job;
    const seen: number[] = [];
    const unsub = store.subscribe(b.jobId, 0, (e) => seen.push(e.seq));
    expect(seen).toEqual([1]);
    store.cancel(b.jobId);
    expect(seen).toEqual([1, 2, 3]);
    unsub();
    appendFileSync(join(store.jobDir(b.jobId), "events.ndjson"), '{"jobId":"torn","seq":4,"ty');
    expect(store.events(b.jobId, 1).map((e) => e.seq)).toEqual([2, 3]);
    store.cancel(a.jobId);
    await store.idle();
    await store.close();
    // restart: the torn tail is repaired and seq continues from the last good line
    const corruptId = "41111111-2222-4333-8444-555555555555";
    mkdirSync(join(root, corruptId));
    writeFileSync(join(root, corruptId, "state.json"), "{not json");
    const prep = new PrepJobStore({ root: prepRoot, resolveArtifact: async () => undefined, installedTools: async () => [] });
    prep.init();
    const reborn = new DockJobStore({ root, resolvePrepared: createPrepResolver(prep), runner: createMoleDockRunner({ engine }) });
    await reborn.init();
    stores.push(reborn);
    expect(reborn.list().map((s) => s.jobId).sort()).toEqual([a.jobId, b.jobId].sort());
    expect(existsSync(join(root, `.corrupt-${corruptId}`))).toBe(true);
    expect(readFileSync(join(reborn.jobDir(b.jobId), "events.ndjson"), "utf8").endsWith("\n")).toBe(true);
    expect(reborn.get(b.jobId).seq).toBe(3);
  });

  it("engine failures are FAILED ENGINE with no absolute paths in the error", async () => {
    const { store, ids, root } = await setup({ engine: mkFake({ failWith: "boom" }) });
    const { job } = await store.submit(req(ids));
    await waitFor(() => store.get(job.jobId).status === "FAILED");
    const s = store.get(job.jobId);
    expect(s.error?.code).toBe("ENGINE");
    expect(s.error?.message).toContain("VINA_FAILED");
    expect(JSON.stringify(s)).not.toContain(root);
    expect(JSON.stringify(store.events(job.jobId))).not.toMatch(/[A-Za-z]:[\\/]/);
  });

  it("a second store on the same root while the first is open is LOCKED", async () => {
    const { root, prepRoot } = await setup();
    const prep = new PrepJobStore({ root: prepRoot, resolveArtifact: async () => undefined, installedTools: async () => [] });
    const other = new DockJobStore({ root, resolvePrepared: createPrepResolver(prep), runner: createMoleDockRunner({ engine: mkFake() }) });
    await expectCode(other.init(), "LOCKED", 503);
  });

  it("an invalid Vina pin is 503 ENGINE_PIN_MISMATCH and nothing is queued", async () => {
    const bad = { ...mkFake(), pin: async () => ({ sha256: "nope", version: "1.2.7" }) } as Fake;
    const { store, ids, root } = await setup({ engine: bad });
    await expectCode(store.submit(req(ids)), "ENGINE_PIN_MISMATCH", 503);
    expect(readdirSync(root).filter((n) => !n.startsWith("."))).toHaveLength(0);
  });
});
