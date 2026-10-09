import { afterAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PrepJobStateV1 } from "@molecular/contracts";
import { createPrepResolver, DockJobStore } from "./dockJobs.js";
import { createMoleDockRunner, type DockEngine } from "./dockRunner.js";
import { PrepJobStore } from "./prepJobs.js";

// Task 5.4 real kill path inside WSL (gated: MOLE_DOCK_E2E=1 on Windows with Ubuntu-24.04). A long-running Linux
// process (/bin/sleep 600) is launched exactly like Vina (buildEngineInvocation + PIDFILE_WRAPPER + runProcess),
// then killed through killEngineGroup, through the stdin-EOF watcher alone, and through DockJobStore.cancel. Every
// check is made inside WSL with pgrep. The real-Vina smoke runs only when ~/mole-tools/vina exists.
const E2E = process.env.MOLE_DOCK_E2E === "1" && process.platform === "win32";
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const fx = join(repo, "tests", "fixtures");
const DISTRO = "Ubuntu-24.04";
const env = { SystemRoot: process.env.SystemRoot || "C:\\Windows", WSLENV: "" };
type RunMod = {
  buildEngineInvocation(o: { program: string; args: string[]; cwd: string; timeoutMs: number; platform: string; pidfile?: string }): unknown;
  killEngineGroup(o: { pidfile: string; cwd: string; platform?: string; waitMs?: number }): Promise<{ killed: boolean; gone: boolean; pgid?: number; reason?: string }>;
  readPidfile(p: string): number | null;
  createVinaEngine(): DockEngine;
};
type PrepMod = { runProcess(inv: unknown, o: { timeoutMs: number; signal?: AbortSignal; platform?: string }): Promise<{ status: string; exitCode: number | null }> };
const load = async () => {
  const run = (await import(pathToFileURL(join(repo, "tools", "mole-dock", "run.mjs")).href)) as RunMod;
  const prep = (await import(pathToFileURL(join(repo, "tools", "mole-dock", "prep.mjs")).href)) as PrepMod;
  return { run, prep };
};

/** One bounded WSL shell call (positional args, no interpolation). */
const wslSh = (script: string, args: string[] = [], timeoutMs = 20_000) =>
  new Promise<{ code: number; out: string }>((ok) => {
    execFile("wsl.exe", ["-d", DISTRO, "--exec", "/bin/sh", "-c", script, "sh", ...args], { env, timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      ok({ code: err ? (typeof (err as { code?: unknown }).code === "number" ? ((err as { code: number }).code) : 99) : 0, out: String(stdout) });
    });
  });
const groupMembers = async (pgid: number) => (await wslSh('/usr/bin/pgrep -g "$1" -a || true', [String(pgid)])).out.trim();
/** Starts inside WSL before the kill; resolves (Date.now()) when the group is empty, polled every 20 ms in WSL. */
const waitGroupGone = (pgid: number, maxS = 10) =>
  wslSh('i=0; while /usr/bin/pgrep -g "$1" >/dev/null; do i=$((i+1)); [ "$i" -gt "$2" ] && exit 7; /bin/sleep 0.02; done; exit 0', [String(pgid), String(maxS * 50)], (maxS + 15) * 1000).then((r) => ({ ...r, at: Date.now() }));
const waitFor = async (pred: () => boolean, ms: number) => {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 25));
  }
};

const temps: string[] = [];
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  temps.push(d);
  return d;
};
afterAll(async () => {
  if (E2E) await wslSh('/usr/bin/pkill -KILL -f "^/bin/sleep 600$" ; /usr/bin/pkill -KILL -f "mole-dock-e2e" ; true');
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

/** Launch /bin/sleep 600 the way dock() launches Vina; returns the run promise and the pgid. */
const launchSleep = async (signal?: AbortSignal) => {
  const { run, prep } = await load();
  const outDir = join(tmp("dockwsl-"), "out");
  mkdirSync(outDir, { recursive: true });
  const pidfile = join(dirname(outDir), "pid");
  const inv = run.buildEngineInvocation({ program: "/bin/sleep", args: ["600"], cwd: outDir, timeoutMs: 600_000, platform: "win32", pidfile });
  const done = prep.runProcess(inv, { timeoutMs: 120_000, ...(signal ? { signal } : {}), platform: "win32" });
  await waitFor(() => run.readPidfile(pidfile) !== null, 30_000);
  const pgid = run.readPidfile(pidfile)!;
  return { outDir, pidfile, pgid, done, run };
};

describe.skipIf(!E2E)("real WSL kill path (5.4, MOLE_DOCK_E2E=1)", () => {
  it("killEngineGroup kills the wrapper's process group (sleep 600) and pgrep confirms it within 2 s", async () => {
    const { outDir, pidfile, pgid, done, run } = await launchSleep();
    expect(await groupMembers(pgid)).toContain("/bin/sleep 600");
    const other = tmp("dockwsl-other-");
    const miss = await run.killEngineGroup({ pidfile, cwd: other, platform: "win32", waitMs: 0 });
    expect(miss).toMatchObject({ killed: false, gone: false, reason: "CWD_MISMATCH" }); // guard: nothing killed
    expect(await groupMembers(pgid)).toContain("/bin/sleep 600");
    const t0 = Date.now();
    const rep = await run.killEngineGroup({ pidfile, cwd: outDir, platform: "win32", waitMs: 0 });
    const ms = Date.now() - t0;
    expect(rep).toMatchObject({ killed: true, gone: true, pgid });
    expect(await groupMembers(pgid)).toBe("");
    expect(ms).toBeLessThan(2000);
    await done;
    console.log(`[5.4 e2e] killEngineGroup -> group empty (pgrep) in ${ms} ms`);
  }, 90_000);

  it("the stdin watcher alone kills the group when wsl.exe is killed (abort without a pgid kill)", async () => {
    const ac = new AbortController();
    const { pgid, done } = await launchSleep(ac.signal);
    const gone = waitGroupGone(pgid);
    await new Promise((r) => setTimeout(r, 300)); // the WSL waiter is running
    const t0 = Date.now();
    ac.abort(); // runProcess taskkill /T /F on wsl.exe only
    const g = await gone;
    const ms = g.at - t0;
    expect(g.code).toBe(0);
    expect(await groupMembers(pgid)).toBe("");
    expect(ms).toBeLessThan(2000);
    await done;
    console.log(`[5.4 e2e] wsl.exe killed -> watcher emptied the group in <= ${ms} ms`);
  }, 90_000);

  it("DockJobStore.cancel on a RUNNING job with a real WSL engine group: gone within 2 s, next job waits", async () => {
    const { run, prep: prepMod } = await load();
    const PIN = "f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644";
    let docks = 0;
    const engine: DockEngine = {
      pin: async () => ({ sha256: PIN, version: "1.2.7" }),
      verify: async () => ({ vina: "/bin/sleep", binarySha256: PIN, versionLine: "AutoDock Vina v1.2.7" }),
      async dock(outDir, _job, _v, { signal, pidfile }) {
        docks++;
        const inv = run.buildEngineInvocation({ program: "/bin/sleep", args: ["600"], cwd: outDir, timeoutMs: 600_000, platform: "win32", ...(pidfile ? { pidfile } : {}) });
        const r = await prepMod.runProcess(inv, { timeoutMs: 120_000, ...(signal ? { signal } : {}), platform: "win32" });
        throw Object.assign(new Error(`sleep ${r.status}`), { exitCode: 3, code: "VINA_FAILED" });
      },
      killGroup: (pidfile, outDir) => run.killEngineGroup({ pidfile, cwd: outDir, platform: "win32" }),
    };
    const { store, ids } = await openStore(createMoleDockRunner({ engine }));
    const a = (await store.submit(dockReq(ids))).job;
    const b = (await store.submit(dockReq(ids, { seed: 2 }))).job;
    const pidfile = join(store.jobDir(a.jobId), "pid");
    await waitFor(() => store.get(a.jobId).status === "RUNNING" && run.readPidfile(pidfile) !== null, 30_000);
    const pgid = run.readPidfile(pidfile)!;
    expect(await groupMembers(pgid)).toContain("/bin/sleep 600");
    const gone = waitGroupGone(pgid);
    await new Promise((r) => setTimeout(r, 300));
    const t0 = Date.now();
    store.cancel(a.jobId);
    const g = await gone;
    const ms = g.at - t0;
    expect(g.code).toBe(0);
    expect(ms).toBeLessThan(2000);
    await waitFor(() => store.get(b.jobId).status !== "QUEUED", 30_000);
    expect(docks).toBe(2);
    store.cancel(b.jobId);
    await store.idle();
    await store.close();
    expect(store.events(a.jobId).some((e) => e.type === "log")).toBe(false); // kill confirmed, no diagnostic
    console.log(`[5.4 e2e] store.cancel -> WSL group empty in <= ${ms} ms`);
  }, 120_000);

  it("real Vina cancel smoke: no vina left in WSL (skipped when ~/mole-tools/vina is missing)", async () => {
    const has = await wslSh('[ -x "$HOME/mole-tools/vina" ]');
    if (has.code !== 0) {
      console.log("[5.4 e2e] ~/mole-tools/vina not installed; real Vina smoke skipped");
      return;
    }
    const { run } = await load();
    const { store, ids } = await openStore(createMoleDockRunner());
    const a = (await store.submit(dockReq(ids, { exhaustiveness: 64, boxSize: [40, 40, 40], numPoses: 9 }))).job;
    const pidfile = join(store.jobDir(a.jobId), "pid");
    await waitFor(() => store.get(a.jobId).status === "RUNNING" && run.readPidfile(pidfile) !== null, 60_000);
    const pgid = run.readPidfile(pidfile)!;
    const t1 = Date.now();
    while (!(await groupMembers(pgid)).includes("mole-tools/vina") && Date.now() - t1 < 15_000) await new Promise((r) => setTimeout(r, 200));
    expect(await groupMembers(pgid)).toContain("mole-tools/vina");
    const gone = waitGroupGone(pgid);
    await new Promise((r) => setTimeout(r, 300));
    const t0 = Date.now();
    store.cancel(a.jobId);
    const g = await gone;
    const ms = g.at - t0;
    expect(g.code).toBe(0);
    await store.idle();
    await store.close();
    const left = await wslSh("/usr/bin/pgrep -a -f '[m]ole-tools/vina' || true");
    expect(left.out.trim()).toBe("");
    expect(ms).toBeLessThan(2000);
    console.log(`[5.4 e2e] real Vina cancel -> group empty in <= ${ms} ms; pgrep vina: none`);
  }, 180_000);
});

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const PREP_ID = "51111111-2222-4333-8444-555555555555";
/** A SEALED prep job (real fixture PDBQTs) and a dock store on temp roots without spaces. */
const openStore = async (runner: ReturnType<typeof createMoleDockRunner>) => {
  const prepRoot = tmp("dockwsl-prep-");
  const rec = readFileSync(join(fx, "multitype-receptor.pdbqt"));
  const lig = readFileSync(join(fx, "dock", "1STP-BTN-ligand.pdbqt"));
  const dir = join(prepRoot, PREP_ID);
  mkdirSync(join(dir, "out"), { recursive: true });
  writeFileSync(join(dir, "out", "receptor.pdbqt"), rec);
  writeFileSync(join(dir, "out", "ligand.pdbqt"), lig);
  const c = PREP_ID.replace(/-/g, "");
  const t = new Date().toISOString();
  const state: PrepJobStateV1 = {
    schemaVersion: 1,
    jobId: PREP_ID,
    state: "SUCCEEDED",
    manifest: {
      schemaVersion: 1,
      jobId: PREP_ID,
      status: "PREPARED",
      stages: [],
      outputs: [
        { role: "RECEPTOR_PDBQT", relPath: "out/receptor.pdbqt", sha256: sha(rec), bytes: rec.length },
        { role: "LIGAND_PDBQT", relPath: "out/ligand.pdbqt", sha256: sha(lig), bytes: lig.length },
      ],
      diagnostics: [],
    },
    seal: { status: "SEALED", qualification: "INTERIM", reasonCodes: [], verifiedOutputs: 2 },
    preparedReceptorId: `prec_${c}`,
    preparedLigandId: `plig_${c}`,
    createdAt: t,
    expiresAt: t,
    updatedAt: t,
  };
  writeFileSync(join(dir, "state.json"), JSON.stringify(state));
  const prep = new PrepJobStore({ root: prepRoot, resolveArtifact: async () => undefined, installedTools: async () => [] });
  prep.init();
  const store = new DockJobStore({ root: join(tmp("dockwsl-jobs-"), "jobs"), resolvePrepared: createPrepResolver(prep), runner, engineStartWaitMs: 20_000 });
  await store.init();
  expect(existsSync(store.root)).toBe(true);
  return { store, ids: { receptorPreparedId: `prec_${c}`, ligandPreparedId: `plig_${c}` } };
};
const dockReq = (ids: { receptorPreparedId: string; ligandPreparedId: string }, extra: Record<string, unknown> = {}) => ({ ...ids, boxCenter: [11.4, 2.4, -11.4], boxSize: [22, 22, 22], exhaustiveness: 1, numPoses: 3, seed: 42, ...extra });
