import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DockJobResultV1Schema, MoleDockRunManifestV1Schema, MoleDockRunResultV1Schema, type DockJobResultV1, type DockJobStateV1 } from "@molecular/contracts";
import { confinedPath, readCappedJson } from "./prepJobs.js";
import { REPO_ROOT } from "./prepPins.js";

/**
 * Docking runner adapter (task 5.4, design 5.4). The only engine path is tools/mole-dock/run.mjs `runDockJob`,
 * run in-process with an AbortSignal (runProcess tree-kills wsl.exe) plus a pidfile so the WSL process group can
 * be killed by pgid. The engine is injectable (tests use a fake that spawns a real long-running process).
 * Exit codes: 0 ok, 2 bad input, 3 engine error. Results stay PREVIEW_UNQUALIFIED with meScore null.
 */

export type VinaPin = Readonly<{ version: string; sha256: string }>;
export type DockStage = "dock" | "docked";
/** run.mjs engine interface (createVinaEngine); killGroup kills the process group named by a pidfile. */
export type DockEngine = Readonly<{
  pin(): Promise<VinaPin>;
  verify(outDir: string, pin: VinaPin): Promise<{ vina: string; binarySha256: string; versionLine: string }>;
  dock(outDir: string, job: unknown, verified: unknown, o: { signal?: AbortSignal; pidfile?: string }): Promise<{ durationMs: number; log: string }>;
  killGroup?(pidfile: string, outDir: string): Promise<unknown>;
}>;
/** Outcome of a group kill. gone: the engine group is confirmed empty (killed now, or already not running). */
export type KillReport = Readonly<{ gone: boolean; killed: boolean; pgid?: number; reason?: string }>;
export type KillOptions = Readonly<{
  /** How long to wait for a late pidfile (WSL cold start); 0 looks once. */
  waitMs?: number;
  /** Stop waiting for the pidfile early when this returns true. */
  stopWaiting?: () => boolean;
}>;
export type DockRunOutcome = Readonly<{ exitCode: number; error?: { code: string; message: string } }>;
export interface DockRunner {
  /** Vina pin from TOOLS.md; rejects when it is missing. */
  pin(): Promise<VinaPin>;
  run(o: { jobDir: string; signal: AbortSignal; onStage: (s: DockStage) => void }): Promise<DockRunOutcome>;
  /** pgid kill from <jobDir>/pid (async, never throws); waits up to waitMs for a late pidfile. */
  kill(jobDir: string, o?: KillOptions): Promise<KillReport>;
}

type RunModule = {
  runDockJob(a: { input: string; out: string; root: string }, d: { engineImpl?: DockEngine; signal?: AbortSignal; pidfile?: string; onStage?: (s: string) => void }): Promise<DockRunOutcome>;
  createVinaEngine(): DockEngine;
};
let runModule: Promise<RunModule> | undefined;
export const loadRunModule = (): Promise<RunModule> => (runModule ??= import(pathToFileURL(join(REPO_ROOT, "tools", "mole-dock", "run.mjs")).href) as Promise<RunModule>);

/** Fixed layout under <root>/<jobId>/ (design 5.4). */
export const DOCK_LAYOUT = Object.freeze({ state: "state.json", job: "job.json", events: "events.ndjson", inDir: "in", outDir: "out", pid: "pid", result: "out/job-result.json" });

export const createMoleDockRunner = (options: { engine?: DockEngine } = {}): DockRunner => {
  let engine: Promise<DockEngine> | undefined;
  const getEngine = () => (engine ??= options.engine ? Promise.resolve(options.engine) : loadRunModule().then((m) => m.createVinaEngine()));
  return {
    pin: async () => (await getEngine()).pin(),
    async run({ jobDir, signal, onStage }) {
      const [mod, eng] = await Promise.all([loadRunModule(), getEngine()]);
      return mod.runDockJob(
        { input: join(jobDir, DOCK_LAYOUT.job), out: join(jobDir, DOCK_LAYOUT.outDir), root: jobDir },
        { engineImpl: eng, signal, pidfile: join(jobDir, DOCK_LAYOUT.pid), onStage: (s) => (s === "dock" || s === "docked" ? onStage(s) : undefined) },
      );
    },
    async kill(jobDir, o = {}) {
      const pidfile = join(jobDir, DOCK_LAYOUT.pid);
      const waitMs = Math.max(0, o.waitMs ?? 1000);
      try {
        const eng = await getEngine();
        if (!eng.killGroup) return { gone: false, killed: false, reason: "NO_KILL_SUPPORT" };
        // A late pidfile (WSL cold start) is waited for here, bounded by waitMs.
        for (const t0 = Date.now(); !hasPid(pidfile) && Date.now() - t0 < waitMs && !o.stopWaiting?.(); ) await new Promise((r) => setTimeout(r, 50));
        if (!hasPid(pidfile)) return { gone: false, killed: false, reason: "NO_PIDFILE" };
        return toReport(await eng.killGroup(pidfile, join(jobDir, DOCK_LAYOUT.outDir)));
      } catch {
        return { gone: false, killed: false, reason: "KILL_ERROR" };
      }
    },
  };
};

const hasPid = (pidfile: string): boolean => {
  try {
    return /^[0-9]{1,9}$/.test(readFileSync(pidfile, "utf8").trim());
  } catch {
    return false;
  }
};
const toReport = (r: unknown): KillReport => {
  const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
  const reason = typeof o.reason === "string" ? o.reason.slice(0, 32) : undefined;
  return {
    gone: o.gone === true,
    killed: o.killed === true,
    ...(Number.isSafeInteger(o.pgid) ? { pgid: o.pgid as number } : {}),
    ...(reason ? { reason } : o.gone === true ? {} : { reason: "UNCONFIRMED" }),
  };
};

const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
const POSES_CAP = 32 * 1024 * 1024;
const RunResultSchema = MoleDockRunResultV1Schema;
const RunManifestSchema = MoleDockRunManifestV1Schema;

export class DockOutputError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

const hashFile = (dir: string, rel: string, cap: number): string => {
  const p = confinedPath(dir, rel);
  if (!existsSync(p) || !statSync(p).isFile() || statSync(p).size > cap) throw new DockOutputError(`OUTPUT_MISSING:${rel}`);
  return sha256(readFileSync(p));
};

/**
 * Exit 0: re-read result.json + manifest.json, zod-validate, re-hash poses and inputs, check the engine pin and
 * bind jobId + inputDigest. Throws DockOutputError (the job then FAILS); never fills anything in.
 */
export const collectDockResult = (jobDir: string, state: DockJobStateV1): DockJobResultV1 => {
  const out = join(jobDir, DOCK_LAYOUT.outDir);
  const r = RunResultSchema.safeParse(readCappedJson(confinedPath(out, "result.json")));
  if (!r.success) throw new DockOutputError("RESULT_INVALID");
  const m = RunManifestSchema.safeParse(readCappedJson(confinedPath(out, "manifest.json")));
  if (!m.success) throw new DockOutputError("MANIFEST_INVALID");
  const res = r.data;
  const man = m.data;
  const p = state.provenance;
  const poses = hashFile(out, "poses.pdbqt", POSES_CAP);
  if (poses !== res.outputs["poses.pdbqt"] || poses !== man.files["poses.pdbqt"]) throw new DockOutputError("POSES_DIGEST_MISMATCH");
  const rec = hashFile(out, "inputs/receptor.pdbqt", 16 * 1024 * 1024);
  const lig = hashFile(out, "inputs/ligand.pdbqt", 16 * 1024 * 1024);
  if (rec !== p.receptorSha256 || res.inputs.receptor.sha256 !== rec || man.files["inputs/receptor.pdbqt"] !== rec) throw new DockOutputError("RECEPTOR_DIGEST_MISMATCH");
  if (lig !== p.ligandSha256 || res.inputs.ligand.sha256 !== lig || man.files["inputs/ligand.pdbqt"] !== lig) throw new DockOutputError("LIGAND_DIGEST_MISMATCH");
  if (hashFile(out, "result.json", 4 * 1024 * 1024) !== man.files["result.json"]) throw new DockOutputError("RESULT_DIGEST_MISMATCH");
  if (res.engine.pinnedSha256 !== p.vinaPin.sha256 || res.engine.binarySha256 !== p.vinaPin.sha256 || man.engineSha256 !== p.vinaPin.sha256 || res.engine.version !== p.vinaPin.version) throw new DockOutputError("ENGINE_PIN_MISMATCH");
  return DockJobResultV1Schema.parse({
    schemaVersion: 1,
    jobId: state.jobId,
    inputDigest: state.inputDigest,
    label: "PREVIEW_UNQUALIFIED",
    vinaScore: res.vinaScore,
    meScore: null,
    meScoreStatus: res.meScoreStatus,
    poses: res.poses.map((x) => ({ rank: x.rank, vinaScore: x.vinaScore, rmsdLbFromBest: x.rmsdLbFromBest, rmsdUbFromBest: x.rmsdUbFromBest, atomCount: x.atomCount, meScore: null })),
    posesSha256: poses,
    provenance: { ...p, vina: { versionReported: res.engine.versionReported.slice(0, 80), binarySha256: res.engine.binarySha256 } },
  });
};
