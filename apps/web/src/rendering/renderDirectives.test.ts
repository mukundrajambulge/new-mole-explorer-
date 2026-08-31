import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { buildRenderProjectionDiagnostics } from "./renderDirectives";
import { applyRepresentationOperation, createDefaultRenderProjection, REPRESENTATION_MASKS, setLayerVisibility, setProjectionStyle } from "./presentationState";

const structure = {
  id: "presentation_regression",
  name: "presentation-regression",
  format: "pdb",
  source: { kind: "LOCAL_FILE", originalFilename: "presentation-regression.pdb", format: "pdb", sha256: "a".repeat(64), byteLength: 100, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 6, residues: 4, chains: 1, polymerAtoms: 2, ligandAtoms: 2, waterAtoms: 1, ionAtoms: 1, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 5, y: 5, z: 5 } },
  atoms: [
    { stableId: "polymer-1", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "polymer-2", serial: 2, atomName: "C", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 1, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "ligand-1", serial: 3, atomName: "C1", element: "C", residueName: "LIG", residueNumber: 2, chain: "A", x: 2, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "ligand-2", serial: 4, atomName: "O1", element: "O", residueName: "LIG", residueNumber: 2, chain: "A", x: 3, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false },
    { stableId: "water-1", serial: 5, atomName: "O", element: "O", residueName: "HOH", residueNumber: 3, chain: "A", x: 4, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: false, isWater: true, isIon: false },
    { stableId: "ion-1", serial: 6, atomName: "NA", element: "NA", residueName: "NA", residueNumber: 4, chain: "A", x: 5, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: false, isWater: false, isIon: true },
  ],
  bonds: [
    { id: "bond-polymer", atom1: "polymer-1", atom2: "polymer-2", order: "SINGLE", source: "PDB_CONECT" },
    { id: "bond-ligand", atom1: "ligand-1", atom2: "ligand-2", order: "SINGLE", source: "PDB_CONECT" },
  ],
  hierarchy: { chainIds: [], chains: {}, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("G1B-R1 canonical render directive diagnostics", () => {
  it("G1B-REG-004 keeps Spheres sphere-only and Ball & Stick layered", () => {
    const sphereProjection = setProjectionStyle(createDefaultRenderProjection(structure), structure, "spheres");
    const ballProjection = setProjectionStyle(createDefaultRenderProjection(structure), structure, "ball-and-stick");
    const spheres = buildRenderProjectionDiagnostics(structure, sphereProjection);
    const ball = buildRenderProjectionDiagnostics(structure, ballProjection);

    expect(spheres.sphereContributors).toBe(5);
    expect(spheres.stickCylinderContributors).toBe(0);
    expect(ball.sphereContributors).toBe(5);
    expect(ball.stickCylinderContributors).toBe(2);
    expect(ball.representation.STICKS.bondContributors).toBe(2);
    expect(ball.representation.SPHERES.bondContributors).toBe(0);
  });

  it("G1B-REG-005 keeps Licorice distinct through nonbonded spheres", () => {
    const projection = setProjectionStyle(createDefaultRenderProjection(structure), structure, "licorice");
    const diagnostics = buildRenderProjectionDiagnostics(structure, projection);
    expect(diagnostics.stickCylinderContributors).toBe(2);
    expect(diagnostics.representation.NB_SPHERES.atomContributors).toBe(1);
    expect(diagnostics.representation.SPHERES.supported).toBe(true);
  });

  it("G1B-REG-006 keeps water sphere-eligible while layer visibility gates it", () => {
    const projection = createDefaultRenderProjection(structure);
    const hidden = buildRenderProjectionDiagnostics(structure, projection);
    const visible = buildRenderProjectionDiagnostics(structure, setLayerVisibility(projection, "showWater"));
    expect(hidden.waterSphereContributors).toBe(0);
    expect(visible.waterSphereContributors).toBe(1);
    expect(visible.representation.SPHERES.atomContributors).toBe(2);
  });

  it("VIS-REG-007 projects Ribbon distinctly without substituting Cartoon", () => {
    const projection = createDefaultRenderProjection(structure);
    const state = applyRepresentationOperation(projection.representationState, "SHOW", REPRESENTATION_MASKS.RIBBON, ["polymer-1"]);
    const diagnostics = buildRenderProjectionDiagnostics(structure, { ...projection, representationState: state });
    expect(diagnostics.representation.RIBBON.supported).toBe(true);
    expect(diagnostics.representation.RIBBON.active).toBe(true);
    expect(diagnostics.representation.RIBBON.status).toBe("IMPLEMENTED_WITH_LIMITATIONS");
    expect(diagnostics.directives.some((directive) => directive.representation === "RIBBON" && directive.styleProfile === "ribbon")).toBe(true);
    expect(diagnostics.representation.CARTOON.active).toBe(true);
  });

  it("G1B-REG-022 changes only presentation-derived data", () => {
    const original = JSON.stringify(structure);
    const projection = setProjectionStyle(createDefaultRenderProjection(structure), structure, "ball-and-stick");
    buildRenderProjectionDiagnostics(structure, setLayerVisibility(projection, "showWater"));
    expect(JSON.stringify(structure)).toBe(original);
    expect(structure.scientificHash).toBe("b".repeat(64));
  });
});
