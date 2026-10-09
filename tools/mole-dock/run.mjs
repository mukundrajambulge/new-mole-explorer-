// `mole-dock run` (task 5.3, part 1): one docking job with the pinned AutoDock Vina 1.2.7.
// - job.json validated with zod; receptor/ligand PDBQT paths must stay inside the allowed root (job.json's directory
//   unless --root is given), sizes capped, box finite and capped, integer seed required
// - the Vina binary sha256 is checked against native/third_party/TOOLS.md before every run (fail closed)
// - spawn with an argv array (no shell), scrubbed env (env -i in WSL, WSLENV empty), coreutils timeout + tree kill
// - writes result.json (label PREVIEW_UNQUALIFIED), poses.pdbqt and manifest.json into --out
// Exit codes: 0 ok, 2 bad input, 3 engine error.
// meScore is UNAVAILABLE: there is no `mole-score` CLI yet (TODO 5.3 part 2). Nothing is fabricated.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PREP_DISTRO, runProcess, scrubOutput, toWslPath } from "./prep.mjs";

export const EXIT_OK = 0;
export const EXIT_BAD_INPUT = 2;
export const EXIT_ENGINE = 3;
export const RESULT_LABEL = "PREVIEW_UNQUALIFIED";
export const VINA_VERSION = "1.2.7";
export const JOB_FILE_CAP = 64 * 1024;
export const PDBQT_CAP = 16 * 1024 * 1024;
export const POSES_CAP = 32 * 1024 * 1024;
export const MAX_BOX_EDGE = 126;
export const MAX_BOX_VOLUME = 27_000 * 8; // 60 A cube; Vina itself warns above 27000 A^3
export const MAX_COORD = 10_000;
export const DEFAULT_TIMEOUT_MS = 600_000;
export const MAX_TIMEOUT_MS = 1_800_000;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TOOLS_MD = join(REPO_ROOT, "native", "third_party", "TOOLS.md");
const SAFE_POSIX_PATH = /^\/[A-Za-z0-9._/-]+$/;
const ENGINE_ENV = ["PATH=/usr/bin:/bin", "LANG=C.UTF-8", "OMP_NUM_THREADS=1"];

export class DockError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}
const bad = (code, msg) => new DockError(EXIT_BAD_INPUT, code, msg);
const engine = (code, msg) => new DockError(EXIT_ENGINE, code, msg);

const finite = z.number().finite();
const relPath = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[A-Za-z0-9._/-]+$/, "path may only use A-Z a-z 0-9 . _ / -")
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "path must be relative and stay inside the root")
  .refine((p) => p.toLowerCase().endsWith(".pdbqt"), "path must name a .pdbqt file");
const vec3 = z.tuple([finite, finite, finite]);

export const DockJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    receptor: z.object({ path: relPath }).strict(),
    ligand: z.object({ path: relPath }).strict(),
    box: z
      .object({
        center: vec3.refine((c) => c.every((v) => Math.abs(v) <= MAX_COORD), `center coordinates must be within +/-${MAX_COORD} A`),
        size: vec3.refine((s) => s.every((v) => v > 0 && v <= MAX_BOX_EDGE), `box edges must be in (0, ${MAX_BOX_EDGE}] A`),
      })
      .strict()
      .refine((b) => b.size[0] * b.size[1] * b.size[2] <= MAX_BOX_VOLUME, `box volume must be <= ${MAX_BOX_VOLUME} A^3`),
    exhaustiveness: z.number().int().min(1).max(64).default(8),
    numPoses: z.number().int().min(1).max(20).default(9),
    energyRange: finite.min(0.5).max(10).default(3),
    seed: z.number().int().min(1).max(2_147_483_647),
    cpu: z.number().int().min(1).max(16).default(4),
    timeoutMs: z.number().int().min(1000).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
  })
  .strict();

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function readCapped(path, cap, what) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(cap + 1);
    let n = 0;
    for (;;) {
      const r = readSync(fd, buf, n, buf.length - n, n);
      if (r === 0) break;
      n += r;
      if (n > cap) throw bad("INPUT_TOO_LARGE", `${what} exceeds ${cap} bytes`);
    }
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

/** Resolve rel inside root, following symlinks; throws PATH_REJECTED when it escapes. */
export function confinedPath(root, rel) {
  const realRoot = realpathSync(root);
  const target = resolve(realRoot, rel);
  if (!existsSync(target)) throw bad("INPUT_MISSING", `input not found: ${rel}`);
  const real = realpathSync(target);
  const r = relative(realRoot, real);
  if (!r || r.startsWith("..") || isAbsolute(r) || r.split(sep).includes("..")) throw bad("PATH_REJECTED", `path escapes the allowed root: ${rel}`);
  if (!statSync(real).isFile()) throw bad("INPUT_MISSING", `not a file: ${rel}`);
  return real;
}

/** Minimal shape check of a PDBQT input: ATOM/HETATM records with finite coordinates. */
export function checkPdbqt(text, what, { ligand = false } = {}) {
  let atoms = 0;
  let hasRoot = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("ATOM") || line.startsWith("HETATM")) {
      const xyz = [line.slice(30, 38), line.slice(38, 46), line.slice(46, 54)].map(Number);
      if (!xyz.every(Number.isFinite) || line.slice(30, 54).trim() === "") throw bad("PDBQT_INVALID", `${what}: non-finite coordinates`);
      atoms++;
    } else if (line.startsWith("ROOT")) hasRoot = true;
  }
  if (atoms === 0) throw bad("PDBQT_INVALID", `${what}: no atoms`);
  if (ligand && !hasRoot) throw bad("PDBQT_INVALID", `${what}: ligand PDBQT has no ROOT (not a Vina ligand)`);
  return atoms;
}

/** Parse + validate job.json bytes and its inputs. Returns {job, inputs:{receptor, ligand}}. */
export function validateJob(raw, { root }) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8") : raw);
  } catch {
    throw bad("JOB_INVALID", "job.json is not valid JSON");
  }
  const r = DockJobSchema.safeParse(parsed);
  if (!r.success) {
    const first = r.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "job"}: ${i.message}`).join("; ");
    throw bad("JOB_INVALID", first);
  }
  const job = r.data;
  const inputs = {};
  for (const role of ["receptor", "ligand"]) {
    const path = confinedPath(root, job[role].path);
    const bytes = readCapped(path, PDBQT_CAP, role);
    const atoms = checkPdbqt(bytes.toString("latin1"), role, { ligand: role === "ligand" });
    inputs[role] = { path, bytes, atoms, sha256: sha256(bytes) };
  }
  return { job, inputs };
}

/** sha256 and version pinned for Vina in TOOLS.md. */
export function parseToolsVinaPin(md) {
  const sec = /## AutoDock Vina\s*\n([\s\S]*?)(?:\n## |$)/.exec(md);
  const sha = sec && /\|\s*sha256\s*\|\s*`([0-9a-f]{64})`/.exec(sec[1]);
  const ver = sec && /\|\s*Version\s*\|\s*([0-9.]+)/.exec(sec[1]);
  if (!sha || !ver) return null;
  return { sha256: sha[1], version: ver[1] };
}

/** Parse Vina output: one entry per MODEL with its REMARK VINA RESULT and atom lines. */
export function parseVinaPoses(text) {
  const poses = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("MODEL")) cur = { rank: poses.length + 1, vinaScore: null, rmsdLb: null, rmsdUb: null, atoms: [] };
    else if (cur && line.startsWith("REMARK VINA RESULT:")) {
      const v = line.slice(19).trim().split(/\s+/).map(Number);
      if (v.length >= 3 && v.every(Number.isFinite)) [cur.vinaScore, cur.rmsdLb, cur.rmsdUb] = v;
    } else if (cur && (line.startsWith("ATOM") || line.startsWith("HETATM"))) {
      const x = Number(line.slice(30, 38));
      const y = Number(line.slice(38, 46));
      const zc = Number(line.slice(46, 54));
      const type = line.slice(77).trim().split(/\s+/)[0] || "";
      cur.atoms.push({ name: line.slice(12, 16).trim(), type, x, y, z: zc });
    } else if (cur && line.startsWith("ENDMDL")) {
      poses.push(cur);
      cur = null;
    }
  }
  return poses;
}

/** Heavy atoms (AD4 type not H/HD/HS) of PDBQT ATOM/HETATM lines, in file order. */
export function pdbqtHeavyAtoms(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!(line.startsWith("ATOM") || line.startsWith("HETATM"))) continue;
    const type = line.slice(77).trim().split(/\s+/)[0] || "";
    if (type === "H" || type === "HD" || type === "HS") continue;
    out.push({ type, x: Number(line.slice(30, 38)), y: Number(line.slice(38, 46)), z: Number(line.slice(46, 54)) });
  }
  return out;
}

// ---- engine (WSL on Windows, direct on POSIX) ------------------------------------------------------------

function wslHome() {
  const r = spawnSync("wsl.exe", ["-d", PREP_DISTRO, "--exec", "/usr/bin/printenv", "HOME"], { encoding: "utf8", shell: false, timeout: 20_000, windowsHide: true, env: { SystemRoot: process.env.SystemRoot || "C:\\Windows", WSLENV: "" } });
  const home = String(r.stdout || "").trim();
  if (r.status !== 0 || !SAFE_POSIX_PATH.test(home)) throw engine("VINA_UNAVAILABLE", "cannot resolve the WSL home directory");
  return home;
}

/** Fixed binary location: MOLE_VINA (absolute POSIX path) or $HOME/mole-tools/vina inside the distro. */
export function resolveVinaPath({ platform = process.platform, env = process.env } = {}) {
  if (env.MOLE_VINA) {
    if (!SAFE_POSIX_PATH.test(env.MOLE_VINA)) throw engine("VINA_UNAVAILABLE", "MOLE_VINA must be an absolute POSIX path");
    return env.MOLE_VINA;
  }
  const home = platform === "win32" ? wslHome() : env.HOME || "";
  if (!SAFE_POSIX_PATH.test(home)) throw engine("VINA_UNAVAILABLE", "cannot resolve HOME");
  return `${home}/mole-tools/vina`;
}

/**
 * Fixed pidfile wrapper (task 5.4): setsid -w makes a new session (forking if needed, waiting for it), the inner sh writes its pid (= pgid, kept by
 * exec) to the pidfile given as $1, then execs the timeout command. Positional args only, nothing interpolated.
 */
export const PIDFILE_WRAPPER = ["/usr/bin/setsid", "-w", "/bin/sh", "-c", 'echo $$ > "$1"; shift; exec "$@"', "sh"];

/** {command,args,options} for one engine-side program under timeout + env -i. Exported for tests. */
export function buildEngineInvocation({ program, args, cwd, timeoutMs, platform = process.platform, pidfile }) {
  if (!SAFE_POSIX_PATH.test(program)) throw engine("VINA_UNAVAILABLE", "engine path rejected");
  const secs = String(Math.max(1, Math.ceil(timeoutMs / 1000)));
  if (platform === "win32") {
    const wslCwd = toWslPath(cwd);
    const wslPid = pidfile ? toWslPath(pidfile) : null;
    if (wslPid !== null && !SAFE_POSIX_PATH.test(wslPid)) throw engine("VINA_UNAVAILABLE", "pidfile path rejected");
    return {
      command: "wsl.exe",
      args: ["-d", PREP_DISTRO, "--cd", wslCwd, "--exec", ...(wslPid ? [...PIDFILE_WRAPPER, wslPid] : []), "/usr/bin/timeout", "-k", "5", secs, "/usr/bin/env", "-i", ...ENGINE_ENV, program, ...args],
      options: { cwd, shell: false, windowsHide: true, env: { SystemRoot: process.env.SystemRoot || "C:\\Windows", WSLENV: "" } },
      scrub: [cwd, wslCwd, REPO_ROOT, ...(wslPid ? [wslPid] : [])],
    };
  }
  if (pidfile && !SAFE_POSIX_PATH.test(pidfile)) throw engine("VINA_UNAVAILABLE", "pidfile path rejected");
  const pre = pidfile ? [...PIDFILE_WRAPPER, pidfile] : [];
  return {
    command: pidfile ? pre[0] : "/usr/bin/timeout",
    args: [...pre.slice(1), ...(pidfile ? ["/usr/bin/timeout"] : []), "-k", "5", secs, "/usr/bin/env", "-i", ...ENGINE_ENV, program, ...args],
    options: { cwd, shell: false, env: {} },
    scrub: [cwd, REPO_ROOT],
  };
}

/** Read a pidfile written by PIDFILE_WRAPPER: digits only (else null). */
export function readPidfile(pidfile) {
  try {
    const s = readFileSync(pidfile, "utf8").trim();
    if (!/^[0-9]{1,9}$/.test(s)) return null;
    const n = Number(s);
    return n > 1 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Kill the engine's process group named by the pidfile (async; never throws). The group is killed only when
 * /proc/<pgid>/cwd is still the job's out dir, so a reused pid is never hit. Polls briefly for a late pidfile.
 */
export async function killEngineGroup({ pidfile, cwd, platform = process.platform, waitMs = 1000 }) {
  let pgid = readPidfile(pidfile);
  for (const t0 = Date.now(); pgid === null && Date.now() - t0 < waitMs; pgid = readPidfile(pidfile)) await new Promise((r) => setTimeout(r, 50));
  if (pgid === null) return { killed: false, reason: "NO_PIDFILE" };
  const script = '[ "$(readlink /proc/$1/cwd)" = "$2" ] && exec /bin/kill -KILL -- "-$1"';
  if (platform === "win32") {
    const wslCwd = toWslPath(cwd);
    const r = await runProcess(
      { command: "wsl.exe", args: ["-d", PREP_DISTRO, "--exec", "/bin/sh", "-c", script, "sh", String(pgid), wslCwd], options: { shell: false, windowsHide: true, env: { SystemRoot: process.env.SystemRoot || "C:\\Windows", WSLENV: "" } } },
      { timeoutMs: 15_000, platform },
    );
    return { killed: r.status === "OK", pgid };
  }
  const r = await runProcess({ command: "/bin/sh", args: ["-c", script, "sh", String(pgid), realpathSync(cwd)], options: { shell: false, env: {} } }, { timeoutMs: 10_000, platform });
  return { killed: r.status === "OK", pgid };
}


/** Vina argv for one job; all paths relative to the job's out dir (the engine cwd). */
export function vinaArgs(job) {
  const [cx, cy, cz] = job.box.center;
  const [sx, sy, sz] = job.box.size;
  return [
    "--receptor", "inputs/receptor.pdbqt",
    "--ligand", "inputs/ligand.pdbqt",
    "--center_x", String(cx), "--center_y", String(cy), "--center_z", String(cz),
    "--size_x", String(sx), "--size_y", String(sy), "--size_z", String(sz),
    "--exhaustiveness", String(job.exhaustiveness),
    "--num_modes", String(job.numPoses),
    "--energy_range", String(job.energyRange),
    "--seed", String(job.seed),
    "--cpu", String(job.cpu),
    "--out", "poses.pdbqt",
  ];
}

/** Real engine: verify sha256 + version, then dock. Resolves {stdout, stderr, versionLine, binarySha256, durationMs}. */
export function createVinaEngine({ platform = process.platform, env = process.env, toolsMd = TOOLS_MD } = {}) {
  return {
    async pin() {
      let md;
      try {
        md = readFileSync(toolsMd, "utf8");
      } catch {
        throw engine("VINA_PIN_MISSING", "TOOLS.md not readable");
      }
      const pin = parseToolsVinaPin(md);
      if (!pin) throw engine("VINA_PIN_MISSING", "TOOLS.md has no Vina sha256/version pin");
      return pin;
    },
    async verify(outDir, pin) {
      const vina = resolveVinaPath({ platform, env });
      const h = await runProcess(buildEngineInvocation({ program: "/usr/bin/sha256sum", args: [vina], cwd: outDir, timeoutMs: 60_000, platform }), { timeoutMs: 70_000, platform });
      const got = /^([0-9a-f]{64})\s/.exec(h.stdout || "");
      if (h.status !== "OK" || !got) throw engine("VINA_UNAVAILABLE", "Vina binary not found or not readable");
      if (got[1] !== pin.sha256) throw engine("VINA_DIGEST_MISMATCH", "Vina binary sha256 does not match TOOLS.md; refusing to run");
      const v = await runProcess(buildEngineInvocation({ program: vina, args: ["--version"], cwd: outDir, timeoutMs: 30_000, platform }), { timeoutMs: 40_000, platform });
      const line = (v.stdout || "").split(/\r?\n/).find((l) => /AutoDock Vina/.test(l))?.trim() ?? "";
      if (v.status !== "OK" || !line.includes(`v${pin.version}`)) throw engine("VINA_VERSION_MISMATCH", `Vina does not report v${pin.version}`);
      return { vina, binarySha256: got[1], versionLine: line.slice(0, 80) };
    },
    /** Group kill for a cancelled or orphaned run (task 5.4). */
    killGroup(pidfile, outDir) {
      return killEngineGroup({ pidfile, cwd: outDir, platform });
    },
    async dock(outDir, job, verified, { signal, pidfile } = {}) {
      const inv = buildEngineInvocation({ program: verified.vina, args: vinaArgs(job), cwd: outDir, timeoutMs: job.timeoutMs, platform, pidfile });
      const r = await runProcess(inv, { timeoutMs: job.timeoutMs + 10_000, signal, platform });
      const timedOut = r.status === "TIMEOUT" || r.exitCode === 124 || r.exitCode === 137;
      if (timedOut) throw engine("VINA_TIMEOUT", `Vina exceeded ${job.timeoutMs} ms`);
      if (r.status !== "OK") throw engine("VINA_FAILED", `Vina failed (exit ${r.exitCode}): ${scrubOutput(r.stderr || r.stdout, 600, inv.scrub)}`);
      return { durationMs: r.durationMs, log: scrubOutput(r.stdout, 8 * 1024, inv.scrub) };
    },
  };
}

// ---- job runner ------------------------------------------------------------------------------------------

function prepareOutDir(out) {
  if (!out || typeof out !== "string") throw bad("ARGS_INVALID", "--out is required");
  const dir = resolve(out);
  if (existsSync(dir)) {
    if (!statSync(dir).isDirectory()) throw bad("OUT_INVALID", "--out is not a directory");
    if (readdirSync(dir).length > 0) throw bad("OUT_INVALID", "--out must be empty or absent");
  } else {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function parseArgs(argv) {
  const a = { input: null, out: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if ((k === "--input" || k === "--out" || k === "--root") && typeof v === "string") {
      a[k.slice(2)] = v;
      i++;
    } else throw bad("ARGS_INVALID", `unknown or incomplete argument: ${String(k).slice(0, 40)}`);
  }
  if (!a.input || !a.out) throw bad("ARGS_INVALID", "usage: mole-dock run --input job.json --out <dir> [--root <dir>]");
  return a;
}

const writeJson = (dir, name, obj) => {
  const buf = Buffer.from(JSON.stringify(obj, null, 2) + "\n", "utf8");
  writeFileSync(join(dir, name), buf);
  return sha256(buf);
};

/**
 * Run one job. Returns {exitCode, result?, error?}; never throws. `engine` is injectable for tests.
 */
export async function runDockJob({ input, out, root }, { engineImpl, signal, pidfile, onStage } = {}) {
  const stage = (name) => {
    try {
      onStage?.(name);
    } catch {
      /* a progress hook never breaks the run */
    }
  };
  const t0 = Date.now();
  let outDir = null;
  try {
    const jobPath = resolve(input);
    if (!existsSync(jobPath) || !statSync(jobPath).isFile()) throw bad("JOB_MISSING", "job file not found");
    const allowedRoot = resolve(root ?? dirname(jobPath));
    if (!existsSync(allowedRoot) || !statSync(allowedRoot).isDirectory()) throw bad("ROOT_INVALID", "root is not a directory");
    const raw = readCapped(jobPath, JOB_FILE_CAP, "job.json");
    const { job, inputs } = validateJob(raw, { root: allowedRoot });
    outDir = prepareOutDir(out);
    const tValidated = Date.now();

    const eng = engineImpl ?? createVinaEngine();
    const pin = await eng.pin();
    // Copy the validated bytes so the digests describe exactly what Vina reads.
    mkdirSync(join(outDir, "inputs"));
    writeFileSync(join(outDir, "inputs", "receptor.pdbqt"), inputs.receptor.bytes);
    writeFileSync(join(outDir, "inputs", "ligand.pdbqt"), inputs.ligand.bytes);
    writeFileSync(join(outDir, "job.json"), raw);
    const verified = await eng.verify(outDir, pin);
    const tVerified = Date.now();
    if (signal?.aborted) throw engine("CANCELLED", "the job was cancelled");
    stage("dock");
    const docked = await eng.dock(outDir, job, verified, { signal, pidfile });
    stage("docked");
    const posesPath = join(outDir, "poses.pdbqt");
    if (!existsSync(posesPath)) throw engine("VINA_NO_OUTPUT", "Vina wrote no poses");
    const posesBuf = readCapped(posesPath, POSES_CAP, "poses.pdbqt");
    const poses = parseVinaPoses(posesBuf.toString("latin1"));
    if (poses.length === 0 || poses.some((p) => p.vinaScore === null || p.atoms.length === 0)) throw engine("VINA_OUTPUT_INVALID", "could not parse Vina poses");
    if (docked.log) writeFileSync(join(outDir, "vina.log"), docked.log);
    const tDone = Date.now();
    const result = {
      schemaVersion: 1,
      status: "OK",
      label: RESULT_LABEL,
      engine: { name: "AutoDock Vina", version: pin.version, versionReported: verified.versionLine, binarySha256: verified.binarySha256, pinnedSha256: pin.sha256 },
      inputs: {
        jobSha256: sha256(raw),
        receptor: { sha256: inputs.receptor.sha256, bytes: inputs.receptor.bytes.length, atoms: inputs.receptor.atoms },
        ligand: { sha256: inputs.ligand.sha256, bytes: inputs.ligand.bytes.length, atoms: inputs.ligand.atoms },
      },
      params: { box: job.box, exhaustiveness: job.exhaustiveness, numPoses: job.numPoses, energyRange: job.energyRange, seed: job.seed, cpu: job.cpu },
      vinaScore: poses[0].vinaScore,
      vinaScoreUnits: "kcal/mol (Vina estimate)",
      meScore: null,
      meScoreStatus: { status: "UNAVAILABLE", reason: "MOLE_SCORE_CLI_NOT_BUILT" }, // TODO(5.3 part 2): mole-score re-score per pose
      poses: poses.map((p) => ({ rank: p.rank, vinaScore: p.vinaScore, rmsdLbFromBest: p.rmsdLb, rmsdUbFromBest: p.rmsdUb, atomCount: p.atoms.length, meScore: null, terms: null })),
      outputs: { "poses.pdbqt": sha256(posesBuf) },
      timings: { validateMs: tValidated - t0, verifyMs: tVerified - tValidated, vinaMs: docked.durationMs, totalMs: tDone - t0 },
    };
    const resultSha = writeJson(outDir, "result.json", result);
    writeJson(outDir, "manifest.json", {
      schemaVersion: 1,
      kind: "mole-dock-run",
      status: "OK",
      label: RESULT_LABEL,
      files: { "result.json": resultSha, "poses.pdbqt": result.outputs["poses.pdbqt"], "inputs/receptor.pdbqt": inputs.receptor.sha256, "inputs/ligand.pdbqt": inputs.ligand.sha256, "job.json": result.inputs.jobSha256 },
      engineSha256: verified.binarySha256,
    });
    return { exitCode: EXIT_OK, result };
  } catch (e) {
    const typed = e instanceof DockError || (e && typeof e.exitCode === "number" && typeof e.code === "string");
    const err = typed ? e : engine("INTERNAL", String(e?.code || "unexpected error"));
    const error = { code: err.code, message: scrubOutput(err.message, 800, [outDir, root, input].filter(Boolean)) };
    if (outDir) {
      try {
        writeJson(outDir, "result.json", { schemaVersion: 1, status: "FAILED", label: RESULT_LABEL, error, meScore: null, poses: [] });
        writeJson(outDir, "manifest.json", { schemaVersion: 1, kind: "mole-dock-run", status: "FAILED", error });
      } catch {
        /* out dir not writable: stderr still carries the error */
      }
    }
    return { exitCode: err.exitCode, error };
  }
}

/** CLI: `run --input job.json --out <dir> [--root <dir>]`. Returns the exit code. */
export async function main(argv, deps = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(JSON.stringify({ error: { code: e.code, message: e.message } }) + "\n");
    return e.exitCode ?? EXIT_BAD_INPUT;
  }
  const r = await runDockJob(args, deps);
  if (r.exitCode === EXIT_OK) process.stdout.write(JSON.stringify({ status: "OK", vinaScore: r.result.vinaScore, poses: r.result.poses.length }) + "\n");
  else process.stderr.write(JSON.stringify({ error: r.error }) + "\n");
  return r.exitCode;
}

