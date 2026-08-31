import type { CanonicalMolecularStructure } from "@molecular/contracts";
import {
  setColorScheme,
  setLayerVisibility,
  setProjectionStyle,
  type BackgroundPreset,
  type ColorMode,
  type RenderProjection,
  type RepresentationStyle,
} from "./presentationState";

export type PresentationComponent = "protein" | "ligand" | "water" | "ions" | "other";

export type PresentationAction =
  | { type: "REPRESENTATION.APPLY"; style: RepresentationStyle }
  | { type: "COLOR.APPLY_SCHEME"; mode: ColorMode }
  | { type: "BACKGROUND.SET"; preset: BackgroundPreset; color?: string }
  | { type: "COMPONENT_VISIBILITY.SET"; component: PresentationComponent; visible: boolean };

const BACKGROUND_COLORS: Record<Exclude<BackgroundPreset, "Custom">, string> = {
  Black: "#05070a",
  White: "#ffffff",
  "Dark Gray": "#252b34",
  "Light Gray": "#d8dee7",
  Navy: "#071225",
  "Deep Blue": "#061b40",
};

const visibilityKey: Record<PresentationComponent, keyof Pick<RenderProjection, "showProtein" | "showLigand" | "showWater" | "showIons" | "showOther">> = {
  protein: "showProtein",
  ligand: "showLigand",
  water: "showWater",
  ions: "showIons",
  other: "showOther",
};

/** One renderer-neutral semantic operation shared by panels, ribbon controls, and future commands. */
export const applyPresentationAction = (
  projection: RenderProjection,
  structure: CanonicalMolecularStructure | null,
  action: PresentationAction,
): RenderProjection => {
  if (action.type === "REPRESENTATION.APPLY") return setProjectionStyle(projection, structure, action.style);
  if (action.type === "COLOR.APPLY_SCHEME") return setColorScheme(projection, action.mode, structure);
  if (action.type === "BACKGROUND.SET") {
    return {
      ...projection,
      background: {
        preset: action.preset,
        color: action.preset === "Custom" ? action.color ?? projection.background.color : BACKGROUND_COLORS[action.preset],
      },
    };
  }
  return setLayerVisibility(projection, visibilityKey[action.component], action.visible);
};
