import { describe, expect, it } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { applyRepresentationOperation, createDefaultRenderProjection, REPRESENTATION_MASKS, REPRESENTATION_PRESETS, setColorScheme, setInteractionState, setProjectionStyle } from "./presentationState";

const structure = {
  id: "structure_test",
  name: "test",
  format: "pdb",
  source: { kind: "LOCAL_FILE", originalFilename: "test.pdb", format: "pdb", sha256: "a".repeat(64), byteLength: 1, ingestedAt: "2026-01-01T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 2, residues: 1, chains: 1, polymerAtoms: 2, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
  atoms: [
    { stableId: "a", serial: 1, atomName: "CA", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 0, y: 0, z: 0, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
    { stableId: "b", serial: 2, atomName: "C", element: "C", residueName: "ALA", residueNumber: 1, chain: "A", x: 1, y: 1, z: 1, recordType: "ATOM", isPolymer: true, isLigand: false, isWater: false, isIon: false },
  ],
  bonds: [],
  hierarchy: { chainIds: [], chains: {}, residues: {} },
  scientificHash: "b".repeat(64),
} satisfies CanonicalMolecularStructure;

describe("G1B renderer-neutral presentation state", () => {
  it("starts new structures with a clear ordered-polymer color presentation", () => {
    expect(createDefaultRenderProjection().color.mode).toBe("rainbow");
  });

  it("keeps licorice and ball-and-stick as distinct canonical masks", () => {
    expect(REPRESENTATION_PRESETS.LICORICE).not.toBe(REPRESENTATION_PRESETS.BALL_AND_STICK);
    expect(REPRESENTATION_PRESETS.LICORICE & REPRESENTATION_MASKS.NB_SPHERES).toBeTruthy();
    expect(REPRESENTATION_PRESETS.BALL_AND_STICK & REPRESENTATION_MASKS.SPHERES).toBeTruthy();
  });

  it("applies show, hide and show_as to stable IDs only", () => {
    const state = createDefaultRenderProjection(structure).representationState;
    const shown = applyRepresentationOperation(state, "SHOW", REPRESENTATION_MASKS.SPHERES, ["a"]);
    expect(shown.atomRepMasks.a & REPRESENTATION_MASKS.SPHERES).toBeTruthy();
    expect(shown.atomRepMasks.b).toBe(state.atomRepMasks.b);
    const hidden = applyRepresentationOperation(shown, "HIDE", REPRESENTATION_MASKS.CARTOON, ["a"]);
    expect(hidden.atomRepMasks.a & REPRESENTATION_MASKS.SPHERES).toBeTruthy();
    const replaced = applyRepresentationOperation(hidden, "SHOW_AS", REPRESENTATION_MASKS.STICKS, ["a"]);
    expect(replaced.atomRepMasks.a).toBe(REPRESENTATION_MASKS.STICKS);
    expect(replaced.atomRepMasks.b).toBe(state.atomRepMasks.b);
    expect(replaced.atomRepStyles.a).toBe(state.atomRepStyles.a);
  });

  it("keeps transient inspection and measurement picks separate from persistent selection", () => {
    const projection = createDefaultRenderProjection(structure);
    const next = setInteractionState(projection, { pickedAtomId: "a", selectedAtomIds: ["a", "b"], measurementPickAtomIds: ["b"] });
    expect(next.interaction.pickedAtomId).toBe("a");
    expect(next.interaction.selectedAtomIds).toEqual(["a", "b"]);
    expect(next.interaction.measurementPickAtomIds).toEqual(["b"]);
    const clearedTransient = setInteractionState(next, { pickedAtomId: null, measurementPickAtomIds: [] });
    expect(clearedTransient.interaction.selectedAtomIds).toEqual(["a", "b"]);
  });

  it("rebuilds masks from canonical atoms without changing the structure", () => {
    const projection = createDefaultRenderProjection(structure);
    const next = setProjectionStyle(projection, structure, "ball-and-stick");
    expect(next.representationState.atomRepMasks.a).toBe(REPRESENTATION_PRESETS.BALL_AND_STICK);
    expect(structure.scientificHash).toBe("b".repeat(64));
  });

  it("reports incomplete partial-charge metadata before rendering", () => {
    const projection = createDefaultRenderProjection(structure);
    const incomplete = { ...structure, partialChargeDataset: {
      datasetId: "charges:v1",
      molecularRevision: structure.scientificHash,
      chargeModel: "fixture",
      profileVersion: "v1",
      atomChargeMap: { a: -0.4, b: 0.4 },
      units: "",
      provenance: "fixture",
    } };
    expect(setColorScheme(projection, "by-partial-charge", incomplete).colorDiagnostic).toContain("Partial-charge");
  });
});
