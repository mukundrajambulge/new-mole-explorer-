/**
 * Numerical policy for canonical Cartesian spatial predicates.
 *
 * The comparison is made on squared distances, so the tolerance is expressed
 * in squared Ångström. It is numerical protection for float64 arithmetic,
 * not a scientific expansion of the user's cutoff.
 */
export const SPATIAL_TOLERANCE_POLICY = {
  id: "cartesian-float64-v1",
  metric: "EUCLIDEAN_SQUARED_ANGSTROM",
  squaredDistanceEpsilon: 1e-12,
  boundary: "CLOSED",
  units: "angstrom",
} as const;

export const withinSpatialBoundary = (distanceSquared: number, cutoffSquared: number): boolean =>
  distanceSquared <= cutoffSquared + SPATIAL_TOLERANCE_POLICY.squaredDistanceEpsilon;
