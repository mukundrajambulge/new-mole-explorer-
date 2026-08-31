import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { REPRESENTATION_MASKS, REPRESENTATION_TYPES, type RenderProjection, type RepresentationMask, type RepresentationType } from "./presentationState";
import { representationCapabilityFor, styleDefinition, type RepresentationCapabilityStatus, type StyleProfileId } from "./styleProfiles";
import { styleProfileFor } from "./presentationState";

export type RenderPrimitive = "line" | "stick" | "sphere" | "cross" | "cartoon";
export type RenderDirective = { representation: RepresentationType; primitive: RenderPrimitive; targetStableAtomIds: string[]; canonicalBondIds: string[] };
export type RepresentationDiagnostic = { supported: boolean; active: boolean; atomContributors: number; bondContributors: number; capability: string; status: RepresentationCapabilityStatus; eligibleAtomCount: number | null; diagnostic?: string };
export type RenderProjectionDiagnostics = {
  structureId: string | null;
  presentationRevision: number;
  directives: RenderDirective[];
  representation: Record<RepresentationType, RepresentationDiagnostic>;
  sphereContributors: number;
  stickCylinderContributors: number;
  lineContributors: number;
  cartoonContributors: number;
  ribbonContributors: number;
  traceContributors: number;
  puttyContributors: number;
  crossContributors: number;
  waterSphereContributors: number;
  ionSphereContributors: number;
  colorDiagnostic: string | null;
  styleProfile: StyleProfileId;
};

const styleForRepresentation = (type: RepresentationType, projection: RenderProjection): string => {
  if (type === "LINES") return "line";
  if (type === "STICKS") return "stick";
  if (type === "SPHERES") return "space-filling";
  if (type === "CARTOON") return ["cartoon", "trace", "putty"].includes(projection.representation) ? projection.representation : "cartoon";
  if (type === "RIBBON") return "ribbon";
  if (type === "NONBONDED") return "nonbonded-crosses";
  if (type === "NB_SPHERES") return "nonbonded-spheres";
  if (type === "MESH") return "mesh";
  if (type === "DOTS") return "dots";
  return "van-der-waals-surface";
};

const capabilityFor = (type: RepresentationType, projection: RenderProjection, structure: CanonicalMolecularStructure | null): RepresentationDiagnostic => {
  const capability = representationCapabilityFor(styleForRepresentation(type, projection), structure);
  return { supported: capability.maySelect, active: false, atomContributors: 0, bondContributors: 0, capability: capability.capability, status: capability.status, eligibleAtomCount: capability.eligibleAtomCount, diagnostic: capability.diagnostic ?? capability.unsupportedReason };
};

const emptyRepresentationDiagnostics = (projection: RenderProjection, structure: CanonicalMolecularStructure | null = null): Record<RepresentationType, RepresentationDiagnostic> => Object.fromEntries(REPRESENTATION_TYPES.map((type) => [type, capabilityFor(type, projection, structure)])) as Record<RepresentationType, RepresentationDiagnostic>;

export const emptyRenderProjectionDiagnostics = (presentationRevision = 0, projection?: RenderProjection): RenderProjectionDiagnostics => {
  const safeProjection = projection ?? ({ representation: "cartoon" } as RenderProjection);
  return { structureId: null, presentationRevision, directives: [], representation: emptyRepresentationDiagnostics(safeProjection), sphereContributors: 0, stickCylinderContributors: 0, lineContributors: 0, cartoonContributors: 0, ribbonContributors: 0, traceContributors: 0, puttyContributors: 0, crossContributors: 0, waterSphereContributors: 0, ionSphereContributors: 0, colorDiagnostic: safeProjection.colorDiagnostic ?? null, styleProfile: styleProfileFor(safeProjection.representation) };
};

const atomMask = (projection: RenderProjection, stableId: string): RepresentationMask => projection.representationState.atomRepMasks[stableId] ?? 0;
const atomIsVisible = (projection: RenderProjection, atom: CanonicalMolecularStructure["atoms"][number]): boolean => atom.isPolymer ? projection.showProtein : atom.isLigand ? projection.showLigand : atom.isWater ? projection.showWater : atom.isIon ? projection.showIons : projection.showOther;
const hasMask = (projection: RenderProjection, atom: CanonicalMolecularStructure["atoms"][number], mask: RepresentationMask) => Boolean(atomMask(projection, atom.stableId) & mask);
const unique = (values: string[]) => [...new Set(values)];

export const buildRenderProjectionDiagnostics = (structure: CanonicalMolecularStructure | null, projection: RenderProjection): RenderProjectionDiagnostics => {
  if (!structure) return emptyRenderProjectionDiagnostics(projection.representationState.presentationRevision, projection);
  const visibleAtoms = structure.atoms.filter((atom) => atomIsVisible(projection, atom));
  const visibleIds = new Set(visibleAtoms.map((atom) => atom.stableId));
  const atomsById = new Map(structure.atoms.map((atom) => [atom.stableId, atom]));
  const bondedIds = new Set(structure.bonds.flatMap((bond) => [bond.atom1, bond.atom2]));
  const atomsForMask = (mask: RepresentationMask) => visibleAtoms.filter((atom) => hasMask(projection, atom, mask)).map((atom) => atom.stableId);
  const bondsForMask = (mask: RepresentationMask) => structure.bonds.filter((bond) => visibleIds.has(bond.atom1) && visibleIds.has(bond.atom2) && hasMask(projection, atomsById.get(bond.atom1)!, mask) && hasMask(projection, atomsById.get(bond.atom2)!, mask)).map((bond) => bond.id);
  const nonbondedIds = visibleAtoms.filter((atom) => !bondedIds.has(atom.stableId) && hasMask(projection, atom, REPRESENTATION_MASKS.NONBONDED)).map((atom) => atom.stableId);
  const nonbondedSphereIds = visibleAtoms.filter((atom) => !bondedIds.has(atom.stableId) && hasMask(projection, atom, REPRESENTATION_MASKS.NB_SPHERES)).map((atom) => atom.stableId);
  const sphereIds = unique([...atomsForMask(REPRESENTATION_MASKS.SPHERES), ...nonbondedSphereIds]);
  const lineIds = atomsForMask(REPRESENTATION_MASKS.LINES); const lineBondIds = bondsForMask(REPRESENTATION_MASKS.LINES);
  const stickIds = atomsForMask(REPRESENTATION_MASKS.STICKS); const stickBondIds = bondsForMask(REPRESENTATION_MASKS.STICKS);
  const cartoonIds = atomsForMask(REPRESENTATION_MASKS.CARTOON); const ribbonIds = atomsForMask(REPRESENTATION_MASKS.RIBBON);
  const puttyReady = structure.atoms.some((atom) => atom.isPolymer && atom.bFactor !== undefined && atom.bFactor !== null);
  const ribbonCapability = capabilityFor("RIBBON", projection, structure);
  const directives: RenderDirective[] = [];
  const addDirective = (representation: RepresentationType, primitive: RenderPrimitive, targetStableAtomIds: string[], canonicalBondIds: string[]) => { if (targetStableAtomIds.length || canonicalBondIds.length) directives.push({ representation, primitive, targetStableAtomIds: unique(targetStableAtomIds), canonicalBondIds: unique(canonicalBondIds) }); };
  addDirective("LINES", "line", lineIds, lineBondIds);
  addDirective("STICKS", "stick", stickIds, stickBondIds);
  addDirective("SPHERES", "sphere", atomsForMask(REPRESENTATION_MASKS.SPHERES), []);
  if (!(projection.representation === "putty" && !puttyReady)) addDirective("CARTOON", "cartoon", cartoonIds, []);
  if (ribbonCapability.supported) addDirective("RIBBON", "cartoon", ribbonIds, []);
  addDirective("NONBONDED", "cross", nonbondedIds, []);
  addDirective("NB_SPHERES", "sphere", nonbondedSphereIds, []);
  const representation = emptyRepresentationDiagnostics(projection, structure);
  const setDiagnostic = (type: RepresentationType, atomContributors: number, bondContributors: number) => { representation[type] = { ...representation[type], active: atomContributors > 0 || bondContributors > 0, atomContributors, bondContributors }; };
  setDiagnostic("LINES", lineIds.length, lineBondIds.length); setDiagnostic("STICKS", stickIds.length, stickBondIds.length); setDiagnostic("SPHERES", atomsForMask(REPRESENTATION_MASKS.SPHERES).length, 0); setDiagnostic("CARTOON", cartoonIds.length, 0); setDiagnostic("RIBBON", ribbonCapability.supported ? ribbonIds.length : 0, 0); setDiagnostic("NONBONDED", nonbondedIds.length, 0); setDiagnostic("NB_SPHERES", nonbondedSphereIds.length, 0);
  for (const type of ["SURFACE", "MESH", "DOTS"] as const) setDiagnostic(type, atomsForMask(REPRESENTATION_MASKS[type]).length, 0);
  const styleProfile = styleProfileFor(projection.representation);
  const style = styleDefinition(styleProfile);
  const polymerCount = visibleAtoms.filter((atom) => atom.isPolymer && (hasMask(projection, atom, REPRESENTATION_MASKS.CARTOON) || hasMask(projection, atom, REPRESENTATION_MASKS.RIBBON))).length;
  const colorDiagnostic = projection.colorDiagnostic ?? null;
  const cartoonContributors = projection.representation === "putty" && !puttyReady ? 0 : ["cartoon", "trace", "putty"].includes(projection.representation) ? polymerCount : cartoonIds.filter((id) => atomsById.get(id)?.isPolymer).length;
  return { structureId: structure.id, presentationRevision: projection.representationState.presentationRevision, directives, representation, sphereContributors: sphereIds.length, stickCylinderContributors: stickBondIds.length, lineContributors: lineBondIds.length, cartoonContributors, ribbonContributors: ribbonCapability.supported ? ribbonIds.length : 0, traceContributors: projection.representation === "trace" ? polymerCount : 0, puttyContributors: projection.representation === "putty" && puttyReady ? polymerCount : 0, crossContributors: nonbondedIds.length, waterSphereContributors: sphereIds.filter((id) => atomsById.get(id)?.isWater).length, ionSphereContributors: sphereIds.filter((id) => atomsById.get(id)?.isIon).length, colorDiagnostic, styleProfile: style.id };
};
