import { describe, expect, it } from "vitest";
import { isFiniteSearchRegionOverlay } from "./searchRegionOverlay";

describe("SearchRegion renderer boundary", () => {
  it("accepts only finite positive renderer geometry", () => {
    expect(isFiniteSearchRegionOverlay({ kind: "DRAFT", center: [0, 0, 0], size: [1, 2, 3], units: "ANGSTROM", coordinateFrame: "frame:test" })).toBe(true);
    expect(isFiniteSearchRegionOverlay({ kind: "DRAFT", center: [0, 0, 0], size: [1, 0, 3], units: "ANGSTROM", coordinateFrame: "frame:test" })).toBe(false);
    expect(isFiniteSearchRegionOverlay({ kind: "DRAFT", center: [Number.NaN, 0, 0], size: [1, 2, 3], units: "ANGSTROM", coordinateFrame: "frame:test" })).toBe(false);
  });
});
