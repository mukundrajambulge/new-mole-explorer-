import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  PrepConfirmationV1Schema,
  PrepJobStateV1Schema,
  PrepManifestV1Schema,
  PrepPlanV1Schema,
  type PrepareRequest,
  type PrepConfirmationV1,
  type PrepJobStateV1,
  type PrepManifestV1,
  type PrepPlanV1,
  type PrepSealSummaryV1,
} from "@molecular/contracts";
import { createInstalledToolCheck, REPO_ROOT, repoPrepPins, type InstalledToolCheck, type PrepPinReport } from "./prepPins.js";

/**
 * Preparation job store (task 5.2b, design 5.2 step 5).
 * - one UUID directory per job under `<root>/` (root = project data dir + "/prep-jobs"), atomic writes
 * - one transition table; AWAITING_CONFIRMATION expires after 30 min; one worker process at a time
 * - APPLYING jobs (and directories whose plan never committed) become FAILED on restart
 * The client never supplies chemistry, sha256 values or profile digests: artifacts are resolved server-side.
 */

export type PrepJobStateName = PrepJobStateV1["state"];
export const PREP_TRANSITIONS: Readonly<Record<PrepJobStateName, readonly PrepJobStateName[]>> = Object.freeze({
  AWAITING_CONFIRMATION: ["APPLYING", "EXPIRED", "FAILED"],
  APPLYING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  EXPIRED: [],
});
export const PREP_TTL_MS = 30 * 60_000;
export const PREP_MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;
const MAX_JSON_FILE_BYTES = 4 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIGAND_FORMATS = new Set(["sdf", "mol", "mol2", "smi", "pdb"]);

export type PrepArtifact = Readonly<{ format: string; bytes: Buffer }>;
/** Server-side artifact lookup: the id is opaque, the bytes and format come from server storage only. */
export type PrepArtifactResolver = (artifactId: string) => Promise<PrepArtifact | undefined>;
export type PrepRunStatus = "OK" | "BLOCKED" | "FAILED" | "TIMEOUT" | "CANCELLED";
export type PrepRunner = (mode: "plan" | "apply", jobDir: string) => Promise<Readonly<{ status: PrepRunStatus; stderr: string }>>;
/** Called after a PREPARED apply; re-hashes outputs and seals (prepSeal.ts). Injected to keep the store testable. */
export type PrepSealer = (store: PrepJobStore, jobId: string) => Promise<PrepSealSummaryV1>;

export class PrepError extends Error {
  constructor(readonly code: string, readonly httpStatus: number, message: string) {
    super(message);
  }
}

/** Default runner: the only spawn path, tools/mole-dock/prep.mjs. */
export const molePrepRunner: PrepRunner = async (mode, jobDir) => {
  const mod = (await import(pathToFileURL(join(REPO_ROOT, "tools", "mole-dock", "prep.mjs")).href)) as {
    runPrep(o: { mode: string; jobDir: string }): Promise<{ status: PrepRunStatus; stderr: string }>;
  };
  const r = await mod.runPrep({ mode, jobDir });
  return { status: r.status, stderr: r.stderr };
};

/** Write via a temp file + rename so readers never see a partial file. */
export const writeAtomic = (path: string, data: string | Buffer): void => {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
};

/** Resolve a relative path inside root; rejects traversal, absolute paths and backslashes. Never echoes the path. */
export const confinedPath = (root: string, relPath: string): string => {
  if (typeof relPath !== "string" || !relPath || relPath.length > 260 || relPath.includes("\\") || relPath.includes("\0") || relPath.startsWith("/") || /^[A-Za-z]:/.test(relPath) || relPath.split("/").some((s) => s === ".." || s === "." || s === "")) {
    throw new PrepError("PATH_REJECTED", 400, "The requested path is not allowed.");
  }
  const base = resolve(root);
  const target = resolve(base, ...relPath.split("/"));
  if (!target.startsWith(base + sep)) throw new PrepError("PATH_REJECTED", 400, "The requested path is not allowed.");
  return target;
};

export const readCappedJson = (path: string, cap = MAX_JSON_FILE_BYTES): unknown => {
  const st = statSync(path);
  if (!st.isFile() || st.size > cap) throw new PrepError("OUTPUT_REJECTED", 422, "A job file is missing or too large.");
  return JSON.parse(readFileSync(path, "utf8"));
};

/** Remove anything path-like from worker text and cap it (the worker already scrubs; this is defence in depth). */
export const scrubText = (text: string, extra: readonly string[] = []): string => {
  let s = String(text);
  for (const p of [...extra].filter(Boolean).sort((a, b) => b.length - a.length)) s = s.split(p).join("<job>");
  s = s.replace(/[A-Za-z]:[\\/][^\s"'<>|]*/g, "<path>").replace(/\/(?:mnt|home|tmp|usr|root|Users|var|private)\/[^\s"'<>|]*/g, "<path>");
  return s.replace(/\s+/g, " ").trim().slice(0, 400);
};

export type PrepJobStoreOptions = Readonly<{
  root: string;
  resolveArtifact: PrepArtifactResolver;
  runner?: PrepRunner;
  sealer?: PrepSealer;
  pins?: () => PrepPinReport;
  /** Installed-toolchain check (the venv versions the worker reports vs TOOLS.md); default probes WSL once. */
  installedTools?: InstalledToolCheck;
  now?: () => number;
  ttlMs?: number;
  /** Quota: live + retained jobs on disk (default 32) and their total bytes (default 2 GiB). */
  maxJobs?: number;
  maxBytes?: number;
  /** Retention of FAILED/EXPIRED jobs (default 1 h) and SUCCEEDED jobs (default 24 h). */
  retainTerminalMs?: number;
  retainSucceededMs?: number;
}>;

export const PREP_MAX_JOBS = 32;
export const PREP_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/** Bytes under a job dir (a handful of files; bounded depth). */
const dirBytes = (dir: string, depth = 0): number => {
  if (depth > 4) return 0;
  let n = 0;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) n += dirBytes(p, depth + 1);
      else if (e.isFile()) n += statSync(p).size;
    }
  } catch {
    return n;
  }
  return n;
};

export class PrepJobStore {
  readonly root: string;
  private runner: PrepRunner;
  private readonly maxJobs: number;
  private readonly maxBytes: number;
  private readonly retainTerminalMs: number;
  private readonly retainSucceededMs: number;
  private sealer: PrepSealer | undefined;
  private installedTools: InstalledToolCheck;
  private readonly resolveArtifact: PrepArtifactResolver;
  private readonly pins: () => PrepPinReport;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly states = new Map<string, PrepJobStateV1>();
  private busy = false;

  constructor(options: PrepJobStoreOptions) {
    this.root = resolve(options.root);
    this.runner = options.runner ?? molePrepRunner;
    this.sealer = options.sealer;
    this.installedTools = options.installedTools ?? createInstalledToolCheck();
    this.resolveArtifact = options.resolveArtifact;
    this.pins = options.pins ?? repoPrepPins;
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? PREP_TTL_MS;
    this.maxJobs = options.maxJobs ?? PREP_MAX_JOBS;
    this.maxBytes = options.maxBytes ?? PREP_MAX_BYTES;
    this.retainTerminalMs = options.retainTerminalMs ?? 60 * 60_000;
    this.retainSucceededMs = options.retainSucceededMs ?? 24 * 60 * 60_000;
  }

  /** Load persisted jobs. In-flight work cannot survive a restart: APPLYING and uncommitted dirs become FAILED. */
  init(): void {
    mkdirSync(this.root, { recursive: true });
    for (const name of readdirSync(this.root)) {
      if (!UUID_RE.test(name)) continue;
      const dir = join(this.root, name);
      let state: PrepJobStateV1 | undefined;
      try {
        state = PrepJobStateV1Schema.parse(readCappedJson(join(dir, "state.json")));
        if (state.jobId !== name) state = undefined;
      } catch {
        state = undefined;
      }
      if (!state) {
        const t = new Date(statSync(dir).mtimeMs).toISOString();
        state = { schemaVersion: 1, jobId: name, state: "FAILED", error: "INTERRUPTED: the plan never completed (server restart)", createdAt: t, expiresAt: t };
        this.persist(state);
      } else if (state.state === "APPLYING") {
        state = this.transition(state, "FAILED", { error: "INTERRUPTED: the server restarted while preparing" });
      }
      this.states.set(name, state);
    }
    this.gc();
  }

  jobDir(jobId: string): string {
    if (!UUID_RE.test(jobId)) throw new PrepError("NOT_FOUND", 404, "Preparation job not found.");
    return join(this.root, jobId);
  }

  get(jobId: string): PrepJobStateV1 {
    const s = this.states.get(jobId);
    if (!UUID_RE.test(jobId) || !s) throw new PrepError("NOT_FOUND", 404, "Preparation job not found.");
    return this.expireIfDue(s);
  }

  private expireIfDue(s: PrepJobStateV1): PrepJobStateV1 {
    if (s.state === "AWAITING_CONFIRMATION" && this.now() >= Date.parse(s.expiresAt)) return this.transition(s, "EXPIRED", { error: "EXPIRED: the plan was not confirmed within 30 minutes" });
    return s;
  }

  private persist(s: PrepJobStateV1): PrepJobStateV1 {
    const parsed = PrepJobStateV1Schema.parse({ ...s, updatedAt: new Date(this.now()).toISOString() });
    writeAtomic(join(this.jobDir(parsed.jobId), "state.json"), JSON.stringify(parsed, null, 1) + "\n");
    this.states.set(parsed.jobId, parsed);
    return parsed;
  }

  private transition(s: PrepJobStateV1, to: PrepJobStateName, patch: Partial<PrepJobStateV1> = {}): PrepJobStateV1 {
    if (!PREP_TRANSITIONS[s.state].includes(to)) throw new PrepError("INVALID_TRANSITION", 409, `Preparation job cannot move from ${s.state} to ${to}.`);
    const next: PrepJobStateV1 = { ...s, ...patch, state: to };
    if (patch.error !== undefined) next.error = scrubText(patch.error, [this.jobDir(s.jobId), this.root]).slice(0, 500);
    const saved = this.persist(next);
    if (PREP_TRANSITIONS[to].length === 0) this.dropInputs(s.jobId);
    return saved;
  }

  /** Staged inputs are reproducible from the artifact store; a terminal job does not keep them. */
  private dropInputs(jobId: string): void {
    try {
      rmSync(join(this.jobDir(jobId), "in"), { recursive: true, force: true });
    } catch {
      // best effort; gc() removes the whole directory later
    }
  }

  private terminalAgeMs(s: PrepJobStateV1): number {
    const at = Date.parse(s.updatedAt ?? s.createdAt);
    return Number.isFinite(at) ? this.now() - at : Number.POSITIVE_INFINITY;
  }

  private removeJob(jobId: string): void {
    rmSync(this.jobDir(jobId), { recursive: true, force: true });
    this.states.delete(jobId);
  }

  /**
   * Garbage collection and quota. Terminal jobs are deleted after their retention; when the job count or the
   * bytes on disk exceed the quota the oldest terminal jobs go first. Live jobs (AWAITING_CONFIRMATION,
   * APPLYING) are never deleted; if they alone fill the quota, plan() is refused.
   */
  gc(reserve = 0): { jobs: number; bytes: number } {
    const terminal: PrepJobStateV1[] = [];
    for (const s0 of [...this.states.values()]) {
      const s = this.expireIfDue(s0);
      if (PREP_TRANSITIONS[s.state].length) continue;
      const retain = s.state === "SUCCEEDED" ? this.retainSucceededMs : this.retainTerminalMs;
      if (this.terminalAgeMs(s) >= retain) this.removeJob(s.jobId);
      else terminal.push(s);
    }
    terminal.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const sizes = new Map<string, number>();
    let bytes = 0;
    for (const id of this.states.keys()) {
      const n = dirBytes(this.jobDir(id));
      sizes.set(id, n);
      bytes += n;
    }
    while (terminal.length && (this.states.size + reserve > this.maxJobs || bytes > this.maxBytes)) {
      const victim = terminal.shift()!;
      bytes -= sizes.get(victim.jobId) ?? 0;
      this.removeJob(victim.jobId);
    }
    return { jobs: this.states.size, bytes };
  }

  /** Test seam: replace the worker runner (the default is the mole-dock spawn wrapper). */
  replaceRunner(runner: PrepRunner): void {
    this.runner = runner;
  }

  /** Test seam: replace the sealer (the server default is prepSummarySealer with server constants only). */
  replaceSealer(sealer: PrepSealer): void {
    this.sealer = sealer;
  }

  /** Test seam: replace the installed-toolchain check (the default spawns the worker's --versions in WSL). */
  replaceInstalledToolCheck(check: InstalledToolCheck): void {
    this.installedTools = check;
  }

  private acquire(): void {
    if (this.busy) throw new PrepError("BUSY", 429, "Another preparation job is running; try again shortly.");
    const pins = this.pins();
    if (!pins.ok) throw new PrepError("PROVENANCE_REPLAY", 503, `Preparation is unavailable: pinned toolchain mismatch (${pins.mismatches.join(",").slice(0, 200)}).`);
    this.busy = true;
  }

  /** Create a job, stage the server-held artifacts and run the worker's --plan. */
  async plan(request: PrepareRequest): Promise<PrepJobStateV1> {
    this.acquire();
    try {
      const drift = await this.installedTools();
      if (drift.length) throw new PrepError("PROVENANCE_REPLAY", 503, `Preparation is unavailable: the installed toolchain does not match TOOLS.md (${drift.join(",").slice(0, 200)}).`);
      const usage = this.gc(1);
      if (usage.jobs >= this.maxJobs || usage.bytes >= this.maxBytes) throw new PrepError("QUOTA_EXCEEDED", 429, "Too many preparation jobs are stored; confirm or wait for pending plans to expire.");
      const [rec, lig, tpl] = await Promise.all([
        this.resolveArtifact(request.receptorArtifactId),
        this.resolveArtifact(request.ligandArtifactId),
        request.ligandTemplateArtifactId ? this.resolveArtifact(request.ligandTemplateArtifactId) : Promise.resolve(undefined),
      ]);
      if (!rec || !lig || (request.ligandTemplateArtifactId && !tpl)) throw new PrepError("ARTIFACT_NOT_FOUND", 404, "An artifact id was not found.");
      for (const a of [rec, lig, tpl]) if (a && a.bytes.length > PREP_MAX_ARTIFACT_BYTES) throw new PrepError("OVERSIZE_INPUT", 413, "An input artifact exceeds 20 MB.");
      if (rec.format !== "pdb") throw new PrepError("UNSUPPORTED_FORMAT", 422, "The receptor must be a PDB artifact.");
      if (!LIGAND_FORMATS.has(lig.format)) throw new PrepError("UNSUPPORTED_FORMAT", 422, "The ligand format is not supported.");
      if (tpl && tpl.format !== "smi") throw new PrepError("UNSUPPORTED_FORMAT", 422, "The ligand template must be a SMILES artifact.");
      const jobId = randomUUID();
      const dir = this.jobDir(jobId);
      mkdirSync(join(dir, "in"), { recursive: true });
      writeAtomic(join(dir, "in", "receptor.pdb"), rec.bytes);
      writeAtomic(join(dir, "in", `ligand.${lig.format}`), lig.bytes);
      if (tpl) writeAtomic(join(dir, "in", "template.smi"), tpl.bytes);
      const job = {
        schemaVersion: 1,
        jobId,
        receptor: { artifactId: request.receptorArtifactId, relPath: "in/receptor.pdb", format: "pdb" },
        ligand: { artifactId: request.ligandArtifactId, relPath: `in/ligand.${lig.format}`, format: lig.format },
        ...(tpl && request.ligandTemplateArtifactId ? { ligandTemplate: { artifactId: request.ligandTemplateArtifactId, relPath: "in/template.smi", format: "smi" } } : {}),
        options: { pH: request.pH, protonation: request.protonation, ligandProtonation: request.ligandProtonation, chainIds: request.chainIds ?? null, keepWaters: request.keepWaters, addMissingAtoms: request.addMissingAtoms },
      };
      writeAtomic(join(dir, "job.json"), JSON.stringify(job));
      const t = this.now();
      const base: PrepJobStateV1 = { schemaVersion: 1, jobId, state: "AWAITING_CONFIRMATION", createdAt: new Date(t).toISOString(), expiresAt: new Date(t + this.ttlMs).toISOString() };
      const run = await this.runner("plan", dir);
      let plan: PrepPlanV1 | undefined;
      if (run.status === "OK" || run.status === "BLOCKED") {
        try {
          plan = PrepPlanV1Schema.parse(readCappedJson(confinedPath(dir, "plan.json")));
        } catch {
          plan = undefined;
        }
      }
      if (!plan || plan.jobId !== jobId || plan.receptorArtifactId !== request.receptorArtifactId || plan.ligandArtifactId !== request.ligandArtifactId) {
        const failed: PrepJobStateV1 = { ...base, state: "FAILED", error: scrubText(`PLAN_FAILED: ${run.status}${run.stderr ? `: ${run.stderr}` : ""}`, [dir, this.root]) };
        this.persist(failed);
        return failed;
      }
      // The plan's options must echo the server-side request; the sealer binds qualification to them (prepSeal).
      const po = plan.options;
      if (po && (po.protonation !== request.protonation || po.ligandProtonation !== request.ligandProtonation || po.pH !== request.pH || po.keepWaters !== request.keepWaters || po.addMissingAtoms !== request.addMissingAtoms || po.ligandTemplate !== !!request.ligandTemplateArtifactId)) {
        const failed: PrepJobStateV1 = { ...base, state: "FAILED", error: "PLAN_FAILED: PLAN_OPTIONS_MISMATCH" };
        this.persist(failed);
        return failed;
      }
      if (plan.status === "BLOCKED" || run.status === "BLOCKED") {
        const blocked: PrepJobStateV1 = { ...base, state: "FAILED", plan, error: scrubText(`BLOCKED: ${(plan.diagnostics ?? []).join("; ") || "the worker blocked this plan"}`, [dir, this.root]) };
        this.persist(blocked);
        return blocked;
      }
      const ready: PrepJobStateV1 = { ...base, plan };
      this.persist(ready);
      return ready;
    } finally {
      this.busy = false;
    }
  }

  /**
   * Single-use confirmation. 409 on a forged/stale planDigest, a reused confirmation or a job that is not
   * awaiting confirmation. Returns the APPLYING state and a promise for the final state.
   */
  confirm(jobId: string, body: unknown): { state: PrepJobStateV1; done: Promise<PrepJobStateV1> } {
    const parsed = PrepConfirmationV1Schema.safeParse(body);
    if (!parsed.success) throw new PrepError("INVALID_INPUT", 400, "The confirmation is invalid.");
    const conf: PrepConfirmationV1 = parsed.data;
    const current = this.get(jobId);
    if (conf.jobId !== jobId) throw new PrepError("INVALID_INPUT", 400, "The confirmation is for another job.");
    if (current.state !== "AWAITING_CONFIRMATION") throw new PrepError(current.state === "EXPIRED" ? "EXPIRED" : "ALREADY_CONFIRMED", 409, "This plan can no longer be confirmed.");
    if (!current.plan || conf.planDigest !== current.plan.planDigest) throw new PrepError("PLAN_DIGEST_MISMATCH", 409, "The planDigest does not match the stored plan.");
    this.acquire();
    let applying: PrepJobStateV1;
    try {
      writeAtomic(join(this.jobDir(jobId), "confirmation.json"), JSON.stringify(conf));
      applying = this.transition(current, "APPLYING");
    } catch (e) {
      this.busy = false;
      throw e;
    }
    const done = this.apply(applying).finally(() => {
      this.busy = false;
    });
    return { state: applying, done };
  }

  private async apply(applying: PrepJobStateV1): Promise<PrepJobStateV1> {
    const dir = this.jobDir(applying.jobId);
    try {
      const run = await this.runner("apply", dir);
      if (run.status !== "OK" && run.status !== "BLOCKED") return this.transition(applying, "FAILED", { error: `APPLY_FAILED: ${run.status}${run.stderr ? `: ${run.stderr}` : ""}` });
      const manifest = this.readManifest(applying);
      if (manifest.status !== "PREPARED") return this.transition(applying, "FAILED", { manifest, error: `BLOCKED: ${manifest.diagnostics.join("; ") || "the worker blocked this job"}` });
      if (!this.sealer) return this.transition(applying, "FAILED", { manifest, error: "SEAL_UNAVAILABLE: no server sealer is configured" });
      const staged: PrepJobStateV1 = { ...applying, manifest };
      this.states.set(applying.jobId, staged);
      const seal = await this.sealer(this, applying.jobId);
      if (seal.status === "REJECTED") return this.transition(applying, "FAILED", { manifest, seal, error: `OUTPUT_REJECTED: ${seal.reasonCodes.join(",")}` });
      // SUCCEEDED means the worker finished and every output re-hashed. Prepared ids (the only handles a later
      // docking step accepts) are minted for a SEALED result only; BLOCKED/PREVIEW_UNQUALIFIED stay unsealed.
      // A PREVIEW_UNQUALIFIED result gets separate opaque preview ids instead (job + 96-bit random token, never
      // derivable from the client-known job id); docking accepts them only as PREVIEW_UNQUALIFIED (task 5.4).
      const compact = applying.jobId.replace(/-/g, "");
      if (seal.status === "PREVIEW_UNQUALIFIED") {
        return this.transition(applying, "SUCCEEDED", { manifest, seal, previewReceptorId: `pvrec_${compact}_${randomBytes(12).toString("hex")}`, previewLigandId: `pvlig_${compact}_${randomBytes(12).toString("hex")}` });
      }
      if (seal.status !== "SEALED") return this.transition(applying, "SUCCEEDED", { manifest, seal });
      return this.transition(applying, "SUCCEEDED", { manifest, seal, preparedReceptorId: `prec_${compact}`, preparedLigandId: `plig_${compact}` });
    } catch (e) {
      const latest = this.states.get(applying.jobId) ?? applying;
      const code = e instanceof PrepError ? e.code : "INTERNAL_ERROR";
      return this.transition(latest.state === "APPLYING" ? latest : applying, "FAILED", { error: `${code}: ${e instanceof PrepError ? e.message : "preparation could not be completed"}` });
    }
  }

  /** Parse prep-manifest.json and bind it to this job's stored plan (never to anything the client sent). */
  readManifest(state: PrepJobStateV1): PrepManifestV1 {
    const dir = this.jobDir(state.jobId);
    const p = confinedPath(dir, "prep-manifest.json");
    if (!existsSync(p)) throw new PrepError("OUTPUT_REJECTED", 422, "The worker did not write a manifest.");
    const parsed = PrepManifestV1Schema.safeParse(readCappedJson(p));
    if (!parsed.success) throw new PrepError("OUTPUT_REJECTED", 422, "The worker manifest is invalid.");
    const m = parsed.data;
    if (m.jobId !== state.jobId) throw new PrepError("OUTPUT_REJECTED", 422, "The manifest is for another job.");
    if (m.status === "PREPARED" && (!state.plan || m.planDigest !== state.plan.planDigest)) throw new PrepError("OUTPUT_REJECTED", 422, "The manifest does not bind the confirmed plan.");
    return m;
  }
}
