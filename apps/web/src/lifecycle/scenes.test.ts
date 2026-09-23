import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { createWorkspaceObject } from "../workspace/workspaceModel";
import { SceneStore } from "./scenes";

const loadResult = (): StructureLoadResult => {
  const structure = {
    id: "structure:scene",
    name: "scene",
    format: "pdb",
    source: { kind: "LOCAL_FILE", originalFilename: "scene.pdb", format: "pdb", sha256: "source", byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
    counts: { atoms: 2, residues: 1, chains: 1, polymerAtoms: 2, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 0 } },
    atoms: [{ stableId: "a1", serial: 1, atomName: "N", element: "N", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false }, { stableId: "a2", serial: 2, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 1, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false }],
    bonds: [], hierarchy: { chainIds: ["chain:A"], chains: { "chain:A": { id: "chain:A", name: "A", residueIds: ["residue:1"] } }, residues: { "residue:1": { id: "residue:1", name: "ALA", number: 1, chainId: "chain:A", atomIds: ["a1", "a2"], isPolymer: true } } }, scientificHash: "rev:scene", coordinateStates: [{ id: "state:1", ordinal: 1, coordinates: { a1: { x: 0, y: 0, z: 0 }, a2: { x: 1, y: 0, z: 0 } }, coordinateHash: "state" }], stateOrder: ["state:1"],
  } as CanonicalMolecularStructure;
  return { structure, renderSource: { format: "pdb", content: "" } };
};

describe("R09 renderer-neutral scenes", () => {
  it("stores, recalls, updates, orders, and deletes presentation without changing science", () => {
    const object = createWorkspaceObject(loadResult()); const before = object.loadResult.structure.scientificHash; const store = new SceneStore();
    const stored = store.store({ name: "Overview", objects: [object], activeObjectId: object.objectId });
    expect(stored.ok).toBe(true); if (!stored.ok) return;
    const recalled = store.recall(stored.value.sceneId, [object]);
    expect(recalled.ok).toBe(true); if (!recalled.ok) return;
    expect(recalled.value.presentationByObjectId[object.objectId]).toBeTruthy();
    expect(recalled.value.scene.activeObjectId).toBe(object.objectId);
    expect(object.loadResult.structure.scientificHash).toBe(before);
    expect(store.rename(stored.value.sceneId, "Renamed").ok).toBe(true);
    expect(store.update(stored.value.sceneId, { objects: [object], activeObjectId: object.objectId }).ok).toBe(true);
    expect(store.delete(stored.value.sceneId).ok).toBe(true);
    expect(store.value.scenes).toHaveLength(0);
  });

  it("rejects stale scientific and missing object references", () => {
    const object = createWorkspaceObject(loadResult()); const store = new SceneStore(); const stored = store.store({ name: "Stale", objects: [object], activeObjectId: object.objectId });
    expect(stored.ok).toBe(true); if (!stored.ok) return;
    const changed = { ...object, loadResult: { ...object.loadResult, structure: { ...object.loadResult.structure, scientificHash: "rev:changed" } } };
    expect(store.recall(stored.value.sceneId, [changed])).toMatchObject({ ok: false, code: "STALE_REFERENCE" });
    expect(store.recall(stored.value.sceneId, [])).toMatchObject({ ok: false, code: "MISSING_DEPENDENCY" });
  });
});
