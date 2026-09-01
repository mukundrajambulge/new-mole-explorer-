import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { analyzeStructure, overlaysForAnalysis } from "./structuralAnalysis";

const structure = {
  id: "analysis-fixture",
  name: "analysis-fixture",
  format: "pdb",
  source: { kind: "LOCAL_FILE", originalFilename: "analysis-fixture.pdb", format: "pdb", sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 4, residues: 3, chains: 1, polymerAtoms: 2, ligandAtoms: 2, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 3, y: 0, z: 0 } },
  atoms: [
    { stableId: "n", serial: 1, atomName: "N", element: "N", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "o", serial: 2, atomName: "O1", element: "O", residueName: "LIG", residueNumber: 2, chain: "A", x: 3, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "c", serial: 3, atomName: "C1", element: "C", residueName: "LIG", residueNumber: 3, chain: "A", x: 0.4, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "c2", serial: 4, atomName: "C2", element: "C", residueName: "LIG", residueNumber: 3, chain: "A", x: 10, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
  ],
  bonds: [{ id: "bond-n-c", atom1: "n", atom2: "c", order: "SINGLE", source: "PDB_CONECT" }],
  hierarchy: { chainIds: [], chains: {}, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("bounded structural analysis overlays", () => {
  it("uses canonical coordinates, explicit profiles, and stable identities", () => {
    const hBonds = analyzeStructure(structure, "H_BONDS");
    const contacts = analyzeStructure(structure, "CONTACTS");
    const clashes = analyzeStructure(structure, "CLASH");
    expect(hBonds.profileId).toContain("3.5A");
    expect(hBonds.items.some((item) => item.atom1Id === "n" && item.atom2Id === "o")).toBe(true);
    expect(contacts.items.every((item) => item.id.startsWith("contact:"))).toBe(true);
    expect(clashes.items.some((item) => item.overlapAngstrom && item.overlapAngstrom > 0.4)).toBe(true);
    expect(overlaysForAnalysis([hBonds, contacts, clashes]).length).toBeGreaterThan(0);
  });

  it("returns a truthful valid-empty result when no pair meets the profile", () => {
    const far = { ...structure, atoms: structure.atoms.map((atom) => ({ ...atom, x: atom.serial * 100 })) };
    const result = analyzeStructure(far, "CONTACTS");
    expect(result.status).toBe("VALID_EMPTY");
    expect(result.items).toHaveLength(0);
  });
});
