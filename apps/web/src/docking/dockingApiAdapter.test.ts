import { afterEach, describe, expect, it, vi } from "vitest";
import { dockingApiAdapter } from "./dockingApiAdapter";

afterEach(() => vi.unstubAllGlobals());

const loadResult = {
  structure: { id: "structure:test", name: "test", format: "pdbqt", source: { originalFilename: "ligand.pdbqt", sha256: "sha256:source", byteLength: 1 }, counts: { atoms: 1, residues: 1, chains: 1, polymerAtoms: 0, ligandAtoms: 1, waterAtoms: 0, ionAtoms: 0, otherAtoms: 0 }, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, atoms: [], bonds: [], hierarchy: { chainIds: [], chains: {}, residues: {} }, scientificHash: "sha256:structure" },
  renderSource: { format: "pdbqt", content: "" },
} as never;

describe("UI-D0 D2 API adapter", () => {
  it("preserves PDBQT non-authority from the backend response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "VALID", diagnostics: [{ code: "PDBQT_NOT_IDENTITY_AUTHORITY", severity: "WARNING", blocking: false, message: "PDBQT is execution evidence." }], value: { sourceFormat: "pdbqt", sourceArtifactId: "source:test", sourceArtifactDigest: "sha256:source", coordinateStates: [{ stateId: "coordinates:test", coordinateFrame: "receptor-source-frame", digest: "sha256:coordinates" }], authoritativeForMolecularIdentity: false, executionRepresentation: { format: "pdbqt", authoritativeForMolecularIdentity: false, artifactByteDigest: "sha256:source" }, diagnostics: ["PDBQT_NOT_IDENTITY_AUTHORITY"] } }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await dockingApiAdapter.adaptStructure(loadResult);
    expect(result.snapshot?.authoritativeForMolecularIdentity).toBe(false);
    expect(result.snapshot?.identity).toBeUndefined();
    expect(result.snapshot?.executionRepresentation?.format).toBe("pdbqt");
    expect(result.diagnostics[0]?.code).toBe("PDBQT_NOT_IDENTITY_AUTHORITY");
  });

  it("maps an authoritative SearchRegion response into renderer-neutral geometry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "VALID", diagnostics: [], value: { searchRegionId: "search-region:test", preparedReceptorDigest: "sha256:receptor", coordinateStateDigest: "sha256:coordinates" }, presentation: { center: [1, 2, 3], size: [4, 5, 6], min: [-1, -1, 0], max: [3, 4, 6], units: "ANGSTROM", coordinateFrame: "receptor-source-frame", digest: "sha256:region" } }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await dockingApiAdapter.commitSearchRegion({ preparedReceptor: {}, preparedLigand: {}, coordinateFrame: "receptor-source-frame", min: [-1, -1, 0], max: [3, 4, 6], paddingAngstrom: [0, 0, 0], derivationMode: "EXPLICIT_BOUNDS", fixedAcrossLigandStates: true, bindingSiteRef: "site:test" });
    expect(result.region).toMatchObject({ digest: "sha256:region", center: [1, 2, 3], size: [4, 5, 6], coordinateFrame: "receptor-source-frame" });
  });
});
