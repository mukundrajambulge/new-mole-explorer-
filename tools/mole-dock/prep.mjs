// The only spawn path for the preparation worker (task 5.2).
// - argv arrays only, never a shell; fixed interpreter (the ~/mole-prep venv python inside WSL Ubuntu-24.04)
// - scrubbed environment (env -i inside WSL, WSLENV empty on the Windows side), cwd = job directory
// - stage-aware timeout (120 s per pipeline stage the job runs, capped at 15 min; overrides clamped) with process-tree kill (taskkill /T on Windows, process group on POSIX,
//   plus coreutils `timeout -k` inside WSL so the Linux side dies too)
// - stdout/stderr capped and path-scrubbed before anyone sees them
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PREP_STAGE_TIMEOUT_MS = 120_000;
/** Hard cap for one worker process (plan or apply), whatever the stages or the caller ask for. */
export const PREP_MAX_TIMEOUT_MS = 900_000;
export const PREP_MIN_TIMEOUT_MS = 1_000;
const JOB_FILE_CAP = 64 * 1024;

/**
 * Wall-clock budget for one worker process. Both --plan and --apply run the whole pipeline:
 * receptor clean + PDBFixer scan, Meeko receptor, ligand (RDKit/Meeko), plus a PDBFixer build when
 * addMissingAtoms, PDB2PQR+PROPKA when PROPKA_PREVIEW and Dimorphite-DL when DIMORPHITE_PREVIEW.
 * Each stage gets PREP_STAGE_TIMEOUT_MS; the total and any explicit override are clamped to
 * [PREP_MIN_TIMEOUT_MS, PREP_MAX_TIMEOUT_MS].
 */
export function prepTimeoutMs(options = {}, override) {
  if (override !== undefined && override !== null) {
    if (typeof override !== "number" || !Number.isFinite(override)) throw new Error("timeoutMs must be a finite number");
    return Math.min(PREP_MAX_TIMEOUT_MS, Math.max(PREP_MIN_TIMEOUT_MS, Math.floor(override)));
  }
  const o = options && typeof options === "object" ? options : {};
  let stages = 3;
  if (o.addMissingAtoms === true) stages += 1;
  if (o.protonation === "PROPKA_PREVIEW") stages += 1;
  if (o.ligandProtonation === "DIMORPHITE_PREVIEW") stages += 1;
  return Math.min(PREP_MAX_TIMEOUT_MS, stages * PREP_STAGE_TIMEOUT_MS);
}

/** Options from <jobDir>/job.json (capped read); {} when absent or unreadable (the worker then reports JOB_INVALID). */
export function readJobOptions(jobDir) {
  try {
    const fd = openSync(join(jobDir, "job.json"), "r");
    try {
      const buf = Buffer.alloc(JOB_FILE_CAP + 1);
      const n = readSync(fd, buf, 0, buf.length, 0);
      if (n > JOB_FILE_CAP) return {};
      const job = JSON.parse(buf.subarray(0, n).toString("utf8"));
      return job && typeof job.options === "object" && job.options !== null ? job.options : {};
    } finally {
      closeSync(fd);
    }
  } catch {
    return {};
  }
}
export const PREP_DISTRO = "Ubuntu-24.04";
export const STDOUT_CAP = 64 * 1024;
export const STDERR_CAP = 16 * 1024;
const MODES = new Set(["plan", "apply", "versions"]);
const SAFE_POSIX_PATH = /^\/[A-Za-z0-9._/-]+$/;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WORKER_LAUNCHER = join(REPO_ROOT, "workers", "prep", "run_prep.py");
/** Fixed worker environment: determinism (hash seed, single thread) and nothing inherited. */
export const WORKER_ENV = Object.freeze({
  PYTHONHASHSEED: "0",
  OMP_NUM_THREADS: "1",
  OPENBLAS_NUM_THREADS: "1",
  MKL_NUM_THREADS: "1",
  OPENMM_CPU_THREADS: "1",
  NUMEXPR_NUM_THREADS: "1",
  LANG: "C.UTF-8",
  PATH: "/usr/bin:/bin",
});

/** C:\Users\x\job -> /mnt/c/Users/x/job (rejects anything that is not a plain drive path). */
export function toWslPath(winPath) {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath);
  if (!m) throw new Error("PATH_REJECTED: not an absolute drive path");
  const p = `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`.replace(/\/+$/, "");
  if (!SAFE_POSIX_PATH.test(p) || p.split("/").includes("..")) throw new Error("PATH_REJECTED: unsupported characters in path");
  return p;
}

/** Remove host paths (job dir, repo, home, drive and /mnt paths) and cap the text. */
export function scrubOutput(text, cap, extra = []) {
  let s = String(text);
  for (const p of extra.filter(Boolean).sort((a, b) => b.length - a.length)) s = s.split(p).join("<job>");
  s = s
    .replace(/[A-Za-z]:[\\/][^\s"'<>|]*/g, "<path>")
    .replace(/\/(?:mnt|home|tmp|usr|root|Users)\/[^\s"'<>|]*/g, "<path>");
  if (s.length > cap) s = s.slice(0, cap) + "\n[truncated]";
  return s;
}

let cachedPython = null;
/** The fixed interpreter: MOLE_PREP_PYTHON (absolute, validated) or $HOME/mole-prep/bin/python inside the distro. */
export function resolvePrepPython({ platform = process.platform, env = process.env } = {}) {
  if (env.MOLE_PREP_PYTHON) {
    if (!SAFE_POSIX_PATH.test(env.MOLE_PREP_PYTHON)) throw new Error("MOLE_PREP_PYTHON must be an absolute POSIX path");
    return env.MOLE_PREP_PYTHON;
  }
  if (cachedPython) return cachedPython;
  const r =
    platform === "win32"
      ? spawnSync("wsl.exe", ["-d", PREP_DISTRO, "--exec", "/usr/bin/printenv", "HOME"], { encoding: "utf8", shell: false, timeout: 20_000, windowsHide: true })
      : { status: 0, stdout: env.HOME || "" };
  const home = String(r.stdout || "").trim();
  if (r.status !== 0 || !SAFE_POSIX_PATH.test(home)) throw new Error("PREP_UNAVAILABLE: cannot resolve the prep interpreter");
  cachedPython = `${home}/mole-prep/bin/python`;
  return cachedPython;
}

/** Build {command, args, options} without spawning. Exported for tests. */
export function buildPrepInvocation({ mode, jobDir, python, platform = process.platform, timeoutMs = PREP_STAGE_TIMEOUT_MS, launcher = WORKER_LAUNCHER }) {
  if (!MODES.has(mode)) throw new Error("mode must be plan, apply or versions");
  if (!isAbsolute(jobDir) || !existsSync(jobDir) || !statSync(jobDir).isDirectory()) throw new Error("JOB_DIR_INVALID");
  if (!SAFE_POSIX_PATH.test(python)) throw new Error("interpreter must be an absolute POSIX path");
  const secs = String(Math.max(1, Math.ceil(timeoutMs / 1000)));
  const envPairs = Object.entries(WORKER_ENV).map(([k, v]) => `${k}=${v}`);
  if (platform === "win32") {
    const wslJob = toWslPath(jobDir);
    const wslLauncher = toWslPath(launcher);
    return {
      command: "wsl.exe",
      args: ["-d", PREP_DISTRO, "--cd", wslJob, "--exec", "/usr/bin/timeout", "-k", "5", secs, "/usr/bin/env", "-i", ...envPairs, python, "-I", wslLauncher, `--${mode}`],
      options: { cwd: jobDir, shell: false, windowsHide: true, env: { SystemRoot: process.env.SystemRoot || "C:\\Windows", WSLENV: "" } },
      scrub: [jobDir, wslJob, dirname(dirname(launcher)), dirname(dirname(wslLauncher))],
    };
  }
  if (!SAFE_POSIX_PATH.test(jobDir) || !SAFE_POSIX_PATH.test(launcher)) throw new Error("PATH_REJECTED: unsupported characters in path");
  return {
    command: "/usr/bin/timeout",
    args: ["-k", "5", secs, "/usr/bin/env", "-i", ...envPairs, python, "-I", launcher, `--${mode}`],
    options: { cwd: jobDir, shell: false, detached: true, env: {} },
    scrub: [jobDir, dirname(dirname(launcher))],
  };
}

function killTree(child, platform) {
  if (!child.pid) return;
  if (platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, timeout: 10_000 });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * Spawn one process with caps, timeout and tree kill. Resolves (never rejects) with
 * {status: OK|BLOCKED|FAILED|TIMEOUT|CANCELLED, exitCode, stdout, stderr, durationMs}.
 * Exit code 0 = OK, 3 = BLOCKED (worker wrote a diagnostic), anything else FAILED.
 */
export function runProcess({ command, args, options, scrub = [] }, { timeoutMs = PREP_STAGE_TIMEOUT_MS, signal, platform = process.platform } = {}) {
  return new Promise((resolveRun) => {
    const t0 = Date.now();
    let out = "";
    let err = "";
    let timedOut = false;
    let cancelled = false;
    let child;
    try {
      child = spawn(command, args, { ...options, shell: false, stdio: ["ignore", "pipe", "pipe"], detached: platform !== "win32" });
    } catch (e) {
      resolveRun({ status: "FAILED", exitCode: null, stdout: "", stderr: scrubOutput(`SPAWN_FAILED: ${e?.code || "error"}`, STDERR_CAP, scrub), durationMs: 0 });
      return;
    }
    child.stdout.on("data", (d) => {
      if (out.length < STDOUT_CAP + 1) out += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      if (err.length < STDERR_CAP + 1) err += d.toString("utf8");
    });
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child, platform);
    }, timeoutMs);
    const onAbort = () => {
      cancelled = true;
      killTree(child, platform);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort(); // aborted before the spawn: kill at once (task 5.4)
    let settled = false;
    const done = (code, spawnError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      const status = timedOut ? "TIMEOUT" : cancelled ? "CANCELLED" : spawnError ? "FAILED" : code === 0 ? "OK" : code === 3 ? "BLOCKED" : "FAILED";
      resolveRun({
        status,
        exitCode: code,
        stdout: scrubOutput(out, STDOUT_CAP, scrub),
        stderr: scrubOutput(spawnError ? `SPAWN_FAILED: ${spawnError.code || "error"}` : err, STDERR_CAP, scrub),
        durationMs: Date.now() - t0,
      });
    };
    child.on("error", (e) => done(null, e));
    child.on("close", (code) => done(code, null));
  });
}

/** Run the prep worker in one job directory: mode "plan", "apply" or "versions" (empty dir, no job files). */
export async function runPrep({ mode, jobDir, timeoutMs, options, signal, platform = process.platform, python } = {}) {
  let inv;
  try {
    timeoutMs = prepTimeoutMs(options ?? (typeof jobDir === "string" && isAbsolute(jobDir) ? readJobOptions(jobDir) : {}), timeoutMs);
    inv = buildPrepInvocation({ mode, jobDir, python: python ?? resolvePrepPython({ platform }), platform, timeoutMs });
  } catch (e) {
    return { status: "FAILED", exitCode: null, stdout: "", stderr: scrubOutput(String(e?.message || e), STDERR_CAP, [jobDir]), durationMs: 0 };
  }
  // Outer guard slightly above the in-WSL `timeout` so the inner kill normally wins.
  const r = await runProcess(inv, { timeoutMs: timeoutMs + 10_000, signal, platform });
  // coreutils timeout exits 124 (TERM) or 137 (KILL) when the in-distro limit fired.
  return r.status === "FAILED" && (r.exitCode === 124 || r.exitCode === 137) ? { ...r, status: "TIMEOUT" } : r;
}

export const PREP_VERSIONS_TIMEOUT_MS = 60_000;
const VERSION_RE = /^[A-Za-z0-9._+-]{1,32}$/;

/** Shape-check one `run_prep.py --versions` stdout line. Exported for tests. */
export function parseVersionsReport(stdout) {
  const line = String(stdout ?? "").trim();
  if (!line || line.includes("\n") || line.length > 4096) return null;
  let report;
  try {
    report = JSON.parse(line);
  } catch {
    return null;
  }
  const tools = report && typeof report.tools === "object" && report.tools !== null && !Array.isArray(report.tools) ? report.tools : null;
  if (!tools || typeof report.lockDigest !== "string" || !/^[0-9a-f]{64}$/.test(report.lockDigest) || typeof report.workerVersion !== "string" || !VERSION_RE.test(report.workerVersion)) return null;
  const clean = {};
  const entries = Object.entries(tools);
  if (entries.length > 64) return null;
  for (const [k, v] of entries) {
    if (!/^[a-z0-9_]{1,64}$/.test(k) || typeof v !== "string" || !VERSION_RE.test(v)) return null;
    clean[k] = v;
  }
  return { profileId: String(report.profileId ?? "").slice(0, 64), workerVersion: report.workerVersion, lockDigest: report.lockDigest, python: String(report.python ?? "").slice(0, 16), tools: clean };
}

/**
 * Ask the installed worker which toolchain it runs (`run_prep.py --versions`) in a fresh, empty temp
 * directory, through the same fixed-interpreter, scrubbed-env, no-shell spawn path as plan/apply.
 * Resolves (never rejects) with {ok:true, report} or {ok:false, error}; apps/api/src/jobs/prepPins.ts
 * compares the report against TOOLS.md and the lock.
 */
export async function probePrepVersions({ platform = process.platform, python, timeoutMs = PREP_VERSIONS_TIMEOUT_MS } = {}) {
  let dir;
  try {
    dir = mkdtempSync(join(tmpdir(), "mole-prep-versions-"));
    const r = await runPrep({ mode: "versions", jobDir: dir, timeoutMs, platform, ...(python ? { python } : {}) });
    if (r.status !== "OK") return { ok: false, error: `VERSIONS_${r.status}${r.stderr ? `: ${r.stderr.slice(0, 300)}` : ""}` };
    const report = parseVersionsReport(r.stdout);
    return report ? { ok: true, report } : { ok: false, error: "VERSIONS_OUTPUT_INVALID" };
  } catch (e) {
    return { ok: false, error: scrubOutput(`VERSIONS_FAILED: ${e?.message || e}`, 300, dir ? [dir] : []) };
  } finally {
    // WSL may hold the cwd handle for a moment after exit; the directory is empty, so a leftover is harmless.
    try {
      if (dir) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* best effort */
    }
  }
}
