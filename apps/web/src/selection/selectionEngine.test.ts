import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { NamedSelectionStore, combineSelections, evaluateSelectionQuery, parseSelection, resolveSelection, selectionForStableIds } from "./selectionEngine";
import { SPATIAL_TOLERANCE_POLICY, withinSpatialBoundary } from "./spatialPolicy";
import { createWorkspaceObject, setWorkspaceObjectState, workspaceSelectionStructure } from "../workspace/workspaceModel";

const structure = {
  id: "engine-structure", name: "engine", format: "pdb", source: { kind: "LOCAL_FILE" as const, originalFilename: "engine.pdb", format: "pdb" as const, sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 6, residues: 3, chains: 2, polymerAtoms: 4, ligandAtoms: 1, waterAtoms: 1, ionAtoms: 0, otherAtoms: 0 }, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 0, z: 0 } },
  atoms: [
    { stableId: "a1", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 10, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "a2", serial: 2, atomName: "N", element: "N", residueName: "ALA", residueNumber: 10, chain: "A", x: 1.2, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "a3", serial: 3, atomName: "CA", element: "C", residueName: "GLY", residueNumber: 11, chain: "A", x: 4, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false },
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
    const missingFragments = evaluateSelectionQuery("byfragment ligand", structure);
    expect(missingFragments.status).toBe("MISSING_DEPENDENCY");
    expect(missingFragments.count).toBe(0);
    const fragmented = {
      ...structure,
      atoms: structure.atoms.map((atom) => ({ ...atom, fragmentId: atom.stableId === "a1" || atom.stableId === "a2" || atom.stableId === "l1" ? "fragment:ligand-bound" : `fragment:${atom.stableId}` })),
      scientificHash: "fragmented-engine-revision".padEnd(64, "0"),
    } satisfies CanonicalMolecularStructure;
    expect(resolveSelection("byfragment ligand", fragmented).stableAtomIds).toEqual(["a1", "a2", "l1"]);
    expect(resolveSelection("name CA in chain A", structure).stableAtomIds).toEqual(["a1", "a3"]);
    expect(resolveSelection("(chain A and name CA) like (chain A and name CA)", structure).stableAtomIds).toEqual(["a1", "a3"]);
    const segmented = { ...structure, atoms: structure.atoms.map((atom) => ({ ...atom, segmentId: atom.chain === "A" ? "SEG_A" : "SEG_B" })), scientificHash: "c".repeat(64) } satisfies CanonicalMolecularStructure;
    expect(resolveSelection("segi SEG_A", segmented).stableAtomIds).toEqual(["a1", "a2", "a3", "l1", "w1"]);
    expect(resolveSelection("bysegi (name CA and segi SEG_A)", segmented).stableAtomIds).toEqual(["a1", "a2", "a3", "l1", "w1"]);
    expect(resolveSelection("name CA in segi SEG_A", segmented).stableAtomIds).toEqual(["a1", "a3"]);
  });

  it("expands bycell from source-backed fractional unit-cell membership", () => {
    const unitCellStructure = {
      ...structure,
      id: "unit-cell-structure",
      scientificHash: "unit-cell-revision".padEnd(64, "0"),
      unitCell: {
        a: 10,
        b: 10,
        c: 10,
        alpha: 90,
        beta: 90,
        gamma: 90,
        source: "PDB_CRYST1" as const,
        profileVersion: "fractional-unit-cell-membership-v1" as const,
      },
      atoms: structure.atoms.map((atom) => ({
        ...atom,
        x: atom.stableId === "a1" ? 1 : atom.stableId === "a2" ? 2 : atom.stableId === "a3" ? 11 : atom.stableId === "b1" ? 12 : 11,
      })),
    } satisfies CanonicalMolecularStructure;
    const result = resolveSelection("bycell name N", unitCellStructure);
    expect(result.stableAtomIds).toEqual(["a1", "a2"]);
    expect(result.dependencyVector.needsCoordinates).toBe(true);
    expect(result.scientificProfiles).toEqual([{ id: "canonical-unit-cell-membership", version: "1", fingerprint: "canonical-unit-cell-membership-v1" }]);
    expect(result.coordinateContext?.stateScopes).toEqual([{ objectId: unitCellStructure.id, stateId: `${unitCellStructure.id}:state:1`, ordinal: 1 }]);
  });

  it("expands byring from bounded cycles in the canonical bond graph", () => {
    const ring = { ...structure, bonds: [
      { id: "r1", atom1: "a1", atom2: "a2", order: "AROMATIC" as const, source: "PDB_CONECT" as const },
      { id: "r2", atom1: "a2", atom2: "a3", order: "AROMATIC" as const, source: "PDB_CONECT" as const },
      { id: "r3", atom1: "a3", atom2: "b1", order: "AROMATIC" as const, source: "PDB_CONECT" as const },
      { id: "r4", atom1: "b1", atom2: "l1", order: "AROMATIC" as const, source: "PDB_CONECT" as const },
      { id: "r5", atom1: "l1", atom2: "w1", order: "AROMATIC" as const, source: "PDB_CONECT" as const },
      { id: "r6", atom1: "w1", atom2: "a1", order: "AROMATIC" as const, source: "PDB_CONECT" as const },
    ], scientificHash: "ring-revision".padEnd(64, "0") } satisfies CanonicalMolecularStructure;
    const result = resolveSelection("byring water", ring);
    expect(result.stableAtomIds).toEqual(["a1", "a2", "a3", "b1", "l1", "w1"]);
    expect(result.dependencyVector.needsTopology).toBe(true);
    expect(result.topologyRevision).not.toBeNull();
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
    const gap = resolveSelection("gap 0 of ligand", structure);
    expect(gap.stableAtomIds).toEqual(["b1", "w1"]);
    expect(gap.scientificProfiles).toEqual([{ id: "canonical-element-vdw-radius", version: "1", fingerprint: "canonical-element-vdw-radius-v1" }]);
    expect(gap.boundPlan?.scientificProfiles).toEqual(gap.scientificProfiles);
    expect(resolveSelection("all and (ligand gap 0)", structure).stableAtomIds).toEqual(["b1", "w1"]);
    expect(resolveSelection("gap 4 of ligand", structure).stableAtomIds).toEqual(["w1"]);
  });

  it("fails VDW gap selection closed when a canonical radius is unavailable", () => {
    const unknownElement = { ...structure, atoms: structure.atoms.map((atom) => atom.stableId === "b1" ? { ...atom, element: "XX" } : atom), scientificHash: "unknown-vdw-revision".padEnd(64, "0") } satisfies CanonicalMolecularStructure;
    const result = evaluateSelectionQuery("gap 0 ligand", unknownElement);
    expect(result.status).toBe("MISSING_DEPENDENCY");
    expect(result.count).toBe(0);
    expect(result.diagnostics[0]?.message).toContain("canonical-element-vdw-radius@1");
  });

  it("resolves pepseq from an explicit canonical sequence dataset", () => {
    const sequenced = {
      ...structure,
      peptideSequenceDataset: {
        datasetId: "sequence:v1",
        molecularRevision: structure.scientificHash,
        assignmentSource: "canonical residue identity fixture",
        profileVersion: "canonical-peptide-sequence-v1",
        chains: { "chain:A": { residueIds: ["chain:A:residue:10:", "chain:A:residue:11:"], sequence: "AG" } },
      },
      scientificHash: structure.scientificHash,
    } satisfies CanonicalMolecularStructure;
    const result = resolveSelection("pepseq AG", sequenced);
    expect(result.stableAtomIds).toEqual(["a1", "a2", "a3"]);
    expect(result.dependencyVector.needsCoordinates).toBe(false);
    expect(evaluateSelectionQuery("pepseq 10", sequenced).status).toBe("INVALID_VALUE");
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

    const local = resolveSelection("object A within 4 of object B", workspace, { coordinateFrame: "LOCAL_SCIENTIFIC" });
    expect(local.stableAtomIds).toEqual(["object:a::a1"]);
    expect(local.coordinateContext).toEqual({ structureId: "workspace", revision: workspace.scientificHash, stateId: "workspace-active", framePolicy: "LOCAL_SCIENTIFIC", objectIds: ["object:a", "object:b"], stateScopes: [{ objectId: "object:a", stateId: "workspace:state:1", ordinal: 1 }, { objectId: "object:b", stateId: "workspace:state:1", ordinal: 1 }] });

    const world = resolveSelection("object A within 4 of object B", workspace, { coordinateFrame: "EFFECTIVE_WORLD" });
    expect(world.stableAtomIds).toEqual(local.stableAtomIds);
    expect(world.coordinateContext?.framePolicy).toBe("EFFECTIVE_WORLD");

    expect(resolveSelection("A", workspace).stableAtomIds).toEqual(["object:a::a1"]);
    expect(resolveSelection("ensemble", workspace, { groups: [{ groupId: "group:ensemble", name: "ensemble", objectIds: ["object:a"] }] }).stableAtomIds).toEqual(["object:a::a1"]);
    expect(parseSelection("A-obj.pdb within 4 of B-obj.pdb").ast?.kind).toBe("within");
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

  it("evaluates presentation selectors only from an explicit projection context", () => {
    expect(evaluateSelectionQuery("rep cartoon", structure).status).toBe("MISSING_DEPENDENCY");
    const presentation = {
      visibleStableAtomIds: ["a1", "a2", "l1"],
      representationTokensByStableAtomId: { a1: ["cartoon"], a2: ["cartoon"], l1: ["sticks", "ball-and-stick"] },
      colorTokensByStableAtomId: { a1: ["#ff0000", "red"], a2: ["#ff0000", "red"], l1: ["#3050f8", "blue"] },
      representationColorTokensByStableAtomId: {
        a1: { CARTOON: ["#ff0000", "red"] },
        a2: { CARTOON: ["#ff0000", "red"] },
        l1: { STICKS: ["#3050f8", "blue"] },
      },
      labelTokensByStableAtomId: { a1: ["ALA10:CA"], a2: ["ALA10:N"] },
      revision: "projection-selectors-1",
    };
    expect(resolveSelection("rep cartoon", structure, { presentation }).stableAtomIds).toEqual(["a1", "a2"]);
    expect(resolveSelection("color red", structure, { presentation }).stableAtomIds).toEqual(["a1", "a2"]);
    expect(resolveSelection("cartoon_color red", structure, { presentation }).stableAtomIds).toEqual(["a1", "a2"]);
    expect(resolveSelection("ribbon_color red", structure, { presentation }).stableAtomIds).toEqual([]);
    const ribbonPresentation = {
      ...presentation,
      representationColorTokensByStableAtomId: {
        ...presentation.representationColorTokensByStableAtomId,
        a1: { RIBBON: ["#ff0000", "red"] },
        a2: { RIBBON: ["#ff0000", "red"] },
      },
      revision: "projection-ribbon-selectors-1",
    };
    expect(resolveSelection("ribbon_color red", structure, { presentation: ribbonPresentation }).stableAtomIds).toEqual(["a1", "a2"]);
    expect(resolveSelection("label ALA10:CA", structure, { presentation }).stableAtomIds).toEqual(["a1"]);
    expect(evaluateSelectionQuery("rep cartoon !=", structure, { presentation }).status).toBe("SYNTAX_ERROR");
    const result = resolveSelection("rep sticks", structure, { presentation });
    expect(result.stableAtomIds).toEqual(["l1"]);
    expect(result.presentationContext?.revision).toBe("projection-selectors-1");
    expect(result.dependencyVector.needsPresentation).toBe(true);
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

  it("resolves nucleic polymer selection only from complete canonical typing", () => {
    const typed = {
      ...structure,
      id: "typed-engine-structure",
      scientificHash: "typed-engine-revision".padEnd(64, "0"),
      polymerTypingSource: "test canonical entity typing",
      atoms: structure.atoms.map((atom) => atom.isPolymer ? { ...atom, polymerType: atom.stableId === "a1" || atom.stableId === "a2" ? "NUCLEIC_ACID" as const : "PROTEIN" as const } : atom),
    } satisfies CanonicalMolecularStructure;
    expect(resolveSelection("polymer.nucleic", typed).stableAtomIds).toEqual(["a1", "a2"]);
    expect(resolveSelection("polymer.protein", typed).stableAtomIds).toEqual(["a3", "b1"]);
    expect(evaluateSelectionQuery("polymer.nucleic", structure).status).toBe("MISSING_DEPENDENCY");
  });

  it("records the consulted coordinate state for state-dependent predicates", () => {
    const state1 = `${structure.id}:state:1`;
    const state2 = `${structure.id}:state:2`;
    const multistate = {
      ...structure,
      coordinateStates: [
        { id: state1, ordinal: 1, sourceModelNumber: 1, coordinateHash: "state-1", coordinates: Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, { x: atom.x, y: atom.y, z: atom.z }])) },
        { id: state2, ordinal: 2, sourceModelNumber: 2, coordinateHash: "state-2", coordinates: Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, { x: atom.stableId === "a1" ? 0.2 : atom.stableId === "a2" ? 1.65 : atom.x, y: atom.y, z: atom.z }])) },
      ],
      stateOrder: [state1, state2],
    } satisfies CanonicalMolecularStructure;
    const loaded = { structure: multistate, renderSource: { format: "pdb" as const, content: "MODEL\nEND" } };
    const object = createWorkspaceObject(loaded);
    const firstStructure = workspaceSelectionStructure([object])!;
    const first = resolveSelection("x < 1.5", firstStructure, { coordinateStateId: state1, stateOrdinal: 1 });
    expect(first.count).toBe(2);
    expect(first.coordinateContext?.stateScopes).toEqual([{ objectId: object.objectId, stateId: state1, ordinal: 1 }]);

    const secondObject = setWorkspaceObjectState(object, state2);
    const secondStructure = workspaceSelectionStructure([secondObject])!;
    const second = resolveSelection("x < 1.5", secondStructure, { coordinateStateId: state2, stateOrdinal: 2 });
    expect(second.count).toBe(1);
    expect(second.coordinateContext?.stateScopes).toEqual([{ objectId: object.objectId, stateId: state2, ordinal: 2 }]);
    expect(second.coordinateContext?.stateScopes).not.toEqual(first.coordinateContext?.stateScopes);
  });

  it("uses the centralized closed spatial boundary tolerance", () => {
    expect(SPATIAL_TOLERANCE_POLICY.metric).toBe("EUCLIDEAN_SQUARED_ANGSTROM");
    expect(withinSpatialBoundary(4, 4)).toBe(true);
    expect(withinSpatialBoundary(4 + SPATIAL_TOLERANCE_POLICY.squaredDistanceEpsilon / 2, 4)).toBe(true);
    expect(withinSpatialBoundary(4 + SPATIAL_TOLERANCE_POLICY.squaredDistanceEpsilon * 2, 4)).toBe(false);
  });

  it("covers spatial zero, boundary, empty-reference, and self-overlap semantics", () => {
    const boundary = {
      ...structure,
      id: "spatial-boundary",
      name: "spatial-boundary",
      scientificHash: "spatial-boundary-revision".padEnd(64, "0"),
      counts: { ...structure.counts, atoms: 4, residues: 2, chains: 1, polymerAtoms: 3, ligandAtoms: 1, waterAtoms: 0 },
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 2.001, y: 0, z: 0 } },
      atoms: [
        { ...structure.atoms[0]!, stableId: "ref", atomName: "REF", residueName: "LIG", residueNumber: 1, x: 0, isPolymer: false, isLigand: true },
        { ...structure.atoms[1]!, stableId: "below", atomName: "BELOW", residueNumber: 2, x: 1.999 },
        { ...structure.atoms[2]!, stableId: "equal", atomName: "EQUAL", residueNumber: 2, x: 2 },
        { ...structure.atoms[3]!, stableId: "above", atomName: "ABOVE", residueNumber: 2, x: 2.001 },
      ],
      bonds: [],
    } satisfies CanonicalMolecularStructure;
    expect(resolveSelection("within 0 of name REF", boundary).stableAtomIds).toEqual(["ref"]);
    expect(resolveSelection("within 2 of name REF", boundary).stableAtomIds).toEqual(["ref", "below", "equal"]);
    expect(resolveSelection("within 1.999 of name REF", boundary).stableAtomIds).toEqual(["ref", "below"]);
    expect(resolveSelection("within 2.001 of name REF", boundary).stableAtomIds).toEqual(["ref", "below", "equal", "above"]);
    const emptyReference = evaluateSelectionQuery("within 2 of name MISSING", boundary);
    expect(emptyReference.status).toBe("VALID_EMPTY");
    expect(emptyReference.count).toBe(0);
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
