import { describe, expect, it } from "vitest";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { PrepConfirmationV1Schema, PrepManifestV1Schema, PrepPlanV1Schema } from "@molecular/contracts";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Unit tests for tools/mole-dock/prep.mjs (task 5.2): the only spawn path for the prep worker.
// No WSL needed: argv construction is checked structurally and the runner is exercised with node itself.
interface RunResult {
  status: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}
interface Invocation {
  command: string;
  args: string[];
  options: { cwd: string; shell: boolean; env: Record<string, string> };
}
interface Mod {
  buildPrepInvocation(o: { mode: string; jobDir: string; python: string; platform?: string }): Invocation;
  toWslPath(p: string): string;
  scrubOutput(text: string, cap: number, extra: string[]): string;
  runProcess(inv: { command: string; args: string[]; options: object; scrub: string[] }, o: { timeoutMs: number }): Promise<RunResult>;
  runPrep(o: { mode: string; jobDir: string }): Promise<RunResult>;
}
const modUrl = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)),"../../../../tools/mole-dock/prep.mjs")).href;
const load = async (): Promise<Mod> => (await import(modUrl)) as Mod;

describe("mole-dock prep spawn wrapper", () => {
  it("builds a shell-free wsl.exe argv with a fixed interpreter and a scrubbed env", async () => {
    const m = await load();
    const job = mkdtempSync(join(tmpdir(), "prepjob-"));
    try {
      const inv = m.buildPrepInvocation({ mode: "plan", jobDir: job, python: "/home/u/mole-prep/bin/python", platform: process.platform });
      expect(inv.options.shell).toBe(false);
      expect(inv.options.cwd).toBe(job);
      expect(inv.args).toContain("-I");
      expect(inv.args).toContain("--plan");
      expect(inv.args).toContain("PYTHONHASHSEED=0");
      expect(inv.args.slice(inv.args.indexOf("/usr/bin/env"), inv.args.indexOf("/usr/bin/env") + 2)).toEqual(["/usr/bin/env", "-i"]);
      if (process.platform === "win32") {
        expect(inv.command).toBe("wsl.exe");
        expect(inv.args.slice(0, 2)).toEqual(["-d", "Ubuntu-24.04"]);
        expect(Object.keys(inv.options.env).sort()).toEqual(["SystemRoot", "WSLENV"]);
        expect(inv.options.env.WSLENV).toBe("");
      }
      expect(() => m.toWslPath("C:\\Users\\a b")).toThrow(/PATH_REJECTED/);
      expect(m.toWslPath("C:\\Users\\mukun\\job-1")).toBe("/mnt/c/Users/mukun/job-1");
      expect(() => m.toWslPath("\\\\server\\share")).toThrow(/PATH_REJECTED/);
      expect(() => m.buildPrepInvocation({ mode: "rm", jobDir: job, python: "/p/python" })).toThrow();
      expect(() => m.buildPrepInvocation({ mode: "plan", jobDir: "relative/dir", python: "/p/python" })).toThrow(/JOB_DIR_INVALID/);
      expect(() => m.buildPrepInvocation({ mode: "plan", jobDir: job, python: "~/mole-prep/bin/python" })).toThrow();
    } finally {
      rmSync(job, { recursive: true, force: true });
    }
  });

  it("scrubs host paths and caps output", async () => {
    const m = await load();
    const s = m.scrubOutput("err at C:\\Users\\mukun\\secret\\x.pdb and /home/mukun/mole-prep/lib/a.py and /mnt/c/Users/q", 1000, []);
    expect(s).not.toMatch(/mukun/);
    expect(m.scrubOutput("x".repeat(5000), 100, []).length).toBeLessThan(130);
  });

  // Real worker through wsl.exe (opt-in: needs WSL Ubuntu-24.04 with ~/mole-prep). Reported as skipped otherwise.
  it.skipIf(process.platform !== "win32" || process.env.MOLE_PREP_E2E !== "1")("plans and applies 1CRN + ethanol through the real worker", async () => {
    const m = await load();
    const fx = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../tests/fixtures");
    const job = mkdtempSync(join(tmpdir(), "prepjob-"));
    try {
      mkdirSync(join(job, "in"));
      copyFileSync(join(fx, "rcsb", "1CRN.pdb"), join(job, "in", "receptor.pdb"));
      copyFileSync(join(fx, "ethanol.sdf"), join(job, "in", "ligand.sdf"));
      const opts = { pH: 7.4, protonation: "EXPLICIT_SUBMITTED", ligandProtonation: "EXPLICIT_SUBMITTED", chainIds: null, keepWaters: false, addMissingAtoms: false };
      writeFileSync(join(job, "job.json"), JSON.stringify({ schemaVersion: 1, jobId: "e2e-1", receptor: { artifactId: "r1", relPath: "in/receptor.pdb", format: "pdb" }, ligand: { artifactId: "l1", relPath: "in/ligand.sdf", format: "sdf" }, options: opts }));
      const p = await m.runPrep({ mode: "plan", jobDir: job });
      expect(p.status, p.stderr).toBe("OK");
      const plan = PrepPlanV1Schema.parse(JSON.parse(readFileSync(join(job, "plan.json"), "utf8")));
      expect(plan.status).toBe("READY");
      const acks = plan.decisions.filter((d) => d.requiresAck).map((d) => d.key);
      writeFileSync(join(job, "confirmation.json"), JSON.stringify(PrepConfirmationV1Schema.parse({ jobId: "e2e-1", planDigest: plan.planDigest, acks })));
      const a = await m.runPrep({ mode: "apply", jobDir: job });
      expect(a.status, a.stderr).toBe("OK");
      const man = PrepManifestV1Schema.parse(JSON.parse(readFileSync(join(job, "prep-manifest.json"), "utf8")));
      expect(man.status).toBe("PREPARED");
      expect(man.planDigest).toBe(plan.planDigest);
      expect(man.outputs.length).toBe(6);
      expect(a.stderr).not.toContain(job);
    } finally {
      // Files written through WSL drvfs can stay locked briefly on Windows; a leaked temp dir is harmless.
      try {
        rmSync(job, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      } catch {
        /* ignore */
      }
    }
  }, 120_000);

  it("maps exit codes and kills the whole process tree on timeout", async () => {
    const m = await load();
    const job = mkdtempSync(join(tmpdir(), "prepjob-"));
    try {
      const base = { command: process.execPath, options: { cwd: job, env: {} }, scrub: [job] };
      const blocked = await m.runProcess({ ...base, args: ["-e", `process.stderr.write(${JSON.stringify(job)} + " BLOCKED"); process.exit(3)`] }, { timeoutMs: 20_000 });
      expect(blocked.status).toBe("BLOCKED");
      expect(blocked.stderr).not.toContain(job);
      const ok = await m.runProcess({ ...base, args: ["-e", "console.log('{\"status\":\"READY\"}')"] }, { timeoutMs: 20_000 });
      expect(ok.status).toBe("OK");
      const pidFile = join(job, "grandchild.pid");
      const script = `const {spawn}=require('node:child_process');const fs=require('node:fs');` +
        `const g=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidFile)},String(g.pid));setInterval(()=>{},1000);`;
      const t = await m.runProcess({ ...base, args: ["-e", script] }, { timeoutMs: 1500 });
      expect(t.status).toBe("TIMEOUT");
      expect(existsSync(pidFile)).toBe(true);
      const gpid = Number(readFileSync(pidFile, "utf8"));
      await new Promise((r) => setTimeout(r, 500));
      let alive = true;
      try {
        process.kill(gpid, 0);
      } catch {
        alive = false;
      }
      expect(alive).toBe(false);
    } finally {
      rmSync(job, { recursive: true, force: true });
    }
  }, 30_000);
});
