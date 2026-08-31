import { describe, expect, it } from "vitest";
import { boundsForCoordinates, paddedClippingSlab, principalOrientationQuaternion } from "./cameraController";

describe("P0-A camera geometry helpers", () => {
  it("derives a padded slab from scene bounds instead of a fixed far plane", () => {
    const bounds = boundsForCoordinates([{ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]);
    expect(bounds?.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(bounds?.radius).toBe(10);
    const slab = paddedClippingSlab(bounds);
    expect(slab.near).toBeLessThan(-10);
    expect(slab.far).toBeGreaterThan(10);
    expect(slab.far).toBe(-slab.near);
  });

  it("returns a deterministic principal-axis orientation for an asymmetric cloud", () => {
    const coordinates = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 1, z: 0 }, { x: 2, y: 6, z: 1 }, { x: 1, y: 2, z: 9 }];
    const first = principalOrientationQuaternion(coordinates);
    const second = principalOrientationQuaternion(coordinates);
    expect(first).toEqual(second);
    expect(Math.hypot(...first)).toBeCloseTo(1, 8);
    expect(first).not.toEqual([0, 0, 0, 1]);
  });

  it("uses identity for an isotropic cloud with no unique principal frame", () => {
    expect(principalOrientationQuaternion([{ x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 }, { x: -1, y: 1, z: -1 }, { x: -1, y: -1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: -1 }, { x: 1, y: -1, z: 1 }, { x: -1, y: 1, z: 1 }])).toEqual([0, 0, 0, 1]);
  });
});
