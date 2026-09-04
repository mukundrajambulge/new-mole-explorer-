import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";
import { vdwRadiusForElement } from "../rendering/surfaceGenerator";

export type StructuralAnalysisKind = "H_BONDS" | "CONTACTS" | "CLASH";
export type AnalysisStatus = "READY" | "VALID_EMPTY";

export type StructuralAnalysisItem = {
  id: string;
  atom1Id: string;
  atom2Id: string;
  distanceAngstrom: number;
  overlapAngstrom?: number;
  angleDeg?: number | null;
};

export type StructuralAnalysisResult = {
  kind: StructuralAnalysisKind;
  status: AnalysisStatus;
  profileId: string;
  molecularRevision: string;
  coordinateContext: string;
  items: StructuralAnalysisItem[];
  diagnostic: string;
};

export type AnalysisOverlay = StructuralAnalysisItem & { kind: StructuralAnalysisKind };

const COORDINATE_CONTEXT = (structure: CanonicalMolecularStructure) => `${structure.id}:coordinates:active`;
const element = (atom: CanonicalAtom) => atom.element.trim().toUpperCase();
const isHydrogen = (atom: CanonicalAtom) => element(atom) === "H";
const isHeavyAtom = (atom: CanonicalAtom) => !isHydrogen(atom);
const atomKey = (left: string, right: string) => left < right ? `${left}|${right}` : `${right}|${left}`;
const distance = (left: CanonicalAtom, right: CanonicalAtom) => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
const sameResidue = (left: CanonicalAtom, right: CanonicalAtom) => left.chain === right.chain && left.residueNumber === right.residueNumber && left.insertionCode === right.insertionCode;

const bondedPairKeys = (structure: CanonicalMolecularStructure) => new Set(structure.bonds.map((bond) => atomKey(bond.atom1, bond.atom2)));

/** Uniform-grid neighbor enumeration keeps the 4DJW path bounded without changing canonical coordinates. */
const nearbyPairs = (structure: CanonicalMolecularStructure, cutoff: number): Array<[CanonicalAtom, CanonicalAtom, number]> => {
  const atoms = structure.atoms.filter(isHeavyAtom);
  const cellSize = cutoff;
  const grid = new Map<string, CanonicalAtom[]>();
  const keyFor = (x: number, y: number, z: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
  for (const atom of atoms) grid.set(keyFor(atom.x, atom.y, atom.z), [...(grid.get(keyFor(atom.x, atom.y, atom.z)) ?? []), atom]);
  const result: Array<[CanonicalAtom, CanonicalAtom, number]> = [];
  const seen = new Set<string>();
  for (const atom of atoms) {
    const cx = Math.floor(atom.x / cellSize); const cy = Math.floor(atom.y / cellSize); const cz = Math.floor(atom.z / cellSize);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dz = -1; dz <= 1; dz += 1) {
      for (const other of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        if (atom.stableId === other.stableId) continue;
        const pairKey = atomKey(atom.stableId, other.stableId);
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const d = distance(atom, other);
        if (d <= cutoff) result.push(atom.stableId < other.stableId ? [atom, other, d] : [other, atom, d]);
      }
    }
  }
  return result;
};

const donor = (atom: CanonicalAtom) => {
  const e = element(atom);
  return (e === "N" || e === "O" || e === "S") && (atom.formalCharge ?? 0) <= 0 && (e !== "O" || /^(O|OG|OG1|OH|OW|OT|SG)/i.test(atom.atomName.trim()));
};

const acceptor = (atom: CanonicalAtom) => {
  const e = element(atom);
  if ((atom.formalCharge ?? 0) > 0) return false;
  if (e === "O" || e === "S") return true;
  return e === "N" && !/^N$/i.test(atom.atomName.trim());
};

const resultFor = (structure: CanonicalMolecularStructure, kind: StructuralAnalysisKind, profileId: string, items: StructuralAnalysisItem[], diagnostic: string): StructuralAnalysisResult => ({ kind, status: items.length ? "READY" : "VALID_EMPTY", profileId, molecularRevision: structure.scientificHash, coordinateContext: COORDINATE_CONTEXT(structure), items, diagnostic });

export const analyzeStructure = (structure: CanonicalMolecularStructure, kind: StructuralAnalysisKind): StructuralAnalysisResult => {
  const bonded = bondedPairKeys(structure);
  if (kind === "H_BONDS") {
    const items = nearbyPairs(structure, 3.5).filter(([left, right]) => !bonded.has(atomKey(left.stableId, right.stableId)) && ((donor(left) && acceptor(right)) || (donor(right) && acceptor(left))) && !sameResidue(left, right)).slice(0, 2000).map(([left, right, d]) => ({ id: `hbond:${atomKey(left.stableId, right.stableId)}`, atom1Id: left.stableId, atom2Id: right.stableId, distanceAngstrom: d, angleDeg: null }));
    return resultFor(structure, kind, "analysis.h-bond.distance-3.5A.inferred-donor-acceptor.v1", items, items.length ? `${items.length} inferred donor–acceptor pairs · explicit hydrogen angle unavailable in this structure.` : "No donor–acceptor pairs met the 3.5 Å distance profile.");
  }
  if (kind === "CONTACTS") {
    const items = nearbyPairs(structure, 4.0).filter(([left, right]) => !bonded.has(atomKey(left.stableId, right.stableId))).slice(0, 4000).map(([left, right, d]) => ({ id: `contact:${atomKey(left.stableId, right.stableId)}`, atom1Id: left.stableId, atom2Id: right.stableId, distanceAngstrom: d }));
    return resultFor(structure, kind, "analysis.contact.heavy-atom-distance-4.0A.nonbonded.v1", items, items.length ? `${items.length} non-bonded heavy-atom contacts within 4.0 Å.` : "No non-bonded heavy-atom contacts met the 4.0 Å profile.");
  }
  const items = nearbyPairs(structure, 4.0).filter(([left, right, d]) => !bonded.has(atomKey(left.stableId, right.stableId)) && vdwRadiusForElement(left.element) + vdwRadiusForElement(right.element) - d > 0.4).slice(0, 2000).map(([left, right, d]) => ({ id: `clash:${atomKey(left.stableId, right.stableId)}`, atom1Id: left.stableId, atom2Id: right.stableId, distanceAngstrom: d, overlapAngstrom: vdwRadiusForElement(left.element) + vdwRadiusForElement(right.element) - d }));
  return resultFor(structure, kind, "analysis.clash.heavy-atom-vdw-overlap-0.4A.nonbonded.v1", items, items.length ? `${items.length} non-bonded pairs exceed 0.4 Å VDW overlap.` : "No non-bonded heavy-atom pairs exceed 0.4 Å VDW overlap.");
};

export const overlaysForAnalysis = (results: readonly StructuralAnalysisResult[]): AnalysisOverlay[] => results.flatMap((result) => result.items.map((item) => ({ ...item, kind: result.kind })));
