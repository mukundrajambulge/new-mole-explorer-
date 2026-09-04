import type { CanonicalMolecularStructure } from "@molecular/contracts";

export type SurfaceProfileKind = "VDW" | "SAS" | "SES" | "MESH" | "DOTS" | "DOT_SURFACE";

export type SurfaceGeometryRequest = {
  profile: SurfaceProfileKind;
  profileId: string;
  molecularRevision: string;
  coordinateContext: string;
  targetStableAtomIds: readonly string[];
  contributorStableAtomIds: readonly string[];
  probeRadius: number;
  quality: number;
  sampling: number;
  parameters?: Readonly<Record<string, number | string | boolean>>;
};

const stableList = (values: readonly string[]) => [...new Set(values)].sort().join(",");

/** Renderer-independent cache identity. Renderer surface handles never enter this key. */
export const surfaceCacheKey = (request: SurfaceGeometryRequest): string => [
  request.molecularRevision,
  request.coordinateContext,
  request.profileId,
  stableList(request.targetStableAtomIds),
  stableList(request.contributorStableAtomIds),
  request.probeRadius.toFixed(3),
  request.quality,
  request.sampling,
  JSON.stringify(request.parameters ?? {}),
].join("|");

export const surfaceRequestFor = (
  structure: CanonicalMolecularStructure,
  profile: SurfaceProfileKind,
  targetStableAtomIds: readonly string[],
  contributorStableAtomIds: readonly string[],
  parameters: { probeRadius: number; quality: number; sampling: number },
  context: { coordinateContext?: string; molecularRevision?: string } = {},
): SurfaceGeometryRequest => ({
  profile,
  profileId: `surface.${profile.toLowerCase().replace("_", "-")}.canonical.v1`,
  molecularRevision: context.molecularRevision ?? structure.scientificHash,
  coordinateContext: context.coordinateContext ?? `${structure.id}:coordinates:active`,
  targetStableAtomIds,
  contributorStableAtomIds,
  probeRadius: parameters.probeRadius,
  quality: parameters.quality,
  sampling: parameters.sampling,
  parameters,
});

export class SurfaceGeometryCache<T> {
  private readonly entries = new Map<string, T>();

  get(request: SurfaceGeometryRequest): T | undefined { return this.entries.get(surfaceCacheKey(request)); }
  set(request: SurfaceGeometryRequest, value: T): void { this.entries.set(surfaceCacheKey(request), value); }
  has(request: SurfaceGeometryRequest): boolean { return this.entries.has(surfaceCacheKey(request)); }
  clear(): void { this.entries.clear(); }
  get size(): number { return this.entries.size; }
}

export class SurfaceRequestCoordinator {
  private generation = 0;

  begin(): number { this.generation += 1; return this.generation; }
  isCurrent(generation: number): boolean { return generation === this.generation; }
  invalidate(): void { this.generation += 1; }
  get currentGeneration(): number { return this.generation; }
}
