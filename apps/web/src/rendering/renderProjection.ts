export const REPRESENTATION_STYLES = ["lines", "sticks", "spheres", "ball-and-stick", "cartoon"] as const;
export type RepresentationStyle = (typeof REPRESENTATION_STYLES)[number];

export type RenderProjection = {
  representation: RepresentationStyle;
  showProtein: boolean;
  showLigand: boolean;
  showWater: boolean;
  showIons: boolean;
  showOther: boolean;
  backgroundColor: string;
};

export const DEFAULT_RENDER_PROJECTION: RenderProjection = {
  representation: "cartoon",
  showProtein: true,
  showLigand: true,
  showWater: false,
  showIons: true,
  showOther: true,
  backgroundColor: "#05070a",
};
