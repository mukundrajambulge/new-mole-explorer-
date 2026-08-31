import { describe, expect, it } from "vitest";
import { buildDotSurfacePoints } from "./surfaceGenerator";
import { SurfaceGeometryCache, SurfaceRequestCoordinator, surfaceCacheKey, surfaceRequestFor } from "./surfaceProfiles";
import type { CanonicalMolecularStructure } from "@molecular/contracts";

const structure = {
  id: "surface-test",
  name: "surface-test",
  format: "pdb",
  source: { kind: "LOCAL_FILE", originalFilename: "surface-test.pdb", format: "pdb", sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 2, residues: 1, chains: 1, polymerAtoms: 2, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 3, y: 0, z: 0 } },
  atoms: [
    { stableId: "a", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "b", serial: 2, atomName: "CB", element: "O", residueName: "ALA", residueNumber: 1, chain: "A", x: 3, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
  ],
  bonds: [],
  hierarchy: { chainIds: [], chains: {}, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("surface projection profiles", () => {
  it("keeps target, contributors, probe, quality, and revision in cache identity", () => {
    const request = surfaceRequestFor(structure, "SAS", ["a"], ["a", "b"], { probeRadius: 1.4, quality: 0.5, sampling: 12 });
    expect(surfaceCacheKey(request)).toContain("surface.sas");
    expect(surfaceCacheKey({ ...request, targetStableAtomIds: ["b"] })).not.toBe(surfaceCacheKey(request));
    expect(surfaceCacheKey({ ...request, molecularRevision: "c".repeat(64) })).not.toBe(surfaceCacheKey(request));
  });

  it("samples deterministic exposed points only for canonical targets", () => {
    const first = buildDotSurfacePoints(structure, ["a"], ["a", "b"], "DOT_SURFACE", 1.4, 0.5);
    const second = buildDotSurfacePoints(structure, ["a"], ["a", "b"], "DOT_SURFACE", 1.4, 0.5);
    expect(first).toEqual(second);
    expect(first.every((point) => point.stableAtomId === "a")).toBe(true);
  });

  it("rejects stale surface generations", () => {
    const coordinator = new SurfaceRequestCoordinator();
    const first = coordinator.begin();
    const second = coordinator.begin();
    expect(coordinator.isCurrent(first)).toBe(false);
    expect(coordinator.isCurrent(second)).toBe(true);
    const cache = new SurfaceGeometryCache<string>();
    cache.set(surfaceRequestFor(structure, "VDW", ["a"], ["a", "b"], { probeRadius: 0, quality: 0.5, sampling: 12 }), "cached");
    expect(cache.size).toBe(1);
  });
});
