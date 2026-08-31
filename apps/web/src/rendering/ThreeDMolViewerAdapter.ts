import { createViewer, Vector2, type AtomSelectionSpec, type AtomSpec, type AtomStyleSpec, type GLShape, type GLViewer } from "3dmol";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { colorRegistry } from "./colorRegistry";
import { resolveAtomColor } from "./colorSchemes";
import { DEFAULT_CAMERA, type CameraState, type RenderProjection } from "./renderProjection";
import { buildRenderProjectionDiagnostics, emptyRenderProjectionDiagnostics, type RenderProjectionDiagnostics } from "./renderDirectives";
import type { RepresentationType } from "./presentationState";
import { labelPlanForState, resolveSafeLabel } from "../interaction/labels";
import { ReverseIdentityMap, type PickResult } from "../interaction/picking";
import { measurementStatus, type MeasurementObject } from "../interaction/measurements";
import { boundsForCoordinates, paddedClippingSlab, principalOrientationQuaternion, type Coordinate3, type ClippingSlab } from "./cameraController";
import { buildDotSurfacePoints } from "./surfaceGenerator";
import { SurfaceGeometryCache, SurfaceRequestCoordinator, surfaceRequestFor } from "./surfaceProfiles";
import { puttyProfileFor, puttyRadiusForResidue, puttyResidueRadii } from "./putty";

const diagnosticTypeForStyle = (style: string): RepresentationType => style === "ribbon" ? "RIBBON" : style === "putty" || style === "trace" || style === "cartoon" ? "CARTOON" : style === "nonbonded-crosses" ? "NONBONDED" : style === "nonbonded-spheres" ? "NB_SPHERES" : style === "line" ? "LINES" : style === "stick" || style === "licorice" || style === "ball-and-stick" ? "STICKS" : "SPHERES";

const mountedAdapters = new WeakMap<HTMLElement, ThreeDMolViewerAdapter>();
type Viewport = NonNullable<CameraState["viewport"]>;
type StyleRepresentation = "lines" | "sticks" | "spheres" | "cartoon" | "licorice" | "cross";
type StyleProfile = "default" | "water" | "nonbonded" | "ball" | "space" | "cartoon" | "ribbon" | "trace" | "putty";
export type ViewerInteractionHandlers = { onPick?: (result: PickResult) => void; onHover?: (result: PickResult | null) => void };

const styleFor = (representation: StyleRepresentation, projection: RenderProjection, structure: CanonicalMolecularStructure, profile: StyleProfile = "default", thicknessOverride?: number): AtomStyleSpec => {
  const explicitColor = colorRegistry.cssColor(projection.color);
  const canonicalByStableId = new Map(structure.atoms.map((atom) => [atom.stableId, atom]));
  const colorfunc = (atom: AtomSpec) => {
    const stableId = typeof atom.properties?.canonicalStableId === "string" ? atom.properties.canonicalStableId : undefined;
    const canonical = stableId ? canonicalByStableId.get(stableId) : undefined;
    const override = stableId ? projection.color.representationOverrides[stableId]?.[representation === "lines" ? "LINES" : representation === "sticks" || representation === "licorice" ? "STICKS" : representation === "spheres" || representation === "cross" ? "SPHERES" : "CARTOON"] : undefined;
    return override ?? (stableId ? projection.color.atomColors[stableId] : undefined) ?? (canonical && projection.color.mode !== "named" ? resolveAtomColor(projection.color.mode, canonical, structure, projection.color.customHex).color : explicitColor ?? "#7f8791");
  };
  const atomColor = { colorfunc };
  switch (representation) {
    case "lines": return { line: { linewidth: projection.representationState.parameters.lineWidth, opacity: projection.representationState.parameters.lineOpacity, ...atomColor } } as AtomStyleSpec;
    case "sticks": return { stick: { radius: projection.representationState.parameters.stickRadius, opacity: projection.representationState.parameters.stickOpacity, ...atomColor } } as AtomStyleSpec;
    case "spheres": return { sphere: { scale: profile === "water" ? 0.18 : profile === "nonbonded" ? 0.15 : profile === "ball" ? 0.28 : profile === "space" ? projection.representationState.parameters.sphereScale : 0.3, opacity: projection.representationState.parameters.sphereOpacity, ...atomColor } } as AtomStyleSpec;
    case "cross": return { cross: { scale: 0.35, radius: 0.12, opacity: projection.representationState.parameters.nonbondedOpacity, ...atomColor } } as AtomStyleSpec;
    case "cartoon": {
      const cartoonStyle = profile === "ribbon" ? "oval" : profile === "trace" || profile === "putty" ? "trace" : undefined;
      return { cartoon: { ...(cartoonStyle ? { style: cartoonStyle } : {}), ...atomColor, arrows: true, thickness: thicknessOverride ?? projection.representationState.parameters.cartoonThickness, opacity: profile === "ribbon" ? projection.representationState.parameters.ribbonOpacity : projection.representationState.parameters.cartoonOpacity } } as AtomStyleSpec;
    }
    case "licorice": return { stick: { radius: 0.23, opacity: projection.representationState.parameters.stickOpacity, ...atomColor } } as AtomStyleSpec;
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
  private rendererGeneration = 0;
  private readonly reverseIdentityMap = new ReverseIdentityMap();
  private interactionHandlers: ViewerInteractionHandlers = {};
  private measurementShapes: GLShape[] = [];
  private interactionShapes: GLShape[] = [];
  private dotSurfaceShapes: GLShape[] = [];
  private surfaceIds: number[] = [];
  private activeSurfaceKey: string | null = null;
  private readonly surfaceCache = new SurfaceGeometryCache<readonly { x: number; y: number; z: number; stableAtomId: string; colorElement: string }[]>();
  private readonly surfaceCoordinator = new SurfaceRequestCoordinator();
  private measurements: readonly MeasurementObject[] = [];
  private gestureFrame: number | null = null;
  private gesture: { mode: "rotate" | "pan" | "zoom"; x: number; y: number } | null = null;
  private pendingGestureDelta = { x: 0, y: 0 };
  private cameraPivot: Coordinate3 | null = null;
  private baselineView: number[] | null = null;
  private baselinePivot: Coordinate3 | null = null;
  private autoSlab: ClippingSlab = paddedClippingSlab(null);
  private lastCameraAction = "NONE";

  mount(container: HTMLElement): void {
    if (this.viewer && this.container === container) return;
    const mountedAdapter = mountedAdapters.get(container);
    if (mountedAdapter && mountedAdapter !== this) mountedAdapter.destroy();
    if (this.viewer) this.destroy();
    this.container = container;
    mountedAdapters.set(container, this);
    this.viewer = createViewer(container, { backgroundColor: "#05070a", antialias: true, disableFog: true, cartoonQuality: 8 });
    container.dataset.rendererGeneration = String(this.rendererGeneration);
    this.resizeObserver = new ResizeObserver(() => { this.viewer?.resize(); this.viewer?.render(); });
    this.resizeObserver.observe(container);
  }

  setInteractionHandlers(handlers: ViewerInteractionHandlers): void {
    this.interactionHandlers = handlers;
    if (this.viewer && this.hasModel) this.bindPicking();
  }

  load(result: StructureLoadResult, projection: RenderProjection): void {
    this.ensureMounted();
    this.structure = result.structure;
    this.rendererGeneration += 1;
    this.reverseIdentityMap.build(result.structure, this.rendererGeneration);
    if (this.container) this.container.dataset.rendererGeneration = String(this.rendererGeneration);
    this.viewer!.removeAllModels();
    this.viewer!.removeAllSurfaces();
    this.viewer!.removeAllShapes();
    this.surfaceCoordinator.invalidate();
    this.surfaceIds = [];
    this.dotSurfaceShapes = [];
    this.activeSurfaceKey = null;
    this.interactionShapes = [];
    this.hasModel = false;
    const renderModel = this.viewer!.addModel();
    const indexByStableId = new Map(result.structure.atoms.map((atom, index) => [atom.stableId, index]));
    const adjacency = new Map<string, Array<{ index: number; order: number }>>();
    result.structure.bonds.forEach((bond) => {
      const atom1 = indexByStableId.get(bond.atom1) ?? -1;
      const atom2 = indexByStableId.get(bond.atom2) ?? -1;
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
      q: atom.occupancy ?? undefined,
      alt: atom.altLoc ?? undefined,
      ss: secondaryCode(atom.secondaryStructure),
      bonds: (adjacency.get(atom.stableId) ?? []).map((entry) => entry.index),
      bondOrder: (adjacency.get(atom.stableId) ?? []).map((entry) => entry.order),
      properties: { canonicalStableId: atom.stableId, formal_charge: atom.formalCharge, partial_charge: undefined },
    }));
    renderModel.addAtoms(atoms);
    this.modelLoadCount += 1;
    this.hasModel = true;
    this.bindPicking();
    this.setProjection(projection, { preserveView: false });
    if (projection.camera.view && this.validView(projection.camera.view)) {
      this.viewer!.setView(projection.camera.view);
      this.baselineView = [...(projection.camera.defaultView && this.validView(projection.camera.defaultView) ? projection.camera.defaultView : projection.camera.view)];
      this.cameraPivot = this.boundsForCameraTarget(false)?.center ?? null;
      this.baselinePivot = this.cameraPivot ? { ...this.cameraPivot } : null;
      this.applyClipping();
      this.appliedViewportShift = { x: 0, y: 0 };
      this.applyViewportTranslation();
      this.cameraState = { ...this.cameraState, view: this.viewer!.getView(), defaultView: [...this.baselineView], viewport: this.viewport };
    } else {
      this.frameToCanonicalBounds(true);
    }
    this.viewer!.render();
  }

  setProjection(projection: RenderProjection, options: { preserveView?: boolean } = {}): void {
    this.ensureMounted();
    const preservedView = options.preserveView === false || !this.hasModel ? null : this.viewer!.getView();
    this.projection = projection;
    this.cameraState = { ...projection.camera, view: preservedView ?? projection.camera.view, defaultView: this.baselineView ? [...this.baselineView] : projection.camera.defaultView };
    this.viewer!.setBackgroundColor(projection.background.color, 1);
    this.viewer!.setProjection(projection.camera.projectionMode);
    this.viewer!.setCameraParameters({ fov: projection.camera.fov, orthographic: projection.camera.projectionMode === "orthographic" });
    if (!this.hasModel || !this.structure) { this.diagnostics = emptyRenderProjectionDiagnostics(projection.representationState.presentationRevision, projection); this.writeDiagnostics(this.diagnostics); this.viewer!.render(); return; }
    this.applyProjection(projection);
    this.applyClipping();
    this.writeDiagnostics(this.diagnostics);
    this.viewer!.render();
  }

  setViewport(viewport: Viewport): void { this.viewport = viewport; this.cameraState = { ...this.cameraState, viewport }; if (!this.viewer || !this.hasModel) return; this.viewer.resize(); this.applyViewportTranslation(); if (this.cameraState.clippingMode === "auto") this.recalculateAutoClipping(); this.viewer.render(); }
  getCameraState(): CameraState { return { ...this.cameraState, view: this.viewer?.getView() ?? this.cameraState.view, defaultView: this.baselineView ? [...this.baselineView] : this.cameraState.defaultView, viewport: this.viewport }; }
  resize(): void { this.viewer?.resize(); this.viewer?.render(); }
  rotate(angle = 15): void { if (!this.viewer) return; this.viewer.rotate(angle, "y"); this.lastCameraAction = "ROTATE"; this.renderCamera(); }
  pan(x = 70, y = 0): void { if (!this.viewer) return; this.viewer.translate(x, y); this.lastCameraAction = "PAN"; this.renderCamera(); }
  zoom(factor = 1.2): void { if (!this.viewer) return; this.viewer.zoom(factor); this.lastCameraAction = "ZOOM"; this.renderCamera(); }
  focus(): void { if (!this.viewer || !this.hasModel) return; this.lastCameraAction = "FIT"; this.frameToCanonicalBounds(false); this.renderCamera(); }
  center(): void { if (!this.viewer || !this.hasModel) return; this.lastCameraAction = "CENTER"; const target = this.boundsForCameraTarget(true); if (!target) return; this.viewer.center(target.selection); this.cameraPivot = target.center; this.recalculateAutoClipping(); this.renderCamera(); }
  orient(): void { if (!this.viewer || !this.hasModel) return; this.lastCameraAction = "ORIENT"; const target = this.boundsForCameraTarget(true); if (!target) return; this.viewer.center(target.selection); this.viewer.zoomTo(target.selection); const view = this.viewer.getView(); const quaternion = principalOrientationQuaternion(target.atoms); view[4] = quaternion[0]; view[5] = quaternion[1]; view[6] = quaternion[2]; view[7] = quaternion[3]; this.viewer.setView(view); this.cameraPivot = target.center; this.recalculateAutoClipping(); this.renderCamera(); }
  origin(): void { if (!this.viewer || !this.hasModel) return; this.lastCameraAction = "ORIGIN"; const target = this.boundsForCameraTarget(false); if (!target) return; this.viewer.center({}); this.cameraPivot = target.center; this.recalculateAutoClipping(); this.renderCamera(); }
  resetView(): void { if (!this.viewer || !this.hasModel) return; this.lastCameraAction = "RESET"; this.cameraState = { ...this.cameraState, projectionMode: DEFAULT_CAMERA.projectionMode, fov: DEFAULT_CAMERA.fov, nearClip: DEFAULT_CAMERA.nearClip, farClip: DEFAULT_CAMERA.farClip, clippingMode: "auto" }; this.viewer.setProjection(this.cameraState.projectionMode); this.viewer.setCameraParameters({ fov: this.cameraState.fov, orthographic: false }); if (this.baselineView && this.validView(this.baselineView)) { this.viewer.setView([...this.baselineView]); this.cameraPivot = this.baselinePivot ? { ...this.baselinePivot } : this.cameraPivot; this.recalculateAutoClipping(); } else this.frameToCanonicalBounds(true); this.renderCamera(); }
  setCameraControls(camera: Partial<CameraState>): void { if (!this.viewer) return; const clippingMode = camera.clippingMode ?? (camera.nearClip !== undefined || camera.farClip !== undefined ? "manual" : this.cameraState.clippingMode); this.cameraState = { ...this.cameraState, ...camera, clippingMode }; this.viewer.setProjection(this.cameraState.projectionMode); this.viewer.setCameraParameters({ fov: this.cameraState.fov, orthographic: this.cameraState.projectionMode === "orthographic" }); if (camera.view && this.validView(camera.view)) this.viewer.setView(camera.view); this.applyClipping(); this.lastCameraAction = "SET"; this.renderCamera(); }
  beginGesture(mode: "rotate" | "pan" | "zoom", x: number, y: number): void { this.pendingGestureDelta = { x: 0, y: 0 }; this.gesture = { mode, x, y }; }
  updateGesture(x: number, y: number): void {
    if (!this.gesture || !this.viewer) return;
    const dx = x - this.gesture.x; const dy = y - this.gesture.y;
    this.gesture.x = x; this.gesture.y = y;
    this.pendingGestureDelta.x += dx;
    this.pendingGestureDelta.y += dy;
    if (this.gestureFrame !== null) return;
    this.gestureFrame = window.requestAnimationFrame(() => {
      this.gestureFrame = null;
      if (!this.gesture || !this.viewer) return;
      const pending = this.pendingGestureDelta;
      this.pendingGestureDelta = { x: 0, y: 0 };
       if (this.gesture.mode === "rotate") { this.viewer.rotate(pending.x * 0.55, "y"); this.viewer.rotate(pending.y * 0.55, "x"); this.lastCameraAction = "ROTATE"; }
       else if (this.gesture.mode === "pan") this.viewer.translate(pending.x, pending.y);
       else this.viewer.zoom(Math.max(0.2, 1 + pending.y * -0.012));
      this.renderCamera();
    });
  }
  endGesture(): void { if (this.gestureFrame !== null) window.cancelAnimationFrame(this.gestureFrame); this.gestureFrame = null; this.pendingGestureDelta = { x: 0, y: 0 }; this.gesture = null; }

  destroy(): void {
    if (this.container && mountedAdapters.get(this.container) === this) mountedAdapters.delete(this.container);
    this.resizeObserver?.disconnect(); this.resizeObserver = null;
    if (this.viewer) { this.viewer.clear(); this.viewer = null; }
    this.measurementShapes = []; this.interactionShapes = []; this.dotSurfaceShapes = []; this.surfaceIds = []; this.surfaceCoordinator.invalidate(); this.activeSurfaceKey = null; this.surfaceCache.clear(); this.measurements = []; this.container?.replaceChildren(); this.container = null; this.hasModel = false; this.structure = null; this.projection = null; this.cameraState = DEFAULT_CAMERA; this.cameraPivot = null; this.baselineView = null; this.baselinePivot = null; this.autoSlab = paddedClippingSlab(null); this.lastCameraAction = "NONE"; this.interactionHandlers = {}; this.diagnostics = emptyRenderProjectionDiagnostics();
  }
  getDiagnostics(): RenderProjectionDiagnostics { return this.diagnostics; }

  private ensureMounted(): void { if (!this.viewer) throw new Error("3Dmol viewer adapter is not mounted."); }
  private canonicalSelection(predicate: (atom: CanonicalMolecularStructure["atoms"][number]) => boolean): AtomSelectionSpec { const indices = new Set(this.structure!.atoms.map((atom, index) => predicate(atom) ? index : -1).filter((index) => index >= 0)); return { predicate: (atom) => atom.index !== undefined && indices.has(atom.index) }; }

  private validView(view: number[] | null | undefined): view is number[] { return Array.isArray(view) && view.length >= 8 && view.slice(0, 8).every((value) => Number.isFinite(value)); }

  private categoryVisible(atom: CanonicalMolecularStructure["atoms"][number]): boolean {
    if (!this.projection) return true;
    if (atom.isPolymer) return this.projection.showProtein;
    if (atom.isLigand) return this.projection.showLigand;
    if (atom.isWater) return this.projection.showWater;
    if (atom.isIon) return this.projection.showIons;
    return this.projection.showOther;
  }

  private renderedAtoms(): CanonicalMolecularStructure["atoms"] {
    if (!this.structure) return [];
    const diagnostics = this.projection ? buildRenderProjectionDiagnostics(this.structure, this.projection) : null;
    const directiveIds = new Set(diagnostics?.directives.flatMap((directive) => directive.targetStableAtomIds) ?? []);
    const atoms = this.structure.atoms.filter((atom) => this.categoryVisible(atom) && (directiveIds.size === 0 || directiveIds.has(atom.stableId)));
    return atoms.length > 0 ? atoms : this.structure.atoms.filter((atom) => this.categoryVisible(atom));
  }

  private boundsForCameraTarget(preferSelection: boolean): { atoms: CanonicalMolecularStructure["atoms"]; selection: AtomSelectionSpec; center: Coordinate3 } | null {
    if (!this.structure) return null;
    const selectedIds = preferSelection ? new Set(this.projection?.interaction.selectedAtomIds ?? []) : new Set<string>();
    const selected = selectedIds.size > 0 ? this.structure.atoms.filter((atom) => selectedIds.has(atom.stableId)) : [];
    const atoms = selected.length > 0 ? selected : this.renderedAtoms();
    if (atoms.length === 0) return null;
    const bounds = boundsForCoordinates(atoms);
    if (!bounds) return null;
    return { atoms, selection: this.canonicalSelection((atom) => atoms.some((candidate) => candidate.stableId === atom.stableId)), center: bounds.center };
  }

  private applyClipping(): void {
    if (!this.viewer) return;
    if (this.cameraState.clippingMode === "manual") {
      const near = Math.min(this.cameraState.nearClip, this.cameraState.farClip - 0.01);
      const far = Math.max(this.cameraState.farClip, near + 1);
      this.viewer.setSlab(near, far);
      this.autoSlab = { near, far, padding: 0 };
    } else this.recalculateAutoClipping();
  }

  private recalculateAutoClipping(): void {
    if (!this.viewer || !this.structure || this.cameraState.clippingMode !== "auto") return;
    const atoms = this.renderedAtoms();
    if (atoms.length === 0) { this.autoSlab = paddedClippingSlab(null); this.viewer.setSlab(this.autoSlab.near, this.autoSlab.far); return; }
    const pivot = this.cameraPivot ?? boundsForCoordinates(atoms)?.center ?? { x: 0, y: 0, z: 0 };
    const relative = atoms.map((atom) => ({ x: atom.x - pivot.x, y: atom.y - pivot.y, z: atom.z - pivot.z }));
    this.autoSlab = paddedClippingSlab(boundsForCoordinates(relative));
    this.viewer.setSlab(this.autoSlab.near, this.autoSlab.far);
  }

  private bindPicking(): void {
    if (!this.viewer || !this.structure) return;
    const onClick = (atom: AtomSpec) => {
      const result = this.reverseIdentityMap.resolveAtomHit({ index: atom.index, serial: atom.serial, properties: atom.properties as Record<string, unknown> | undefined });
      if (result) this.interactionHandlers.onPick?.(result);
    };
    const onHover = (atom: AtomSpec) => {
      const result = this.reverseIdentityMap.resolveAtomHit({ index: atom.index, serial: atom.serial, properties: atom.properties as Record<string, unknown> | undefined });
      this.interactionHandlers.onHover?.(result);
    };
    const onUnhover = () => this.interactionHandlers.onHover?.(null);
    const all = this.canonicalSelection(() => true);
    this.viewer.setClickable(all, true, onClick);
    this.viewer.setHoverable(all, true, onHover, onUnhover);
  }

  private applyProjection(projection: RenderProjection): void {
    const viewer = this.viewer!; const structure = this.structure!; const diagnostics = buildRenderProjectionDiagnostics(structure, projection); this.diagnostics = diagnostics; this.writeDiagnostics(diagnostics); viewer.setStyle({}, {});
    for (const directive of diagnostics.directives) {
      const target = this.canonicalSelection((atom) => directive.targetStableAtomIds.includes(atom.stableId));
      if (directive.primitive === "line") viewer.addStyle(target, styleFor("lines", projection, structure, directive.styleProfile === "line" ? "default" : "default"));
      if (directive.primitive === "stick") viewer.addStyle(target, styleFor(projection.representation === "licorice" ? "licorice" : "sticks", projection, structure));
      if (directive.primitive === "sphere") viewer.addStyle(target, styleFor("spheres", projection, structure, projection.representation === "ball-and-stick" ? "ball" : projection.representation === "space-filling" || projection.representation === "spheres" ? "space" : directive.representation === "NB_SPHERES" ? "nonbonded" : "default"));
      if (directive.primitive === "cross") viewer.addStyle(target, styleFor("cross", projection, structure));
      if (directive.primitive === "cartoon" && directive.styleProfile !== "putty") viewer.addStyle(target, styleFor("cartoon", projection, structure, (directive.styleProfile as StyleProfile | undefined) ?? "cartoon"));
      if (directive.primitive === "cartoon" && directive.styleProfile === "putty") this.applyPuttyStyles(target, projection, structure, directive.targetStableAtomIds);
    }
    if (diagnostics.waterSphereContributors > 0) viewer.addStyle(this.canonicalSelection((atom) => atom.isWater), styleFor("spheres", projection, structure, "water"));
    const colorDiagnostics = structure.atoms.map((atom) => resolveAtomColor(projection.color.mode, atom, structure, projection.color.customHex).diagnostic).filter((value): value is string => Boolean(value));
    const colorDiagnostic = projection.colorDiagnostic ?? colorDiagnostics[0] ?? null;
    this.diagnostics = { ...this.diagnostics, colorDiagnostic };
    this.writeDiagnostics(this.diagnostics);
    this.projectInteractionHighlights(projection);
    this.projectLabels(projection);
    this.projectMeasurementShapes();
    this.applySurfaceDirectives(diagnostics, projection);
  }

  private applyPuttyStyles(target: AtomSelectionSpec, projection: RenderProjection, structure: CanonicalMolecularStructure, targetIds: readonly string[]): void {
    const profile = puttyProfileFor(structure, projection.representationState.parameters.puttyMinRadius, projection.representationState.parameters.puttyMaxRadius);
    if (!profile) return;
    const radii = puttyResidueRadii(structure, profile);
    const groups = new Map<number, string[]>();
    for (const stableId of targetIds) {
      const atom = structure.atoms.find((candidate) => candidate.stableId === stableId);
      const radius = atom ? puttyRadiusForResidue(atom, radii) : null;
      if (radius === null) continue;
      const bin = Math.round(radius * 100);
      groups.set(bin, [...(groups.get(bin) ?? []), stableId]);
    }
    for (const [bin, stableIds] of groups) {
      const radius = bin / 100;
      this.viewer!.addStyle(this.canonicalSelection((atom) => stableIds.includes(atom.stableId)), styleFor("cartoon", projection, structure, "putty", radius));
    }
    void target;
  }

  private applySurfaceDirectives(diagnostics: RenderProjectionDiagnostics, projection: RenderProjection): void {
    if (!this.viewer || !this.structure) return;
    const surfaceDirectives = diagnostics.directives.filter((directive) => directive.primitive === "surface" || directive.primitive === "mesh" || directive.primitive === "dots");
    const materialKey = JSON.stringify({ opacity: projection.representation === "mesh" ? projection.representationState.parameters.meshOpacity : projection.representation === "dots" || projection.representation === "dot-surface" ? projection.representationState.parameters.dotOpacity : projection.representationState.parameters.surfaceOpacity, meshWidth: projection.representationState.parameters.meshWidth, color: projection.color });
    const nextKey = `${surfaceDirectives.map((directive) => directive.surfaceCacheKey ?? "").join("||")}::${materialKey}`;
    if (!surfaceDirectives.length) {
      this.viewer.removeAllSurfaces();
      this.dotSurfaceShapes.forEach((shape) => this.viewer?.removeShape(shape));
      this.dotSurfaceShapes = [];
      this.surfaceIds = [];
      this.activeSurfaceKey = null;
      this.surfaceCoordinator.invalidate();
      this.container?.removeAttribute("data-surface-ready");
      this.container?.removeAttribute("data-surface-state");
      this.container?.removeAttribute("data-surface-generation");
      return;
    }
    if (this.activeSurfaceKey === nextKey) {
      for (const surfaceId of this.surfaceIds) this.viewer.setSurfaceMaterialStyle(surfaceId, { opacity: projection.representation === "mesh" ? projection.representationState.parameters.meshOpacity : projection.representationState.parameters.surfaceOpacity });
      return;
    }
    this.viewer.removeAllSurfaces();
    this.dotSurfaceShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.dotSurfaceShapes = [];
    this.surfaceIds = [];
    this.activeSurfaceKey = nextKey;
    const generation = this.surfaceCoordinator.begin();
    this.container?.setAttribute("data-surface-generation", String(generation));
    this.container?.setAttribute("data-surface-state", "generating");
    const structure = this.structure;
    for (const directive of surfaceDirectives) {
      const target = this.canonicalSelection((atom) => directive.targetStableAtomIds.includes(atom.stableId));
      const contributors = this.canonicalSelection(() => true);
      const kind = directive.surfaceProfile ?? "VDW";
      if (directive.primitive === "dots") {
        const profile = kind === "DOT_SURFACE" ? "SES" : kind === "DOTS" ? "VDW" : kind;
        const request = surfaceRequestFor(structure, kind, directive.targetStableAtomIds, structure.atoms.map((atom) => atom.stableId), { probeRadius: profile === "SAS" || profile === "SES" ? projection.representationState.parameters.surfaceProbeRadius : 0, quality: projection.representationState.parameters.surfaceQuality, sampling: projection.representationState.parameters.dotDensity });
        const cached = this.surfaceCache.get({ ...request, profileId: directive.surfaceCacheKey ?? request.profileId });
        const points = cached ?? buildDotSurfacePoints(structure, directive.targetStableAtomIds, structure.atoms.map((atom) => atom.stableId), profile, projection.representationState.parameters.surfaceProbeRadius, projection.representationState.parameters.dotDensity);
        this.surfaceCache.set({ ...request, profileId: directive.surfaceCacheKey ?? request.profileId }, points);
        if (!this.surfaceCoordinator.isCurrent(generation)) continue;
        const shape = this.viewer.addShape({ opacity: projection.representationState.parameters.dotOpacity, linewidth: projection.representationState.parameters.meshWidth });
        for (const point of points) {
          const atom = structure.atoms.find((candidate) => candidate.stableId === point.stableAtomId);
          shape.addSphere({ center: point, radius: 0.055, color: atom ? resolveAtomColor(projection.color.mode, atom, structure, projection.color.customHex).color : "#8fd9ff" });
        }
        this.dotSurfaceShapes.push(shape);
        this.container?.setAttribute("data-surface-ready", "true");
        this.container?.setAttribute("data-surface-state", "ready");
        continue;
      }
      const surfaceType = kind === "SAS" ? "SAS" : kind === "SES" ? "SES" : "VDW";
      const opacity = directive.primitive === "mesh" ? projection.representationState.parameters.meshOpacity : projection.representationState.parameters.surfaceOpacity;
      const firstTarget = structure.atoms.find((atom) => directive.targetStableAtomIds.includes(atom.stableId));
      const surfaceColor = firstTarget ? resolveAtomColor(projection.color.mode, firstTarget, structure, projection.color.customHex).color : "#829bb5";
      const result = this.viewer.addSurface(surfaceType, { opacity, wireframe: directive.primitive === "mesh", color: surfaceColor }, target, contributors, undefined, (surfaceId: number) => {
        if (!this.surfaceCoordinator.isCurrent(generation) || this.activeSurfaceKey !== nextKey) {
          this.viewer?.removeSurface(surfaceId);
          return;
        }
        this.surfaceIds.push(surfaceId);
        this.container?.setAttribute("data-surface-ready", "true");
        this.container?.setAttribute("data-surface-state", "ready");
        this.viewer?.render();
      });
      if (typeof result === "number" && this.surfaceCoordinator.isCurrent(generation)) this.surfaceIds.push(result);
    }
  }

  private projectInteractionHighlights(projection: RenderProjection): void {
    if (!this.viewer || !this.structure) return;
    this.interactionShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.interactionShapes = [];
    const hoverId = projection.interaction.hoveredAtomId;
    const pickedId = projection.interaction.pickedAtomId;
    const selectedIds = new Set(projection.interaction.selectedAtomIds);
    const addMarker = (stableId: string, color: string, radius: number, wireframe: boolean, opacity: number) => {
      const atom = this.structure!.atoms.find((candidate) => candidate.stableId === stableId);
      if (!atom) return;
      this.interactionShapes.push(this.viewer!.addSphere({ center: atom, radius, color, wireframe, opacity }));
    };
    if (hoverId) addMarker(hoverId, "#31d8c4", 0.18, true, 0.7);
    if (pickedId) addMarker(pickedId, "#e5ae32", 0.28, true, 0.8);
    for (const selectedId of selectedIds) addMarker(selectedId, "#55d9ff", 0.22, false, 0.28);
    for (const measurementId of projection.interaction.measurementPickAtomIds) addMarker(measurementId, "#f5c451", 0.23, true, 0.95);
  }

  private projectLabels(projection: RenderProjection): void {
    if (!this.viewer || !this.structure) return;
    this.viewer.removeAllLabels();
    const visible = this.structure.atoms.filter((atom) => atom.isPolymer ? projection.showProtein : atom.isLigand ? projection.showLigand : atom.isWater ? projection.showWater : atom.isIon ? projection.showIons : projection.showOther);
    const plan = labelPlanForState(projection.labels, visible);
    if (this.container) {
      this.container.dataset.labelEligibleCount = String(plan.eligibleAtomCount);
      this.container.dataset.labelCount = String(plan.labelCount);
      if (plan.diagnostic) this.container.dataset.labelDiagnostic = plan.diagnostic; else delete this.container.dataset.labelDiagnostic;
    }
    for (const atom of plan.atoms) {
      if (!projection.labels.expression) continue;
      const text = resolveSafeLabel(projection.labels.expression, atom, this.structure);
      this.viewer.addLabel(text, { font: projection.labels.font, fontSize: projection.labels.size, fontColor: projection.labels.color, borderThickness: 1, borderColor: projection.labels.outline, backgroundColor: "#05070a", backgroundOpacity: 0.72, showBackground: true, screenOffset: new Vector2(projection.labels.offset.x, projection.labels.offset.y), alignment: projection.labels.alignment, position: { x: atom.x, y: atom.y, z: atom.z } }, undefined, true);
    }
  }

  setMeasurements(measurements: readonly MeasurementObject[]): void {
    this.measurements = measurements;
    if (!this.viewer) return;
    this.viewer.removeAllLabels();
    if (this.projection) this.projectLabels(this.projection);
    this.projectMeasurementShapes();
    this.writeDiagnostics(this.diagnostics);
    this.viewer.render();
  }

  private projectMeasurementShapes(): void {
    if (!this.viewer) return;
    this.measurementShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.measurementShapes = [];
    if (!this.structure) return;
    const atomMap = new Map(this.structure.atoms.map((atom) => [atom.stableId, atom]));
    for (const measurement of this.measurements) {
      if (!measurement.presentation.visible || measurementStatus(measurement, this.structure) !== "CURRENT") continue;
      const atoms = measurement.participants.map((participant) => atomMap.get(participant.stableAtomId)).filter((atom): atom is NonNullable<typeof atom> => Boolean(atom));
      if (atoms.length !== measurement.participants.length) continue;
      const shape = this.viewer.addShape({ color: measurement.presentation.color, linewidth: measurement.presentation.lineWidth });
      if (measurement.kind === "DISTANCE") shape.addLine({ start: atoms[0], end: atoms[1], dashed: true });
      else {
        for (let index = 0; index < atoms.length - 1; index += 1) shape.addLine({ start: atoms[index], end: atoms[index + 1], dashed: false });
        if (measurement.kind === "ANGLE") {
          const center = atoms[1]; const armA = { x: atoms[0].x - center.x, y: atoms[0].y - center.y, z: atoms[0].z - center.z }; const armC = { x: atoms[2].x - center.x, y: atoms[2].y - center.y, z: atoms[2].z - center.z }; const lengthA = Math.sqrt(armA.x ** 2 + armA.y ** 2 + armA.z ** 2); const lengthC = Math.sqrt(armC.x ** 2 + armC.y ** 2 + armC.z ** 2); const radius = Math.min(lengthA, lengthC) * 0.32; const points = Array.from({ length: 13 }, (_, index) => { const t = index / 12; const a = Math.acos(Math.max(-1, Math.min(1, (armA.x * armC.x + armA.y * armC.y + armA.z * armC.z) / Math.max(1e-9, lengthA * lengthC)))); const angle = a * t; const ux = armA.x / Math.max(1e-9, lengthA); const vx = armC.x / Math.max(1e-9, lengthC); const blend = { x: ux * Math.cos(angle) + vx * Math.sin(angle), y: armA.y / Math.max(1e-9, lengthA) * Math.cos(angle) + armC.y / Math.max(1e-9, lengthC) * Math.sin(angle), z: armA.z / Math.max(1e-9, lengthA) * Math.cos(angle) + armC.z / Math.max(1e-9, lengthC) * Math.sin(angle) }; return { x: center.x + blend.x * radius, y: center.y + blend.y * radius, z: center.z + blend.z * radius }; }); shape.addCurve({ points, radius: 0.025 });
        }
      }
      this.viewer.addLabel(`${measurement.rawValue.toFixed(measurement.displayPrecision)} ${measurement.displayUnit}`, { position: { x: atoms[Math.floor(atoms.length / 2)].x, y: atoms[Math.floor(atoms.length / 2)].y, z: atoms[Math.floor(atoms.length / 2)].z }, fontSize: 12, fontColor: measurement.presentation.color, backgroundColor: "#111722", backgroundOpacity: 0.88, borderThickness: 1, borderColor: measurement.presentation.color, showBackground: true }, undefined, false);
      this.measurementShapes.push(shape);
    }
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
    this.container.dataset.rendererSurfaceContributors = String(diagnostics.surfaceContributors);
    this.container.dataset.rendererMeshContributors = String(diagnostics.meshContributors);
    this.container.dataset.rendererDotContributors = String(diagnostics.dotContributors);
    this.container.dataset.rendererSurfaceProfile = diagnostics.surfaceProfile ?? "";
    this.container.dataset.rendererSurfaceCacheKey = diagnostics.surfaceCacheKey ?? "";
    this.container.dataset.rendererCanonicalBondSource = diagnostics.stickCylinderContributors > 0 || diagnostics.lineContributors > 0 ? "canonical" : "none";
    this.container.dataset.rendererModelLoads = String(this.modelLoadCount);
    this.container.dataset.rendererGeneration = String(this.rendererGeneration);
    this.container.dataset.cameraProjection = this.cameraState.projectionMode;
    this.container.dataset.cameraClippingMode = this.cameraState.clippingMode;
    this.container.dataset.cameraSlabNear = String(this.autoSlab.near);
    this.container.dataset.cameraSlabFar = String(this.autoSlab.far);
    this.container.dataset.cameraAction = this.lastCameraAction;
    this.container.dataset.pickedAtom = this.projection?.interaction.pickedAtomId ?? "";
    this.container.dataset.hoveredAtom = this.projection?.interaction.hoveredAtomId ?? "";
    this.container.dataset.selectedAtoms = String(this.projection?.interaction.selectedAtomIds.length ?? 0);
    this.container.dataset.measurementPicks = this.projection?.interaction.measurementPickAtomIds.join(",") ?? "";
    this.container.dataset.labelMode = this.projection?.labels.mode ?? "off";
    this.container.dataset.measurementCount = String(this.measurements.length);
    this.container.dataset.rendererStyleProfile = diagnostics.styleProfile;
    this.container.dataset.rendererRepresentationStatus = diagnostics.representation[diagnosticTypeForStyle(diagnostics.styleProfile)].status;
    this.container.dataset.rendererRibbonStatus = diagnostics.representation.RIBBON.status;
    this.container.dataset.rendererPuttyStatus = diagnostics.representation.CARTOON.status;
    if (diagnostics.representation.RIBBON.diagnostic) this.container.dataset.rendererRibbonDiagnostic = diagnostics.representation.RIBBON.diagnostic; else delete this.container.dataset.rendererRibbonDiagnostic;
    if (diagnostics.representation.CARTOON.diagnostic) this.container.dataset.rendererPuttyDiagnostic = diagnostics.representation.CARTOON.diagnostic; else delete this.container.dataset.rendererPuttyDiagnostic;
    if (diagnostics.colorDiagnostic) this.container.dataset.colorDiagnostic = diagnostics.colorDiagnostic; else delete this.container.dataset.colorDiagnostic;
    if ((this.projection?.representation === "lines" || this.projection?.representation === "sticks") && this.structure?.bonds.length === 0) this.container.dataset.rendererBondDiagnostic = "No authoritative bond geometry is available for this target."; else delete this.container.dataset.rendererBondDiagnostic;
  }
  private frameToCanonicalBounds(setBaseline: boolean): void { if (!this.viewer || !this.structure) return; const target = this.boundsForCameraTarget(false); if (!target) return; this.viewer.resize(); this.viewer.center(target.selection); this.viewer.zoomTo(target.selection); this.cameraPivot = target.center; this.appliedViewportShift = { x: 0, y: 0 }; this.applyClipping(); this.applyViewportTranslation(); const view = this.viewer.getView(); this.cameraState = { ...this.cameraState, view, defaultView: this.baselineView ? [...this.baselineView] : this.cameraState.defaultView, viewport: this.viewport }; if (setBaseline || !this.baselineView) { this.baselineView = [...view]; this.baselinePivot = { ...target.center }; this.cameraState = { ...this.cameraState, defaultView: [...view] }; } }
  private applyViewportTranslation(): void { if (!this.viewer || !this.viewport.width || !this.viewport.height) return; const targetX = (this.viewport.visibleLeft + this.viewport.visibleRight - this.viewport.width) / 2; const targetY = (this.viewport.visibleTop + this.viewport.visibleBottom - this.viewport.height) / 2; const deltaX = targetX - this.appliedViewportShift.x; const deltaY = targetY - this.appliedViewportShift.y; if (deltaX || deltaY) this.viewer.translate(deltaX, deltaY); this.appliedViewportShift = { x: targetX, y: targetY }; this.cameraState = { ...this.cameraState, view: this.viewer.getView(), viewport: this.viewport }; }
  private renderCamera(): void { if (!this.viewer) return; if (this.cameraState.clippingMode === "auto") this.recalculateAutoClipping(); this.cameraState = { ...this.cameraState, view: this.viewer.getView(), defaultView: this.baselineView ? [...this.baselineView] : this.cameraState.defaultView, viewport: this.viewport }; if (this.container) this.writeDiagnostics(this.diagnostics); this.viewer.render(); }
}
