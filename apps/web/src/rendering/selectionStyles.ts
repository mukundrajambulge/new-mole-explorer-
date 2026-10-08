import type { AtomStyleSpec } from "3dmol";
import type { RenderProjection } from "./renderProjection";

export const isCartoonFamily = (representation: RenderProjection["representation"]): boolean => representation === "cartoon" || representation === "ribbon" || representation === "trace" || representation === "putty";

/**
 * Selection is a presentation overlay, not a second atom-by-atom scene.  The
 * overlay deliberately uses the active representation primitive so large
 * selections remain visible without allocating one GLShape per atom.
 */
export const selectionOverlayStyle = (projection: RenderProjection, representationOverride?: RenderProjection["representation"]): AtomStyleSpec => {
  const color = "#55d9ff";
  const colorfunc = () => color;
  const representation = representationOverride ?? projection.representation;
  if (isCartoonFamily(representation)) {
    // 3Dmol builds one cartoon mesh per chain with a single opacity, so any
    // opacity < 1 here would dim the whole chain. Highlight by colour only and
    // add an opaque stick so the picked atom/residue is always visible.
    const thickness = projection.representationState.parameters.cartoonThickness;
    return { cartoon: { color, colorfunc, opacity: 1, arrows: true, thickness }, stick: { color, colorfunc, radius: 0.24, opacity: 1 } } as AtomStyleSpec;
  }
  if (representation === "line" || representation === "lines") {
    return { line: { color, colorfunc, linewidth: Math.max(2.2, projection.representationState.parameters.lineWidth + 1), opacity: 0.95 } } as AtomStyleSpec;
  }
  if (representation === "nonbonded-crosses") {
    return { cross: { color, colorfunc, scale: 0.48, radius: 0.16, opacity: 0.95 } } as AtomStyleSpec;
  }
  if (representation === "spheres" || representation === "space-filling" || representation === "nonbonded-spheres") {
    return { sphere: { color, colorfunc, scale: Math.max(1.05, projection.representationState.parameters.sphereScale * 1.18), opacity: 0.82 } } as AtomStyleSpec;
  }
  if (representation === "ball-and-stick") {
    return { stick: { color, colorfunc, radius: Math.max(0.28, projection.representationState.parameters.stickRadius + 0.06), opacity: 0.86 }, sphere: { color, colorfunc, scale: 1.12, opacity: 0.78 } } as AtomStyleSpec;
  }
  return { stick: { color, colorfunc, radius: Math.max(0.26, projection.representationState.parameters.stickRadius + 0.05), opacity: 0.86 } } as AtomStyleSpec;
};

/**
 * Selection context is a light overlay.  Cartoon opacity is per chain in
 * 3Dmol, so dimming it would fade the whole protein for a 1-atom pick; the
 * cartoon context is therefore left untouched.
 */
export const selectionDeemphasisStyleFor = (projection: RenderProjection): AtomStyleSpec => {
  if (isCartoonFamily(projection.representation)) return {} as AtomStyleSpec;
  if (projection.representation === "line" || projection.representation === "lines") return { line: { opacity: 0.46 } } as AtomStyleSpec;
  if (projection.representation === "spheres" || projection.representation === "space-filling" || projection.representation === "nonbonded-spheres") return { sphere: { opacity: 0.46 } } as AtomStyleSpec;
  if (projection.representation === "ball-and-stick") return { stick: { opacity: 0.46 }, sphere: { opacity: 0.46 } } as AtomStyleSpec;
  if (projection.representation === "nonbonded-crosses") return { cross: { opacity: 0.46 } } as AtomStyleSpec;
  return { stick: { opacity: 0.46 } } as AtomStyleSpec;
};
