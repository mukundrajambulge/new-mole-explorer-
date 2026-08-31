import { describe, expect, it } from "vitest";
import { parseSafeLabelExpression, resolveSafeLabel } from "./labels";
import { ReverseIdentityMap } from "./picking";
import type { CanonicalMolecularStructure } from "@molecular/contracts";

const structure = {
  id: "identity-structure", name: "4DJW", format: "pdb", source: { kind: "LOCAL_FILE" as const, originalFilename: "4DJW.pdb", format: "pdb" as const, sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 1, residues: 1, chains: 1, polymerAtoms: 1, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 }, bounds: { min: { x: 1, y: 2, z: 3 }, max: { x: 1, y: 2, z: 3 } },
  atoms: [{ stableId: "stable-ca", serial: 42, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 104, chain: "A", x: 1, y: 2, z: 3, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false, occupancy: 1, bFactor: 22.4 }], bonds: [], hierarchy: { chainIds: [], chains: {}, residues: {} }, scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("safe labels and reverse identity picking", () => {
  it("resolves a safe field AST from canonical data and rejects code", () => {
    const expression = parseSafeLabelExpression("{name} {resn}{resi} / {chain}");
    expect(resolveSafeLabel(expression, structure.atoms[0], structure)).toBe("CA ALA104 / A");
    expect(() => parseSafeLabelExpression("{constructor}" )).toThrow(/Unsupported/);
    expect(() => parseSafeLabelExpression("{name}; eval(1)" )).not.toThrow();
  });

  it("resolves renderer hits through O(1) reverse maps and validates revision", () => {
    const map = new ReverseIdentityMap();
    map.build(structure, 7);
    const hit = map.resolveAtomHit({ index: 0, serial: 42, properties: { canonicalStableId: "stable-ca" } });
    expect(hit?.atomRef.stableAtomId).toBe("stable-ca");
    expect(hit?.rendererGeneration).toBe(7);
    expect(map.resolveAtomHit({ index: 99 })).toBeNull();
    expect(map.background().pickKind).toBe("BACKGROUND");
  });
});
