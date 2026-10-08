import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
export type PrepPinReport = Readonly<{ ok: boolean; lockDigest: string; mismatches: readonly string[] }>;

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
  return Object.freeze({ ok: mismatches.length === 0, lockDigest, mismatches: Object.freeze(mismatches) });
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
