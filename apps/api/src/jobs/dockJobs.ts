import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, truncateSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  DOCK_JOB_TERMINAL_STATUSES,
  DockJobRequestSchema,
  DockJobResultV1Schema,
  DockJobStateV1Schema,
  JOB_CAPS,
  JobEventSchema,
  type DockJobProvenanceV1,
  type DockJobRequest,
  type DockJobResultV1,
  type DockJobStateV1,
  type DockJobStatusName,
  type JobEvent,
  type PrepJobStateV1,
} from "@molecular/contracts";
import { collectDockResult, createMoleDockRunner, DOCK_LAYOUT, DockOutputError, type DockRunner, type VinaPin } from "./dockRunner.js";
import { confinedPath, PrepError, readCappedJson, scrubText, type PrepJobStore } from "./prepJobs.js";

/**
 * Docking job store and runner loop (task 5.4, design docs/sprint/design/5.4.md).
 * - file store on the prepJobs patterns: one UUID dir per job under <root>/, atomic state.json, append-only
 *   events.ndjson (monotonic seq, torn last line dropped), one transition table, TTL + gc, quota
 * - one Vina at a time (FIFO), queue max 8; cancel writes CANCELLED first, then aborts and kills the pgid
 * - crash recovery: a new bootId per start; PREPARING/RUNNING from another boot -> FAILED API_RESTARTED
 *   (never resumed); QUEUED with intact inputs is requeued; corrupt dirs are quarantined
 * - dedupe: inputDigest over server-resolved inputs; live or SUCCEEDED jobs are reused
 * Results stay PREVIEW_UNQUALIFIED with meScore null. HTTP/SSE is task 5.5.
 */

export const DOCK_TRANSITIONS: Readonly<Record<DockJobStatusName, readonly DockJobStatusName[]>> = Object.freeze({
  QUEUED: ["PREPARING", "CANCELLED", "FAILED"],
  PREPARING: ["RUNNING", "CANCELLED", "FAILED"],
  RUNNING: ["SUCCEEDED", "CANCELLED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
});
const TERMINAL = new Set<DockJobStatusName>(DOCK_JOB_TERMINAL_STATUSES);
const LIVE = new Set<DockJobStatusName>(["QUEUED", "PREPARING", "RUNNING"]);
const PROGRESS: Readonly<Record<DockJobStatusName, number>> = { QUEUED: 0, PREPARING: 0.05, RUNNING: 0.1, SUCCEEDED: 1, FAILED: 1, CANCELLED: 1 };
export const DOCK_MAX_QUEUE = 8;
export const DOCK_MAX_JOBS = 32;
export const DOCK_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const DOCK_CPU = 4;
export const DOCK_TIMEOUT_MS = 600_000;
const PDBQT_CAP = 16 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREC_RE = /^prec_([0-9a-f]{32})$/;
const PLIG_RE = /^plig_([0-9a-f]{32})$/;

export class DockJobError extends Error {
  constructor(readonly code: string, readonly httpStatus: number, message: string) {
    super(message);
  }
}

const sha256 = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const canonicalJson = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};
const uuidOf = (compact: string): string => `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Same retry as prepJobs.writeAtomic, plus Windows rename EPERM/EBUSY retries (a reader may hold the file). */
export const writeAtomicRetry = (path: string, data: string | Buffer): void => {
  const tmp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tmp, data);
  for (let i = 0; ; i++) {
    try {
      renameSync(tmp, path);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i >= 20 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
        rmSync(tmp, { force: true });
        throw e;
      }
      const until = Date.now() + 10 * (i + 1);
      while (Date.now() < until) {
        /* short synchronous back-off; keeps transitions atomic within one tick */
      }
    }
  }
};

export type ResolvedInput = Readonly<{ receptor: Buffer; ligand: Buffer; provenance: Omit<DockJobProvenanceV1, "seed" | "vinaPin" | "vina"> }>;
export type PreparedResolver = (receptorId: string, ligandId: string) => Promise<ResolvedInput>;

/**
 * Prepared ids -> PDBQT bytes, through the prep job store only. The prep job must be SUCCEEDED with seal
 * SEALED (ids must match the minted ones) or PREVIEW_UNQUALIFIED; BLOCKED/REJECTED is 400. The manifest sha256
 * of each PDBQT is re-verified before the bytes are used.
 */
export const createPrepResolver = (prep: PrepJobStore): PreparedResolver => async (receptorId, ligandId) => {
  const r = PREC_RE.exec(receptorId);
  const l = PLIG_RE.exec(ligandId);
  if (!r || !l) throw new DockJobError("BAD_INPUT", 400, "Prepared ids must be prec_<id> and plig_<id>.");
  const load = (compact: string): PrepJobStateV1 => {
    try {
      return prep.get(uuidOf(compact));
    } catch (e) {
      if (e instanceof PrepError) throw new DockJobError("NOT_FOUND", 404, "A prepared id was not found.");
      throw e;
    }
  };
  const recJob = load(r[1]);
  const ligJob = load(l[1]);
  const read = async (job: PrepJobStateV1, role: "RECEPTOR_PDBQT" | "LIGAND_PDBQT", id: string): Promise<Buffer> => {
    const seal = job.seal?.status;
    if (job.state !== "SUCCEEDED" || (seal !== "SEALED" && seal !== "PREVIEW_UNQUALIFIED")) throw new DockJobError("BAD_INPUT", 400, "The prepared input is not sealed (BLOCKED, REJECTED or unfinished).");
    if (seal === "SEALED" && (role === "RECEPTOR_PDBQT" ? job.preparedReceptorId : job.preparedLigandId) !== id) throw new DockJobError("BAD_INPUT", 400, "The prepared id does not match its preparation job.");
    const out = job.manifest?.outputs.find((o) => o.role === role);
    if (!out) throw new DockJobError("BAD_INPUT", 400, "The prepared output is missing.");
    let bytes: Buffer;
    try {
      const p = confinedPath(prep.jobDir(job.jobId), out.relPath);
      if (statSync(p).size > PDBQT_CAP) throw new Error("too large");
      bytes = await readFile(p);
    } catch {
      throw new DockJobError("BAD_INPUT", 400, "The prepared output is no longer available.");
    }
    if (bytes.length !== out.bytes || sha256(bytes) !== out.sha256) throw new DockJobError("BAD_INPUT", 400, "The prepared output no longer matches its manifest.");
    return bytes;
  };
  const [receptor, ligand] = await Promise.all([read(recJob, "RECEPTOR_PDBQT", receptorId), read(ligJob, "LIGAND_PDBQT", ligandId)]);
  const seals = [recJob.seal!.status, ligJob.seal!.status];
  const quals = [recJob.seal!.qualification, ligJob.seal!.qualification];
  return {
    receptor,
    ligand,
    provenance: {
      preparedReceptorId: receptorId,
      preparedLigandId: ligandId,
      prepJobId: recJob.jobId,
      prepSealStatus: seals.every((s) => s === "SEALED") ? "SEALED" : "PREVIEW_UNQUALIFIED",
      prepQualification: quals.every((q) => q === "INTERIM") ? "INTERIM" : "PREVIEW_UNQUALIFIED",
      receptorSha256: sha256(receptor),
      ligandSha256: sha256(ligand),
    },
  };
};

export type DockJobStoreOptions = Readonly<{
  root: string;
  resolvePrepared: PreparedResolver;
  runner?: DockRunner;
  now?: () => number;
  maxQueue?: number;
  maxJobs?: number;
  maxBytes?: number;
  retainTerminalMs?: number;
  retainSucceededMs?: number;
  timeoutMs?: number;
}>;
export type DockSubmitResult = Readonly<{ job: DockJobStateV1; deduped: boolean }>;
type Listener = (e: JobEvent) => void;

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

export class DockJobStore {
  readonly root: string;
  readonly bootId = randomUUID();
  private readonly runner: DockRunner;
  private readonly resolvePrepared: PreparedResolver;
  private readonly now: () => number;
  private readonly maxQueue: number;
  private readonly maxJobs: number;
  private readonly maxBytes: number;
  private readonly retainTerminalMs: number;
  private readonly retainSucceededMs: number;
  private readonly timeoutMs: number;
  private readonly states = new Map<string, DockJobStateV1>();
  private readonly byDigest = new Map<string, string>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly queue: string[] = [];
  private active: { jobId: string; ac: AbortController; done: Promise<void> } | null = null;
  private readonly kills = new Set<Promise<void>>();
  private lockHeld = false;
  private closed = false;

  constructor(options: DockJobStoreOptions) {
    this.root = resolve(options.root);
    this.resolvePrepared = options.resolvePrepared;
    this.runner = options.runner ?? createMoleDockRunner();
    this.now = options.now ?? Date.now;
    this.maxQueue = options.maxQueue ?? DOCK_MAX_QUEUE;
    this.maxJobs = options.maxJobs ?? DOCK_MAX_JOBS;
    this.maxBytes = options.maxBytes ?? DOCK_MAX_BYTES;
    this.retainTerminalMs = options.retainTerminalMs ?? 60 * 60_000;
    this.retainSucceededMs = options.retainSucceededMs ?? 24 * 60 * 60_000;
    this.timeoutMs = options.timeoutMs ?? DOCK_TIMEOUT_MS;
  }

  // ---- lock ------------------------------------------------------------------------------------------------

  /** root/.lock (O_EXCL) holds {pid, bootId}; a stale lock is taken over only when its pid is dead. */
  private acquireLock(): void {
    const lock = join(this.root, ".lock");
    const body = JSON.stringify({ pid: process.pid, bootId: this.bootId });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = openSync(lock, "wx");
        writeSync(fd, body);
        closeSync(fd);
        this.lockHeld = true;
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
      let pid = 0;
      try {
        const held = JSON.parse(readFileSync(lock, "utf8")) as { pid?: unknown };
        pid = Number.isSafeInteger(held.pid) ? (held.pid as number) : 0;
      } catch {
        pid = 0;
      }
      if (pid > 0 && pid !== process.pid && isAlive(pid)) throw new DockJobError("LOCKED", 503, "Another API process owns the docking job store.");
      if (pid === process.pid) throw new DockJobError("LOCKED", 503, "The docking job store is already open in this process.");
      try {
        unlinkSync(lock);
      } catch {
        // raced with another taker; the next O_EXCL attempt decides
      }
    }
    throw new DockJobError("LOCKED", 503, "The docking job store lock could not be taken.");
  }

  // ---- persistence -----------------------------------------------------------------------------------------

  jobDir(jobId: string): string {
    if (typeof jobId !== "string" || !UUID_RE.test(jobId)) throw new DockJobError("NOT_FOUND", 404, "Docking job not found.");
    return join(this.root, jobId);
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  /** Persist state.json first, then append the events (one write), then notify subscribers. */
  private commit(next: DockJobStateV1, events: ReadonlyArray<Omit<JobEvent, "seq" | "jobId" | "at">>): DockJobStateV1 {
    const at = this.iso();
    let seq = next.seq;
    const lines: JobEvent[] = [];
    for (const e of events) {
      if (seq + 1 > JOB_CAPS.eventsMax) break;
      seq += 1;
      lines.push(JobEventSchema.parse({ ...e, jobId: next.jobId, seq, at }));
    }
    const saved = DockJobStateV1Schema.parse({ ...next, seq, bootId: this.bootId, updatedAt: at });
    const dir = this.jobDir(saved.jobId);
    writeAtomicRetry(join(dir, DOCK_LAYOUT.state), JSON.stringify(saved, null, 1) + "\n");
    this.states.set(saved.jobId, saved);
    if (lines.length) appendFileSync(join(dir, DOCK_LAYOUT.events), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    const subs = this.listeners.get(saved.jobId);
    if (subs) for (const l of lines) for (const cb of subs) cb(l);
    return saved;
  }

  private transition(s: DockJobStateV1, to: DockJobStatusName, patch: Partial<DockJobStateV1> = {}): DockJobStateV1 {
    if (!DOCK_TRANSITIONS[s.status].includes(to)) {
      if (TERMINAL.has(s.status)) throw new DockJobError("ALREADY_TERMINAL", 409, `Docking job is already ${s.status}.`);
      throw new DockJobError("ILLEGAL_TRANSITION", 409, `Docking job cannot move from ${s.status} to ${to}.`);
    }
    const next: DockJobStateV1 = { ...s, ...patch, status: to, progress: PROGRESS[to] };
    if (patch.error) next.error = { code: patch.error.code.slice(0, 64), message: scrubText(patch.error.message, [this.jobDir(s.jobId), this.root]).slice(0, 500) };
    const events: Array<Omit<JobEvent, "seq" | "jobId" | "at">> = [{ type: "status", status: to } as Omit<JobEvent, "seq" | "jobId" | "at">];
    if (next.progress !== s.progress) events.push({ type: "progress", progress: next.progress } as Omit<JobEvent, "seq" | "jobId" | "at">);
    if (to === "FAILED" && next.error) events.push({ type: "error", message: `${next.error.code}: ${next.error.message}`.slice(0, 500) } as Omit<JobEvent, "seq" | "jobId" | "at">);
    if (to === "SUCCEEDED") events.push({ type: "result", resultReady: true } as Omit<JobEvent, "seq" | "jobId" | "at">);
    return this.commit(next, events);
  }

  /** Test seam and runner path: move a job along the transition table (409 on an illegal move). */
  move(jobId: string, to: DockJobStatusName, error?: { code: string; message: string }): DockJobStateV1 {
    return this.transition(this.get(jobId), to, error ? { error } : {});
  }

  /** Events with seq > afterSeq. A torn or unparseable line is dropped (only the last line can be torn). */
  events(jobId: string, afterSeq = 0): JobEvent[] {
    this.get(jobId);
    const p = join(this.jobDir(jobId), DOCK_LAYOUT.events);
    if (!existsSync(p)) return [];
    const out: JobEvent[] = [];
    let last = -1;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      if (!line) continue;
      let ev: JobEvent;
      try {
        ev = JobEventSchema.parse(JSON.parse(line));
      } catch {
        continue;
      }
      if (ev.jobId !== jobId || ev.seq <= last) continue;
      last = ev.seq;
      if (ev.seq > afterSeq) out.push(ev);
    }
    return out;
  }

  /** Replay events after afterSeq, then attach live: read file, register listener, re-read (no gap, no dup). */
  subscribe(jobId: string, afterSeq: number, cb: Listener): () => void {
    let lastSent = afterSeq;
    const deliver = (e: JobEvent) => {
      if (e.seq <= lastSent) return;
      lastSent = e.seq;
      cb(e);
    };
    for (const e of this.events(jobId, afterSeq)) deliver(e);
    let set = this.listeners.get(jobId);
    if (!set) this.listeners.set(jobId, (set = new Set()));
    set.add(deliver);
    for (const e of this.events(jobId, lastSent)) deliver(e);
    return () => {
      const s = this.listeners.get(jobId);
      s?.delete(deliver);
      if (s && s.size === 0) this.listeners.delete(jobId);
    };
  }

  // ---- read API --------------------------------------------------------------------------------------------

  get(jobId: string): DockJobStateV1 {
    const s = typeof jobId === "string" && UUID_RE.test(jobId) ? this.states.get(jobId) : undefined;
    if (!s) throw new DockJobError("NOT_FOUND", 404, "Docking job not found.");
    return s;
  }

  list(): DockJobStateV1[] {
    return [...this.states.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  /** Result of a SUCCEEDED job only: zod-parsed, PREVIEW_UNQUALIFIED, meScore null, bound to jobId + inputDigest. */
  result(jobId: string): DockJobResultV1 {
    const s = this.get(jobId);
    if (s.status !== "SUCCEEDED") throw new DockJobError("RESULT_UNAVAILABLE", 409, `Docking job is ${s.status}; no result.`);
    let parsed: DockJobResultV1;
    try {
      parsed = DockJobResultV1Schema.parse(readCappedJson(join(this.jobDir(jobId), ...DOCK_LAYOUT.result.split("/"))));
    } catch {
      throw new DockJobError("RESULT_UNAVAILABLE", 409, "The stored result could not be read.");
    }
    if (parsed.jobId !== s.jobId || parsed.inputDigest !== s.inputDigest) throw new DockJobError("RESULT_UNAVAILABLE", 409, "The stored result is for another job.");
    return parsed;
  }

  // ---- gc / quota ------------------------------------------------------------------------------------------

  private ageMs(s: DockJobStateV1): number {
    const at = Date.parse(s.updatedAt);
    return Number.isFinite(at) ? this.now() - at : Number.POSITIVE_INFINITY;
  }

  private expired(s: DockJobStateV1): boolean {
    if (!TERMINAL.has(s.status)) return false;
    return this.ageMs(s) >= (s.status === "SUCCEEDED" ? this.retainSucceededMs : this.retainTerminalMs);
  }

  private removeJob(jobId: string): void {
    const s = this.states.get(jobId);
    if (s && LIVE.has(s.status)) return; // gc never touches live jobs
    rmSync(this.jobDir(jobId), { recursive: true, force: true });
    this.states.delete(jobId);
    if (s && this.byDigest.get(s.inputDigest) === jobId) this.byDigest.delete(s.inputDigest);
  }

  /** Terminal jobs past retention go first, then the oldest terminal jobs while over quota. Live jobs stay. */
  gc(reserve = 0): { jobs: number; bytes: number } {
    const terminal: DockJobStateV1[] = [];
    for (const s of [...this.states.values()]) {
      if (!TERMINAL.has(s.status)) continue;
      if (this.expired(s)) this.removeJob(s.jobId);
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

  // ---- submit ----------------------------------------------------------------------------------------------

  private async pinOr503(): Promise<VinaPin> {
    try {
      const pin = await this.runner.pin();
      if (!pin || !/^[0-9a-f]{64}$/.test(pin.sha256) || !/^[0-9.]{1,16}$/.test(pin.version)) throw new Error("pin");
      return { version: pin.version, sha256: pin.sha256 };
    } catch {
      throw new DockJobError("ENGINE_PIN_MISMATCH", 503, "Docking is unavailable: the Vina pin in TOOLS.md is missing or invalid.");
    }
  }

  /** inputDigest = sha256(canonical JSON of {receptorSha, ligandSha, box, exhaustiveness, numPoses, seed, vinaPin}). */
  static inputDigest(req: DockJobRequest, receptorSha: string, ligandSha: string, pin: VinaPin): string {
    return sha256(canonicalJson({ receptorSha, ligandSha, box: { center: req.boxCenter, size: req.boxSize }, exhaustiveness: req.exhaustiveness, numPoses: req.numPoses, seed: req.seed, vinaPin: { version: pin.version, sha256: pin.sha256 } }));
  }

  async submit(body: unknown): Promise<DockSubmitResult> {
    if (!this.lockHeld || this.closed) throw new DockJobError("UNAVAILABLE", 503, "The docking job store is not open.");
    const parsed = DockJobRequestSchema.safeParse(body);
    if (!parsed.success) throw new DockJobError("BAD_INPUT", 400, "The docking request is invalid.");
    const req = parsed.data;
    const pin = await this.pinOr503();
    const input = await this.resolvePrepared(req.receptorPreparedId, req.ligandPreparedId);
    const digest = DockJobStore.inputDigest(req, input.provenance.receptorSha256, input.provenance.ligandSha256, pin);
    // ---- synchronous from here: lookup + insert cannot interleave with another submit ----
    const existingId = this.byDigest.get(digest);
    const existing = existingId ? this.states.get(existingId) : undefined;
    if (existing && (LIVE.has(existing.status) || (existing.status === "SUCCEEDED" && !this.expired(existing)))) return { job: existing, deduped: true };
    let queued = 0;
    for (const s of this.states.values()) if (s.status === "QUEUED") queued++;
    if (queued >= this.maxQueue) throw new DockJobError("QUEUE_FULL", 429, `The docking queue is full (${this.maxQueue} jobs); try again later.`);
    const usage = this.gc(1);
    if (usage.jobs >= this.maxJobs || usage.bytes >= this.maxBytes) throw new DockJobError("QUOTA_EXCEEDED", 429, "Too many docking jobs are stored; wait for running jobs to finish.");
    const jobId = randomUUID();
    const dir = this.jobDir(jobId);
    mkdirSync(join(dir, DOCK_LAYOUT.inDir), { recursive: true });
    writeAtomicRetry(join(dir, DOCK_LAYOUT.inDir, "receptor.pdbqt"), input.receptor);
    writeAtomicRetry(join(dir, DOCK_LAYOUT.inDir, "ligand.pdbqt"), input.ligand);
    // job.json is the run.mjs job (zod-validated again by runDockJob); cpu and timeout are fixed by the server.
    const job = {
      schemaVersion: 1,
      receptor: { path: "in/receptor.pdbqt" },
      ligand: { path: "in/ligand.pdbqt" },
      box: { center: req.boxCenter, size: req.boxSize },
      exhaustiveness: req.exhaustiveness,
      numPoses: req.numPoses,
      seed: req.seed,
      cpu: DOCK_CPU,
      timeoutMs: this.timeoutMs,
    };
    writeAtomicRetry(join(dir, DOCK_LAYOUT.job), JSON.stringify(job, null, 1) + "\n");
    const t = this.iso();
    const state: DockJobStateV1 = {
      schemaVersion: 1,
      jobId,
      inputDigest: digest,
      status: "QUEUED",
      bootId: this.bootId,
      cancelRequested: false,
      progress: 0,
      provenance: { ...input.provenance, seed: req.seed, vinaPin: pin, vina: null },
      seq: 0,
      createdAt: t,
      updatedAt: t,
    };
    const saved = this.commit(state, [{ type: "status", status: "QUEUED" } as Omit<JobEvent, "seq" | "jobId" | "at">]);
    this.byDigest.set(digest, jobId);
    this.queue.push(jobId);
    queueMicrotask(() => this.kick());
    return { job: saved, deduped: false };
  }

  // ---- runner loop -----------------------------------------------------------------------------------------

  private kick(): void {
    if (this.active || this.closed) return;
    let next: DockJobStateV1 | undefined;
    while (this.queue.length && !next) {
      const s = this.states.get(this.queue.shift()!);
      if (s && s.status === "QUEUED") next = s;
    }
    if (!next) return;
    const ac = new AbortController();
    const jobId = next.jobId;
    const done = this.execute(jobId, ac).finally(() => {
      this.active = null;
      this.kick();
    });
    this.active = { jobId, ac, done };
  }

  private inputsIntact(s: DockJobStateV1): boolean {
    try {
      const dir = this.jobDir(s.jobId);
      const hash = (name: string) => {
        const p = confinedPath(dir, `in/${name}`);
        if (statSync(p).size > PDBQT_CAP) return "";
        return sha256(readFileSync(p));
      };
      return hash("receptor.pdbqt") === s.provenance.receptorSha256 && hash("ligand.pdbqt") === s.provenance.ligandSha256;
    } catch {
      return false;
    }
  }

  /** Fail unless the job already reached a terminal state (a late exit after cancel is discarded). */
  private failIfLive(jobId: string, code: string, message: string): void {
    const cur = this.states.get(jobId);
    if (cur && LIVE.has(cur.status)) this.transition(cur, "FAILED", { error: { code, message } });
  }

  private async execute(jobId: string, ac: AbortController): Promise<void> {
    const start = this.states.get(jobId);
    if (!start || start.status !== "QUEUED") return;
    this.transition(start, "PREPARING");
    const dir = this.jobDir(jobId);
    try {
      if (!this.inputsIntact(start)) return this.failIfLive(jobId, "INPUT_CHANGED", "The staged inputs no longer match their digests.");
      let pin: VinaPin;
      try {
        pin = await this.pinOr503();
      } catch {
        return this.failIfLive(jobId, "ENGINE_PIN_MISMATCH", "The Vina pin in TOOLS.md is missing or invalid.");
      }
      if (pin.sha256 !== start.provenance.vinaPin.sha256 || pin.version !== start.provenance.vinaPin.version) return this.failIfLive(jobId, "ENGINE_PIN_MISMATCH", "The Vina pin changed since the job was queued.");
      if (ac.signal.aborted || this.states.get(jobId)?.status !== "PREPARING") return;
      const outcome = await this.runner.run({
        jobDir: dir,
        signal: ac.signal,
        onStage: (stage) => {
          const cur = this.states.get(jobId);
          if (stage === "dock" && cur?.status === "PREPARING") this.transition(cur, "RUNNING");
        },
      });
      const cur = this.states.get(jobId);
      if (!cur || TERMINAL.has(cur.status)) return; // late exit (even exit 0) after cancel: discarded
      if (outcome.exitCode === 0) {
        let result: DockJobResultV1;
        try {
          result = collectDockResult(dir, cur);
        } catch (e) {
          return this.failIfLive(jobId, "OUTPUT_REJECTED", e instanceof DockOutputError ? e.reason : "The engine output could not be verified.");
        }
        writeAtomicRetry(join(dir, ...DOCK_LAYOUT.result.split("/")), JSON.stringify(result, null, 1) + "\n");
        const latest = this.states.get(jobId)!;
        if (!LIVE.has(latest.status)) return;
        const running = latest.status === "PREPARING" ? this.transition(latest, "RUNNING") : latest;
        this.transition(running, "SUCCEEDED", { provenance: result.provenance });
        return;
      }
      const err = outcome.error ?? { code: "UNKNOWN", message: "the engine failed" };
      const code = outcome.exitCode === 2 ? "BAD_INPUT" : "ENGINE";
      return this.failIfLive(jobId, code, `${err.code}: ${err.message}`);
    } catch {
      return this.failIfLive(jobId, "INTERNAL", "The docking job could not be completed.");
    } finally {
      rmSync(join(dir, DOCK_LAYOUT.pid), { force: true });
    }
  }

  // ---- cancel ----------------------------------------------------------------------------------------------

  /**
   * Cancel: write CANCELLED (with cancelRequested) first, then abort (runProcess tree-kills wsl.exe), then the
   * async pgid kill from the pidfile. QUEUED: a state change only. Terminal: 409 ALREADY_TERMINAL.
   */
  cancel(jobId: string): DockJobStateV1 {
    const s = this.get(jobId);
    if (TERMINAL.has(s.status)) {
      if (s.status === "CANCELLED") return s; // idempotent
      throw new DockJobError("ALREADY_TERMINAL", 409, `Docking job is already ${s.status}.`);
    }
    const saved = this.transition({ ...s, cancelRequested: true }, "CANCELLED");
    if (this.active?.jobId === jobId) {
      this.active.ac.abort();
      this.trackKill(this.runner.kill(this.jobDir(jobId)));
    }
    return saved;
  }

  private trackKill(p: Promise<void>): void {
    const t = p.catch(() => undefined).finally(() => this.kills.delete(t));
    this.kills.add(t);
  }

  /** Resolves when the active run (if any) and pending kills have settled. */
  async idle(): Promise<void> {
    while (this.active || this.kills.size) {
      await Promise.all([this.active?.done, ...this.kills]);
    }
  }

  // ---- recovery --------------------------------------------------------------------------------------------

  /** Repair a torn tail (truncate to the last newline) and return the last good seq. */
  private repairEvents(jobId: string): number {
    const p = join(this.jobDir(jobId), DOCK_LAYOUT.events);
    if (!existsSync(p)) return 0;
    const raw = readFileSync(p, "utf8");
    if (raw.length && !raw.endsWith("\n")) truncateSync(p, Buffer.byteLength(raw.slice(0, raw.lastIndexOf("\n") + 1), "utf8"));
    let last = 0;
    for (const line of raw.split("\n")) {
      try {
        const ev = JobEventSchema.parse(JSON.parse(line));
        if (ev.jobId === jobId && ev.seq > last) last = ev.seq;
      } catch {
        // dropped
      }
    }
    return last;
  }

  /**
   * Start-up: take the lock, load jobs, fail interrupted runs (API_RESTARTED, after a best-effort pgid kill),
   * requeue intact QUEUED jobs by createdAt, quarantine corrupt dirs, rebuild the dedupe index, gc, start.
   */
  async init(): Promise<void> {
    mkdirSync(this.root, { recursive: true });
    this.acquireLock();
    const requeue: DockJobStateV1[] = [];
    const kills: Promise<void>[] = [];
    for (const name of readdirSync(this.root)) {
      if (!UUID_RE.test(name)) continue;
      const dir = join(this.root, name);
      let s: DockJobStateV1 | undefined;
      try {
        s = DockJobStateV1Schema.parse(readCappedJson(join(dir, DOCK_LAYOUT.state)));
        if (s.jobId !== name) s = undefined;
      } catch {
        s = undefined;
      }
      if (!s) {
        try {
          renameSync(dir, join(this.root, `.corrupt-${name}`));
        } catch {
          // left in place; never listed
        }
        continue;
      }
      s = { ...s, seq: this.repairEvents(name) };
      this.states.set(name, s);
      if ((s.status === "PREPARING" || s.status === "RUNNING") && s.bootId !== this.bootId) {
        kills.push(this.runner.kill(dir));
        this.transition(s, "FAILED", { error: { code: "API_RESTARTED", message: "The API restarted while this job was running; it was not resumed." } });
        rmSync(join(dir, DOCK_LAYOUT.pid), { force: true });
      } else if (s.status === "QUEUED") {
        if (this.inputsIntact(s)) requeue.push(s);
        else this.transition(s, "FAILED", { error: { code: "INPUT_CHANGED", message: "The staged inputs no longer match their digests." } });
      }
    }
    await Promise.all(kills);
    for (const s of this.states.values()) {
      if (this.expired(s)) continue;
      const cur = this.byDigest.get(s.inputDigest);
      const prev = cur ? this.states.get(cur) : undefined;
      const reusable = (x: DockJobStateV1) => LIVE.has(x.status) || x.status === "SUCCEEDED";
      if (!prev || (!reusable(prev) && reusable(s))) this.byDigest.set(s.inputDigest, s.jobId);
    }
    this.gc();
    requeue.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    for (const s of requeue) this.queue.push(s.jobId);
    this.kick();
  }

  /** Orderly stop: the active run is FAILED API_STOPPED and killed; QUEUED jobs stay queued for the next start. */
  async close(): Promise<void> {
    this.closed = true;
    this.queue.length = 0;
    if (this.active) {
      const id = this.active.jobId;
      this.failIfLive(id, "API_STOPPED", "The API stopped while this job was running; it was not resumed.");
      this.active.ac.abort();
      this.trackKill(this.runner.kill(this.jobDir(id)));
    }
    await this.idle();
    if (this.lockHeld) rmSync(join(this.root, ".lock"), { force: true });
    this.lockHeld = false;
  }
}
