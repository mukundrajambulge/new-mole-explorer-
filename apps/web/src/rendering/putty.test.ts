import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { puttyProfileFor, puttyRadiusForAtom, puttyRadiusForResidue, puttyResidueRadii } from "./putty";

const structure = {
  id: "putty-test",
  name: "putty-test",
  format: "pdb",
  source: { kind: "LOCAL_FILE", originalFilename: "putty-test.pdb", format: "pdb", sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 2, residues: 2, chains: 1, polymerAtoms: 2, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 3, y: 0, z: 0 } },
  atoms: [
    { stableId: "low", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false, bFactor: 10 },
    { stableId: "high", serial: 2, atomName: "CA", element: "C", residueName: "GLY", residueNumber: 2, chain: "A", x: 3, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false, bFactor: 50 },
  ],
  bonds: [],
  hierarchy: { chainIds: [], chains: {}, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("B-factor-driven Putty profile", () => {
  it("derives bounded variable radii from source B-factors", () => {
    const profile = puttyProfileFor(structure, 0.2, 0.8);
    expect(profile?.scalarSource).toBe("B_FACTOR");
    expect(puttyRadiusForAtom(structure.atoms[0], profile!)).toBeCloseTo(0.2);
    expect(puttyRadiusForAtom(structure.atoms[1], profile!)).toBeCloseTo(0.8);
    const residueRadii = puttyResidueRadii(structure, profile!);
    expect(puttyRadiusForResidue(structure.atoms[0], residueRadii)).toBeCloseTo(0.2);
  });

  it("returns no profile when canonical B-factors are absent", () => {
    const withoutB = { ...structure, atoms: structure.atoms.map((atom) => { const copy = { ...atom }; Reflect.deleteProperty(copy, "bFactor"); return copy; }) };
    expect(puttyProfileFor(withoutB)).toBeNull();
  });
});
