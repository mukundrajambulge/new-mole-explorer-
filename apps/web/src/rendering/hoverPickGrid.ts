// Coarse spatial grid that narrows 3Dmol's ray picking on huge structures.
// 3Dmol raycasts every hoverable atom (~180 ms on 4V6F, 307k atoms). The grid is built once per
// model change (off the hover path); a pick tests only the occupied cells (per-cell, not per-atom)
// and hands 3Dmol's own exact intersector the atoms of the cells the ray passes near.

export interface PickableAtom { x: number; y: number; z: number; hoverable?: boolean; clickable?: boolean }
export interface Vec3 { x: number; y: number; z: number }

/** Above this many atoms the viewer narrows hover/click raycasts with a PickGrid. */
export const LARGE_PICK_ATOM_THRESHOLD = 50_000;

export class PickGrid<T extends PickableAtom = PickableAtom> {
  private readonly centers: Float64Array;
  private readonly cells: T[][];

  private constructor(centers: Float64Array, cells: T[][], readonly cellSize: number, readonly pad: number, readonly atomCount: number) {
    this.centers = centers;
    this.cells = cells;
  }

  /** `pad` (Å) covers intersection geometry that reaches beyond an atom centre: spheres, bond halves, cartoon ribbons owned by CA/P. */
  static build<T extends PickableAtom>(atomLists: ReadonlyArray<ReadonlyArray<T>>, cellSize = 8, pad = 6): PickGrid<T> {
    const index = new Map<number, number>();
    const cells: T[][] = [];
    const sums: number[] = [];
    let atomCount = 0;
    for (const atoms of atomLists) {
      for (let i = 0; i < atoms.length; i++) {
        const atom = atoms[i]!;
        if (!Number.isFinite(atom.x) || !Number.isFinite(atom.y) || !Number.isFinite(atom.z)) continue;
        // Numeric key: 2^17 cells per axis (about +-500k Å at 8 Å cells), 2^51 total, exact in a double.
        const key = ((Math.floor(atom.x / cellSize) + 65_536) * 131_072 + (Math.floor(atom.y / cellSize) + 65_536)) * 131_072 + (Math.floor(atom.z / cellSize) + 65_536);
        let slot = index.get(key);
        if (slot === undefined) {
          slot = cells.length;
          index.set(key, slot);
          cells.push([]);
          sums.push(0, 0, 0);
        }
        cells[slot]!.push(atom);
        sums[slot * 3] += atom.x; sums[slot * 3 + 1] += atom.y; sums[slot * 3 + 2] += atom.z;
        atomCount += 1;
      }
    }
    const centers = new Float64Array(cells.length * 3);
    for (let c = 0; c < cells.length; c++) {
      const n = cells[c]!.length;
      centers[c * 3] = sums[c * 3]! / n; centers[c * 3 + 1] = sums[c * 3 + 1]! / n; centers[c * 3 + 2] = sums[c * 3 + 2]! / n;
    }
    return new PickGrid(centers, cells, cellSize, pad, atomCount);
  }

  get cellCount(): number { return this.cells.length; }

  /**
   * Atoms whose cell lies within reach of the ray. `matrix` is the model group's column-major world
   * matrix (atoms are in model space, the ray in world space) and `scale` its max axis scale.
   * The cell radius is measured from the atoms' centroid, so a full cell diagonal is always covered.
   */
  candidates(origin: Vec3, direction: Vec3, matrix: ArrayLike<number>, scale: number, flag: "hoverable" | "clickable"): T[] {
    const len = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const dx = direction.x / len, dy = direction.y / len, dz = direction.z / len;
    const radius = (this.cellSize * Math.sqrt(3) + this.pad) * (scale || 1);
    const r2 = radius * radius;
    const m = matrix;
    const out: T[] = [];
    for (let c = 0; c < this.cells.length; c++) {
      const cx = this.centers[c * 3]!, cy = this.centers[c * 3 + 1]!, cz = this.centers[c * 3 + 2]!;
      const wx = m[0]! * cx + m[4]! * cy + m[8]! * cz + m[12]! - origin.x;
      const wy = m[1]! * cx + m[5]! * cy + m[9]! * cz + m[13]! - origin.y;
      const wz = m[2]! * cx + m[6]! * cy + m[10]! * cz + m[14]! - origin.z;
      const t = wx * dx + wy * dy + wz * dz;
      if (t < -radius) continue;
      const px = wx - t * dx, py = wy - t * dy, pz = wz - t * dz;
      if (px * px + py * py + pz * pz > r2) continue;
      const atoms = this.cells[c]!;
      for (let i = 0; i < atoms.length; i++) if (atoms[i]![flag]) out.push(atoms[i]!);
    }
    return out;
  }
}
