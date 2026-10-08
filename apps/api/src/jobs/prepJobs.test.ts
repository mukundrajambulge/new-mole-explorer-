import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrepJobStateV1Schema } from "@molecular/contracts";
import { createPrepRoutes } from "../docking/routes.js";
import { confinedPath, PrepJobStore, type PrepArtifactResolver, type PrepRunner } from "./prepJobs.js";
import { checkPrepPins, readPinFiles, REPO_ROOT, repoPrepPins } from "./prepPins.js";
import { prepSummarySealer, sealFromPrepManifest } from "./prepSeal.js";

// Task 5.2b: job store, routes and sealing. The worker itself is replaced by a runner that replays a real
// worker output (fixtures/prep-1crn-ethanol: 1CRN + ethanol.sdf, produced by workers/prep through
// tools/mole-dock/prep.mjs in WSL). Science inputs are the real files in tests/fixtures.
const here = dirname(fileURLToPath(import.meta.url));
const FX = join(here, "fixtures", "prep-1crn-ethanol");
const TESTS_FX = resolve(REPO_ROOT, "tests", "fixtures");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;

const resolver: PrepArtifactResolver = async (id) => {
  if (id === "r1crn") return { format: "pdb", bytes: readFileSync(join(TESTS_FX, "rcsb", "1CRN.pdb")) };
  if (id === "lethanol") return { format: "sdf", bytes: readFileSync(join(TESTS_FX, "ethanol.sdf")) };
  if (id === "hugeReceptor") return { format: "pdb", bytes: Buffer.alloc(20 * 1024 * 1024 + 1, 0x41) };
  return undefined;
};

type Tamper = (dir: string) => void;
/** Replays the real worker output into the job dir, rebinding jobId/planDigest like the worker would. */
const replayRunner = (tamper?: Tamper): PrepRunner => async (mode, dir) => {
  const job = readJson(join(dir, "job.json"));
  if (mode === "plan") {
    const plan = { ...readJson(join(FX, "plan.json")), jobId: job.jobId, receptorArtifactId: (job.receptor as { artifactId: string }).artifactId, ligandArtifactId: (job.ligand as { artifactId: string }).artifactId };
    writeFileSync(join(dir, "plan.json"), JSON.stringify(plan));
    return { status: "OK", stderr: "" };
  }
  const conf = readJson(join(dir, "confirmation.json"));
  const plan = readJson(join(dir, "plan.json"));
  if (conf.planDigest !== plan.planDigest) return { status: "BLOCKED", stderr: "" };
  cpSync(join(FX, "out"), join(dir, "out"), { recursive: true });
  writeFileSync(join(dir, "prep-manifest.json"), JSON.stringify({ ...readJson(join(FX, "prep-manifest.json")), jobId: job.jobId, planDigest: plan.planDigest }));
  tamper?.(dir);
  return { status: "OK", stderr: "" };
};

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise((r) => s.close(r));
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const makeStore = (opts: { runner?: PrepRunner; now?: () => number; pins?: typeof repoPrepPins } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "prepjobs-"));
  roots.push(root);
  const store = new PrepJobStore({ root, resolveArtifact: resolver, runner: opts.runner ?? replayRunner(), sealer: prepSummarySealer, ...(opts.now ? { now: opts.now } : {}), ...(opts.pins ? { pins: opts.pins } : {}) });
  store.init();
  return store;
};

const serve = async (store: PrepJobStore) => {
  const routes = createPrepRoutes({ store });
  const server = createServer((req, res) => {
    void routes(req, res, new URL(req.url ?? "/", "http://x").pathname).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/docking/prep`;
  const call = async (method: string, path: string, body?: unknown, raw?: string) => {
    const r = await fetch(base + path, { method, headers: { "content-type": "application/json" }, ...(body !== undefined || raw !== undefined ? { body: raw ?? JSON.stringify(body) } : {}) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test JSON is checked by assertions
    return { status: r.status, json: (await r.json()) as Record<string, any> };
  };
  return call;
};

const PLAN_BODY = { receptorArtifactId: "r1crn", ligandArtifactId: "lethanol", pH: 7.4 };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test JSON is checked by assertions
const acksOf = (state: Record<string, any>) => (state.plan.decisions as { key: string; requiresAck: boolean }[]).filter((d) => d.requiresAck).map((d) => d.key);

describe("prep job store and routes (5.2b)", () => {
  it("plans, rejects forged/stale digests with 409, confirms once and seals from real worker output", async () => {
    const store = makeStore();
    const call = await serve(store);
    const a = await call("POST", "/plan", PLAN_BODY);
    expect(a.status).toBe(201);
    expect(PrepJobStateV1Schema.parse(a.json).state).toBe("AWAITING_CONFIRMATION");
    const b = await call("POST", "/plan", PLAN_BODY);
    const id = a.json.jobId as string;
    const acks = acksOf(a.json);
    const forged = await call("POST", `/${id}/confirm`, { jobId: id, planDigest: "0".repeat(64), acks });
    expect(forged.status).toBe(409);
    expect(forged.json.error.code).toBe("PLAN_DIGEST_MISMATCH");
    // Stale: a digest that belongs to another job's plan record is not accepted for this one.
    const staleState = { ...b.json.plan, planDigest: "1".repeat(64) };
    const stale = await call("POST", `/${id}/confirm`, { jobId: id, planDigest: staleState.planDigest, acks });
    expect(stale.status).toBe(409);
    const ok = await call("POST", `/${id}/confirm`, { jobId: id, planDigest: a.json.plan.planDigest, acks });
    expect(ok.status).toBe(202);
    expect(ok.json.state).toBe("APPLYING");
    const reused = await call("POST", `/${id}/confirm`, { jobId: id, planDigest: a.json.plan.planDigest, acks });
    expect(reused.status).toBe(409);
    expect(["ALREADY_CONFIRMED", "BUSY"]).toContain(reused.json.error.code);
    await new Promise((r) => setTimeout(r, 50));
    let final = store.get(id);
    for (let i = 0; i < 100 && final.state === "APPLYING"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      final = store.get(id);
    }
    expect(final.state, final.error).toBe("SUCCEEDED");
    expect(final.seal?.verifiedOutputs).toBe(6);
    // Real fixture: Meeko template hydrogens make it PREVIEW_UNQUALIFIED; missing D2 evidence keeps it BLOCKED.
    expect(final.seal?.qualification).toBe("PREVIEW_UNQUALIFIED");
    expect(final.seal?.status).toBe("BLOCKED");
    expect(final.seal?.reasonCodes).toEqual(expect.arrayContaining(["D2_PROFILE_DIGEST_UNAVAILABLE", "GENERATED_CHEMICAL_STATE"]));
    expect(final.seal?.components?.ligand.status).toBe("PREVIEW_UNQUALIFIED");
    // Unsealed outputs never get prepared ids.
    expect(final.preparedReceptorId).toBeUndefined();
    expect(final.preparedLigandId).toBeUndefined();
    const again = await call("POST", `/${id}/confirm`, { jobId: id, planDigest: a.json.plan.planDigest, acks });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("ALREADY_CONFIRMED");
    const got = await call("GET", `/${id}`);
    expect(got.status).toBe(200);
    expect(got.json.state).toBe("SUCCEEDED");

    // sealFromPrepManifest maps the real outputs through the D2 adapter deterministically.
    const s1 = await sealFromPrepManifest(store, id);
    const s2 = await sealFromPrepManifest(store, id);
    expect(s1.ligand).toMatchObject({ atoms: 9, bonds: 8 });
    expect(s1.ligandState).toBeUndefined();
    expect(s1.ligand?.graphDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(s1.receptor?.atoms).toBeGreaterThan(300);
    expect(s2).toEqual(s1);

    // Tampered output after sealing: rejected on re-seal.
    writeFileSync(join(store.jobDir(id), "out", "ligand.pdbqt"), "REMARK tampered\n");
    const t = await sealFromPrepManifest(store, id);
    expect(t.status).toBe("REJECTED");
    expect(t.reasonCodes).toContain("OUTPUT_TAMPERED");
  }, 60_000);

  it("rejects a tampered manifest and outputs written by the worker", async () => {
    const store = makeStore({ runner: replayRunner((dir) => writeFileSync(join(dir, "out", "receptor.pdbqt"), "tampered\n")) });
    const p = await store.plan(PLAN_BODY as never);
    const { done } = store.confirm(p.jobId, { jobId: p.jobId, planDigest: p.plan!.planDigest, acks: acksOf(p as never) });
    const f = await done;
    expect(f.state).toBe("FAILED");
    expect(f.error).toContain("OUTPUT_REJECTED");
    expect(f.seal?.reasonCodes).toContain("OUTPUT_TAMPERED");

    const store2 = makeStore();
    const p2 = await store2.plan(PLAN_BODY as never);
    const ok = await store2.confirm(p2.jobId, { jobId: p2.jobId, planDigest: p2.plan!.planDigest, acks: acksOf(p2 as never) }).done;
    expect(ok.state).toBe("SUCCEEDED");
    const mp = join(store2.jobDir(p2.jobId), "prep-manifest.json");
    const m = readJson(mp) as { outputs: { sha256: string }[] };
    m.outputs[0]!.sha256 = "f".repeat(64);
    writeFileSync(mp, JSON.stringify(m));
    const r = await sealFromPrepManifest(store2, p2.jobId);
    expect(r.status).toBe("REJECTED");
    expect(r.reasonCodes).toContain("MANIFEST_TAMPERED");
  }, 60_000);

  it("rejects traversal, oversize bodies and artifacts, and client sha256 values", async () => {
    const store = makeStore();
    const call = await serve(store);
    expect((await call("POST", "/plan", { ...PLAN_BODY, receptorArtifactId: "../../etc/passwd" })).status).toBe(400);
    expect((await call("GET", "/..%2F..%2Fstate.json")).status).toBe(400);
    expect((await call("GET", "/not-a-uuid")).status).toBe(400);
    expect(() => confinedPath(store.root, "../escape")).toThrow();
    expect(() => confinedPath(store.root, "out/../../x")).toThrow();
    expect(() => confinedPath(store.root, "C:/x")).toThrow();
    const big = await call("POST", "/plan", undefined, JSON.stringify({ ...PLAN_BODY, pad: "x".repeat(70 * 1024) }));
    expect(big.status).toBe(413);
    const huge = await call("POST", "/plan", { ...PLAN_BODY, receptorArtifactId: "hugeReceptor" });
    expect(huge.status).toBe(413);
    expect(huge.json.error.code).toBe("OVERSIZE_INPUT");
    const sha = await call("POST", "/plan", { ...PLAN_BODY, sha256: "a".repeat(64) });
    expect(sha.status).toBe(400);
    expect(sha.json.error.code).toBe("SECURITY_REJECTION");
    const nested = await call("POST", "/plan", { ...PLAN_BODY, options: { profileDigest: "b".repeat(64) } });
    expect(nested.json.error.code).toBe("SECURITY_REJECTION");
    const missing = await call("POST", "/plan", { ...PLAN_BODY, ligandArtifactId: "nope" });
    expect(missing.status).toBe(404);
    for (const r of [big, huge, sha, missing]) expect(JSON.stringify(r.json)).not.toMatch(/[A-Za-z]:[\\/]|\/tmp\//);
  });

  it("timeout and crash end FAILED with scrubbed errors; restart fails in-flight jobs; TTL expires plans", async () => {
    const mod = (await import(pathToFileURL(join(REPO_ROOT, "tools", "mole-dock", "prep.mjs")).href)) as {
      runProcess(inv: object, o: { timeoutMs: number }): Promise<{ status: "OK" | "FAILED" | "TIMEOUT"; stderr: string }>;
    };
    const nodeRun = (script: string, timeoutMs: number): PrepRunner => async (mode, dir) => {
      if (mode === "plan") return replayRunner()(mode, dir);
      return mod.runProcess({ command: process.execPath, args: ["-e", script], options: { cwd: dir, shell: false, env: {} }, scrub: [dir] }, { timeoutMs });
    };
    const crash = makeStore({ runner: nodeRun(`process.stderr.write("boom at " + process.cwd()); process.exit(1)`, 20_000) });
    const p = await crash.plan(PLAN_BODY as never);
    const f = await crash.confirm(p.jobId, { jobId: p.jobId, planDigest: p.plan!.planDigest, acks: acksOf(p as never) }).done;
    expect(f.state).toBe("FAILED");
    expect(f.error).toContain("APPLY_FAILED: FAILED");
    expect(f.error).not.toContain(crash.root);
    const slow = makeStore({ runner: nodeRun("setTimeout(() => {}, 60000)", 500) });
    const p2 = await slow.plan(PLAN_BODY as never);
    const f2 = await slow.confirm(p2.jobId, { jobId: p2.jobId, planDigest: p2.plan!.planDigest, acks: acksOf(p2 as never) }).done;
    expect(f2.state).toBe("FAILED");
    expect(f2.error).toContain("TIMEOUT");

    // Restart: a job left APPLYING (and an uncommitted dir) become FAILED.
    let release: () => void = () => {};
    const hang: PrepRunner = async (mode, dir) => (mode === "plan" ? replayRunner()(mode, dir) : new Promise((r) => (release = () => r({ status: "FAILED", stderr: "" }))));
    const store = makeStore({ runner: hang });
    const p3 = await store.plan(PLAN_BODY as never);
    store.confirm(p3.jobId, { jobId: p3.jobId, planDigest: p3.plan!.planDigest, acks: acksOf(p3 as never) });
    expect(store.get(p3.jobId).state).toBe("APPLYING");
    const reborn = new PrepJobStore({ root: store.root, resolveArtifact: resolver, runner: replayRunner() });
    reborn.init();
    expect(reborn.get(p3.jobId).state).toBe("FAILED");
    expect(reborn.get(p3.jobId).error).toContain("INTERRUPTED");
    release();

    let t = Date.now();
    const ttl = makeStore({ now: () => t });
    const p4 = await ttl.plan(PLAN_BODY as never);
    t += 31 * 60_000;
    expect(ttl.get(p4.jobId).state).toBe("EXPIRED");
    expect(() => ttl.confirm(p4.jobId, { jobId: p4.jobId, planDigest: p4.plan!.planDigest, acks: [] })).toThrow(/can no longer be confirmed/);
  }, 60_000);

  it("allows one job at a time and fails closed on a pin mismatch", async () => {
    let release: () => void = () => {};
    const gate: PrepRunner = (mode, dir) => new Promise((r) => (release = () => void replayRunner()(mode, dir).then(r)));
    const store = makeStore({ runner: gate });
    const first = store.plan(PLAN_BODY as never);
    await expect(store.plan(PLAN_BODY as never)).rejects.toMatchObject({ code: "BUSY", httpStatus: 429 });
    release();
    expect((await first).state).toBe("AWAITING_CONFIRMATION");

    expect(repoPrepPins()).toMatchObject({ ok: true, mismatches: [] });
    const files = readPinFiles();
    expect(checkPrepPins({ ...files, lock: files.lock + "\nextra==1.0\n" }).mismatches).toContain("LOCK_DIGEST");
    expect(checkPrepPins({ ...files, wslSetup: files.wslSetup.replace(/f31f774f/g, "00000000") }).mismatches).toContain("VINA_SHA256");
    expect(checkPrepPins({ ...files, requirementsIn: files.requirementsIn.replace("meeko==0.8.0", "meeko==0.9.0") }).mismatches).toContain("PIN:meeko");
    const bad = makeStore({ pins: () => ({ ok: false, lockDigest: "", mismatches: ["LOCK_DIGEST"] }) });
    await expect(bad.plan(PLAN_BODY as never)).rejects.toMatchObject({ code: "PROVENANCE_REPLAY" });
    expect(existsSync(join(FX, "prep-manifest.json"))).toBe(true);
  });
});
