import {
  createViewer,
  type AtomSelectionSpec,
  type AtomSpec,
  type AtomStyleSpec,
  type GLViewer,
} from "3dmol";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { colorRegistry } from "./colorRegistry";
import {
  DEFAULT_CAMERA,
  type CameraState,
  type RenderProjection,
} from "./renderProjection";
import { buildRenderProjectionDiagnostics, emptyRenderProjectionDiagnostics, type RenderProjectionDiagnostics } from "./renderDirectives";

const selection = (predicate: (atom: AtomSpec) => boolean): AtomSelectionSpec => ({ predicate });
const mountedAdapters = new WeakMap<HTMLElement, ThreeDMolViewerAdapter>();

type Viewport = NonNullable<CameraState["viewport"]>;

type StyleRepresentation = "lines" | "sticks" | "spheres" | "cartoon" | "licorice";
type StyleProfile = "default" | "water" | "nonbonded" | "ball";

const styleFor = (representation: StyleRepresentation, color: RenderProjection["color"], profile: StyleProfile = "default"): AtomStyleSpec => {
  const colorScheme = color.mode === "element" ? "Jmol" : color.mode === "chain" ? "chain" : color.mode === "residue" ? "amino" : color.mode === "secondary-structure" ? "ssPyMol" : undefined;
  const explicitColor = colorRegistry.cssColor(color);
  const atomColor = explicitColor ? { color: explicitColor } : colorScheme ? { colorscheme: colorScheme } : { colorscheme: "Jmol" };
  switch (representation) {
    case "lines":
      return { line: { linewidth: 1, ...atomColor } } as AtomStyleSpec;
    case "sticks":
      return { stick: { radius: 0.16, ...atomColor } } as AtomStyleSpec;
    case "spheres":
      return { sphere: { scale: profile === "water" ? 0.18 : profile === "nonbonded" ? 0.15 : profile === "ball" ? 0.28 : 0.3, ...atomColor } } as AtomStyleSpec;
    case "cartoon":
      return {
        cartoon: {
          ...(explicitColor ? { color: explicitColor } : { colorscheme: colorScheme ?? "spectrum" }),
          arrows: true,
          opacity: 0.92,
        },
      } as AtomStyleSpec;
    case "licorice":
      return { stick: { radius: 0.23, ...atomColor } } as AtomStyleSpec;
  }
};

export class ThreeDMolViewerAdapter {
  private viewer: GLViewer | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hasModel = false;
  private structure: CanonicalMolecularStructure | null = null;
  private projection: RenderProjection | null = null;
  private viewport: Viewport = { width: 0, height: 0, visibleTop: 0, visibleBottom: 0, visibleLeft: 0, visibleRight: 0 };
  private appliedViewportShift = { x: 0, y: 0 };
  private centeredView: number[] | null = null;
  private cameraState: CameraState = DEFAULT_CAMERA;
  private diagnostics: RenderProjectionDiagnostics = emptyRenderProjectionDiagnostics();

  mount(container: HTMLElement): void {
    if (this.viewer && this.container === container) return;
    const mountedAdapter = mountedAdapters.get(container);
    if (mountedAdapter && mountedAdapter !== this) mountedAdapter.destroy();
    if (this.viewer) this.destroy();
    this.container = container;
    mountedAdapters.set(container, this);
    this.viewer = createViewer(container, { backgroundColor: "#05070a", antialias: true, disableFog: true, cartoonQuality: 8 });
    this.resizeObserver = new ResizeObserver(() => {
      this.viewer?.resize();
      this.viewer?.render();
    });
    this.resizeObserver.observe(container);
  }

  load(result: StructureLoadResult, projection: RenderProjection): void {
    this.ensureMounted();
    this.structure = result.structure;
    this.viewer!.removeAllModels();
    // Do not let 3Dmol infer bonds from coordinates. Canonical backend bonds
    // are the only scientific topology allowed to drive stick cylinders.
    this.viewer!.addModel(result.renderSource.content, result.renderSource.format === "mmcif" ? "cif" : "pdb", { assignBonds: false });
    this.hasModel = true;
    this.setProjection(projection);
    this.frameToCanonicalBounds();
    if (projection.camera.view) {
      this.cameraState = projection.camera;
      this.viewer!.setView(projection.camera.view);
      this.appliedViewportShift = { x: 0, y: 0 };
      this.applyViewportTranslation();
    }
    this.viewer!.render();
  }

  setProjection(projection: RenderProjection): void {
    this.ensureMounted();
    this.projection = projection;
    this.cameraState = projection.camera;
    this.viewer!.setBackgroundColor(projection.background.color, 1);
    if (!this.hasModel) {
      this.diagnostics = emptyRenderProjectionDiagnostics(projection.representationState.presentationRevision);
      this.writeDiagnostics(this.diagnostics);
      this.viewer!.render();
      return;
    }
    this.applyProjection(projection);
    this.viewer!.render();
  }

  setViewport(viewport: Viewport): void {
    const dimensionsChanged = viewport.width !== this.viewport.width || viewport.height !== this.viewport.height;
    this.viewport = viewport;
    this.cameraState = { ...this.cameraState, viewport };
    if (!this.viewer || !this.hasModel) return;
    this.viewer.resize();
    if (dimensionsChanged) this.frameToCanonicalBounds();
    this.applyViewportTranslation();
    this.viewer.render();
  }

  getCameraState(): CameraState {
    return { ...this.cameraState, view: this.viewer?.getView() ?? this.cameraState.view, viewport: this.viewport };
  }

  resize(): void {
    this.viewer?.resize();
    this.viewer?.render();
  }

  rotate(angle = 15): void {
    this.viewer?.rotate(angle, "y");
    this.renderCamera();
  }

  pan(x = 70, y = 0): void {
    this.viewer?.translate(x, y);
    this.renderCamera();
  }

  zoom(factor = 1.2): void {
    this.viewer?.zoom(factor);
    this.renderCamera();
  }

  focus(): void {
    if (!this.viewer || !this.hasModel) return;
    this.frameToCanonicalBounds();
    this.renderCamera();
  }

  destroy(): void {
    if (this.container && mountedAdapters.get(this.container) === this) mountedAdapters.delete(this.container);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.viewer) {
      this.viewer.clear();
      this.viewer = null;
    }
    this.container?.replaceChildren();
    this.container = null;
    this.hasModel = false;
    this.structure = null;
    this.projection = null;
    this.centeredView = null;
    this.cameraState = DEFAULT_CAMERA;
    this.diagnostics = emptyRenderProjectionDiagnostics();
  }

  getDiagnostics(): RenderProjectionDiagnostics {
    return this.diagnostics;
  }

  private ensureMounted(): void {
    if (!this.viewer) throw new Error("3Dmol viewer adapter is not mounted.");
  }

  private canonicalSelection(predicate: (atom: CanonicalMolecularStructure["atoms"][number]) => boolean): AtomSelectionSpec {
    const canonical = this.structure!.atoms;
    const indices = new Set(canonical.map((atom, index) => predicate(atom) ? index : -1).filter((index) => index >= 0));
    const serials = new Set(canonical.filter(predicate).map((atom) => atom.serial));
    // Stable IDs and canonical topology are the authority. The array index below
    // is an ephemeral adapter mapping used only to address the renderer model.
    return selection((atom) => (atom.index !== undefined && indices.has(atom.index)) || (atom.serial !== undefined && serials.has(atom.serial)));
  }

  private applyProjection(projection: RenderProjection): void {
    const viewer = this.viewer!;
    const diagnostics = buildRenderProjectionDiagnostics(this.structure, projection);
    this.diagnostics = diagnostics;
    this.writeDiagnostics(diagnostics);
    viewer.setStyle({}, {});
    for (const directive of diagnostics.directives) {
      const targetIds = new Set(directive.targetStableAtomIds);
      const target = this.canonicalSelection((atom) => targetIds.has(atom.stableId));
      if (directive.primitive === "line") viewer.addStyle(target, styleFor("lines", projection.color));
      if (directive.primitive === "stick") viewer.addStyle(target, styleFor(projection.representation === "licorice" ? "licorice" : "sticks", projection.color));
      if (directive.representation === "SPHERES") viewer.addStyle(target, styleFor("spheres", projection.color, projection.representation === "ball-and-stick" ? "ball" : "default"));
      if (directive.representation === "NB_SPHERES") viewer.addStyle(target, styleFor("spheres", projection.color, "nonbonded"));
      if (directive.primitive === "cartoon") viewer.addStyle(target, styleFor("cartoon", projection.color));
    }
    // Water visibility is a layer concern, while this smaller sphere profile is
    // purely presentation. It cannot change canonical coordinates or topology.
    if (diagnostics.waterSphereContributors > 0) {
      viewer.addStyle(this.canonicalSelection((atom) => atom.isWater), styleFor("spheres", projection.color, "water"));
    }
  }

  private writeDiagnostics(diagnostics: RenderProjectionDiagnostics): void {
    if (!this.container) return;
    this.container.dataset.rendererSpherePrimitives = String(diagnostics.sphereContributors);
    this.container.dataset.rendererStickCylinders = String(diagnostics.stickCylinderContributors);
    this.container.dataset.rendererLineSegments = String(diagnostics.lineContributors);
    this.container.dataset.rendererCartoonContributors = String(diagnostics.cartoonContributors);
    this.container.dataset.rendererWaterSpheres = String(diagnostics.waterSphereContributors);
    this.container.dataset.rendererIonSpheres = String(diagnostics.ionSphereContributors);
    this.container.dataset.rendererCanonicalBondSource = diagnostics.stickCylinderContributors > 0 ? "canonical" : "none";
  }

  private frameToCanonicalBounds(): void {
    if (!this.viewer || !this.structure) return;
    this.viewer.resize();
    const all = this.canonicalSelection(() => true);
    // The selection addresses all canonical atom occurrences; zoomTo/center are
    // renderer operations over that projection, never the source of truth.
    this.viewer.center(all);
    this.viewer.zoomTo(all);
    this.centeredView = this.viewer.getView();
    this.appliedViewportShift = { x: 0, y: 0 };
    this.applyViewportTranslation();
    this.cameraState = { ...this.cameraState, view: this.viewer.getView(), defaultView: this.viewer.getView(), viewport: this.viewport };
  }

  private applyViewportTranslation(): void {
    if (!this.viewer || !this.viewport.width || !this.viewport.height) return;
    const targetX = (this.viewport.visibleLeft + this.viewport.visibleRight - this.viewport.width) / 2;
    const targetY = (this.viewport.visibleTop + this.viewport.visibleBottom - this.viewport.height) / 2;
    const deltaX = targetX - this.appliedViewportShift.x;
    const deltaY = targetY - this.appliedViewportShift.y;
    if (deltaX || deltaY) this.viewer.translate(deltaX, deltaY);
    this.appliedViewportShift = { x: targetX, y: targetY };
    this.cameraState = { ...this.cameraState, view: this.viewer.getView(), viewport: this.viewport };
  }

  private renderCamera(): void {
    if (!this.viewer) return;
    this.cameraState = { ...this.cameraState, view: this.viewer.getView(), viewport: this.viewport };
    this.viewer.render();
  }
}
