import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { NamedSelectionStore, combineSelections, evaluateSelectionQuery, parseSelection, resolveSelection, selectionForStableIds } from "./selectionEngine";

const structure = {
  id: "engine-structure", name: "engine", format: "pdb", source: { kind: "LOCAL_FILE" as const, originalFilename: "engine.pdb", format: "pdb" as const, sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 6, residues: 3, chains: 2, polymerAtoms: 4, ligandAtoms: 1, waterAtoms: 1, ionAtoms: 0, otherAtoms: 0 }, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 0, z: 0 } },
  atoms: [
    { stableId: "a1", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 10, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "a2", serial: 2, atomName: "N", element: "N", residueName: "ALA", residueNumber: 10, chain: "A", x: 1.2, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "a3", serial: 3, atomName: "CA", element: "GLY", residueName: "GLY", residueNumber: 11, chain: "A", x: 4, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "b1", serial: 4, atomName: "CA", element: "C", residueName: "SER", residueNumber: 10, chain: "B", x: 8, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "l1", serial: 5, atomName: "C1", element: "C", residueName: "LIG", residueNumber: 20, chain: "A", x: 2, y: 0, z: 0, recordType: "HETATM" as const, isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "w1", serial: 6, atomName: "O", element: "O", residueName: "HOH", residueNumber: 30, chain: "A", x: 10, y: 0, z: 0, recordType: "HETATM" as const, isPolymer: false, isLigand: false, isWater: true, isIon: false },
  ],
  bonds: [{ id: "bond-1", atom1: "a1", atom2: "a2", order: "SINGLE" as const, source: "UNKNOWN" as const }, { id: "bond-2", atom1: "a2", atom2: "l1", order: "SINGLE" as const, source: "UNKNOWN" as const }], hierarchy: { chainIds: [], chains: {}, residues: {} }, scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("canonical selection engine", () => {
  it("lexes and applies boolean precedence without splitting raw text", () => {
    const parsed = parseSelection("not polymer or ligand and chain A");
    expect(parsed.ast?.kind).toBe("or");
    expect(resolveSelection("chain A and polymer", structure).stableAtomIds).toEqual(["a1", "a2", "a3"]);
    expect(resolveSelection("ligand or water", structure).stableAtomIds).toEqual(["l1", "w1"]);
  });

  it("supports insertion-aware residue values, stable index/rank, and grouping", () => {
    expect(resolveSelection("resi 10", structure).stableAtomIds).toEqual(["a1", "a2", "b1"]);
    expect(resolveSelection("index 2", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("rank 0", structure).stableAtomIds).toEqual(["a1"]);
    expect(resolveSelection("byres name CA and chain A", structure).stableAtomIds).toEqual(["a1", "a2", "a3"]);
  });

  it("evaluates topology and exact spatial boundaries through canonical data", () => {
    expect(resolveSelection("neighbor name CA and chain A", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("bound_to ligand", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("within 2 of ligand", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "l1"]);
    expect(resolveSelection("around 2 ligand", structure).stableAtomIds).toEqual(["a1", "a2", "a3"]);
  });

  it("returns truthful structured failures and never turns unknown names into empty success", () => {
    expect(evaluateSelectionQuery("nearest 5", structure).status).toBe("SYNTAX_ERROR");
    expect(evaluateSelectionQuery("segi A", structure).status).toBe("UNSUPPORTED_OPERATOR_OR_PROFILE");
    expect(evaluateSelectionQuery("missing_selection", structure).status).toBe("UNKNOWN_NAME");
    expect(evaluateSelectionQuery("all", structure, { expectedRevision: "stale" }).status).toBe("STALE_REVISION");
  });

  it("keeps named snapshots and pick membership in the canonical ordering", () => {
    const store = new NamedSelectionStore(structure);
    const result = resolveSelection("chain A and polymer", structure);
    const snapshot = store.createSnapshot("active_site", result);
    expect(resolveSelection("%active_site", structure, { named: store }).stableAtomIds).toEqual(result.stableAtomIds);
    expect(resolveSelection("?missing", structure, { named: store }).status).toBe("VALID_EMPTY");
    expect(snapshot.immutable).toBe(true);
    expect(selectionForStableIds(["l1", "a1", "l1"], structure).stableAtomIds).toEqual(["a1", "l1"]);
    expect(combineSelections(result, selectionForStableIds(["l1"], structure), "add").stableAtomIds).toEqual(["a1", "a2", "a3", "l1"]);
  });
});
