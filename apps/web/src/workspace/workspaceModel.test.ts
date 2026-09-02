import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { resolveSelection } from "../selection/selectionEngine";
import { createWorkspaceObject, setWorkspaceObjectEnabled, workspaceSelectionStructure } from "./workspaceModel";

const loadResultFor = (id: string, atomId: string): StructureLoadResult => {
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
    scientificHash: id.padEnd(64, "0"),
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
  });
});
