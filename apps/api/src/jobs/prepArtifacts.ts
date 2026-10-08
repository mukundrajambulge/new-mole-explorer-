import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { SOURCE_ARTIFACT_ID_PATTERN, safeJoin } from "../projects/safeJoin.js";
import { PREP_MAX_ARTIFACT_BYTES, PrepError, writeAtomic, type PrepArtifact } from "./prepJobs.js";

/**
 * Preparation artifact store (task 5.2b). The server stores uploads by a sha256 it computes itself and hands
 * back a short opaque id (`pa_<format>_<40 hex>`, at most 48 chars, inside the 64-char ArtifactIdSchema cap).
 * Structure source artifacts (`source_<kind>_<sha256>`, 84 chars) are mapped by importing their stored bytes
 * (re-verified against the digest in the id) into this store, so the client never sends digests or paths.
 */
export const PREP_ARTIFACT_FORMATS = ["pdb", "sdf", "mol", "mol2", "smi"] as const;
export type PrepArtifactFormat = (typeof PREP_ARTIFACT_FORMATS)[number];
const FORMATS = new Set<string>(PREP_ARTIFACT_FORMATS);
export const PREP_ARTIFACT_ID_RE = /^pa_(pdb|sdf|mol|mol2|smi)_[0-9a-f]{40}$/;

type Meta = { format: PrepArtifactFormat; sha256: string; bytes: number };
const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/** Cheap content sniff: a PDB has fixed-column records and is not mmCIF. */
export const looksLikePdb = (bytes: Buffer): boolean => {
  const head = bytes.subarray(0, 64 * 1024).toString("latin1");
  if (/^\s*data_/m.test(head.slice(0, 200)) || head.includes("_atom_site.")) return false;
  return /^(ATOM {2}|HETATM)/m.test(head);
};

export class PrepArtifactStore {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }

  put(bytes: Buffer, format: string): { artifactId: string; format: PrepArtifactFormat; bytes: number } {
    if (!FORMATS.has(format)) throw new PrepError("UNSUPPORTED_FORMAT", 422, "The artifact format is not supported for preparation.");
    if (bytes.length === 0) throw new PrepError("INVALID_INPUT", 400, "The artifact is empty.");
    if (bytes.length > PREP_MAX_ARTIFACT_BYTES) throw new PrepError("OVERSIZE_INPUT", 413, "An input artifact exceeds 20 MB.");
    if (format === "pdb" && !looksLikePdb(bytes)) throw new PrepError("UNSUPPORTED_FORMAT", 422, "The artifact is not a PDB file.");
    const digest = sha256(bytes);
    const artifactId = `pa_${format}_${digest.slice(0, 40)}`;
    const bin = join(this.root, `${artifactId}.bin`);
    if (!existsSync(bin)) {
      writeAtomic(bin, bytes);
      writeAtomic(join(this.root, `${artifactId}.json`), JSON.stringify({ format: format as PrepArtifactFormat, sha256: digest, bytes: bytes.length } satisfies Meta));
    }
    return { artifactId, format: format as PrepArtifactFormat, bytes: bytes.length };
  }

  /** Maps a structure source artifact (84-char id) to a prep artifact. Only PDB receptors/ligands are admitted. */
  importSource(dataRoot: string, sourceArtifactId: unknown): { artifactId: string; format: PrepArtifactFormat; bytes: number } {
    if (typeof sourceArtifactId !== "string" || !SOURCE_ARTIFACT_ID_PATTERN.test(sourceArtifactId)) throw new PrepError("INVALID_INPUT", 400, "The source artifact id is invalid.");
    let path: string;
    try {
      path = safeJoin(dataRoot, "source-artifacts", `${sourceArtifactId}.bin`);
    } catch {
      throw new PrepError("PATH_REJECTED", 400, "The requested path is not allowed.");
    }
    if (!existsSync(path)) throw new PrepError("ARTIFACT_NOT_FOUND", 404, "An artifact id was not found.");
    const st = statSync(path);
    if (!st.isFile() || st.size > PREP_MAX_ARTIFACT_BYTES) throw new PrepError("OVERSIZE_INPUT", 413, "An input artifact exceeds 20 MB.");
    const bytes = readFileSync(path);
    if (!sourceArtifactId.endsWith(`_${sha256(bytes)}`)) throw new PrepError("ARTIFACT_TAMPERED", 422, "The stored source artifact failed SHA-256 verification.");
    if (!looksLikePdb(bytes)) throw new PrepError("UNSUPPORTED_FORMAT", 422, "Only PDB source artifacts can be prepared; upload ligands as SDF/MOL/MOL2/SMILES.");
    return this.put(bytes, "pdb");
  }

  /** Server-side resolver for the job store: re-hashes the stored bytes on every use. */
  resolve = async (artifactId: string): Promise<PrepArtifact | undefined> => {
    if (!PREP_ARTIFACT_ID_RE.test(artifactId)) return undefined;
    const bin = join(this.root, `${artifactId}.bin`);
    const metaPath = join(this.root, `${artifactId}.json`);
    if (!existsSync(bin) || !existsSync(metaPath)) return undefined;
    const st = statSync(bin);
    if (!st.isFile() || st.size > PREP_MAX_ARTIFACT_BYTES) throw new PrepError("OVERSIZE_INPUT", 413, "An input artifact exceeds 20 MB.");
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
    return { format: meta.format, bytes };
  };
}
