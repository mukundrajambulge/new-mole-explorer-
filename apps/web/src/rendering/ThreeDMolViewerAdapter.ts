import { createViewer, Vector2, type AtomSelectionSpec, type AtomSpec, type AtomStyleSpec, type GLShape, type GLViewer, type SurfaceStyleSpec } from "3dmol";
import type { CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { colorRegistry } from "./colorRegistry";
import { resolveAtomColor, resolveProjectedAtomColor } from "./colorSchemes";
import { DEFAULT_CAMERA, type CameraState, type RenderProjection } from "./renderProjection";
import { buildRenderProjectionDiagnostics, emptyRenderProjectionDiagnostics, type RenderProjectionDiagnostics } from "./renderDirectives";
import type { RepresentationType } from "./presentationState";
import { labelPlanForState, resolveSafeLabel } from "../interaction/labels";
import { ReverseIdentityMap, type PickResult } from "../interaction/picking";
import { measurementStatus, type MeasurementObject } from "../interaction/measurements";
import { boundsForCoordinates, CameraController, paddedClippingSlab, principalOrientationQuaternion, type Coordinate3, type ClippingSlab } from "./cameraController";
import { buildDotSurfacePoints, type SurfacePoint } from "./surfaceGenerator";
import { SurfaceGeometryCache, SurfaceRequestCoordinator, surfaceRequestFor } from "./surfaceProfiles";
import { puttyProfileFor, puttyRadiusForResidue, puttyResidueRadii } from "./putty";
import type { AnalysisOverlay } from "../analysis/structuralAnalysis";
import { stateForObject, structureForWorkspaceObjectState, workspaceScopedStableAtomId, type WorkspaceObject } from "../workspace/workspaceModel";

const diagnosticTypeForStyle = (style: string): RepresentationType => style === "ribbon" ? "RIBBON" : style === "putty" || style === "trace" || style === "cartoon" ? "CARTOON" : style === "nonbonded-crosses" ? "NONBONDED" : style === "nonbonded-spheres" ? "NB_SPHERES" : style === "line" ? "LINES" : style === "stick" || style === "licorice" || style === "ball-and-stick" ? "STICKS" : "SPHERES";

const mountedAdapters = new WeakMap<HTMLElement, ThreeDMolViewerAdapter>();
type Viewport = NonNullable<CameraState["viewport"]>;
type StyleRepresentation = "lines" | "sticks" | "spheres" | "cartoon" | "licorice" | "cross";
type StyleProfile = "default" | "water" | "nonbonded" | "ball" | "space" | "cartoon" | "ribbon" | "trace" | "putty";
export type ViewerInteractionHandlers = { onPick?: (result: PickResult) => void; onHover?: (result: PickResult | null) => void };
type SurfaceHandleState = { surfaceIds: number[]; surfaceKinds: Array<"surface" | "mesh">; dotSurfaceShapes: GLShape[]; geometryKey: string; materialKey: string };
type ViewerModel = ReturnType<GLViewer["addModel"]>;

const sceneProjectionChanged = (previous: RenderProjection | null | undefined, next: RenderProjection): boolean => !previous
  || previous.representation !== next.representation
  || previous.showProtein !== next.showProtein
  || previous.showLigand !== next.showLigand
  || previous.showWater !== next.showWater
  || previous.showIons !== next.showIons
  || previous.showOther !== next.showOther
  || previous.representationState !== next.representationState
  || previous.color !== next.color;

const cameraProjectionChanged = (previous: RenderProjection | null | undefined, next: RenderProjection): boolean => !previous || previous.camera !== next.camera;
const labelsProjectionChanged = (previous: RenderProjection | null | undefined, next: RenderProjection): boolean => !previous || previous.labels !== next.labels;
const interactionProjectionChanged = (previous: RenderProjection | null | undefined, next: RenderProjection): boolean => !previous || previous.interaction !== next.interaction;
const isSurfacePrimitive = (primitive: RenderProjectionDiagnostics["directives"][number]["primitive"]): boolean => primitive === "surface" || primitive === "mesh" || primitive === "dots";

const styleFor = (representation: StyleRepresentation, projection: RenderProjection, structure: CanonicalMolecularStructure, profile: StyleProfile = "default", thicknessOverride?: number): AtomStyleSpec => {
  const explicitColor = colorRegistry.cssColor(projection.color);
  const canonicalByStableId = new Map(structure.atoms.map((atom) => [atom.stableId, atom]));
  const colorfunc = (atom: AtomSpec) => {
    const stableId = typeof atom.properties?.canonicalStableId === "string" ? atom.properties.canonicalStableId : undefined;
    const canonical = stableId ? canonicalByStableId.get(stableId) : undefined;
    return resolveProjectedAtomColor(projection.color, representation, canonical, structure, explicitColor).color;
  };
  const atomColor = { colorfunc };
  switch (representation) {
    case "lines": return { line: { linewidth: projection.representationState.parameters.lineWidth, opacity: projection.representationState.parameters.lineOpacity, ...atomColor } } as AtomStyleSpec;
    case "sticks": return { stick: { radius: projection.representationState.parameters.stickRadius, opacity: projection.representationState.parameters.stickOpacity, ...atomColor } } as AtomStyleSpec;
    case "spheres": return { sphere: { scale: profile === "water" ? 0.18 : profile === "nonbonded" ? 0.15 : profile === "ball" ? 0.28 : profile === "space" ? projection.representationState.parameters.sphereScale : 0.3, opacity: projection.representationState.parameters.sphereOpacity, ...atomColor } } as AtomStyleSpec;
    case "cross": return { cross: { scale: 0.35, radius: 0.12, opacity: projection.representationState.parameters.nonbondedOpacity, ...atomColor } } as AtomStyleSpec;
    case "cartoon": {
      const cartoonStyle = profile === "ribbon" || profile === "putty" ? "oval" : profile === "trace" ? "trace" : undefined;
      return { cartoon: { ...(cartoonStyle ? { style: cartoonStyle } : {}), ...(profile === "putty" ? { tubes: true } : {}), ...atomColor, arrows: true, thickness: thicknessOverride ?? projection.representationState.parameters.cartoonThickness, opacity: profile === "ribbon" ? projection.representationState.parameters.ribbonOpacity : projection.representationState.parameters.cartoonOpacity } } as AtomStyleSpec;
    }
    case "licorice": return { stick: { radius: 0.23, opacity: projection.representationState.parameters.stickOpacity, ...atomColor } } as AtomStyleSpec;
  }
};

const orderNumber = (order: CanonicalMolecularStructure["bonds"][number]["order"]): number => order === "DOUBLE" ? 2 : order === "TRIPLE" ? 3 : order === "AROMATIC" ? 4 : 1;
const secondaryCode = (value: CanonicalMolecularStructure["atoms"][number]["secondaryStructure"]): string | undefined => value === "HELIX" ? "h" : value === "SHEET" ? "s" : value === "LOOP" ? "c" : undefined;

const boundedDisplayPoints = (points: readonly SurfacePoint[], maxPoints: number): SurfacePoint[] => {
  if (points.length <= maxPoints) return [...points];
  const stride = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % stride === 0).slice(0, maxPoints);
};

const brightenHex = (hex: string, amount = 0.65): string => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return hex;
  const channel = (offset: number): number => Math.min(255, Math.round(parseInt(normalized.slice(offset, offset + 2), 16) + (255 - parseInt(normalized.slice(offset, offset + 2), 16)) * amount));
  return `#${[0, 2, 4].map((offset) => channel(offset).toString(16).padStart(2, "0")).join("")}`;
};

const quantizeHex = (hex: string, step = 32): string => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return hex;
  const channel = (offset: number): number => Math.min(255, Math.round(parseInt(normalized.slice(offset, offset + 2), 16) / step) * step);
  return `#${[0, 2, 4].map((offset) => channel(offset).toString(16).padStart(2, "0")).join("")}`;
};

const surfaceStyleFor = (projection: RenderProjection, structure: CanonicalMolecularStructure, opacity: number, wireframe = false): SurfaceStyleSpec => ({
  opacity,
  ...(wireframe ? { wireframe: true, wireframeLinewidth: projection.representationState.parameters.meshWidth } : { onesided: true }),
  colorscheme: {
    prop: "canonicalStableId",
    map: Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, resolveProjectedAtomColor(projection.color, "SURFACE", atom, structure, colorRegistry.cssColor(projection.color)).color])),
  },
}) as SurfaceStyleSpec;

const boundedAnalysisOverlays = (overlays: readonly AnalysisOverlay[]): AnalysisOverlay[] => {
  const limits: Record<AnalysisOverlay["kind"], number> = { H_BONDS: 24, CONTACTS: 24, CLASH: 24 };
  const counts: Record<AnalysisOverlay["kind"], number> = { H_BONDS: 0, CONTACTS: 0, CLASH: 0 };
  return overlays.filter((overlay) => {
    if (counts[overlay.kind] >= limits[overlay.kind]) return false;
    counts[overlay.kind] += 1;
    return true;
  });
};

export class ThreeDMolViewerAdapter {
  private viewer: GLViewer | null = null;
  private cameraController: CameraController | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hasModel = false;
  private primaryModel: ReturnType<GLViewer["addModel"]> | null = null;
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
  private analysisShapes: GLShape[] = [];
  private analysisOverlays: readonly AnalysisOverlay[] = [];
  private dotSurfaceShapes: GLShape[] = [];
  private surfaceIds: number[] = [];
  private surfaceKinds: Array<"surface" | "mesh"> = [];
  private activeSurfaceKey: string | null = null;
  private activeSurfaceGeometryKey: string | null = null;
  private readonly surfaceCache = new SurfaceGeometryCache<readonly SurfacePoint[]>();
  private readonly surfaceCoordinator = new SurfaceRequestCoordinator();
  /** Surface handles are scoped to a workspace object/state, never to a global 3Dmol model index. */
  private readonly workspaceSurfaceHandles = new Map<string, SurfaceHandleState>();
  private readonly workspaceSurfaceRebuilds = new Map<string, number>();
  private readonly styledModels = new Set<ViewerModel>();
  private readonly surfaceFallbackModels = new Set<ViewerModel>();
  private readonly surfaceReadyModels = new Set<ViewerModel>();
  private workspaceSurfaceGeneration = 0;
  private measurements: readonly MeasurementObject[] = [];
  private auxiliaryModels: Array<{ model: ReturnType<GLViewer["addModel"]>; object: WorkspaceObject }> = [];
  private workspaceObjects: readonly WorkspaceObject[] = [];
  private primaryObjectEnabled = true;
  private gestureFrame: number | null = null;
  private gesture: { mode: "rotate" | "pan" | "zoom"; x: number; y: number } | null = null;
  private pendingGestureDelta = { x: 0, y: 0 };
  private cameraPivot: Coordinate3 | null = null;
  private baselineView: number[] | null = null;
  private baselinePivot: Coordinate3 | null = null;
  private autoSlab: ClippingSlab = paddedClippingSlab(null);
  private lastCameraAction = "NONE";
  private performance = { viewerCreations: 0, sceneRebuilds: 0, projectionRebuilds: 0, renderCalls: 0, surfaceCacheHits: 0, surfaceCacheMisses: 0, surfaceGenerations: 0, meshGenerations: 0, dotGenerations: 0, staleSurfaceResults: 0 };

  mount(container: HTMLElement): void {
    if (this.viewer && this.container === container) return;
    const mountedAdapter = mountedAdapters.get(container);
    if (mountedAdapter && mountedAdapter !== this) mountedAdapter.destroy();
    if (this.viewer) this.destroy();
    this.container = container;
    mountedAdapters.set(container, this);
    this.viewer = createViewer(container, { backgroundColor: "#05070a", antialias: true, disableFog: true, cartoonQuality: 8 });
    this.cameraController = new CameraController(this.viewer);
    this.performance.viewerCreations += 1;
    container.dataset.rendererGeneration = String(this.rendererGeneration);
    this.resizeObserver = new ResizeObserver(() => { this.viewer?.resize(); this.render(); });
    this.resizeObserver.observe(container);
  }

  setInteractionHandlers(handlers: ViewerInteractionHandlers): void {
    this.interactionHandlers = handlers;
    if (this.viewer && this.hasModel) this.bindPicking();
  }

  /** True after a workspace model layout has been installed, including a single disabled object. */
  isWorkspaceMode(): boolean { return this.workspaceObjects.length > 0; }

  setAnalysisOverlays(overlays: readonly AnalysisOverlay[]): void {
    // Keep the canonical analysis result complete; only renderer line count is bounded.
    this.analysisOverlays = boundedAnalysisOverlays(overlays);
    this.analysisShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.analysisShapes = [];
    if (!this.viewer || !this.structure) return;
    const atomMap = new Map(this.structure.atoms.map((atom) => [atom.stableId, atom]));
    const shapes = new Map<AnalysisOverlay["kind"], GLShape>();
    for (const overlay of this.analysisOverlays) {
      const left = atomMap.get(overlay.atom1Id); const right = atomMap.get(overlay.atom2Id);
      if (!left || !right) continue;
      const color = overlay.kind === "CLASH" ? "#f36f6f" : overlay.kind === "H_BONDS" ? "#45dec2" : "#65b8ff";
      const shape = shapes.get(overlay.kind) ?? this.viewer.addShape({ color, linewidth: overlay.kind === "CLASH" ? 2.2 : 1.4, opacity: overlay.kind === "CLASH" ? 0.95 : 0.78 });
      shapes.set(overlay.kind, shape);
      shape.addLine({ start: left, end: right, dashed: overlay.kind !== "CLASH" });
      if (overlay.kind === "CLASH") {
        const center = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2 };
        shape.addSphere({ center, radius: 0.13, wireframe: true, color, opacity: 0.95 });
      }
    }
    this.analysisShapes = [...shapes.values()];
    this.render();
  }

  load(result: StructureLoadResult, projection: RenderProjection, objectId?: string): void {
    this.ensureMounted();
    this.structure = result.structure;
    this.performance.sceneRebuilds += 1;
    this.rendererGeneration += 1;
    this.reverseIdentityMap.build(result.structure, this.rendererGeneration);
    if (this.container) this.container.dataset.rendererGeneration = String(this.rendererGeneration);
    this.viewer!.removeAllModels();
    this.viewer!.removeAllSurfaces();
    this.viewer!.removeAllShapes();
    this.surfaceCoordinator.invalidate();
    this.surfaceIds = [];
    this.surfaceKinds = [];
    this.dotSurfaceShapes = [];
    this.workspaceSurfaceHandles.clear();
    this.workspaceSurfaceRebuilds.clear();
    this.styledModels.clear();
    this.surfaceFallbackModels.clear();
    this.surfaceReadyModels.clear();
    this.activeSurfaceKey = null;
    this.activeSurfaceGeometryKey = null;
    this.interactionShapes = [];
    this.analysisShapes = [];
    this.analysisOverlays = [];
    this.auxiliaryModels = [];
    this.workspaceObjects = [];
    this.primaryObjectEnabled = true;
    this.hasModel = false;
    this.projection = null;
    const renderModel = this.viewer!.addModel();
    this.primaryModel = renderModel;
    renderModel.addAtoms(this.atomSpecsFor(result.structure, objectId));
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
    this.render();
  }

  /** Reconcile several canonical objects into the one mounted 3Dmol viewer. */
  loadWorkspace(objects: readonly WorkspaceObject[]): void {
    const primary = objects[0];
    if (!primary) return;
    this.primaryObjectEnabled = primary.enabled;
    this.load(this.renderLoadResultForState(primary), primary.projection, primary.objectId);
    this.workspaceObjects = objects;
    this.primaryObjectEnabled = primary.enabled;
    this.reverseIdentityMap.buildMany(objects.map((object) => ({ structure: this.renderLoadResultForState(object).structure, objectId: object.objectId, stateId: stateForObject(object)?.id })), this.rendererGeneration);
    const auxiliaryObjects = this.auxiliaryObjectsFor(objects);
    this.auxiliaryModels = auxiliaryObjects.map((object) => {
      const model = this.viewer!.addModel();
      model.addAtoms(this.atomSpecsFor(this.renderLoadResultForState(object).structure, object.objectId));
      return { model, object };
    });
    // load() applies the primary projection for the single-object path. Once
    // the workspace is known, replace that global surface set with the
    // object/state-scoped surface registry.
    this.clearStandaloneSurfaceHandles();
    this.surfaceReadyModels.clear();
    this.renderPrimaryWorkspaceModel();
    this.renderAuxiliaryModels();
    this.applyWorkspaceSurfaces(objects);
    this.bindWorkspacePicking();
    this.writeWorkspaceProjectionState();
    this.container?.setAttribute("data-renderer-model-count", String(auxiliaryObjects.length + 1));
    this.render();
  }

  /** Update object-scoped presentation without reloading canonical models. */
  setWorkspaceObjects(objects: readonly WorkspaceObject[], interactionProjection?: RenderProjection, interactionObjectId?: string): void {
    const effectiveObjects = interactionProjection
      ? objects.map((object, index) => (object.objectId === interactionObjectId || (!interactionObjectId && objects.length === 1 && index === 0)) ? { ...object, projection: interactionProjection } : object)
      : objects;
    const previousObjects = this.workspaceObjects;
    if (this.viewer && this.hasModel && !this.sameWorkspaceModelLayout(previousObjects, effectiveObjects)) {
      this.loadWorkspace(effectiveObjects);
      return;
    }
    const scientificRevisionChanged = previousObjects.length === effectiveObjects.length && previousObjects.some((previous, index) => previous.loadResult.structure.scientificHash !== effectiveObjects[index]?.loadResult.structure.scientificHash);
    const modelStateChanged = scientificRevisionChanged || previousObjects.length !== effectiveObjects.length || effectiveObjects.some((object, index) => previousObjects[index]?.currentStateId !== object.currentStateId);
    const objectVisibilityChanged = effectiveObjects.some((object, index) => previousObjects[index]?.enabled !== object.enabled);
    const objectSceneChanged = modelStateChanged || objectVisibilityChanged || effectiveObjects.some((object, index) => sceneProjectionChanged(previousObjects[index]?.projection, object.projection));
    const objectLabelsChanged = effectiveObjects.some((object, index) => labelsProjectionChanged(previousObjects[index]?.projection, object.projection));
    const objectInteractionChanged = effectiveObjects.some((object, index) => interactionProjectionChanged(previousObjects[index]?.projection, object.projection));
    if (this.viewer && this.hasModel && effectiveObjects[0]) {
      const primaryChanged = scientificRevisionChanged || previousObjects[0]?.currentStateId !== effectiveObjects[0].currentStateId;
      if (primaryChanged && this.primaryModel) this.replaceModelAtoms(this.primaryModel, effectiveObjects[0]);
      const nextAuxiliaryObjects = this.auxiliaryObjectsFor(effectiveObjects);
      for (const [index, nextObject] of nextAuxiliaryObjects.entries()) {
        const current = this.auxiliaryModels[index];
        if (!current) continue;
        if (scientificRevisionChanged || current.object.currentStateId !== nextObject.currentStateId) this.replaceModelAtoms(current.model, nextObject);
        this.auxiliaryModels[index] = { model: current.model, object: nextObject };
      }
      if (scientificRevisionChanged) {
        // A scientific revision replaces canonical atom specs and reverse
        // identity bindings in-place.  Keep the viewer instance/models, but
        // advance generation so old picks cannot commit against the child.
        this.rendererGeneration += 1;
        this.container?.setAttribute("data-renderer-generation", String(this.rendererGeneration));
        this.structure = this.renderLoadResultForState(effectiveObjects[0]).structure;
        this.reverseIdentityMap.buildMany(effectiveObjects.map((object) => ({ structure: this.renderLoadResultForState(object).structure, objectId: object.objectId, stateId: stateForObject(object)?.id })), this.rendererGeneration);
        this.surfaceCoordinator.invalidate();
      }
    }
    const previousProjection = this.projection;
    this.workspaceObjects = effectiveObjects;
    this.primaryObjectEnabled = effectiveObjects[0]?.enabled ?? true;
    const interactionCameraChanged = interactionProjection ? cameraProjectionChanged(previousProjection, interactionProjection) : false;
    const interactionBackgroundChanged = interactionProjection ? !previousProjection || previousProjection.background !== interactionProjection.background : false;
    if (!this.viewer || !this.hasModel) return;
    if (interactionProjection) {
      this.projection = interactionProjection;
      if (interactionBackgroundChanged) this.viewer.setBackgroundColor(interactionProjection.background.color, 1);
      if (interactionCameraChanged) {
        const preservedView = this.viewer.getView();
        this.cameraState = { ...interactionProjection.camera, view: preservedView, defaultView: this.baselineView ? [...this.baselineView] : interactionProjection.camera.defaultView };
        this.viewer.setProjection(interactionProjection.camera.projectionMode);
        this.viewer.setCameraParameters({ fov: interactionProjection.camera.fov, orthographic: interactionProjection.camera.projectionMode === "orthographic" });
        this.applyClipping();
      }
    }
    if (objectSceneChanged) {
      this.renderPrimaryWorkspaceModel();
      this.renderAuxiliaryModels();
    }
    if (objectSceneChanged || effectiveObjects[0]) {
      // Keep the diagnostics bound to the same authoritative object that was
      // just installed. Camera-only updates still refresh camera metadata, but
      // do not rebuild model styles or surface geometry.
      this.diagnostics = buildRenderProjectionDiagnostics(this.renderLoadResultForState(effectiveObjects[0]).structure, effectiveObjects[0].projection);
      this.writeDiagnostics(this.diagnostics);
    }
    if (objectSceneChanged || modelStateChanged) this.applyWorkspaceSurfaces(effectiveObjects);
    if (objectSceneChanged || modelStateChanged) this.bindWorkspacePicking();
    this.writeWorkspaceProjectionState();
    this.container?.setAttribute("data-renderer-model-count", String(this.auxiliaryModels.length + 1));
    if (this.projection && objectLabelsChanged) {
      this.projectLabels(this.projection);
    }
    if (this.projection && objectInteractionChanged) {
      this.projectInteractionHighlights(this.projection);
    }
    if (objectSceneChanged || interactionCameraChanged || interactionBackgroundChanged || objectLabelsChanged || objectInteractionChanged || modelStateChanged) this.render();
  }

  setProjection(projection: RenderProjection, options: { preserveView?: boolean } = {}): void {
    this.ensureMounted();
    const previousProjection = this.projection;
    const preservedView = options.preserveView === false || !this.hasModel ? null : this.viewer!.getView();
    const sceneDirty = options.preserveView === false || !previousProjection || previousProjection.representation !== projection.representation || previousProjection.showProtein !== projection.showProtein || previousProjection.showLigand !== projection.showLigand || previousProjection.showWater !== projection.showWater || previousProjection.showIons !== projection.showIons || previousProjection.showOther !== projection.showOther || previousProjection.representationState !== projection.representationState || previousProjection.color !== projection.color;
    const backgroundDirty = !previousProjection || previousProjection.background !== projection.background;
    const cameraDirty = options.preserveView === false || !previousProjection || previousProjection.camera !== projection.camera;
    const labelsDirty = !previousProjection || previousProjection.labels !== projection.labels;
    const interactionDirty = !previousProjection || previousProjection.interaction !== projection.interaction;
    this.projection = projection;
    this.cameraState = { ...projection.camera, view: preservedView ?? projection.camera.view, defaultView: this.baselineView ? [...this.baselineView] : projection.camera.defaultView };
    if (backgroundDirty) this.viewer!.setBackgroundColor(projection.background.color, 1);
    if (cameraDirty) {
      this.viewer!.setProjection(projection.camera.projectionMode);
      this.viewer!.setCameraParameters({ fov: projection.camera.fov, orthographic: projection.camera.projectionMode === "orthographic" });
      if (!preservedView && this.validView(projection.camera.view)) this.viewer!.setView(projection.camera.view);
    }
    if (!this.hasModel || !this.structure) { this.diagnostics = emptyRenderProjectionDiagnostics(projection.representationState.presentationRevision, projection); this.writeDiagnostics(this.diagnostics); this.render(); return; }
    if (sceneDirty) this.applyProjection(projection);
    else {
      if (labelsDirty) this.projectLabels(projection);
      if (interactionDirty) this.projectInteractionHighlights(projection);
    }
    if (cameraDirty) this.applyClipping();
    this.writeDiagnostics(this.diagnostics);
    this.render();
  }

  setViewport(viewport: Viewport): void { this.viewport = viewport; this.cameraState = { ...this.cameraState, viewport }; if (!this.viewer || !this.hasModel) return; this.viewer.resize(); this.applyViewportTranslation(); if (this.cameraState.clippingMode === "auto") this.recalculateAutoClipping(); this.render(); }
  getCameraState(): CameraState { return { ...this.cameraState, view: this.viewer?.getView() ?? this.cameraState.view, defaultView: this.baselineView ? [...this.baselineView] : this.cameraState.defaultView, viewport: this.viewport }; }
  resize(): void { this.viewer?.resize(); this.render(); }
  rotate(angle = 15): void { if (!this.viewer) return; this.viewer.rotate(angle, "y"); this.lastCameraAction = "ROTATE"; this.renderCamera(); }
  pan(x = 70, y = 0): void { if (!this.viewer) return; this.viewer.translate(x, y); this.lastCameraAction = "PAN"; this.renderCamera(); }
  zoom(factor = 1.2): void { if (!this.viewer) return; this.viewer.zoom(factor); this.lastCameraAction = "ZOOM"; this.renderCamera(); }
  focus(): void { if (!this.viewer || !this.hasModel) return; this.lastCameraAction = "FIT"; this.frameToCanonicalBounds(false); this.renderCamera(); }
  center(): void { if (!this.viewer || !this.cameraController || !this.hasModel) return; this.lastCameraAction = "CENTER"; const target = this.boundsForCameraTarget(true); if (!target) return; this.cameraController.center(target.selection); this.cameraPivot = target.center; this.recalculateAutoClipping(); this.renderCamera(); }
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
    this.cameraController = null;
    this.measurementShapes = []; this.interactionShapes = []; this.analysisShapes = []; this.analysisOverlays = []; this.auxiliaryModels = []; this.workspaceObjects = []; this.workspaceSurfaceHandles.clear(); this.workspaceSurfaceRebuilds.clear(); this.styledModels.clear(); this.surfaceFallbackModels.clear(); this.surfaceReadyModels.clear(); this.primaryModel = null; this.primaryObjectEnabled = true; this.dotSurfaceShapes = []; this.surfaceIds = []; this.surfaceKinds = []; this.surfaceCoordinator.invalidate(); this.activeSurfaceKey = null; this.activeSurfaceGeometryKey = null; this.surfaceCache.clear(); this.measurements = []; this.container?.replaceChildren(); this.container = null; this.hasModel = false; this.structure = null; this.projection = null; this.cameraState = DEFAULT_CAMERA; this.cameraPivot = null; this.baselineView = null; this.baselinePivot = null; this.autoSlab = paddedClippingSlab(null); this.lastCameraAction = "NONE"; this.interactionHandlers = {}; this.diagnostics = emptyRenderProjectionDiagnostics();
  }
  getDiagnostics(): RenderProjectionDiagnostics { return this.diagnostics; }

  private ensureMounted(): void { if (!this.viewer) throw new Error("3Dmol viewer adapter is not mounted."); }
  private writeWorkspaceProjectionState(): void {
    if (!this.container) return;
    const state = Object.fromEntries(this.workspaceObjects.map((object) => [object.objectId, {
      enabled: object.enabled,
      currentStateId: object.currentStateId,
      allStates: object.allStates,
      representation: object.projection.representation,
      presentationRevision: object.projection.representationState.presentationRevision,
      directiveCount: object.projection.representationState.directives.length,
      explicitColorCount: Object.keys(object.projection.color.atomColors).length,
    }]));
    this.container.dataset.rendererObjectProjection = JSON.stringify(state);
  }
  private atomSpecsFor(structure: CanonicalMolecularStructure, objectId?: string): AtomSpec[] {
    const indexByStableId = new Map(structure.atoms.map((atom, index) => [atom.stableId, index]));
    const adjacency = new Map<string, Array<{ index: number; order: number }>>();
    structure.bonds.forEach((bond) => {
      const atom1 = indexByStableId.get(bond.atom1) ?? -1;
      const atom2 = indexByStableId.get(bond.atom2) ?? -1;
      if (atom1 < 0 || atom2 < 0) return;
      adjacency.set(bond.atom1, [...(adjacency.get(bond.atom1) ?? []), { index: atom2, order: orderNumber(bond.order) }]);
      adjacency.set(bond.atom2, [...(adjacency.get(bond.atom2) ?? []), { index: atom1, order: orderNumber(bond.order) }]);
    });
    return structure.atoms.map((atom, index) => ({ index, serial: atom.serial, atom: atom.atomName, elem: atom.element, resn: atom.residueName, resi: atom.residueNumber, icode: atom.insertionCode, chain: atom.chain, x: atom.x, y: atom.y, z: atom.z, hetflag: atom.recordType === "HETATM", b: atom.bFactor ?? undefined, q: atom.occupancy ?? undefined, alt: atom.altLoc ?? undefined, ss: secondaryCode(atom.secondaryStructure), bonds: (adjacency.get(atom.stableId) ?? []).map((entry) => entry.index), bondOrder: (adjacency.get(atom.stableId) ?? []).map((entry) => entry.order), properties: { canonicalStableId: atom.stableId, canonicalObjectId: objectId, formal_charge: atom.formalCharge, partial_charge: undefined } }));
  }

  private renderLoadResultForState(object: WorkspaceObject): StructureLoadResult {
    const state = stateForObject(object);
    if (!state) return object.loadResult;
    return { ...object.loadResult, structure: { ...object.loadResult.structure, atoms: object.loadResult.structure.atoms.map((atom) => ({ ...atom, ...(state.coordinates[atom.stableId] ?? {}) })) } };
  }

  private auxiliaryObjectsFor(objects: readonly WorkspaceObject[]): WorkspaceObject[] {
    const primary = objects[0];
    if (!primary) return [];
    const otherStates = (object: WorkspaceObject): WorkspaceObject[] => object.stateOrder.filter((stateId) => stateId !== object.currentStateId).map((stateId) => ({ ...object, currentStateId: stateId, allStates: false }));
    return [
      ...(primary.allStates ? otherStates(primary) : []),
      ...objects.slice(1).flatMap((object) => object.allStates ? [object, ...otherStates(object)] : [object]),
    ];
  }

  private sameWorkspaceModelLayout(previous: readonly WorkspaceObject[], next: readonly WorkspaceObject[]): boolean {
    if (!previous.length || !next.length) return false;
    const previousLayout = [previous[0]!.objectId, ...this.auxiliaryObjectsFor(previous).map((object) => object.objectId)];
    const nextLayout = [next[0]!.objectId, ...this.auxiliaryObjectsFor(next).map((object) => object.objectId)];
    return previousLayout.length === nextLayout.length && previousLayout.every((objectId, index) => objectId === nextLayout[index]);
  }

  private replaceModelAtoms(model: ReturnType<GLViewer["addModel"]>, object: WorkspaceObject): void {
    model.removeAtoms(model.selectedAtoms({}));
    model.addAtoms(this.atomSpecsFor(this.renderLoadResultForState(object).structure, object.objectId));
  }

  private renderWorkspaceModel(model: ReturnType<GLViewer["addModel"]>, object: WorkspaceObject): void {
    const structure = structureForWorkspaceObjectState(object);
    if (!object.enabled) { model.setStyle({}, { cartoon: { hidden: true }, stick: { hidden: true }, sphere: { hidden: true }, line: { hidden: true } }); this.styledModels.delete(model); this.surfaceFallbackModels.delete(model); this.surfaceReadyModels.delete(model); return; }
    const diagnostics = buildRenderProjectionDiagnostics(structure, object.projection);
    const surfaceOnly = diagnostics.directives.length > 0 && diagnostics.directives.every((directive) => isSurfacePrimitive(directive.primitive));
    if (surfaceOnly) {
      // Keep the prior atom presentation while native 3Dmol generates the
      // replacement surface. A fresh surface-only load gets a lightweight
      // atom fallback so it is never an empty viewport during generation.
      if (this.surfaceReadyModels.has(model)) return;
      if (!this.styledModels.has(model)) this.renderSurfaceFallback(model, structure, object.projection, diagnostics.directives[0]?.targetStableAtomIds ?? []);
      this.surfaceFallbackModels.add(model);
      return;
    }
    model.setStyle({}, {});
    this.styledModels.add(model);
    this.surfaceFallbackModels.delete(model);
    this.surfaceReadyModels.delete(model);
    const targetFor = (stableIds: readonly string[]): AtomSelectionSpec => {
      const ids = new Set(stableIds);
      return { predicate: (atom) => typeof atom.properties?.canonicalStableId === "string" && ids.has(atom.properties.canonicalStableId) };
    };
    for (const directive of diagnostics.directives) {
      const target = targetFor(directive.targetStableAtomIds);
      if (directive.primitive === "line") model.setStyle(target, styleFor("lines", object.projection, structure), true);
      if (directive.primitive === "stick") model.setStyle(target, styleFor(object.projection.representation === "licorice" ? "licorice" : "sticks", object.projection, structure), true);
      if (directive.primitive === "sphere") model.setStyle(target, styleFor("spheres", object.projection, structure, object.projection.representation === "ball-and-stick" ? "ball" : object.projection.representation === "space-filling" || object.projection.representation === "spheres" ? "space" : directive.representation === "NB_SPHERES" ? "nonbonded" : "default"), true);
      if (directive.primitive === "cross") model.setStyle(target, styleFor("cross", object.projection, structure), true);
      if (directive.primitive === "cartoon") model.setStyle(target, styleFor("cartoon", object.projection, structure, (directive.styleProfile as StyleProfile | undefined) ?? "cartoon"), true);
    }
    if (diagnostics.waterSphereContributors > 0) model.setStyle(targetFor(structure.atoms.filter((atom) => atom.isWater).map((atom) => atom.stableId)), styleFor("spheres", object.projection, structure, "water"), true);
  }
  private renderPrimaryWorkspaceModel(): void {
    const object = this.workspaceObjects[0];
    if (object && this.primaryModel) this.renderWorkspaceModel(this.primaryModel, object);
  }
  private renderAuxiliaryModels(): void {
    for (const { model, object } of this.auxiliaryModels) {
      this.renderWorkspaceModel(model, object);
    }
  }
  private renderSurfaceFallback(model: ViewerModel, structure: CanonicalMolecularStructure, projection: RenderProjection, targetStableAtomIds: readonly string[]): void {
    model.setStyle({}, {});
    const targetIds = new Set(targetStableAtomIds.length ? targetStableAtomIds : structure.atoms.map((atom) => atom.stableId));
    const target = { predicate: (atom: AtomSpec) => typeof atom.properties?.canonicalStableId === "string" && targetIds.has(atom.properties.canonicalStableId) };
    model.setStyle(target, styleFor("sticks", projection, structure), true);
    this.styledModels.add(model);
    this.surfaceFallbackModels.add(model);
    this.surfaceReadyModels.delete(model);
  }
  private clearSurfaceFallback(model: ViewerModel): void {
    if (this.surfaceFallbackModels.has(model)) model.setStyle({}, {});
    this.surfaceFallbackModels.delete(model);
    this.styledModels.delete(model);
    this.surfaceReadyModels.add(model);
  }
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
      if (!this.primaryObjectEnabled) return;
      const result = this.reverseIdentityMap.resolveAtomHit({ index: atom.index, serial: atom.serial, properties: atom.properties as Record<string, unknown> | undefined });
      if (result) this.interactionHandlers.onPick?.(result);
    };
    const onHover = (atom: AtomSpec) => {
      if (!this.primaryObjectEnabled) return;
      const result = this.reverseIdentityMap.resolveAtomHit({ index: atom.index, serial: atom.serial, properties: atom.properties as Record<string, unknown> | undefined });
      this.interactionHandlers.onHover?.(result);
    };
    const onUnhover = () => this.interactionHandlers.onHover?.(null);
    const all = this.canonicalSelection(() => true);
    this.viewer.setClickable(all, true, onClick);
    this.viewer.setHoverable(all, true, onHover, onUnhover);
  }

  private bindWorkspacePicking(): void {
    for (const { model, object } of this.auxiliaryModels) {
      model.setClickable({}, true, (atom: AtomSpec) => {
        if (!object.enabled) return;
        const result = this.reverseIdentityMap.resolveAtomHit({ index: atom.index, serial: atom.serial, properties: atom.properties as Record<string, unknown> | undefined });
        if (result) this.interactionHandlers.onPick?.(result);
      });
      model.setHoverable({}, true, (atom: AtomSpec) => {
        if (!object.enabled) return;
        const result = this.reverseIdentityMap.resolveAtomHit({ index: atom.index, serial: atom.serial, properties: atom.properties as Record<string, unknown> | undefined });
        this.interactionHandlers.onHover?.(result);
      }, () => this.interactionHandlers.onHover?.(null));
    }
  }

  private applyProjection(projection: RenderProjection): void {
    this.performance.projectionRebuilds += 1;
    const viewer = this.viewer!; const structure = this.structure!; const diagnostics = buildRenderProjectionDiagnostics(structure, projection); this.diagnostics = diagnostics; this.writeDiagnostics(diagnostics);
    const surfaceOnly = diagnostics.directives.length > 0 && diagnostics.directives.every((directive) => isSurfacePrimitive(directive.primitive));
    const preservePriorGeometry = surfaceOnly && this.primaryModel !== null && (this.styledModels.has(this.primaryModel) || this.surfaceReadyModels.has(this.primaryModel));
    if (!preservePriorGeometry) {
      if (surfaceOnly && this.primaryModel) this.renderSurfaceFallback(this.primaryModel, structure, projection, diagnostics.directives[0]?.targetStableAtomIds ?? []);
      else viewer.setStyle({}, {});
    }
    if (!this.primaryObjectEnabled) {
      viewer.setStyle({}, { cartoon: { hidden: true }, stick: { hidden: true }, sphere: { hidden: true }, line: { hidden: true } });
      this.projectInteractionHighlights(projection);
      this.projectLabels(projection);
      this.renderAuxiliaryModels();
      this.bindWorkspacePicking();
      return;
    }
    for (const directive of diagnostics.directives) {
      const target = this.canonicalSelection((atom) => directive.targetStableAtomIds.includes(atom.stableId));
      if (directive.primitive === "line") viewer.addStyle(target, styleFor("lines", projection, structure, directive.styleProfile === "line" ? "default" : "default"));
      if (directive.primitive === "stick") viewer.addStyle(target, styleFor(projection.representation === "licorice" ? "licorice" : "sticks", projection, structure));
      if (directive.primitive === "sphere") viewer.addStyle(target, styleFor("spheres", projection, structure, projection.representation === "ball-and-stick" ? "ball" : projection.representation === "space-filling" || projection.representation === "spheres" ? "space" : directive.representation === "NB_SPHERES" ? "nonbonded" : "default"));
      if (directive.primitive === "cross") viewer.addStyle(target, styleFor("cross", projection, structure));
      if (directive.primitive === "cartoon" && directive.styleProfile !== "putty") viewer.addStyle(target, styleFor("cartoon", projection, structure, (directive.styleProfile as StyleProfile | undefined) ?? "cartoon"));
      if (directive.primitive === "cartoon" && directive.styleProfile === "putty") this.applyPuttyStyles(target, projection, structure, directive.targetStableAtomIds);
    }
    if (!surfaceOnly && this.primaryModel) {
      this.styledModels.add(this.primaryModel);
      this.surfaceFallbackModels.delete(this.primaryModel);
      this.surfaceReadyModels.delete(this.primaryModel);
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
    this.setAnalysisOverlays(this.analysisOverlays);
    this.renderPrimaryWorkspaceModel();
    this.renderAuxiliaryModels();
    this.bindWorkspacePicking();
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

  private clearStandaloneSurfaceHandles(): void {
    if (!this.viewer) return;
    this.surfaceIds.forEach((surfaceId) => this.removeSurfaceIfPresent(surfaceId));
    this.dotSurfaceShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.surfaceIds = [];
    this.surfaceKinds = [];
    this.dotSurfaceShapes = [];
    this.activeSurfaceKey = null;
    this.activeSurfaceGeometryKey = null;
    this.surfaceCoordinator.invalidate();
  }

  private clearWorkspaceSurfaceHandle(handle: SurfaceHandleState): void {
    handle.surfaceIds.forEach((surfaceId) => this.removeSurfaceIfPresent(surfaceId));
    handle.dotSurfaceShapes.forEach((shape) => this.viewer?.removeShape(shape));
  }

  private removeSurfaceIfPresent(surfaceId: number): void {
    if (this.viewer?.getSurface(surfaceId)) this.viewer.removeSurface(surfaceId);
  }

  private workspaceSurfaceEntries(objects: readonly WorkspaceObject[]): Array<{ key: string; object: WorkspaceObject; structure: CanonicalMolecularStructure; projection: RenderProjection; model: ReturnType<GLViewer["addModel"]> }> {
    const primary = objects[0];
    if (!primary || !this.primaryModel) return [];
    const entries: Array<{ key: string; object: WorkspaceObject; structure: CanonicalMolecularStructure; projection: RenderProjection; model: ReturnType<GLViewer["addModel"]> }> = [{
      key: `${primary.objectId}:${primary.currentStateId}`,
      object: primary,
      structure: this.renderLoadResultForState(primary).structure,
      projection: primary.projection,
      model: this.primaryModel,
    }];
    for (const { model, object } of this.auxiliaryModels) entries.push({ key: `${object.objectId}:${object.currentStateId}`, object, structure: this.renderLoadResultForState(object).structure, projection: object.projection, model });
    return entries;
  }

  private selectionForModel(structure: CanonicalMolecularStructure, model: ReturnType<GLViewer["addModel"]>, stableIds?: readonly string[]): AtomSelectionSpec {
    const indices = stableIds ? new Set(structure.atoms.map((atom, index) => stableIds.includes(atom.stableId) ? index : -1).filter((index) => index >= 0)) : null;
    return { model, predicate: (atom) => atom.index !== undefined && (indices ? indices.has(atom.index) : true) };
  }

  /**
   * Project surfaces per canonical object/state.  3Dmol's surface registry is
   * global to a viewer, so keeping handles in this adapter is what prevents a
   * style or state change on object A from removing or rebuilding object B's
   * surface.
   */
  private applyWorkspaceSurfaces(objects: readonly WorkspaceObject[]): void {
    if (!this.viewer) return;
    const surfaceRun = ++this.workspaceSurfaceGeneration;
    const entries = this.workspaceSurfaceEntries(objects);
    const liveKeys = new Set(entries.map((entry) => entry.key));
    for (const [key, handle] of this.workspaceSurfaceHandles) {
      if (!liveKeys.has(key)) { this.clearWorkspaceSurfaceHandle(handle); this.workspaceSurfaceHandles.delete(key); }
    }
    let pointCount = 0;
    let readyCount = 0;
    for (const entry of entries) {
      if (!entry.object.enabled) continue;
      const diagnostics = buildRenderProjectionDiagnostics(entry.structure, entry.projection);
      const surfaceDirectives = diagnostics.directives.filter((directive) => directive.primitive === "surface" || directive.primitive === "mesh" || directive.primitive === "dots");
      const state = stateForObject(entry.object);
      const coordinateContext = `${entry.structure.id}:coordinates:${state?.coordinateHash ?? entry.structure.scientificHash}`;
      const geometryKey = JSON.stringify({ coordinateContext, directives: surfaceDirectives.map((directive) => ({ primitive: directive.primitive, profile: directive.surfaceProfile, cache: directive.surfaceCacheKey, target: directive.targetStableAtomIds })), probeRadius: entry.projection.representationState.parameters.surfaceProbeRadius, quality: entry.projection.representationState.parameters.surfaceQuality, sampling: entry.projection.representationState.parameters.dotDensity });
      const materialKey = JSON.stringify({ color: entry.projection.color, surfaceOpacity: entry.projection.representationState.parameters.surfaceOpacity, meshOpacity: entry.projection.representationState.parameters.meshOpacity, meshWidth: entry.projection.representationState.parameters.meshWidth, dotOpacity: entry.projection.representationState.parameters.dotOpacity });
      const previous = this.workspaceSurfaceHandles.get(entry.key);
      if (!surfaceDirectives.length) {
        if (previous) { this.clearWorkspaceSurfaceHandle(previous); this.workspaceSurfaceHandles.delete(entry.key); }
        continue;
      }
      if (previous && previous.geometryKey === geometryKey && previous.materialKey === materialKey) { readyCount += 1; continue; }
      if (previous && previous.geometryKey !== geometryKey && !this.surfaceFallbackModels.has(entry.model)) this.renderSurfaceFallback(entry.model, entry.structure, entry.projection, surfaceDirectives[0]?.targetStableAtomIds ?? []);
      if (previous) this.clearWorkspaceSurfaceHandle(previous);
      const handle: SurfaceHandleState = { surfaceIds: [], surfaceKinds: [], dotSurfaceShapes: [], geometryKey, materialKey };
      this.workspaceSurfaceHandles.set(entry.key, handle);
      this.workspaceSurfaceRebuilds.set(entry.key, (this.workspaceSurfaceRebuilds.get(entry.key) ?? 0) + 1);
      const atomByStableId = new Map(entry.structure.atoms.map((atom) => [atom.stableId, atom]));
      for (const directive of surfaceDirectives) {
        const target = this.selectionForModel(entry.structure, entry.model, directive.targetStableAtomIds);
        const contributors = this.selectionForModel(entry.structure, entry.model);
        const kind = directive.surfaceProfile ?? "VDW";
        if (directive.primitive === "dots") {
          const profile = kind === "DOT_SURFACE" ? "SES" : kind === "DOTS" ? "VDW" : kind;
          const request = surfaceRequestFor(entry.structure, kind, directive.targetStableAtomIds, entry.structure.atoms.map((atom) => atom.stableId), { probeRadius: profile === "SAS" || profile === "SES" ? entry.projection.representationState.parameters.surfaceProbeRadius : 0, quality: entry.projection.representationState.parameters.surfaceQuality, sampling: entry.projection.representationState.parameters.dotDensity }, { coordinateContext });
          const cacheRequest = { ...request, profileId: directive.surfaceCacheKey ?? request.profileId };
          const cached = this.surfaceCache.get(cacheRequest);
          if (cached) this.performance.surfaceCacheHits += 1; else this.performance.surfaceCacheMisses += 1;
          const points = cached ?? buildDotSurfacePoints(entry.structure, directive.targetStableAtomIds, entry.structure.atoms.map((atom) => atom.stableId), profile, entry.projection.representationState.parameters.surfaceProbeRadius, entry.projection.representationState.parameters.surfaceQuality, entry.projection.representationState.parameters.dotDensity, 2);
          if (!cached) this.performance.surfaceGenerations += 1;
          this.surfaceCache.set(cacheRequest, points);
          pointCount += points.length;
          if (this.workspaceSurfaceHandles.get(entry.key) !== handle) continue;
          const displayPoints = boundedDisplayPoints(points, 1600);
          const pointBatches = new Map<string, SurfacePoint[]>();
          for (const point of displayPoints) {
            const atom = atomByStableId.get(point.stableAtomId);
            const pointColor = atom ? resolveProjectedAtomColor(entry.projection.color, "DOTS", atom, entry.structure, colorRegistry.cssColor(entry.projection.color)).color : "#8fd9ff";
            const batchColor = brightenHex(quantizeHex(pointColor));
            pointBatches.set(batchColor, [...(pointBatches.get(batchColor) ?? []), point]);
          }
          for (const [batchColor, batchPoints] of pointBatches) {
            const shape = this.viewer.addShape({ color: batchColor, opacity: entry.projection.representationState.parameters.dotOpacity, linewidth: entry.projection.representationState.parameters.meshWidth });
            for (const point of batchPoints) shape.addSphere({ center: point, radius: kind === "DOT_SURFACE" ? 0.68 : 0.82 });
            handle.dotSurfaceShapes.push(shape);
          }
          this.performance.dotGenerations += cached ? 0 : 1;
          readyCount += 1;
          this.clearSurfaceFallback(entry.model);
          continue;
        }
        if (directive.primitive === "mesh") {
          let meshGenerationRecorded = false;
          const recordMeshGeneration = () => {
            if (meshGenerationRecorded) return;
            meshGenerationRecorded = true;
            this.performance.meshGenerations += 1;
            this.container?.setAttribute("data-renderer-mesh-generations", String(this.performance.meshGenerations));
          };
          // 3Dmol may invoke the completion callback asynchronously for a
          // workspace model. Count the accepted mesh generation at request
          // time so diagnostics are deterministic even before the native
          // surface callback returns; the local guard prevents double-counts.
          recordMeshGeneration();
          const result = this.viewer.addSurface("VDW", surfaceStyleFor(entry.projection, entry.structure, entry.projection.representationState.parameters.meshOpacity, true), target, contributors, undefined, (surfaceId: number) => {
            if (this.workspaceSurfaceGeneration !== surfaceRun || this.workspaceSurfaceHandles.get(entry.key) !== handle) { this.removeSurfaceIfPresent(surfaceId); return; }
            if (!handle.surfaceIds.includes(surfaceId)) { handle.surfaceIds.push(surfaceId); handle.surfaceKinds.push("mesh"); }
            recordMeshGeneration();
            this.writeDiagnostics(this.diagnostics);
            this.container?.setAttribute("data-surface-ready", "true");
            this.container?.setAttribute("data-surface-state", "ready");
            this.clearSurfaceFallback(entry.model);
            this.render();
          });
          if (typeof result === "number") { handle.surfaceIds.push(result); handle.surfaceKinds.push("mesh"); recordMeshGeneration(); }
          continue;
        }
        const surfaceType = kind === "SAS" ? "SAS" : kind === "SES" ? "SES" : "VDW";
        const result = this.viewer.addSurface(surfaceType, surfaceStyleFor(entry.projection, entry.structure, entry.projection.representationState.parameters.surfaceOpacity), target, contributors, undefined, (surfaceId: number) => {
          if (this.workspaceSurfaceGeneration !== surfaceRun || this.workspaceSurfaceHandles.get(entry.key) !== handle) { this.removeSurfaceIfPresent(surfaceId); return; }
          if (!handle.surfaceIds.includes(surfaceId)) { handle.surfaceIds.push(surfaceId); handle.surfaceKinds.push("surface"); }
          readyCount += 1;
          this.container?.setAttribute("data-surface-ready", "true");
          this.container?.setAttribute("data-surface-state", "ready");
          this.clearSurfaceFallback(entry.model);
          this.render();
        });
        if (typeof result === "number") { handle.surfaceIds.push(result); handle.surfaceKinds.push("surface"); }
      }
    }
    if (this.container) {
      this.container.dataset.rendererSurfaceObjectCount = String(this.workspaceSurfaceHandles.size);
      this.container.dataset.rendererSurfacePointCount = String(pointCount);
      const state = this.workspaceSurfaceHandles.size ? (readyCount ? "ready" : "generating") : "idle";
      this.container.dataset.surfaceState = state;
      if (state === "ready") this.container.setAttribute("data-surface-ready", "true"); else this.container.removeAttribute("data-surface-ready");
      this.container.dataset.rendererSurfaceRebuilds = JSON.stringify(Object.fromEntries(this.workspaceSurfaceRebuilds));
      this.writeDiagnostics(this.diagnostics);
    }
  }

  private applySurfaceDirectives(diagnostics: RenderProjectionDiagnostics, projection: RenderProjection): void {
    if (!this.viewer || !this.structure) return;
    const surfaceDirectives = diagnostics.directives.filter((directive) => directive.primitive === "surface" || directive.primitive === "mesh" || directive.primitive === "dots");
    const materialKey = JSON.stringify(surfaceDirectives.map((directive) => ({ primitive: directive.primitive, opacity: directive.primitive === "mesh" ? projection.representationState.parameters.meshOpacity : directive.primitive === "dots" ? projection.representationState.parameters.dotOpacity : projection.representationState.parameters.surfaceOpacity, meshWidth: directive.primitive === "mesh" ? projection.representationState.parameters.meshWidth : undefined, color: projection.color })));
    const geometryKey = surfaceDirectives.map((directive) => `${directive.surfaceCacheKey ?? ""}${directive.primitive === "dots" ? `::color:${JSON.stringify(projection.color)}` : ""}`).join("||");
    const nextKey = `${geometryKey}::${materialKey}`;
    if (!surfaceDirectives.length) {
      this.viewer.removeAllSurfaces();
      this.dotSurfaceShapes.forEach((shape) => this.viewer?.removeShape(shape));
      this.dotSurfaceShapes = [];
      this.surfaceIds = [];
      this.surfaceKinds = [];
      this.activeSurfaceKey = null;
      this.activeSurfaceGeometryKey = null;
      this.surfaceCoordinator.invalidate();
      this.container?.removeAttribute("data-surface-ready");
      this.container?.removeAttribute("data-surface-state");
      this.container?.removeAttribute("data-surface-generation");
      this.container?.removeAttribute("data-renderer-surface-point-count");
      return;
    }
    if (this.activeSurfaceKey === nextKey) {
      this.surfaceIds.forEach((surfaceId, index) => {
        const kind = this.surfaceKinds[index] ?? "surface";
        const opacity = kind === "mesh" ? projection.representationState.parameters.meshOpacity : projection.representationState.parameters.surfaceOpacity;
        this.viewer!.setSurfaceMaterialStyle(surfaceId, surfaceStyleFor(projection, this.structure!, opacity, kind === "mesh"));
      });
      return;
    }
    if (this.activeSurfaceGeometryKey === geometryKey) {
      this.surfaceIds.forEach((surfaceId, index) => {
        const kind = this.surfaceKinds[index] ?? "surface";
        const opacity = kind === "mesh" ? projection.representationState.parameters.meshOpacity : projection.representationState.parameters.surfaceOpacity;
        this.viewer!.setSurfaceMaterialStyle(surfaceId, surfaceStyleFor(projection, this.structure!, opacity, kind === "mesh"));
      });
      const dotOpacity = projection.representationState.parameters.dotOpacity;
      this.dotSurfaceShapes.forEach((shape) => shape.updateStyle({ opacity: dotOpacity }));
      this.activeSurfaceKey = nextKey;
      return;
    }
    if (this.primaryModel && this.surfaceReadyModels.has(this.primaryModel)) this.renderSurfaceFallback(this.primaryModel, this.structure, projection, surfaceDirectives[0]?.targetStableAtomIds ?? []);
    this.viewer.removeAllSurfaces();
    this.dotSurfaceShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.dotSurfaceShapes = [];
    this.surfaceIds = [];
    this.surfaceKinds = [];
    this.activeSurfaceKey = nextKey;
    this.activeSurfaceGeometryKey = geometryKey;
    const generation = this.surfaceCoordinator.begin();
    this.container?.setAttribute("data-surface-generation", String(generation));
    this.container?.setAttribute("data-surface-state", "generating");
    const structure = this.structure;
    const atomByStableId = new Map(structure.atoms.map((atom) => [atom.stableId, atom]));
    for (const directive of surfaceDirectives) {
      const target = this.canonicalSelection((atom) => directive.targetStableAtomIds.includes(atom.stableId));
      const contributors = this.canonicalSelection(() => true);
      const kind = directive.surfaceProfile ?? "VDW";
      if (directive.primitive === "dots") {
        const profile = kind === "DOT_SURFACE" ? "SES" : kind === "DOTS" ? "VDW" : kind;
        const request = surfaceRequestFor(structure, kind, directive.targetStableAtomIds, structure.atoms.map((atom) => atom.stableId), { probeRadius: profile === "SAS" || profile === "SES" ? projection.representationState.parameters.surfaceProbeRadius : 0, quality: projection.representationState.parameters.surfaceQuality, sampling: projection.representationState.parameters.dotDensity });
        const cacheRequest = { ...request, profileId: directive.surfaceCacheKey ?? request.profileId };
        const cached = this.surfaceCache.get(cacheRequest);
        if (cached) this.performance.surfaceCacheHits += 1; else this.performance.surfaceCacheMisses += 1;
        const points = cached ?? buildDotSurfacePoints(structure, directive.targetStableAtomIds, structure.atoms.map((atom) => atom.stableId), profile, projection.representationState.parameters.surfaceProbeRadius, projection.representationState.parameters.surfaceQuality, projection.representationState.parameters.dotDensity, 2);
        if (!cached) this.performance.surfaceGenerations += 1;
        this.surfaceCache.set(cacheRequest, points);
        this.container?.setAttribute("data-renderer-surface-point-count", String(points.length));
        if (!this.surfaceCoordinator.isCurrent(generation)) continue;
        const displayPoints = boundedDisplayPoints(points, 1600);
        const pointBatches = new Map<string, SurfacePoint[]>();
        for (const point of displayPoints) {
          const atom = atomByStableId.get(point.stableAtomId);
          const pointColor = atom ? resolveProjectedAtomColor(projection.color, "DOTS", atom, structure, colorRegistry.cssColor(projection.color)).color : "#8fd9ff";
          const batchColor = brightenHex(quantizeHex(pointColor));
          pointBatches.set(batchColor, [...(pointBatches.get(batchColor) ?? []), point]);
        }
        for (const [batchColor, batchPoints] of pointBatches) {
          const shape = this.viewer.addShape({ color: batchColor, opacity: projection.representationState.parameters.dotOpacity, linewidth: projection.representationState.parameters.meshWidth });
          for (const point of batchPoints) shape.addSphere({ center: point, radius: kind === "DOT_SURFACE" ? 0.68 : 0.82 });
          this.dotSurfaceShapes.push(shape);
        }
        this.performance.dotGenerations += cached ? 0 : 1;
        this.container?.setAttribute("data-surface-ready", "true");
        this.container?.setAttribute("data-surface-state", "ready");
        if (this.primaryModel) this.clearSurfaceFallback(this.primaryModel);
        continue;
      }
      if (directive.primitive === "mesh") {
        let meshGenerationRecorded = false;
        const recordMeshGeneration = () => {
          if (meshGenerationRecorded) return;
          meshGenerationRecorded = true;
          this.performance.meshGenerations += 1;
          this.writeDiagnostics(this.diagnostics);
        };
        // Surface completion can be deferred by 3Dmol. Record the accepted
        // mesh request immediately so the diagnostics do not depend on a
        // renderer callback race.
        recordMeshGeneration();
        const meshStyle = surfaceStyleFor(projection, structure, projection.representationState.parameters.meshOpacity, true);
        const result = this.viewer.addSurface("VDW", meshStyle, target, contributors, undefined, (surfaceId: number) => {
          if (!this.surfaceCoordinator.isCurrent(generation) || this.activeSurfaceKey !== nextKey) {
            this.removeSurfaceIfPresent(surfaceId);
            return;
          }
          this.surfaceIds.push(surfaceId);
          this.surfaceKinds.push("mesh");
          recordMeshGeneration();
          this.writeDiagnostics(this.diagnostics);
          this.container?.setAttribute("data-renderer-surface-point-count", "native");
          this.container?.setAttribute("data-surface-ready", "true");
          this.container?.setAttribute("data-surface-state", "ready");
          if (this.primaryModel) this.clearSurfaceFallback(this.primaryModel);
          this.render();
        });
        void result;
        continue;
      }
      const surfaceType = kind === "SAS" ? "SAS" : kind === "SES" ? "SES" : "VDW";
      const opacity = projection.representationState.parameters.surfaceOpacity;
      const result = this.viewer.addSurface(surfaceType, surfaceStyleFor(projection, structure, opacity), target, contributors, undefined, (surfaceId: number) => {
        if (!this.surfaceCoordinator.isCurrent(generation) || this.activeSurfaceKey !== nextKey) {
          this.removeSurfaceIfPresent(surfaceId);
          return;
        }
        if (!this.surfaceIds.includes(surfaceId)) {
          this.surfaceIds.push(surfaceId);
          this.surfaceKinds.push("surface");
        }
        this.container?.setAttribute("data-surface-ready", "true");
        this.container?.setAttribute("data-surface-state", "ready");
        if (this.primaryModel) this.clearSurfaceFallback(this.primaryModel);
        this.render();
      });
      if (typeof result === "number" && this.surfaceCoordinator.isCurrent(generation)) { this.surfaceIds.push(result); this.surfaceKinds.push("surface"); }
    }
  }

  private projectInteractionHighlights(projection: RenderProjection): void {
    if (!this.viewer || !this.structure) return;
    this.interactionShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.interactionShapes = [];
    const hoverId = projection.interaction.hoveredAtomId;
    const pickedId = projection.interaction.pickedAtomId;
    // Keep selection state complete in the presentation model; cap only per-atom
    // highlight geometry so selecting an entire large structure stays responsive.
    const selectedIds = new Set(projection.interaction.selectedAtomIds.slice(0, 128));
    if (this.container) {
      this.container.dataset.selectionIndicator = selectedIds.size ? "visible" : "none";
      this.container.dataset.selectionHighlightedAtomCount = String(selectedIds.size);
      this.container.dataset.selectionHighlightLimit = "128";
    }
    const workspaceAtoms = this.workspaceObjects.length ? this.workspaceObjects.flatMap((object) => structureForWorkspaceObjectState(object).atoms.map((atom) => ({ ...atom, stableId: workspaceScopedStableAtomId(object.objectId, atom.stableId) }))) : this.structure.atoms;
    const addMarker = (stableId: string, color: string, radius: number, wireframe: boolean, opacity: number) => {
      const atoms = workspaceAtoms.filter((candidate) => candidate.stableId === stableId || candidate.stableId.endsWith(`::${stableId}`));
      for (const atom of atoms) this.interactionShapes.push(this.viewer!.addSphere({ center: atom, radius, color, wireframe, opacity }));
    };
    if (hoverId) addMarker(hoverId, "#31d8c4", 0.18, true, 0.7);
    if (pickedId) addMarker(pickedId, "#e5ae32", 0.28, true, 0.8);
    if (selectedIds.size) {
      const selectionShape = this.viewer.addShape({ color: "#55d9ff", opacity: 0.28 });
      for (const selectedId of selectedIds) {
        for (const atom of workspaceAtoms.filter((candidate) => candidate.stableId === selectedId || candidate.stableId.endsWith(`::${selectedId}`))) selectionShape.addSphere({ center: atom, radius: 0.22, wireframe: false, opacity: 0.28 });
      }
      this.interactionShapes.push(selectionShape);
    }
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
    this.render();
  }

  private projectMeasurementShapes(): void {
    if (!this.viewer) return;
    this.measurementShapes.forEach((shape) => this.viewer?.removeShape(shape));
    this.measurementShapes = [];
    if (!this.structure) return;
    for (const measurement of this.measurements) {
      const targetObject = measurement.objectId ? this.workspaceObjects.find((object) => object.objectId === measurement.objectId) : undefined;
      const targetStructure = targetObject ? structureForWorkspaceObjectState(targetObject) : this.structure;
      if (!measurement.presentation.visible || measurementStatus(measurement, targetStructure) !== "CURRENT") continue;
      const atomMap = new Map(targetStructure.atoms.map((atom) => [atom.stableId, atom]));
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
    this.container.dataset.rendererNonbondedEligible = String(diagnostics.representation.NONBONDED.eligibleAtomCount ?? 0);
    this.container.dataset.rendererNonbondedSphereEligible = String(diagnostics.representation.NB_SPHERES.eligibleAtomCount ?? 0);
    this.container.dataset.rendererWaterSpheres = String(diagnostics.waterSphereContributors);
    this.container.dataset.rendererIonSpheres = String(diagnostics.ionSphereContributors);
    this.container.dataset.rendererSurfaceContributors = String(diagnostics.surfaceContributors);
    this.container.dataset.rendererMeshContributors = String(diagnostics.meshContributors);
    this.container.dataset.rendererDotContributors = String(diagnostics.dotContributors);
    this.container.dataset.rendererSurfaceProfile = diagnostics.surfaceProfile ?? "";
    this.container.dataset.rendererSurfaceCacheKey = diagnostics.surfaceCacheKey ?? "";
    this.container.dataset.rendererCanonicalBondSource = diagnostics.stickCylinderContributors > 0 || diagnostics.lineContributors > 0 ? "canonical" : "none";
    this.container.dataset.rendererModelLoads = String(this.modelLoadCount);
    this.container.dataset.rendererViewerCreations = String(this.performance.viewerCreations);
    this.container.dataset.rendererSceneRebuilds = String(this.performance.sceneRebuilds);
    this.container.dataset.rendererProjectionRebuilds = String(this.performance.projectionRebuilds);
    this.container.dataset.rendererRenderCalls = String(this.performance.renderCalls);
    this.container.dataset.rendererSurfaceCacheHits = String(this.performance.surfaceCacheHits);
    this.container.dataset.rendererSurfaceCacheMisses = String(this.performance.surfaceCacheMisses);
    this.container.dataset.rendererSurfaceGenerations = String(this.performance.surfaceGenerations);
    this.container.dataset.rendererMeshGenerations = String(this.performance.meshGenerations);
    this.container.dataset.rendererDotGenerations = String(this.performance.dotGenerations);
    this.container.dataset.rendererStaleSurfaceResults = String(this.performance.staleSurfaceResults);
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
  private renderCamera(): void {
    if (!this.viewer) return;
    // The automatic slab is derived from canonical bounds and the current
    // pivot, not from the camera quaternion or zoom. Recomputing it for every
    // pointer frame scans all atoms and is pure interaction overhead on large
    // structures such as 4DJW. Recalculate only when the target/projection
    // changes; camera presentation remains native to 3Dmol.
    this.cameraState = { ...this.cameraState, view: this.viewer.getView(), defaultView: this.baselineView ? [...this.baselineView] : this.cameraState.defaultView, viewport: this.viewport };
    if (this.container) this.writeDiagnostics(this.diagnostics);
    this.render();
  }
  private render(): void { if (!this.viewer) return; this.performance.renderCalls += 1; this.viewer.render(); }
}
