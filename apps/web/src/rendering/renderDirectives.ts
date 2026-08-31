import type { CanonicalMolecularStructure } from "@molecular/contracts";
import { REPRESENTATION_MASKS, REPRESENTATION_TYPES, type RenderProjection, type RepresentationMask, type RepresentationType } from "./presentationState";
import { representationCapabilityFor, styleDefinition, type RepresentationCapabilityStatus, type StyleProfileId } from "./styleProfiles";
import { styleProfileFor } from "./presentationState";
import { surfaceCacheKey, surfaceRequestFor, type SurfaceProfileKind } from "./surfaceProfiles";

export type RenderPrimitive = "line" | "stick" | "sphere" | "cross" | "cartoon" | "surface" | "mesh" | "dots";
export type RenderDirective = { representation: RepresentationType; primitive: RenderPrimitive; targetStableAtomIds: string[]; canonicalBondIds: string[]; styleProfile?: StyleProfileId; surfaceProfile?: SurfaceProfileKind; surfaceCacheKey?: string };
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
  surfaceContributors: number;
  meshContributors: number;
  dotContributors: number;
  surfaceProfile: string | null;
  surfaceCacheKey: string | null;
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
  const safeProjection = projection ?? ({ representation: "cartoon", colorDiagnostic: null } as RenderProjection);
  return { structureId: null, presentationRevision, directives: [], representation: emptyRepresentationDiagnostics(safeProjection), sphereContributors: 0, stickCylinderContributors: 0, lineContributors: 0, cartoonContributors: 0, ribbonContributors: 0, traceContributors: 0, puttyContributors: 0, crossContributors: 0, waterSphereContributors: 0, ionSphereContributors: 0, surfaceContributors: 0, meshContributors: 0, dotContributors: 0, surfaceProfile: null, surfaceCacheKey: null, colorDiagnostic: safeProjection.colorDiagnostic ?? null, styleProfile: styleProfileFor(safeProjection.representation) };
};

const atomMask = (projection: RenderProjection, stableId: string): RepresentationMask => projection.representationState.atomRepMasks[stableId] ?? 0;
const atomIsVisible = (projection: RenderProjection, atom: CanonicalMolecularStructure["atoms"][number]): boolean => atom.isPolymer ? projection.showProtein : atom.isLigand ? projection.showLigand : atom.isWater ? projection.showWater : atom.isIon ? projection.showIons : projection.showOther;
const hasMask = (projection: RenderProjection, atom: CanonicalMolecularStructure["atoms"][number], mask: RepresentationMask) => Boolean(atomMask(projection, atom.stableId) & mask);
const unique = (values: string[]) => [...new Set(values)];
const atomStyle = (projection: RenderProjection, atom: CanonicalMolecularStructure["atoms"][number]): string => projection.representationState.atomRepStyles[atom.stableId] ?? (atom.isPolymer ? projection.representation : atom.isLigand ? "ball-and-stick" : "spheres");
const surfaceKindForStyle = (style: string): SurfaceProfileKind => style === "solvent-accessible-surface" ? "SAS" : style === "solvent-excluded-surface" ? "SES" : style === "mesh" ? "MESH" : style === "dots" ? "DOTS" : style === "dot-surface" ? "DOT_SURFACE" : "VDW";

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
  const cartoonIds = visibleAtoms.filter((atom) => hasMask(projection, atom, REPRESENTATION_MASKS.CARTOON) && atomStyle(projection, atom) === "cartoon").map((atom) => atom.stableId);
  const traceIds = visibleAtoms.filter((atom) => hasMask(projection, atom, REPRESENTATION_MASKS.CARTOON) && atomStyle(projection, atom) === "trace").map((atom) => atom.stableId);
  const puttyIds = visibleAtoms.filter((atom) => hasMask(projection, atom, REPRESENTATION_MASKS.CARTOON) && atomStyle(projection, atom) === "putty" && atom.bFactor !== undefined && atom.bFactor !== null).map((atom) => atom.stableId);
  const ribbonIds = visibleAtoms.filter((atom) => hasMask(projection, atom, REPRESENTATION_MASKS.RIBBON)).map((atom) => atom.stableId);
  const surfaceStyles = ["van-der-waals-surface", "solvent-accessible-surface", "solvent-excluded-surface", "mesh", "dots", "dot-surface"] as const;
  const surfaceDirectives: RenderDirective[] = [];
  for (const style of surfaceStyles) {
    const ids = visibleAtoms.filter((atom) => atomStyle(projection, atom) === style && hasMask(projection, atom, style === "mesh" ? REPRESENTATION_MASKS.MESH : REPRESENTATION_MASKS[typeForSurfaceStyle(style)])).map((atom) => atom.stableId);
    if (!ids.length) continue;
    const kind = surfaceKindForStyle(style);
    const request = surfaceRequestFor(structure, kind, ids, structure.atoms.map((atom) => atom.stableId), { probeRadius: (kind === "SAS" || kind === "SES" || kind === "DOT_SURFACE") ? projection.representationState.parameters.surfaceProbeRadius : 0, quality: projection.representationState.parameters.surfaceQuality, sampling: projection.representationState.parameters.dotDensity });
    surfaceDirectives.push({ representation: kind === "MESH" ? "MESH" : kind === "DOTS" || kind === "DOT_SURFACE" ? "DOTS" : "SURFACE", primitive: kind === "MESH" ? "mesh" : kind === "DOTS" || kind === "DOT_SURFACE" ? "dots" : "surface", targetStableAtomIds: ids, canonicalBondIds: [], styleProfile: style, surfaceProfile: kind, surfaceCacheKey: surfaceCacheKey({ ...request, profileId: style === "van-der-waals-surface" ? "surface.vdw.element-vdw.v1" : style === "solvent-accessible-surface" ? "surface.sas.element-vdw.probe-1.4A.v1" : style === "solvent-excluded-surface" ? "surface.ses.element-vdw.probe-1.4A.v1" : style }) });
  }
  const directives: RenderDirective[] = [];
  const addDirective = (representation: RepresentationType, primitive: RenderPrimitive, targetStableAtomIds: string[], canonicalBondIds: string[], styleProfile?: StyleProfileId) => { if (targetStableAtomIds.length || canonicalBondIds.length) directives.push({ representation, primitive, targetStableAtomIds: unique(targetStableAtomIds), canonicalBondIds: unique(canonicalBondIds), ...(styleProfile ? { styleProfile } : {}) }); };
  addDirective("LINES", "line", lineIds, lineBondIds, "line"); addDirective("STICKS", "stick", stickIds, stickBondIds, "stick"); addDirective("SPHERES", "sphere", atomsForMask(REPRESENTATION_MASKS.SPHERES), [], "space-filling");
  addDirective("CARTOON", "cartoon", cartoonIds, [], "cartoon"); addDirective("CARTOON", "cartoon", traceIds, [], "trace"); addDirective("CARTOON", "cartoon", puttyIds, [], "putty"); addDirective("RIBBON", "cartoon", ribbonIds, [], "ribbon");
  addDirective("NONBONDED", "cross", nonbondedIds, [], "nonbonded-crosses"); addDirective("NB_SPHERES", "sphere", nonbondedSphereIds, [], "nonbonded-spheres"); directives.push(...surfaceDirectives);
  const representation = emptyRepresentationDiagnostics(projection, structure);
  const setDiagnostic = (type: RepresentationType, atomContributors: number, bondContributors: number) => { representation[type] = { ...representation[type], active: atomContributors > 0 || bondContributors > 0, atomContributors, bondContributors }; };
  setDiagnostic("LINES", lineIds.length, lineBondIds.length); setDiagnostic("STICKS", stickIds.length, stickBondIds.length); setDiagnostic("SPHERES", atomsForMask(REPRESENTATION_MASKS.SPHERES).length, 0); setDiagnostic("CARTOON", cartoonIds.length + traceIds.length + puttyIds.length, 0); setDiagnostic("RIBBON", ribbonIds.length, 0); setDiagnostic("NONBONDED", nonbondedIds.length, 0); setDiagnostic("NB_SPHERES", nonbondedSphereIds.length, 0);
  setDiagnostic("SURFACE", surfaceDirectives.filter((directive) => directive.primitive === "surface").reduce((count, directive) => count + directive.targetStableAtomIds.length, 0), 0); setDiagnostic("MESH", surfaceDirectives.filter((directive) => directive.primitive === "mesh").reduce((count, directive) => count + directive.targetStableAtomIds.length, 0), 0); setDiagnostic("DOTS", surfaceDirectives.filter((directive) => directive.primitive === "dots").reduce((count, directive) => count + directive.targetStableAtomIds.length, 0), 0);
  const styleProfile = styleDefinition(styleProfileFor(projection.representation)).id;
  const primarySurface = surfaceDirectives.find((directive) => directive.surfaceProfile);
  const colorDiagnostic = projection.colorDiagnostic ?? null;
  return { structureId: structure.id, presentationRevision: projection.representationState.presentationRevision, directives, representation, sphereContributors: sphereIds.length, stickCylinderContributors: stickBondIds.length, lineContributors: lineBondIds.length, cartoonContributors: cartoonIds.length, ribbonContributors: ribbonIds.length, traceContributors: traceIds.length, puttyContributors: puttyIds.length, crossContributors: nonbondedIds.length, waterSphereContributors: sphereIds.filter((id) => atomsById.get(id)?.isWater).length, ionSphereContributors: sphereIds.filter((id) => atomsById.get(id)?.isIon).length, surfaceContributors: surfaceDirectives.filter((directive) => directive.primitive === "surface").reduce((count, directive) => count + directive.targetStableAtomIds.length, 0), meshContributors: surfaceDirectives.filter((directive) => directive.primitive === "mesh").reduce((count, directive) => count + directive.targetStableAtomIds.length, 0), dotContributors: surfaceDirectives.filter((directive) => directive.primitive === "dots").reduce((count, directive) => count + directive.targetStableAtomIds.length, 0), surfaceProfile: primarySurface?.surfaceProfile ?? null, surfaceCacheKey: primarySurface?.surfaceCacheKey ?? null, colorDiagnostic, styleProfile };
};

const typeForSurfaceStyle = (style: string): RepresentationType => style === "mesh" ? "MESH" : style === "dots" || style === "dot-surface" ? "DOTS" : "SURFACE";
