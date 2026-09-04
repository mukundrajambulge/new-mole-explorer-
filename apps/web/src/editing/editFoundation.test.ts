import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { selectionForStableIds } from "../selection/selectionEngine";
import { createAddBondCommand, createCoordinateEditCommand, createDeleteAtomsCommand, createDeleteBondCommand, createReplaceBondSemanticsCommand, deterministicScientificContentHash, invalidationManifestFor, ScientificHistoryService, stableStringify } from "./editFoundation";

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

const topologySelection = (service: ScientificHistoryService, objectId: string, atomIds: readonly string[]) => {
  const current = service.currentRevision(objectId)!;
  return selectionForStableIds(atomIds, current.loadResult.structure);
};

const deleteAtomsFor = (service: ScientificHistoryService, atomIds: readonly string[], objectId = "object:A") => {
  const current = service.currentRevision(objectId)!;
  const selection = topologySelection(service, objectId, atomIds);
  return createDeleteAtomsCommand({ objectId, baseRevisionId: current.revisionId, selectionResult: selection, atomIds, origin: { channel: "TEST", actionId: "EDIT_DELETE_ATOMS" }, provenance: { producerId: "r07-b2-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } });
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

  it("AT-B2-01/02/03/04 deletes exact atoms, cascades incident bonds, prunes every state, and derives identity", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const parent = service.currentRevision("object:A")!;
    const result = service.execute(deleteAtomsFor(service, ["a2"]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision.operation).toBe("EDIT_DELETE_ATOMS");
    expect(result.revision.loadResult.structure.atoms.map((atom) => atom.stableId)).toEqual(["a1", "a3"]);
    expect(result.revision.loadResult.structure.bonds).toEqual([]);
    expect(result.revision.loadResult.structure.coordinateStates?.every((state) => !state.coordinates.a2)).toBe(true);
    expect(result.revision.molecularIdentityId).not.toBe(parent.molecularIdentityId);
    expect(result.entityLineage.find((entry) => entry.entityKind === "ATOM" && entry.sourceId === "a2")).toMatchObject({ outcome: "RETIRED" });
    expect(result.entityLineage.filter((entry) => entry.entityKind === "BOND").filter((entry) => entry.outcome === "RETIRED").map((entry) => entry.sourceId)).toEqual(expect.arrayContaining(["b1", "b2"]));
    expect(parent.loadResult.structure.atoms).toHaveLength(3);
  });

  it("AT-B2-05/06/07/08 fails closed for empty, ambiguous, missing, renderer-index, and cross-object targets", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    service.registerRoot("object:B", fixture());
    const before = service.historyState("object:A")!;
    const empty = service.execute(deleteAtomsFor(service, []));
    expect(empty).toMatchObject({ ok: false, code: "EMPTY_SELECTION" });
    const rendererIndex = service.execute({ ...deleteAtomsFor(service, ["a1"]), target: { ...deleteAtomsFor(service, ["a1"]).target, atomIds: ["0"] }, selectionResult: topologySelection(service, "object:A", ["a1"]) });
    expect(rendererIndex).toMatchObject({ ok: false, code: "AMBIGUOUS_TARGET" });
    const missingSelection = topologySelection(service, "object:A", ["missing"]);
    const missing = service.execute(createDeleteAtomsCommand({ objectId: "object:A", baseRevisionId: before.currentRevisionId, selectionResult: missingSelection, atomIds: ["missing"], origin: { channel: "TEST" } }));
    expect(missing).toMatchObject({ ok: false, code: "TARGET_NOT_FOUND" });
    const crossSelection = topologySelection(service, "object:A", ["a1", "a2"]);
    const cross = service.execute(createAddBondCommand({ objectId: "object:A", baseRevisionId: before.currentRevisionId, selectionResult: crossSelection, atomIds: ["a1", "a2"], objectIds: ["object:A", "object:B"], order: "SINGLE", origin: { channel: "TEST" } }));
    expect(cross).toMatchObject({ ok: false, code: "CROSS_OBJECT_TOPOLOGY_UNSUPPORTED" });
    expect(service.historyState("object:A")).toEqual(before);
  });

  it("AT-B2-09/10/11 creates bonds with canonical endpoints and rejects self, duplicate, unsupported, and over-valence requests", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const root = service.currentRevision("object:A")!;
    const endpoints = topologySelection(service, "object:A", ["a1", "a3"]);
    const created = service.execute(createAddBondCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: endpoints, atomIds: ["a1", "a3"], order: "DOUBLE", origin: { channel: "TEST" } }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const newBond = created.revision.loadResult.structure.bonds.find((bond) => !root.loadResult.structure.bonds.some((candidate) => candidate.id === bond.id));
    expect(newBond).toMatchObject({ atom1: "a1", atom2: "a3", order: "DOUBLE" });
    expect(created.entityLineage).toContainEqual(expect.objectContaining({ entityKind: "BOND", resultId: newBond?.id, outcome: "NEW" }));
    service.undo("object:A");
    const unsupported = service.execute({ ...createAddBondCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: topologySelection(service, "object:A", ["a1", "a3"]), atomIds: ["a1", "a3"], order: "SINGLE", origin: { channel: "TEST" } }), parameters: { order: "QUADRUPLE" } });
    expect(unsupported).toMatchObject({ ok: false, code: "UNSUPPORTED_BOND_ORDER" });
    const duplicate = service.execute(createAddBondCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: topologySelection(service, "object:A", ["a1", "a2"]), atomIds: ["a1", "a2"], order: "SINGLE", origin: { channel: "TEST" } }));
    expect(duplicate).toMatchObject({ ok: false, code: "DUPLICATE_BOND" });
    const self = service.execute({ ...createAddBondCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: topologySelection(service, "object:A", ["a1"]), atomIds: ["a1"], order: "SINGLE", origin: { channel: "TEST" } }), target: { ...createAddBondCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: topologySelection(service, "object:A", ["a1"]), atomIds: ["a1"], order: "SINGLE", origin: { channel: "TEST" } }).target, atomIds: ["a1", "a1"] } });
    expect(self).toMatchObject({ ok: false, code: "SELF_BOND" });

    const overValence = fixture();
    const extraAtom = { ...overValence.structure.atoms[0]!, stableId: "a4", serial: 4, atomName: "C4", x: 3 };
    const overStructure: CanonicalMolecularStructure = {
      ...overValence.structure,
      atoms: [...overValence.structure.atoms, extraAtom],
      counts: { ...overValence.structure.counts, atoms: 4, polymerAtoms: 4 },
      bounds: { ...overValence.structure.bounds, max: { x: 3, y: 0, z: 0 } },
      hierarchy: { ...overValence.structure.hierarchy, residues: { ...overValence.structure.hierarchy.residues, "residue:A:1": { ...overValence.structure.hierarchy.residues["residue:A:1"]!, atomIds: ["a1", "a2", "a3", "a4"] } } },
      coordinateStates: overValence.structure.coordinateStates?.map((state) => ({ ...state, coordinates: { ...state.coordinates, a4: { x: 3, y: 0, z: 0 } } })),
    };
    const overService = new ScientificHistoryService();
    overService.registerRoot("object:OVER", { ...overValence, structure: overStructure });
    const overRoot = overService.currentRevision("object:OVER")!;
    const overResult = overService.execute(createAddBondCommand({ objectId: "object:OVER", baseRevisionId: overRoot.revisionId, selectionResult: selectionForStableIds(["a2", "a4"], overRoot.loadResult.structure), atomIds: ["a2", "a4"], order: "TRIPLE", origin: { channel: "TEST" } }));
    expect(overResult).toMatchObject({ ok: false, code: "CHEMISTRY_AMBIGUOUS" });
    expect(overService.historyState("object:OVER")).toMatchObject({ currentRevisionId: overRoot.revisionId, retainedRevisionCount: 1 });
  });

  it("AT-B2-12/13/14 unbonds exact canonical bonds while preserving endpoint atoms", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const root = service.currentRevision("object:A")!;
    const result = service.execute(createDeleteBondCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: topologySelection(service, "object:A", ["a1", "a2"]), atomIds: ["a1", "a2"], origin: { channel: "TEST" } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision.loadResult.structure.atoms.map((atom) => atom.stableId)).toEqual(["a1", "a2", "a3"]);
    expect(result.revision.loadResult.structure.bonds.map((bond) => bond.id)).toEqual(["b2"]);
    expect(result.entityLineage).toContainEqual(expect.objectContaining({ entityKind: "BOND", sourceId: "b1", outcome: "RETIRED" }));
    const absent = service.execute(createDeleteBondCommand({ objectId: "object:A", baseRevisionId: result.resultRevisionId, selectionResult: topologySelection(service, "object:A", ["a1", "a2"]), atomIds: ["a1", "a2"], origin: { channel: "TEST" } }));
    expect(absent).toMatchObject({ ok: false, code: "BOND_NOT_FOUND" });
  });

  it("AT-B2-15/16/17 replaces bond semantics with a new BondUID and preserves the old revision", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const root = service.currentRevision("object:A")!;
    const result = service.execute(createReplaceBondSemanticsCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: topologySelection(service, "object:A", ["a1", "a2"]), atomIds: ["a1", "a2"], order: "DOUBLE", bondId: "b1", origin: { channel: "TEST" } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bond = result.revision.loadResult.structure.bonds.find((candidate) => candidate.atom1 === "a1" && candidate.atom2 === "a2");
    expect(bond?.order).toBe("DOUBLE");
    expect(bond?.id).not.toBe("b1");
    expect(result.revision.loadResult.structure.bonds).toHaveLength(2);
    expect(result.entityLineage).toContainEqual(expect.objectContaining({ entityKind: "BOND", sourceId: "b1", resultId: bond?.id, outcome: "REPLACED" }));
    expect(result.entityLineage).toContainEqual(expect.objectContaining({ entityKind: "BOND", resultId: bond?.id, outcome: "NEW" }));
    expect(root.loadResult.structure.bonds.find((candidate) => candidate.id === "b1")?.order).toBe("SINGLE");
  });

  it("AT-B2-18/19/20 binds invalidation and stale selection to the exact child revision", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    const root = service.currentRevision("object:A")!;
    const oldSelection = topologySelection(service, "object:A", ["a2"]);
    const deletion = service.execute(createDeleteAtomsCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: oldSelection, atomIds: ["a2"], origin: { channel: "TEST" } }));
    expect(deletion.ok).toBe(true);
    if (!deletion.ok) return;
    expect(deletion.invalidationManifest.changedDomains).toEqual(["TOPOLOGY", "IDENTITY"]);
    expect(deletion.invalidationManifest.staleArtifactCategories).toEqual(expect.arrayContaining(["TOPOLOGY_SELECTION", "NEIGHBOR_ANALYSIS", "RING_ANALYSIS", "SURFACE_CACHE", "STRUCTURAL_ANALYSIS", "DOCKING_PREPARATION"]));
    expect(deletion.invalidationManifest.staleArtifactIds).toEqual(expect.arrayContaining(["a2", oldSelection.resultId, "b1", "b2"]));
    const stale = service.execute(createDeleteAtomsCommand({ objectId: "object:A", baseRevisionId: deletion.resultRevisionId, selectionResult: oldSelection, atomIds: ["a2"], origin: { channel: "TEST" } }));
    expect(stale).toMatchObject({ ok: false, code: "STALE_BASE_REVISION" });
  });

  it("AT-B2-21/22/23/24 performs exact topology undo/redo, branch retention, and object isolation", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:A", fixture());
    service.registerRoot("object:B", fixture());
    const root = service.currentRevision("object:A")!;
    const added = service.execute(createAddBondCommand({ objectId: "object:A", baseRevisionId: root.revisionId, selectionResult: topologySelection(service, "object:A", ["a1", "a3"]), atomIds: ["a1", "a3"], order: "SINGLE", origin: { channel: "TEST" } }));
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(service.currentRevision("object:B")?.revisionId).toBe("root-r07");
    expect(service.undo("object:A")).toMatchObject({ ok: true, toRevisionId: root.revisionId });
    expect(service.redo("object:A")).toMatchObject({ ok: true, toRevisionId: added.resultRevisionId });
    expect(service.currentRevision("object:A")?.loadResult.structure.bonds).toHaveLength(3);
    expect(service.currentRevision("object:B")?.loadResult.structure.bonds).toHaveLength(2);
  });
});
