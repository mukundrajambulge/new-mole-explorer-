import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";

export type PuttyProfile = { minRadius: number; maxRadius: number; minScalar: number; maxScalar: number; scalarSource: "B_FACTOR" };

const residueKey = (atom: CanonicalAtom) => `${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}`;

export const puttyProfileFor = (structure: CanonicalMolecularStructure, minRadius = 0.18, maxRadius = 0.72): PuttyProfile | null => {
  const values = structure.atoms.filter((atom) => atom.isPolymer && atom.bFactor !== undefined && atom.bFactor !== null).map((atom) => atom.bFactor as number);
  if (!values.length) return null;
  return { minRadius, maxRadius, minScalar: Math.min(...values), maxScalar: Math.max(...values), scalarSource: "B_FACTOR" };
};

export const puttyRadiusForAtom = (atom: CanonicalAtom, profile: PuttyProfile): number | null => {
  if (!atom.isPolymer || atom.bFactor === undefined || atom.bFactor === null) return null;
  const range = profile.maxScalar - profile.minScalar;
  const normalized = range < 1e-9 ? 0.5 : Math.max(0, Math.min(1, (atom.bFactor - profile.minScalar) / range));
  return profile.minRadius + normalized * (profile.maxRadius - profile.minRadius);
};

export const puttyResidueRadii = (structure: CanonicalMolecularStructure, profile = puttyProfileFor(structure)): ReadonlyMap<string, number> => {
  const result = new Map<string, number>();
  if (!profile) return result;
  const residueValues = new Map<string, number[]>();
  for (const atom of structure.atoms) {
    const radius = puttyRadiusForAtom(atom, profile);
    if (radius === null) continue;
    residueValues.set(residueKey(atom), [...(residueValues.get(residueKey(atom)) ?? []), radius]);
  }
  for (const [key, values] of residueValues) result.set(key, values.reduce((sum, value) => sum + value, 0) / values.length);
  return result;
};

export const puttyRadiusForResidue = (atom: CanonicalAtom, radii: ReadonlyMap<string, number>): number | null => radii.get(residueKey(atom)) ?? null;
