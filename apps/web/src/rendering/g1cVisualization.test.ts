import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { COLOR_SCHEME_DEFINITIONS } from "./colorSchemes";
import { buildRenderProjectionDiagnostics } from "./renderDirectives";
import { createDefaultRenderProjection, setLayerVisibility, setProjectionStyle } from "./presentationState";
import { representationCapabilityFor, STYLE_DEFINITIONS, SURFACE_PROFILES, surfaceProfileForStyle } from "./styleProfiles";

const structure = {
  id: "g1c-matrix",
  name: "g1c-matrix",
  format: "pdb",
  source: { kind: "LOCAL_FILE", originalFilename: "g1c-matrix.pdb", format: "pdb", sha256: "a".repeat(64), byteLength: 100, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 6, residues: 4, chains: 1, polymerAtoms: 2, ligandAtoms: 2, waterAtoms: 1, ionAtoms: 1, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 5, y: 5, z: 5 } },
  atoms: [
    { stableId: "polymer-1", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false, bFactor: 10 },
    { stableId: "polymer-2", serial: 2, atomName: "C", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 1, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false, bFactor: 30 },
    { stableId: "ligand-1", serial: 3, atomName: "C1", element: "C", residueName: "LIG", residueNumber: 2, chain: "A", x: 2, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "ligand-2", serial: 4, atomName: "O1", element: "O", residueName: "LIG", residueNumber: 2, chain: "A", x: 3, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "water-1", serial: 5, atomName: "O", element: "O", residueName: "HOH", residueNumber: 3, chain: "A", x: 4, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: false, isWater: true, isIon: false },
    { stableId: "ion-1", serial: 6, atomName: "NA", element: "NA", residueName: "NA", residueNumber: 4, chain: "A", x: 5, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: false, isWater: false, isIon: true },
  ],
  bonds: [
    { id: "bond-polymer", atom1: "polymer-1", atom2: "polymer-2", order: "SINGLE", source: "PDB_CONECT" },
    { id: "bond-ligand", atom1: "ligand-1", atom2: "ligand-2", order: "SINGLE", source: "PDB_CONECT" },
  ],
  hierarchy: { chainIds: ["chain:A"], chains: { "chain:A": { id: "chain:A", name: "A", residueIds: ["chain:A:residue:1:", "chain:A:residue:2:"] } }, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("G1C representation matrix", () => {
  it("exposes the complete requested style inventory", () => {
    expect(STYLE_DEFINITIONS.map((definition) => definition.label)).toEqual([
      "Line", "Stick", "Ball-and-Stick", "Space-Filling", "Van der Waals Surface", "Solvent-Accessible Surface", "Solvent-Excluded Surface", "Mesh", "Dots", "Dot Surface", "Cartoon", "Ribbon", "Trace", "Putty", "Non-bonded (crosses)", "Non-bonded (spheres)", "Licorice",
    ]);
  });

  it("keeps bonded primitives and sphere compositions distinct", () => {
    const line = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "line"));
    const stick = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "stick"));
    const spheres = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "space-filling"));
    const ball = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "ball-and-stick"));
    expect(line.lineContributors).toBe(2);
    expect(stick.stickCylinderContributors).toBe(2);
    expect(spheres.sphereContributors).toBe(5);
    expect(spheres.stickCylinderContributors).toBe(0);
    expect(ball.sphereContributors).toBe(5);
    expect(ball.stickCylinderContributors).toBe(2);
  });

  it("uses canonical zero-neighbor topology for non-bonded modes", () => {
    const crosses = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "nonbonded-crosses"));
    const spheres = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "nonbonded-spheres"));
    expect(crosses.crossContributors).toBe(1);
    expect(spheres.sphereContributors).toBe(1);
    expect(crosses.representation.NONBONDED.atomContributors).toBe(1);
  });

  it("keeps Cartoon, Ribbon, Trace, and Putty capability truth explicit", () => {
    const cartoon = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "cartoon"));
    const ribbon = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "ribbon"));
    const trace = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "trace"));
    const putty = buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, "putty"));
    expect(cartoon.cartoonContributors).toBe(2);
    expect(ribbon.ribbonContributors).toBe(0);
    expect(ribbon.cartoonContributors).toBe(0);
    expect(representationCapabilityFor("ribbon", structure).status).toBe("NOT_IMPLEMENTED");
    expect(representationCapabilityFor("ribbon", structure).maySelect).toBe(false);
    expect(trace.traceContributors).toBe(2);
    expect(putty.puttyContributors).toBe(2);
  });

  it("guards Putty when the canonical source has no B-factor values", () => {
    const missingB = { ...structure, atoms: structure.atoms.map((atom) => { const withoutB = { ...atom }; delete withoutB.bFactor; return withoutB; }) };
    const capability = representationCapabilityFor("putty", missingB);
    const diagnostics = buildRenderProjectionDiagnostics(missingB, setProjectionStyle(createDefaultRenderProjection(structure), missingB, "putty"));
    expect(capability.status).toBe("INSUFFICIENT_DATA");
    expect(capability.maySelect).toBe(false);
    expect(capability.diagnostic).toMatch(/B-factor/i);
    expect(diagnostics.puttyContributors).toBe(0);
    expect(diagnostics.directives.some((directive) => directive.representation === "CARTOON")).toBe(false);
  });

  it("reports a valid-empty non-bonded result instead of inventing contributors", () => {
    const fullyBonded = { ...structure, bonds: structure.atoms.slice(1).map((atom, index) => ({ id: `bond-${index}`, atom1: structure.atoms[index].stableId, atom2: atom.stableId, order: "SINGLE" as const, source: "PDB_CONECT" as const })) };
    const capability = representationCapabilityFor("nonbonded-crosses", fullyBonded);
    expect(capability.status).toBe("VALID_EMPTY");
    expect(capability.eligibleAtomCount).toBe(0);
    expect(capability.diagnostic).toMatch(/0 eligible/i);
  });

  it("reports unavailable geometry instead of substituting a surface", () => {
    for (const style of ["van-der-waals-surface", "solvent-accessible-surface", "solvent-excluded-surface", "mesh", "dots", "dot-surface"] as const) {
      const definition = STYLE_DEFINITIONS.find((candidate) => candidate.id === style);
      expect(definition?.capability).toBe("COMING_SOON");
      expect(buildRenderProjectionDiagnostics(structure, setProjectionStyle(createDefaultRenderProjection(structure), structure, style)).directives.some((directive) => directive.primitive === "cartoon")).toBe(false);
    }
    expect(surfaceProfileForStyle("van-der-waals-surface")).toEqual(SURFACE_PROFILES.VDW);
    expect(surfaceProfileForStyle("solvent-accessible-surface")).toEqual(SURFACE_PROFILES.SAS);
    expect(surfaceProfileForStyle("solvent-excluded-surface")).toEqual(SURFACE_PROFILES.SES);
    expect(SURFACE_PROFILES.VDW.probe_radius).not.toBe(SURFACE_PROFILES.SAS.probe_radius);
    expect(SURFACE_PROFILES.SAS.profile_id).not.toBe(SURFACE_PROFILES.SES.profile_id);
  });

  it("keeps water presentation independent from the selected protein style", () => {
    const projection = setProjectionStyle(createDefaultRenderProjection(structure), structure, "ribbon");
    expect(buildRenderProjectionDiagnostics(structure, projection).waterSphereContributors).toBe(0);
    expect(buildRenderProjectionDiagnostics(structure, setLayerVisibility(projection, "showWater")).waterSphereContributors).toBe(1);
  });
});

describe("G1C non-mutation", () => {
  it("does not mutate canonical identity, coordinates, topology, or provenance", () => {
    const before = JSON.stringify(structure);
    let projection = createDefaultRenderProjection(structure);
    projection = setProjectionStyle(projection, structure, "ball-and-stick");
    projection = setProjectionStyle(projection, structure, "space-filling");
    projection = setLayerVisibility(projection, "showWater");
    expect(projection.representation).toBe("space-filling");
    expect(JSON.stringify(structure)).toBe(before);
    expect(structure.scientificHash).toBe("b".repeat(64));
    expect(structure.bonds).toHaveLength(2);
  });
});

describe("G1C color matrix registration", () => {
  it("registers every required scheme as a first-class definition", () => {
    expect(COLOR_SCHEME_DEFINITIONS).toHaveLength(15);
    expect(COLOR_SCHEME_DEFINITIONS.every((definition) => definition.version && definition.propertySource && definition.missingValuePolicy && definition.legend)).toBe(true);
  });
});
