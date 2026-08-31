import type { CanonicalMolecularStructure } from "@molecular/contracts";
import {
  REPRESENTATION_MASKS,
  REPRESENTATION_TYPES,
  type RenderProjection,
  type RepresentationMask,
  type RepresentationType,
} from "./presentationState";

export type RenderPrimitive = "line" | "stick" | "sphere" | "cartoon";

export type RenderDirective = {
  representation: RepresentationType;
  primitive: RenderPrimitive;
  targetStableAtomIds: string[];
  canonicalBondIds: string[];
};

export type RepresentationDiagnostic = {
  supported: boolean;
  active: boolean;
  atomContributors: number;
  bondContributors: number;
};

export type RenderProjectionDiagnostics = {
  structureId: string | null;
  presentationRevision: number;
  directives: RenderDirective[];
  representation: Record<RepresentationType, RepresentationDiagnostic>;
  sphereContributors: number;
  stickCylinderContributors: number;
  lineContributors: number;
  cartoonContributors: number;
  waterSphereContributors: number;
  ionSphereContributors: number;
};

const supportedRepresentations = new Set<RepresentationType>([
  "LINES",
  "STICKS",
  "SPHERES",
  "CARTOON",
  "NB_SPHERES",
]);

const emptyRepresentationDiagnostics = (): Record<RepresentationType, RepresentationDiagnostic> => Object.fromEntries(
  REPRESENTATION_TYPES.map((representation) => [representation, { supported: supportedRepresentations.has(representation), active: false, atomContributors: 0, bondContributors: 0 }]),
) as Record<RepresentationType, RepresentationDiagnostic>;

export const emptyRenderProjectionDiagnostics = (presentationRevision = 0): RenderProjectionDiagnostics => ({
  structureId: null,
  presentationRevision,
  directives: [],
  representation: emptyRepresentationDiagnostics(),
  sphereContributors: 0,
  stickCylinderContributors: 0,
  lineContributors: 0,
  cartoonContributors: 0,
  waterSphereContributors: 0,
  ionSphereContributors: 0,
});

const atomMask = (projection: RenderProjection, stableId: string): RepresentationMask => projection.representationState.atomRepMasks[stableId] ?? 0;

const atomIsVisible = (projection: RenderProjection, atom: CanonicalMolecularStructure["atoms"][number]): boolean => {
  if (atom.isPolymer) return projection.showProtein;
  if (atom.isLigand) return projection.showLigand;
  if (atom.isWater) return projection.showWater;
  if (atom.isIon) return projection.showIons;
  return projection.showOther;
};

const hasMask = (projection: RenderProjection, atom: CanonicalMolecularStructure["atoms"][number], mask: RepresentationMask): boolean => Boolean(atomMask(projection, atom.stableId) & mask);

const unique = (values: string[]) => [...new Set(values)];

export const buildRenderProjectionDiagnostics = (
  structure: CanonicalMolecularStructure | null,
  projection: RenderProjection,
): RenderProjectionDiagnostics => {
  if (!structure) return emptyRenderProjectionDiagnostics(projection.representationState.presentationRevision);

  const visibleAtoms = structure.atoms.filter((atom) => atomIsVisible(projection, atom));
  const visibleIds = new Set(visibleAtoms.map((atom) => atom.stableId));
  const atomsById = new Map(structure.atoms.map((atom) => [atom.stableId, atom]));
  const bondedIds = new Set(structure.bonds.flatMap((bond) => [bond.atom1, bond.atom2]));
  const atomsForMask = (mask: RepresentationMask) => visibleAtoms.filter((atom) => hasMask(projection, atom, mask)).map((atom) => atom.stableId);
  const bondsForMask = (mask: RepresentationMask) => structure.bonds.filter((bond) => visibleIds.has(bond.atom1) && visibleIds.has(bond.atom2) && hasMask(projection, atomsById.get(bond.atom1)!, mask) && hasMask(projection, atomsById.get(bond.atom2)!, mask)).map((bond) => bond.id);
  const nonbondedSphereIds = visibleAtoms.filter((atom) => hasMask(projection, atom, REPRESENTATION_MASKS.NB_SPHERES) && !bondedIds.has(atom.stableId)).map((atom) => atom.stableId);
  const sphereIds = unique([
    ...atomsForMask(REPRESENTATION_MASKS.SPHERES),
    ...nonbondedSphereIds,
  ]);
  const lineIds = atomsForMask(REPRESENTATION_MASKS.LINES);
  const lineBondIds = bondsForMask(REPRESENTATION_MASKS.LINES);
  const stickIds = atomsForMask(REPRESENTATION_MASKS.STICKS);
  const stickBondIds = bondsForMask(REPRESENTATION_MASKS.STICKS);
  const cartoonIds = atomsForMask(REPRESENTATION_MASKS.CARTOON);
  const directives: RenderDirective[] = [];
  const addDirective = (representation: RepresentationType, primitive: RenderPrimitive, targetStableAtomIds: string[], canonicalBondIds: string[]) => {
    if (targetStableAtomIds.length || canonicalBondIds.length) directives.push({ representation, primitive, targetStableAtomIds: unique(targetStableAtomIds), canonicalBondIds: unique(canonicalBondIds) });
  };

  addDirective("LINES", "line", lineIds, lineBondIds);
  addDirective("STICKS", "stick", stickIds, stickBondIds);
  addDirective("SPHERES", "sphere", atomsForMask(REPRESENTATION_MASKS.SPHERES), []);
  addDirective("CARTOON", "cartoon", cartoonIds, []);
  addDirective("NB_SPHERES", "sphere", nonbondedSphereIds, []);

  const representation = emptyRepresentationDiagnostics();
  const setDiagnostic = (type: RepresentationType, atomContributors: number, bondContributors: number) => {
    representation[type] = { ...representation[type], active: atomContributors > 0 || bondContributors > 0, atomContributors, bondContributors };
  };
  setDiagnostic("LINES", lineIds.length, lineBondIds.length);
  setDiagnostic("STICKS", stickIds.length, stickBondIds.length);
  setDiagnostic("SPHERES", atomsForMask(REPRESENTATION_MASKS.SPHERES).length, 0);
  setDiagnostic("CARTOON", cartoonIds.length, 0);
  setDiagnostic("NB_SPHERES", nonbondedSphereIds.length, 0);
  for (const unsupported of ["RIBBON", "SURFACE", "MESH", "DOTS", "NONBONDED"] as const) {
    const ids = atomsForMask(REPRESENTATION_MASKS[unsupported]);
    setDiagnostic(unsupported, ids.length, 0);
  }

  return {
    structureId: structure.id,
    presentationRevision: projection.representationState.presentationRevision,
    directives,
    representation,
    sphereContributors: sphereIds.length,
    stickCylinderContributors: stickBondIds.length,
    lineContributors: lineBondIds.length,
    cartoonContributors: cartoonIds.length,
    waterSphereContributors: sphereIds.filter((stableId) => atomsById.get(stableId)?.isWater).length,
    ionSphereContributors: sphereIds.filter((stableId) => atomsById.get(stableId)?.isIon).length,
  };
};
