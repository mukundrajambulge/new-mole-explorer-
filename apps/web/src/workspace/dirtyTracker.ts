// Revision-counter dirty tracking.  No serialization: slices are compared by
// reference, and hover (interaction.hoveredAtomId) is excluded generically so
// new RenderProjection fields are tracked by default.
export type DirtyTracker = { revision: number; slices: readonly unknown[] | null; projection: object | null };

export const createDirtyTracker = (): DirtyTracker => ({ revision: 0, slices: null, projection: null });

type ProjectionLike = { interaction: Record<string, unknown> } & Record<string, unknown>;

/** True when the two projections differ in anything except the hovered atom. */
export const projectionPersistedChanged = (prev: ProjectionLike, next: ProjectionLike): boolean => {
  if (prev === next) return false;
  for (const key of Object.keys(next)) {
    if (key === "interaction") continue;
    if (prev[key] !== next[key]) return true;
  }
  if (Object.keys(prev).length !== Object.keys(next).length) return true;
  const a = prev.interaction; const b = next.interaction;
  if (a === b) return false;
  for (const key of Object.keys(b)) {
    if (key === "hoveredAtomId") continue;
    if (a[key] !== b[key]) return true;
  }
  return Object.keys(a).length !== Object.keys(b).length;
};

/**
 * Same-render and idempotent for identical inputs: bumps tracker.revision once
 * if any slice (or the persisted part of the projection) changed by reference.
 */
export const trackWorkspaceRevision = (tracker: DirtyTracker, projection: ProjectionLike, slices: readonly unknown[]): number => {
  const prevSlices = tracker.slices;
  let changed = prevSlices === null || prevSlices.length !== slices.length;
  if (!changed) for (let i = 0; i < slices.length; i++) if (!Object.is(prevSlices![i], slices[i])) { changed = true; break; }
  const prevProjection = tracker.projection as ProjectionLike | null;
  if (prevProjection === null || projectionPersistedChanged(prevProjection, projection)) { changed = true; tracker.projection = projection; }
  if (changed) { tracker.slices = slices; if (prevSlices !== null) tracker.revision += 1; }
  return tracker.revision;
};

/** Dirty means revision !== savedRevision; a null baseline is never dirty. */
export const isDirty = (revision: number, savedRevision: number | null): boolean => savedRevision !== null && savedRevision !== revision;
