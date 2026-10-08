// The only spawn path for the preparation worker (task 5.2).
// - argv arrays only, never a shell; fixed interpreter (the ~/mole-prep venv python inside WSL Ubuntu-24.04)
// - scrubbed environment (env -i inside WSL, WSLENV empty on the Windows side), cwd = job directory
// - per-stage timeout (default 120 s) with process-tree kill (taskkill /T on Windows, process group on POSIX,
//   plus coreutils `timeout -k` inside WSL so the Linux side dies too)
// - stdout/stderr capped and path-scrubbed before anyone sees them
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PREP_STAGE_TIMEOUT_MS = 120_000;
export const PREP_DISTRO = "Ubuntu-24.04";
export const STDOUT_CAP = 64 * 1024;
export const STDERR_CAP = 16 * 1024;
const MODES = new Set(["plan", "apply"]);
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
  if (!MODES.has(mode)) throw new Error("mode must be plan or apply");
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

/** Run the prep worker in one job directory: mode "plan" or "apply". */
export async function runPrep({ mode, jobDir, timeoutMs = PREP_STAGE_TIMEOUT_MS, signal, platform = process.platform, python } = {}) {
  let inv;
  try {
    inv = buildPrepInvocation({ mode, jobDir, python: python ?? resolvePrepPython({ platform }), platform, timeoutMs });
  } catch (e) {
    return { status: "FAILED", exitCode: null, stdout: "", stderr: scrubOutput(String(e?.message || e), STDERR_CAP, [jobDir]), durationMs: 0 };
  }
  // Outer guard slightly above the in-WSL `timeout` so the inner kill normally wins.
  const r = await runProcess(inv, { timeoutMs: timeoutMs + 10_000, signal, platform });
  // coreutils timeout exits 124 (TERM) or 137 (KILL) when the in-distro limit fired.
  return r.status === "FAILED" && (r.exitCode === 124 || r.exitCode === 137) ? { ...r, status: "TIMEOUT" } : r;
}
