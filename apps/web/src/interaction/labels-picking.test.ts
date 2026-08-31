import { describe, expect, it } from "vitest";
import { DEFAULT_LABEL_STATE, LABEL_ATOM_SAFETY_LIMIT, labelExpressionForMode, labelPlanForState, parseSafeLabelExpression, resolveSafeLabel } from "./labels";
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

  it("plans one stable label per canonical chain or residue", () => {
    const atoms = [
      structure.atoms[0],
      { ...structure.atoms[0], stableId: "stable-cb", serial: 43, atomName: "CB" },
      { ...structure.atoms[0], stableId: "stable-b-ca", serial: 44, chain: "B", residueNumber: 8 },
    ];
    const chainPlan = labelPlanForState({ ...DEFAULT_LABEL_STATE, mode: "chain", expression: labelExpressionForMode("chain") }, atoms);
    const residuePlan = labelPlanForState({ ...DEFAULT_LABEL_STATE, mode: "residue", expression: labelExpressionForMode("residue") }, atoms);
    expect(chainPlan.labelCount).toBe(2);
    expect(chainPlan.atoms.map((atom) => atom.stableId)).toEqual(["stable-ca", "stable-b-ca"]);
    expect(residuePlan.labelCount).toBe(2);
    expect(residuePlan.atoms.map((atom) => atom.stableId)).toEqual(["stable-ca", "stable-b-ca"]);
    expect(labelPlanForState({ ...DEFAULT_LABEL_STATE, mode: "chain", expression: labelExpressionForMode("chain") }, atoms)).toEqual(chainPlan);
  });

  it("guards high-cardinality atom labels with an explicit diagnostic", () => {
    const atoms = Array.from({ length: LABEL_ATOM_SAFETY_LIMIT + 1 }, (_, index) => ({ ...structure.atoms[0], stableId: `stable-${index}`, serial: index + 1, atomName: `C${index}` }));
    const plan = labelPlanForState({ ...DEFAULT_LABEL_STATE, mode: "atom-name", expression: labelExpressionForMode("atom-name") }, atoms);
    expect(plan.status).toBe("GUARDED");
    expect(plan.eligibleAtomCount).toBe(LABEL_ATOM_SAFETY_LIMIT + 1);
    expect(plan.labelCount).toBe(0);
    expect(plan.atoms).toHaveLength(0);
    expect(plan.diagnostic).toMatch(new RegExp(String(LABEL_ATOM_SAFETY_LIMIT)));
  });
});
