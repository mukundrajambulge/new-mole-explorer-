import { createViewer, Vector2, type AtomSelectionSpec, type AtomSpec, type AtomStyleSpec, type GLShape, type GLViewer } from "3dmol";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { colorRegistry } from "./colorRegistry";
import { resolveAtomColor } from "./colorSchemes";
import { DEFAULT_CAMERA, type CameraState, type RenderProjection } from "./renderProjection";
import { buildRenderProjectionDiagnostics, emptyRenderProjectionDiagnostics, type RenderProjectionDiagnostics } from "./renderDirectives";
import { resolveSafeLabel } from "../interaction/labels";
import { ReverseIdentityMap, type PickResult } from "../interaction/picking";
import { measurementStatus, type MeasurementObject } from "../interaction/measurements";

const mountedAdapters = new WeakMap<HTMLElement, ThreeDMolViewerAdapter>();
type Viewport = NonNullable<CameraState["viewport"]>;
type StyleRepresentation = "lines" | "sticks" | "spheres" | "cartoon" | "licorice" | "cross";
type StyleProfile = "default" | "water" | "nonbonded" | "ball" | "space";
export type ViewerInteractionHandlers = { onPick?: (result: PickResult) => void; onHover?: (result: PickResult | null) => void };

const styleFor = (representation: StyleRepresentation, projection: RenderProjection, structure: CanonicalMolecularStructure, profile: StyleProfile = "default"): AtomStyleSpec => {
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
    case "lines": return { line: { linewidth: projection.representationState.parameters.lineWidth, ...atomColor } } as AtomStyleSpec;
    case "sticks": return { stick: { radius: projection.representationState.parameters.stickRadius, ...atomColor } } as AtomStyleSpec;
    case "spheres": return { sphere: { scale: profile === "water" ? 0.18 : profile === "nonbonded" ? 0.15 : profile === "ball" ? 0.28 : profile === "space" ? projection.representationState.parameters.sphereScale : 0.3, ...atomColor } } as AtomStyleSpec;
    case "cross": return { cross: { scale: 0.35, radius: 0.12, ...atomColor } } as AtomStyleSpec;
    case "cartoon": {
      const cartoonStyle = projection.representation === "ribbon" ? "oval" : projection.representation === "trace" ? "trace" : projection.representation === "putty" ? "putty" : undefined;
      return { cartoon: { ...(cartoonStyle ? { style: cartoonStyle } : {}), ...atomColor, arrows: true, opacity: projection.representationState.parameters.cartoonThickness } } as AtomStyleSpec;
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
  private rendererGeneration = 0;
  private readonly reverseIdentityMap = new ReverseIdentityMap();
  private interactionHandlers: ViewerInteractionHandlers = {};
  private measurementShapes: GLShape[] = [];
  private measurements: readonly MeasurementObject[] = [];
  private gestureFrame: number | null = null;
  private gesture: { mode: "rotate" | "pan" | "zoom"; x: number; y: number } | null = null;
  private pendingGestureDelta = { x: 0, y: 0 };

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
    this.viewer!.setProjection(projection.camera.projectionMode);
    this.viewer!.setCameraParameters({ fov: projection.camera.fov, orthographic: projection.camera.projectionMode === "orthographic" });
    this.viewer!.setSlab(projection.camera.nearClip, projection.camera.farClip);
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
  center(): void { if (!this.viewer || !this.hasModel) return; this.viewer.center(this.canonicalSelection(() => true)); this.renderCamera(); }
  orient(): void { if (!this.viewer || !this.hasModel) return; if (this.cameraState.defaultView) this.viewer.setView(this.cameraState.defaultView); else this.frameToCanonicalBounds(); this.renderCamera(); }
  origin(): void { if (!this.viewer || !this.hasModel) return; this.viewer.center({}); this.renderCamera(); }
  resetView(): void { if (!this.viewer || !this.hasModel) return; if (this.cameraState.defaultView) this.viewer.setView(this.cameraState.defaultView); else this.frameToCanonicalBounds(); this.renderCamera(); }
  setCameraControls(camera: Partial<CameraState>): void { if (!this.viewer) return; this.cameraState = { ...this.cameraState, ...camera }; this.viewer.setProjection(this.cameraState.projectionMode); this.viewer.setCameraParameters({ fov: this.cameraState.fov, orthographic: this.cameraState.projectionMode === "orthographic" }); this.viewer.setSlab(this.cameraState.nearClip, this.cameraState.farClip); if (camera.view) this.viewer.setView(camera.view); this.renderCamera(); }
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
      if (this.gesture.mode === "rotate") { this.viewer.rotate(pending.x * 0.55, "y"); this.viewer.rotate(pending.y * 0.55, "x"); }
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
    this.measurementShapes = []; this.measurements = []; this.container?.replaceChildren(); this.container = null; this.hasModel = false; this.structure = null; this.projection = null; this.cameraState = DEFAULT_CAMERA; this.interactionHandlers = {}; this.diagnostics = emptyRenderProjectionDiagnostics();
  }
  getDiagnostics(): RenderProjectionDiagnostics { return this.diagnostics; }

  private ensureMounted(): void { if (!this.viewer) throw new Error("3Dmol viewer adapter is not mounted."); }
  private canonicalSelection(predicate: (atom: CanonicalMolecularStructure["atoms"][number]) => boolean): AtomSelectionSpec { const indices = new Set(this.structure!.atoms.map((atom, index) => predicate(atom) ? index : -1).filter((index) => index >= 0)); return { predicate: (atom) => atom.index !== undefined && indices.has(atom.index) }; }

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
    this.projectInteractionHighlights(projection);
    this.projectLabels(projection);
    this.projectMeasurementShapes();
  }

  private projectInteractionHighlights(projection: RenderProjection): void {
    if (!this.viewer || !this.structure) return;
    const hoverId = projection.interaction.hoveredAtomId;
    const pickedId = projection.interaction.pickedAtomId;
    const selectedIds = new Set(projection.interaction.selectedAtomIds);
    if (hoverId) this.viewer.addStyle(this.canonicalSelection((atom) => atom.stableId === hoverId), { sphere: { scale: 0.42, color: "#31d8c4", opacity: 0.8 } });
    if (pickedId) this.viewer.addStyle(this.canonicalSelection((atom) => atom.stableId === pickedId), { sphere: { scale: 0.58, color: "#e5ae32", opacity: 0.86 } });
    if (selectedIds.size) this.viewer.addStyle(this.canonicalSelection((atom) => selectedIds.has(atom.stableId)), { sphere: { scale: 0.5, color: "#55d9ff", opacity: 0.7 } });
  }

  private projectLabels(projection: RenderProjection): void {
    if (!this.viewer || !this.structure) return;
    this.viewer.removeAllLabels();
    if (projection.labels.mode === "off" || !projection.labels.expression) return;
    const visible = this.structure.atoms.filter((atom) => atom.isPolymer ? projection.showProtein : atom.isLigand ? projection.showLigand : atom.isWater ? projection.showWater : atom.isIon ? projection.showIons : projection.showOther);
    for (const atom of visible) {
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
    this.container.dataset.rendererCanonicalBondSource = diagnostics.stickCylinderContributors > 0 || diagnostics.lineContributors > 0 ? "canonical" : "none";
    this.container.dataset.rendererModelLoads = String(this.modelLoadCount);
    this.container.dataset.rendererGeneration = String(this.rendererGeneration);
    this.container.dataset.pickedAtom = this.projection?.interaction.pickedAtomId ?? "";
    this.container.dataset.hoveredAtom = this.projection?.interaction.hoveredAtomId ?? "";
    this.container.dataset.labelMode = this.projection?.labels.mode ?? "off";
    this.container.dataset.measurementCount = String(this.measurements.length);
    this.container.dataset.rendererStyleProfile = diagnostics.styleProfile;
    if (diagnostics.colorDiagnostic) this.container.dataset.colorDiagnostic = diagnostics.colorDiagnostic; else delete this.container.dataset.colorDiagnostic;
    if ((this.projection?.representation === "lines" || this.projection?.representation === "sticks") && this.structure?.bonds.length === 0) this.container.dataset.rendererBondDiagnostic = "No authoritative bond geometry is available for this target."; else delete this.container.dataset.rendererBondDiagnostic;
  }
  private frameToCanonicalBounds(): void { if (!this.viewer || !this.structure) return; this.viewer.resize(); const all = this.canonicalSelection(() => true); this.viewer.center(all); this.viewer.zoomTo(all); this.appliedViewportShift = { x: 0, y: 0 }; this.applyViewportTranslation(); this.cameraState = { ...this.cameraState, view: this.viewer.getView(), defaultView: this.viewer.getView(), viewport: this.viewport }; }
  private applyViewportTranslation(): void { if (!this.viewer || !this.viewport.width || !this.viewport.height) return; const targetX = (this.viewport.visibleLeft + this.viewport.visibleRight - this.viewport.width) / 2; const targetY = (this.viewport.visibleTop + this.viewport.visibleBottom - this.viewport.height) / 2; const deltaX = targetX - this.appliedViewportShift.x; const deltaY = targetY - this.appliedViewportShift.y; if (deltaX || deltaY) this.viewer.translate(deltaX, deltaY); this.appliedViewportShift = { x: targetX, y: targetY }; this.cameraState = { ...this.cameraState, view: this.viewer.getView(), viewport: this.viewport }; }
  private renderCamera(): void { if (!this.viewer) return; this.cameraState = { ...this.cameraState, view: this.viewer.getView(), viewport: this.viewport }; this.viewer.render(); }
}
