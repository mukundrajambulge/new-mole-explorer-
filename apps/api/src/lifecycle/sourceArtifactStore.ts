import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
    const rawStorageRef = this.rootDir ? `source-artifacts/${sourceArtifactId}.bin` : undefined;
    if (this.rootDir) {
      const directory = join(this.rootDir, "source-artifacts");
      await mkdir(directory, { recursive: true });
      const path = join(directory, `${sourceArtifactId}.bin`);
      try {
        await readFile(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const temporaryPath = `${path}.${randomUUID()}.tmp`;
        await writeFile(temporaryPath, buffer);
        await rename(temporaryPath, path);
      }
    }
    this.memory.set(sourceArtifactId, buffer);
    return {
      schemaVersion: 1,
      sourceArtifactId,
      acquisitionKind: input.acquisitionKind,
      ...(input.sourceUri ? { sourceUri: input.sourceUri } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.accession ? { accession: input.accession } : {}),
      originalFilename: input.originalFilename,
      mediaType: input.mediaType,
      byteLength: buffer.length,
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
