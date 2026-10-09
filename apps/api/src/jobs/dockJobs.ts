import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, truncateSync, unlinkSync, utimesSync, writeFileSync, writeSync } from "node:fs";
import { constants } from "node:fs";
import { open as open_, readFile, type FileHandle } from "node:fs/promises";
import { Readable } from "node:stream";
import { uptime } from "node:os";
import { join, resolve } from "node:path";
import {
  DOCK_JOB_ARTIFACTS,
  type DockJobArtifactName,
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
  type DockJobStage,
  type DockJobStatusName,
  DOCK_LEGACY_STATUS_MAP,
  type JobEvent,
  type PrepJobStateV1,
} from "@molecular/contracts";
import { collectDockResult, createMoleDockRunner, DOCK_LAYOUT, DockOutputError, type DockRunner, type KillReport, type VinaPin } from "./dockRunner.js";
import { confinedPath, PrepError, readCappedJson, scrubText, type PrepJobStore } from "./prepJobs.js";
import { REPO_ROOT } from "./prepPins.js";

/**
 * Docking job store and runner loop (task 5.4, design docs/sprint/design/5.4.md).
 * - file store on the prepJobs patterns: one UUID dir per job under <root>/, atomic state.json, append-only
 *   events.ndjson (monotonic seq, torn last line dropped), one transition table, TTL + gc, quota
 * - one Vina at a time (FIFO), queue max 8; cancel writes CANCELLED first, then aborts and kills the pgid
 * - crash recovery: a new bootId per start; RUNNING from another boot -> FAILED API_RESTARTED
 *   (never resumed); QUEUED with intact inputs is requeued; corrupt dirs are quarantined
 * - dedupe: inputDigest over server-resolved inputs; CREATED/QUEUED/RUNNING/COMPLETED jobs are reused
 * Results stay PREVIEW_UNQUALIFIED with meScore null. HTTP/SSE is task 5.5.
 */

export const DOCK_TRANSITIONS: Readonly<Record<DockJobStatusName, readonly DockJobStatusName[]>> = Object.freeze({
  CREATED: ["QUEUED", "CANCELLED", "FAILED"],
  QUEUED: ["RUNNING", "CANCELLED", "FAILED"],
  RUNNING: ["COMPLETED", "CANCELLED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
});
const TERMINAL = new Set<DockJobStatusName>(DOCK_JOB_TERMINAL_STATUSES);
const LIVE = new Set<DockJobStatusName>(["CREATED", "QUEUED", "RUNNING"]);
const PROGRESS: Readonly<Record<DockJobStatusName, number>> = { CREATED: 0, QUEUED: 0, RUNNING: 0.05, COMPLETED: 1, FAILED: 1, CANCELLED: 1 };
/** R.2: map a pre-R.2 status event (SUCCEEDED/PREPARING) onto the six research states. */
function legacyEvent(e: unknown): unknown {
  if (e && typeof e === "object" && (e as { type?: unknown }).type === "status") {
    const st = String((e as { status?: unknown }).status);
    const m = Object.hasOwn(DOCK_LEGACY_STATUS_MAP, st) ? DOCK_LEGACY_STATUS_MAP[st] : undefined;
    if (m) return { ...(e as object), status: m.status, ...(m.stage ? { stage: m.stage } : {}) };
  }
  return e;
}
export const DOCK_MAX_QUEUE = 8;
export const DOCK_MAX_JOBS = 32;
export const DOCK_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const DOCK_CPU = 4;
export const DOCK_TIMEOUT_MS = 600_000;
/** Size cap for a served artifact (poses.pdbqt is capped at 32 MB by the runner; JSON files are far smaller). */
export const DOCK_ARTIFACT_MAX_BYTES = 32 * 1024 * 1024;
/** Concurrent artifact downloads (streamed); beyond this 429 DOWNLOAD_BUSY. */
export const DOCK_MAX_DOWNLOADS = 4;
const MANIFEST_MAX_BYTES = 1024 * 1024;
/** <jobDir>/manifest.sha256: sha256 of out/manifest.json recorded at completion (outside the engine-writable out/). */
const MANIFEST_DIGEST_FILE = "manifest.sha256";
export type DockArtifactStream = { stream: Readable; size: number; contentType: string; sha256: string };
/** Bound on a WSL cold start: a cancelled engine's pidfile is waited for this long before the queue moves on. */
export const DOCK_ENGINE_START_WAIT_MS = 20_000;
const LOCK_HEARTBEAT_MS = 10_000;
const LOCK_STALE_MS = 60_000;
const PDBQT_CAP = 16 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// SEALED ids (prec_/plig_) and server-minted PREVIEW_UNQUALIFIED ids (pvrec_/pvlig_ + random token).
const REC_ID_RE = /^(?:prec_([0-9a-f]{32})|pvrec_([0-9a-f]{32})_[0-9a-f]{24})$/;
const LIG_ID_RE = /^(?:plig_([0-9a-f]{32})|pvlig_([0-9a-f]{32})_[0-9a-f]{24})$/;

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
 * Prepared ids -> PDBQT bytes, through the prep job store only. Every accepted id must equal one the prep store
 * minted: prec_/plig_ for a SEALED result, pvrec_/pvlig_ (random token) for a PREVIEW_UNQUALIFIED one (owner
 * decision: preview preparations stay dockable, labelled PREVIEW_UNQUALIFIED). BLOCKED/REJECTED is 400. The
 * manifest sha256 of each PDBQT is re-verified before the bytes are used.
 */
export const createPrepResolver = (prep: PrepJobStore): PreparedResolver => async (receptorId, ligandId) => {
  const rm = REC_ID_RE.exec(receptorId);
  const lm = LIG_ID_RE.exec(ligandId);
  if (!rm || !lm) throw new DockJobError("BAD_INPUT", 400, "Prepared ids must be server-minted receptor and ligand ids.");
  const r = [receptorId, rm[1] ?? rm[2]!] as const;
  const l = [ligandId, lm[1] ?? lm[2]!] as const;
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
    const rec = role === "RECEPTOR_PDBQT";
    const minted = seal === "SEALED" ? (rec ? job.preparedReceptorId : job.preparedLigandId) : rec ? job.previewReceptorId : job.previewLigandId;
    if (typeof minted !== "string" || minted !== id) throw new DockJobError("BAD_INPUT", 400, "The prepared id does not match its preparation job.");
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
      ligandPrepJobId: ligJob.jobId,
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
  /** After a cancel, how long to wait for a late pidfile (WSL cold start) before the next job may start. */
  engineStartWaitMs?: number;
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
  private active: { jobId: string; ac: AbortController; done: Promise<void>; dockStarted: boolean; kill?: Promise<KillReport> } | null = null;
  private readonly engineStartWaitMs: number;
  private heartbeat: NodeJS.Timeout | undefined;
  private readonly kills = new Set<Promise<unknown>>();
  private lockHeld = false;
  private activeDownloads = 0;
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
    this.engineStartWaitMs = options.engineStartWaitMs ?? DOCK_ENGINE_START_WAIT_MS;
  }

  // ---- lock ------------------------------------------------------------------------------------------------

  /**
   * root/.lock (O_EXCL) holds {pid, bootId, startedAt, osBootAt}; the owner refreshes its mtime every 10 s.
   * A lock is stale when its pid is dead, when it was written in an earlier OS boot (so its pid may be reused), or
   * when its heartbeat stopped for 60 s (a reused pid that is alive but not ours). Takeover is serialised by a
   * second O_EXCL file (.lock.takeover): only its holder re-checks staleness, unlinks and re-creates the lock, and
   * the new lock is read back to confirm it is ours. A takeover file left by a crashed taker expires after 10 s.
   */
  private acquireLock(): void {
    const lock = join(this.root, ".lock");
    const token = join(this.root, ".lock.takeover");
    const osBootAt = Date.now() - uptime() * 1000;
    const body = JSON.stringify({ pid: process.pid, bootId: this.bootId, startedAt: Math.round(Date.now() - process.uptime() * 1000), osBootAt: Math.round(osBootAt) });
    const create = (): boolean => {
      try {
        const fd = openSync(lock, "wx");
        try {
          writeSync(fd, body);
        } finally {
          closeSync(fd);
        }
        return true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        return false;
      }
    };
    const stale = (): boolean => {
      let held: { pid?: unknown; bootId?: unknown; osBootAt?: unknown } = {};
      let mtime = 0;
      try {
        mtime = statSync(lock).mtimeMs;
        held = JSON.parse(readFileSync(lock, "utf8")) as typeof held;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return true;
        held = {}; // unparseable: stale only once its heartbeat is old too
      }
      const pid = Number.isSafeInteger(held.pid) ? (held.pid as number) : 0;
      if (pid === process.pid && held.bootId !== this.bootId && isAlive(pid) && typeof held.bootId === "string") {
        throw new DockJobError("LOCKED", 503, "The docking job store is already open in this process.");
      }
      if (pid <= 0) return Date.now() - mtime > LOCK_STALE_MS;
      if (!isAlive(pid)) return true;
      if (typeof held.osBootAt === "number" && held.osBootAt < osBootAt - 60_000) return true; // written before this OS boot
      return Date.now() - mtime > LOCK_STALE_MS; // alive pid, heartbeat stopped: a reused pid
    };
    const finish = (): void => {
      let ours = false;
      try {
        ours = (JSON.parse(readFileSync(lock, "utf8")) as { bootId?: unknown }).bootId === this.bootId;
      } catch {
        ours = false;
      }
      if (!ours) throw new DockJobError("LOCKED", 503, "The docking job store lock could not be taken.");
      this.lockHeld = true;
      this.heartbeat = setInterval(() => {
        try {
          if (this.lockIsOurs()) utimesSync(lock, new Date(), new Date());
        } catch {
          // the next tick retries
        }
      }, LOCK_HEARTBEAT_MS);
      this.heartbeat.unref();
    };
    if (create()) return finish();
    for (let attempt = 0; attempt < 50; attempt++) {
      if (!stale()) throw new DockJobError("LOCKED", 503, "Another API process owns the docking job store.");
      let tfd: number;
      try {
        tfd = openSync(token, "wx");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        try {
          if (Date.now() - statSync(token).mtimeMs > 10_000) unlinkSync(token);
        } catch {
          // another taker removed it
        }
        const until = Date.now() + 20;
        while (Date.now() < until) {
          /* another taker holds the token for a few ms */
        }
        continue;
      }
      try {
        closeSync(tfd);
        if (!stale()) throw new DockJobError("LOCKED", 503, "Another API process owns the docking job store.");
        rmSync(lock, { force: true });
        if (create()) return finish();
      } finally {
        rmSync(token, { force: true });
      }
    }
    throw new DockJobError("LOCKED", 503, "The docking job store lock could not be taken.");
  }

  private lockIsOurs(): boolean {
    try {
      return (JSON.parse(readFileSync(join(this.root, ".lock"), "utf8")) as { bootId?: unknown }).bootId === this.bootId;
    } catch {
      return false;
    }
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
    if (to === "RUNNING") next.stage = patch.stage ?? "PREPARING";
    else delete next.stage;
    if (patch.error) next.error = { code: patch.error.code.slice(0, 64), message: this.scrub(s.jobId, patch.error.message).slice(0, 500) };
    const events: Array<Omit<JobEvent, "seq" | "jobId" | "at">> = [{ type: "status", status: to, ...(next.stage ? { stage: next.stage } : {}) } as Omit<JobEvent, "seq" | "jobId" | "at">];
    if (next.progress !== s.progress) events.push({ type: "progress", progress: next.progress } as Omit<JobEvent, "seq" | "jobId" | "at">);
    if (to === "FAILED" && next.error) events.push({ type: "error", message: `${next.error.code}: ${next.error.message}`.slice(0, 500) } as Omit<JobEvent, "seq" | "jobId" | "at">);
    if (to === "COMPLETED") events.push({ type: "result", resultReady: true } as Omit<JobEvent, "seq" | "jobId" | "at">);
    return this.commit(next, events);
  }

  /** A stage change inside RUNNING (status unchanged): persisted on the state and emitted as a stage event. */
  private setStage(s: DockJobStateV1, stage: DockJobStage, progress: number): DockJobStateV1 {
    return this.commit({ ...s, stage, progress }, [
      { type: "stage", stage } as Omit<JobEvent, "seq" | "jobId" | "at">,
      { type: "progress", progress } as Omit<JobEvent, "seq" | "jobId" | "at">,
    ]);
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
        ev = JobEventSchema.parse(legacyEvent(JSON.parse(line)));
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
    if (s.status !== "COMPLETED") throw new DockJobError("RESULT_UNAVAILABLE", 409, `Docking job is ${s.status}; no result.`);
    let parsed: DockJobResultV1;
    try {
      parsed = DockJobResultV1Schema.parse(readCappedJson(join(this.jobDir(jobId), ...DOCK_LAYOUT.result.split("/"))));
    } catch {
      throw new DockJobError("RESULT_UNAVAILABLE", 409, "The stored result could not be read.");
    }
    if (parsed.jobId !== s.jobId || parsed.inputDigest !== s.inputDigest) throw new DockJobError("RESULT_UNAVAILABLE", 409, "The stored result is for another job.");
    return parsed;
  }

  /**
   * Task 5.5: a whitelisted output file of a COMPLETED job (poses.pdbqt, result.json, manifest.json), read from
   * the confined out/ dir only (no symlinks, size-capped) and re-checked against the digests recorded at
   * completion. Anything else is 404; a job that is not COMPLETED is 409.
   */
  async artifact(jobId: string, name: string): Promise<DockArtifactStream> {
    const s = this.get(jobId);
    if (typeof name !== "string" || !Object.hasOwn(DOCK_JOB_ARTIFACTS, name)) throw new DockJobError("NOT_FOUND", 404, "Artifact not found.");
    if (s.status !== "COMPLETED") throw new DockJobError("RESULT_UNAVAILABLE", 409, `Docking job is ${s.status}; no artifacts.`);
    if (this.activeDownloads >= DOCK_MAX_DOWNLOADS) throw new DockJobError("DOWNLOAD_BUSY", 429, "Too many artifact downloads are running; try again shortly.");
    this.activeDownloads++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.activeDownloads--;
    };
    let fh: FileHandle | undefined;
    try {
      const unreadable = () => new DockJobError("RESULT_UNAVAILABLE", 409, "The stored artifact could not be read.");
      const dir = this.jobDir(jobId);
      const out = join(dir, DOCK_LAYOUT.outDir);
      // out/ itself must be a real directory (a symlink or junction there would redirect every artifact).
      const outSt = lstatSync(out);
      if (!outSt.isDirectory() || outSt.isSymbolicLink()) throw unreadable();
      /** Open without following links, on a stable fd; hash it in bounded chunks; size-capped. */
      const open = async (rel: string): Promise<{ fh: FileHandle; size: number; digest: string }> => {
        const p = confinedPath(out, rel);
        const st = lstatSync(p);
        if (!st.isFile() || st.isSymbolicLink() || st.size > DOCK_ARTIFACT_MAX_BYTES) throw unreadable();
        const h = await open_(p, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
          const fst = await h.stat();
          if (!fst.isFile() || fst.size > DOCK_ARTIFACT_MAX_BYTES || fst.size !== st.size || (st.ino !== 0 && fst.ino !== st.ino)) throw unreadable();
          const hash = createHash("sha256");
          const buf = Buffer.allocUnsafe(64 * 1024);
          let pos = 0;
          while (pos < fst.size) {
            const { bytesRead } = await h.read(buf, 0, Math.min(buf.length, fst.size - pos), pos);
            if (bytesRead === 0) throw unreadable();
            hash.update(buf.subarray(0, bytesRead));
            pos += bytesRead;
          }
          return { fh: h, size: fst.size, digest: hash.digest("hex") };
        } catch (e) {
          await h.close().catch(() => undefined);
          throw e;
        }
      };
      const mf = await open("manifest.json");
      let manifestFiles: Record<string, unknown> = {};
      try {
        // The manifest is itself checked against the digest recorded in the job dir at completion.
        const recorded = readFileSync(join(dir, MANIFEST_DIGEST_FILE), "utf8").trim();
        if (recorded !== mf.digest || mf.size > MANIFEST_MAX_BYTES) throw unreadable();
        const raw = Buffer.alloc(mf.size);
        const { bytesRead } = await mf.fh.read(raw, 0, mf.size, 0);
        if (bytesRead !== mf.size) throw unreadable();
        manifestFiles = ((JSON.parse(raw.toString("utf8")) as { files?: Record<string, unknown> }).files ?? {}) as Record<string, unknown>;
      } catch {
        await mf.fh.close().catch(() => undefined);
        throw unreadable();
      }
      let picked = mf;
      if (name !== "manifest.json") {
        await mf.fh.close().catch(() => undefined);
        picked = await open(name);
        if (name === "poses.pdbqt" && (picked.digest !== this.result(jobId).posesSha256 || manifestFiles["poses.pdbqt"] !== picked.digest)) {
          await picked.fh.close().catch(() => undefined);
          throw unreadable();
        }
        if (name === "result.json" && manifestFiles["result.json"] !== picked.digest) {
          await picked.fh.close().catch(() => undefined);
          throw unreadable();
        }
      }
      fh = picked.fh;
      const stream = picked.size === 0 ? Readable.from([]) : fh.createReadStream({ start: 0, end: picked.size - 1, autoClose: true });
      stream.once("close", release);
      if (picked.size === 0) await fh.close().catch(() => undefined);
      return { stream, size: picked.size, contentType: DOCK_JOB_ARTIFACTS[name as DockJobArtifactName], sha256: picked.digest };
    } catch (e) {
      release();
      if (e instanceof DockJobError) throw e;
      throw new DockJobError("RESULT_UNAVAILABLE", 409, "The stored artifact could not be read.");
    }
  }

  // ---- gc / quota ------------------------------------------------------------------------------------------

  private ageMs(s: DockJobStateV1): number {
    const at = Date.parse(s.updatedAt);
    return Number.isFinite(at) ? this.now() - at : Number.POSITIVE_INFINITY;
  }

  private expired(s: DockJobStateV1): boolean {
    if (!TERMINAL.has(s.status)) return false;
    return this.ageMs(s) >= (s.status === "COMPLETED" ? this.retainSucceededMs : this.retainTerminalMs);
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
  static inputDigest(req: DockJobRequest, receptorSha: string, ligandSha: string, pin: VinaPin, prepSealStatus: "SEALED" | "PREVIEW_UNQUALIFIED" = "SEALED"): string {
    return sha256(canonicalJson({ receptorSha, ligandSha, box: { center: req.boxCenter, size: req.boxSize }, exhaustiveness: req.exhaustiveness, numPoses: req.numPoses, seed: req.seed, vinaPin: { version: pin.version, sha256: pin.sha256 }, prepSealStatus }));
  }

  async submit(body: unknown): Promise<DockSubmitResult> {
    if (!this.lockHeld || this.closed) throw new DockJobError("UNAVAILABLE", 503, "The docking job store is not open.");
    const parsed = DockJobRequestSchema.safeParse(body);
    if (!parsed.success) throw new DockJobError("BAD_INPUT", 400, "The docking request is invalid.");
    const req = parsed.data;
    const pin = await this.pinOr503();
    const input = await this.resolvePrepared(req.receptorPreparedId, req.ligandPreparedId);
    // The seal status is part of the identity: a SEALED request never dedupes onto a PREVIEW_UNQUALIFIED job.
    const digest = DockJobStore.inputDigest(req, input.provenance.receptorSha256, input.provenance.ligandSha256, pin, input.provenance.prepSealStatus);
    // ---- synchronous from here: lookup + insert cannot interleave with another submit ----
    const existingId = this.byDigest.get(digest);
    const existing = existingId ? this.states.get(existingId) : undefined;
    if (existing && (LIVE.has(existing.status) || (existing.status === "COMPLETED" && !this.expired(existing)))) return { job: existing, deduped: true };
    let queued = 0;
    for (const s of this.states.values()) if (s.status === "QUEUED" || s.status === "CREATED") queued++;
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
      status: "CREATED",
      bootId: this.bootId,
      cancelRequested: false,
      progress: 0,
      provenance: { ...input.provenance, seed: req.seed, vinaPin: pin, vina: null },
      seq: 0,
      createdAt: t,
      updatedAt: t,
    };
    const created = this.commit(state, [{ type: "status", status: "CREATED" } as Omit<JobEvent, "seq" | "jobId" | "at">]);
    this.byDigest.set(digest, jobId);
    const saved = this.transition(created, "QUEUED");
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
    const slot: NonNullable<DockJobStore["active"]> = { jobId, ac, done: Promise.resolve(), dockStarted: false };
    this.active = slot;
    // The next job starts only after execute() has reaped this job's engine group (one Vina at a time).
    slot.done = this.execute(jobId, ac, slot).finally(() => {
      this.active = null;
      this.kick();
    });
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

  /** Append a diagnostic log event (also after a terminal state; never changes the status). */
  private note(jobId: string, line: string): void {
    const cur = this.states.get(jobId);
    if (cur) this.commit(cur, [{ type: "log", line: this.scrub(jobId, line).slice(0, 500) } as Omit<JobEvent, "seq" | "jobId" | "at">]);
  }

  private scrub(jobId: string, text: string): string {
    const dir = this.jobDir(jobId);
    const forms = new Set<string>();
    for (const p of [dir, this.root, REPO_ROOT]) {
      forms.add(p);
      forms.add(p.replace(/\\/g, "/"));
      const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
      if (m) {
        const rest = m[2]!.replace(/\\/g, "/").replace(/\/+$/, "");
        forms.add(`/mnt/${m[1]!.toLowerCase()}/${rest}`);
        forms.add(`/mnt/${m[1]!.toUpperCase()}/${rest}`);
      }
    }
    return scrubText(text, [...forms]);
  }

  /**
   * Make sure the engine group of a job is gone before the queue moves on. After a cancel or stop the pidfile is
   * waited for up to engineStartWaitMs (a WSL cold start can launch the engine after wsl.exe was killed) and the
   * group is killed when it appears; a kill that could not be confirmed is surfaced as a log event.
   */
  private async reap(jobId: string, slot: NonNullable<DockJobStore["active"]>, failed: boolean): Promise<void> {
    if (!slot.dockStarted) return;
    const dir = this.jobDir(jobId);
    let rep: KillReport | undefined = slot.kill ? await slot.kill.catch(() => undefined) : undefined;
    if (!rep?.gone) {
      if (slot.ac.signal.aborted) rep = await this.runner.kill(dir, { waitMs: this.engineStartWaitMs });
      else if (failed && existsSync(join(dir, DOCK_LAYOUT.pid))) rep = await this.runner.kill(dir, { waitMs: 0 });
      else return; // the engine exited by itself (exit 0 or a reported failure with no group left to kill)
    }
    if (!rep.gone) this.note(jobId, `ENGINE_KILL_UNCONFIRMED: ${rep.reason ?? "UNKNOWN"}; the in-WSL timeout and stdin watcher remain as backstops.`);
  }

  private async execute(jobId: string, ac: AbortController, slot: NonNullable<DockJobStore["active"]>): Promise<void> {
    let failed = true;
    const start = this.states.get(jobId);
    if (!start || start.status !== "QUEUED") return;
    this.transition(start, "RUNNING", { stage: "PREPARING" });
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
      if (ac.signal.aborted || this.states.get(jobId)?.status !== "RUNNING") return;
      const outcome = await this.runner.run({
        jobDir: dir,
        signal: ac.signal,
        onStage: (stage) => {
          if (stage === "dock") slot.dockStarted = true;
          const cur = this.states.get(jobId);
          if (stage === "dock" && cur?.status === "RUNNING" && cur.stage === "PREPARING") this.setStage(cur, "DOCKING", 0.1);
        },
      });
      failed = outcome.exitCode !== 0;
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
        // Record the manifest digest outside out/ so artifact serving can verify the manifest like the other files.
        writeAtomicRetry(join(dir, MANIFEST_DIGEST_FILE), sha256(readFileSync(join(dir, DOCK_LAYOUT.outDir, "manifest.json"))) + "\n");
        const latest = this.states.get(jobId)!;
        if (!LIVE.has(latest.status)) return;
        this.transition(latest, "COMPLETED", { provenance: result.provenance });
        return;
      }
      const err = outcome.error ?? { code: "UNKNOWN", message: "the engine failed" };
      const code = outcome.exitCode === 2 ? "BAD_INPUT" : "ENGINE";
      return this.failIfLive(jobId, code, `${err.code}: ${err.message}`);
    } catch {
      return this.failIfLive(jobId, "INTERNAL", "The docking job could not be completed.");
    } finally {
      try {
        await this.reap(jobId, slot, failed);
      } finally {
        rmSync(join(dir, DOCK_LAYOUT.pid), { force: true });
      }
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
    if (this.active?.jobId === jobId) this.abortActive();
    return saved;
  }

  /** Abort the active run and start the fast pgid kill; execute() awaits it (and a late-pidfile retry) before the next job. */
  private abortActive(): void {
    const slot = this.active;
    if (!slot || slot.ac.signal.aborted) return;
    slot.ac.abort();
    slot.kill = this.runner.kill(this.jobDir(slot.jobId), { waitMs: 1000 });
    this.trackKill(slot.kill);
  }

  private trackKill(p: Promise<unknown>): void {
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
        const ev = JobEventSchema.parse(legacyEvent(JSON.parse(line)));
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
    const migratedNotes = new Map<string, string>();
    const kills: Promise<void>[] = [];
    for (const name of readdirSync(this.root)) {
      if (!UUID_RE.test(name)) continue;
      const dir = join(this.root, name);
      let s: DockJobStateV1 | undefined;
      try {
        const raw = readCappedJson(join(dir, DOCK_LAYOUT.state));
        const from = raw && typeof raw === "object" ? String((raw as { status?: unknown }).status) : "";
        const legacy = Object.hasOwn(DOCK_LEGACY_STATUS_MAP, from) ? DOCK_LEGACY_STATUS_MAP[from] : undefined;
        if (legacy) {
          // R.2 migration: SUCCEEDED -> COMPLETED; PREPARING -> RUNNING with stage PREPARING. Recorded as a log event.
          s = DockJobStateV1Schema.parse({ ...(raw as object), status: legacy.status, ...(legacy.stage ? { stage: legacy.stage } : {}) });
          if (s.jobId === name) migratedNotes.set(name, `MIGRATED_LEGACY_STATE: ${from} -> ${legacy.status}${legacy.stage ? ` (stage ${legacy.stage})` : ""}`);
        } else s = DockJobStateV1Schema.parse(raw);
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
      const note = migratedNotes.get(name);
      if (note) s = this.commit(s, [{ type: "log", line: note } as Omit<JobEvent, "seq" | "jobId" | "at">]);
      this.states.set(name, s);
      if (s.status === "RUNNING" && s.bootId !== this.bootId) {
        const id = name;
        this.transition(s, "FAILED", { error: { code: "API_RESTARTED", message: "The API restarted while this job was running; it was not resumed." } });
        kills.push(
          this.runner
            .kill(dir, { waitMs: 0 })
            .then((rep) => {
              if (!rep.gone && rep.reason !== "NO_PIDFILE") this.note(id, `ENGINE_KILL_UNCONFIRMED: ${rep.reason ?? "UNKNOWN"}`);
            })
            .finally(() => rmSync(join(dir, DOCK_LAYOUT.pid), { force: true })),
        );
      } else if (s.status === "QUEUED" || s.status === "CREATED") {
        if (this.inputsIntact(s)) requeue.push(s.status === "CREATED" ? this.transition(s, "QUEUED") : s);
        else this.transition(s, "FAILED", { error: { code: "INPUT_CHANGED", message: "The staged inputs no longer match their digests." } });
      }
    }
    await Promise.all(kills);
    for (const s of this.states.values()) {
      if (this.expired(s)) continue;
      const cur = this.byDigest.get(s.inputDigest);
      const prev = cur ? this.states.get(cur) : undefined;
      const reusable = (x: DockJobStateV1) => LIVE.has(x.status) || x.status === "COMPLETED";
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
      this.abortActive();
    }
    await this.idle();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    if (this.lockHeld && this.lockIsOurs()) rmSync(join(this.root, ".lock"), { force: true });
    this.lockHeld = false;
  }
}
