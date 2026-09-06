import type { JsonRecord, SceneCollection, SceneObjectReference, SceneRecord, SceneStoreDimension } from "@molecular/contracts";
import type { RenderProjection } from "../rendering/renderProjection";
import type { WorkspaceObject } from "../workspace/workspaceModel";

export type SceneCaptureInput = {
  name: string;
  objects: readonly WorkspaceObject[];
  activeObjectId: string | null;
  scientificRevisionIdFor?: (object: WorkspaceObject) => string;
  selectionRefs?: readonly string[];
  resultRefs?: readonly string[];
  storeMask?: readonly SceneStoreDimension[];
  provenance?: JsonRecord;
};

export type SceneRecall = {
  scene: SceneRecord;
  presentationByObjectId: Readonly<Record<string, RenderProjection>>;
  activeObjectId: string | null;
};

export type SceneResult<T> = { ok: true; value: T } | { ok: false; code: "INVALID_INPUT" | "NAME_COLLISION" | "MISSING_DEPENDENCY" | "STALE_REFERENCE"; message: string };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const emptyCollection = (): SceneCollection => ({ schemaVersion: 1, scenes: [], currentSceneId: null });
const nextId = (name: string, scenes: readonly SceneRecord[]): string => {
  const base = `scene:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"}`;
  let candidate = base;
  let suffix = 2;
  while (scenes.some((scene) => scene.sceneId === candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
};

const capture = (input: SceneCaptureInput, sceneId: string, sceneRevision: number, orderIndex: number): SceneRecord => {
  const objects = input.objects.map((object): SceneObjectReference => ({
    objectId: object.objectId,
    scientificRevisionId: input.scientificRevisionIdFor?.(object) ?? object.loadResult.structure.scientificHash,
    stateId: object.currentStateId,
  }));
  const presentation = Object.fromEntries(input.objects.map((object) => [object.objectId, clone(object.projection)])) as unknown as JsonRecord;
  return {
    schemaVersion: 1,
    sceneId,
    sceneRevision,
    name: input.name.trim(),
    orderIndex,
    activeObjectId: input.activeObjectId,
    objectRefs: objects,
    selectionRefs: [...(input.selectionRefs ?? [])],
    resultRefs: [...(input.resultRefs ?? [])],
    storeMask: [...(input.storeMask ?? ["VIEW", "COLOR", "ACTIVE", "REPRESENTATION", "FRAME_STATE"])],
    presentation,
    provenance: clone(input.provenance ?? { producer: "molecular-workstation", kind: "renderer-neutral-scene" }),
    dependencyStatus: "VALID",
  };
};

export class SceneStore {
  private collection: SceneCollection;

  constructor(collection: SceneCollection = emptyCollection()) {
    this.collection = clone(collection);
  }

  get value(): SceneCollection { return clone(this.collection); }
  get current(): SceneRecord | null { return this.collection.scenes.find((scene) => scene.sceneId === this.collection.currentSceneId) ?? null; }

  store(input: SceneCaptureInput): SceneResult<SceneRecord> {
    const name = input.name.trim();
    if (!name) return { ok: false, code: "INVALID_INPUT", message: "A scene name is required." };
    if (this.collection.scenes.some((scene) => scene.name.toLowerCase() === name.toLowerCase())) return { ok: false, code: "NAME_COLLISION", message: `Scene ${name} already exists.` };
    const scene = capture({ ...input, name }, nextId(name, this.collection.scenes), 1, this.collection.scenes.length);
    this.collection = { ...this.collection, scenes: [...this.collection.scenes, scene], currentSceneId: scene.sceneId };
    return { ok: true, value: clone(scene) };
  }

  update(sceneId: string, input: Omit<SceneCaptureInput, "name"> & { name?: string }): SceneResult<SceneRecord> {
    const index = this.collection.scenes.findIndex((scene) => scene.sceneId === sceneId);
    if (index < 0) return { ok: false, code: "MISSING_DEPENDENCY", message: `Scene ${sceneId} does not exist.` };
    const previous = this.collection.scenes[index]!;
    const name = input.name?.trim() || previous.name;
    if (this.collection.scenes.some((scene, candidateIndex) => candidateIndex !== index && scene.name.toLowerCase() === name.toLowerCase())) return { ok: false, code: "NAME_COLLISION", message: `Scene ${name} already exists.` };
    const scene = capture({ ...input, name }, sceneId, previous.sceneRevision + 1, previous.orderIndex);
    const scenes = this.collection.scenes.map((candidate, candidateIndex) => candidateIndex === index ? scene : candidate);
    this.collection = { ...this.collection, scenes, currentSceneId: sceneId };
    return { ok: true, value: clone(scene) };
  }

  rename(sceneId: string, name: string): SceneResult<SceneRecord> {
    const scene = this.collection.scenes.find((candidate) => candidate.sceneId === sceneId);
    if (!scene) return { ok: false, code: "MISSING_DEPENDENCY", message: `Scene ${sceneId} does not exist.` };
    const nextName = name.trim();
    if (!nextName) return { ok: false, code: "INVALID_INPUT", message: "A scene name is required." };
    if (this.collection.scenes.some((candidate) => candidate.sceneId !== sceneId && candidate.name.toLowerCase() === nextName.toLowerCase())) return { ok: false, code: "NAME_COLLISION", message: `Scene ${nextName} already exists.` };
    const renamed = { ...scene, name: nextName, sceneRevision: scene.sceneRevision + 1 };
    this.collection = { ...this.collection, scenes: this.collection.scenes.map((candidate) => candidate.sceneId === sceneId ? renamed : candidate) };
    return { ok: true, value: clone(renamed) };
  }

  delete(sceneId: string): SceneResult<null> {
    if (!this.collection.scenes.some((scene) => scene.sceneId === sceneId)) return { ok: false, code: "MISSING_DEPENDENCY", message: `Scene ${sceneId} does not exist.` };
    const scenes = this.collection.scenes.filter((scene) => scene.sceneId !== sceneId).map((scene, orderIndex) => ({ ...scene, orderIndex }));
    this.collection = { ...this.collection, scenes, currentSceneId: scenes[0]?.sceneId ?? null };
    return { ok: true, value: null };
  }

  reorder(sceneIds: readonly string[]): SceneResult<SceneCollection> {
    const known = new Set(this.collection.scenes.map((scene) => scene.sceneId));
    if (sceneIds.length !== known.size || sceneIds.some((id) => !known.has(id))) return { ok: false, code: "INVALID_INPUT", message: "Scene order must contain every scene exactly once." };
    const scenes = sceneIds.map((id, orderIndex) => ({ ...this.collection.scenes.find((scene) => scene.sceneId === id)!, orderIndex }));
    this.collection = { ...this.collection, scenes };
    return { ok: true, value: this.value };
  }

  select(sceneId: string): SceneResult<SceneRecord> {
    const scene = this.collection.scenes.find((candidate) => candidate.sceneId === sceneId);
    if (!scene) return { ok: false, code: "MISSING_DEPENDENCY", message: `Scene ${sceneId} does not exist.` };
    this.collection = { ...this.collection, currentSceneId: sceneId };
    return { ok: true, value: clone(scene) };
  }

  step(direction: -1 | 1): SceneResult<SceneRecord> {
    if (!this.collection.scenes.length) return { ok: false, code: "MISSING_DEPENDENCY", message: "No scenes are stored." };
    const currentIndex = Math.max(0, this.collection.scenes.findIndex((scene) => scene.sceneId === this.collection.currentSceneId));
    const nextIndex = (currentIndex + direction + this.collection.scenes.length) % this.collection.scenes.length;
    return this.select(this.collection.scenes[nextIndex]!.sceneId);
  }

  recall(sceneId: string, objects: readonly WorkspaceObject[], scientificRevisionIdFor?: (object: WorkspaceObject) => string): SceneResult<SceneRecall> {
    const scene = this.collection.scenes.find((candidate) => candidate.sceneId === sceneId);
    if (!scene) return { ok: false, code: "MISSING_DEPENDENCY", message: `Scene ${sceneId} does not exist.` };
    const objectsById = new Map(objects.map((object) => [object.objectId, object]));
    const presentationByObjectId: Record<string, RenderProjection> = {};
    for (const reference of scene.objectRefs) {
      const object = objectsById.get(reference.objectId);
      if (!object) return { ok: false, code: "MISSING_DEPENDENCY", message: `Scene ${scene.name} requires missing object ${reference.objectId}.` };
      const currentRevision = scientificRevisionIdFor?.(object) ?? object.loadResult.structure.scientificHash;
      if (currentRevision !== reference.scientificRevisionId) return { ok: false, code: "STALE_REFERENCE", message: `Scene ${scene.name} belongs to scientific revision ${reference.scientificRevisionId.slice(0, 12)}…; object ${object.displayName} is at ${currentRevision.slice(0, 12)}….` };
      if (!object.stateOrder.includes(reference.stateId)) return { ok: false, code: "STALE_REFERENCE", message: `Scene ${scene.name} references missing coordinate state ${reference.stateId}.` };
      const persisted = scene.presentation[reference.objectId];
      if (!persisted || typeof persisted !== "object") return { ok: false, code: "MISSING_DEPENDENCY", message: `Scene ${scene.name} has no presentation for object ${reference.objectId}.` };
      presentationByObjectId[reference.objectId] = clone(persisted) as unknown as RenderProjection;
    }
    this.collection = { ...this.collection, currentSceneId: sceneId };
    return { ok: true, value: { scene: clone(scene), presentationByObjectId, activeObjectId: scene.activeObjectId && objectsById.has(scene.activeObjectId) ? scene.activeObjectId : scene.objectRefs[0]?.objectId ?? null } };
  }
}

export const createSceneStore = (collection?: SceneCollection): SceneStore => new SceneStore(collection);
