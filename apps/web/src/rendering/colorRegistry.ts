import type { ColorMode, ColorState } from "./presentationState";

export type ColorID = string;

export type ColorDefinition = {
  colorId: ColorID;
  canonicalName: string;
  rgbSrgb: readonly [number, number, number];
  profileRef: "PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69";
};

// Values are generated from the pinned PyMOL Color.cpp core table. The registry
// keeps stable names/IDs at the application boundary; renderer color schemes are
// selected only after this semantic state has been resolved.
const PINNED_CORE_COLORS: ReadonlyArray<[string, number, number, number]> = [
  ["white", 1, 1, 1], ["black", 0, 0, 0], ["red", 1, 0, 0], ["green", 0, 1, 0], ["blue", 0, 0, 1],
  ["yellow", 1, 1, 0], ["magenta", 1, 0, 1], ["cyan", 0, 1, 1], ["salmon", 1, 0.6, 0.6],
  ["lime", 0.5, 1, 0.5], ["slate", 0.5, 0.5, 1], ["orange", 1, 0.5, 0], ["hotpink", 1, 0, 0.5],
  ["chartreuse", 0.5, 1, 0], ["limegreen", 0, 1, 0.5], ["marine", 0, 0.5, 1], ["olive", 0.77, 0.7, 0],
  ["purple", 0.75, 0, 0.75], ["teal", 0, 0.75, 0.75], ["forest", 0.2, 0.6, 0.2], ["deepblue", 0.25, 0.25, 0.65],
  ["grey", 0.5, 0.5, 0.5], ["gray", 0.5, 0.5, 0.5], ["carbon", 0.2, 1, 0.2], ["nitrogen", 0.2, 0.2, 1],
  ["oxygen", 1, 0.3, 0.3], ["hydrogen", 0.9, 0.9, 0.9], ["brightorange", 1, 0.7, 0.2], ["yelloworange", 1, 0.87, 0.37],
  ["pink", 1, 0.65, 0.85], ["firebrick", 0.698, 0.13, 0.13], ["chocolate", 0.555, 0.222, 0.111], ["brown", 0.65, 0.32, 0.17],
  ["wheat", 0.99, 0.82, 0.65], ["violet", 1, 0.5, 1], ["lightmagenta", 1, 0.2, 0.8], ["paleyellow", 1, 1, 0.5],
  ["aquamarine", 0.5, 1, 1], ["deepsalmon", 1, 0.5, 0.5], ["palegreen", 0.65, 0.9, 0.65], ["deepolive", 0.6, 0.6, 0.1],
  ["deeppurple", 0.6, 0.1, 0.6], ["deepteal", 0.1, 0.6, 0.6], ["lightblue", 0.75, 0.75, 1], ["lightorange", 1, 0.8, 0.5],
  ["palecyan", 0.8, 1, 1], ["lightteal", 0.4, 0.7, 0.7], ["splitpea", 0.52, 0.75, 0], ["raspberry", 0.7, 0.3, 0.4],
  ["sand", 0.72, 0.55, 0.3], ["smudge", 0.55, 0.7, 0.4], ["violetpurple", 0.55, 0.25, 0.6], ["dirtyviolet", 0.7, 0.5, 0.5],
  ["lightpink", 1, 0.75, 0.87], ["greencyan", 0.25, 1, 0.75], ["limon", 0.75, 1, 0.25], ["skyblue", 0.2, 0.5, 0.8],
  ["bluewhite", 0.85, 0.85, 1], ["warmpink", 0.85, 0.2, 0.5], ["darksalmon", 0.73, 0.55, 0.52],
];

const toHex = (rgb: readonly [number, number, number]) => `#${rgb.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;

export class ColorRegistry {
  readonly profileRef = "PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69" as const;
  private readonly definitions = new Map<string, ColorDefinition>(PINNED_CORE_COLORS.map(([canonicalName, red, green, blue]) => {
    const rgb = [red, green, blue] as const;
    return [canonicalName, { colorId: `pymol:${canonicalName}`, canonicalName, rgbSrgb: rgb, profileRef: this.profileRef }];
  }));

  resolve(colorId: string | null): ColorDefinition | null {
    if (!colorId) return null;
    return this.definitions.get(colorId.replace(/^pymol:/, "").toLowerCase()) ?? this.definitions.get(colorId.toLowerCase()) ?? null;
  }

  resolveName(name: string): ColorDefinition | null {
    return this.definitions.get(name.trim().toLowerCase()) ?? null;
  }

  list(): ColorDefinition[] {
    return [...this.definitions.values()];
  }

  cssColor(state: ColorState): string | undefined {
    if (state.mode === "custom") return state.customHex ?? undefined;
    if (state.mode !== "named" && state.mode !== "uniform") return undefined;
    const definition = this.resolve(state.colorId);
    return definition ? toHex(definition.rgbSrgb) : undefined;
  }
}

export const colorRegistry = new ColorRegistry();

export const colorModeLabel = (mode: ColorMode): string => ({
  element: "Element",
  chain: "Chain",
  object: "Object",
  residue: "Residue",
  "secondary-structure": "Secondary Structure",
  uniform: "Uniform",
  named: "Named",
  custom: "Custom",
}[mode]);
