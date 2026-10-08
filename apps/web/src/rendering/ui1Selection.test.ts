import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { resolveProjectedAtomColor } from "./colorSchemes";
import { createDefaultRenderProjection, setColorScheme } from "./presentationState";
import { selectionDeemphasisStyleFor, selectionOverlayStyle } from "./selectionStyles";

const atom = (stableId: string, element: string, isPolymer: boolean) => ({ stableId, serial: 1, atomName: element, element, residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer, isLigand: !isPolymer, isWater: false, isIon: false });
const structure = { id: "s", name: "s", atoms: [atom("ca", "C", true), atom("o", "O", true)], bonds: [], hierarchy: { chainIds: [], chains: {}, residues: {} }, scientificHash: "a".repeat(64) } as unknown as CanonicalMolecularStructure;

describe("UI-1 selection and color on cartoons", () => {
  const projection = { ...createDefaultRenderProjection(), representation: "cartoon" as const };

  it("B1: a pick never makes cartoon translucent and always adds an opaque marker", () => {
    const overlay = selectionOverlayStyle(projection) as unknown as { cartoon: { opacity: number }; stick: { opacity: number } };
    expect(overlay.cartoon.opacity).toBe(1);
    expect(overlay.stick.opacity).toBe(1);
    expect(selectionDeemphasisStyleFor(projection)).toEqual({});
  });

  it("B4: element schemes colour cartoon carbons by chain, heteroatoms by element", () => {
    const color = { ...projection.color, mode: "classic-cpk" as const };
    const carbon = resolveProjectedAtomColor(color, "cartoon", structure.atoms[0], structure).color;
    expect(carbon).not.toBe("#909090");
    expect(carbon).toBe(resolveProjectedAtomColor({ ...color, mode: "chain" }, "cartoon", structure.atoms[0], structure).color);
    expect(resolveProjectedAtomColor(color, "sticks", structure.atoms[0], structure).color).not.toBe(carbon);
  });

  it("B4: formal charge without data surfaces its diagnostic", () => {
    expect(setColorScheme(projection, "by-formal-charge", structure).colorDiagnostic).toContain("FORMAL_CHARGE_UNKNOWN");
  });
});
