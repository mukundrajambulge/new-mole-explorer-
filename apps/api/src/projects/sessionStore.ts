import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  JsonRecord,
  ProjectPresentationState,
  ProjectRecord,
  ProjectSaveRequest,
  RestoreStatus,
  SceneCollection,
  SessionDependency,
  SessionDraft,
  SessionIntegrityEntry,
  SessionManifest,
  SessionObjectRecord,
  SessionRevisionType,
} from "@molecular/contracts";
import { IngestionError } from "../structures/ingestion.js";
import { SCIENTIFIC_HASH_PROFILE, SESSION_INTEGRITY_PROFILE, sha256Canonical } from "../lifecycle/canonicalSerialization.js";
import { SourceArtifactStore } from "../lifecycle/sourceArtifactStore.js";

export const SESSION_FORMAT_VERSION = 2 as const;
export const APPLICATION_BUILD_ID = "molecular-workstation-r09";

type SessionIndex = {
  sessionFormatVersion: 2;
  sessionId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  currentHeadRevisionId: string;
};

export type SessionRevisionSummary = Pick<SessionManifest, "sessionRevisionId" | "parentSessionRevisionIds" | "savedAt" | "revisionType" | "name">;

export type SessionSaveOptions = {
  expectedRevision?: number;
  revisionType?: SessionRevisionType;
  simulateInterruption?: boolean;
};

const safeSessionId = (id: string): string => {
  if (!/^project_[a-f0-9-]+$/i.test(id)) throw new IngestionError("PROJECT_INVALID", "The project ID is invalid.");
  return id;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const defaultSceneCollection = (): SceneCollection => ({ schemaVersion: 1, scenes: [], currentSceneId: null });
const defaultPresentation = (presentation: ProjectPresentationState): JsonRecord => clone(presentation) as unknown as JsonRecord;

const defaultDraft = (sessionId: string, name: string, structure: ProjectSaveRequest["structure"], presentation: ProjectPresentationState): SessionDraft => ({
  sessionFormatVersion: 2,
  sessionId,
  name,
  documents: [],
  objects: [],
  activeObjectId: null,
  globalFrameIndex: 0,
  workspaceGroups: [],
  selections: [],
  results: [],
  sceneCollection: defaultSceneCollection(),
  presentationState: defaultPresentation(presentation),
  dependencyMode: "SELF_CONTAINED",
  dependencies: [],
  requiredCapabilities: [],
  optionalCapabilities: [],
  externalDependencyManifest: [],
  commandAudit: [],
  provenanceRefs: [],
  scientificPolicyVersion: SCIENTIFIC_HASH_PROFILE,
  canonicalizationProfileVersion: SESSION_INTEGRITY_PROFILE,
  applicationBuildId: APPLICATION_BUILD_ID,
  recoveryMetadata: null,
  ...(structure ? {
    objects: [{
      objectId: `object:${structure.structure.id}`,
      displayName: structure.structure.source.originalFilename || structure.structure.name,
      enabled: true,
      currentStateId: structure.structure.stateOrder?.[0] ?? structure.structure.coordinateStates?.[0]?.id ?? `${structure.structure.id}:state:1`,
      stateOrder: structure.structure.stateOrder ?? structure.structure.coordinateStates?.map((state) => state.id) ?? [`${structure.structure.id}:state:1`],
      allStates: false,
      loadResult: structure,
      projection: defaultPresentation(presentation),
      lineage: { operation: "LOAD", parentObjectIds: [], parentStructureIds: [structure.structure.id] },
      molecularIdentityId: structure.structure.id,
      scientificRevisionId: structure.structure.scientificHash,
      retainedScientificRevisionIds: [structure.structure.scientificHash],
    } satisfies SessionObjectRecord],
    activeObjectId: `object:${structure.structure.id}`,
  } : {}),
});

const sourceArtifactsFrom = (draft: SessionDraft): SessionIntegrityEntry[] => draft.objects.flatMap((object) => {
  const artifact = object.loadResult.sourceArtifact;
  return artifact ? [{ artifactId: artifact.sourceArtifactId, kind: "SOURCE_ARTIFACT", sha256: artifact.sha256, byteLength: artifact.byteLength, ...(artifact.rawStorageRef ? { storageRef: artifact.rawStorageRef } : {}) }] : [];
});

const dependenciesFor = (draft: SessionDraft): SessionDependency[] => draft.objects.flatMap((object) => {
  const artifact = object.loadResult.sourceArtifact;
  if (!artifact) return [];
  return [{ dependencyId: artifact.sourceArtifactId, kind: "SOURCE_ARTIFACT", required: true, mode: draft.dependencyMode ?? "REFERENCED", ...(artifact.sourceUri ? { uri: artifact.sourceUri } : {}), ...(artifact.provider ? { provider: artifact.provider } : {}), expectedSha256: artifact.sha256, byteLength: artifact.byteLength, ...(artifact.rawStorageRef ? { localStorageRef: artifact.rawStorageRef } : {}) }];
});

const manifestBasis = (manifest: SessionManifest): unknown => {
  const { integrity, ...rest } = manifest;
  return { ...rest, integrityEntries: integrity.entries };
};

const sealManifest = (draft: SessionDraft, index: SessionIndex, sessionRevisionId: string, parentSessionRevisionIds: readonly string[], savedAt: string, revisionType: SessionRevisionType): SessionManifest => {
  const entries = sourceArtifactsFrom(draft);
  const manifest = {
    ...clone(draft),
    sessionFormatVersion: 2 as const,
    sessionId: index.sessionId,
    name: draft.name?.trim() || index.name,
    sessionRevisionId,
    parentSessionRevisionIds: [...parentSessionRevisionIds],
    revisionType,
    savedAt,
    documents: [...(draft.documents ?? [])],
    workspaceGroups: [...draft.workspaceGroups],
    selections: [...draft.selections],
    results: [...draft.results],
    requiredCapabilities: [...(draft.requiredCapabilities ?? [])],
    optionalCapabilities: [...(draft.optionalCapabilities ?? [])],
    dependencies: [...(draft.dependencies?.length ? draft.dependencies : dependenciesFor(draft))],
    externalDependencyManifest: [...(draft.externalDependencyManifest?.length ? draft.externalDependencyManifest : dependenciesFor(draft))],
    scientificPolicyVersion: draft.scientificPolicyVersion ?? SCIENTIFIC_HASH_PROFILE,
    canonicalizationProfileVersion: draft.canonicalizationProfileVersion ?? SESSION_INTEGRITY_PROFILE,
    applicationBuildId: draft.applicationBuildId ?? APPLICATION_BUILD_ID,
    integrityProfileVersion: SESSION_INTEGRITY_PROFILE,
    integrity: { manifestSha256: "", entries },
    migrationHistory: [],
    restoreMetadata: { status: "EXACT_RESTORED", openedFromRevisionId: sessionRevisionId },
  } satisfies SessionManifest;
  manifest.integrity.manifestSha256 = sha256Canonical(manifestBasis(manifest));
  return manifest;
};

const validateDraft = (draft: SessionDraft): void => {
  if (!Array.isArray(draft.objects)) throw new IngestionError("PROJECT_INVALID", "Session objects must be an array.");
  const objectIds = new Set<string>();
  for (const object of draft.objects) {
    if (!object.objectId || objectIds.has(object.objectId)) throw new IngestionError("NAME_COLLISION", `Session object identity ${object.objectId || "<empty>"} is duplicated.`);
    objectIds.add(object.objectId);
    if (!object.loadResult?.structure?.scientificHash || !object.scientificRevisionId) throw new IngestionError("PROJECT_INVALID", `Session object ${object.objectId} has no scientific revision reference.`);
    if (!object.stateOrder.length || !object.stateOrder.includes(object.currentStateId)) throw new IngestionError("PROJECT_INVALID", `Session object ${object.objectId} has an invalid coordinate state reference.`);
  }
  if (draft.activeObjectId !== null && draft.activeObjectId !== undefined && !objectIds.has(draft.activeObjectId)) throw new IngestionError("STALE_REFERENCE", `Active object ${draft.activeObjectId} is not present in the session.`);
  for (const group of draft.workspaceGroups) {
    const members = Array.isArray(group.objectIds) ? group.objectIds : [];
    if (members.some((objectId) => !objectIds.has(String(objectId)))) throw new IngestionError("STALE_REFERENCE", "Workspace group references an object that is not in the session.");
  }
  for (const selection of draft.selections) {
    if (selection.sourceRevisionRefs.some((reference) => !objectIds.has(reference.objectId))) throw new IngestionError("STALE_REFERENCE", `Selection ${selection.selectionId} references a missing object.`);
  }
  for (const result of draft.results) {
    if (result.sourceRevisionRefs.some((reference) => !objectIds.has(reference.objectId))) throw new IngestionError("STALE_REFERENCE", `Result ${result.resultId} references a missing object.`);
  }
  for (const scene of draft.sceneCollection.scenes) {
    if (scene.objectRefs.some((reference) => !objectIds.has(reference.objectId))) throw new IngestionError("MISSING_DEPENDENCY", `Scene ${scene.sceneId} references a missing object.`);
  }
};

const validateManifestEntries = (manifest: SessionManifest): void => {
  const expected = sourceArtifactsFrom(manifest);
  const entries = manifest.integrity.entries.filter((entry) => entry.kind === "SOURCE_ARTIFACT");
  if (entries.length !== expected.length) throw new IngestionError("INTEGRITY_MISMATCH", "Session source-artifact integrity entries do not match the saved workspace objects.");
  const actualById = new Map(entries.map((entry) => [entry.artifactId, entry]));
  for (const expectedEntry of expected) {
    const actual = actualById.get(expectedEntry.artifactId);
    if (!actual || actual.sha256 !== expectedEntry.sha256 || actual.byteLength !== expectedEntry.byteLength || actual.storageRef !== expectedEntry.storageRef) throw new IngestionError("INTEGRITY_MISMATCH", `Source artifact ${expectedEntry.artifactId} is not represented faithfully in the session integrity manifest.`);
  }
};

const projectFromManifest = (index: SessionIndex, manifest: SessionManifest, restoreStatus: RestoreStatus): ProjectRecord => {
  const first = manifest.objects[0];
  const presentation = (manifest.presentationState && typeof manifest.presentationState === "object" && (manifest.presentationState as Record<string, unknown>).schemaVersion === 1)
    ? manifest.presentationState as unknown as ProjectPresentationState
    : ({ schemaVersion: 1, representation: "cartoon", layerVisibility: { protein: true, ligand: true, water: false, ions: true, other: true }, color: { mode: "element" }, background: { preset: "Black", color: "#05070a" }, camera: { view: null, defaultView: null } } satisfies ProjectPresentationState);
  return {
    id: index.sessionId,
    name: manifest.name ?? index.name,
    schemaVersion: 1,
    revision: index.revision,
    createdAt: index.createdAt,
    updatedAt: index.updatedAt,
    structure: first?.loadResult ?? null,
    presentation,
    session: manifest,
    restoreStatus,
    dirty: false,
  };
};

export class SessionStore {
  private readonly sessionsDir: string;

  constructor(private readonly rootDir: string, private readonly sourceArtifacts = new SourceArtifactStore(rootDir)) {
    this.sessionsDir = join(rootDir, "sessions");
  }

  private sessionDir(id: string): string { return join(this.sessionsDir, safeSessionId(id)); }
  private indexPath(id: string): string { return join(this.sessionDir(id), "index.json"); }
  private revisionPath(id: string, revisionId: string): string { return join(this.sessionDir(id), "revisions", `${revisionId}.json`); }
  private legacyPath(id: string): string { return join(this.rootDir, `${safeSessionId(id)}.json`); }

  private async atomicWrite(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, path);
  }

  private async readIndex(id: string): Promise<SessionIndex> {
    try {
      const parsed = JSON.parse(await readFile(this.indexPath(id), "utf8")) as SessionIndex;
      if (parsed.sessionFormatVersion !== 2) throw new IngestionError("SCHEMA_UNSUPPORTED", "The session index schema is not supported.");
      return parsed;
    } catch (error) {
      if (error instanceof IngestionError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new IngestionError("PROJECT_NOT_FOUND", `Project ${id} was not found.`, 404);
      throw new IngestionError("PROJECT_INVALID", "The saved session index could not be read.");
    }
  }

  private async readManifest(id: string, revisionId: string): Promise<SessionManifest> {
    try {
      const manifest = JSON.parse(await readFile(this.revisionPath(id, revisionId), "utf8")) as SessionManifest;
      if (manifest.sessionFormatVersion > SESSION_FORMAT_VERSION) throw new IngestionError("SCHEMA_UNSUPPORTED", "The saved session requires a newer unsupported schema.");
      if (manifest.sessionFormatVersion !== SESSION_FORMAT_VERSION) throw new IngestionError("MIGRATION_FAILED", "The saved session requires a migration that is not available.");
      if (!manifest.integrity?.manifestSha256 || sha256Canonical(manifestBasis(manifest)) !== manifest.integrity.manifestSha256) throw new IngestionError("INTEGRITY_MISMATCH", `Session revision ${revisionId} failed manifest integrity verification.`);
      validateManifestEntries(manifest);
      return manifest;
    } catch (error) {
      if (error instanceof IngestionError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new IngestionError("PROJECT_NOT_FOUND", `Session revision ${revisionId} was not found.`, 404);
      throw new IngestionError("INTEGRITY_MISMATCH", `Session revision ${revisionId} could not be decoded or verified.`);
    }
  }

  async create(name = "Untitled Project"): Promise<ProjectRecord> {
    const now = new Date().toISOString();
    const sessionId = `project_${randomUUID()}`;
    const index: SessionIndex = { sessionFormatVersion: 2, sessionId, name: name.trim() || "Untitled Project", createdAt: now, updatedAt: now, revision: 1, currentHeadRevisionId: `session-revision-${randomUUID()}` };
    const draft = defaultDraft(sessionId, index.name, null, { schemaVersion: 1, representation: "cartoon", layerVisibility: { protein: true, ligand: true, water: false, ions: true, other: true }, color: { mode: "element" }, background: { preset: "Black", color: "#05070a" }, camera: { view: null, defaultView: null } });
    const manifest = sealManifest(draft, index, index.currentHeadRevisionId, [], now, "USER_CHECKPOINT");
    await this.atomicWrite(this.revisionPath(sessionId, manifest.sessionRevisionId), JSON.stringify(manifest, null, 2));
    await this.atomicWrite(this.indexPath(sessionId), JSON.stringify(index, null, 2));
    return projectFromManifest(index, manifest, "EXACT_RESTORED");
  }

  async open(id: string, revisionId?: string): Promise<ProjectRecord> {
    const index = await this.ensureMigrated(id);
    const selectedRevisionId = revisionId?.trim() || index.currentHeadRevisionId;
    const manifest = await this.readManifest(id, selectedRevisionId);
    let restoreStatus: RestoreStatus = "EXACT_RESTORED";
    for (const object of manifest.objects) {
      const artifact = object.loadResult.sourceArtifact;
      if (!artifact) {
        if (manifest.dependencyMode === "SELF_CONTAINED") throw new IngestionError("MISSING_DEPENDENCY", `Self-contained session object ${object.objectId} has no source artifact.`);
        restoreStatus = "DEGRADED_RESTORED";
        continue;
      }
      if (manifest.dependencyMode === "SELF_CONTAINED" && !artifact.rawStorageRef) throw new IngestionError("MISSING_DEPENDENCY", `Self-contained source artifact ${artifact.sourceArtifactId} has no local storage reference.`);
      if (!artifact.rawStorageRef) continue;
      try {
        await this.sourceArtifacts.verify(artifact);
      } catch (error) {
        const message = error instanceof Error ? error.message : "A source artifact failed integrity verification.";
        if (manifest.dependencyMode === "SELF_CONTAINED" || !message.includes("is not available locally")) throw new IngestionError("INTEGRITY_MISMATCH", message);
        restoreStatus = "DEGRADED_RESTORED";
      }
    }
    return projectFromManifest(index, manifest, restoreStatus);
  }

  async save(id: string, request: ProjectSaveRequest, options: SessionSaveOptions = {}): Promise<ProjectRecord> {
    const index = await this.ensureMigrated(id);
    const expectedRevision = options.expectedRevision ?? request.expectedRevision;
    if (expectedRevision !== undefined && expectedRevision !== index.revision) throw new IngestionError("REVISION_CONFLICT", "The session changed before it could be saved; reload it before saving again.", 409);
    const draft = request.session ? clone(request.session) : defaultDraft(index.sessionId, request.name?.trim() || index.name, request.structure, request.presentation);
    draft.sessionId = index.sessionId;
    draft.name = request.name?.trim() || draft.name || index.name;
    validateDraft(draft);
    const now = new Date().toISOString();
    const manifest = sealManifest(draft, index, `session-revision-${randomUUID()}`, [index.currentHeadRevisionId], now, options.revisionType ?? "USER_CHECKPOINT");
    const revisionPath = this.revisionPath(id, manifest.sessionRevisionId);
    await this.atomicWrite(revisionPath, JSON.stringify(manifest, null, 2));
    const written = await this.readManifest(id, manifest.sessionRevisionId);
    if (written.integrity.manifestSha256 !== manifest.integrity.manifestSha256) throw new IngestionError("INTEGRITY_MISMATCH", "The staged session revision failed its post-write integrity check.");
    if (options.simulateInterruption) throw new Error("SIMULATED_INTERRUPTION_BEFORE_HEAD_PUBLICATION");
    const nextIndex: SessionIndex = { ...index, name: manifest.name ?? index.name, updatedAt: now, revision: index.revision + 1, currentHeadRevisionId: manifest.sessionRevisionId };
    await this.atomicWrite(this.indexPath(id), JSON.stringify(nextIndex, null, 2));
    return projectFromManifest(nextIndex, manifest, "EXACT_RESTORED");
  }

  async listRevisions(id: string): Promise<readonly SessionRevisionSummary[]> {
    const index = await this.ensureMigrated(id);
    const { readdir } = await import("node:fs/promises");
    let names: string[] = [];
    try { names = await readdir(join(this.sessionDir(id), "revisions")); } catch { return []; }
    const revisions = await Promise.all(names.filter((name) => name.endsWith(".json")).map(async (name) => {
      const manifest = await this.readManifest(id, name.slice(0, -5));
      return { sessionRevisionId: manifest.sessionRevisionId, parentSessionRevisionIds: manifest.parentSessionRevisionIds, savedAt: manifest.savedAt, revisionType: manifest.revisionType, name: manifest.name } satisfies SessionRevisionSummary;
    }));
    return revisions.sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((revision) => revision.sessionRevisionId === index.currentHeadRevisionId ? { ...revision, name: `${revision.name} (current)` } : revision);
  }

  private async ensureMigrated(id: string): Promise<SessionIndex> {
    try {
      return await this.readIndex(id);
    } catch (error) {
      if (!(error instanceof IngestionError) || error.code !== "PROJECT_NOT_FOUND") throw error;
      let legacy: ProjectRecord;
      try {
        legacy = JSON.parse(await readFile(this.legacyPath(id), "utf8")) as ProjectRecord;
      } catch {
        throw error;
      }
      if (!legacy || legacy.schemaVersion !== 1 || legacy.id !== id) throw new IngestionError("MIGRATION_FAILED", `Legacy project ${id} could not be migrated safely.`);
      const now = new Date().toISOString();
      const index: SessionIndex = { sessionFormatVersion: 2, sessionId: id, name: legacy.name || "Untitled Project", createdAt: legacy.createdAt || now, updatedAt: legacy.updatedAt || now, revision: Math.max(1, legacy.revision || 1), currentHeadRevisionId: `session-revision-migration-${randomUUID()}` };
      const draft = { ...defaultDraft(id, index.name, legacy.structure, legacy.presentation), dependencyMode: legacy.structure?.sourceArtifact ? "SELF_CONTAINED" as const : "REFERENCED" as const };
      const manifest = sealManifest(draft, index, index.currentHeadRevisionId, [], now, "MIGRATION");
      manifest.migrationHistory = [{ fromSessionFormatVersion: 1, toSessionFormatVersion: 2, migratedAt: now, sourceFile: this.legacyPath(id) }];
      manifest.restoreMetadata = { status: "EXACT_RESTORED", migration: "v1-to-v2", openedFromRevisionId: manifest.sessionRevisionId };
      manifest.integrity.manifestSha256 = sha256Canonical(manifestBasis(manifest));
      await this.atomicWrite(this.revisionPath(id, manifest.sessionRevisionId), JSON.stringify(manifest, null, 2));
      await this.atomicWrite(this.indexPath(id), JSON.stringify(index, null, 2));
      return index;
    }
  }
}
