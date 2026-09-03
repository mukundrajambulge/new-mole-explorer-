import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { selectionForStableIds } from "../selection/selectionEngine";
import { createCoordinateEditCommand, deterministicScientificContentHash, invalidationManifestFor, ScientificHistoryService, stableStringify } from "./editFoundation";

const fixture = (): StructureLoadResult => {
  const structure: CanonicalMolecularStructure = {
    id: "fixture-r07",
    name: "R07 fixture",
    format: "pdb",
    source: { kind: "LOCAL_FILE", originalFilename: "r07-fixture.pdb", format: "pdb", sha256: "fixture", byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
    counts: { atoms: 3, residues: 1, chains: 1, polymerAtoms: 3, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 0, z: 0 } },
    atoms: [
      { stableId: "a1", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
      { stableId: "a2", serial: 2, atomName: "N", element: "N", residueName: "ALA", residueNumber: 1, chain: "A", x: 1, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
      { stableId: "a3", serial: 3, atomName: "C", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 2, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
    ],
    bonds: [{ id: "b1", atom1: "a1", atom2: "a2", order: "SINGLE", source: "PDB_CONECT" }, { id: "b2", atom1: "a2", atom2: "a3", order: "SINGLE", source: "PDB_CONECT" }],
    hierarchy: { chainIds: ["chain:A"], chains: { "chain:A": { id: "chain:A", name: "A", residueIds: ["residue:A:1"] } }, residues: { "residue:A:1": { id: "residue:A:1", name: "ALA", number: 1, chainId: "chain:A", atomIds: ["a1", "a2", "a3"], isPolymer: true } } },
    coordinateStates: [
      { id: "fixture-r07:state:1", ordinal: 1, sourceModelNumber: 1, coordinates: { a1: { x: 0, y: 0, z: 0 }, a2: { x: 1, y: 0, z: 0 }, a3: { x: 2, y: 0, z: 0 } }, coordinateHash: "state-1" },
      { id: "fixture-r07:state:2", ordinal: 2, sourceModelNumber: 2, coordinates: { a1: { x: 10, y: 0, z: 0 }, a2: { x: 11, y: 0, z: 0 }, a3: { x: 12, y: 0, z: 0 } }, coordinateHash: "state-2" },
    ],
    stateOrder: ["fixture-r07:state:1", "fixture-r07:state:2"],
    scientificHash: "root-r07",
  };
  return { structure, renderSource: { format: "pdb", content: "ATOM" } };
};

const commandFor = (service: ScientificHistoryService, objectId = "object:A", stateId = "fixture-r07:state:1", coordinate = { x: 0.25, y: 0, z: 0 }) => {
  const current = service.currentRevision(objectId)!;
  const selection = selectionForStableIds(["a1"], current.loadResult.structure);
  return createCoordinateEditCommand({ objectId, baseRevisionId: current.revisionId, selectionResult: selection, stateScope: { kind: "COORDINATE_STATE_ID", stateId }, coordinates: { a1: coordinate }, origin: { channel: "TEST", actionId: "EDIT.TEST_COORDINATE" }, provenance: { producerId: "r07-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } });
};

describe("R07-B1 scientific edit foundation", () => {
  it("publishes an immutable child revision with parent and preserved identity lineage", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const parent = service.currentRevision("object:A")!;
    const result = service.execute(commandFor(service));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision.parentRevisionId).toBe(parent.revisionId);
    expect(result.revision.molecularIdentityId).toBe(parent.molecularIdentityId);
    expect(result.revision.loadResult.structure.atoms[0]!.x).toBe(0.25);
    expect(parent.loadResult.structure.atoms[0]!.x).toBe(0);
    expect(result.entityLineage.filter((entry) => entry.entityKind === "ATOM").every((entry) => entry.outcome === "PRESERVED")).toBe(true);
  });

  it("fails closed before publication for invalid, stale, wrong-object, missing-target and invalid-state input", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    service.registerRoot("object:B", fixture());
    const before = service.historyState("object:A")!;
    const stale = { ...commandFor(service), baseRevisionId: "stale" };
    const invalid = { ...commandFor(service), parameters: { coordinates: { a1: { x: Number.NaN, y: 0, z: 0 } } } };
    const wrongObject = { ...commandFor(service), objectId: "object:B", target: { ...commandFor(service).target, objectId: "object:A" } };
    const missingTarget = { ...commandFor(service), target: { ...commandFor(service).target, atomIds: ["missing"] } };
    const invalidState = { ...commandFor(service), stateScope: { kind: "COORDINATE_STATE_ID" as const, stateId: "no-state" } };
    expect(service.execute(stale)).toMatchObject({ ok: false, code: "STALE_BASE_REVISION" });
    expect(service.execute(invalid)).toMatchObject({ ok: false, code: "TRANSACTION_VALIDATION_FAILED" });
    expect(service.execute(wrongObject)).toMatchObject({ ok: false, code: "REVISION_CONFLICT" });
    expect(service.execute(missingTarget)).toMatchObject({ ok: false, code: "TARGET_NOT_FOUND" });
    expect(service.execute(invalidState)).toMatchObject({ ok: false, code: "INVALID_STATE_SCOPE" });
    expect(service.historyState("object:A")).toEqual(before);
  });

  it("supports exact undo/redo and reports unavailable navigation", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const root = service.currentRevision("object:A")!;
    const edit = service.execute(commandFor(service));
    expect(edit.ok).toBe(true);
    if (!edit.ok) return;
    expect(service.undo("object:A")).toMatchObject({ ok: true, toRevisionId: root.revisionId });
    expect(service.currentRevision("object:A")!.revisionId).toBe(root.revisionId);
    expect(service.redo("object:A")).toMatchObject({ ok: true, toRevisionId: edit.resultRevisionId });
    expect(service.currentRevision("object:A")!.revisionId).toBe(edit.resultRevisionId);
    expect(service.redo("object:A")).toMatchObject({ ok: false, code: "REDO_UNAVAILABLE" });
    service.undo("object:A");
    expect(service.undo("object:A")).toMatchObject({ ok: false, code: "UNDO_UNAVAILABLE" });
  });

  it("retains branches after undo and makes ambiguous redo explicit", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const first = service.execute(commandFor(service, "object:A", "fixture-r07:state:1", { x: 0.25, y: 0, z: 0 }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    service.undo("object:A");
    const second = service.execute(commandFor(service, "object:A", "fixture-r07:state:1", { x: 0.5, y: 0, z: 0 }));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(service.undo("object:A").ok).toBe(true);
    const state = service.historyState("object:A")!;
    expect(state.retainedRevisionCount).toBe(3);
    expect(state.childRevisionIds).toEqual(expect.arrayContaining([first.resultRevisionId, second.resultRevisionId]));
    expect(service.redo("object:A")).toMatchObject({ ok: false, code: "REDO_BRANCH_AMBIGUOUS" });
    expect(service.redo("object:A", first.resultRevisionId)).toMatchObject({ ok: true, toRevisionId: first.resultRevisionId });
  });

  it("keeps presentation-only changes outside scientific history and declares coordinate invalidation", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const before = service.historyState("object:A")!;
    expect(service.presentationOnly("object:A")).toMatchObject({ createdScientificRevision: false, scientificRevisionId: before.currentRevisionId });
    expect(service.historyState("object:A")).toEqual(before);
    const invalidation = invalidationManifestFor(["COORDINATES"]);
    expect(invalidation.presentationOnly).toBe(false);
    expect(invalidation.staleArtifactCategories).toEqual(expect.arrayContaining(["SPATIAL_SELECTION", "MEASUREMENT", "CONTACT_ANALYSIS", "GEOMETRY_CACHE"]));
    expect(invalidationManifestFor(["PRESENTATION"]).staleArtifactCategories).toEqual([]);
  });

  it("applies an explicit state scope without cloning coordinates into other states", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const edit = service.execute(commandFor(service, "object:A", "fixture-r07:state:2", { x: 10.5, y: 0, z: 0 }));
    expect(edit.ok).toBe(true);
    if (!edit.ok) return;
    const states = edit.revision.loadResult.structure.coordinateStates!;
    expect(states[0]!.coordinates.a1).toEqual({ x: 0, y: 0, z: 0 });
    expect(states[1]!.coordinates.a1).toEqual({ x: 10.5, y: 0, z: 0 });
    const allWithoutStatePatches = service.execute({ ...commandFor(service), baseRevisionId: edit.resultRevisionId, stateScope: { kind: "ALL" }, parameters: { coordinates: { a1: { x: 2, y: 0, z: 0 } } } });
    expect(allWithoutStatePatches).toMatchObject({ ok: false, code: "INVALID_STATE_SCOPE" });
  });

  it("isolates object histories and makes revision/content serialization deterministic", () => {
    const first = new ScientificHistoryService();
    const second = new ScientificHistoryService();
    first.registerRoot("object:A", fixture());
    first.registerRoot("object:B", fixture());
    second.registerRoot("object:A", fixture());
    second.registerRoot("object:B", fixture());
    const firstEdit = first.execute(commandFor(first));
    const secondEdit = second.execute(commandFor(second));
    expect(firstEdit.ok && secondEdit.ok).toBe(true);
    if (!firstEdit.ok || !secondEdit.ok) return;
    expect(firstEdit.resultRevisionId).toBe(secondEdit.resultRevisionId);
    expect(first.currentRevision("object:B")!.revisionId).toBe(second.currentRevision("object:B")!.revisionId);
    expect(first.currentRevision("object:B")!.loadResult.structure.atoms[0]!.x).toBe(0);
    expect(deterministicScientificContentHash(fixture().structure)).toBe(deterministicScientificContentHash(fixture().structure));
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
    expect(first.persistenceManifest("object:A")).toMatchObject({ currentRevisionId: firstEdit.resultRevisionId, retainedRevisionIds: expect.arrayContaining([firstEdit.resultRevisionId]) });
  });
});
