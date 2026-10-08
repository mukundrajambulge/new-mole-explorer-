import { afterEach, expect, it, vi } from "vitest";
import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { createDefaultRenderProjection } from "./presentationState";
import { hoverStore } from "./hoverStore";

vi.mock("3dmol", () => ({ createViewer: vi.fn(), Vector2: class {} }));
import { ThreeDMolViewerAdapter } from "./ThreeDMolViewerAdapter";

const structure = { id: "s", atoms: [{ stableId: "A1", x: 1, y: 2, z: 3 }, { stableId: "A2", x: 4, y: 5, z: 6 }], hierarchy: { residues: {}, chains: {} } } as unknown as CanonicalMolecularStructure;
const makeViewer = () => {
  const shapes: object[] = [];
  return { shapes, viewer: { addSphere: vi.fn((spec: object) => { const s = { spec }; shapes.push(s); return s; }), removeShape: vi.fn((s: object) => { const i = shapes.indexOf(s); if (i >= 0) shapes.splice(i, 1); }), render: vi.fn() } };
};
afterEach(() => hoverStore.set(null));

it("draws the hover marker from a pre-built index and survives a re-projection", () => {
  const { shapes, viewer } = makeViewer();
  const adapter = new ThreeDMolViewerAdapter();
  Object.assign(adapter, { viewer, structure, projection: createDefaultRenderProjection() });
  const internal = adapter as unknown as { prepareHoverIndex(): void; projectHoverMarker(): void; projectInteractionHighlights(p: unknown): void; hoverShapes: object[] };
  internal.prepareHoverIndex();
  hoverStore.set("A2");
  internal.projectHoverMarker();
  expect(shapes).toHaveLength(1);
  expect(viewer.addSphere).toHaveBeenLastCalledWith(expect.objectContaining({ center: { x: 4, y: 5, z: 6 } }));
  // Re-projection (selection/pick change) must redraw the marker while the pointer stays on the atom.
  internal.projectInteractionHighlights(createDefaultRenderProjection());
  expect(shapes).toHaveLength(1);
  // A model reload clears 3Dmol shapes; stale handles are dropped and the marker is redrawn.
  shapes.length = 0; internal.hoverShapes = [{}];
  internal.projectInteractionHighlights(createDefaultRenderProjection());
  expect(shapes).toHaveLength(1);
});

it("hover lookups do not rebuild the index per event", () => {
  const { viewer } = makeViewer();
  const adapter = new ThreeDMolViewerAdapter();
  Object.assign(adapter, { viewer, structure, projection: createDefaultRenderProjection() });
  const internal = adapter as unknown as { prepareHoverIndex(): void; hoverSources: WeakMap<object, Map<string, unknown>>; hoverCoordinate(id: string): unknown };
  internal.prepareHoverIndex();
  const built = internal.hoverSources.get(structure)!.get("");
  expect(built).toBeDefined();
  const iter = vi.spyOn(structure.atoms, Symbol.iterator);
  for (let i = 0; i < 100; i++) expect(internal.hoverCoordinate(i % 2 ? "A1" : "A2")).not.toBeNull();
  expect(iter).not.toHaveBeenCalled();
  expect(internal.hoverSources.get(structure)!.get("")).toBe(built);
});
