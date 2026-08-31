import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";
import type { SurfaceProfileKind } from "./surfaceProfiles";

const VDW_RADII: Record<string, number> = { H: 1.20, C: 1.70, N: 1.55, O: 1.52, F: 1.47, P: 1.80, S: 1.80, CL: 1.75, BR: 1.85, I: 1.98, FE: 1.80, MG: 1.73, ZN: 1.39, NA: 2.27, K: 2.75 };
export const vdwRadiusForElement = (element: string): number => VDW_RADII[element.toUpperCase()] ?? 1.70;

export type SurfacePoint = { x: number; y: number; z: number; stableAtomId: string; colorElement: string };

const distanceSquared = (a: SurfacePoint | CanonicalAtom, b: CanonicalAtom): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

const pointCountFor = (quality: number, atomCount: number): number => {
  const requested = Math.max(6, Math.round(quality * 3));
  return atomCount > 1000 ? Math.min(10, requested) : Math.min(36, requested);
};

/** Deterministic exposed-point sampling for the application-native Dot Surface profile. */
export const buildDotSurfacePoints = (
  structure: CanonicalMolecularStructure,
  targetStableAtomIds: readonly string[],
  contributorStableAtomIds: readonly string[],
  profile: SurfaceProfileKind,
  probeRadius: number,
  quality: number,
): SurfacePoint[] => {
  const target = structure.atoms.filter((atom) => targetStableAtomIds.includes(atom.stableId));
  const contributors = structure.atoms.filter((atom) => contributorStableAtomIds.includes(atom.stableId));
  const count = pointCountFor(quality, target.length);
  const points: SurfacePoint[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (const [atomIndex, atom] of target.entries()) {
    const radius = vdwRadiusForElement(atom.element) + (profile === "SAS" || profile === "SES" || profile === "DOT_SURFACE" ? probeRadius : 0);
    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index + 0.5) * (2 / count);
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * (index + atomIndex * 0.37);
      const point: SurfacePoint = { x: atom.x + radius * Math.cos(theta) * ring, y: atom.y + radius * y, z: atom.z + radius * Math.sin(theta) * ring, stableAtomId: atom.stableId, colorElement: atom.element };
      const occluded = contributors.some((other) => other.stableId !== atom.stableId && distanceSquared(point, other) < (vdwRadiusForElement(other.element) + (profile === "SAS" || profile === "SES" || profile === "DOT_SURFACE" ? probeRadius : 0)) ** 2 * 0.92);
      if (!occluded) points.push(point);
    }
  }
  return points;
};
