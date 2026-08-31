import type { CanonicalMolecularStructure, ProjectPresentationState } from "@molecular/contracts";

export const REPRESENTATION_TYPES = ["LINES", "STICKS", "SPHERES", "CARTOON", "RIBBON", "SURFACE", "MESH", "DOTS", "NONBONDED", "NB_SPHERES"] as const;
export type RepresentationType = (typeof REPRESENTATION_TYPES)[number];
export type RepresentationMask = number;

export const REPRESENTATION_MASKS: Record<RepresentationType, RepresentationMask> = {
  LINES: 1 << 0,
  STICKS: 1 << 1,
  SPHERES: 1 << 2,
  CARTOON: 1 << 3,
  RIBBON: 1 << 4,
  SURFACE: 1 << 5,
  MESH: 1 << 6,
  DOTS: 1 << 7,
  NONBONDED: 1 << 8,
  NB_SPHERES: 1 << 9,
};

export const REPRESENTATION_PRESETS = {
  WIRE: REPRESENTATION_MASKS.LINES | REPRESENTATION_MASKS.NONBONDED,
  LICORICE: REPRESENTATION_MASKS.STICKS | REPRESENTATION_MASKS.NB_SPHERES,
  BALL_AND_STICK: REPRESENTATION_MASKS.STICKS | REPRESENTATION_MASKS.SPHERES,
} as const;

export const REPRESENTATION_STYLES = ["lines", "sticks", "spheres", "ball-and-stick", "licorice", "cartoon"] as const;
export type RepresentationStyle = (typeof REPRESENTATION_STYLES)[number];

export const COLOR_MODES = ["element", "chain", "object", "residue", "secondary-structure", "uniform", "named", "custom"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export type ColorState = {
  mode: ColorMode;
  colorId: string | null;
  customHex: string | null;
  profileRef: "PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69";
};

export const BACKGROUND_PRESETS = ["Black", "White", "Dark Gray", "Light Gray", "Navy", "Deep Blue", "Custom"] as const;
export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];

export type BackgroundColorState = {
  preset: BackgroundPreset;
  color: string;
};

export type CameraState = {
  view: number[] | null;
  defaultView: number[] | null;
  viewport: { width: number; height: number; visibleTop: number; visibleBottom: number; visibleLeft: number; visibleRight: number } | null;
};

export type RepresentationDirective = {
  operation: "SHOW" | "HIDE" | "SHOW_AS";
  mask: RepresentationMask;
  targetStableAtomIds: string[];
  presentationRevision: number;
};

export type RepresentationState = {
  presentationRevision: number;
  objectEnabled: Record<string, boolean>;
  atomRepMasks: Record<string, RepresentationMask>;
  directives: RepresentationDirective[];
};

export type RenderProjection = {
  representation: RepresentationStyle;
  showProtein: boolean;
  showLigand: boolean;
  showWater: boolean;
  showIons: boolean;
  showOther: boolean;
  representationState: RepresentationState;
  color: ColorState;
  background: BackgroundColorState;
  camera: CameraState;
};

export const DEFAULT_COLOR: ColorState = {
  mode: "element",
  colorId: null,
  customHex: null,
  profileRef: "PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69",
};

export const DEFAULT_BACKGROUND: BackgroundColorState = { preset: "Black", color: "#05070a" };
export const DEFAULT_CAMERA: CameraState = { view: null, defaultView: null, viewport: null };

const maskForStyle = (style: RepresentationStyle): RepresentationMask => {
  if (style === "lines") return REPRESENTATION_MASKS.LINES;
  if (style === "sticks") return REPRESENTATION_MASKS.STICKS;
  if (style === "spheres") return REPRESENTATION_MASKS.SPHERES;
  if (style === "ball-and-stick") return REPRESENTATION_PRESETS.BALL_AND_STICK;
  if (style === "licorice") return REPRESENTATION_PRESETS.LICORICE;
  return REPRESENTATION_MASKS.CARTOON;
};

const atomMaskForStyle = (structure: CanonicalMolecularStructure, atom: CanonicalMolecularStructure["atoms"][number], style: RepresentationStyle): RepresentationMask => {
  if (style !== "cartoon") return maskForStyle(style);
  if (atom.isPolymer) return REPRESENTATION_MASKS.CARTOON;
  if (atom.isLigand) return REPRESENTATION_MASKS.STICKS;
  if (atom.isIon) return REPRESENTATION_MASKS.SPHERES;
  // Water is hidden by the default layer visibility, not by removing its
  // representation membership. This keeps the component toggle independent
  // from the active representation and gives water an explicit sphere profile.
  if (atom.isWater) return REPRESENTATION_MASKS.SPHERES;
  return REPRESENTATION_MASKS.STICKS;
};

export const createRepresentationState = (structure: CanonicalMolecularStructure | null, style: RepresentationStyle = "cartoon"): RepresentationState => ({
  presentationRevision: 1,
  objectEnabled: structure ? { [structure.id]: true } : {},
  atomRepMasks: structure ? Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, atomMaskForStyle(structure, atom, style)])) : {},
  directives: [],
});

export const createDefaultRenderProjection = (structure: CanonicalMolecularStructure | null = null): RenderProjection => ({
  representation: "cartoon",
  showProtein: true,
  showLigand: true,
  showWater: false,
  showIons: true,
  showOther: true,
  representationState: createRepresentationState(structure),
  color: DEFAULT_COLOR,
  background: DEFAULT_BACKGROUND,
  camera: DEFAULT_CAMERA,
});

export const setProjectionStyle = (projection: RenderProjection, structure: CanonicalMolecularStructure | null, style: RepresentationStyle): RenderProjection => ({
  ...projection,
  representation: style,
  representationState: structure ? { ...createRepresentationState(structure, style), presentationRevision: projection.representationState.presentationRevision + 1 } : projection.representationState,
});

export const setLayerVisibility = (projection: RenderProjection, layer: "showProtein" | "showLigand" | "showWater" | "showIons" | "showOther"): RenderProjection => ({
  ...projection,
  [layer]: !projection[layer],
});

export const applyRepresentationOperation = (state: RepresentationState, operation: RepresentationDirective["operation"], mask: RepresentationMask, targetStableAtomIds: string[]): RepresentationState => {
  const targets = new Set(targetStableAtomIds);
  const atomRepMasks = { ...state.atomRepMasks };
  for (const stableId of targets) {
    const current = atomRepMasks[stableId] ?? 0;
    atomRepMasks[stableId] = operation === "SHOW" ? current | mask : operation === "HIDE" ? current & ~mask : mask;
  }
  const presentationRevision = state.presentationRevision + 1;
  return { ...state, presentationRevision, atomRepMasks, directives: [...state.directives, { operation, mask, targetStableAtomIds: [...targetStableAtomIds], presentationRevision }] };
};

export const toProjectPresentation = (projection: RenderProjection): ProjectPresentationState => ({
  schemaVersion: 1,
  representation: projection.representation,
  layerVisibility: { protein: projection.showProtein, ligand: projection.showLigand, water: projection.showWater, ions: projection.showIons, other: projection.showOther },
  color: { mode: projection.color.mode, ...(projection.color.colorId ? { colorId: projection.color.colorId } : {}), ...(projection.color.customHex ? { customHex: projection.color.customHex } : {}) },
  background: projection.background,
  camera: { view: projection.camera.view, defaultView: projection.camera.defaultView },
});

export const fromProjectPresentation = (presentation: ProjectPresentationState, structure: CanonicalMolecularStructure | null): RenderProjection => {
  const style = REPRESENTATION_STYLES.includes(presentation.representation as RepresentationStyle) ? presentation.representation as RepresentationStyle : "cartoon";
  const projection = createDefaultRenderProjection(structure);
  return {
    ...setProjectionStyle(projection, structure, style),
    showProtein: presentation.layerVisibility.protein,
    showLigand: presentation.layerVisibility.ligand,
    showWater: presentation.layerVisibility.water,
    showIons: presentation.layerVisibility.ions,
    showOther: presentation.layerVisibility.other,
    color: { ...DEFAULT_COLOR, mode: COLOR_MODES.includes(presentation.color.mode as ColorMode) ? presentation.color.mode as ColorMode : "element", colorId: presentation.color.colorId ?? null, customHex: presentation.color.customHex ?? null },
    background: presentation.background as BackgroundColorState,
    camera: { ...DEFAULT_CAMERA, view: presentation.camera.view, defaultView: presentation.camera.defaultView },
  };
};
