import type { ColorMode, ColorState } from "./presentationState";
import { colorSchemeLabel } from "./colorSchemes";
import { GENERATED_PYMOL_COLORS, PYMOL_COLOR_PROFILE } from "./pymolColors.generated";

export type ColorID = string;
export type ColorDefinition = { colorId: ColorID; canonicalName: string; rgbSrgb: readonly [number, number, number]; profileRef: typeof PYMOL_COLOR_PROFILE };

const toHex = (rgb: readonly [number, number, number]) => `#${rgb.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;
const parseHex = (value: string): readonly [number, number, number] | null => {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return [Number.parseInt(normalized.slice(0, 2), 16) / 255, Number.parseInt(normalized.slice(2, 4), 16) / 255, Number.parseInt(normalized.slice(4, 6), 16) / 255] as const;
};
const parseRgb = (value: string): readonly [number, number, number] | null => {
  const normalized = value.trim().replace(/^rgba?\s*\(\s*/i, "").replace(/\s*\)$/, "");
  const parts = normalized.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const numbers = parts.map(Number);
  if (numbers.some((number) => !Number.isFinite(number) || number < 0)) return null;
  const scale = Math.max(...numbers) > 1 ? 255 : 1;
  if (numbers.some((number) => number > scale)) return null;
  const [red, green, blue] = numbers;
  return [red / scale, green / scale, blue / scale] as const;
};

/** Renderer-neutral named colors generated from PyMOL OSS Color.cpp at the pinned profile. */
export class ColorRegistry {
  readonly profileRef = PYMOL_COLOR_PROFILE;
  private readonly definitions = new Map<string, ColorDefinition>(GENERATED_PYMOL_COLORS.map(([canonicalName, red, green, blue]) => [canonicalName.toLowerCase(), { colorId: `pymol:${canonicalName}`, canonicalName, rgbSrgb: [red, green, blue] as const, profileRef: PYMOL_COLOR_PROFILE }]));

  resolve(colorId: string | null): ColorDefinition | null {
    if (!colorId) return null;
    return this.resolveName(colorId.replace(/^pymol:/i, ""));
  }

  resolveName(name: string): ColorDefinition | null { return this.definitions.get(name.trim().toLowerCase()) ?? null; }

  resolveInput(input: string): ColorDefinition | null {
    const named = this.resolveName(input.replace(/^pymol:/i, ""));
    if (named) return named;
    const hex = parseHex(input) ?? (input.trim().match(/^0x([0-9a-f]{6})$/i) ? parseHex(input.trim().slice(2)) : null);
    const rgb = hex ?? parseRgb(input);
    if (!rgb) return null;
    return { colorId: `${hex ? "hex" : "rgb"}:${input.trim().toLowerCase()}`, canonicalName: input.trim(), rgbSrgb: rgb, profileRef: PYMOL_COLOR_PROFILE };
  }

  resolveInputWithDiagnostic(input: string): { definition: ColorDefinition | null; diagnostic: "COLOR_NOT_FOUND" | null } {
    const definition = this.resolveInput(input);
    return { definition, diagnostic: definition ? null : "COLOR_NOT_FOUND" };
  }

  list(): ColorDefinition[] { return [...this.definitions.values()]; }

  cssColor(state: ColorState): string | undefined {
    if (state.mode === "custom") return state.customHex ?? undefined;
    if (state.mode !== "named" && state.mode !== "uniform") return undefined;
    const definition = this.resolve(state.colorId);
    return definition ? toHex(definition.rgbSrgb) : undefined;
  }
}

export const colorRegistry = new ColorRegistry();
export const colorModeLabel = (mode: ColorMode): string => colorSchemeLabel(mode);
