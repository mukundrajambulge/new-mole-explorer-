import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { resolveSelection } from "../selection/selectionEngine";
import { copyWorkspaceObject, createWorkspaceObject, createWorkspaceObjectFromSelection, joinWorkspaceObjectStates, setWorkspaceObjectEnabled, splitWorkspaceObjectStates, workspaceSelectionStructure } from "./workspaceModel";

const loadResultFor = (id: string, atomId: string): StructureLoadResult => {
  const scientificHash = id.padEnd(64, "0");
  const structure = {
    id,
    name: id,
    format: "pdb" as const,
    source: { kind: "LOCAL_FILE" as const, originalFilename: `${id}.pdb`, format: "pdb" as const, sha256: id.padEnd(64, "0"), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
    counts: { atoms: 1, residues: 1, chains: 1, polymerAtoms: 1, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    atoms: [{ stableId: atomId, serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false }],
    bonds: [],
    hierarchy: { chainIds: [], chains: {}, residues: {} },
    scientificHash,
    peptideSequenceDataset: { datasetId: `${id}:peptide-sequence`, molecularRevision: scientificHash, assignmentSource: "canonical residue identity fixture", profileVersion: "canonical-peptide-sequence-v1", chains: { "chain:A": { residueIds: ["chain:A:residue:1:"], sequence: "A" } } },
  } satisfies CanonicalMolecularStructure;
  return { structure, renderSource: { format: "pdb", content: "ATOM" } };
};

describe("workspace selection scope", () => {
  it("keeps disabled objects in scientific all while enabled remains presentation-scoped", () => {
    const first = createWorkspaceObject(loadResultFor("first", "first-atom"));
    const secondEnabled = createWorkspaceObject(loadResultFor("second", "second-atom"), [first.objectId]);
    const second = setWorkspaceObjectEnabled(secondEnabled, false);
    const enabledWorkspace = workspaceSelectionStructure([first, secondEnabled]);
    const workspace = workspaceSelectionStructure([first, second]);
    expect(workspace).not.toBeNull();
    expect(enabledWorkspace).not.toBeNull();
    expect(workspace!.scientificHash).toBe(enabledWorkspace!.scientificHash);
    expect(workspace!.atoms.map((atom) => atom.stableId)).toEqual(["object:first::first-atom", "object:second::second-atom"]);
    expect(resolveSelection("all", workspace!).stableAtomIds).toEqual(["object:first::first-atom", "object:second::second-atom"]);
    expect(resolveSelection("enabled", workspace!).stableAtomIds).toEqual(["object:first::first-atom"]);
    expect(workspace!.atoms[1]?.workspaceObjectEnabled).toBe(false);
    expect(resolveSelection("pepseq A", workspace!).stableAtomIds).toEqual(["object:first::first-atom", "object:second::second-atom"]);
  });

  it("materializes a selected canonical subset with new identities and explicit lineage", () => {
    const source = createWorkspaceObject({ ...loadResultFor("source", "source-atom"), structure: { ...loadResultFor("source", "source-atom").structure, bonds: [] } });
    const created = createWorkspaceObjectFromSelection(source, ["source-atom"], "selected-object", [source.objectId]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.displayName).toBe("selected-object");
    expect(created.value.objectId).not.toBe(source.objectId);
    expect(created.value.lineage).toMatchObject({ operation: "CREATE_FROM_SELECTION", parentObjectIds: [source.objectId] });
    expect(created.value.lineage.sourceAtomMap).toEqual({ [created.value.loadResult.structure.atoms[0]!.stableId]: "source-atom" });
    expect(created.value.loadResult.structure.counts.atoms).toBe(1);
    expect(created.value.loadResult.structure.atoms[0]!.stableId).not.toBe("source-atom");
  });

  it("rebuilds the canonical peptide sequence when a derived object drops residues", () => {
    const base = loadResultFor("sequence-source", "sequence-a").structure;
    const sourceHash = "sequence-source-revision".padEnd(64, "0");
    const source = createWorkspaceObject({ ...loadResultFor("sequence-source", "sequence-a"), structure: {
      ...base,
      counts: { ...base.counts, atoms: 2, residues: 2 },
      scientificHash: sourceHash,
      atoms: [
        { ...base.atoms[0]!, stableId: "sequence-a", residueNumber: 1, residueName: "ALA" },
        { ...base.atoms[0]!, stableId: "sequence-g", serial: 2, atomName: "CA", residueNumber: 2, residueName: "GLY", x: 1 },
      ],
      peptideSequenceDataset: {
        datasetId: "sequence-source:peptide-sequence",
        molecularRevision: sourceHash,
        assignmentSource: "canonical residue identity fixture",
        profileVersion: "canonical-peptide-sequence-v1",
        chains: { "chain:A": { residueIds: ["chain:A:residue:1:", "chain:A:residue:2:"], sequence: "AG" } },
      },
    } satisfies CanonicalMolecularStructure });
    const created = createWorkspaceObjectFromSelection(source, ["sequence-g"], "glycine-only", [source.objectId]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.loadResult.structure.peptideSequenceDataset?.chains["chain:A"]).toMatchObject({
      residueIds: ["chain:A:residue:2:"],
      sequence: "G",
    });
  });

  it("splits explicit states and joins only strictly corresponding one-state objects", () => {
    const base = loadResultFor("states", "state-a");
    const atoms = [base.structure.atoms[0]!, { ...base.structure.atoms[0]!, stableId: "state-b", serial: 2, atomName: "N", x: 1 }];
    const multiState: StructureLoadResult = { ...base, structure: {
      ...base.structure,
      counts: { ...base.structure.counts, atoms: 2 },
      atoms,
      coordinateStates: [
        { id: "states:state:1", ordinal: 1, sourceModelNumber: 1, coordinates: { "state-a": { x: 0, y: 0, z: 0 }, "state-b": { x: 1, y: 0, z: 0 } }, coordinateHash: "state-one" },
        { id: "states:state:2", ordinal: 2, sourceModelNumber: 2, coordinates: { "state-a": { x: 10, y: 0, z: 0 }, "state-b": { x: 11, y: 0, z: 0 } }, coordinateHash: "state-two" },
      ],
      stateOrder: ["states:state:1", "states:state:2"],
    } };
    const source = createWorkspaceObject(multiState);
    const split = splitWorkspaceObjectStates(source, null, [source.objectId]);
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(split.value).toHaveLength(2);
    expect(split.value.every((object) => object.stateOrder.length === 1)).toBe(true);
    expect(split.value.every((object) => object.lineage.operation === "SPLIT_STATE")).toBe(true);
    expect(splitWorkspaceObjectStates(source, "first", [source.objectId]).ok).toBe(true);
    expect(splitWorkspaceObjectStates(source, "last", [source.objectId]).ok).toBe(true);
    const prefixed = splitWorkspaceObjectStates(source, "prefix states:state", [source.objectId]);
    expect(prefixed.ok).toBe(true);
    if (prefixed.ok) expect(prefixed.value).toHaveLength(2);
    const joined = joinWorkspaceObjectStates(split.value[0]!, split.value[1]!, [source.objectId, ...split.value.map((object) => object.objectId)]);
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.value.lineage.operation).toBe("JOIN_STATES");
    expect(joined.value.stateOrder).toHaveLength(2);
    const joinedStates = joined.value.loadResult.structure.coordinateStates!;
    expect(joinedStates[1]!.coordinates[joined.value.loadResult.structure.atoms[0]!.stableId]).toEqual({ x: 10, y: 0, z: 0 });

    const incompatible = createWorkspaceObject({ ...loadResultFor("different", "different-atom"), structure: { ...loadResultFor("different", "different-atom").structure, atoms: [{ ...loadResultFor("different", "different-atom").structure.atoms[0]!, atomName: "O" }] } }, [source.objectId]);
    const rejected = joinWorkspaceObjectStates(split.value[0]!, incompatible, [source.objectId, ...split.value.map((object) => object.objectId), incompatible.objectId]);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.message).toContain("strict ordered atom correspondence");
  });

  it("records copy lineage without aliasing workspace object identity", () => {
    const source = createWorkspaceObject(loadResultFor("copy-source", "copy-atom"));
    const copied = copyWorkspaceObject(source, "copy", [source.objectId]);
    expect(copied.objectId).not.toBe(source.objectId);
    expect(copied.projection).not.toBe(source.projection);
    expect(copied.lineage).toMatchObject({ operation: "COPY", parentObjectIds: [source.objectId] });
    expect(copied.loadResult).not.toBe(source.loadResult);
    expect(copied.loadResult.structure).not.toBe(source.loadResult.structure);
    expect(copied.loadResult.structure.id).toBe(source.loadResult.structure.id);
  });
});
