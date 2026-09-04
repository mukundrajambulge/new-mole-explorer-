import type { AtomSelectionSpec, GLViewer } from "3dmol";

export type Coordinate3 = { x: number; y: number; z: number };

/** Semantic camera boundary. UI actions target this controller, never 3Dmol directly. */
export class CameraController {
  constructor(private readonly viewer: Pick<GLViewer, "center">) {}

  center(target: AtomSelectionSpec): void {
    this.viewer.center(target);
  }
}

export type SceneBounds = {
  min: Coordinate3;
  max: Coordinate3;
  center: Coordinate3;
  radius: number;
  diameter: number;
};

export type ClippingSlab = { near: number; far: number; padding: number };

const identityMatrix = (): number[][] => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

export const boundsForCoordinates = (coordinates: readonly Coordinate3[]): SceneBounds | null => {
  const finite = coordinates.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  if (finite.length === 0) return null;
  const min = { x: finite[0].x, y: finite[0].y, z: finite[0].z };
  const max = { x: finite[0].x, y: finite[0].y, z: finite[0].z };
  for (const point of finite.slice(1)) {
    min.x = Math.min(min.x, point.x); min.y = Math.min(min.y, point.y); min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x); max.y = Math.max(max.y, point.y); max.z = Math.max(max.z, point.z);
  }
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const radius = Math.max(...finite.map((point) => Math.hypot(point.x - center.x, point.y - center.y, point.z - center.z)), 0);
  return { min, max, center, radius, diameter: Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z) };
};

/**
 * 3Dmol's slab values are offsets around its rotation group. The scene sphere
 * is therefore expanded from canonical bounds and applied symmetrically. The
 * margin scales with the structure rather than using an arbitrary far plane.
 */
export const paddedClippingSlab = (bounds: SceneBounds | null): ClippingSlab => {
  const radius = Math.max(bounds?.radius ?? 0, 2);
  const padding = Math.max(2, radius * 0.15);
  const extent = radius + padding;
  return { near: -extent, far: extent, padding };
};

type EigenPair = { value: number; vector: [number, number, number] };

const covarianceMatrix = (coordinates: readonly Coordinate3[], center: Coordinate3): number[][] => {
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  if (coordinates.length < 2) return matrix;
  for (const point of coordinates) {
    const delta = [point.x - center.x, point.y - center.y, point.z - center.z];
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) matrix[row][column] += delta[row] * delta[column];
  }
  const scale = 1 / coordinates.length;
  return matrix.map((row) => row.map((value) => value * scale));
};

/** Small, dependency-free symmetric 3x3 Jacobi eigensolver for deterministic orient. */
const eigenPairs = (input: number[][]): EigenPair[] => {
  const matrix = input.map((row) => [...row]);
  const vectors = identityMatrix();
  for (let iteration = 0; iteration < 32; iteration += 1) {
    let p = 0; let q = 1; let largest = Math.abs(matrix[p][q]);
    for (let row = 0; row < 3; row += 1) for (let column = row + 1; column < 3; column += 1) {
      if (Math.abs(matrix[row][column]) > largest) { largest = Math.abs(matrix[row][column]); p = row; q = column; }
    }
    if (largest < 1e-10) break;
    const theta = 0.5 * Math.atan2(2 * matrix[p][q], matrix[q][q] - matrix[p][p]);
    const cosine = Math.cos(theta); const sine = Math.sin(theta);
    const app = matrix[p][p]; const aqq = matrix[q][q]; const apq = matrix[p][q];
    matrix[p][p] = cosine ** 2 * app - 2 * sine * cosine * apq + sine ** 2 * aqq;
    matrix[q][q] = sine ** 2 * app + 2 * sine * cosine * apq + cosine ** 2 * aqq;
    matrix[p][q] = 0; matrix[q][p] = 0;
    for (let index = 0; index < 3; index += 1) {
      if (index === p || index === q) continue;
      const aip = matrix[index][p]; const aiq = matrix[index][q];
      matrix[index][p] = cosine * aip - sine * aiq; matrix[p][index] = matrix[index][p];
      matrix[index][q] = sine * aip + cosine * aiq; matrix[q][index] = matrix[index][q];
    }
    for (let index = 0; index < 3; index += 1) {
      const vip = vectors[index][p]; const viq = vectors[index][q];
      vectors[index][p] = cosine * vip - sine * viq;
      vectors[index][q] = sine * vip + cosine * viq;
    }
  }
  return [0, 1, 2].map((column) => ({ value: matrix[column][column], vector: [vectors[0][column], vectors[1][column], vectors[2][column]] as [number, number, number] })).sort((left, right) => right.value - left.value);
};

const determinant = (matrix: number[][]): number => matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);

const quaternionFromMatrix = (matrix: number[][]): [number, number, number, number] => {
  const trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
  let x = 0; let y = 0; let z = 0; let w = 1;
  if (trace > 0) { const scale = Math.sqrt(trace + 1) * 2; w = 0.25 * scale; x = (matrix[2][1] - matrix[1][2]) / scale; y = (matrix[0][2] - matrix[2][0]) / scale; z = (matrix[1][0] - matrix[0][1]) / scale; }
  else if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) { const scale = Math.sqrt(1 + matrix[0][0] - matrix[1][1] - matrix[2][2]) * 2; w = (matrix[2][1] - matrix[1][2]) / scale; x = 0.25 * scale; y = (matrix[0][1] + matrix[1][0]) / scale; z = (matrix[0][2] + matrix[2][0]) / scale; }
  else if (matrix[1][1] > matrix[2][2]) { const scale = Math.sqrt(1 + matrix[1][1] - matrix[0][0] - matrix[2][2]) * 2; w = (matrix[0][2] - matrix[2][0]) / scale; x = (matrix[0][1] + matrix[1][0]) / scale; y = 0.25 * scale; z = (matrix[1][2] + matrix[2][1]) / scale; }
  else { const scale = Math.sqrt(1 + matrix[2][2] - matrix[0][0] - matrix[1][1]) * 2; w = (matrix[1][0] - matrix[0][1]) / scale; x = (matrix[0][2] + matrix[2][0]) / scale; y = (matrix[1][2] + matrix[2][1]) / scale; z = 0.25 * scale; }
  const length = Math.hypot(x, y, z, w) || 1;
  return [x / length, y / length, z / length, w / length];
};

/**
 * Return a deterministic model-to-world rotation for Orient. Degenerate or
 * isotropic coordinate clouds intentionally fall back to identity because
 * there is no scientifically meaningful unique principal-axis frame.
 */
export const principalOrientationQuaternion = (coordinates: readonly Coordinate3[]): [number, number, number, number] => {
  const bounds = boundsForCoordinates(coordinates);
  if (!bounds || coordinates.length < 3 || bounds.radius < 1e-8) return [0, 0, 0, 1];
  const pairs = eigenPairs(covarianceMatrix(coordinates, bounds.center));
  const spread = Math.max(Math.abs(pairs[0].value), 1e-12);
  if (Math.abs(pairs[0].value - pairs[2].value) / spread < 1e-7) return [0, 0, 0, 1];
  const signed = pairs.map(({ vector }) => {
    const pivot = vector.reduce((best, value, index) => Math.abs(value) > Math.abs(vector[best]) ? index : best, 0);
    return vector[pivot] < 0 ? vector.map((value) => -value) as [number, number, number] : vector;
  });
  const basis = [[signed[0][0], signed[1][0], signed[2][0]], [signed[0][1], signed[1][1], signed[2][1]], [signed[0][2], signed[1][2], signed[2][2]]];
  if (determinant(basis) < 0) { basis[0][2] *= -1; basis[1][2] *= -1; basis[2][2] *= -1; }
  // Eigenvectors are columns of the model-space basis; transpose maps them to XYZ.
  return quaternionFromMatrix([[basis[0][0], basis[1][0], basis[2][0]], [basis[0][1], basis[1][1], basis[2][1]], [basis[0][2], basis[1][2], basis[2][2]]]);
};
