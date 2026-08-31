import type { CanonicalMolecularStructure, ProjectPresentationState } from "@molecular/contracts";
import { COLOR_SCHEME_DEFINITIONS, type ColorSchemeId } from "./colorSchemes";
import type { StyleProfileId } from "./styleProfiles";

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

/** Legacy ids remain serializable for G1B project records; the visible style inventory uses styleProfiles. */
export const REPRESENTATION_STYLES = ["line", "stick", "lines", "sticks", "spheres", "ball-and-stick", "licorice", "cartoon", "space-filling", "ribbon", "trace", "putty", "nonbonded-crosses", "nonbonded-spheres", "van-der-waals-surface", "solvent-accessible-surface", "solvent-excluded-surface", "mesh", "dots", "dot-surface"] as const;
export type RepresentationStyle = (typeof REPRESENTATION_STYLES)[number];

export const COLOR_MODES = [
  "classic-cpk", "modern-jmol", "by-molecule", "by-formal-charge", "by-partial-charge", "esp", "hydrophobicity", "rainbow", "monochrome", "colourblind-safe", "secondary-structure-standard", "secondary-structure-jmol", "chain", "element", "white",
] as const;
export type ColorMode = ColorSchemeId | "object" | "residue" | "secondary-structure" | "uniform" | "named" | "custom";
export const COLOR_SCHEMES = COLOR_SCHEME_DEFINITIONS;

export type ColorState = {
  mode: ColorMode;
  colorId: string | null;
  customHex: string | null;
  profileRef: "PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69";
};

export const BACKGROUND_PRESETS = ["Black", "White", "Dark Gray", "Light Gray", "Navy", "Deep Blue", "Custom"] as const;
export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];
export type BackgroundColorState = { preset: BackgroundPreset; color: string };
export type CameraState = { view: number[] | null; defaultView: number[] | null; viewport: { width: number; height: number; visibleTop: number; visibleBottom: number; visibleLeft: number; visibleRight: number } | null };

export type RepresentationDirective = { operation: "SHOW" | "HIDE" | "SHOW_AS"; mask: RepresentationMask; targetStableAtomIds: string[]; presentationRevision: number };
export type RepresentationState = { presentationRevision: number; objectEnabled: Record<string, boolean>; atomRepMasks: Record<string, RepresentationMask>; directives: RepresentationDirective[] };
export type RenderProjection = {
  representation: RepresentationStyle;
  showProtein: boolean;
  showLigand: boolean;
  showWater: boolean;
  showIons: boolean;
  showOther: boolean;
  representationState: RepresentationState;
  color: ColorState;
  colorDiagnostic: string | null;
  background: BackgroundColorState;
  camera: CameraState;
};

export const DEFAULT_COLOR: ColorState = { mode: "element", colorId: null, customHex: null, profileRef: "PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69" };
export const DEFAULT_BACKGROUND: BackgroundColorState = { preset: "Black", color: "#05070a" };
export const DEFAULT_CAMERA: CameraState = { view: null, defaultView: null, viewport: null };

export const maskForStyle = (style: RepresentationStyle): RepresentationMask => {
  if (style === "lines" || style === "line") return REPRESENTATION_MASKS.LINES;
  if (style === "sticks" || style === "stick") return REPRESENTATION_MASKS.STICKS;
  if (style === "spheres" || style === "space-filling") return REPRESENTATION_MASKS.SPHERES;
  if (style === "ball-and-stick") return REPRESENTATION_PRESETS.BALL_AND_STICK;
  if (style === "licorice") return REPRESENTATION_PRESETS.LICORICE;
  if (style === "ribbon") return REPRESENTATION_MASKS.RIBBON;
  if (style === "nonbonded-crosses") return REPRESENTATION_MASKS.NONBONDED;
  if (style === "nonbonded-spheres") return REPRESENTATION_MASKS.NB_SPHERES;
  if (style === "van-der-waals-surface" || style === "solvent-accessible-surface" || style === "solvent-excluded-surface") return REPRESENTATION_MASKS.SURFACE;
  if (style === "mesh") return REPRESENTATION_MASKS.MESH;
  if (style === "dots" || style === "dot-surface") return REPRESENTATION_MASKS.DOTS;
  return REPRESENTATION_MASKS.CARTOON;
};

const atomMaskForStyle = (atom: CanonicalMolecularStructure["atoms"][number], style: RepresentationStyle): RepresentationMask => {
  if (style === "cartoon" || style === "ribbon" || style === "trace" || style === "putty") {
    if (atom.isPolymer) return maskForStyle(style);
    if (atom.isLigand) return REPRESENTATION_MASKS.STICKS;
    if (atom.isIon || atom.isWater) return REPRESENTATION_MASKS.SPHERES;
    return REPRESENTATION_MASKS.STICKS;
  }
  return maskForStyle(style);
};

export const createRepresentationState = (structure: CanonicalMolecularStructure | null, style: RepresentationStyle = "cartoon"): RepresentationState => ({
  presentationRevision: 1,
  objectEnabled: structure ? { [structure.id]: true } : {},
  atomRepMasks: structure ? Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, atomMaskForStyle(atom, style)])) : {},
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
  colorDiagnostic: null,
  background: DEFAULT_BACKGROUND,
  camera: DEFAULT_CAMERA,
});

export const setProjectionStyle = (projection: RenderProjection, structure: CanonicalMolecularStructure | null, style: RepresentationStyle): RenderProjection => ({
  ...projection,
  representation: style,
  colorDiagnostic: style === "putty" && structure && !structure.atoms.some((atom) => atom.bFactor !== undefined && atom.bFactor !== null) ? "PUTTY_PROPERTY_UNAVAILABLE" : null,
  representationState: structure ? { ...createRepresentationState(structure, style), presentationRevision: projection.representationState.presentationRevision + 1 } : projection.representationState,
});

export const setLayerVisibility = (projection: RenderProjection, layer: "showProtein" | "showLigand" | "showWater" | "showIons" | "showOther", visible = !projection[layer]): RenderProjection => ({ ...projection, [layer]: visible });

export const setColorScheme = (projection: RenderProjection, mode: ColorMode, structure: CanonicalMolecularStructure | null = null): RenderProjection => ({
  ...projection,
  color: { ...projection.color, mode, colorId: mode === "named" ? projection.color.colorId ?? "pymol:marine" : mode === "uniform" ? "pymol:grey" : projection.color.colorId },
  colorDiagnostic: mode === "by-partial-charge" && !structure?.partialChargeDataset ? "Partial-charge data unavailable for this molecular revision." : mode === "esp" ? "ESP field unavailable: no electrostatic potential computation is registered for this molecular revision." : (mode === "secondary-structure-standard" || mode === "secondary-structure-jmol" || mode === "secondary-structure") && !structure?.secondaryStructureDataset ? "Secondary-structure assignment unavailable for this molecular revision." : null,
});

export const applyRepresentationOperation = (state: RepresentationState, operation: RepresentationDirective["operation"], mask: RepresentationMask, targetStableAtomIds: string[]): RepresentationState => {
  const atomRepMasks = { ...state.atomRepMasks };
  for (const stableId of new Set(targetStableAtomIds)) {
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
  const projection = setProjectionStyle(createDefaultRenderProjection(structure), structure, style);
  const mode = (COLOR_MODES.includes(presentation.color.mode as (typeof COLOR_MODES)[number]) ? presentation.color.mode : "element") as ColorMode;
  return {
    ...projection,
    showProtein: presentation.layerVisibility.protein,
    showLigand: presentation.layerVisibility.ligand,
    showWater: presentation.layerVisibility.water,
    showIons: presentation.layerVisibility.ions,
    showOther: presentation.layerVisibility.other,
    color: { ...DEFAULT_COLOR, mode, colorId: presentation.color.colorId ?? null, customHex: presentation.color.customHex ?? null },
    background: presentation.background as BackgroundColorState,
    camera: { ...DEFAULT_CAMERA, view: presentation.camera.view, defaultView: presentation.camera.defaultView },
  };
};

export const styleProfileFor = (style: RepresentationStyle): StyleProfileId => {
  if (style === "lines") return "line";
  if (style === "sticks") return "stick";
  if (style === "spheres") return "space-filling";
  return style as StyleProfileId;
};

export { COLOR_SCHEME_DEFINITIONS };
