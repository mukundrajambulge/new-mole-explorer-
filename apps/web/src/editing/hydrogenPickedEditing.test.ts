import { describe, expect, it } from "vitest";
import type { CanonicalAtom, CanonicalBond, CanonicalMolecularStructure, Coordinate3D, StructureLoadResult } from "@molecular/contracts";
import { selectionForStableIds } from "../selection/selectionEngine";
import { createAddHydrogensCommand, createAttachAtomCommand, createRefillHydrogensCommand, createRemoveHydrogensCommand, createReplaceAtomCommand, ScientificHistoryService } from "./editFoundation";

const atomFor = (stableId: string, element: string, coordinate: Coordinate3D, formalCharge?: number): CanonicalAtom => ({ stableId, serial: Number(stableId.replace(/\D/g, "")) || 1, atomName: stableId.toUpperCase(), element, residueName: "LIG", residueNumber: 1, chain: "A", ...coordinate, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false, ...(formalCharge === undefined ? {} : { formalCharge }) });

const fixture = (atoms: CanonicalAtom[], bonds: CanonicalBond[] = [], stateCount = 1): StructureLoadResult => {
  const states = Array.from({ length: stateCount }, (_, index) => ({
    id: `b3:state:${index + 1}`,
    ordinal: index + 1,
    sourceModelNumber: index + 1,
    coordinates: Object.fromEntries(atoms.map((atom) => [atom.stableId, { x: atom.x + index * 10, y: atom.y, z: atom.z }])),
    coordinateHash: `state-${index + 1}`,
  }));
  const structure: CanonicalMolecularStructure = {
    id: "fixture-b3",
    name: "R07 B3 fixture",
    format: "pdb",
    source: { kind: "LOCAL_FILE", originalFilename: "r07-b3-fixture.pdb", format: "pdb", sha256: "b3-fixture", byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "b3-test" },
    counts: { atoms: atoms.length, residues: 1, chains: 1, polymerAtoms: 0, ligandAtoms: atoms.length, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
    bounds: { min: { x: -2, y: -2, z: -2 }, max: { x: 12, y: 12, z: 12 } },
    atoms,
    bonds,
    hierarchy: { chainIds: ["chain:A"], chains: { "chain:A": { id: "chain:A", name: "A", residueIds: ["residue:A:1"] } }, residues: { "residue:A:1": { id: "residue:A:1", name: "LIG", number: 1, chainId: "chain:A", atomIds: atoms.map((atom) => atom.stableId), isPolymer: false } } },
    coordinateStates: states,
    stateOrder: states.map((state) => state.id),
    scientificHash: "root-b3",
  };
  return { structure, renderSource: { format: "pdb", content: "ATOM\n" } };
};

const commandSelection = (service: ScientificHistoryService, objectId: string, ids: readonly string[]) => {
  const current = service.currentRevision(objectId)!;
  return { current, selection: selectionForStableIds(ids, current.loadResult.structure) };
};

describe("R07-B3 hydrogen and picked editing", () => {
  it("AT-R07-17..19 adds expected C/N/O hydrogens with stable identities and policy versions", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:b3", fixture([atomFor("c1", "C", { x: 0, y: 0, z: 0 }), atomFor("n2", "N", { x: 2, y: 0, z: 0 }), atomFor("o3", "O", { x: 4, y: 0, z: 0 })]));
    const { current, selection } = commandSelection(service, "object:b3", ["c1", "n2", "o3"]);
    const result = service.execute(createAddHydrogensCommand({ objectId: "object:b3", baseRevisionId: current.revisionId, selectionResult: selection, atomIds: ["c1", "n2", "o3"], origin: { channel: "TEST", actionId: "B3.H_ADD" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hydrogens = result.revision.loadResult.structure.atoms.filter((atom) => atom.element === "H");
    expect(hydrogens).toHaveLength(9);
    expect(new Set(hydrogens.map((atom) => atom.stableId)).size).toBe(9);
    expect(result.revision.loadResult.structure.bonds.filter((bond) => hydrogens.some((atom) => bond.atom1 === atom.stableId || bond.atom2 === atom.stableId))).toHaveLength(9);
    expect(result.chemistryValidation?.status).toBe("VALID");
    expect(result.hydrogenAdditionPolicy).toMatchObject({ policyId: "r07-b3-hydrogen-policy-v1", valenceModelVersion: "explicit-valence-v1", aromaticityPerceptionVersion: "declared-aromaticity-perception-v1", coordinatePlacementAlgorithmVersion: "deterministic-local-frame-v1", unsupportedChemistryPolicy: "FAIL_CLOSED" });
  });

  it("AT-R07-20..21 fails closed for ambiguous protonation and records declared aromaticity", () => {
    const carboxylate = fixture([atomFor("cc", "C", { x: 0, y: 0, z: 0 }), atomFor("od", "O", { x: 1.2, y: 0, z: 0 }, -1), atomFor("od2", "O", { x: -1.2, y: 0, z: 0 })], [{ id: "cc-od", atom1: "cc", atom2: "od", order: "SINGLE", source: "UNKNOWN" }, { id: "cc-od2", atom1: "cc", atom2: "od2", order: "DOUBLE", source: "UNKNOWN" }]);
    const service = new ScientificHistoryService();
    service.registerRoot("object:ambiguous", carboxylate);
    const ambiguous = commandSelection(service, "object:ambiguous", ["od"]);
    expect(service.execute(createAddHydrogensCommand({ objectId: "object:ambiguous", baseRevisionId: ambiguous.current.revisionId, selectionResult: ambiguous.selection, atomIds: ["od"], origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }))).toMatchObject({ ok: false, code: "CHEMISTRY_AMBIGUOUS" });

    const aromaticAtoms = [atomFor("ar1", "C", { x: 0, y: 0, z: 0 }), atomFor("ar2", "C", { x: 1, y: 0, z: 0 }), atomFor("arn", "N", { x: 2, y: 0, z: 0 })];
    const aromaticBonds = [{ id: "ar-b1", atom1: "ar1", atom2: "ar2", order: "AROMATIC" as const, source: "UNKNOWN" as const }, { id: "ar-b2", atom1: "ar2", atom2: "arn", order: "AROMATIC" as const, source: "UNKNOWN" as const }, { id: "ar-b3", atom1: "arn", atom2: "ar1", order: "AROMATIC" as const, source: "UNKNOWN" as const }];
    const aromaticService = new ScientificHistoryService();
    aromaticService.registerRoot("object:aromatic", fixture(aromaticAtoms, aromaticBonds));
    const aromatic = commandSelection(aromaticService, "object:aromatic", ["ar1", "arn"]);
    const aromaticResult = aromaticService.execute(createAddHydrogensCommand({ objectId: "object:aromatic", baseRevisionId: aromatic.current.revisionId, selectionResult: aromatic.selection, atomIds: ["ar1", "arn"], origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(aromaticResult.ok).toBe(true);
    if (aromaticResult.ok) expect(aromaticResult.hydrogenAdditionPolicy?.aromaticityPerceptionState).toBe("DECLARED_TOPOLOGY_ONLY");
  });

  it("AT-R07-22..23 refills local hydrogens atomically and publishes no intermediate dehydrogenated revision", () => {
    const parent = atomFor("c1", "C", { x: 0, y: 0, z: 0 });
    const explicitH = atomFor("h-old", "H", { x: 1, y: 0, z: 0 });
    const service = new ScientificHistoryService();
    service.registerRoot("object:fill", fixture([parent, explicitH], [{ id: "c1-h-old", atom1: "c1", atom2: "h-old", order: "SINGLE", source: "UNKNOWN" }]));
    const before = commandSelection(service, "object:fill", ["c1"]);
    const result = service.execute(createRefillHydrogensCommand({ objectId: "object:fill", baseRevisionId: before.current.revisionId, selectionResult: before.selection, atomIds: ["c1"], origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const current = result.revision.loadResult.structure;
    expect(current.atoms.filter((atom) => atom.element === "H")).toHaveLength(4);
    expect(current.atoms.some((atom) => atom.stableId === "h-old")).toBe(false);
    expect(result.entityLineage).toContainEqual(expect.objectContaining({ entityKind: "ATOM", sourceId: "h-old", outcome: "RETIRED" }));
    expect(service.historyState("object:fill")?.retainedRevisionCount).toBe(2);
    expect(service.undo("object:fill")).toMatchObject({ ok: true, toRevisionId: before.current.revisionId });
  });

  it("rejects an ambiguous refill before publication and supports reusable explicit-H removal", () => {
    const atoms = [atomFor("cc", "C", { x: 0, y: 0, z: 0 }), atomFor("od", "O", { x: 1.2, y: 0, z: 0 }, -1), atomFor("od2", "O", { x: -1.2, y: 0, z: 0 }), atomFor("h-old", "H", { x: 2, y: 0, z: 0 })];
    const bonds: CanonicalBond[] = [{ id: "cc-od", atom1: "cc", atom2: "od", order: "SINGLE", source: "UNKNOWN" }, { id: "cc-od2", atom1: "cc", atom2: "od2", order: "DOUBLE", source: "UNKNOWN" }, { id: "od-h", atom1: "od", atom2: "h-old", order: "SINGLE", source: "UNKNOWN" }];
    const service = new ScientificHistoryService();
    service.registerRoot("object:fail", fixture(atoms, bonds));
    const target = commandSelection(service, "object:fail", ["od"]);
    expect(service.execute(createRefillHydrogensCommand({ objectId: "object:fail", baseRevisionId: target.current.revisionId, selectionResult: target.selection, atomIds: ["od"], origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }))).toMatchObject({ ok: false, code: "CHEMISTRY_AMBIGUOUS" });
    expect(service.historyState("object:fail")?.retainedRevisionCount).toBe(1);
    const removeTarget = commandSelection(service, "object:fail", ["h-old"]);
    const removed = service.execute(createRemoveHydrogensCommand({ objectId: "object:fail", baseRevisionId: removeTarget.current.revisionId, selectionResult: removeTarget.selection, atomIds: ["h-old"], origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.revision.loadResult.structure.atoms.some((atom) => atom.stableId === "h-old")).toBe(false);
  });

  it("AT-R07-24..25 attaches and replaces with explicit placement, lineage, and provenance", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:identity", fixture([atomFor("c1", "C", { x: 0, y: 0, z: 0 })]));
    const attachTarget = commandSelection(service, "object:identity", ["c1"]);
    const attached = service.execute(createAttachAtomCommand({ objectId: "object:identity", baseRevisionId: attachTarget.current.revisionId, selectionResult: attachTarget.selection, atomIds: ["c1"], element: "O", coordinate: { x: 0, y: 1, z: 0 }, bondOrder: "SINGLE", valence: 2, geometry: "explicit-test-placement", origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    expect(attached.revision.loadResult.structure.atoms).toHaveLength(2);
    expect(attached.revision.provenance.chemistryValidation?.status).toBe("VALID");
    const replaceTarget = commandSelection(service, "object:identity", ["c1"]);
    const replaced = service.execute(createReplaceAtomCommand({ objectId: "object:identity", baseRevisionId: replaceTarget.current.revisionId, selectionResult: replaceTarget.selection, atomIds: ["c1"], element: "N", hFill: false, origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(replaced.ok).toBe(true);
    if (replaced.ok) {
      expect(replaced.revision.loadResult.structure.atoms.some((atom) => atom.stableId === "c1")).toBe(false);
      expect(replaced.entityLineage).toContainEqual(expect.objectContaining({ entityKind: "ATOM", sourceId: "c1", outcome: "RETIRED" }));
      expect(replaced.entityLineage).toContainEqual(expect.objectContaining({ entityKind: "ATOM", outcome: "NEW" }));
    }
  });

  it("AT-R07-26 rejects stale picked renderer generation and AT-R07-27 requires explicit multi-state scope", () => {
    const service = new ScientificHistoryService();
    service.registerRoot("object:stale", fixture([atomFor("c1", "C", { x: 0, y: 0, z: 0 })]));
    const target = commandSelection(service, "object:stale", ["c1"]);
    const pick = { schemaVersion: 1 as const, pickId: "pick:old", pickKind: "ATOM" as const, atomRef: { structureId: "fixture-b3", objectId: "object:stale", stableAtomId: "c1", molecularRevision: target.current.loadResult.structure.scientificHash, coordinateContext: { coordinateStateId: "b3:state:1", modelId: "object:stale", stateId: "b3:state:1", molecularRevision: target.current.loadResult.structure.scientificHash } }, structureId: "fixture-b3", molecularRevision: target.current.loadResult.structure.scientificHash, rendererGeneration: 7, coordinateContext: { coordinateStateId: "b3:state:1", modelId: "object:stale", stateId: "b3:state:1", molecularRevision: target.current.loadResult.structure.scientificHash }, provenance: "renderer-reverse-identity-map" as const };
    const staleCommand = createAddHydrogensCommand({ objectId: "object:stale", baseRevisionId: target.current.revisionId, selectionResult: target.selection, atomIds: ["c1"], pickResult: pick, origin: { channel: "TEST" }, parameters: { expectedRendererGeneration: 8 }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } });
    expect(service.execute(staleCommand)).toMatchObject({ ok: false, code: "STALE_RENDERER_GENERATION" });
    expect(service.historyState("object:stale")?.retainedRevisionCount).toBe(1);
    const committed = service.execute(createAddHydrogensCommand({ objectId: "object:stale", baseRevisionId: target.current.revisionId, selectionResult: target.selection, atomIds: ["c1"], origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(committed.ok).toBe(true);
    if (committed.ok) {
      const rebound = selectionForStableIds(["c1"], committed.revision.loadResult.structure);
      expect(service.execute(createAddHydrogensCommand({ objectId: "object:stale", baseRevisionId: committed.revision.revisionId, selectionResult: rebound, atomIds: ["c1"], pickResult: pick, origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }))).toMatchObject({ ok: false, code: "STALE_PICK" });
    }

    const multi = new ScientificHistoryService();
    multi.registerRoot("object:multi", fixture([atomFor("c1", "C", { x: 0, y: 0, z: 0 })], [], 2));
    const multiTarget = commandSelection(multi, "object:multi", ["c1"]);
    expect(multi.execute(createAddHydrogensCommand({ objectId: "object:multi", baseRevisionId: multiTarget.current.revisionId, selectionResult: multiTarget.selection, atomIds: ["c1"], stateScope: { kind: "CURRENT" }, origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }))).toMatchObject({ ok: false, code: "STATE_SCOPE_INVALID" });
    const all = multi.execute(createAddHydrogensCommand({ objectId: "object:multi", baseRevisionId: multiTarget.current.revisionId, selectionResult: multiTarget.selection, atomIds: ["c1"], stateScope: { kind: "ALL" }, origin: { channel: "TEST" }, provenance: { producerId: "r07-b3-test", producerVersion: "1", requestedAt: "2026-01-01T00:00:00.000Z" } }));
    expect(all.ok).toBe(true);
    if (all.ok) expect(all.revision.loadResult.structure.coordinateStates?.every((state) => Object.keys(state.coordinates).some((id) => id !== "c1"))).toBe(true);
  });
});
