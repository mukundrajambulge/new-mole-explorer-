import type {
  BondOrder,
  CanonicalAtom,
  CanonicalBond,
  CanonicalChain,
  CanonicalCoordinateState,
  CanonicalHierarchy,
  CanonicalMolecularStructure,
  CanonicalPolymerType,
  CanonicalResidue,
  CompactCanonicalStructure,
  SecondaryStructureKind,
  StructureLoadResult,
} from "@molecular/contracts";
import type { AtomSpec } from "3dmol";
import { COMPACT_ATOM_FLAG_ION, COMPACT_ATOM_FLAG_LIGAND, COMPACT_ATOM_FLAG_POLYMER, COMPACT_ATOM_FLAG_WATER } from "@molecular/contracts";

const stringFor = (compact: CompactCanonicalStructure, index: number): string | undefined => index >= 0 ? compact.strings[index] : undefined;
const polymerTypeFor = (code: number): CanonicalPolymerType | undefined => code === 1 ? "PROTEIN" : code === 2 ? "NUCLEIC_ACID" : code === 3 ? "OTHER_POLYMER" : undefined;
const secondaryStructureFor = (code: number): SecondaryStructureKind | undefined => code === 1 ? "HELIX" : code === 2 ? "SHEET" : code === 3 ? "LOOP" : undefined;
const bondOrderFor = (code: number): BondOrder => code === 1 ? "SINGLE" : code === 2 ? "DOUBLE" : code === 3 ? "TRIPLE" : code === 4 ? "AROMATIC" : "UNKNOWN";
const bondOrderNumberFor = (code: number): number => code === 2 ? 2 : code === 3 ? 3 : code === 4 ? 4 : 1;

const atomForCompact = (structure: CanonicalMolecularStructure, index: number): CanonicalAtom => {
  const compact = structure.compact!;
  const insertionCode = stringFor(compact, compact.insertionCodeIndices[index] ?? -1);
  const segmentId = stringFor(compact, compact.segmentIdIndices[index] ?? -1);
  const polymerType = polymerTypeFor(compact.polymerTypes[index] ?? 0);
  const formalCharge = compact.formalCharges[index] ?? undefined;
  const bFactor = compact.bFactors[index] ?? undefined;
  const occupancy = compact.occupancies[index] ?? undefined;
  const altLoc = stringFor(compact, compact.altLocIndices[index] ?? -1);
  const secondaryStructure = secondaryStructureFor(compact.secondaryStructures[index] ?? 0);
  const flags = compact.flags[index] ?? 0;
  return {
    stableId: compact.atomStableIds[index]!,
    serial: compact.serials[index]!,
    atomName: stringFor(compact, compact.atomNameIndices[index]!) ?? "X",
    element: stringFor(compact, compact.elementIndices[index]!) ?? "X",
    residueName: stringFor(compact, compact.residueNameIndices[index]!) ?? "UNK",
    residueNumber: compact.residueNumbers[index]!,
    ...(insertionCode ? { insertionCode } : {}),
    chain: stringFor(compact, compact.chainIndices[index]!) ?? "_",
    ...(segmentId ? { segmentId } : {}),
    x: compact.x[index]!,
    y: compact.y[index]!,
    z: compact.z[index]!,
    recordType: compact.recordTypes[index] === 1 ? "HETATM" : "ATOM",
    isPolymer: (flags & COMPACT_ATOM_FLAG_POLYMER) !== 0,
    ...(polymerType ? { polymerType } : {}),
    isLigand: (flags & COMPACT_ATOM_FLAG_LIGAND) !== 0,
    isWater: (flags & COMPACT_ATOM_FLAG_WATER) !== 0,
    isIon: (flags & COMPACT_ATOM_FLAG_ION) !== 0,
    ...(formalCharge !== undefined ? { formalCharge } : {}),
    ...(bFactor !== undefined ? { bFactor } : {}),
    ...(occupancy !== undefined ? { occupancy } : {}),
    ...(altLoc ? { altLoc } : {}),
    ...(secondaryStructure ? { secondaryStructure } : {}),
  } satisfies CanonicalAtom;
};

/**
 * Keep the legacy array-shaped contract while creating atom records only when
 * an older consumer actually visits an ordinal.  This is important for large
 * compact payloads: selection and rendering can scan the canonical columns
 * without retaining 300k+ duplicate object records.
 */
const atomsForCompact = (structure: CanonicalMolecularStructure): CanonicalAtom[] => {
  const compact = structure.compact!;
  const target = new Array<CanonicalAtom>(compact.atomCount);
  return new Proxy(target, {
    get(array, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) {
        const index = Number(property);
        if (index >= 0 && index < compact.atomCount) return atomForCompact(structure, index);
      }
      return Reflect.get(array, property, receiver);
    },
    has(array, property) {
      if (typeof property === "string" && /^\d+$/.test(property)) {
        const index = Number(property);
        if (index >= 0 && index < compact.atomCount) return true;
      }
      return Reflect.has(array, property);
    },
  });
};

const bondsForCompact = (structure: CanonicalMolecularStructure): CanonicalBond[] => {
  const compact = structure.compact!;
  return compact.bonds.atom1Ordinals.map((atom1Ordinal, index) => ({
    id: compact.bonds.ids[index] ?? `${structure.id}:bond:${index + 1}`,
    atom1: compact.atomStableIds[atom1Ordinal]!,
    atom2: compact.atomStableIds[compact.bonds.atom2Ordinals[index]!]!,
    order: bondOrderFor(compact.bonds.orders[index] ?? 0),
    source: stringFor(compact, compact.bonds.sources[index] ?? -1) as CanonicalBond["source"],
  }));
};

const hierarchyForCompact = (structure: CanonicalMolecularStructure): CanonicalHierarchy => {
  const compact = structure.compact!;
  const chains: Record<string, CanonicalChain> = {};
  const residues: Record<string, CanonicalResidue> = {};
  compact.hierarchy.chainIds.forEach((chainId, chainOrdinal) => {
    const residueOffset = compact.hierarchy.chainResidueOffsets[chainOrdinal] ?? 0;
    const residueCount = compact.hierarchy.chainResidueCounts[chainOrdinal] ?? 0;
    const residueIds = compact.hierarchy.residueIds.slice(residueOffset, residueOffset + residueCount);
    chains[chainId] = { id: chainId, name: stringFor(compact, compact.hierarchy.chainNameIndices[chainOrdinal] ?? -1) ?? chainId, residueIds };
  });
  compact.hierarchy.residueIds.forEach((residueId, residueOrdinal) => {
    const chainOrdinal = compact.hierarchy.residueChainOrdinals[residueOrdinal] ?? 0;
    const chainId = compact.hierarchy.chainIds[chainOrdinal]!;
    const atomStart = compact.hierarchy.residueAtomOffsets[residueOrdinal] ?? 0;
    const atomEnd = compact.hierarchy.residueAtomOffsets[residueOrdinal + 1] ?? atomStart;
    const insertionCode = stringFor(compact, compact.hierarchy.residueInsertionCodeIndices[residueOrdinal] ?? -1);
    const secondaryStructure = secondaryStructureFor(compact.hierarchy.residueSecondaryStructures[residueOrdinal] ?? 0);
    residues[residueId] = {
      id: residueId,
      name: stringFor(compact, compact.hierarchy.residueNameIndices[residueOrdinal] ?? -1) ?? "UNK",
      number: compact.hierarchy.residueNumbers[residueOrdinal]!,
      ...(insertionCode ? { insertionCode } : {}),
      chainId,
      atomIds: compact.hierarchy.residueAtomOrdinals.slice(atomStart, atomEnd).map((atomOrdinal) => compact.atomStableIds[atomOrdinal]!),
      isPolymer: compact.hierarchy.residuePolymerFlags[residueOrdinal] === 1,
      ...(secondaryStructure ? { secondaryStructure } : {}),
    };
  });
  return { chainIds: [...compact.hierarchy.chainIds], chains, residues };
};

const coordinateStatesForCompact = (structure: CanonicalMolecularStructure): CanonicalCoordinateState[] => {
  const compact = structure.compact!;
  return compact.coordinateStates.map((state) => {
    const result = {
      id: state.id,
      ordinal: state.ordinal,
      ...(state.sourceModelNumber !== undefined ? { sourceModelNumber: state.sourceModelNumber } : {}),
      coordinates: {} as Record<string, { x: number; y: number; z: number }>,
      coordinateHash: state.coordinateHash,
    } satisfies CanonicalCoordinateState;
    Object.defineProperty(result, "coordinates", {
      configurable: true,
      enumerable: false,
      get: () => {
        const coordinates = Object.fromEntries(compact.atomStableIds.map((stableId, index) => [stableId, { x: state.x[index]!, y: state.y[index]!, z: state.z[index]! }]));
        Object.defineProperty(result, "coordinates", { configurable: false, enumerable: false, value: coordinates, writable: false });
        return coordinates;
      },
    });
    return result;
  });
};

export const isCompactStructure = (structure: CanonicalMolecularStructure | null | undefined): boolean => structure?.compact?.schemaVersion === "compact-canonical-v1";

/** Install lazy legacy views without making JSON.stringify walk the large graph. */
export const hydrateCompactLoadResult = (loadResult: StructureLoadResult): StructureLoadResult => {
  const structure = loadResult.structure;
  if (!isCompactStructure(structure)) return loadResult;
  const values = new Map<string, unknown>();
  const lazy = <K extends "atoms" | "bonds" | "hierarchy" | "coordinateStates" | "stateOrder", V>(key: K, build: () => V): void => {
    Object.defineProperty(structure, key, {
      configurable: true,
      enumerable: false,
      get: () => {
        if (!values.has(key)) values.set(key, build());
        return values.get(key) as V;
      },
    });
  };
  lazy("atoms", () => atomsForCompact(structure));
  lazy("bonds", () => bondsForCompact(structure));
  lazy("hierarchy", () => hierarchyForCompact(structure));
  lazy("coordinateStates", () => coordinateStatesForCompact(structure));
  lazy("stateOrder", () => [...structure.compact!.stateOrder]);
  return loadResult;
};

export type CompactAtomSpecContext = {
  atomCount: number;
  specsForRange: (start: number, end: number) => AtomSpec[];
};

export const compactAtomSpecContext = (structure: CanonicalMolecularStructure, objectId?: string): CompactAtomSpecContext | null => {
  if (!isCompactStructure(structure)) return null;
  const compact = structure.compact!;
  const neighborsByOrdinal = Array.from({ length: compact.atomCount }, () => [] as number[]);
  const ordersByOrdinal = Array.from({ length: compact.atomCount }, () => [] as number[]);
  compact.bonds.atom1Ordinals.forEach((atom1Ordinal, bondIndex) => {
    const atom2Ordinal = compact.bonds.atom2Ordinals[bondIndex]!;
    const order = compact.bonds.orders[bondIndex] ?? 0;
    neighborsByOrdinal[atom1Ordinal]!.push(atom2Ordinal);
    ordersByOrdinal[atom1Ordinal]!.push(order);
    neighborsByOrdinal[atom2Ordinal]!.push(atom1Ordinal);
    ordersByOrdinal[atom2Ordinal]!.push(order);
  });
  return {
    atomCount: compact.atomCount,
    specsForRange: (start, end) => Array.from({ length: Math.max(0, Math.min(compact.atomCount, end) - Math.max(0, start)) }, (_, offset) => {
      const index = Math.max(0, start) + offset;
      const flags = compact.flags[index] ?? 0;
      const secondaryStructure = secondaryStructureFor(compact.secondaryStructures[index] ?? 0);
      const stableId = compact.atomStableIds[index]!;
      const neighbors = neighborsByOrdinal[index]!;
      const orders = ordersByOrdinal[index]!;
      return {
        index,
        serial: compact.serials[index],
        atom: stringFor(compact, compact.atomNameIndices[index]!) ?? "X",
        elem: stringFor(compact, compact.elementIndices[index]!) ?? "X",
        resn: stringFor(compact, compact.residueNameIndices[index]!) ?? "UNK",
        resi: compact.residueNumbers[index],
        icode: stringFor(compact, compact.insertionCodeIndices[index]!),
        chain: stringFor(compact, compact.chainIndices[index]!) ?? "_",
        x: compact.x[index], y: compact.y[index], z: compact.z[index],
        hetflag: compact.recordTypes[index] === 1,
        b: compact.bFactors[index] ?? undefined,
        q: compact.occupancies[index] ?? undefined,
        alt: stringFor(compact, compact.altLocIndices[index]!),
        ss: secondaryStructure === "HELIX" ? "h" : secondaryStructure === "SHEET" ? "s" : secondaryStructure === "LOOP" ? "c" : undefined,
        bonds: neighbors,
        bondOrder: orders.map(bondOrderNumberFor),
        properties: {
          canonicalStableId: stableId,
          canonicalObjectId: objectId,
          canonicalCategory: (flags & COMPACT_ATOM_FLAG_POLYMER) !== 0 ? "polymer" : (flags & COMPACT_ATOM_FLAG_LIGAND) !== 0 ? "ligand" : (flags & COMPACT_ATOM_FLAG_WATER) !== 0 ? "water" : (flags & COMPACT_ATOM_FLAG_ION) !== 0 ? "ion" : "other",
          formal_charge: compact.formalCharges[index] ?? undefined,
          partial_charge: undefined,
        },
      } as AtomSpec;
    }),
  };
};

export const compactAtomSpecs = (structure: CanonicalMolecularStructure, objectId?: string): AtomSpec[] | null => {
  const context = compactAtomSpecContext(structure, objectId);
  return context ? context.specsForRange(0, context.atomCount) : null;
};
