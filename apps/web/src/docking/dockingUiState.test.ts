import { describe, expect, it } from "vitest";
import { draftForStructure, numericSearchRegionDraft, overlayForCommitted, overlayForDraft } from "./dockingUiState";

const structure = {
  id: "structure:test",
  name: "test",
  format: "pdb" as const,
  source: { kind: "LOCAL_FILE" as const, originalFilename: "test.pdb", format: "pdb" as const, sha256: "sha256:test", byteLength: 1, ingestedAt: "2026-09-20T00:00:00.000Z", parserProfile: "test" },
  counts: { atoms: 2, residues: 1, chains: 1, polymerAtoms: 2, ligandAtoms: 0, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 },
  bounds: { min: { x: -2, y: 1, z: 4 }, max: { x: 6, y: 5, z: 10 } },
  atoms: [], bonds: [], hierarchy: { chainIds: [], chains: {}, residues: {} }, scientificHash: "sha256:structure",
};

describe("UI-D0 SearchRegion presentation state", () => {
  it("derives a mutable center/size draft from source bounds", () => {
    const draft = draftForStructure(structure);
    expect(draft).toMatchObject({ centerX: "2", centerY: "3", centerZ: "7", sizeX: "8", sizeY: "4", sizeZ: "6" });
    expect(numericSearchRegionDraft(draft)).toEqual({ center: [2, 3, 7], size: [8, 4, 6] });
  });

  it("rejects nonfinite and nonpositive form values before any commit pathway", () => {
    expect(numericSearchRegionDraft({ centerX: "NaN", centerY: "0", centerZ: "0", sizeX: "1", sizeY: "1", sizeZ: "1" })).toBeNull();
    expect(numericSearchRegionDraft({ centerX: "0", centerY: "0", centerZ: "0", sizeX: "0", sizeY: "1", sizeZ: "1" })).toBeNull();
  });

  it("keeps draft and committed overlays explicitly distinct", () => {
    const draft = overlayForDraft(draftForStructure(structure), "receptor-source-frame");
    expect(draft?.kind).toBe("DRAFT");
    const committed = overlayForCommitted({ searchRegionId: "search-region:test", digest: "sha256:region", preparedReceptorDigest: "sha256:receptor", coordinateStateDigest: "sha256:coordinates", coordinateFrame: "receptor-source-frame", center: [2, 3, 7], size: [8, 4, 6], min: [-2, 1, 4], max: [6, 5, 10], units: "ANGSTROM" });
    expect(committed).toMatchObject({ kind: "COMMITTED", digest: "sha256:region", center: [2, 3, 7], size: [8, 4, 6] });
    expect(draft?.digest).toBeUndefined();
  });
});
