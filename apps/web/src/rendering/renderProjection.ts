export {
  BACKGROUND_PRESETS,
  BACKGROUND_COLORS,
  COLOR_MODES,
  COLOR_SCHEMES,
  DEFAULT_BACKGROUND,
  DEFAULT_CAMERA,
  DEFAULT_COLOR,
  REPRESENTATION_MASKS,
  REPRESENTATION_PRESETS,
  REPRESENTATION_STYLES,
  REPRESENTATION_TYPES,
  applyRepresentationOperation,
  applyRepresentationToSelection,
  createDefaultRenderProjection,
  createRepresentationState,
  fromProjectPresentation,
  setLayerVisibility,
  setColorScheme,
  setColorForSelection,
  setComponentColor,
  clearColorForSelection,
  setRepresentationColorForSelection,
  setProjectionStyle,
  setRepresentationParameters,
  setCategoryRepresentation,
  setInteractionState,
  setLabelState,
  setCameraState,
  maskForStyle,
  styleProfileFor,
  toProjectPresentation,
} from "./presentationState";
export type {
  BackgroundColorState,
  BackgroundPreset,
  CameraState,
  ColorMode,
  ColorState,
  RenderProjection,
  RepresentationDirective,
  RepresentationMask,
  RepresentationState,
  RepresentationStyle,
  RepresentationType,
  InteractionState,
  RepresentationParameters,
} from "./presentationState";
export type { ColorSchemeId } from "./colorSchemes";
export type { LabelMode, LabelState, SafeLabelExpression } from "../interaction/labels";

import { createDefaultRenderProjection } from "./presentationState";

export const DEFAULT_RENDER_PROJECTION = createDefaultRenderProjection();
