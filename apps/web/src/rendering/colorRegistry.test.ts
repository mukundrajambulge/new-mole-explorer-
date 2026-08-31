import { describe, expect, it } from "vitest";
import { colorRegistry } from "./colorRegistry";

describe("G1C pinned named color registry", () => {
  it("loads the generated PyMOL profile and resolves names", () => {
    expect(colorRegistry.profileRef).toContain("PYMOL_OSS_5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69");
    expect(colorRegistry.list().length).toBeGreaterThan(180);
    expect(colorRegistry.resolveInput("marine")?.canonicalName).toBe("marine");
  });

  it("accepts HEX, RGB 0..1, and RGB 0..255 without changing scientific state", () => {
    expect(colorRegistry.resolveInput("#ff0080")?.rgbSrgb).toEqual([1, 0, 128 / 255]);
    expect(colorRegistry.resolveInput("rgb(1, 0.5, 0)")?.rgbSrgb).toEqual([1, 0.5, 0]);
    expect(colorRegistry.resolveInput("255, 128, 0")?.rgbSrgb).toEqual([1, 128 / 255, 0]);
  });

  it("reports unknown input explicitly", () => {
    expect(colorRegistry.resolveInputWithDiagnostic("not-a-color")).toEqual({ definition: null, diagnostic: "COLOR_NOT_FOUND" });
  });
});
