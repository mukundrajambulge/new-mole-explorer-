import type {
  BondOrder,
  CanonicalAtom,
  CanonicalBond,
  CanonicalCoordinateState,
  CanonicalHierarchy,
  CompactCanonicalStructure,
  SecondaryStructureKind,
} from "@molecular/contracts";
import { COMPACT_ATOM_FLAG_ION, COMPACT_ATOM_FLAG_LIGAND, COMPACT_ATOM_FLAG_POLYMER, COMPACT_ATOM_FLAG_WATER } from "@molecular/contracts";

const polymerTypeCode = (value: CanonicalAtom["polymerType"]): 0 | 1 | 2 | 3 => value === "PROTEIN" ? 1 : value === "NUCLEIC_ACID" ? 2 : value === "OTHER_POLYMER" ? 3 : 0;
const secondaryStructureCode = (value: SecondaryStructureKind | null | undefined): 0 | 1 | 2 | 3 => value === "HELIX" ? 1 : value === "SHEET" ? 2 : value === "LOOP" ? 3 : 0;
const bondOrderCode = (value: BondOrder): 0 | 1 | 2 | 3 | 4 => value === "SINGLE" ? 1 : value === "DOUBLE" ? 2 : value === "TRIPLE" ? 3 : value === "AROMATIC" ? 4 : 0;
const recordTypeCode = (value: CanonicalAtom["recordType"]): 0 | 1 => value === "HETATM" ? 1 : 0;

export const compactCanonicalFor = (
  atoms: readonly CanonicalAtom[],
  bonds: readonly CanonicalBond[],
  hierarchy: CanonicalHierarchy,
  coordinateStates: readonly CanonicalCoordinateState[],
  stateOrder: readonly string[],
  chemistryRoles?: { donorAtomIds: readonly string[]; acceptorAtomIds: readonly string[] },
): CompactCanonicalStructure => {
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  const indexFor = (value: string | null | undefined): number => {
    if (!value) return -1;
    const existing = stringIndex.get(value);
    if (existing !== undefined) return existing;
    const index = strings.length;
    strings.push(value);
    stringIndex.set(value, index);
    return index;
  };
  const atomIndex = new Map<string, number>();
  atoms.forEach((atom, index) => atomIndex.set(atom.stableId, index));
  const flags = atoms.map((atom) => (atom.isPolymer ? COMPACT_ATOM_FLAG_POLYMER : 0) | (atom.isLigand ? COMPACT_ATOM_FLAG_LIGAND : 0) | (atom.isWater ? COMPACT_ATOM_FLAG_WATER : 0) | (atom.isIon ? COMPACT_ATOM_FLAG_ION : 0));
  const compact: CompactCanonicalStructure = {
    schemaVersion: "compact-canonical-v1",
    atomCount: atoms.length,
    strings,
    atomStableIds: atoms.map((atom) => atom.stableId),
    serials: atoms.map((atom) => atom.serial),
    atomNameIndices: atoms.map((atom) => indexFor(atom.atomName)),
    elementIndices: atoms.map((atom) => indexFor(atom.element)),
    residueNameIndices: atoms.map((atom) => indexFor(atom.residueName)),
    residueNumbers: atoms.map((atom) => atom.residueNumber),
    insertionCodeIndices: atoms.map((atom) => indexFor(atom.insertionCode)),
    chainIndices: atoms.map((atom) => indexFor(atom.chain)),
    segmentIdIndices: atoms.map((atom) => indexFor(atom.segmentId)),
    x: atoms.map((atom) => atom.x),
    y: atoms.map((atom) => atom.y),
    z: atoms.map((atom) => atom.z),
    recordTypes: atoms.map((atom) => recordTypeCode(atom.recordType)),
    flags,
    polymerTypes: atoms.map((atom) => polymerTypeCode(atom.polymerType)),
    formalCharges: atoms.map((atom) => atom.formalCharge ?? null),
    bFactors: atoms.map((atom) => atom.bFactor ?? null),
    occupancies: atoms.map((atom) => atom.occupancy ?? null),
    altLocIndices: atoms.map((atom) => indexFor(atom.altLoc)),
    secondaryStructures: atoms.map((atom) => secondaryStructureCode(atom.secondaryStructure)),
    bonds: {
      ids: [],
      atom1Ordinals: [],
      atom2Ordinals: [],
      orders: [],
      sources: [],
    },
    hierarchy: {
      chainIds: [...hierarchy.chainIds],
      chainNameIndices: [],
      chainResidueOffsets: [],
      chainResidueCounts: [],
      residueIds: [],
      residueNameIndices: [],
      residueNumbers: [],
      residueInsertionCodeIndices: [],
      residueChainOrdinals: [],
      residueAtomOffsets: [0],
      residueAtomOrdinals: [],
      residuePolymerFlags: [],
      residueSecondaryStructures: [],
    },
    coordinateStates: [],
    stateOrder: [...stateOrder],
  };

  for (const bond of bonds) {
    const atom1 = atomIndex.get(bond.atom1);
    const atom2 = atomIndex.get(bond.atom2);
    if (atom1 === undefined || atom2 === undefined) continue;
    compact.bonds.ids.push(bond.id);
    compact.bonds.atom1Ordinals.push(atom1);
    compact.bonds.atom2Ordinals.push(atom2);
    compact.bonds.orders.push(bondOrderCode(bond.order));
    compact.bonds.sources.push(indexFor(bond.source));
  }

  hierarchy.chainIds.forEach((chainId, chainOrdinal) => {
    const chain = hierarchy.chains[chainId]!;
    compact.hierarchy.chainNameIndices.push(indexFor(chain.name));
    compact.hierarchy.chainResidueOffsets.push(compact.hierarchy.residueIds.length);
    compact.hierarchy.chainResidueCounts.push(chain.residueIds.length);
    for (const residueId of chain.residueIds) {
      const residue = hierarchy.residues[residueId]!;
      compact.hierarchy.residueIds.push(residue.id);
      compact.hierarchy.residueNameIndices.push(indexFor(residue.name));
      compact.hierarchy.residueNumbers.push(residue.number);
      compact.hierarchy.residueInsertionCodeIndices.push(indexFor(residue.insertionCode));
      compact.hierarchy.residueChainOrdinals.push(chainOrdinal);
      compact.hierarchy.residuePolymerFlags.push(residue.isPolymer ? 1 : 0);
      compact.hierarchy.residueSecondaryStructures.push(secondaryStructureCode(residue.secondaryStructure));
      for (const atomId of residue.atomIds) {
        const atomOrdinal = atomIndex.get(atomId);
        if (atomOrdinal !== undefined) compact.hierarchy.residueAtomOrdinals.push(atomOrdinal);
      }
      compact.hierarchy.residueAtomOffsets.push(compact.hierarchy.residueAtomOrdinals.length);
    }
  });

  for (const state of coordinateStates) {
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    atoms.forEach((atom) => {
      const coordinate = state.coordinates[atom.stableId] ?? atom;
      x.push(coordinate.x);
      y.push(coordinate.y);
      z.push(coordinate.z);
    });
    compact.coordinateStates.push({ id: state.id, ordinal: state.ordinal, ...(state.sourceModelNumber !== undefined ? { sourceModelNumber: state.sourceModelNumber } : {}), x, y, z, coordinateHash: state.coordinateHash });
  }

  if (chemistryRoles) {
    compact.chemistry = {
      donorAtomOrdinals: chemistryRoles.donorAtomIds.map((atomId) => atomIndex.get(atomId)).filter((index): index is number => index !== undefined),
      acceptorAtomOrdinals: chemistryRoles.acceptorAtomIds.map((atomId) => atomIndex.get(atomId)).filter((index): index is number => index !== undefined),
    };
  }
  return compact;
};
