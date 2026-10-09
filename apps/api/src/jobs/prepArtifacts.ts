import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync } from "node:fs";
import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { SOURCE_ARTIFACT_ID_PATTERN, safeJoin } from "../projects/safeJoin.js";
import { PREP_MAX_ARTIFACT_BYTES, PREP_TTL_MS, PrepError, writeAtomic, type PrepArtifact } from "./prepJobs.js";

/**
 * Preparation artifact store (task 5.2b). The server stores uploads by a sha256 it computes itself and hands
 * back a short opaque id (`pa_<format>_<40 hex>`, at most 48 chars, inside the 64-char ArtifactIdSchema cap).
 * Structure source artifacts (`source_<kind>_<sha256>`, 84 chars) are mapped by importing their stored bytes
 * (re-verified against the digest in the id) into this store, so the client never sends digests or paths.
 *
 * Fix round: uploads stream to a temp file (hashed and size-capped chunk by chunk, never buffered whole), at
 * most `maxConcurrentUploads` at a time (more answer 429 BUSY). Quota: `maxArtifacts` files and `maxBytes`
 * on disk. Retention: an artifact unused (put or resolved) for `retainMs` is deleted; over quota, the least
 * recently used artifacts older than `protectMs` (the plan TTL, so a pending plan's inputs stay) go first.
 * If only protected artifacts remain the upload is refused (429 QUOTA_EXCEEDED).
 */
export const PREP_ARTIFACT_FORMATS = ["pdb", "sdf", "mol", "mol2", "smi"] as const;
export type PrepArtifactFormat = (typeof PREP_ARTIFACT_FORMATS)[number];
const FORMATS = new Set<string>(PREP_ARTIFACT_FORMATS);
export const PREP_ARTIFACT_ID_RE = /^pa_(pdb|sdf|mol|mol2|smi)_[0-9a-f]{40}$/;
export const PREP_ARTIFACT_MAX_COUNT = 64;
export const PREP_ARTIFACT_MAX_BYTES = 512 * 1024 * 1024;
export const PREP_ARTIFACT_RETAIN_MS = 24 * 60 * 60_000;
export const PREP_MAX_CONCURRENT_UPLOADS = 2;
const SNIFF_BYTES = 64 * 1024;
const TMP_RE = /^upload-[0-9a-f-]{36}\.tmp$/;

type Meta = { format: PrepArtifactFormat; sha256: string; bytes: number };
const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/** Cheap content sniff: a PDB has fixed-column records and is not mmCIF. */
export const looksLikePdb = (bytes: Buffer): boolean => {
  const head = bytes.subarray(0, SNIFF_BYTES).toString("latin1");
  if (/^\s*data_/m.test(head.slice(0, 200)) || head.includes("_atom_site.")) return false;
  return /^(ATOM {2}|HETATM)/m.test(head);
};

export type PrepArtifactStoreOptions = Readonly<{
  maxArtifacts?: number;
  maxBytes?: number;
  retainMs?: number;
  /** Artifacts younger than this are never evicted for quota (default: the 30 min plan TTL). */
  protectMs?: number;
  maxConcurrentUploads?: number;
  now?: () => number;
}>;

type PutResult = { artifactId: string; format: PrepArtifactFormat; bytes: number };

const oversize = () => new PrepError("OVERSIZE_INPUT", 413, "An input artifact exceeds 20 MB.");

export class PrepArtifactStore {
  readonly root: string;
  private readonly maxArtifacts: number;
  private readonly maxBytes: number;
  private readonly retainMs: number;
  private readonly protectMs: number;
  private readonly maxUploads: number;
  private readonly now: () => number;
  private uploads = 0;

  constructor(root: string, options: PrepArtifactStoreOptions = {}) {
    this.root = resolve(root);
    this.maxArtifacts = options.maxArtifacts ?? PREP_ARTIFACT_MAX_COUNT;
    this.maxBytes = options.maxBytes ?? PREP_ARTIFACT_MAX_BYTES;
    this.retainMs = options.retainMs ?? PREP_ARTIFACT_RETAIN_MS;
    this.protectMs = options.protectMs ?? PREP_TTL_MS;
    this.maxUploads = options.maxConcurrentUploads ?? PREP_MAX_CONCURRENT_UPLOADS;
    this.now = options.now ?? Date.now;
    mkdirSync(this.root, { recursive: true });
    // Temp files of uploads interrupted by a restart are garbage.
    for (const name of readdirSync(this.root)) if (TMP_RE.test(name)) rmSync(join(this.root, name), { force: true });
    this.gc();
  }

  /** Stored artifacts with their size and last use (mtime of the .bin, refreshed on put and resolve). */
  private list(): { id: string; bytes: number; usedAt: number }[] {
    const out: { id: string; bytes: number; usedAt: number }[] = [];
    for (const name of readdirSync(this.root)) {
      if (!name.endsWith(".bin")) continue;
      const id = name.slice(0, -4);
      if (!PREP_ARTIFACT_ID_RE.test(id)) continue;
      try {
        const st = statSync(join(this.root, name));
        out.push({ id, bytes: st.size, usedAt: st.mtimeMs });
      } catch {
        // removed concurrently
      }
    }
    return out;
  }

  private remove(id: string): void {
    rmSync(join(this.root, `${id}.bin`), { force: true });
    rmSync(join(this.root, `${id}.json`), { force: true });
  }

  /**
   * Retention + quota. Deletes artifacts unused for retainMs; then, while adding `reserveBytes` in one more
   * artifact would exceed the quota, evicts the least recently used unprotected artifacts. Returns usage.
   */
  gc(reserveBytes = 0, reserveCount = 0): { artifacts: number; bytes: number } {
    const t = this.now();
    let items = this.list();
    for (const it of items) if (t - it.usedAt >= this.retainMs) this.remove(it.id);
    items = items.filter((it) => t - it.usedAt < this.retainMs).sort((a, b) => a.usedAt - b.usedAt);
    let bytes = items.reduce((n, it) => n + it.bytes, 0);
    let count = items.length;
    for (const it of items) {
      if (count + reserveCount <= this.maxArtifacts && bytes + reserveBytes <= this.maxBytes) break;
      if (t - it.usedAt < this.protectMs) continue;
      this.remove(it.id);
      bytes -= it.bytes;
      count--;
    }
    return { artifacts: count, bytes };
  }

  private ensureRoom(bytes: number): void {
    const usage = this.gc(bytes, 1);
    if (usage.artifacts + 1 > this.maxArtifacts || usage.bytes + bytes > this.maxBytes) {
      throw new PrepError("QUOTA_EXCEEDED", 429, "The preparation upload quota is full; try again after pending plans expire.");
    }
  }

  private touch(id: string): void {
    const t = new Date(this.now());
    try {
      utimesSync(join(this.root, `${id}.bin`), t, t);
    } catch {
      // best effort; worst case the artifact is collected earlier and must be re-uploaded
    }
  }

  private checkFormat(format: string): asserts format is PrepArtifactFormat {
    if (!FORMATS.has(format)) throw new PrepError("UNSUPPORTED_FORMAT", 422, "The artifact format is not supported for preparation.");
  }

  /** Commit verified bytes (already on disk at `tmp`, or in memory) under the server-computed id. */
  private commit(format: PrepArtifactFormat, digest: string, size: number, tmp?: string, bytes?: Buffer): PutResult {
    const artifactId = `pa_${format}_${digest.slice(0, 40)}`;
    const bin = join(this.root, `${artifactId}.bin`);
    if (existsSync(bin) && existsSync(join(this.root, `${artifactId}.json`))) {
      if (tmp) rmSync(tmp, { force: true });
    } else {
      if (tmp) renameSync(tmp, bin);
      else writeAtomic(bin, bytes!);
      writeAtomic(join(this.root, `${artifactId}.json`), JSON.stringify({ format, sha256: digest, bytes: size } satisfies Meta));
    }
    this.touch(artifactId);
    return { artifactId, format, bytes: size };
  }

  /** In-memory put, for bytes the server already holds (source-artifact import, at most 20 MB from disk). */
  put(bytes: Buffer, format: string): PutResult {
    this.checkFormat(format);
    if (bytes.length === 0) throw new PrepError("INVALID_INPUT", 400, "The artifact is empty.");
    if (bytes.length > PREP_MAX_ARTIFACT_BYTES) throw oversize();
    if (format === "pdb" && !looksLikePdb(bytes)) throw new PrepError("UNSUPPORTED_FORMAT", 422, "The artifact is not a PDB file.");
    this.ensureRoom(bytes.length);
    return this.commit(format, sha256(bytes), bytes.length, undefined, bytes);
  }

  /**
   * Streaming upload: at most maxConcurrentUploads at once, quota checked up front (declared length) and again
   * with the real size, each chunk hashed and written to a temp file in this root, 20 MB cap enforced while
   * reading. Only the first 64 KB are kept in memory (for the PDB sniff).
   */
  async putStream(body: AsyncIterable<Buffer | string>, format: string, declaredLength?: number): Promise<PutResult> {
    this.checkFormat(format);
    if (declaredLength !== undefined && declaredLength > PREP_MAX_ARTIFACT_BYTES) throw oversize();
    if (this.uploads >= this.maxUploads) throw new PrepError("BUSY", 429, "Too many uploads are in progress; try again shortly.");
    this.uploads++;
    const tmp = join(this.root, `upload-${randomUUID()}.tmp`);
    let committed = false;
    try {
      this.ensureRoom(declaredLength ?? 0);
      const hash = createHash("sha256");
      const head: Buffer[] = [];
      let headBytes = 0;
      let size = 0;
      const fh = await open(tmp, "wx");
      try {
        for await (const chunk of body) {
          const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += b.length;
          if (size > PREP_MAX_ARTIFACT_BYTES) throw oversize();
          hash.update(b);
          if (headBytes < SNIFF_BYTES) {
            head.push(b.subarray(0, SNIFF_BYTES - headBytes));
            headBytes += Math.min(b.length, SNIFF_BYTES - headBytes);
          }
          await fh.write(b);
        }
      } finally {
        await fh.close();
      }
      if (size === 0) throw new PrepError("INVALID_INPUT", 400, "The artifact is empty.");
      if (format === "pdb" && !looksLikePdb(Buffer.concat(head))) throw new PrepError("UNSUPPORTED_FORMAT", 422, "The artifact is not a PDB file.");
      this.ensureRoom(size);
      const out = this.commit(format, hash.digest("hex"), size, tmp);
      committed = true;
      return out;
    } finally {
      this.uploads--;
      if (!committed) rmSync(tmp, { force: true });
    }
  }

  /** Maps a structure source artifact (84-char id) to a prep artifact. Only PDB receptors/ligands are admitted. */
  importSource(dataRoot: string, sourceArtifactId: unknown): PutResult {
    if (typeof sourceArtifactId !== "string" || !SOURCE_ARTIFACT_ID_PATTERN.test(sourceArtifactId)) throw new PrepError("INVALID_INPUT", 400, "The source artifact id is invalid.");
    let path: string;
    try {
      path = safeJoin(dataRoot, "source-artifacts", `${sourceArtifactId}.bin`);
    } catch {
      throw new PrepError("PATH_REJECTED", 400, "The requested path is not allowed.");
    }
    if (!existsSync(path)) throw new PrepError("ARTIFACT_NOT_FOUND", 404, "An artifact id was not found.");
    const st = statSync(path);
    if (!st.isFile() || st.size > PREP_MAX_ARTIFACT_BYTES) throw oversize();
    const bytes = readFileSync(path);
    if (!sourceArtifactId.endsWith(`_${sha256(bytes)}`)) throw new PrepError("ARTIFACT_TAMPERED", 422, "The stored source artifact failed SHA-256 verification.");
    if (!looksLikePdb(bytes)) throw new PrepError("UNSUPPORTED_FORMAT", 422, "Only PDB source artifacts can be prepared; upload ligands as SDF/MOL/MOL2/SMILES.");
    return this.put(bytes, "pdb");
  }

  /** Server-side resolver for the job store: re-hashes the stored bytes on every use (and refreshes retention). */
  resolve = async (artifactId: string): Promise<PrepArtifact | undefined> => {
    if (!PREP_ARTIFACT_ID_RE.test(artifactId)) return undefined;
    const bin = join(this.root, `${artifactId}.bin`);
    const metaPath = join(this.root, `${artifactId}.json`);
    if (!existsSync(bin) || !existsSync(metaPath)) return undefined;
    const st = statSync(bin);
    if (!st.isFile() || st.size > PREP_MAX_ARTIFACT_BYTES) throw oversize();
    let meta: Meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;
    } catch {
      throw new PrepError("ARTIFACT_TAMPERED", 422, "A stored artifact failed verification.");
    }
    const bytes = readFileSync(bin);
    if (!FORMATS.has(meta.format) || bytes.length !== meta.bytes || sha256(bytes) !== meta.sha256 || !artifactId.endsWith(`_${meta.sha256.slice(0, 40)}`) || !artifactId.startsWith(`pa_${meta.format}_`)) {
      throw new PrepError("ARTIFACT_TAMPERED", 422, "A stored artifact failed verification.");
    }
    this.touch(artifactId);
    return { format: meta.format, bytes };
  };
}
