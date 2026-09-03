import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { COLOR_SCHEME_DEFINITIONS, resolveAtomColor, resolveProjectedAtomColor } from "./colorSchemes";
import { clearColorForSelection, createDefaultRenderProjection, setColorForSelection, setColorScheme, setComponentColor, setLayerVisibility, setProjectionStyle, setRepresentationColorForSelection } from "./presentationState";

const structure = {
  id: "structure:color-fixture",
  name: "color-fixture",
  format: "pdb",
  source: { kind: "LOCAL_FILE", originalFilename: "color-fixture.pdb", format: "pdb", sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 4, residues: 2, chains: 1, polymerAtoms: 3, ligandAtoms: 1, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 3, y: 3, z: 3 } },
  atoms: [
    { stableId: "c", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false, formalCharge: 0, bFactor: 10 },
    { stableId: "n", serial: 2, atomName: "N", element: "N", residueName: "LYS", residueNumber: 2, chain: "A", x: 1, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false, formalCharge: 1, bFactor: 30 },
    { stableId: "o", serial: 3, atomName: "O", element: "O", residueName: "GLU", residueNumber: 3, chain: "A", x: 2, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false, formalCharge: null, bFactor: 20 },
    { stableId: "lig", serial: 4, atomName: "C1", element: "C", residueName: "LIG", residueNumber: 101, chain: "A", x: 3, y: 0, z: 0, recordType: "HETATM", isPolymer: false, isLigand: true, isWater: false, isIon: false, formalCharge: 0 },
  ],
  bonds: [],
  hierarchy: { chainIds: ["chain:A"], chains: { "chain:A": { id: "chain:A", name: "A", residueIds: ["chain:A:residue:1:", "chain:A:residue:2:", "chain:A:residue:3:"] } }, residues: { "chain:A:residue:1:": { id: "chain:A:residue:1:", name: "ALA", number: 1, chainId: "chain:A", atomIds: ["c"], isPolymer: true }, "chain:A:residue:2:": { id: "chain:A:residue:2:", name: "LYS", number: 2, chainId: "chain:A", atomIds: ["n"], isPolymer: true }, "chain:A:residue:3:": { id: "chain:A:residue:3:", name: "GLU", number: 3, chainId: "chain:A", atomIds: ["o"], isPolymer: true } } },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("G1C renderer-neutral color schemes", () => {
  it("exposes the complete 15-scheme inventory", () => expect(COLOR_SCHEME_DEFINITIONS.map((definition) => definition.name)).toEqual(["Classic CPK", "Modern/Jmol", "By Molecule", "By Formal Charge", "By Partial Charge", "ESP", "Hydrophobicity", "Rainbow", "Monochrome", "Colourblind-safe", "Secondary Structure (Standard)", "Secondary Structure (Jmol)", "By Chain", "By Element (CPK)", "White"]));
  it("keeps CPK and Jmol as distinct versioned palettes", () => expect(resolveAtomColor("classic-cpk", structure.atoms[0], structure).color).not.toBe(resolveAtomColor("modern-jmol", structure.atoms[0], structure).color));
  it("distinguishes formal zero from unknown", () => { expect(resolveAtomColor("by-formal-charge", structure.atoms[0], structure).status).toBe("READY"); expect(resolveAtomColor("by-formal-charge", structure.atoms[2], structure).diagnostic).toBe("FORMAL_CHARGE_UNKNOWN"); });
  it("reports missing partial charge data without neutral fake coloring", () => { const result = resolveAtomColor("by-partial-charge", structure.atoms[0], structure); expect(result.status).toBe("UNAVAILABLE"); expect(result.diagnostic).toContain("Partial-charge data unavailable"); });
  it("uses a documented hydrophobicity scale and deterministic polymer order", () => { expect(resolveAtomColor("hydrophobicity", structure.atoms[0], structure).status).toBe("READY"); expect(resolveAtomColor("rainbow", structure.atoms[0], structure).color).toBe(resolveAtomColor("rainbow", structure.atoms[0], structure).color); });
  it("does not invent secondary structure or ESP", () => { expect(resolveAtomColor("secondary-structure-standard", structure.atoms[0], structure).status).toBe("UNAVAILABLE"); expect(resolveAtomColor("esp", structure.atoms[0], structure).status).toBe("EXPERIMENTAL"); });
  it("uses the canonical assignment for both secondary-structure palettes", () => {
    const withDataset = {
      ...structure,
      secondaryStructureDataset: { datasetId: "secondary:v1", molecularRevision: structure.scientificHash, assignmentSource: "PDB HELIX/SHEET", profileVersion: "v1" },
      atoms: structure.atoms.map((atom, index) => ({ ...atom, secondaryStructure: index === 0 ? "HELIX" as const : "LOOP" as const })),
    };
    const standard = resolveAtomColor("secondary-structure-standard", withDataset.atoms[0], withDataset);
    const jmol = resolveAtomColor("secondary-structure-jmol", withDataset.atoms[0], withDataset);
    expect(standard.status).toBe("READY");
    expect(jmol.status).toBe("READY");
    expect(standard.color).not.toBe(jmol.color);
  });
  it("renders a supplied partial-charge dataset", () => { const withDataset = { ...structure, partialChargeDataset: { datasetId: "charges:v1", molecularRevision: structure.scientificHash, chargeModel: "fixture", profileVersion: "v1", atomChargeMap: { c: -0.5, n: 0.5 }, units: "e", provenance: "deterministic fixture" } }; expect(resolveAtomColor("by-partial-charge", withDataset.atoms[0], withDataset).status).toBe("READY"); });
  it("uses explicit ligand color before representation changes, visibility, or global scheme changes", () => {
    const ligand = structure.atoms[3];
    const base = createDefaultRenderProjection(structure);
    const inherited = resolveProjectedAtomColor(base.color, "STICKS", ligand, structure);
    expect(inherited.color).toBe(resolveAtomColor("rainbow", ligand, structure).color);

    const cpk = setColorScheme(base, "classic-cpk", structure);
    expect(resolveProjectedAtomColor(cpk.color, "STICKS", ligand, structure).color).toBe(resolveAtomColor("classic-cpk", ligand, structure).color);

    const red = setColorForSelection(cpk, [ligand.stableId], "#ff0000");
    const ballAndStick = setProjectionStyle(red, structure, "ball-and-stick");
    const hidden = setLayerVisibility(ballAndStick, "showLigand", false);
    const shown = setLayerVisibility(hidden, "showLigand", true);
    const recoloredGlobally = setColorScheme(shown, "modern-jmol", structure);
    expect(resolveProjectedAtomColor(ballAndStick.color, "STICKS", ligand, structure).color).toBe("#ff0000");
    expect(resolveProjectedAtomColor(shown.color, "SPHERES", ligand, structure).color).toBe("#ff0000");
    expect(resolveProjectedAtomColor(recoloredGlobally.color, "STICKS", ligand, structure).color).toBe("#ff0000");

    const reset = clearColorForSelection(recoloredGlobally, [ligand.stableId]);
    expect(resolveProjectedAtomColor(reset.color, "STICKS", ligand, structure).color).toBe(resolveAtomColor("modern-jmol", ligand, structure).color);
  });
  it("applies component color precedence without changing canonical identity", () => {
    const ligand = structure.atoms[3];
    const base = createDefaultRenderProjection(structure);
    const component = setComponentColor(setColorScheme(base, "modern-jmol", structure), "ligand", "custom", "#00ff88");
    expect(resolveProjectedAtomColor(component.color, "STICKS", ligand, structure).color).toBe("#00ff88");
    const selected = setColorForSelection(component, [ligand.stableId], "#ff00ff");
    expect(resolveProjectedAtomColor(selected.color, "STICKS", ligand, structure).color).toBe("#ff00ff");
    expect(structure.atoms[3].stableId).toBe("lig");
    expect(selected.color.componentColors.ligand?.mode).toBe("custom");
    const representationSpecific = setRepresentationColorForSelection(selected, [ligand.stableId], "STICKS", "#112233");
    expect(resolveProjectedAtomColor(representationSpecific.color, "STICKS", ligand, structure).color).toBe("#112233");
    expect(resolveProjectedAtomColor(representationSpecific.color, "SPHERES", ligand, structure).color).toBe("#ff00ff");
    const inherited = clearColorForSelection(representationSpecific, [ligand.stableId]);
    expect(inherited.color.componentColors.ligand?.mode).toBe("custom");
    expect(inherited.color.representationOverrides[ligand.stableId]).toBeUndefined();
  });
});
