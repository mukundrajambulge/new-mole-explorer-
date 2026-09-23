import { expect, it, vi } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { createDefaultRenderProjection } from "./presentationState";

vi.mock("3dmol", () => ({ createViewer: vi.fn(), Vector2: class {} }));
import { ThreeDMolViewerAdapter } from "./ThreeDMolViewerAdapter";

it("preserves mesh material when selection emphasis is applied and cleared", () => {
  const structure = { atoms: [], hierarchy: { residues: {}, chains: {} } } as unknown as CanonicalMolecularStructure;
  const projection = createDefaultRenderProjection();
  projection.representationState.parameters.meshWidth = 2;
  projection.representationState.parameters.meshOpacity = 0.8;
  const setSurfaceMaterialStyle = vi.fn();
  const adapter = new ThreeDMolViewerAdapter();
  Object.assign(adapter, {
    viewer: { setSurfaceMaterialStyle }, structure, projection,
    surfaceIds: [17], surfaceKinds: ["mesh"],
  });
  const emphasis = adapter as unknown as { projectSurfaceSelectionEmphasis(active: boolean): void };
  emphasis.projectSurfaceSelectionEmphasis(true);
  expect(setSurfaceMaterialStyle).toHaveBeenLastCalledWith(17, expect.objectContaining({ wireframe: true, wireframeLinewidth: 2, opacity: 0.46, colorscheme: expect.any(Object) }));
  emphasis.projectSurfaceSelectionEmphasis(false);
  expect(setSurfaceMaterialStyle).toHaveBeenLastCalledWith(17, expect.objectContaining({ wireframe: true, wireframeLinewidth: 2, opacity: 0.8 }));
  Object.assign(adapter, {
    workspaceObjects: [{}],
    workspaceSurfaceEntries: () => [{ key: "object:state", projection, structure }],
    workspaceSurfaceHandles: new Map([["object:state", { surfaceIds: [23], surfaceKinds: ["mesh"], dotSurfaceShapes: [] }]]),
  });
  emphasis.projectSurfaceSelectionEmphasis(true);
  expect(setSurfaceMaterialStyle).toHaveBeenLastCalledWith(23, expect.objectContaining({ wireframe: true, opacity: 0.46 }));
  emphasis.projectSurfaceSelectionEmphasis(false);
  expect(setSurfaceMaterialStyle).toHaveBeenLastCalledWith(23, expect.objectContaining({ wireframe: true, opacity: 0.8 }));
});
