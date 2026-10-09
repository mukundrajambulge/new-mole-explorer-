/* global process, setInterval, clearInterval */
// Test support for dockJobs.test.ts (task 5.4).
// - fakeEngine(): the run.mjs engine interface, but dock() spawns a real long-running node process (through the
//   same prep.mjs runProcess, so abort tree-kills it) that writes its pid to the pidfile, then copies the real
//   Vina poses fixture after holdMs. killGroup() kills the pid from the pidfile, like the WSL pgid kill.
// - run as a forked harness (`node --import tsx dockCrash.fixture.mjs harness <cfg.json>`): opens a DockJobStore,
//   submits the jobs from cfg, reports {jobs, pid} once the first job is RUNNING and then waits to be SIGKILLed.
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const { runProcess } = await import(pathToFileURL(join(repoRoot, "tools", "mole-dock", "prep.mjs")).href);
const repo = repoRoot;
export const PIN = "f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644";
export const POSES_FIXTURE = join(repo, "tests", "fixtures", "dock", "1STP-BTN-vina-poses.pdbqt");
const CHILD = [
  "const fs=require('fs');",
  "fs.writeFileSync(process.argv[1],String(process.pid));",
  "setTimeout(()=>{fs.copyFileSync(process.argv[2],'poses.pdbqt');process.exit(0)},Number(process.argv[3]));",
].join("");

export function fakeEngine({ holdMs = 60_000, calls = { dock: 0 }, ignoreSignal = false, noKill = false, orphanable = false, failWith } = {}) {
  return {
    calls,
    pin: async () => ({ sha256: PIN, version: "1.2.7" }),
    verify: async () => ({ vina: "/opt/vina", binarySha256: PIN, versionLine: "AutoDock Vina v1.2.7" }),
    async dock(outDir, _job, _v, { signal, pidfile } = {}) {
      calls.dock++;
      if (failWith) throw Object.assign(new Error(`${failWith} at ${outDir}`), { exitCode: 3, code: "VINA_FAILED" });
      const args = ["-e", CHILD, pidfile, POSES_FIXTURE, String(holdMs)];
      if (orphanable) {
        // Like Vina inside WSL: outside this process's Windows job object, so it survives an API crash.
        const c = spawn(process.execPath, args, { cwd: outDir, detached: true, stdio: "ignore", windowsHide: true });
        const t0 = Date.now();
        const code = await new Promise((ok) => {
          c.once("exit", ok);
          signal?.addEventListener("abort", () => c.kill("SIGKILL"), { once: true });
        });
        if (code !== 0) throw Object.assign(new Error("fake vina failed"), { exitCode: 3, code: "VINA_FAILED" });
        return { durationMs: Date.now() - t0, log: "" };
      }
      const r = await runProcess(
        { command: process.execPath, args: ["-e", CHILD, pidfile, POSES_FIXTURE, String(holdMs)], options: { cwd: outDir, windowsHide: true } },
        { timeoutMs: holdMs + 30_000, signal: ignoreSignal ? undefined : signal },
      );
      if (r.status !== "OK") throw Object.assign(new Error(`fake vina ${r.status}`), { exitCode: 3, code: "VINA_FAILED" });
      return { durationMs: r.durationMs, log: "" };
    },
    async killGroup(pidfile) {
      if (noKill || !existsSync(pidfile)) return;
      const pid = Number(readFileSync(pidfile, "utf8").trim());
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* gone */
      }
    },
  };
}

if (process.argv[2] === "harness") {
  const cfg = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const { DockJobStore } = await import(pathToFileURL(join(here, "dockJobs.ts")).href);
  const { createMoleDockRunner } = await import(pathToFileURL(join(here, "dockRunner.ts")).href);
  const { PrepJobStore } = await import(pathToFileURL(join(here, "prepJobs.ts")).href);
  const { createPrepResolver } = await import(pathToFileURL(join(here, "dockJobs.ts")).href);
  const prep = new PrepJobStore({ root: cfg.prepRoot, resolveArtifact: async () => undefined, installedTools: async () => [] });
  prep.init();
  const store = new DockJobStore({ root: cfg.root, resolvePrepared: createPrepResolver(prep), runner: createMoleDockRunner({ engine: fakeEngine({ holdMs: 120_000, orphanable: true }) }) });
  await store.init();
  const jobs = [];
  for (const req of cfg.requests) jobs.push((await store.submit(req)).job.jobId);
  const first = jobs[0];
  const report = () => {
    const pidfile = join(store.jobDir(first), "pid");
    if (store.get(first).status === "RUNNING" && existsSync(pidfile) && readFileSync(pidfile, "utf8").trim()) {
      process.send({ jobs, childPid: Number(readFileSync(pidfile, "utf8").trim()) });
      return true;
    }
    return false;
  };
  const timer = setInterval(() => {
    if (report()) clearInterval(timer);
  }, 25);
  setInterval(() => {}, 1 << 30);
}
