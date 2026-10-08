import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { FormatEvidence, RemoteStructureProvider, SourceArtifact, StructureFormat } from "@molecular/contracts";
import { sha256Bytes } from "./canonicalSerialization.js";

export type SourceArtifactSeal = {
  acquisitionKind: SourceArtifact["acquisitionKind"];
  originalFilename: string;
  mediaType: string;
  format: StructureFormat;
  formatEvidence: readonly FormatEvidence[];
  parserProfile: string;
  sourceUri?: string;
  provider?: RemoteStructureProvider;
  accession?: string;
  providerMetadata?: Readonly<Record<string, string>>;
  parentExportArtifactId?: string;
};

/** Stores exact source bytes separately from parsed scientific records. */
export class SourceArtifactStore {
  private readonly memory = new Map<string, Buffer>();

  constructor(private readonly rootDir?: string) {}

  async seal(input: SourceArtifactSeal, bytes: Uint8Array, acquiredAt = new Date().toISOString()): Promise<SourceArtifact> {
    const buffer = Buffer.from(bytes);
    const sha256 = sha256Bytes(buffer);
    const sourceArtifactId = `source_${input.acquisitionKind.toLowerCase()}_${sha256}`;
    await this.persist(sourceArtifactId, (temporaryPath) => writeFile(temporaryPath, buffer));
    this.memory.set(sourceArtifactId, buffer);
    return this.record(input, sourceArtifactId, sha256, buffer.length, acquiredAt);
  }

  /**
   * Seal a file the server itself wrote (an upload temp file). `sha256` and `byteLength` must come
   * from the server's own read of that file, never from the client. With a root directory the bytes
   * are copied on disk and not kept in memory.
   */
  async sealFile(input: SourceArtifactSeal, filePath: string, sha256: string, byteLength: number, acquiredAt = new Date().toISOString()): Promise<SourceArtifact> {
    const sourceArtifactId = `source_${input.acquisitionKind.toLowerCase()}_${sha256}`;
    if (this.rootDir) await this.persist(sourceArtifactId, (temporaryPath) => copyFile(filePath, temporaryPath));
    else this.memory.set(sourceArtifactId, await readFile(filePath));
    return this.record(input, sourceArtifactId, sha256, byteLength, acquiredAt);
  }

  private async persist(sourceArtifactId: string, write: (temporaryPath: string) => Promise<void>): Promise<void> {
    if (!this.rootDir) return;
    const directory = join(this.rootDir, "source-artifacts");
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${sourceArtifactId}.bin`);
    try {
      await stat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const temporaryPath = `${path}.${randomUUID()}.tmp`;
      await write(temporaryPath);
      await rename(temporaryPath, path);
    }
  }

  private record(input: SourceArtifactSeal, sourceArtifactId: string, sha256: string, byteLength: number, acquiredAt: string): SourceArtifact {
    const rawStorageRef = this.rootDir ? `source-artifacts/${sourceArtifactId}.bin` : undefined;
    return {
      schemaVersion: 1,
      sourceArtifactId,
      acquisitionKind: input.acquisitionKind,
      ...(input.sourceUri ? { sourceUri: input.sourceUri } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.accession ? { accession: input.accession } : {}),
      originalFilename: input.originalFilename,
      mediaType: input.mediaType,
      byteLength,
      sha256,
      acquiredAt,
      ...(input.providerMetadata && Object.keys(input.providerMetadata).length ? { providerMetadata: { ...input.providerMetadata } } : {}),
      format: input.format,
      formatEvidence: [...input.formatEvidence],
      parserProfile: input.parserProfile,
      ...(rawStorageRef ? { rawStorageRef } : {}),
      ...(input.parentExportArtifactId ? { parentExportArtifactId: input.parentExportArtifactId } : {}),
    };
  }

  async bytesFor(artifact: SourceArtifact): Promise<Buffer> {
    const memory = this.memory.get(artifact.sourceArtifactId);
    if (memory) return Buffer.from(memory);
    if (!this.rootDir || !artifact.rawStorageRef) throw new Error(`Source artifact ${artifact.sourceArtifactId} is not available locally.`);
    return readFile(join(this.rootDir, ...artifact.rawStorageRef.split("/")));
  }

  async verify(artifact: SourceArtifact): Promise<void> {
    const bytes = await this.bytesFor(artifact);
    const digest = sha256Bytes(bytes);
    if (bytes.length !== artifact.byteLength || digest !== artifact.sha256) throw new Error(`Source artifact ${artifact.sourceArtifactId} failed SHA-256 verification.`);
  }
}
