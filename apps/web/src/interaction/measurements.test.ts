import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { createMeasurementObject, getAngle, getDihedral, getDistance, measurementStatus } from "./measurements";

const atom = (stableId: string, x: number, y: number, z: number) => ({ stableId, serial: Number(stableId.slice(1)) || 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x, y, z, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false });
const structure = {
  id: "measurement-structure",
  name: "measurement",
  format: "pdb",
  source: { kind: "LOCAL_FILE" as const, originalFilename: "measurement.pdb", format: "pdb" as const, sha256: "a".repeat(64), byteLength: 100, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 4, residues: 1, chains: 1, polymerAtoms: 4, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
  atoms: [atom("a1", 0, 0, 0), atom("a2", 1, 0, 0), atom("a3", 1, 1, 0), atom("a4", 1, 1, 1)],
  bonds: [],
  hierarchy: { chainIds: [], chains: {}, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;
const context = { coordinateStateId: "measurement-structure:coordinates:active", modelId: structure.id, stateId: "active", molecularRevision: structure.scientificHash };

describe("canonical measurement kernels", () => {
  it("returns Å distance, degree angle, and signed degree dihedral values", () => {
    expect(getDistance(structure.atoms[0], structure.atoms[1])).toBe(1);
    expect(getAngle(structure.atoms[0], structure.atoms[1], structure.atoms[2])).toBe(90);
    expect(getDihedral(structure.atoms[0], structure.atoms[1], structure.atoms[2], structure.atoms[3])).toBe(90);
  });

  it("creates ordered stable-participant measurement objects and rejects stale revisions", () => {
    const measurement = createMeasurementObject("DISTANCE", ["a1", "a2"], structure, context, 1);
    expect(measurement.participants.map((participant) => participant.stableAtomId)).toEqual(["a1", "a2"]);
    expect(measurement.displayUnit).toBe("Å");
    expect(measurement.provenance).toBe("canonical-coordinate-kernel");
    expect(measurementStatus(measurement, structure)).toBe("CURRENT");
    expect(measurementStatus(measurement, { ...structure, scientificHash: "c".repeat(64) })).toBe("STALE");
    expect(measurementStatus({ ...measurement, presentation: { ...measurement.presentation, visible: false } }, structure)).toBe("HIDDEN");
  });
});
