import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PREP_PROFILE_ID } from "@molecular/contracts";

/**
 * Startup pin check for the preparation worker (task 5.2b). Compares, from repo files only:
 * - the lock digest (sha256 of workers/prep/requirements.lock.txt, LF-normalised) against TOOLS.md
 * - every direct pin in workers/prep/requirements.in against the TOOLS.md package table
 * - the Vina sha256 in TOOLS.md against the one scripts/wsl-setup.sh enforces
 * - the prep profile ID and entry point rows
 * Any mismatch fails closed: the job store refuses to plan (PROVENANCE_REPLAY).
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export type PrepPinFiles = Readonly<{ toolsMd: string; lock: string; requirementsIn: string; wslSetup: string }>;
export type PrepPinReport = Readonly<{
  ok: boolean;
  lockDigest: string;
  mismatches: readonly string[];
  /** TOOLS.md package table, normalised name (lower case, no -_.) -> pinned version. */
  tools?: Readonly<Record<string, string>>;
  /** TOOLS.md "Worker version" row. */
  workerVersion?: string;
}>;

const MAX_PIN_FILE_BYTES = 1024 * 1024;

export const lockDigestOf = (lockText: string): string => createHash("sha256").update(lockText.replace(/\r\n/g, "\n"), "utf8").digest("hex");

export const readPinFiles = (repoRoot: string = REPO_ROOT): PrepPinFiles => {
  const read = (...parts: string[]) => {
    const buf = readFileSync(join(repoRoot, ...parts));
    if (buf.length > MAX_PIN_FILE_BYTES) throw new Error("pin file too large");
    return buf.toString("utf8");
  };
  return {
    toolsMd: read("native", "third_party", "TOOLS.md"),
    lock: read("workers", "prep", "requirements.lock.txt"),
    requirementsIn: read("workers", "prep", "requirements.in"),
    wslSetup: read("scripts", "wsl-setup.sh"),
  };
};

const rowValue = (md: string, field: string): string | undefined => {
  const re = new RegExp(`^\\|\\s*${field}\\s*\\|\\s*\`([^\`]+)\``, "m");
  return re.exec(md)?.[1];
};

/** Normalised package name: "Dimorphite-DL" and "dimorphite_dl" both become "dimorphitedl". */
export const normTool = (name: string): string => name.toLowerCase().replace(/[-_.]+/g, "");

/** The TOOLS.md package table rows (`| Name | 1.2.3 | ...`), keyed by normalised name. */
export const toolsMdVersions = (md: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of md.split(/\r?\n/)) {
    const cols = line.split("|");
    if (cols.length < 4 || !line.startsWith("|")) continue;
    const name = cols[1]!.trim();
    const version = cols[2]!.trim();
    if (/^[A-Za-z][A-Za-z0-9_.-]{0,40}$/.test(name) && /^\d+(?:\.\d+)+[A-Za-z0-9.+-]*$/.test(version)) out[normTool(name)] = version;
  }
  return out;
};

export const checkPrepPins = (files: PrepPinFiles): PrepPinReport => {
  const mismatches: string[] = [];
  const lockDigest = lockDigestOf(files.lock);
  const recordedLock = rowValue(files.toolsMd, "Lock digest");
  if (recordedLock !== lockDigest) mismatches.push("LOCK_DIGEST");
  if (rowValue(files.toolsMd, "Profile ID") !== PREP_PROFILE_ID) mismatches.push("PROFILE_ID");
  if (!(rowValue(files.toolsMd, "Entry point") ?? "").endsWith("workers/prep/run_prep.py")) mismatches.push("ENTRY_POINT");
  for (const line of files.requirementsIn.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_.-]+)==([^\s#]+)/.exec(line.trim());
    if (!m) continue;
    const name = m[1]!.toLowerCase().replace(/[-_.]+/g, "");
    const version = m[2]!;
    const row = files.toolsMd.split(/\r?\n/).find((l) => l.startsWith("|") && l.split("|")[1]?.trim().toLowerCase().replace(/[-_.]+/g, "") === name);
    if (!row || row.split("|")[2]?.trim() !== version) mismatches.push(`PIN:${m[1]}`);
    const locked = new RegExp(`^${m[1]!.replace(/[-_.]/g, "[-_.]")}==([^\\s\\\\]+)`, "im").exec(files.lock)?.[1];
    if (locked !== version) mismatches.push(`LOCK_PIN:${m[1]}`);
  }
  const vina = /^\|\s*sha256\s*\|\s*`([0-9a-f]{64})`/m.exec(files.toolsMd)?.[1];
  const setupVina = /([0-9a-f]{64})\s+vina"\s*\|\s*sha256sum -c/.exec(files.wslSetup)?.[1];
  if (!vina || vina !== setupVina) mismatches.push("VINA_SHA256");
  const workerVersion = /^\|\s*Worker version\s*\|\s*`([^`]+)`/m.exec(files.toolsMd)?.[1];
  if (!workerVersion) mismatches.push("WORKER_VERSION");
  return Object.freeze({
    ok: mismatches.length === 0,
    lockDigest,
    mismatches: Object.freeze(mismatches),
    tools: Object.freeze(toolsMdVersions(files.toolsMd)),
    ...(workerVersion ? { workerVersion } : {}),
  });
};

/** What `run_prep.py --versions` reports (shape-checked by tools/mole-dock/prep.mjs parseVersionsReport). */
export type InstalledPrepTools = Readonly<{ profileId: string; workerVersion: string; lockDigest: string; python: string; tools: Readonly<Record<string, string>> }>;

/**
 * Installed-toolchain check (task 5.2b fix round): the ~/mole-prep venv, as the worker itself reports it, must
 * match the repo pins exactly. Every reported tool must be in the hash-pinned lock at the same version and,
 * when TOOLS.md has a row for it, at that version too; every TOOLS.md row that is in the lock must be reported;
 * lock digest, worker version, Python version and profile ID must match. Returns the mismatches ([] = pinned).
 */
export const checkInstalledTools = (installed: InstalledPrepTools, files: PrepPinFiles, pins: PrepPinReport): string[] => {
  const out: string[] = [];
  if (installed.lockDigest !== pins.lockDigest) out.push("INSTALLED_LOCK_DIGEST");
  if (installed.profileId !== PREP_PROFILE_ID) out.push("INSTALLED_PROFILE_ID");
  if (!pins.workerVersion || installed.workerVersion !== pins.workerVersion || installed.tools.mole_prep !== pins.workerVersion) out.push("INSTALLED_WORKER_VERSION");
  const python = /Python (\d+\.\d+\.\d+)/.exec(files.toolsMd)?.[1];
  if (!python || installed.python !== python) out.push("INSTALLED_PYTHON");
  const locked = new Map<string, string>();
  for (const m of files.lock.matchAll(/^([A-Za-z0-9_.-]+)==([^\s\\]+)/gm)) locked.set(normTool(m[1]!), m[2]!);
  const md = pins.tools ?? {};
  const reported = new Set<string>();
  for (const [dist, version] of Object.entries(installed.tools)) {
    if (dist === "mole_prep") continue;
    const n = normTool(dist);
    reported.add(n);
    if (locked.get(n) !== version) out.push(`INSTALLED_UNLOCKED:${dist}`.slice(0, 64));
    if (md[n] !== undefined && md[n] !== version) out.push(`INSTALLED_DRIFT:${dist}`.slice(0, 64));
  }
  for (const n of Object.keys(md)) if (locked.has(n) && !reported.has(n)) out.push(`INSTALLED_MISSING:${n}`.slice(0, 64));
  return out;
};

export type InstalledToolsProbeResult = Readonly<{ ok: true; report: InstalledPrepTools }> | Readonly<{ ok: false; error: string }>;
export type InstalledToolsProbe = () => Promise<InstalledToolsProbeResult>;
/** Returns the installed-toolchain mismatches; [] = the venv runs exactly the pinned tools. */
export type InstalledToolCheck = () => Promise<readonly string[]>;

/** Default probe: tools/mole-dock/prep.mjs probePrepVersions (the only spawn path). */
export const molePrepVersionsProbe: InstalledToolsProbe = async () => {
  const mod = (await import(pathToFileURL(join(REPO_ROOT, "tools", "mole-dock", "prep.mjs")).href)) as { probePrepVersions(): Promise<InstalledToolsProbeResult> };
  return mod.probePrepVersions();
};

/**
 * Cached installed-toolchain check, run before the first plan. A verdict (pinned or drifted) is cached for the
 * process, so drift fails closed until the venv is fixed and the API restarted. A probe that could not run
 * (WSL down, timeout) is not cached: the plan is refused (INSTALLED_TOOLS_UNVERIFIED) and the next one re-probes.
 */
export const createInstalledToolCheck = (
  probe: InstalledToolsProbe = molePrepVersionsProbe,
  files: () => PrepPinFiles = () => readPinFiles(),
  pins: () => PrepPinReport = repoPrepPins,
): InstalledToolCheck => {
  let verdict: readonly string[] | undefined;
  return async () => {
    if (verdict) return verdict;
    let r: InstalledToolsProbeResult;
    try {
      r = await probe();
    } catch {
      r = { ok: false, error: "VERSIONS_FAILED" };
    }
    if (!r.ok) return ["INSTALLED_TOOLS_UNVERIFIED"];
    try {
      verdict = Object.freeze(checkInstalledTools(r.report, files(), pins()));
    } catch {
      verdict = Object.freeze(["PIN_FILES_UNREADABLE"]);
    }
    return verdict;
  };
};

/** Stage tool -> the TOOLS.md rows its recorded version must equal (in order, "/"-joined for combined stages). */
const STAGE_PINS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "mole_prep.receptor_clean": ["@worker"],
  pdbfixer: ["pdbfixer"],
  "pdb2pqr+propka": ["pdb2pqr", "propka"],
  "meeko.receptor": ["meeko"],
  "rdkit.ligand": ["rdkit"],
  "meeko.ligand": ["meeko"],
  dimorphite_dl: ["dimorphitedl"],
});

export type PrepStageVersion = Readonly<{ tool: string; version: string; params?: Readonly<Record<string, unknown>> }>;

/**
 * Manifest drift check for the seal: every stages[].version (and PDBFixer's params.openmm) must equal TOOLS.md.
 * An unknown stage tool is drift too. Returns reason codes ([] = every stage ran the pinned tool).
 */
export const checkStageVersions = (stages: readonly PrepStageVersion[], pins: PrepPinReport): string[] => {
  const md = pins.tools;
  const worker = pins.workerVersion;
  if (!md || !worker) return ["TOOL_PINS_UNAVAILABLE"];
  const out = new Set<string>();
  for (const st of stages) {
    const rows = STAGE_PINS[st.tool];
    const expected = rows?.map((r) => (r === "@worker" ? worker : md[r]));
    if (!rows || !expected || expected.some((v) => !v) || st.version !== expected.join("/")) out.add(`TOOL_VERSION_DRIFT:${st.tool}`.slice(0, 64));
    if (st.tool === "pdbfixer" && st.params?.openmm !== md.openmm) out.add("TOOL_VERSION_DRIFT:openmm");
  }
  return [...out];
};

let cached: PrepPinReport | undefined;
/** Pin check over the checked-out repo; cached for the process. Unreadable files fail closed. */
export const repoPrepPins = (): PrepPinReport => {
  if (cached) return cached;
  try {
    cached = checkPrepPins(readPinFiles());
  } catch {
    cached = Object.freeze({ ok: false, lockDigest: "", mismatches: Object.freeze(["PIN_FILES_UNREADABLE"]) });
  }
  return cached;
};
