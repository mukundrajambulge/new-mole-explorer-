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
    expect(parseSelection("not polymer and chain A").ast?.kind).toBe("and");
    expect(parseSelection("(polymer or ligand) and chain A").ast?.kind).toBe("and");
    expect(resolveSelection("chain A and polymer", structure).stableAtomIds).toEqual(["a1", "a2", "a3"]);
    expect(resolveSelection("ligand or water", structure).stableAtomIds).toEqual(["l1", "w1"]);
  });

  it("supports insertion-aware residue values, stable index/rank, and grouping", () => {
    expect(resolveSelection("resi 10", structure).stableAtomIds).toEqual(["a1", "a2", "b1"]);
    expect(resolveSelection("index 2", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("rank 0", structure).stableAtomIds).toEqual(["a1"]);
    expect(resolveSelection("byres name CA and chain A", structure).stableAtomIds).toEqual(["a1", "a2", "a3"]);
    expect(resolveSelection("byres (name CA or ligand)", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "b1", "l1"]);
    expect(resolveSelection("bychain chain A and ligand", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "l1", "w1"]);
    expect(resolveSelection("chain A protein", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "b1", "l1", "w1"]);
    expect(resolveSelection("bycalpha name CA", structure).stableAtomIds).toEqual(["a1", "a3", "b1"]);
    expect(resolveSelection("bymolecule ligand", structure).stableAtomIds).toEqual(["a1", "a2", "l1"]);
    expect(resolveSelection("name CA in chain A", structure).stableAtomIds).toEqual(["a1", "a3"]);
    expect(resolveSelection("(chain A and name CA) like (chain A and name CA)", structure).stableAtomIds).toEqual(["a1", "a3"]);
    const segmented = { ...structure, atoms: structure.atoms.map((atom) => ({ ...atom, segmentId: atom.chain === "A" ? "SEG_A" : "SEG_B" })), scientificHash: "c".repeat(64) } satisfies CanonicalMolecularStructure;
    expect(resolveSelection("segi SEG_A", segmented).stableAtomIds).toEqual(["a1", "a2", "a3", "l1", "w1"]);
    expect(resolveSelection("bysegi (name CA and segi SEG_A)", segmented).stableAtomIds).toEqual(["a1", "a2", "a3", "l1", "w1"]);
    expect(resolveSelection("name CA in segi SEG_A", segmented).stableAtomIds).toEqual(["a1", "a3"]);
  });

  it("evaluates topology and exact spatial boundaries through canonical data", () => {
    expect(resolveSelection("neighbor name CA and chain A", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("bound_to ligand", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("within 2 of ligand", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "l1"]);
    expect(resolveSelection("around 2 ligand", structure).stableAtomIds).toEqual(["a1", "a2", "a3"]);
    expect(resolveSelection("chain A within 4 of ligand or water", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "l1", "w1"]);
    expect(resolveSelection("ligand extend 1", structure).stableAtomIds).toEqual(["a2", "l1"]);
    expect(resolveSelection("ligand expand 2", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "l1"]);
    expect(resolveSelection("all near_to 2 of ligand", structure).stableAtomIds).toEqual(["a1", "a2", "a3"]);
    expect(resolveSelection("all beyond 2 of ligand", structure).stableAtomIds).toEqual(["b1", "w1"]);
    expect(evaluateSelectionQuery("within -1 of ligand", structure).status).toBe("SYNTAX_ERROR");
    expect(evaluateSelectionQuery("gap 4 of ligand", structure).status).toBe("UNSUPPORTED_OPERATOR_OR_PROFILE");
  });

  it("fails closed for cross-object spatial queries without an explicit coordinate frame", () => {
    const workspace = {
      ...structure,
      id: "workspace",
      name: "workspace",
      scientificHash: "workspace-spatial-revision".padEnd(64, "0"),
      atoms: [
        { ...structure.atoms[0]!, stableId: "object:a::a1", workspaceObjectId: "object:a", workspaceObjectName: "A" },
        { ...structure.atoms[4]!, stableId: "object:b::l1", workspaceObjectId: "object:b", workspaceObjectName: "B", x: 0.5 },
      ],
      bonds: [],
    } satisfies CanonicalMolecularStructure;
    const result = evaluateSelectionQuery("object A within 4 of object B", workspace);
    expect(result.status).toBe("MISSING_DEPENDENCY");
    expect(result.count).toBe(0);
    expect(result.diagnostics[0]?.message).toContain("explicit LOCAL_SCIENTIFIC or EFFECTIVE_WORLD coordinate context");
  });

  it("binds visible selection to an explicit presentation context and invalidates its cache", () => {
    expect(evaluateSelectionQuery("visible", structure).status).toBe("MISSING_DEPENDENCY");
    const first = resolveSelection("visible", structure, { presentation: { visibleStableAtomIds: ["a1", "l1"], revision: "projection-1" } });
    expect(first.stableAtomIds).toEqual(["a1", "l1"]);
    expect(first.presentationContext?.revision).toBe("projection-1");
    expect(first.dependencyVector.needsPresentation).toBe(true);
    const second = resolveSelection("visible", structure, { presentation: { visibleStableAtomIds: ["b1"], revision: "projection-2" } });
    expect(second.stableAtomIds).toEqual(["b1"]);
  });

  it("returns truthful structured failures and never turns unknown names into empty success", () => {
    expect(evaluateSelectionQuery("nearest 5", structure).status).toBe("SYNTAX_ERROR");
    expect(evaluateSelectionQuery("foo bar", structure).status).toBe("UNKNOWN_PROPERTY");
    expect(evaluateSelectionQuery("segi A", structure).status).toBe("UNSUPPORTED_OPERATOR_OR_PROFILE");
    expect(evaluateSelectionQuery("missing_selection", structure).status).toBe("UNKNOWN_NAME");
    expect(evaluateSelectionQuery("index zero", structure).status).toBe("INVALID_VALUE");
    expect(evaluateSelectionQuery("resi nonsense", structure).status).toBe("INVALID_VALUE");
    expect(evaluateSelectionQuery("all", structure, { expectedRevision: "stale" }).status).toBe("STALE_REVISION");
  });

  it("keeps named snapshots and pick membership in the canonical ordering", () => {
    const store = new NamedSelectionStore(structure);
    const result = resolveSelection("chain A and polymer", structure);
    const snapshot = store.createSnapshot("active_site", result);
    expect(resolveSelection("%active_site", structure, { named: store }).stableAtomIds).toEqual(result.stableAtomIds);
    expect(resolveSelection("?missing", structure, { named: store }).status).toBe("VALID_EMPTY");
    expect(snapshot.immutable).toBe(true);
    expect(store.namespaceRevision).not.toBe("");
    expect(store.rename("active_site", "binding_site").name).toBe("binding_site");
    expect(store.updateSnapshot("binding_site", resolveSelection("ligand", structure)).stableAtomIds).toEqual(["l1"]);
    expect(store.delete("binding_site")).toBe(true);
    expect(selectionForStableIds(["l1", "a1", "l1"], structure).stableAtomIds).toEqual(["a1", "l1"]);
    expect(combineSelections(result, selectionForStableIds(["l1"], structure), "add").stableAtomIds).toEqual(["a1", "a2", "a3", "l1"]);
  });

  it("invalidates the selection cache when a workspace object display name changes", () => {
    const workspaceForName = (workspaceObjectName: string): CanonicalMolecularStructure => ({
      ...structure,
      id: "workspace",
      name: "workspace",
      scientificHash: "workspace-revision".padEnd(64, "0"),
      atoms: structure.atoms.map((atom) => ({
        ...atom,
        stableId: `object:engine::${atom.stableId}`,
        workspaceObjectId: "object:engine",
        workspaceObjectName,
      })),
    });

    const original = workspaceForName("engine.pdb");
    const renamed = workspaceForName("renamed-engine.pdb");
    expect(resolveSelection("object engine.pdb", original).count).toBe(6);
    expect(resolveSelection("object renamed-engine.pdb", renamed).count).toBe(6);
    expect(resolveSelection("object engine.pdb", renamed).count).toBe(0);
  });

  it("binds an explicit plan and keeps stable identity fields distinct", () => {
    const result = resolveSelection("id a2", structure);
    expect(result.boundPlan?.molecularRevision).toBe(structure.scientificHash);
    expect(result.boundPlan?.objectScope.objectId).toBe(structure.id);
    expect(resolveSelection("index 2", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("rank 1", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("id 2", structure).stableAtomIds).toEqual(["a2"]);
    expect(resolveSelection("name CA and not chain B", structure).stableAtomIds).toEqual(["a1", "a3"]);
    expect(resolveSelection("name != CA", structure).stableAtomIds).toEqual(["a2", "l1", "w1"]);
  });

  it("supports bounded cardinality, chemical, topology, and numeric property families", () => {
    expect(resolveSelection("first chain A", structure).stableAtomIds).toEqual(["a1"]);
    expect(resolveSelection("last chain A", structure).stableAtomIds).toEqual(["w1"]);
    expect(resolveSelection("backbone", structure).stableAtomIds).toEqual(["a1", "a2", "a3", "b1"]);
    expect(resolveSelection("bonded", structure).stableAtomIds).toEqual(["a1", "a2", "l1"]);
    expect(resolveSelection("x < 2", structure).stableAtomIds).toEqual(["a1", "a2"]);
    expect(evaluateSelectionQuery("b > 10", structure).status).toBe("MISSING_DEPENDENCY");
  });

  it("evaluates partial-charge predicates only against a revision-matched canonical dataset", () => {
    const charged = {
      ...structure,
      scientificHash: "charged-revision".padEnd(64, "0"),
      partialChargeDataset: {
        datasetId: "fixture:charges:1",
        molecularRevision: "charged-revision".padEnd(64, "0"),
        chargeModel: "AM1-BCC",
        profileVersion: "partial-charge-diverging-v1",
        atomChargeMap: { a1: -0.42, a2: 0.42, a3: -0.1, b1: 0, l1: 0.1, w1: -0.05 },
        units: "e",
        provenance: "deterministic canonical fixture",
      },
    } satisfies CanonicalMolecularStructure;
    expect(resolveSelection("partial_charge > 0", charged).stableAtomIds).toEqual(["a2", "l1"]);

    const stale = { ...charged, partialChargeDataset: { ...charged.partialChargeDataset, molecularRevision: "stale" } } satisfies CanonicalMolecularStructure;
    const staleResult = evaluateSelectionQuery("partial_charge > 0", stale);
    expect(staleResult.status).toBe("MISSING_DEPENDENCY");
    expect(staleResult.count).toBe(0);
    expect(staleResult.diagnostics[0]?.message).toContain("partial_charge");
  });
});
