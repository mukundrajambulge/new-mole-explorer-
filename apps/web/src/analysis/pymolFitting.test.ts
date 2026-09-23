import { describe, expect, it } from "vitest";
import { selectionForStableIds } from "../selection/selectionEngine";
import { coordinateContextFor } from "../interaction/picking";
import { ScientificHistoryService } from "../editing/editFoundation";
import { applyFittingResult, runFit, runIntraRmsCur, runPairFit, runRms, runRmsCur, runAlign, runCEAlign } from "./pymolFitting";
import { createDefaultAlignmentRequest } from "./alignment";
import { type CanonicalAtom, type CanonicalMolecularStructure, type StructureLoadResult } from "@molecular/contracts";

const atom = (id: string, serial: number, x: number, y: number, z: number, residueNumber = serial): CanonicalAtom => ({ stableId: id, serial, atomName: "CA", element: "C", residueName: "ALA", residueNumber, chain: "A", x, y, z, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false });
const structure = (id: string, points: readonly { x: number; y: number; z: number }[], states = 1): CanonicalMolecularStructure => {
  const atoms = points.map((point, index) => atom(`${id}-${index}`, index + 1, point.x, point.y, point.z)); const coordinateStates = Array.from({ length: states }, (_, stateIndex) => ({ id: `${id}:state:${stateIndex + 1}`, ordinal: stateIndex + 1, coordinates: Object.fromEntries(atoms.map((entry) => [entry.stableId, { x: entry.x + stateIndex * 0.5, y: entry.y, z: entry.z }])), coordinateHash: `${id}:state:${stateIndex + 1}` }));
  return { id, name: id, format: "pdb", source: { kind: "LOCAL_FILE", originalFilename: `${id}.pdb`, format: "pdb", sha256: id, byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" }, counts: { atoms: atoms.length, residues: atoms.length, chains: 1, polymerAtoms: atoms.length, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 }, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }, atoms, bonds: [], hierarchy: { chainIds: ["chain:A"], chains: { "chain:A": { id: "chain:A", name: "A", residueIds: atoms.map((entry) => `chain:A:residue:${entry.residueNumber}:`) } }, residues: Object.fromEntries(atoms.map((entry) => [`chain:A:residue:${entry.residueNumber}:`, { id: `chain:A:residue:${entry.residueNumber}:`, name: entry.residueName, number: entry.residueNumber, chainId: "chain:A", atomIds: [entry.stableId], isPolymer: true }])) }, scientificHash: `${id}:revision`, coordinateStates, stateOrder: coordinateStates.map((state) => state.id) };
};
const loadResult = (value: CanonicalMolecularStructure): StructureLoadResult => ({ structure: value, renderSource: { format: "pdb", content: "END\n" } });
const requestFor = (source: CanonicalMolecularStructure, target: CanonicalMolecularStructure, operationKind: "RMS_CUR" | "RMS" | "FIT" = "RMS") => createDefaultAlignmentRequest({ operationKind, sourceObjectId: source.id, targetObjectId: target.id, sourceRevisionId: source.scientificHash, targetRevisionId: target.scientificHash, sourceStructure: source, targetStructure: target, sourceStateId: `${source.id}:state:1`, targetStateId: `${target.id}:state:1`, sourceSelection: selectionForStableIds(source.atoms.map((atom) => atom.stableId), source), targetSelection: selectionForStableIds(target.atoms.map((atom) => atom.stableId), target), sourceCoordinateContext: coordinateContextFor(source, source.id, "1"), targetCoordinateContext: coordinateContextFor(target, target.id, "1"), explicitPairs: source.atoms.map((atom, index) => ({ sourceAtomUid: atom.stableId, targetAtomUid: target.atoms[index]!.stableId })), transformRequested: operationKind === "FIT" });

describe("R08 PyMOL fitting family", () => {
  const sourcePoints = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 3 }]; const targetPoints = sourcePoints.map((point) => ({ x: -point.y + 3, y: point.x - 2, z: point.z + 1 }));

  it("AT-R08-19..22 keep rms/rms_cur analysis-only and expose PyMOL numerics", () => {
    const source = structure("source", sourcePoints); const target = structure("target", targetPoints); const request = requestFor(source, target); const current = runRmsCur(request); const fitted = runRms(request); expect(current.ok).toBe(true); expect(fitted.ok).toBe(true); if (!current.ok || !fitted.ok) return; expect(current.value.numericValue).toBeGreaterThan(1); expect(fitted.value.numericValue).toBeLessThan(1e-8); expect(current.value.result.resultDisposition).toBe("VALID"); expect(fitted.value.result.rotationMatrix).toBeDefined(); expect(fitted.value.compatibilityTuple).toHaveLength(7); expect(fitted.value.result.resultDisposition).toBe("VALID");
  });

  it("AT-R08-23/24 applies fit through R07 history and supports exact undo/redo", () => {
    const source = structure("source", sourcePoints); const target = structure("target", targetPoints); const history = new ScientificHistoryService(); const root = history.registerRoot(source.id, loadResult(source)); const request = requestFor(source, target, "FIT"); const fit = runFit({ ...request, sourceRevisionId: root.revisionId }); expect(fit.ok).toBe(true); if (!fit.ok) return; const applied = applyFittingResult(history, root, { ...request, sourceRevisionId: root.revisionId }, fit.value); expect(applied.ok).toBe(true); if (!applied.ok) return; expect(applied.transaction.ok).toBe(true); if (!applied.transaction.ok) return; expect(applied.transaction.revision.operation).toBe("APPLY_RIGID_TRANSFORM"); expect(applied.transaction.revision.loadResult.structure.atoms[1]!.x).toBeCloseTo(targetPoints[1]!.x, 6); const undo = history.undo(source.id); expect(undo.ok).toBe(true); if (!undo.ok) return; expect(undo.revision.loadResult.structure.atoms[1]!.x).toBeCloseTo(sourcePoints[1]!.x, 6); const redo = history.redo(source.id); expect(redo.ok).toBe(true); if (!redo.ok) return; expect(redo.revision.loadResult.structure.atoms[1]!.x).toBeCloseTo(targetPoints[1]!.x, 6);
  });

  it("AT-R08-25..30 supports explicit pair fit, intra state reports, and bounded unsupported CE", () => {
    const source = structure("source", sourcePoints, 2); const target = structure("target", targetPoints); const request = requestFor(source, target); const pairFit = runPairFit(request); expect(pairFit.ok).toBe(true); const intra = runIntraRmsCur(request); expect(intra.ok).toBe(true); if (intra.ok) expect(intra.value.states.length).toBe(2); const ce = runCEAlign(); expect(ce.ok).toBe(false); expect(ce.error.disposition).toBe("UNSUPPORTED");
  });

  it("AT-R08-31/35 provides sequence-guided align with the seven compatibility fields", () => {
    const source = structure("source", sourcePoints); const target = structure("target", targetPoints); const result = runAlign(requestFor(source, target)); expect(result.ok).toBe(true); if (!result.ok) return; expect(result.value.mapping.mappingMode).toBe("SEQUENCE_GUIDED"); expect(result.value.compatibilityTuple).toHaveLength(7);
  });
});
