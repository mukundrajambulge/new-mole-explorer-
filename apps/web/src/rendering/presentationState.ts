import type { CanonicalMolecularStructure, ProjectPresentationState } from "@molecular/contracts";
import { COLOR_SCHEME_DEFINITIONS, type ColorSchemeId } from "./colorSchemes";
import type { StyleProfileId } from "./styleProfiles";
import { DEFAULT_LABEL_STATE, type LabelState } from "../interaction/labels";

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
  atomColors: Record<string, string>;
  objectColors: Record<string, string>;
  representationOverrides: Record<string, Partial<Record<RepresentationType, string>>>;
};

export const BACKGROUND_PRESETS = ["Dark", "Black", "White", "Neutral", "Dark Gray", "Light Gray", "Navy", "Deep Blue", "Custom"] as const;
export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];
export type BackgroundColorState = { preset: BackgroundPreset; color: string };
export type ClippingMode = "auto" | "manual";
export type CameraState = { view: number[] | null; defaultView: number[] | null; projectionMode: "perspective" | "orthographic"; fov: number; nearClip: number; farClip: number; clippingMode: ClippingMode; viewport: { width: number; height: number; visibleTop: number; visibleBottom: number; visibleLeft: number; visibleRight: number } | null };
export type InteractionState = { hoveredAtomId: string | null; pickedAtomId: string | null; selectedAtomIds: readonly string[]; measurementPickAtomIds: readonly string[] };
export type RepresentationParameters = {
  stickRadius: number;
  sphereScale: number;
  lineWidth: number;
  cartoonThickness: number;
  quality: number;
  lineOpacity: number;
  stickOpacity: number;
  sphereOpacity: number;
  cartoonOpacity: number;
  ribbonOpacity: number;
  surfaceOpacity: number;
  meshOpacity: number;
  dotOpacity: number;
  nonbondedOpacity: number;
  surfaceProbeRadius: number;
  surfaceQuality: number;
  dotDensity: number;
  meshWidth: number;
  puttyMinRadius: number;
  puttyMaxRadius: number;
};

export type RepresentationDirective = { operation: "SHOW" | "HIDE" | "SHOW_AS"; mask: RepresentationMask; targetStableAtomIds: string[]; presentationRevision: number; style?: RepresentationStyle };
export type RepresentationState = { presentationRevision: number; objectEnabled: Record<string, boolean>; atomRepMasks: Record<string, RepresentationMask>; atomRepStyles: Record<string, RepresentationStyle>; directives: RepresentationDirective[]; parameters: RepresentationParameters };
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
  labels: LabelState;
  interaction: InteractionState;
};

export const DEFAULT_COLOR: ColorState = { mode: "element", colorId: null, customHex: null, profileRef: "PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69", atomColors: {}, objectColors: {}, representationOverrides: {} };
export const DEFAULT_BACKGROUND: BackgroundColorState = { preset: "Black", color: "#05070a" };
export const DEFAULT_CAMERA: CameraState = { view: null, defaultView: null, projectionMode: "perspective", fov: 20, nearClip: 0.1, farClip: 1000, clippingMode: "auto", viewport: null };
export const DEFAULT_INTERACTION: InteractionState = { hoveredAtomId: null, pickedAtomId: null, selectedAtomIds: [], measurementPickAtomIds: [] };
export const DEFAULT_REPRESENTATION_PARAMETERS: RepresentationParameters = { stickRadius: 0.16, sphereScale: 1, lineWidth: 1, cartoonThickness: 0.92, quality: 8, lineOpacity: 1, stickOpacity: 1, sphereOpacity: 1, cartoonOpacity: 1, ribbonOpacity: 1, surfaceOpacity: 1, meshOpacity: 1, dotOpacity: 1, nonbondedOpacity: 1, surfaceProbeRadius: 1.4, surfaceQuality: 0.5, dotDensity: 12, meshWidth: 1, puttyMinRadius: 0.18, puttyMaxRadius: 0.72 };

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

export const BACKGROUND_COLORS: Record<BackgroundPreset, string> = { Dark: "#0b1018", Black: "#05070a", White: "#ffffff", Neutral: "#747b85", "Dark Gray": "#20252d", "Light Gray": "#c8cdd3", Navy: "#071426", "Deep Blue": "#061d36", Custom: "#05070a" };

export const setCameraState = (projection: RenderProjection, camera: Partial<CameraState>): RenderProjection => {
  const clippingMode = camera.clippingMode ?? (camera.nearClip !== undefined || camera.farClip !== undefined ? "manual" : projection.camera.clippingMode);
  return { ...projection, camera: { ...projection.camera, ...camera, ...(clippingMode === "auto" ? { nearClip: DEFAULT_CAMERA.nearClip, farClip: DEFAULT_CAMERA.farClip } : {}), clippingMode } };
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
  atomRepStyles: structure ? Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, ["cartoon", "ribbon", "trace", "putty"].includes(style) ? atom.isPolymer ? style : atom.isLigand ? "ball-and-stick" : "spheres" : style])) : {},
  directives: [],
  parameters: DEFAULT_REPRESENTATION_PARAMETERS,
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
  labels: DEFAULT_LABEL_STATE,
  interaction: DEFAULT_INTERACTION,
});

export const setProjectionStyle = (projection: RenderProjection, structure: CanonicalMolecularStructure | null, style: RepresentationStyle): RenderProjection => ({
  ...projection,
  representation: style,
  colorDiagnostic: style === "putty" && structure && !structure.atoms.some((atom) => atom.bFactor !== undefined && atom.bFactor !== null) ? "PUTTY_PROPERTY_UNAVAILABLE" : null,
  representationState: structure ? { ...createRepresentationState(structure, style), presentationRevision: projection.representationState.presentationRevision + 1, parameters: projection.representationState.parameters } : projection.representationState,
});

export const setRepresentationParameters = (projection: RenderProjection, parameters: Partial<RepresentationParameters>): RenderProjection => ({
  ...projection,
  representationState: { ...projection.representationState, presentationRevision: projection.representationState.presentationRevision + 1, parameters: { ...projection.representationState.parameters, ...parameters } },
});

export const applyRepresentationToSelection = (projection: RenderProjection, operation: RepresentationDirective["operation"], mask: RepresentationMask, targetStableAtomIds: readonly string[], style?: RepresentationStyle): RenderProjection => ({
  ...projection,
  representationState: applyRepresentationOperation(projection.representationState, operation, mask, [...targetStableAtomIds], style),
});

export const setCategoryRepresentation = (projection: RenderProjection, structure: CanonicalMolecularStructure, category: "protein" | "ligand" | "water" | "ions" | "other", mask: RepresentationMask, style?: RepresentationStyle): RenderProjection => {
  const target = structure.atoms.filter((atom) => category === "protein" ? atom.isPolymer : category === "ligand" ? atom.isLigand : category === "water" ? atom.isWater : category === "ions" ? atom.isIon : !atom.isPolymer && !atom.isLigand && !atom.isWater && !atom.isIon).map((atom) => atom.stableId);
  return { ...projection, representationState: applyRepresentationOperation(projection.representationState, "SHOW_AS", mask, target, style) };
};

export const setInteractionState = (projection: RenderProjection, interaction: Partial<InteractionState>): RenderProjection => ({ ...projection, interaction: { ...projection.interaction, ...interaction, selectedAtomIds: interaction.selectedAtomIds ?? projection.interaction.selectedAtomIds, measurementPickAtomIds: interaction.measurementPickAtomIds ?? projection.interaction.measurementPickAtomIds } });

export const setLabelState = (projection: RenderProjection, labels: Partial<LabelState>): RenderProjection => ({ ...projection, labels: { ...projection.labels, ...labels } });

export const setColorForSelection = (projection: RenderProjection, targetStableAtomIds: readonly string[], color: string): RenderProjection => ({
  ...projection,
  color: { ...projection.color, atomColors: { ...projection.color.atomColors, ...Object.fromEntries(targetStableAtomIds.map((stableId) => [stableId, color])) } },
});

export const setRepresentationColorForSelection = (projection: RenderProjection, targetStableAtomIds: readonly string[], representation: RepresentationType, color: string): RenderProjection => ({
  ...projection,
  color: { ...projection.color, representationOverrides: { ...projection.color.representationOverrides, ...Object.fromEntries(targetStableAtomIds.map((stableId) => [stableId, { ...(projection.color.representationOverrides[stableId] ?? {}), [representation]: color }])) } },
});

export const setLayerVisibility = (projection: RenderProjection, layer: "showProtein" | "showLigand" | "showWater" | "showIons" | "showOther", visible = !projection[layer]): RenderProjection => ({ ...projection, [layer]: visible });

export const setColorScheme = (projection: RenderProjection, mode: ColorMode, structure: CanonicalMolecularStructure | null = null): RenderProjection => ({
  ...projection,
  color: { ...projection.color, mode, colorId: mode === "named" ? projection.color.colorId ?? "pymol:marine" : mode === "uniform" ? "pymol:grey" : projection.color.colorId },
  colorDiagnostic: mode === "by-partial-charge" && !structure?.partialChargeDataset ? "Partial-charge data unavailable for this molecular revision." : mode === "esp" ? "ESP field unavailable: no electrostatic potential computation is registered for this molecular revision." : (mode === "secondary-structure-standard" || mode === "secondary-structure-jmol" || mode === "secondary-structure") && !structure?.secondaryStructureDataset ? "Secondary-structure assignment unavailable for this molecular revision." : null,
});

export const applyRepresentationOperation = (state: RepresentationState, operation: RepresentationDirective["operation"], mask: RepresentationMask, targetStableAtomIds: string[], style?: RepresentationStyle): RepresentationState => {
  const atomRepMasks = { ...state.atomRepMasks };
  const atomRepStyles = { ...state.atomRepStyles };
  for (const stableId of new Set(targetStableAtomIds)) {
    const current = atomRepMasks[stableId] ?? 0;
    atomRepMasks[stableId] = operation === "SHOW" ? current | mask : operation === "HIDE" ? current & ~mask : mask;
    if (operation === "SHOW_AS" && style) atomRepStyles[stableId] = style;
  }
  const presentationRevision = state.presentationRevision + 1;
  return { ...state, presentationRevision, atomRepMasks, atomRepStyles, directives: [...state.directives, { operation, mask, targetStableAtomIds: [...targetStableAtomIds], presentationRevision, ...(style ? { style } : {}) }] };
};

export const toProjectPresentation = (projection: RenderProjection): ProjectPresentationState => ({
  schemaVersion: 1,
  representation: projection.representation,
  layerVisibility: { protein: projection.showProtein, ligand: projection.showLigand, water: projection.showWater, ions: projection.showIons, other: projection.showOther },
  color: { mode: projection.color.mode, ...(projection.color.colorId ? { colorId: projection.color.colorId } : {}), ...(projection.color.customHex ? { customHex: projection.color.customHex } : {}) },
  background: projection.background,
  camera: { view: projection.camera.view, defaultView: projection.camera.defaultView, projectionMode: projection.camera.projectionMode, fov: projection.camera.fov, nearClip: projection.camera.nearClip, farClip: projection.camera.farClip, clippingMode: projection.camera.clippingMode },
  representationParameters: projection.representationState.parameters,
  atomRepresentationStyles: projection.representationState.atomRepStyles,
});

export const fromProjectPresentation = (presentation: ProjectPresentationState, structure: CanonicalMolecularStructure | null): RenderProjection => {
  const style = REPRESENTATION_STYLES.includes(presentation.representation as RepresentationStyle) ? presentation.representation as RepresentationStyle : "cartoon";
  const projection = setProjectionStyle(createDefaultRenderProjection(structure), structure, style);
  const mode = (COLOR_MODES.includes(presentation.color.mode as (typeof COLOR_MODES)[number]) ? presentation.color.mode : "element") as ColorMode;
  const persistedStyles = Object.fromEntries(Object.entries(presentation.atomRepresentationStyles ?? {}).filter(([, value]) => REPRESENTATION_STYLES.includes(value as RepresentationStyle))) as Record<string, RepresentationStyle>;
  return {
    ...projection,
    showProtein: presentation.layerVisibility.protein,
    showLigand: presentation.layerVisibility.ligand,
    showWater: presentation.layerVisibility.water,
    showIons: presentation.layerVisibility.ions,
    showOther: presentation.layerVisibility.other,
    color: { ...DEFAULT_COLOR, mode, colorId: presentation.color.colorId ?? null, customHex: presentation.color.customHex ?? null },
    background: presentation.background as BackgroundColorState,
    representationState: {
      ...projection.representationState,
      parameters: { ...projection.representationState.parameters, ...(presentation.representationParameters ?? {}) },
      atomRepStyles: { ...projection.representationState.atomRepStyles, ...persistedStyles },
    },
    camera: { ...DEFAULT_CAMERA, view: presentation.camera.view, defaultView: presentation.camera.defaultView, projectionMode: presentation.camera.projectionMode ?? DEFAULT_CAMERA.projectionMode, fov: presentation.camera.fov ?? DEFAULT_CAMERA.fov, nearClip: presentation.camera.nearClip ?? DEFAULT_CAMERA.nearClip, farClip: presentation.camera.farClip ?? DEFAULT_CAMERA.farClip, clippingMode: presentation.camera.clippingMode ?? (presentation.camera.nearClip !== undefined || presentation.camera.farClip !== undefined ? "manual" : DEFAULT_CAMERA.clippingMode) },
  };
};

export const styleProfileFor = (style: RepresentationStyle): StyleProfileId => {
  if (style === "lines") return "line";
  if (style === "sticks") return "stick";
  if (style === "spheres") return "space-filling";
  return style as StyleProfileId;
};

export { COLOR_SCHEME_DEFINITIONS };
