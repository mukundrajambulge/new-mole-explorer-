export type SearchRegionOverlay = Readonly<{
  kind: "DRAFT" | "COMMITTED";
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  units: "ANGSTROM";
  coordinateFrame: string;
  digest?: string;
}>;

export const isFiniteSearchRegionOverlay = (overlay: SearchRegionOverlay | null | undefined): overlay is SearchRegionOverlay => Boolean(
  overlay
  && overlay.center.length === 3
  && overlay.size.length === 3
  && overlay.center.every(Number.isFinite)
  && overlay.size.every((value) => Number.isFinite(value) && value > 0),
);
