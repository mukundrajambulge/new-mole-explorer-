import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { createWorkspaceObject } from "../workspace/workspaceModel";
import { exportStructure, membershipHash } from "./export";

const objectFor = (withDataset = false) => {
  const structure = {
    id: "structure:export", name: "export", format: "pdb",
    source: { kind: "LOCAL_FILE", originalFilename: "export.pdb", format: "pdb", sha256: "source", byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
    counts: { atoms: 2, residues: 1, chains: 1, polymerAtoms: 2, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 }, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 0 } },
    atoms: [{ stableId: "a1", serial: 1, atomName: "N", element: "N", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false }, { stableId: "a2", serial: 2, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 1, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false }], bonds: [], hierarchy: { chainIds: ["chain:A"], chains: { "chain:A": { id: "chain:A", name: "A", residueIds: ["residue:1"] } }, residues: { "residue:1": { id: "residue:1", name: "ALA", number: 1, chainId: "chain:A", atomIds: ["a1", "a2"], isPolymer: true } } }, scientificHash: "rev:export", coordinateStates: [{ id: "state:1", ordinal: 1, coordinates: { a1: { x: 0, y: 0, z: 0 }, a2: { x: 1, y: 0, z: 0 } }, coordinateHash: "state" }], stateOrder: ["state:1"], ...(withDataset ? { secondaryStructureDataset: { datasetId: "ss", molecularRevision: "rev:export", assignmentSource: "test", profileVersion: "1" } } : {}),
  } as CanonicalMolecularStructure;
  return createWorkspaceObject({ structure, renderSource: { format: "pdb", content: "" } } satisfies StructureLoadResult);
};

describe("R09 typed export", () => {
  it("writes deterministic PDB and mmCIF artifacts from frozen state", async () => {
    const object = objectFor(); const before = JSON.stringify(object);
    const selection = { objectId: object.objectId, stableAtomIds: ["a1", "a2"], membershipHash: membershipHash(["a1", "a2"]), sourceRevisionId: "rev:export" };
    const pdb = await exportStructure({ object, selection, format: "PDB" }); const cif = await exportStructure({ object, selection, format: "MMCIF" });
    expect(new TextDecoder().decode(pdb.bytes)).toContain("ATOM"); expect(new TextDecoder().decode(cif.bytes)).toContain("_atom_site.Cartn_x");
    expect(pdb.sha256).toHaveLength(64); expect(pdb.byteLength).toBe(pdb.bytes.byteLength); expect(pdb.lossManifest.complete).toBe(true); expect(JSON.stringify(object)).toBe(before);
  });

  it("refuses semantic loss under FAIL_ON_LOSS and reports it otherwise", async () => {
    const object = objectFor(true);
    await expect(exportStructure({ object, format: "PDB", lossPolicy: "FAIL_ON_LOSS" })).rejects.toMatchObject({ code: "EXPORT_WOULD_LOSE_SEMANTICS" });
    const artifact = await exportStructure({ object, format: "PDB", lossPolicy: "ALLOW_WITH_MANIFEST" });
    expect(artifact.lossManifest.entries.map((entry) => entry.code)).toContain("SECONDARY_STRUCTURE_DATASET");
  });
});
