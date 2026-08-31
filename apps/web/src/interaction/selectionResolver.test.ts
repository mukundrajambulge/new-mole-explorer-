import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { parseRepresentationCommand, resolveSelection, SelectionResolutionError } from "./selectionResolver";

const structure = {
  id: "selection-structure", name: "selection", format: "pdb", source: { kind: "LOCAL_FILE" as const, originalFilename: "selection.pdb", format: "pdb" as const, sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 3, residues: 2, chains: 2, polymerAtoms: 2, ligandAtoms: 1, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 }, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 0, z: 0 } },
  atoms: [
    { stableId: "poly-a", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 10, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "poly-b", serial: 2, atomName: "CA", element: "C", residueName: "GLY", residueNumber: 11, chain: "B", x: 1, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "lig-a", serial: 3, atomName: "C1", element: "C", residueName: "LIG", residueNumber: 20, chain: "A", x: 2, y: 0, z: 0, recordType: "HETATM" as const, isPolymer: false, isLigand: true, isWater: false, isIon: false },
  ], bonds: [], hierarchy: { chainIds: [], chains: {}, residues: {} }, scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("canonical selection boundary", () => {
  it("resolves stable membership before presentation commands", () => {
    expect(resolveSelection("chain A and polymer", structure).stableAtomIds).toEqual(["poly-a"]);
    expect(resolveSelection("ligand", structure).stableAtomIds).toEqual(["lig-a"]);
    expect(resolveSelection("all", structure).membershipHash).toBeTruthy();
    expect(parseRepresentationCommand("hide sticks, chain A")).toMatchObject({ operation: "HIDE", query: "chain A" });
  });

  it("rejects unknown selection clauses instead of passing raw text to 3Dmol", () => {
    expect(() => resolveSelection("nearest 5", structure)).toThrow(SelectionResolutionError);
  });
});
