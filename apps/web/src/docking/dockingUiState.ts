import type { StructureLoadResult } from "@molecular/contracts";
import type { D2AdaptedSnapshot, D2SearchRegionAuthority } from "./dockingApiAdapter";
import type { SearchRegionOverlay } from "../rendering/searchRegionOverlay";

export type SearchRegionDraft = Readonly<{
  centerX: string;
  centerY: string;
  centerZ: string;
  sizeX: string;
  sizeY: string;
  sizeZ: string;
}>;

export const emptySearchRegionDraft = (): SearchRegionDraft => ({ centerX: "0", centerY: "0", centerZ: "0", sizeX: "10", sizeY: "10", sizeZ: "10" });

export const draftForStructure = (structure: StructureLoadResult["structure"] | null): SearchRegionDraft => {
  if (!structure) return emptySearchRegionDraft();
  const { min, max } = structure.bounds;
  return {
    centerX: String((min.x + max.x) / 2),
    centerY: String((min.y + max.y) / 2),
    centerZ: String((min.z + max.z) / 2),
    sizeX: String(Math.max(0.1, max.x - min.x)),
    sizeY: String(Math.max(0.1, max.y - min.y)),
    sizeZ: String(Math.max(0.1, max.z - min.z)),
  };
};

export type NumericSearchRegionDraft = Readonly<{
  center: readonly [number, number, number];
  size: readonly [number, number, number];
}>;

export const numericSearchRegionDraft = (draft: SearchRegionDraft): NumericSearchRegionDraft | null => {
  const values = [draft.centerX, draft.centerY, draft.centerZ, draft.sizeX, draft.sizeY, draft.sizeZ].map((value) => Number(value));
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [centerX, centerY, centerZ, sizeX, sizeY, sizeZ] = values;
  if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) return null;
  return { center: [centerX, centerY, centerZ], size: [sizeX, sizeY, sizeZ] };
};

export const overlayForDraft = (draft: SearchRegionDraft, coordinateFrame: string): SearchRegionOverlay | null => {
  const numeric = numericSearchRegionDraft(draft);
  if (!numeric) return null;
  return { kind: "DRAFT", center: numeric.center, size: numeric.size, units: "ANGSTROM", coordinateFrame };
};

export const overlayForCommitted = (region: D2SearchRegionAuthority): SearchRegionOverlay => ({
  kind: "COMMITTED",
  center: region.center,
  size: region.size,
  units: "ANGSTROM",
  coordinateFrame: region.coordinateFrame,
  digest: region.digest,
});

export type DockingAdaptationState = Readonly<{
  phase: "IDLE" | "LOADING" | "READY" | "BLOCKED" | "TRANSPORT_ERROR";
  snapshot: D2AdaptedSnapshot | null;
  message: string | null;
}>;

export const emptyDockingAdaptation = (): DockingAdaptationState => ({ phase: "IDLE", snapshot: null, message: null });
