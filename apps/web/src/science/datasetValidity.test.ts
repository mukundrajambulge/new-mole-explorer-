import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { canonicalChemistryRolesDatasetComplete, canonicalFragmentDatasetComplete, canonicalPartialChargeDatasetComplete } from "./datasetValidity";

const structure = {
  id: "dataset-validity",
  name: "dataset-validity",
  format: "pdb" as const,
  source: { kind: "LOCAL_FILE" as const, originalFilename: "dataset-validity.pdb", format: "pdb" as const, sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 1, residues: 1, chains: 1, polymerAtoms: 1, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
  atoms: [{ stableId: "a1", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM" as const, isPolymer: true, isLigand: false, isWater: false, isIon: false }],
  bonds: [],
  hierarchy: { chainIds: [], chains: {}, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("canonical optional dataset validators", () => {
  it("fails closed without throwing when runtime dataset maps are malformed", () => {
    const partial = { ...structure, partialChargeDataset: { datasetId: "charges", molecularRevision: structure.scientificHash, chargeModel: "model", profileVersion: "v1", atomChargeMap: null, units: "e", provenance: "source" } } as unknown as CanonicalMolecularStructure;
    const fragments = { ...structure, fragmentDataset: { datasetId: "fragments", molecularRevision: structure.scientificHash, profileVersion: "canonical-fragment-assignment-v1", atomFragmentMap: null, assignmentSource: "source", provenance: "source" } } as unknown as CanonicalMolecularStructure;
    expect(() => canonicalPartialChargeDatasetComplete(partial)).not.toThrow();
    expect(() => canonicalFragmentDatasetComplete(fragments)).not.toThrow();
    expect(canonicalPartialChargeDatasetComplete(partial)).toBe(false);
    expect(canonicalFragmentDatasetComplete(fragments)).toBe(false);
  });

  it("fails closed without throwing when runtime role arrays are malformed", () => {
    const malformed = { ...structure, chemistryDataset: { datasetId: "roles", molecularRevision: structure.scientificHash, profileVersion: "canonical-chemistry-roles-v1", donorAtomIds: null, acceptorAtomIds: [], provenance: "source" } } as unknown as CanonicalMolecularStructure;
    expect(() => canonicalChemistryRolesDatasetComplete(malformed)).not.toThrow();
    expect(canonicalChemistryRolesDatasetComplete(malformed)).toBe(false);
  });
});
