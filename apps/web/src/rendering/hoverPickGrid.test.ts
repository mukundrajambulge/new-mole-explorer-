import { describe, expect, it } from "vitest";
import { PickGrid, type PickableAtom } from "./hoverPickGrid";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Deterministic cloud of hoverable atoms in a 200 Å box.
const cloud = (n: number): PickableAtom[] => {
  const atoms: PickableAtom[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < n; i++) atoms.push({ x: rnd() * 200 - 100, y: rnd() * 200 - 100, z: rnd() * 200 - 100, hoverable: true, clickable: i % 2 === 0 });
  return atoms;
};

const distanceToRay = (a: PickableAtom, o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }) => {
  const wx = a.x - o.x, wy = a.y - o.y, wz = a.z - o.z;
  const t = wx * d.x + wy * d.y + wz * d.z;
  return { t, dist: Math.hypot(wx - t * d.x, wy - t * d.y, wz - t * d.z) };
};

describe("PickGrid", () => {
  const atoms = cloud(20_000);
  const grid = PickGrid.build([atoms]);

  it("keeps every atom within the pad of the ray and drops most of the structure", () => {
    const origin = { x: 13, y: -7, z: 400 };
    const direction = { x: 0.05, y: 0.02, z: -1 };
    const n = Math.hypot(direction.x, direction.y, direction.z);
    const unit = { x: direction.x / n, y: direction.y / n, z: direction.z / n };
    const candidates = new Set(grid.candidates(origin, direction, IDENTITY, 1, "hoverable"));
    for (const atom of atoms) {
      const { t, dist } = distanceToRay(atom, origin, unit);
      if (t >= 0 && dist <= grid.pad) expect(candidates.has(atom)).toBe(true);
    }
    expect(candidates.size).toBeLessThan(atoms.length / 10);
  });

  it("applies the model world matrix (translation) and the flag filter", () => {
    // Model translated by +1000 in x: the ray must be moved too to hit the same atoms.
    const moved = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000, 0, 0, 1];
    const direction = { x: 0, y: 0, z: -1 };
    const here = grid.candidates({ x: 0, y: 0, z: 400 }, direction, IDENTITY, 1, "clickable");
    const there = grid.candidates({ x: 1000, y: 0, z: 400 }, direction, moved, 1, "clickable");
    expect(there.length).toBe(here.length);
    expect(here.every((atom) => atom.clickable)).toBe(true);
    expect(grid.candidates({ x: 0, y: 0, z: 400 }, direction, moved, 1, "clickable")).toHaveLength(0);
  });

  it("ignores atoms behind the ray origin and non-finite coordinates", () => {
    const g = PickGrid.build([[{ x: 0, y: 0, z: 0, hoverable: true }, { x: Number.NaN, y: 0, z: 0, hoverable: true }]]);
    expect(g.atomCount).toBe(1);
    expect(g.candidates({ x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: -1 }, IDENTITY, 1, "hoverable")).toHaveLength(1);
    expect(g.candidates({ x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: 1 }, IDENTITY, 1, "hoverable")).toHaveLength(0);
  });
});
