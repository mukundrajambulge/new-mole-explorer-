/**
 * Versioned van der Waals radius property source used by scientific gap
 * selection and renderer surface profiles. Values are in Angstroms.
 *
 * The strict lookup is deliberately separate from the renderer convenience
 * fallback: a missing radius must never silently change a selection result.
 */
export const VDW_RADIUS_PROFILE = {
  id: "canonical-element-vdw-radius",
  version: "1",
  fingerprint: "canonical-element-vdw-radius-v1",
} as const;

export const VDW_RADII_A: Readonly<Record<string, number>> = {
  H: 1.20,
  C: 1.70,
  N: 1.55,
  O: 1.52,
  F: 1.47,
  P: 1.80,
  S: 1.80,
  CL: 1.75,
  BR: 1.85,
  I: 1.98,
  FE: 1.80,
  MG: 1.73,
  ZN: 1.39,
  NA: 2.27,
  K: 2.75,
};

export const vdwRadiusForElementStrict = (element: string): number | null =>
  VDW_RADII_A[element.trim().toUpperCase()] ?? null;

/** Renderer-only compatibility helper for existing surface presentation. */
export const vdwRadiusForElement = (element: string): number =>
  vdwRadiusForElementStrict(element) ?? 1.70;
