import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionDraft } from "@molecular/contracts";
import { StructureIngestionService } from "../structures/ingestion.js";
import { SourceArtifactStore } from "../lifecycle/sourceArtifactStore.js";
import { SessionStore } from "./sessionStore.js";
import { DEFAULT_PROJECT_PRESENTATION } from "./projectStore.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

const draftFor = async (root: string): Promise<SessionDraft> => {
  const fixture = await readFile(join(process.cwd(), "..", "..", "tests", "fixtures", "mini-protein.pdb"));
  const loadResult = await new StructureIngestionService(new SourceArtifactStore(root)).ingestLocal("mini-protein.pdb", fixture);
  const objectId = `object:${loadResult.structure.id}`;
  return {
    sessionFormatVersion: 2,
    objects: [{ objectId, displayName: "mini-protein.pdb", enabled: true, currentStateId: loadResult.structure.stateOrder![0]!, stateOrder: loadResult.structure.stateOrder!, allStates: false, loadResult, projection: {}, lineage: { operation: "LOAD", parentObjectIds: [], parentStructureIds: [loadResult.structure.id] }, molecularIdentityId: loadResult.structure.id, scientificRevisionId: loadResult.structure.scientificHash, retainedScientificRevisionIds: [loadResult.structure.scientificHash] }],
    activeObjectId: objectId,
    globalFrameIndex: 0,
    workspaceGroups: [],
    selections: [],
    results: [],
    sceneCollection: { schemaVersion: 1, scenes: [], currentSceneId: null },
    presentationState: {},
    dependencyMode: "SELF_CONTAINED",
  };
};

describe("R09 immutable SessionRevision store", () => {
  it("publishes multi-object-capable immutable revisions and reopens them", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-r09-session-")); roots.push(root);
    const store = new SessionStore(root);
    const created = await store.create("Lifecycle");
    const draft = await draftFor(root);
    const saved = await store.save(created.id, { structure: draft.objects[0]!.loadResult, presentation: DEFAULT_PROJECT_PRESENTATION, session: draft, expectedRevision: created.revision });
    const opened = await store.open(created.id);
    expect(saved.revision).toBe(2);
    expect(opened.session?.objects).toHaveLength(1);
    expect(opened.session?.parentSessionRevisionIds).toHaveLength(1);
    expect((await store.listRevisions(created.id))).toHaveLength(2);
  });

  it("rejects stale writers and leaves the published head unchanged on interruption", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-r09-conflict-")); roots.push(root);
    const store = new SessionStore(root); const created = await store.create("Conflict"); const draft = await draftFor(root);
    const first = await store.save(created.id, { structure: draft.objects[0]!.loadResult, presentation: DEFAULT_PROJECT_PRESENTATION, session: draft, expectedRevision: 1 });
    await expect(store.save(created.id, { structure: draft.objects[0]!.loadResult, presentation: DEFAULT_PROJECT_PRESENTATION, session: draft, expectedRevision: 1 })).rejects.toMatchObject({ code: "REVISION_CONFLICT", status: 409 });
    await expect(store.save(created.id, { structure: draft.objects[0]!.loadResult, presentation: DEFAULT_PROJECT_PRESENTATION, session: draft, expectedRevision: first.revision }, { simulateInterruption: true })).rejects.toThrow("SIMULATED_INTERRUPTION");
    expect((await store.open(created.id)).session?.sessionRevisionId).toBe(first.session?.sessionRevisionId);
    expect((await store.listRevisions(created.id))).toHaveLength(3);
  });

  it("fails closed for future schemas, manifest corruption, and source-byte corruption", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-r09-integrity-")); roots.push(root);
    const store = new SessionStore(root); const created = await store.create("Integrity"); const draft = await draftFor(root);
    const saved = await store.save(created.id, { structure: draft.objects[0]!.loadResult, presentation: DEFAULT_PROJECT_PRESENTATION, session: draft, expectedRevision: 1 });
    const revisionPath = join(root, "sessions", created.id, "revisions", `${saved.session!.sessionRevisionId}.json`);
    const original = JSON.parse(await readFile(revisionPath, "utf8")) as Record<string, unknown>;
    await writeFile(revisionPath, JSON.stringify({ ...original, name: "tampered" }), "utf8");
    await expect(store.open(created.id)).rejects.toMatchObject({ code: "INTEGRITY_MISMATCH" });
    await writeFile(revisionPath, JSON.stringify({ ...original, sessionFormatVersion: 99 }), "utf8");
    await expect(store.open(created.id)).rejects.toMatchObject({ code: "SCHEMA_UNSUPPORTED" });
    await writeFile(revisionPath, JSON.stringify(original), "utf8");
    const artifactPath = join(root, draft.objects[0]!.loadResult.sourceArtifact!.rawStorageRef!.replaceAll("/", "\\"));
    await writeFile(artifactPath, Buffer.from("corrupt"));
    await expect(store.open(created.id)).rejects.toMatchObject({ code: "INTEGRITY_MISMATCH" });
  });

  it("migrates a legacy project into a migration revision without changing its science", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-r09-migration-")); roots.push(root);
    const draft = await draftFor(root); const id = "project_00000000-0000-0000-0000-000000000009";
    await writeFile(join(root, `${id}.json`), JSON.stringify({ id, name: "Legacy", schemaVersion: 1, revision: 4, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), structure: draft.objects[0]!.loadResult, presentation: {} }), "utf8");
    const opened = await new SessionStore(root).open(id);
    expect(opened.session?.revisionType).toBe("MIGRATION");
    expect(opened.session?.migrationHistory[0]).toMatchObject({ fromSessionFormatVersion: 1, toSessionFormatVersion: 2 });
    expect(opened.structure?.structure.scientificHash).toBe(draft.objects[0]!.loadResult.structure.scientificHash);
  });
});
