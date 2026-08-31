import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";
import { REPRESENTATION_MASKS, REPRESENTATION_PRESETS, type RepresentationMask, type RepresentationType } from "../rendering/presentationState";

export type SelectionResult = {
  schemaVersion: 1;
  query: string;
  structureId: string;
  molecularRevision: string;
  stableAtomIds: readonly string[];
  membershipHash: string;
};

export class SelectionResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelectionResolutionError";
  }
}

const hashMembership = (values: readonly string[]): string => {
  let hash = 2166136261;
  for (const value of values) for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const unquote = (value: string) => value.trim().replace(/^['"]|['"]$/g, "");

const atomMatchesClause = (atom: CanonicalAtom, clause: string): boolean => {
  const normalized = clause.trim().replace(/^\(|\)$/g, "");
  if (!normalized || normalized === "all" || normalized === "*" || normalized === "everything") return true;
  const negated = normalized.toLowerCase().startsWith("not ");
  const expression = negated ? normalized.slice(4).trim() : normalized;
  const [operator, ...rest] = expression.split(/\s+/);
  const value = unquote(rest.join(" "));
  const field = operator?.toLowerCase();
  let matches: boolean;
  if (field === "polymer" || field === "protein") matches = atom.isPolymer;
  else if (field === "ligand" || field === "organic") matches = atom.isLigand;
  else if (field === "water") matches = atom.isWater;
  else if (field === "ion" || field === "ions") matches = atom.isIon;
  else if (field === "other") matches = !atom.isPolymer && !atom.isLigand && !atom.isWater && !atom.isIon;
  else if (field === "chain") matches = atom.chain.toLowerCase() === value.toLowerCase();
  else if (field === "resi" || field === "residue" || field === "resid") matches = atom.residueNumber === Number(value);
  else if (field === "resn" || field === "residue-name") matches = atom.residueName.toLowerCase() === value.toLowerCase();
  else if (field === "name" || field === "atom") matches = atom.atomName.toLowerCase() === value.toLowerCase();
  else if (field === "elem" || field === "element") matches = atom.element.toLowerCase() === value.toLowerCase();
  else if (field === "id" || field === "atomid" || field === "stableid") matches = atom.stableId === value;
  else if (field === "serial") matches = atom.serial === Number(value);
  else throw new SelectionResolutionError(`Unsupported selection clause: ${clause}`);
  return negated ? !matches : matches;
};

export const resolveSelection = (query: string, structure: CanonicalMolecularStructure): SelectionResult => {
  const trimmed = query.trim();
  if (!trimmed) throw new SelectionResolutionError("A selection query is required.");
  const clauses = trimmed.split(/\s+and\s+|\s*&\s*/i).map((clause) => clause.trim()).filter(Boolean);
  if (clauses.some((clause) => /^not\s+all$/i.test(clause))) throw new SelectionResolutionError("The selection `not all` is not supported as a target operation.");
  const stableAtomIds = structure.atoms.filter((atom) => clauses.every((clause) => atomMatchesClause(atom, clause))).map((atom) => atom.stableId);
  return { schemaVersion: 1, query: trimmed, structureId: structure.id, molecularRevision: structure.scientificHash, stableAtomIds, membershipHash: hashMembership(stableAtomIds) };
};

export const selectionForStableIds = (stableAtomIds: readonly string[], structure: CanonicalMolecularStructure): SelectionResult => {
  const known = new Set(structure.atoms.map((atom) => atom.stableId));
  const normalized = [...new Set(stableAtomIds)].filter((stableId) => known.has(stableId));
  return { schemaVersion: 1, query: `stable:${normalized.join(",")}`, structureId: structure.id, molecularRevision: structure.scientificHash, stableAtomIds: normalized, membershipHash: hashMembership(normalized) };
};

export type RepresentationCommand = {
  operation: "SHOW" | "HIDE" | "SHOW_AS";
  mask: RepresentationMask;
  representation: RepresentationType | "BALL_AND_STICK";
  query: string;
};

const representationNames: Record<string, { mask: RepresentationMask; representation: RepresentationType | "BALL_AND_STICK" }> = {
  line: { mask: REPRESENTATION_MASKS.LINES, representation: "LINES" },
  lines: { mask: REPRESENTATION_MASKS.LINES, representation: "LINES" },
  stick: { mask: REPRESENTATION_MASKS.STICKS, representation: "STICKS" },
  sticks: { mask: REPRESENTATION_MASKS.STICKS, representation: "STICKS" },
  sphere: { mask: REPRESENTATION_MASKS.SPHERES, representation: "SPHERES" },
  spheres: { mask: REPRESENTATION_MASKS.SPHERES, representation: "SPHERES" },
  cartoon: { mask: REPRESENTATION_MASKS.CARTOON, representation: "CARTOON" },
  ribbon: { mask: REPRESENTATION_MASKS.RIBBON, representation: "RIBBON" },
  surface: { mask: REPRESENTATION_MASKS.SURFACE, representation: "SURFACE" },
  mesh: { mask: REPRESENTATION_MASKS.MESH, representation: "MESH" },
  dots: { mask: REPRESENTATION_MASKS.DOTS, representation: "DOTS" },
  nonbonded: { mask: REPRESENTATION_MASKS.NONBONDED, representation: "NONBONDED" },
  "non-bonded": { mask: REPRESENTATION_MASKS.NONBONDED, representation: "NONBONDED" },
  "nonbonded-spheres": { mask: REPRESENTATION_MASKS.NB_SPHERES, representation: "NB_SPHERES" },
  "ball-and-stick": { mask: REPRESENTATION_PRESETS.BALL_AND_STICK, representation: "BALL_AND_STICK" },
  "ball&stick": { mask: REPRESENTATION_PRESETS.BALL_AND_STICK, representation: "BALL_AND_STICK" },
};

export const parseRepresentationCommand = (input: string): RepresentationCommand | null => {
  const match = input.trim().match(/^(show_as|show|hide)\s+([^,]+?)(?:\s*,\s*|\s+)(.+)$/i);
  if (!match) return null;
  const name = match[2].trim().toLowerCase();
  const definition = representationNames[name];
  if (!definition) throw new SelectionResolutionError(`Unsupported representation in command: ${match[2].trim()}`);
  return { operation: match[1].toUpperCase().replace("_AS", "_AS") as RepresentationCommand["operation"], mask: definition.mask, representation: definition.representation, query: match[3].trim() };
};

