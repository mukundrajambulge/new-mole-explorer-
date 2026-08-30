export {
  BACKGROUND_PRESETS,
  COLOR_MODES,
  DEFAULT_BACKGROUND,
  DEFAULT_CAMERA,
  DEFAULT_COLOR,
  REPRESENTATION_MASKS,
  REPRESENTATION_PRESETS,
  REPRESENTATION_STYLES,
  REPRESENTATION_TYPES,
  applyRepresentationOperation,
  createDefaultRenderProjection,
  createRepresentationState,
  fromProjectPresentation,
  setLayerVisibility,
  setProjectionStyle,
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
} from "./presentationState";

import { createDefaultRenderProjection } from "./presentationState";

export const DEFAULT_RENDER_PROJECTION = createDefaultRenderProjection();
