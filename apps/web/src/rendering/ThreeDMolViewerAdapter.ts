import { createViewer, type AtomSelectionSpec, type AtomSpec, type AtomStyleSpec, type GLViewer } from "3dmol";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { colorRegistry } from "./colorRegistry";
import { resolveAtomColor } from "./colorSchemes";
import { DEFAULT_CAMERA, type CameraState, type RenderProjection } from "./renderProjection";
import { buildRenderProjectionDiagnostics, emptyRenderProjectionDiagnostics, type RenderProjectionDiagnostics } from "./renderDirectives";

const mountedAdapters = new WeakMap<HTMLElement, ThreeDMolViewerAdapter>();
type Viewport = NonNullable<CameraState["viewport"]>;
type StyleRepresentation = "lines" | "sticks" | "spheres" | "cartoon" | "licorice" | "cross";
type StyleProfile = "default" | "water" | "nonbonded" | "ball" | "space";

const styleFor = (representation: StyleRepresentation, projection: RenderProjection, structure: CanonicalMolecularStructure, profile: StyleProfile = "default"): AtomStyleSpec => {
  const explicitColor = colorRegistry.cssColor(projection.color);
  const colorfunc = (atom: AtomSpec) => {
    const stableId = typeof atom.properties?.canonicalStableId === "string" ? atom.properties.canonicalStableId : undefined;
    const canonical = stableId ? structure.atoms.find((candidate) => candidate.stableId === stableId) : undefined;
    return canonical ? resolveAtomColor(projection.color.mode, canonical, structure, projection.color.customHex).color : explicitColor ?? "#7f8791";
  };
  const atomColor = explicitColor ? { color: explicitColor } : { colorfunc };
  switch (representation) {
    case "lines": return { line: { linewidth: 1, ...atomColor } } as AtomStyleSpec;
    case "sticks": return { stick: { radius: 0.16, ...atomColor } } as AtomStyleSpec;
    case "spheres": return { sphere: { scale: profile === "water" ? 0.18 : profile === "nonbonded" ? 0.15 : profile === "ball" ? 0.28 : profile === "space" ? 1 : 0.3, ...atomColor } } as AtomStyleSpec;
    case "cross": return { cross: { scale: 0.35, radius: 0.12, ...atomColor } } as AtomStyleSpec;
    case "cartoon": {
      const cartoonStyle = projection.representation === "ribbon" ? "oval" : projection.representation === "trace" ? "trace" : projection.representation === "putty" ? "putty" : undefined;
      return { cartoon: { ...(cartoonStyle ? { style: cartoonStyle } : {}), ...atomColor, arrows: true, opacity: 0.92 } } as AtomStyleSpec;
    }
    case "licorice": return { stick: { radius: 0.23, ...atomColor } } as AtomStyleSpec;
  }
};

const orderNumber = (order: CanonicalMolecularStructure["bonds"][number]["order"]): number => order === "DOUBLE" ? 2 : order === "TRIPLE" ? 3 : order === "AROMATIC" ? 4 : 1;
const secondaryCode = (value: CanonicalMolecularStructure["atoms"][number]["secondaryStructure"]): string | undefined => value === "HELIX" ? "h" : value === "SHEET" ? "s" : value === "LOOP" ? "c" : undefined;

export class ThreeDMolViewerAdapter {
  private viewer: GLViewer | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hasModel = false;
  private structure: CanonicalMolecularStructure | null = null;
  private projection: RenderProjection | null = null;
  private viewport: Viewport = { width: 0, height: 0, visibleTop: 0, visibleBottom: 0, visibleLeft: 0, visibleRight: 0 };
  private appliedViewportShift = { x: 0, y: 0 };
  private cameraState: CameraState = DEFAULT_CAMERA;
  private diagnostics: RenderProjectionDiagnostics = emptyRenderProjectionDiagnostics();
  private modelLoadCount = 0;

  mount(container: HTMLElement): void {
    if (this.viewer && this.container === container) return;
    const mountedAdapter = mountedAdapters.get(container);
    if (mountedAdapter && mountedAdapter !== this) mountedAdapter.destroy();
    if (this.viewer) this.destroy();
    this.container = container;
    mountedAdapters.set(container, this);
    this.viewer = createViewer(container, { backgroundColor: "#05070a", antialias: true, disableFog: true, cartoonQuality: 8 });
    this.resizeObserver = new ResizeObserver(() => { this.viewer?.resize(); this.viewer?.render(); });
    this.resizeObserver.observe(container);
  }

  load(result: StructureLoadResult, projection: RenderProjection): void {
    this.ensureMounted();
    this.structure = result.structure;
    this.viewer!.removeAllModels();
    const renderModel = this.viewer!.addModel();
    const adjacency = new Map<string, Array<{ index: number; order: number }>>();
    result.structure.bonds.forEach((bond) => {
      const atom1 = result.structure.atoms.findIndex((atom) => atom.stableId === bond.atom1);
      const atom2 = result.structure.atoms.findIndex((atom) => atom.stableId === bond.atom2);
      if (atom1 < 0 || atom2 < 0) return;
      adjacency.set(bond.atom1, [...(adjacency.get(bond.atom1) ?? []), { index: atom2, order: orderNumber(bond.order) }]);
      adjacency.set(bond.atom2, [...(adjacency.get(bond.atom2) ?? []), { index: atom1, order: orderNumber(bond.order) }]);
    });
    const atoms: AtomSpec[] = result.structure.atoms.map((atom, index) => ({
      index,
      serial: atom.serial,
      atom: atom.atomName,
      elem: atom.element,
      resn: atom.residueName,
      resi: atom.residueNumber,
      icode: atom.insertionCode,
      chain: atom.chain,
      x: atom.x,
      y: atom.y,
      z: atom.z,
      hetflag: atom.recordType === "HETATM",
      b: atom.bFactor ?? undefined,
      ss: secondaryCode(atom.secondaryStructure),
      bonds: (adjacency.get(atom.stableId) ?? []).map((entry) => entry.index),
      bondOrder: (adjacency.get(atom.stableId) ?? []).map((entry) => entry.order),
      properties: { canonicalStableId: atom.stableId, formal_charge: atom.formalCharge, partial_charge: undefined },
    }));
    renderModel.addAtoms(atoms);
    this.modelLoadCount += 1;
    this.hasModel = true;
    this.setProjection(projection);
    this.frameToCanonicalBounds();
    if (projection.camera.view) { this.cameraState = projection.camera; this.viewer!.setView(projection.camera.view); this.appliedViewportShift = { x: 0, y: 0 }; this.applyViewportTranslation(); }
    this.viewer!.render();
  }

  setProjection(projection: RenderProjection): void {
    this.ensureMounted();
    this.projection = projection;
    this.cameraState = projection.camera;
    this.viewer!.setBackgroundColor(projection.background.color, 1);
    if (!this.hasModel || !this.structure) { this.diagnostics = emptyRenderProjectionDiagnostics(projection.representationState.presentationRevision, projection); this.writeDiagnostics(this.diagnostics); this.viewer!.render(); return; }
    this.applyProjection(projection);
    this.viewer!.render();
  }

  setViewport(viewport: Viewport): void { const changed = viewport.width !== this.viewport.width || viewport.height !== this.viewport.height; this.viewport = viewport; this.cameraState = { ...this.cameraState, viewport }; if (!this.viewer || !this.hasModel) return; this.viewer.resize(); if (changed) this.frameToCanonicalBounds(); this.applyViewportTranslation(); this.viewer.render(); }
  getCameraState(): CameraState { return { ...this.cameraState, view: this.viewer?.getView() ?? this.cameraState.view, viewport: this.viewport }; }
  resize(): void { this.viewer?.resize(); this.viewer?.render(); }
  rotate(angle = 15): void { this.viewer?.rotate(angle, "y"); this.renderCamera(); }
  pan(x = 70, y = 0): void { this.viewer?.translate(x, y); this.renderCamera(); }
  zoom(factor = 1.2): void { this.viewer?.zoom(factor); this.renderCamera(); }
  focus(): void { if (!this.viewer || !this.hasModel) return; this.frameToCanonicalBounds(); this.renderCamera(); }

  destroy(): void {
    if (this.container && mountedAdapters.get(this.container) === this) mountedAdapters.delete(this.container);
    this.resizeObserver?.disconnect(); this.resizeObserver = null;
    if (this.viewer) { this.viewer.clear(); this.viewer = null; }
    this.container?.replaceChildren(); this.container = null; this.hasModel = false; this.structure = null; this.projection = null; this.cameraState = DEFAULT_CAMERA; this.diagnostics = emptyRenderProjectionDiagnostics();
  }
  getDiagnostics(): RenderProjectionDiagnostics { return this.diagnostics; }

  private ensureMounted(): void { if (!this.viewer) throw new Error("3Dmol viewer adapter is not mounted."); }
  private canonicalSelection(predicate: (atom: CanonicalMolecularStructure["atoms"][number]) => boolean): AtomSelectionSpec { const indices = new Set(this.structure!.atoms.map((atom, index) => predicate(atom) ? index : -1).filter((index) => index >= 0)); return { predicate: (atom) => atom.index !== undefined && indices.has(atom.index) }; }

  private applyProjection(projection: RenderProjection): void {
    const viewer = this.viewer!; const structure = this.structure!; const diagnostics = buildRenderProjectionDiagnostics(structure, projection); this.diagnostics = diagnostics; this.writeDiagnostics(diagnostics); viewer.setStyle({}, {});
    for (const directive of diagnostics.directives) {
      const target = this.canonicalSelection((atom) => directive.targetStableAtomIds.includes(atom.stableId));
      if (directive.primitive === "line") viewer.addStyle(target, styleFor("lines", projection, structure));
      if (directive.primitive === "stick") viewer.addStyle(target, styleFor(projection.representation === "licorice" ? "licorice" : "sticks", projection, structure));
      if (directive.primitive === "sphere") viewer.addStyle(target, styleFor("spheres", projection, structure, projection.representation === "ball-and-stick" ? "ball" : projection.representation === "space-filling" || projection.representation === "spheres" ? "space" : directive.representation === "NB_SPHERES" ? "nonbonded" : "default"));
      if (directive.primitive === "cross") viewer.addStyle(target, styleFor("cross", projection, structure));
      if (directive.primitive === "cartoon" && !(projection.representation === "putty" && diagnostics.puttyContributors === 0)) viewer.addStyle(target, styleFor("cartoon", projection, structure));
    }
    if (diagnostics.waterSphereContributors > 0) viewer.addStyle(this.canonicalSelection((atom) => atom.isWater), styleFor("spheres", projection, structure, "water"));
    const colorDiagnostics = structure.atoms.map((atom) => resolveAtomColor(projection.color.mode, atom, structure, projection.color.customHex).diagnostic).filter((value): value is string => Boolean(value));
    const colorDiagnostic = projection.colorDiagnostic ?? colorDiagnostics[0] ?? null;
    this.diagnostics = { ...this.diagnostics, colorDiagnostic };
    this.writeDiagnostics(this.diagnostics);
  }

  private writeDiagnostics(diagnostics: RenderProjectionDiagnostics): void {
    if (!this.container) return;
    this.container.dataset.rendererSpherePrimitives = String(diagnostics.sphereContributors);
    this.container.dataset.rendererStickCylinders = String(diagnostics.stickCylinderContributors);
    this.container.dataset.rendererLineSegments = String(diagnostics.lineContributors);
    this.container.dataset.rendererCartoonContributors = String(diagnostics.cartoonContributors);
    this.container.dataset.rendererRibbonContributors = String(diagnostics.ribbonContributors);
    this.container.dataset.rendererTraceContributors = String(diagnostics.traceContributors);
    this.container.dataset.rendererPuttyContributors = String(diagnostics.puttyContributors);
    this.container.dataset.rendererCrossContributors = String(diagnostics.crossContributors);
    this.container.dataset.rendererWaterSpheres = String(diagnostics.waterSphereContributors);
    this.container.dataset.rendererIonSpheres = String(diagnostics.ionSphereContributors);
    this.container.dataset.rendererCanonicalBondSource = diagnostics.stickCylinderContributors > 0 || diagnostics.lineContributors > 0 ? "canonical" : "none";
    this.container.dataset.rendererModelLoads = String(this.modelLoadCount);
    this.container.dataset.rendererStyleProfile = diagnostics.styleProfile;
    if (diagnostics.colorDiagnostic) this.container.dataset.colorDiagnostic = diagnostics.colorDiagnostic; else delete this.container.dataset.colorDiagnostic;
    if ((this.projection?.representation === "lines" || this.projection?.representation === "sticks") && this.structure?.bonds.length === 0) this.container.dataset.rendererBondDiagnostic = "No authoritative bond geometry is available for this target."; else delete this.container.dataset.rendererBondDiagnostic;
  }
  private frameToCanonicalBounds(): void { if (!this.viewer || !this.structure) return; this.viewer.resize(); const all = this.canonicalSelection(() => true); this.viewer.center(all); this.viewer.zoomTo(all); this.appliedViewportShift = { x: 0, y: 0 }; this.applyViewportTranslation(); this.cameraState = { ...this.cameraState, view: this.viewer.getView(), defaultView: this.viewer.getView(), viewport: this.viewport }; }
  private applyViewportTranslation(): void { if (!this.viewer || !this.viewport.width || !this.viewport.height) return; const targetX = (this.viewport.visibleLeft + this.viewport.visibleRight - this.viewport.width) / 2; const targetY = (this.viewport.visibleTop + this.viewport.visibleBottom - this.viewport.height) / 2; const deltaX = targetX - this.appliedViewportShift.x; const deltaY = targetY - this.appliedViewportShift.y; if (deltaX || deltaY) this.viewer.translate(deltaX, deltaY); this.appliedViewportShift = { x: targetX, y: targetY }; this.cameraState = { ...this.cameraState, view: this.viewer.getView(), viewport: this.viewport }; }
  private renderCamera(): void { if (!this.viewer) return; this.cameraState = { ...this.cameraState, view: this.viewer.getView(), viewport: this.viewport }; this.viewer.render(); }
}
