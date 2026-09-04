import type { CanonicalAtom, CanonicalBond } from "@molecular/contracts";

/**
 * This is the deliberately bounded donor/acceptor profile used by the
 * pinned PyMOL compatibility source.  It is a canonical backend calculation:
 * the renderer is never consulted and the resulting role sets are revision
 * bound by the caller.
 *
 * Source profile:
 * schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69
 * layer2/ObjectMolecule.cpp:
 * ObjectMoleculeGetAtomGeometry,
 * ObjectMoleculeInferChemFromNeighGeom,
 * ObjectMoleculeInferChemFromBonds, and
 * ObjectMoleculeInferHBondFromChem.
 */

const GEOMETRY_NONE = 0;
const GEOMETRY_SINGLE = 1;
const GEOMETRY_PLANAR = 2;
const GEOMETRY_LINEAR = 3;
const GEOMETRY_TETRAHEDRAL = 4;

const PROTONS: Readonly<Record<string, number>> = {
  H: 1, D: 1, Q: 1, C: 6, N: 7, O: 8, F: 9, NA: 11, MG: 12, P: 15, S: 16,
  CL: 17, K: 19, CA: 20, FE: 26, CU: 29, ZN: 30, BR: 35, SR: 38, I: 53,
  IOD: 53, BA: 56, HG: 80,
};

const METAL_DONORS = new Set(["FE", "CA", "CU", "K", "NA", "MG", "ZN", "HG", "SR", "BA"]);

type WorkingAtom = {
  atom: CanonicalAtom;
  protons: number;
  formalCharge: number;
  geometry: number;
  valence: number;
  chemFlag: boolean;
};

type Neighbor = { index: number; order: number };

export type CanonicalChemistryRoleResult = {
  donorAtomIds: string[];
  acceptorAtomIds: string[];
  provenance: string;
};

const orderValue = (bond: CanonicalBond): number | undefined => {
  switch (bond.order) {
    case "SINGLE": return 1;
    case "DOUBLE": return 2;
    case "TRIPLE": return 3;
    // PyMOL's aromatic bond order is 4 in its chemistry inference code.
    case "AROMATIC": return 4;
    case "UNKNOWN": return undefined;
  }
};

const vector = (from: CanonicalAtom, to: CanonicalAtom): [number, number, number] => [to.x - from.x, to.y - from.y, to.z - from.z];

const dot = (left: [number, number, number], right: [number, number, number]): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const cross = (left: [number, number, number], right: [number, number, number]): [number, number, number] => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
];

const normalized = (value: [number, number, number]): [number, number, number] | undefined => {
  const length = Math.hypot(value[0], value[1], value[2]);
  return length > 0 ? [value[0] / length, value[1] / length, value[2] / length] : undefined;
};

const geometryFromCoordinates = (atoms: readonly CanonicalAtom[], atomIndex: number, neighbors: readonly Neighbor[]): number => {
  const atom = atoms[atomIndex]!;
  if (neighbors.length === 4) return GEOMETRY_TETRAHEDRAL;
  if (neighbors.length === 3) {
    const directions = neighbors.map(({ index }) => vector(atom, atoms[index]!));
    const planes = [cross(directions[0]!, directions[1]!), cross(directions[1]!, directions[2]!), cross(directions[2]!, directions[0]!)].map(normalized);
    if (planes.some((plane) => !plane)) return -1;
    const average = (dot(planes[0]!, planes[1]!) + dot(planes[1]!, planes[2]!) + dot(planes[2]!, planes[0]!)) / 3;
    return average > 0.75 ? GEOMETRY_PLANAR : GEOMETRY_TETRAHEDRAL;
  }
  if (neighbors.length === 2) {
    const first = normalized(vector(atom, atoms[neighbors[0]!.index]!));
    const second = normalized(vector(atom, atoms[neighbors[1]!.index]!));
    return first && second && dot(first, second) < -0.75 ? GEOMETRY_LINEAR : -1;
  }
  return -1;
};

const expectedValence = (protons: number, formalCharge: number): number => {
  const element = Object.entries(PROTONS).find(([, value]) => value === protons)?.[0];
  if (!element) return -1;
  if (formalCharge === 0) {
    return ({ H: 1, C: 4, N: 3, O: 2, F: 1, CL: 1, BR: 1, I: 1, NA: 1, CA: 1, K: 1, MG: 2, ZN: -1, S: -2, P: -3 } as Record<string, number>)[element] ?? -1;
  }
  if (formalCharge === 1) {
    return ({ N: 4, O: 3, NA: 0, CA: 0, K: 0, MG: 1, ZN: -1, S: -2, P: -3 } as Record<string, number>)[element] ?? -1;
  }
  if (formalCharge === -1) {
    return ({ N: 2, O: 1, C: 3, ZN: -1, S: -2, P: -3 } as Record<string, number>)[element] ?? -1;
  }
  if (formalCharge === 2) {
    return ({ MG: 0, ZN: -1, S: -2, P: -3 } as Record<string, number>)[element] ?? -1;
  }
  return -1;
};

const elementFor = (working: WorkingAtom): string => Object.keys(PROTONS).find((key) => PROTONS[key] === working.protons) ?? "";

const inferChemFromNeighborGeometry = (atoms: readonly CanonicalAtom[], neighbors: readonly (readonly Neighbor[])[], working: WorkingAtom[]): void => {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [index, current] of working.entries()) {
      if (current.chemFlag) continue;
      const geometry = geometryFromCoordinates(atoms, index, neighbors[index]!);
      const atom = current.atom;
      const element = elementFor(current);
      if (element === "K") {
        current.chemFlag = true;
        current.geometry = GEOMETRY_NONE;
        current.valence = 0;
      } else if (["H", "F", "I", "BR"].includes(element)) {
        current.chemFlag = true;
        current.geometry = GEOMETRY_SINGLE;
        current.valence = 1;
      } else if (element === "O") {
        if (neighbors[index]!.length !== 1) {
          current.chemFlag = true;
          current.geometry = GEOMETRY_TETRAHEDRAL;
          current.valence = 2;
        } else {
          const other = working[neighbors[index]![0]!.index]!;
          if (other.chemFlag && (other.geometry === GEOMETRY_TETRAHEDRAL || other.geometry === GEOMETRY_LINEAR)) {
            current.chemFlag = true;
            current.geometry = GEOMETRY_TETRAHEDRAL;
            current.valence = 2;
          }
        }
      } else if (element === "C") {
        if (geometry >= 0) {
          current.chemFlag = true;
          current.geometry = geometry;
          current.valence = ({ [GEOMETRY_TETRAHEDRAL]: 4, [GEOMETRY_PLANAR]: 3, [GEOMETRY_LINEAR]: 2 } as Record<number, number>)[geometry] ?? 0;
        } else if (neighbors[index]!.length === 1) {
          const other = working[neighbors[index]![0]!.index]!;
          if (other.chemFlag && other.geometry === GEOMETRY_TETRAHEDRAL) {
            current.chemFlag = true;
            current.geometry = GEOMETRY_TETRAHEDRAL;
            current.valence = 4;
          }
        }
      } else if (element === "N") {
        if (geometry === GEOMETRY_PLANAR || geometry === GEOMETRY_TETRAHEDRAL) {
          current.chemFlag = true;
          current.geometry = geometry;
          current.valence = geometry === GEOMETRY_PLANAR ? 3 : 4;
        }
      } else if (element === "S") {
        const count = neighbors[index]!.length;
        if (count === 4 || count === 3 || count === 2) {
          current.chemFlag = true;
          current.geometry = GEOMETRY_TETRAHEDRAL;
          current.valence = count;
        }
      } else if (element === "CL") {
        current.chemFlag = true;
        current.geometry = current.formalCharge === 0 ? GEOMETRY_SINGLE : GEOMETRY_NONE;
        current.valence = current.formalCharge === 0 ? 1 : 0;
      }
      if (current.chemFlag) changed = true;
      void atom;
    }
  }
};

const inferChemFromBonds = (working: WorkingAtom[], neighbors: readonly (readonly Neighbor[])[]): void => {
  for (const current of working) {
    if (!current.chemFlag) {
      current.geometry = GEOMETRY_NONE;
      current.valence = 0;
    }
  }
  for (const [index, current] of working.entries()) {
    for (const neighbor of neighbors[index]!) {
      if (!current.chemFlag) {
        if (neighbor.order > current.geometry) current.geometry = neighbor.order;
        current.valence += neighbor.order;
      }
      if (neighbor.order === 3) {
        current.geometry = GEOMETRY_LINEAR;
        current.valence = current.protons === 6 ? 2 : 1;
        current.chemFlag = true;
      } else if (neighbor.order === 4) {
        current.geometry = GEOMETRY_PLANAR;
        current.valence = current.protons === 8 ? 1 : current.protons === 7 ? (current.formalCharge === 1 ? 3 : 2) : current.protons === 6 ? 3 : current.protons === 16 ? 2 : 1;
        current.chemFlag = true;
      }
    }
  }
  for (const [index, current] of working.entries()) {
    if (current.chemFlag) continue;
    let expected = expectedValence(current.protons, current.formalCharge);
    const neighborCount = neighbors[index]!.length;
    if (expected < 0) expected = -expected;
    if (current.geometry === GEOMETRY_LINEAR) {
      current.valence = current.protons === 6 ? 2 : 1;
      current.chemFlag = true;
    } else if (current.valence === expected) {
      current.chemFlag = true;
      current.valence = neighborCount;
      current.geometry = current.geometry === GEOMETRY_NONE ? GEOMETRY_NONE : current.geometry === GEOMETRY_PLANAR ? GEOMETRY_PLANAR : current.geometry === GEOMETRY_LINEAR ? GEOMETRY_LINEAR : expected === 1 ? GEOMETRY_SINGLE : GEOMETRY_TETRAHEDRAL;
    } else if (current.valence < expected) {
      current.chemFlag = true;
      current.valence = neighborCount + expected - current.valence;
      current.geometry = current.geometry === GEOMETRY_PLANAR ? GEOMETRY_PLANAR : current.geometry === GEOMETRY_LINEAR ? GEOMETRY_LINEAR : expected === 1 ? GEOMETRY_SINGLE : GEOMETRY_TETRAHEDRAL;
    } else if (current.valence > expected) {
      current.chemFlag = true;
      current.valence = neighborCount;
      current.geometry = current.geometry === GEOMETRY_PLANAR ? GEOMETRY_PLANAR : current.geometry === GEOMETRY_LINEAR ? GEOMETRY_LINEAR : expected === 1 ? GEOMETRY_SINGLE : GEOMETRY_TETRAHEDRAL;
      if (neighborCount > 3) current.geometry = GEOMETRY_TETRAHEDRAL;
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [index, current] of working.entries()) {
      if (!current.chemFlag || current.protons !== 7 || current.formalCharge >= 1 || current.geometry !== GEOMETRY_TETRAHEDRAL) continue;
      if (neighbors[index]!.some(({ index: neighborIndex }) => working[neighborIndex]!.chemFlag && [6, 7].includes(working[neighborIndex]!.protons) && working[neighborIndex]!.geometry === GEOMETRY_PLANAR)) {
        current.geometry = GEOMETRY_PLANAR;
        if (current.formalCharge === 0) current.valence = 3;
        changed = true;
      }
    }
  }
  changed = true;
  while (changed) {
    changed = false;
    for (const [index, current] of working.entries()) {
      if (!current.chemFlag || current.protons !== 8 || current.formalCharge !== -1 || ![GEOMETRY_TETRAHEDRAL, GEOMETRY_SINGLE].includes(current.geometry)) continue;
      if (neighbors[index]!.some(({ index: neighborIndex }) => working[neighborIndex]!.chemFlag && [6, 7].includes(working[neighborIndex]!.protons) && working[neighborIndex]!.geometry === GEOMETRY_PLANAR)) {
        current.geometry = GEOMETRY_PLANAR;
        changed = true;
      }
    }
  }
};

const inferHydrogenBondRoles = (working: readonly WorkingAtom[], neighbors: readonly (readonly Neighbor[])[]): { donorAtomIds: string[]; acceptorAtomIds: string[] } => {
  const donors: string[] = [];
  const acceptors: string[] = [];
  for (const [index, current] of working.entries()) {
    const element = elementFor(current);
    const currentNeighbors = neighbors[index]!;
    let hasHydrogen = currentNeighbors.length < current.valence;
    if (!hasHydrogen && (element === "N" || element === "O")) hasHydrogen = currentNeighbors.some(({ index: neighborIndex }) => working[neighborIndex]!.protons === 1);
    let donor = false;
    let acceptor = false;
    if (METAL_DONORS.has(element)) {
      donor = true;
    } else if (element === "N") {
      if (hasHydrogen) {
        donor = true;
      } else {
        let delocalized = false;
        let hasDoubleBond = false;
        let neighborHasDoubleBond = false;
        for (const neighbor of currentNeighbors) {
          if (neighbor.order > 1) delocalized = true;
          if (neighbor.order === 2) hasDoubleBond = true;
          for (const second of neighbors[neighbor.index]!) {
            if (second.index !== index && second.order === 2) neighborHasDoubleBond = true;
          }
        }
        if (current.formalCharge <= 0 && delocalized && currentNeighbors.length < 3) acceptor = true;
        if (delocalized && neighborHasDoubleBond && !hasDoubleBond && current.geometry === GEOMETRY_PLANAR && currentNeighbors.length === 2 && current.formalCharge >= 0) donor = true;
        if (current.geometry !== GEOMETRY_PLANAR && currentNeighbors.length === 3 && current.formalCharge >= 0 && !delocalized) donor = true;
      }
    } else if (element === "O") {
      if (current.formalCharge <= 0) acceptor = true;
      if (hasHydrogen) {
        donor = true;
      } else {
        const hasDoubleBond = currentNeighbors.some(({ order }) => order === 2);
        const neighborHasAromaticBond = currentNeighbors.some(({ index: neighborIndex }) => neighbors[neighborIndex]!.some((second) => second.index !== index && second.order === 4));
        if (hasDoubleBond && neighborHasAromaticBond && current.formalCharge >= 0) donor = true;
      }
    }
    if (donor) donors.push(current.atom.stableId);
    if (acceptor) acceptors.push(current.atom.stableId);
  }
  return { donorAtomIds: donors, acceptorAtomIds: acceptors };
};

/**
 * Return a complete role dataset only when the admitted canonical input is
 * sufficient for this bounded profile.  Unsupported elements, explicit
 * unknown formal charges, unknown bond orders, and disconnected non-solvent
 * atoms fail closed instead of receiving guessed roles.
 */
export const inferCanonicalChemistryRoles = (atoms: readonly CanonicalAtom[], bonds: readonly CanonicalBond[]): CanonicalChemistryRoleResult | undefined => {
  if (atoms.length === 0) return undefined;
  const indexById = new Map(atoms.map((atom, index) => [atom.stableId, index]));
  const neighbors: Neighbor[][] = atoms.map(() => []);
  for (const bond of bonds) {
    const first = indexById.get(bond.atom1);
    const second = indexById.get(bond.atom2);
    const order = orderValue(bond);
    if (first === undefined || second === undefined || first === second || order === undefined) return undefined;
    neighbors[first]!.push({ index: second, order });
    neighbors[second]!.push({ index: first, order });
  }
  const working: WorkingAtom[] = atoms.map((atom) => {
    const protons = PROTONS[atom.element.toUpperCase()];
    return { atom, protons: protons ?? -1, formalCharge: atom.formalCharge ?? 0, geometry: -1, valence: 0, chemFlag: false };
  });
  if (working.some((current) => current.protons < 0 || current.atom.formalCharge === null)) return undefined;
  if (working.some((current, index) => !current.atom.isWater && !current.atom.isIon && neighbors[index]!.length === 0)) return undefined;
  inferChemFromNeighborGeometry(atoms, neighbors, working);
  inferChemFromBonds(working, neighbors);
  if (working.some((current) => !current.chemFlag)) return undefined;
  const roles = inferHydrogenBondRoles(working, neighbors);
  return { ...roles, provenance: "Pinned PyMOL Open Source chemistry-inference profile 5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69; canonical bond graph and first coordinate state; absent formal charge follows the profile's zero default; renderer-independent." };
};
