import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";
import type { SurfaceProfileKind } from "./surfaceProfiles";
import { vdwRadiusForElement } from "../science/vdwRadii";

export { vdwRadiusForElement } from "../science/vdwRadii";

export type SurfacePoint = { x: number; y: number; z: number; stableAtomId: string; colorElement: string };

const distanceSquared = (a: SurfacePoint | CanonicalAtom, b: CanonicalAtom): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

const pointCountFor = (quality: number, sampling: number, atomCount: number): number => {
  // Keep the large-protein path bounded, but never reduce it to the six-point
  // sample that made valid dot targets look empty at workstation scale.
  const boundedQuality = Math.max(0.1, Math.min(1, quality));
  const boundedSampling = Math.max(6, Math.min(36, sampling));
  const requested = Math.max(3, Math.round(boundedSampling * (0.65 + boundedQuality * 0.35)));
  return atomCount > 1000 ? Math.min(6, requested) : Math.min(48, requested);
};

/** Deterministic exposed-point sampling for the application-native Dot Surface profile. */
export const buildDotSurfacePoints = (
  structure: CanonicalMolecularStructure,
  targetStableAtomIds: readonly string[],
  contributorStableAtomIds: readonly string[],
  profile: SurfaceProfileKind,
  probeRadius: number,
  quality: number,
  sampling = 12,
  maxSamplesPerAtom?: number,
): SurfacePoint[] => {
  const target = structure.atoms.filter((atom) => targetStableAtomIds.includes(atom.stableId));
  const contributors = structure.atoms.filter((atom) => contributorStableAtomIds.includes(atom.stableId));
  const count = Math.min(pointCountFor(quality, sampling, target.length), maxSamplesPerAtom ?? Number.POSITIVE_INFINITY);
  const points: SurfacePoint[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const cellSize = 4.5;
  const cellKey = (x: number, y: number, z: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
  const contributorGrid = new Map<string, CanonicalAtom[]>();
  for (const contributor of contributors) contributorGrid.set(cellKey(contributor.x, contributor.y, contributor.z), [...(contributorGrid.get(cellKey(contributor.x, contributor.y, contributor.z)) ?? []), contributor]);
  const nearbyContributors = (point: SurfacePoint): CanonicalAtom[] => {
    const cx = Math.floor(point.x / cellSize); const cy = Math.floor(point.y / cellSize); const cz = Math.floor(point.z / cellSize);
    const nearby: CanonicalAtom[] = [];
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dz = -1; dz <= 1; dz += 1) nearby.push(...contributorGrid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []);
    return nearby;
  };
  for (const [atomIndex, atom] of target.entries()) {
    const radius = vdwRadiusForElement(atom.element) + (profile === "SAS" || profile === "SES" || profile === "DOT_SURFACE" ? probeRadius : 0);
    let atomPointCount = 0;
    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index + 0.5) * (2 / count);
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * (index + atomIndex * 0.37);
      const point: SurfacePoint = { x: atom.x + radius * Math.cos(theta) * ring, y: atom.y + radius * y, z: atom.z + radius * Math.sin(theta) * ring, stableAtomId: atom.stableId, colorElement: atom.element };
      const occluded = nearbyContributors(point).some((other) => other.stableId !== atom.stableId && distanceSquared(point, other) < (vdwRadiusForElement(other.element) + (profile === "SAS" || profile === "SES" || profile === "DOT_SURFACE" ? probeRadius : 0)) ** 2 * 0.92);
      if (!occluded) {
        points.push(point);
        atomPointCount += 1;
      }
    }
    // A finite target atom always has an exposed presentation point. Dense
    // structures can occlude every low-resolution Fibonacci sample, which is
    // a sampling failure rather than a valid empty representation. Select the
    // least-occluded candidate deterministically as a truthful fallback.
    if (atomPointCount === 0) {
      let best: { point: SurfacePoint; clearance: number } | null = null;
      for (let index = 0; index < count; index += 1) {
        const y = 1 - (index + 0.5) * (2 / count);
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * (index + atomIndex * 0.37);
        const point: SurfacePoint = { x: atom.x + radius * Math.cos(theta) * ring, y: atom.y + radius * y, z: atom.z + radius * Math.sin(theta) * ring, stableAtomId: atom.stableId, colorElement: atom.element };
        const clearance = Math.min(...nearbyContributors(point).filter((other) => other.stableId !== atom.stableId).map((other) => Math.sqrt(distanceSquared(point, other)) - vdwRadiusForElement(other.element) - (profile === "SAS" || profile === "SES" || profile === "DOT_SURFACE" ? probeRadius : 0)), 0);
        if (!best || clearance > best.clearance) best = { point, clearance };
      }
      if (best) points.push(best.point);
    }
  }
  return points;
};
