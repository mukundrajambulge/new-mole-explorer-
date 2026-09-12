import { createHash } from "node:crypto";
import { basename } from "node:path";
import type {
  BondOrder,
  CanonicalAtom,
  CanonicalBond,
  CanonicalChain,
  CanonicalHierarchy,
  CanonicalMolecularStructure,
  PeptideSequenceChain,
  CanonicalPolymerType,
  CanonicalCoordinateState,
  CanonicalResidue,
  CoordinateBounds,
  CanonicalUnitCell,
  SecondaryStructureKind,
  StructureFormat,
  StructureLoadResult,
  StructureSourceKind,
  RemoteStructureProvider,
  FormatEvidence,
} from "@molecular/contracts";
import { inferCanonicalChemistryRoles } from "./chemistryRoles.js";
import { scientificHashFor, sha256Bytes, SCIENTIFIC_HASH_PROFILE } from "../lifecycle/canonicalSerialization.js";
import { SourceArtifactStore } from "../lifecycle/sourceArtifactStore.js";

export const MAX_STRUCTURE_BYTES = 25 * 1024 * 1024;
export const INGESTION_PARSER_PROFILE = "molecular-workstation-g1b-canonical-v1";
const REMOTE_FETCH_TIMEOUT_MS = 10_000;

const WATER_RESIDUES = new Set(["HOH", "WAT", "H2O", "DOD"]);
const ION_ELEMENTS = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI", "CL", "BR", "IOD"]);
const ION_RESIDUES = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI", "CL", "BR", "IOD"]);

export class IngestionError extends Error {
  constructor(
    public readonly code: "UNSUPPORTED_FORMAT" | "FORMAT_MISMATCH" | "INVALID_INPUT" | "PARSE_FAILED" | "REMOTE_FETCH_FAILED" | "REMOTE_NOT_FOUND" | "PAYLOAD_TOO_LARGE" | "PROJECT_NOT_FOUND" | "PROJECT_INVALID" | "IMPORT_POLICY_CONFLICT" | "NAME_COLLISION" | "REVISION_CONFLICT" | "UNSUPPORTED_STATE_SCOPE" | "EXPORT_WOULD_LOSE_SEMANTICS" | "WRITER_FAILED" | "INTEGRITY_MISMATCH" | "SCHEMA_UNSUPPORTED" | "MIGRATION_FAILED" | "MISSING_DEPENDENCY" | "STALE_REFERENCE" | "SESSION_RESTORE_FAILED" | "SCENE_RESTORE_FAILED" | "SECURITY_REJECTED",
    message: string,
    public readonly status = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "REMOTE_NOT_FOUND" || code === "PROJECT_NOT_FOUND" ? 404 : code === "REVISION_CONFLICT" || code === "NAME_COLLISION" ? 409 : code === "REMOTE_FETCH_FAILED" ? 502 : 400,
  ) {
    super(message);
    this.name = "IngestionError";
  }
}

type AtomSeed = Omit<CanonicalAtom, "stableId">;
type BondSeed = { atom1Serial: number; atom2Serial: number; order: BondOrder; source: CanonicalBond["source"] };
type SecondarySpan = { kind: Exclude<SecondaryStructureKind, "LOOP">; chain: string; start: number; end: number };
type CoordinateSeed = { sourceIndex: number; x: number; y: number; z: number };
type ParsedSource = { format: StructureFormat; atoms: AtomSeed[]; bonds: BondSeed[]; coordinateStates?: Array<{ sourceModelNumber: number; coordinates: CoordinateSeed[] }>; secondaryStructureSource?: string; polymerTypingSource?: string; unitCell?: CanonicalUnitCell; partialChargeValues?: Record<string, number>; partialChargeBySourceIndex?: Record<number, number> };

const parseNumber = (value: string, label: string): number => {
  const parsed = Number(value.replace(/\(.+\)$/, ""));
  if (!Number.isFinite(parsed)) throw new IngestionError("INVALID_INPUT", `Invalid ${label} value in structure input.`);
  return parsed;
};

const parseInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOptionalNumber = (value: string | undefined): number | null | undefined => {
  const normalized = value?.trim();
  if (!normalized || normalized === "." || normalized === "?") return undefined;
  const parsed = Number(normalized.replace(/\(.+\)$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const makeUnitCell = (values: { a?: string; b?: string; c?: string; alpha?: string; beta?: string; gamma?: string; spaceGroup?: string; zValue?: string }, source: CanonicalUnitCell["source"]): CanonicalUnitCell | undefined => {
  const cellValues = [values.a, values.b, values.c, values.alpha, values.beta, values.gamma];
  const supplied = cellValues.filter((value) => value !== undefined && value.trim() !== "" && value !== "." && value !== "?").length;
  if (supplied === 0) return undefined;
  if (supplied !== cellValues.length) throw new IngestionError("INVALID_INPUT", "Unit-cell input is incomplete; a, b, c, alpha, beta, and gamma are all required.");
  const [a, b, c, alpha, beta, gamma] = cellValues.map((value, index) => parseNumber(value!, ["a", "b", "c", "alpha", "beta", "gamma"][index]!));
  if (a <= 0 || b <= 0 || c <= 0 || alpha <= 0 || alpha >= 180 || beta <= 0 || beta >= 180 || gamma <= 0 || gamma >= 180) throw new IngestionError("INVALID_INPUT", "Unit-cell lengths must be positive and angles must be between 0 and 180 degrees.");
  const spaceGroup = values.spaceGroup?.trim();
  const zValue = values.zValue && values.zValue !== "." && values.zValue !== "?" ? parseNumber(values.zValue, "unit-cell Z") : undefined;
  return { a, b, c, alpha, beta, gamma, ...(spaceGroup ? { spaceGroup } : {}), ...(zValue !== undefined ? { zValue } : {}), source, profileVersion: "fractional-unit-cell-membership-v1" };
};

const parsePdbFormalCharge = (value: string): number | null | undefined => {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const match = normalized.match(/^(\d+)([+-])$/);
  if (!match) return null;
  const magnitude = Number(match[1]);
  return match[2] === "+" ? magnitude : -magnitude;
};

const normalizeElement = (value: string, atomName: string): string => {
  const explicit = value.trim();
  if (explicit) return explicit.toUpperCase();
  const letters = atomName.trim().replace(/[^A-Za-z]/g, "");
  return (letters.slice(0, 2) || "X").toUpperCase();
};

const classifyAtom = (recordType: "ATOM" | "HETATM", residueName: string, element: string) => {
  const normalizedResidue = residueName.toUpperCase();
  const isWater = WATER_RESIDUES.has(normalizedResidue);
  const isIon = recordType === "HETATM" && !isWater && (ION_ELEMENTS.has(element) || ION_RESIDUES.has(normalizedResidue));
  const isPolymer = recordType === "ATOM" && !isWater && !isIon;
  const isLigand = recordType === "HETATM" && !isWater && !isIon;
  return { isPolymer, isLigand, isWater, isIon };
};

const atomCorrespondenceKey = (atom: AtomSeed): string => [atom.serial, atom.atomName, atom.residueName, atom.residueNumber, atom.insertionCode ?? "", atom.chain, atom.altLoc ?? ""].join("\u0000");
const componentAtomKey = (component: string, atomName: string): string => `${component.trim().toUpperCase()}\u0000${atomName.trim()}`;

const parsePdb = (content: string): ParsedSource => {
  const atoms: AtomSeed[] = [];
  const bonds: BondSeed[] = [];
  const secondarySpans: SecondarySpan[] = [];
  const modelAtoms = new Map<number, AtomSeed[]>();
  let activeModel: number | null = null;
  let sawModelRecord = false;
  let unitCell: CanonicalUnitCell | undefined;
  for (const line of content.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
    if (record === "CRYST1") {
      const nextUnitCell = makeUnitCell({ a: line.slice(6, 15).trim(), b: line.slice(15, 24).trim(), c: line.slice(24, 33).trim(), alpha: line.slice(33, 40).trim(), beta: line.slice(40, 47).trim(), gamma: line.slice(47, 54).trim(), spaceGroup: line.slice(55, 66).trim(), zValue: line.slice(66, 70).trim() }, "PDB_CRYST1");
      if (unitCell && JSON.stringify(unitCell) !== JSON.stringify(nextUnitCell)) throw new IngestionError("INVALID_INPUT", "PDB contains conflicting CRYST1 unit-cell records.");
      unitCell = nextUnitCell;
      continue;
    }
    if (record === "MODEL") {
      sawModelRecord = true;
      const modelNumber = parseInteger(line.slice(10, 14).trim(), modelAtoms.size + 1);
      activeModel = modelNumber;
      if (!modelAtoms.has(modelNumber)) modelAtoms.set(modelNumber, []);
      continue;
    }
    if (record === "ENDMDL") {
      activeModel = null;
      continue;
    }
    if (record === "HELIX" || record === "SHEET") {
      const isHelix = record === "HELIX";
      const chain = line.slice(isHelix ? 19 : 21, isHelix ? 20 : 22).trim();
      const endChain = line.slice(isHelix ? 31 : 32, isHelix ? 32 : 33).trim() || chain;
      const start = parseInteger(line.slice(isHelix ? 21 : 22, isHelix ? 25 : 26).trim(), Number.NaN);
      const end = parseInteger(line.slice(isHelix ? 33 : 33, isHelix ? 37 : 37).trim(), Number.NaN);
      if (chain && endChain === chain && Number.isFinite(start) && Number.isFinite(end)) secondarySpans.push({ kind: isHelix ? "HELIX" : "SHEET", chain, start, end });
      continue;
    }
    if (record === "CONECT") {
      const sourceSerial = parseInteger(line.slice(6, 11).trim(), -1);
      if (sourceSerial < 0) continue;
      for (let offset = 11; offset < line.length; offset += 5) {
        const targetSerial = parseInteger(line.slice(offset, offset + 5).trim(), -1);
        if (targetSerial >= 0 && sourceSerial !== targetSerial) bonds.push({ atom1Serial: sourceSerial, atom2Serial: targetSerial, order: "SINGLE", source: "PDB_CONECT" });
      }
      continue;
    }
    if (record !== "ATOM" && record !== "HETATM") continue;
    const recordType = record as "ATOM" | "HETATM";
    const atomName = line.slice(12, 16).trim() || "X";
    const residueName = line.slice(17, 20).trim() || "UNK";
    const chain = line.slice(21, 22).trim() || "_";
    const residueNumber = parseInteger(line.slice(22, 26).trim(), 0);
    const insertionCode = line.slice(26, 27).trim() || undefined;
    const x = parseNumber(line.slice(30, 38).trim(), "x coordinate");
    const y = parseNumber(line.slice(38, 46).trim(), "y coordinate");
    const z = parseNumber(line.slice(46, 54).trim(), "z coordinate");
    const element = normalizeElement(line.slice(76, 78), atomName);
    const atom = {
      serial: parseInteger(line.slice(6, 11).trim(), atoms.length + 1),
      atomName,
      element,
      residueName,
      residueNumber,
      insertionCode,
      chain,
      segmentId: line.slice(72, 76).trim() || undefined,
      x,
      y,
      z,
      recordType,
      bFactor: parseOptionalNumber(line.slice(60, 66)),
      occupancy: parseOptionalNumber(line.slice(54, 60)),
      altLoc: line.slice(16, 17).trim() || undefined,
      formalCharge: parsePdbFormalCharge(line.slice(78, 80)),
      ...classifyAtom(recordType, residueName, element),
    } satisfies AtomSeed;
    if (sawModelRecord || activeModel !== null) modelAtoms.get(activeModel ?? 1)?.push(atom);
    else atoms.push(atom);
  }
  if (modelAtoms.size > 0) {
    const orderedModels = [...modelAtoms.entries()].sort(([a], [b]) => a - b);
    const firstAtoms = orderedModels[0]?.[1] ?? [];
    if (firstAtoms.length === 0) throw new IngestionError("INVALID_INPUT", "PDB MODEL records did not contain any atom coordinates.");
    for (const [, candidateAtoms] of orderedModels) {
      if (candidateAtoms.length !== firstAtoms.length || candidateAtoms.some((atom, index) => atomCorrespondenceKey(atom) !== atomCorrespondenceKey(firstAtoms[index]!))) {
        throw new IngestionError("INVALID_INPUT", "PDB coordinate models do not have a validated atom correspondence.");
      }
    }
    atoms.push(...firstAtoms);
    const coordinateStates = orderedModels.map(([sourceModelNumber, stateAtoms]) => ({ sourceModelNumber, coordinates: stateAtoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }));
    for (const atom of atoms) {
      const span = secondarySpans.find((candidate) => candidate.chain === atom.chain && atom.residueNumber >= candidate.start && atom.residueNumber <= candidate.end);
      if (span) atom.secondaryStructure = span.kind;
    }
    return { format: "pdb", atoms, bonds, coordinateStates, ...(secondarySpans.length ? { secondaryStructureSource: "PDB HELIX/SHEET records" } : {}), ...(unitCell ? { unitCell } : {}) };
  }
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No ATOM or HETATM records with coordinates were found.");
  for (const atom of atoms) {
    const span = secondarySpans.find((candidate) => candidate.chain === atom.chain && atom.residueNumber >= candidate.start && atom.residueNumber <= candidate.end);
    if (span) atom.secondaryStructure = span.kind;
  }

  return { format: "pdb", atoms, bonds, coordinateStates: [{ sourceModelNumber: 1, coordinates: atoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }], ...(secondarySpans.length ? { secondaryStructureSource: "PDB HELIX/SHEET records" } : {}), ...(unitCell ? { unitCell } : {}) };
};

/**
 * PQR retains PDB atom identity while storing coordinates, charge, and radius
 * as whitespace-delimited fields.  Radius is source metadata and is not used
 * to mutate the application VDW model.
 */
const parsePqr = (content: string): ParsedSource => {
  const atoms: AtomSeed[] = [];
  const partialChargeBySourceIndex: Record<number, number> = {};
  for (const line of content.split(/\r?\n/)) {
    if (!/^(ATOM|HETATM)\s/.test(line)) continue;
    const fields = line.trim().split(/\s+/);
    if (fields.length < 10) throw new IngestionError("INVALID_INPUT", "PQR atom records require identity, XYZ coordinates, charge, and radius.");
    const recordType = fields[0] as "ATOM" | "HETATM";
    const serial = parseInteger(fields[1], atoms.length + 1);
    const atomName = fields[2] || "X";
    const residueName = fields[3] || "UNK";
    // A chain ID is optional in PQR. The final five fields are always resi XYZ charge radius.
    const coordinateStart = fields.length - 5;
    const residueNumber = parseInteger(fields[coordinateStart - 1], 0);
    const chain = coordinateStart > 5 ? (fields[coordinateStart - 2] || "_") : "_";
    const x = parseNumber(fields[coordinateStart]!, "x coordinate");
    const y = parseNumber(fields[coordinateStart + 1]!, "y coordinate");
    const z = parseNumber(fields[coordinateStart + 2]!, "z coordinate");
    const charge = parseNumber(fields[coordinateStart + 3]!, "PQR charge");
    const radius = parseNumber(fields[coordinateStart + 4]!, "PQR radius");
    if (radius <= 0) throw new IngestionError("INVALID_INPUT", "PQR atomic radii must be positive.");
    const element = normalizeElement("", atomName);
    atoms.push({ serial, atomName, element, residueName, residueNumber, chain, x, y, z, recordType, ...classifyAtom(recordType, residueName, element) });
    partialChargeBySourceIndex[atoms.length - 1] = charge;
  }
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No ATOM or HETATM records with coordinates were found in the PQR input.");
  return { format: "pqr", atoms, bonds: [], coordinateStates: [{ sourceModelNumber: 1, coordinates: atoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }], partialChargeBySourceIndex };
};

/** Bounded MDL V2000 reader for one coordinate-bearing molecule per import. */
const parseSdf = (content: string): ParsedSource => {
  const records = content.split(/^\$\$\$\$\s*$/m).map((record) => record.trim()).filter(Boolean);
  if (records.length !== 1) throw new IngestionError("INVALID_INPUT", "SDF import currently accepts exactly one molecule record. Split multi-record SDF files before importing.");
  const lines = records[0]!.split(/\r?\n/);
  if (lines.length < 4 || !/V2000\s*$/i.test(lines[3] ?? "")) throw new IngestionError("INVALID_INPUT", "Only coordinate-bearing MDL V2000 MOL/SDF records are admitted.");
  const atomCount = parseInteger(lines[3]!.slice(0, 3).trim(), -1);
  const bondCount = parseInteger(lines[3]!.slice(3, 6).trim(), -1);
  if (atomCount < 1 || bondCount < 0 || lines.length < 4 + atomCount + bondCount) throw new IngestionError("INVALID_INPUT", "MOL/SDF counts or atom block are incomplete.");
  const atoms: AtomSeed[] = [];
  for (let index = 0; index < atomCount; index += 1) {
    const line = lines[4 + index]!;
    const x = parseNumber(line.slice(0, 10).trim(), "x coordinate");
    const y = parseNumber(line.slice(10, 20).trim(), "y coordinate");
    const z = parseNumber(line.slice(20, 30).trim(), "z coordinate");
    const element = normalizeElement(line.slice(31, 34), "X");
    if (element === "X") throw new IngestionError("INVALID_INPUT", "MOL/SDF atom records require an element symbol.");
    atoms.push({ serial: index + 1, atomName: `${element}${index + 1}`, element, residueName: "MOL", residueNumber: 1, chain: "_", x, y, z, recordType: "HETATM", ...classifyAtom("HETATM", "MOL", element) });
  }
  const bonds: BondSeed[] = [];
  for (let index = 0; index < bondCount; index += 1) {
    const line = lines[4 + atomCount + index]!;
    const atom1Serial = parseInteger(line.slice(0, 3).trim(), -1);
    const atom2Serial = parseInteger(line.slice(3, 6).trim(), -1);
    const orderCode = parseInteger(line.slice(6, 9).trim(), 0);
    if (atom1Serial < 1 || atom1Serial > atomCount || atom2Serial < 1 || atom2Serial > atomCount || atom1Serial === atom2Serial) throw new IngestionError("INVALID_INPUT", "MOL/SDF bond records reference an invalid atom.");
    bonds.push({ atom1Serial, atom2Serial, order: orderCode === 1 ? "SINGLE" : orderCode === 2 ? "DOUBLE" : orderCode === 3 ? "TRIPLE" : orderCode === 4 ? "AROMATIC" : "UNKNOWN", source: "UNKNOWN" });
  }
  return { format: "sdf", atoms, bonds, coordinateStates: [{ sourceModelNumber: 1, coordinates: atoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }] };
};

/** Bounded XYZ reader: one explicit coordinate frame, with no inferred bonds. */
const parseXyz = (content: string): ParsedSource => {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const atomCount = Number.parseInt(lines[0]?.trim() ?? "", 10);
  if (!Number.isInteger(atomCount) || atomCount < 1 || String(atomCount) !== (lines[0]?.trim() ?? "")) throw new IngestionError("INVALID_INPUT", "XYZ input must begin with a positive integer atom count.");
  if (lines.length < atomCount + 2) throw new IngestionError("INVALID_INPUT", "XYZ atom block is incomplete.");
  const trailing = lines.slice(atomCount + 2).filter((line) => line.trim());
  if (trailing.length) throw new IngestionError("INVALID_INPUT", "XYZ import currently accepts exactly one coordinate frame.");
  const atoms: AtomSeed[] = [];
  for (let index = 0; index < atomCount; index += 1) {
    const fields = lines[index + 2]?.trim().split(/\s+/) ?? [];
    if (fields.length !== 4 || !/^[A-Za-z]{1,3}$/.test(fields[0] ?? "")) throw new IngestionError("INVALID_INPUT", `XYZ atom record ${index + 1} must contain an element and three coordinates.`);
    const element = normalizeElement(fields[0]!, fields[0]!);
    const x = parseNumber(fields[1]!, "x coordinate");
    const y = parseNumber(fields[2]!, "y coordinate");
    const z = parseNumber(fields[3]!, "z coordinate");
    atoms.push({ serial: index + 1, atomName: element, element, residueName: "LIG", residueNumber: 1, chain: "_", x, y, z, recordType: "HETATM", ...classifyAtom("HETATM", "LIG", element) });
  }
  return { format: "xyz", atoms, bonds: [], coordinateStates: [{ sourceModelNumber: 1, coordinates: atoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }] };
};

/** Bounded SYBYL MOL2 reader for one molecule record with declared bonds. */
const parseMol2 = (content: string): ParsedSource => {
  const sectionMatches = [...content.matchAll(/^@<TRIPOS>([A-Z_]+)\s*$/gim)];
  const moleculeSections = sectionMatches.filter((match) => match[1]?.toUpperCase() === "MOLECULE");
  if (moleculeSections.length !== 1) throw new IngestionError("INVALID_INPUT", "MOL2 import currently accepts exactly one molecule record.");
  const section = (name: string): string[] => {
    const match = sectionMatches.find((candidate) => candidate[1]?.toUpperCase() === name);
    if (!match || match.index === undefined) return [];
    const start = match.index + match[0].length;
    const next = sectionMatches.find((candidate) => candidate.index !== undefined && candidate.index > match.index);
    return content.slice(start, next?.index ?? content.length).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  };
  const moleculeLines = section("MOLECULE");
  const counts = moleculeLines[1]?.split(/\s+/) ?? [];
  const declaredAtoms = parseInteger(counts[0], -1);
  const declaredBonds = parseInteger(counts[1], -1);
  if (declaredAtoms < 1 || declaredBonds < 0) throw new IngestionError("INVALID_INPUT", "MOL2 molecule counts are missing or invalid.");
  const atomLines = section("ATOM");
  const bondLines = section("BOND");
  if (atomLines.length < declaredAtoms || bondLines.length < declaredBonds) throw new IngestionError("INVALID_INPUT", "MOL2 atom or bond sections are incomplete.");
  const atomById = new Map<number, AtomSeed>();
  const partialChargeBySourceIndex: Record<number, number> = {};
  for (let index = 0; index < declaredAtoms; index += 1) {
    const fields = atomLines[index]!.split(/\s+/);
    if (fields.length < 6) throw new IngestionError("INVALID_INPUT", `MOL2 atom record ${index + 1} is incomplete.`);
    const serial = parseInteger(fields[0], index + 1);
    const atomName = fields[1] || "X";
    const x = parseNumber(fields[2]!, "x coordinate");
    const y = parseNumber(fields[3]!, "y coordinate");
    const z = parseNumber(fields[4]!, "z coordinate");
    const atomType = fields[5] || atomName;
    const element = normalizeElement(atomType.split(".")[0] ?? "", atomName);
    if (element === "X") throw new IngestionError("INVALID_INPUT", `MOL2 atom record ${index + 1} has no usable element.`);
    const residueNumber = parseInteger(fields[6], 1);
    const residueName = fields[7] || moleculeLines[0] || "MOL";
    const atom: AtomSeed = { serial, atomName, element, residueName, residueNumber, chain: "_", x, y, z, recordType: "HETATM", ...classifyAtom("HETATM", residueName, element) };
    atomById.set(serial, atom);
    const charge = fields[8] === undefined ? undefined : parseOptionalNumber(fields[8]);
    if (typeof charge === "number") partialChargeBySourceIndex[index] = charge;
  }
  const atoms = [...atomById.values()];
  const bonds: BondSeed[] = [];
  for (let index = 0; index < declaredBonds; index += 1) {
    const fields = bondLines[index]!.split(/\s+/);
    const atom1Serial = parseInteger(fields[1], -1);
    const atom2Serial = parseInteger(fields[2], -1);
    if (!atomById.has(atom1Serial) || !atomById.has(atom2Serial) || atom1Serial === atom2Serial) throw new IngestionError("INVALID_INPUT", `MOL2 bond record ${index + 1} references an invalid atom.`);
    const type = (fields[3] ?? "").toLowerCase();
    bonds.push({ atom1Serial, atom2Serial, order: type === "1" ? "SINGLE" : type === "2" ? "DOUBLE" : type === "3" ? "TRIPLE" : type === "ar" ? "AROMATIC" : type === "am" ? "AROMATIC" : "UNKNOWN", source: "UNKNOWN" });
  }
  return { format: "mol2", atoms, bonds, coordinateStates: [{ sourceModelNumber: 1, coordinates: atoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }], ...(Object.keys(partialChargeBySourceIndex).length ? { partialChargeBySourceIndex } : {}) };
};

/** PDBQT retains PDB coordinates while adding docking charge and atom-type fields. */
const parsePdbqt = (content: string): ParsedSource => {
  const atoms: AtomSeed[] = [];
  const partialChargeBySourceIndex: Record<number, number> = {};
  for (const line of content.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
    if (record !== "ATOM" && record !== "HETATM") continue;
    const atomName = line.slice(12, 16).trim() || "X";
    const residueName = line.slice(17, 20).trim() || "UNK";
    const chain = line.slice(21, 22).trim() || "_";
    const residueNumber = parseInteger(line.slice(22, 26).trim(), 0);
    const x = parseNumber(line.slice(30, 38).trim(), "x coordinate");
    const y = parseNumber(line.slice(38, 46).trim(), "y coordinate");
    const z = parseNumber(line.slice(46, 54).trim(), "z coordinate");
    const atomType = line.slice(77, 79).trim() || line.slice(70).trim().split(/\s+/).at(-1) || atomName;
    const element = normalizeElement(atomType, atomName);
    const serial = parseInteger(line.slice(6, 11).trim(), atoms.length + 1);
    const atom: AtomSeed = { serial, atomName, element, residueName, residueNumber, chain, x, y, z, recordType: record, bFactor: parseOptionalNumber(line.slice(60, 66)), occupancy: parseOptionalNumber(line.slice(54, 60)), ...classifyAtom(record, residueName, element) };
    atoms.push(atom);
    const charge = parseOptionalNumber(line.slice(70, 76));
    if (typeof charge === "number") partialChargeBySourceIndex[atoms.length - 1] = charge;
  }
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No ATOM or HETATM records with coordinates were found in the PDBQT input.");
  return { format: "pdbqt", atoms, bonds: [], coordinateStates: [{ sourceModelNumber: 1, coordinates: atoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }], ...(Object.keys(partialChargeBySourceIndex).length ? { partialChargeBySourceIndex } : {}) };
};

const tokenizeCif = (content: string): string[] => {
  const tokens: string[] = [];
  let token = "";
  let quote = "";
  let comment = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (comment) {
      if (character === "\n") comment = false;
      continue;
    }
    if (quote) {
      if (character === quote) {
        tokens.push(token);
        token = "";
        quote = "";
      } else token += character;
      continue;
    }
    if (character === "#" && token.length === 0) {
      comment = true;
      continue;
    }
    if (character === "'" || character === '"') {
      if (token.length > 0) token += character;
      else quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (token) {
        tokens.push(token);
        token = "";
      }
      continue;
    }
    token += character;
  }
  if (token) tokens.push(token);
  return tokens;
};

type CifLoop = { headers: string[]; rows: string[][] };

const readCifLoops = (content: string): CifLoop[] => {
  const tokens = tokenizeCif(content);
  const loops: CifLoop[] = [];
  let cursor = 0;
  while (cursor < tokens.length) {
    if (tokens[cursor]?.toLowerCase() !== "loop_") {
      cursor += 1;
      continue;
    }
    cursor += 1;
    const headers: string[] = [];
    while (tokens[cursor]?.startsWith("_")) {
      headers.push(tokens[cursor]);
      cursor += 1;
    }
    if (headers.length === 0) continue;
    const rows: string[][] = [];
    while (cursor < tokens.length && tokens[cursor]?.toLowerCase() !== "loop_" && !tokens[cursor]?.startsWith("data_")) {
      if (tokens[cursor]?.startsWith("_")) break;
      if (cursor + headers.length > tokens.length) break;
      rows.push(tokens.slice(cursor, cursor + headers.length));
      cursor += headers.length;
    }
    loops.push({ headers, rows });
  }
  return loops;
};

const cifValue = (row: string[], headers: string[], names: string[]): string | undefined => {
  const index = names.map((name) => headers.indexOf(name)).find((value) => value >= 0);
  if (index === undefined) return undefined;
  const value = row[index];
  return value && value !== "." && value !== "?" ? value : undefined;
};

const cifScalar = (tokens: readonly string[], name: string): string | undefined => {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] !== name) continue;
    const value = tokens[index + 1];
    if (value && !value.startsWith("_") && value.toLowerCase() !== "loop_" && !value.toLowerCase().startsWith("data_")) return value;
  }
  return undefined;
};

const parseBondOrder = (value: string | undefined): BondOrder => {
  const normalized = (value ?? "").toUpperCase();
  if (normalized.includes("DOUB")) return "DOUBLE";
  if (normalized.includes("TRIP")) return "TRIPLE";
  if (normalized.includes("AROM")) return "AROMATIC";
  if (normalized.includes("SING")) return "SINGLE";
  return "UNKNOWN";
};

const classifyEntityPolymerType = (value: string | undefined): CanonicalPolymerType | undefined => {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("polypeptide")) return "PROTEIN";
  if (normalized.includes("ribonucleotide") || normalized.includes("deoxyribonucleotide") || normalized.includes("nucleotide")) return "NUCLEIC_ACID";
  if (normalized.includes("poly") || normalized.includes("peptide")) return "OTHER_POLYMER";
  return undefined;
};

const parseMmcif = (content: string): ParsedSource => {
  const loops = readCifLoops(content);
  const cifTokens = tokenizeCif(content);
  const unitCell = makeUnitCell({ a: cifScalar(cifTokens, "_cell.length_a"), b: cifScalar(cifTokens, "_cell.length_b"), c: cifScalar(cifTokens, "_cell.length_c"), alpha: cifScalar(cifTokens, "_cell.angle_alpha"), beta: cifScalar(cifTokens, "_cell.angle_beta"), gamma: cifScalar(cifTokens, "_cell.angle_gamma"), spaceGroup: cifScalar(cifTokens, "_symmetry.space_group_name_H-M") ?? cifScalar(cifTokens, "_space_group.name_H-M_alt"), zValue: cifScalar(cifTokens, "_cell.Z_PDB") }, "MMCIF_CELL");
  const atomLoop = loops.find((loop) => loop.headers.some((header) => header.startsWith("_atom_site.")));
  if (!atomLoop) throw new IngestionError("INVALID_INPUT", "No _atom_site loop was found in the mmCIF input.");
  const polymerEntityTypes = new Map<string, CanonicalPolymerType>();
  let hasPolymerEntityLoop = false;
  for (const loop of loops) {
    if (!loop.headers.includes("_entity_poly.type")) continue;
    hasPolymerEntityLoop = true;
    for (const row of loop.rows) {
      const entityId = cifValue(row, loop.headers, ["_entity_poly.entity_id"]);
      const polymerType = classifyEntityPolymerType(cifValue(row, loop.headers, ["_entity_poly.type"]));
      if (entityId && polymerType) polymerEntityTypes.set(entityId, polymerType);
    }
  }
  const modelAtoms = new Map<number, AtomSeed[]>();
  for (const [rowIndex, row] of atomLoop.rows.entries()) {
    const xValue = cifValue(row, atomLoop.headers, ["_atom_site.Cartn_x"]);
    const yValue = cifValue(row, atomLoop.headers, ["_atom_site.Cartn_y"]);
    const zValue = cifValue(row, atomLoop.headers, ["_atom_site.Cartn_z"]);
    if (!xValue || !yValue || !zValue) continue;
    const record = (cifValue(row, atomLoop.headers, ["_atom_site.group_PDB"]) ?? "ATOM").toUpperCase() === "HETATM" ? "HETATM" : "ATOM";
    const atomName = cifValue(row, atomLoop.headers, ["_atom_site.label_atom_id", "_atom_site.auth_atom_id"]) ?? "X";
    const residueName = cifValue(row, atomLoop.headers, ["_atom_site.label_comp_id", "_atom_site.auth_comp_id"]) ?? "UNK";
    const chain = cifValue(row, atomLoop.headers, ["_atom_site.label_asym_id", "_atom_site.auth_asym_id"]) ?? "_";
    const residueNumber = parseInteger(cifValue(row, atomLoop.headers, ["_atom_site.label_seq_id", "_atom_site.auth_seq_id"]), 0);
    const element = normalizeElement(cifValue(row, atomLoop.headers, ["_atom_site.type_symbol"]) ?? "", atomName);
    const entityId = cifValue(row, atomLoop.headers, ["_atom_site.label_entity_id"]);
    const polymerType = entityId ? polymerEntityTypes.get(entityId) : undefined;
    const atom = {
      serial: parseInteger(cifValue(row, atomLoop.headers, ["_atom_site.id"]), rowIndex + 1),
      atomName,
      element,
      residueName,
      residueNumber,
      insertionCode: cifValue(row, atomLoop.headers, ["_atom_site.pdbx_PDB_ins_code"]),
      chain,
      segmentId: cifValue(row, atomLoop.headers, ["_atom_site.pdbx_PDB_segment_id"]),
      x: parseNumber(xValue, "x coordinate"),
      y: parseNumber(yValue, "y coordinate"),
      z: parseNumber(zValue, "z coordinate"),
      recordType: record,
      bFactor: parseOptionalNumber(cifValue(row, atomLoop.headers, ["_atom_site.B_iso_or_equiv"])),
      occupancy: parseOptionalNumber(cifValue(row, atomLoop.headers, ["_atom_site.occupancy"])),
      altLoc: cifValue(row, atomLoop.headers, ["_atom_site.label_alt_id", "_atom_site.pdbx_PDB_alt_id"]),
      formalCharge: parseOptionalNumber(cifValue(row, atomLoop.headers, ["_atom_site.pdbx_formal_charge"])),
      ...classifyAtom(record, residueName, element),
      ...(polymerType ? { polymerType } : {}),
    } satisfies AtomSeed;
    const modelNumber = parseInteger(cifValue(row, atomLoop.headers, ["_atom_site.pdbx_PDB_model_num", "_atom_site.pdbx_model_num"]), 1);
    modelAtoms.set(modelNumber, [...(modelAtoms.get(modelNumber) ?? []), atom]);
  }
  const orderedModels = [...modelAtoms.entries()].sort(([a], [b]) => a - b);
  const atoms = orderedModels[0]?.[1] ?? [];
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No _atom_site rows with coordinates were found in the mmCIF input.");
  for (const [, candidateAtoms] of orderedModels) {
    if (candidateAtoms.length !== atoms.length || candidateAtoms.some((atom, index) => atomCorrespondenceKey(atom) !== atomCorrespondenceKey(atoms[index]!))) {
      throw new IngestionError("INVALID_INPUT", "mmCIF coordinate models do not have a validated atom correspondence.");
    }
  }

  const secondarySpans: SecondarySpan[] = [];
  for (const loop of loops) {
    if (loop.headers.some((header) => header.startsWith("_struct_conf."))) {
      for (const row of loop.rows) {
        const type = (cifValue(row, loop.headers, ["_struct_conf.conf_type_id"]) ?? "").toUpperCase();
        const kind = type.includes("HELX") ? "HELIX" : null;
        const chain = cifValue(row, loop.headers, ["_struct_conf.beg_label_asym_id", "_struct_conf.beg_auth_asym_id"]);
        const endChain = cifValue(row, loop.headers, ["_struct_conf.end_label_asym_id", "_struct_conf.end_auth_asym_id"]) ?? chain;
        const start = parseInteger(cifValue(row, loop.headers, ["_struct_conf.beg_label_seq_id", "_struct_conf.beg_auth_seq_id"]), Number.NaN);
        const end = parseInteger(cifValue(row, loop.headers, ["_struct_conf.end_label_seq_id", "_struct_conf.end_auth_seq_id"]), Number.NaN);
        if (kind && chain && chain === endChain && Number.isFinite(start) && Number.isFinite(end)) secondarySpans.push({ kind, chain, start, end });
      }
    }
    if (loop.headers.some((header) => header.startsWith("_struct_sheet_range."))) {
      for (const row of loop.rows) {
        const chain = cifValue(row, loop.headers, ["_struct_sheet_range.beg_label_asym_id", "_struct_sheet_range.beg_auth_asym_id"]);
        const endChain = cifValue(row, loop.headers, ["_struct_sheet_range.end_label_asym_id", "_struct_sheet_range.end_auth_asym_id"]) ?? chain;
        const start = parseInteger(cifValue(row, loop.headers, ["_struct_sheet_range.beg_label_seq_id", "_struct_sheet_range.beg_auth_seq_id"]), Number.NaN);
        const end = parseInteger(cifValue(row, loop.headers, ["_struct_sheet_range.end_label_seq_id", "_struct_sheet_range.end_auth_seq_id"]), Number.NaN);
        if (chain && chain === endChain && Number.isFinite(start) && Number.isFinite(end)) secondarySpans.push({ kind: "SHEET", chain, start, end });
      }
    }
  }
  for (const atom of atoms) {
    const span = secondarySpans.find((candidate) => candidate.chain === atom.chain && atom.residueNumber >= candidate.start && atom.residueNumber <= candidate.end);
    if (span) atom.secondaryStructure = span.kind;
  }

  const serialFor = (chain: string, residue: number, atomName: string, residueName?: string): number[] => atoms
    .filter((atom) => atom.chain === chain && atom.residueNumber === residue && atom.atomName === atomName && (!residueName || atom.residueName === residueName))
    .map((atom) => atom.serial);
  const bonds: BondSeed[] = [];
  for (const loop of loops) {
    if (loop.headers.some((header) => header.startsWith("_struct_conn."))) {
      for (const row of loop.rows) {
        const atom1 = serialFor(cifValue(row, loop.headers, ["_struct_conn.ptnr1_label_asym_id", "_struct_conn.ptnr1_auth_asym_id"]) ?? "_", parseInteger(cifValue(row, loop.headers, ["_struct_conn.ptnr1_label_seq_id", "_struct_conn.ptnr1_auth_seq_id"]), 0), cifValue(row, loop.headers, ["_struct_conn.ptnr1_label_atom_id", "_struct_conn.ptnr1_auth_atom_id"]) ?? "X", cifValue(row, loop.headers, ["_struct_conn.ptnr1_label_comp_id", "_struct_conn.ptnr1_auth_comp_id"]));
        const atom2 = serialFor(cifValue(row, loop.headers, ["_struct_conn.ptnr2_label_asym_id", "_struct_conn.ptnr2_auth_asym_id"]) ?? "_", parseInteger(cifValue(row, loop.headers, ["_struct_conn.ptnr2_label_seq_id", "_struct_conn.ptnr2_auth_seq_id"]), 0), cifValue(row, loop.headers, ["_struct_conn.ptnr2_label_atom_id", "_struct_conn.ptnr2_auth_atom_id"]) ?? "X", cifValue(row, loop.headers, ["_struct_conn.ptnr2_label_comp_id", "_struct_conn.ptnr2_auth_comp_id"]));
        if (atom1[0] !== undefined && atom2[0] !== undefined) bonds.push({ atom1Serial: atom1[0], atom2Serial: atom2[0], order: parseBondOrder(cifValue(row, loop.headers, ["_struct_conn.pdbx_value_order"])), source: "MMCIF_STRUCT_CONN" });
      }
    }
    if (loop.headers.some((header) => header.startsWith("_geom_bond."))) {
      for (const row of loop.rows) {
        const atom1 = serialFor(cifValue(row, loop.headers, ["_geom_bond.atom_site_asym_id_1"]) ?? "_", parseInteger(cifValue(row, loop.headers, ["_geom_bond.atom_site_label_seq_id_1"]), 0), cifValue(row, loop.headers, ["_geom_bond.atom_site_label_atom_id_1"]) ?? "X");
        const atom2 = serialFor(cifValue(row, loop.headers, ["_geom_bond.atom_site_asym_id_2"]) ?? "_", parseInteger(cifValue(row, loop.headers, ["_geom_bond.atom_site_label_seq_id_2"]), 0), cifValue(row, loop.headers, ["_geom_bond.atom_site_label_atom_id_2"]) ?? "X");
        if (atom1[0] !== undefined && atom2[0] !== undefined) bonds.push({ atom1Serial: atom1[0], atom2Serial: atom2[0], order: parseBondOrder(cifValue(row, loop.headers, ["_geom_bond.value_order"])), source: "MMCIF_GEOM_BOND" });
      }
    }
    if (loop.headers.some((header) => header.startsWith("_chem_comp_bond."))) {
      for (const row of loop.rows) {
        const component = cifValue(row, loop.headers, ["_chem_comp_bond.comp_id"]);
        const atomName1 = cifValue(row, loop.headers, ["_chem_comp_bond.atom_id_1"]);
        const atomName2 = cifValue(row, loop.headers, ["_chem_comp_bond.atom_id_2"]);
        if (!component || !atomName1 || !atomName2) continue;
        for (const atom1 of atoms.filter((atom) => atom.residueName === component && atom.atomName === atomName1)) {
          const atom2 = atoms.find((candidate) => candidate.chain === atom1.chain && candidate.residueNumber === atom1.residueNumber && candidate.residueName === component && candidate.atomName === atomName2);
          if (atom2) bonds.push({ atom1Serial: atom1.serial, atom2Serial: atom2.serial, order: parseBondOrder(cifValue(row, loop.headers, ["_chem_comp_bond.value_order"])), source: "MMCIF_CHEM_COMP_BOND" });
        }
      }
    }
  }
  const partialChargeValues: Record<string, number> = {};
  const partialChargeLoop = loops.find((loop) => loop.headers.includes("_chem_comp_atom.partial_charge"));
  if (partialChargeLoop) {
    for (const row of partialChargeLoop.rows) {
      const component = cifValue(row, partialChargeLoop.headers, ["_chem_comp_atom.comp_id"]);
      const atomName = cifValue(row, partialChargeLoop.headers, ["_chem_comp_atom.atom_id"]);
      const value = cifValue(row, partialChargeLoop.headers, ["_chem_comp_atom.partial_charge"]);
      if (!component || !atomName || !value) continue;
      const parsedValue = parseOptionalNumber(value);
      if (typeof parsedValue !== "number" || !Number.isFinite(parsedValue)) continue;
      const key = componentAtomKey(component, atomName);
      if (partialChargeValues[key] === undefined || partialChargeValues[key] === parsedValue) partialChargeValues[key] = parsedValue;
      else delete partialChargeValues[key];
    }
  }
  return { format: "mmcif", atoms, bonds, coordinateStates: orderedModels.map(([sourceModelNumber, stateAtoms]) => ({ sourceModelNumber, coordinates: stateAtoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) })), ...(secondarySpans.length ? { secondaryStructureSource: "mmCIF struct_conf/struct_sheet_range records" } : {}), ...(hasPolymerEntityLoop && polymerEntityTypes.size > 0 ? { polymerTypingSource: "mmCIF _entity_poly.type mapped by _atom_site.label_entity_id" } : {}), ...(Object.keys(partialChargeValues).length ? { partialChargeValues } : {}), ...(unitCell ? { unitCell } : {}) };
};

const formatFromFilename = (filename: string): StructureFormat => {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdb") return "pdb";
  if (extension === "cif" || extension === "mmcif") return "mmcif";
  if (extension === "pqr") return "pqr";
  if (extension === "sdf" || extension === "mol") return "sdf";
  if (extension === "xyz") return "xyz";
  if (extension === "mol2") return "mol2";
  if (extension === "pdbqt") return "pdbqt";
  throw new IngestionError("UNSUPPORTED_FORMAT", "This file is not an admitted coordinate format. Supported coordinate formats are PDB, mmCIF, PQR, SDF/MOL, XYZ, MOL2, and PDBQT.");
};

const formatEvidenceFor = (filename: string, content: string): { format: StructureFormat; evidence: FormatEvidence[] } => {
  const extension = filename.toLowerCase().split(".").pop();
  const filenameFormat: StructureFormat | undefined = extension === "pdb" ? "pdb" : extension === "cif" || extension === "mmcif" ? "mmcif" : extension === "pqr" ? "pqr" : extension === "sdf" || extension === "mol" ? "sdf" : extension === "xyz" ? "xyz" : extension === "mol2" ? "mol2" : extension === "pdbqt" ? "pdbqt" : undefined;
  if (!filenameFormat) throw new IngestionError("UNSUPPORTED_FORMAT", "This file is not an admitted coordinate format. Supported coordinate formats are PDB, mmCIF, PQR, SDF/MOL, XYZ, MOL2, and PDBQT.");
  const lines = content.split(/\r?\n/);
  const hasPdbSignature = lines.some((line) => /^(HEADER|TITLE\s|ATOM\s{2}|HETATM|MODEL\s|CRYST1|CONECT|HELIX\s|SHEET\s)/.test(line));
  const hasMmcifSignature = /^\s*data_[^\s]*/im.test(content) && /_atom_site\./i.test(content);
  const hasPqrSignature = lines.some((line) => /^(ATOM|HETATM)\s+\d+\s+\S+\s+\S+(?:\s+\S+)?\s+-?\d+\s+-?\d/.test(line));
  const hasSdfSignature = lines.length >= 4 && /V2000\s*$/i.test(lines[3] ?? "");
  const declaredXyzAtoms = Number.parseInt(lines[0]?.trim() ?? "", 10);
  const hasXyzSignature = filenameFormat === "xyz" && Number.isInteger(declaredXyzAtoms) && declaredXyzAtoms > 0 && lines.length >= declaredXyzAtoms + 2 && lines.slice(2, declaredXyzAtoms + 2).every((line) => /^[A-Za-z]{1,3}\s+[-+]?\d/.test(line.trim()));
  const hasMol2Signature = content.split(/\r?\n/).some((line) => /^@<TRIPOS>(MOLECULE|ATOM|BOND)\s*$/i.test(line.trim()));
  const hasPdbqtSignature = lines.some((line) => /^(ATOM|HETATM)\s/.test(line) && line.length >= 54 && line.slice(70).trim().length > 0);
  const signature: FormatEvidence | undefined = hasMmcifSignature ? { kind: "CONTENT_SIGNATURE", value: "mmCIF data_ + _atom_site loop" } : filenameFormat === "sdf" && hasSdfSignature ? { kind: "CONTENT_SIGNATURE", value: "MDL V2000 molfile" } : filenameFormat === "xyz" && hasXyzSignature ? { kind: "CONTENT_SIGNATURE", value: "XYZ atom-count coordinate frame" } : filenameFormat === "pqr" && hasPqrSignature ? { kind: "CONTENT_SIGNATURE", value: "PQR whitespace atom records" } : filenameFormat === "mol2" && hasMol2Signature ? { kind: "CONTENT_SIGNATURE", value: "SYBYL MOL2 TRIPOS sections" } : filenameFormat === "pdbqt" && hasPdbqtSignature ? { kind: "CONTENT_SIGNATURE", value: "PDBQT charged atom records" } : hasPdbSignature ? { kind: "CONTENT_SIGNATURE", value: "PDB record columns" } : undefined;
  const signatureFormat = signature?.value.startsWith("mmCIF") ? "mmcif" : signature?.value.startsWith("MDL") ? "sdf" : signature?.value.startsWith("XYZ") ? "xyz" : signature?.value.startsWith("PQR") ? "pqr" : signature?.value.startsWith("SYBYL") ? "mol2" : signature?.value.startsWith("PDBQT") ? "pdbqt" : signature?.value.startsWith("PDB") ? "pdb" : undefined;
  if (signatureFormat && filenameFormat !== signatureFormat) {
    throw new IngestionError("FORMAT_MISMATCH", `Filename extension declares ${filenameFormat}, but content evidence declares ${signatureFormat}.`);
  }
  return { format: filenameFormat, evidence: [{ kind: "FILENAME_EXTENSION", value: extension! }, ...(signature ? [signature] : [])] };
};

const parseSource = (filename: string, content: string): ParsedSource => {
  const format = formatFromFilename(filename);
  return format === "pdb" ? parsePdb(content) : format === "pqr" ? parsePqr(content) : format === "sdf" ? parseSdf(content) : format === "xyz" ? parseXyz(content) : format === "mol2" ? parseMol2(content) : format === "pdbqt" ? parsePdbqt(content) : parseMmcif(content);
};

const makeHierarchy = (atoms: CanonicalAtom[]): CanonicalHierarchy => {
  const chains: Record<string, CanonicalChain> = {};
  const residues: Record<string, CanonicalResidue> = {};
  for (const atom of atoms) {
    const chainId = `chain:${atom.chain}`;
    const residueId = `${chainId}:residue:${atom.residueNumber}:${atom.insertionCode ?? ""}`;
    if (!chains[chainId]) chains[chainId] = { id: chainId, name: atom.chain, residueIds: [] };
    if (!residues[residueId]) {
      residues[residueId] = { id: residueId, name: atom.residueName, number: atom.residueNumber, ...(atom.insertionCode ? { insertionCode: atom.insertionCode } : {}), chainId, atomIds: [], isPolymer: atom.isPolymer, ...(atom.secondaryStructure ? { secondaryStructure: atom.secondaryStructure } : {}) };
      chains[chainId].residueIds.push(residueId);
    }
      residues[residueId].atomIds.push(atom.stableId);
      residues[residueId].isPolymer ||= atom.isPolymer;
      if (!residues[residueId].secondaryStructure && atom.secondaryStructure) residues[residueId].secondaryStructure = atom.secondaryStructure;
  }
  return { chainIds: Object.keys(chains), chains, residues };
};

const summarize = (atoms: CanonicalAtom[]): { counts: CanonicalMolecularStructure["counts"]; bounds: CoordinateBounds } => {
  const residues = new Set(atoms.map((atom) => `${atom.chain}:${atom.residueNumber}:${atom.insertionCode ?? ""}`));
  const chains = new Set(atoms.map((atom) => atom.chain));
  const coordinates = atoms.map(({ x, y, z }) => ({ x, y, z }));
  const bounds = {
    min: { x: Math.min(...coordinates.map((point) => point.x)), y: Math.min(...coordinates.map((point) => point.y)), z: Math.min(...coordinates.map((point) => point.z)) },
    max: { x: Math.max(...coordinates.map((point) => point.x)), y: Math.max(...coordinates.map((point) => point.y)), z: Math.max(...coordinates.map((point) => point.z)) },
  };
  return {
    counts: {
      atoms: atoms.length,
      residues: residues.size,
      chains: chains.size,
      polymerAtoms: atoms.filter((atom) => atom.isPolymer).length,
      ligandAtoms: atoms.filter((atom) => atom.isLigand).length,
      waterAtoms: atoms.filter((atom) => atom.isWater).length,
      ionAtoms: atoms.filter((atom) => atom.isIon).length,
      otherAtoms: atoms.filter((atom) => !atom.isPolymer && !atom.isLigand && !atom.isWater && !atom.isIon).length,
    },
    bounds,
  };
};

const canonicalBondKey = (atom1: string, atom2: string) => [atom1, atom2].sort().join("|");

/**
 * Stable scientific identity is intentionally independent of transport bytes.
 * Source-artifact identity remains byte-exact, while this profile hashes the
 * parsed molecular content using ordinal atom/state references instead of
 * source-hash-derived IDs.
 */
const scientificPayloadFor = (atoms: readonly CanonicalAtom[], bonds: readonly CanonicalBond[], hierarchy: CanonicalHierarchy, coordinateStates: readonly CanonicalCoordinateState[], stateOrder: readonly string[], summary: { counts: CanonicalMolecularStructure["counts"]; bounds: CoordinateBounds }, parsed: ParsedSource, sourceChargeMap: Readonly<Record<string, number>>, hasCompleteSourceCharges: boolean, peptideSequenceChains: Readonly<Record<string, PeptideSequenceChain>>, chemistryRoles: { donorAtomIds: readonly string[]; acceptorAtomIds: readonly string[] } | undefined) => {
  const atomIndex = new Map(atoms.map((atom, index) => [atom.stableId, index]));
  const canonicalAtoms = atoms.map((value) => { const { stableId, ...atom } = value; void stableId; return atom; });
  const canonicalBonds = bonds.map((value) => { const { id, atom1, atom2, ...bond } = value; void id; return { ...bond, atom1: atomIndex.get(atom1) ?? -1, atom2: atomIndex.get(atom2) ?? -1 }; });
  const canonicalHierarchy = {
    chainIds: hierarchy.chainIds,
    chains: Object.fromEntries(hierarchy.chainIds.map((chainId) => [chainId, { ...hierarchy.chains[chainId], residueIds: [...hierarchy.chains[chainId]!.residueIds] }])),
    residues: Object.fromEntries(Object.entries(hierarchy.residues).map(([residueId, residue]) => [residueId, { ...residue, atomIds: residue.atomIds.map((atomId) => atomIndex.get(atomId) ?? -1) }])),
  };
  const canonicalStates = coordinateStates.map((state) => ({
    ordinal: state.ordinal,
    sourceModelNumber: state.sourceModelNumber ?? null,
    coordinates: atoms.map((atom) => state.coordinates[atom.stableId] ?? { x: atom.x, y: atom.y, z: atom.z }),
  }));
  const canonicalCharges = hasCompleteSourceCharges ? atoms.map((atom) => sourceChargeMap[atom.stableId] ?? null) : null;
  return {
    atoms: canonicalAtoms,
    bonds: canonicalBonds,
    hierarchy: canonicalHierarchy,
    counts: summary.counts,
    bounds: summary.bounds,
    coordinateStates: canonicalStates,
    stateOrder: stateOrder.map((_stateId, index) => index + 1),
    unitCell: parsed.unitCell ?? null,
    polymerTypingSource: parsed.polymerTypingSource ?? null,
    partialChargeValues: canonicalCharges,
    chemistryRoles: chemistryRoles ? { donorAtomOrdinals: chemistryRoles.donorAtomIds.map((atomId) => atomIndex.get(atomId) ?? -1).filter((index) => index >= 0), acceptorAtomOrdinals: chemistryRoles.acceptorAtomIds.map((atomId) => atomIndex.get(atomId) ?? -1).filter((index) => index >= 0) } : null,
    peptideSequenceChains: Object.fromEntries(Object.entries(peptideSequenceChains).map(([chainId, chain]) => [chainId, { ...chain, residueIds: chain.residueIds.map((_id, index) => index) }])),
  };
};

const AMINO_ACID_ONE_LETTER: Readonly<Record<string, string>> = {
  ALA: "A", ARG: "R", ASN: "N", ASP: "D", CYS: "C", GLN: "Q", GLU: "E", GLY: "G",
  HIS: "H", ILE: "I", LEU: "L", LYS: "K", MET: "M", PHE: "F", PRO: "P", SER: "S",
  THR: "T", TRP: "W", TYR: "Y", VAL: "V",
};

const peptideSequenceChainsFor = (hierarchy: CanonicalHierarchy): Record<string, PeptideSequenceChain> =>
  Object.fromEntries(hierarchy.chainIds.map((chainId) => {
    const polymerResidues = hierarchy.chains[chainId]!.residueIds
      .map((residueId) => hierarchy.residues[residueId]!)
      .filter((residue) => residue.isPolymer);
    return [chainId, {
      residueIds: polymerResidues.map((residue) => residue.id),
      sequence: polymerResidues.map((residue) => AMINO_ACID_ONE_LETTER[residue.name.toUpperCase()] ?? "X").join(""),
    } satisfies PeptideSequenceChain];
  }));

export class StructureIngestionService {
  private readonly structures = new Map<string, CanonicalMolecularStructure>();

  constructor(private readonly sourceArtifacts = new SourceArtifactStore()) {}

  async ingestLocal(filename: string, buffer: Buffer, options: { parentExportArtifactId?: string } = {}): Promise<StructureLoadResult> {
    if (/\.(pse|pze)$/i.test(filename)) throw new IngestionError("SECURITY_REJECTED", "Foreign PyMOL session files are not executable input in R09; no pickle or arbitrary deserialization path is available.");
    return this.ingest("LOCAL_FILE", filename, buffer, undefined, undefined, options);
  }

  async ingestRcsb(pdbId: string): Promise<StructureLoadResult> {
    const normalizedId = pdbId.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(normalizedId)) throw new IngestionError("INVALID_INPUT", "Enter a valid four-character PDB ID.");
    const sources: Array<{ provider: RemoteStructureProvider; uri: string }> = [
      { provider: "RCSB", uri: `https://files.rcsb.org/download/${normalizedId}.cif` },
      { provider: "PDBE", uri: `https://www.ebi.ac.uk/pdbe/entry-files/download/${normalizedId.toLowerCase()}.cif` },
    ];
    let sawNotFound = false;
    let allResponsesNotFound = true;
    for (const source of sources) {
      let response: Response;
      try {
        response = await fetch(source.uri, { signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS), headers: { accept: "text/plain" } });
      } catch {
        allResponsesNotFound = false;
        continue;
      }
      if (response.status === 404) {
        sawNotFound = true;
        continue;
      }
      allResponsesNotFound = false;
      if (!response.ok) continue;
      try {
        const responseBytes = Buffer.from(await response.arrayBuffer());
        const providerMetadata = Object.fromEntries(["etag", "last-modified", "content-length", "content-type"].flatMap((header) => {
          const value = response.headers.get(header);
          return value ? [[header, value] as const] : [];
        }));
        return await this.ingest("RCSB", `${normalizedId}.cif`, responseBytes, source.uri, source.provider, {
          mediaType: response.headers.get("content-type")?.split(";", 1)[0]?.trim() || "chemical/x-mmcif",
          accession: normalizedId,
          providerMetadata,
        });
      } catch (error) {
        if (error instanceof IngestionError) throw error;
        continue;
      }
    }
    if (sawNotFound && allResponsesNotFound) throw new IngestionError("REMOTE_NOT_FOUND", `RCSB/wwPDB could not find structure ${normalizedId}.`, 404);
    throw new IngestionError("REMOTE_FETCH_FAILED", "RCSB/wwPDB could not be reached. Check the network and try again.", 502);
  }

  private async ingest(kind: StructureSourceKind, filename: string, buffer: Buffer, uri?: string, provider?: RemoteStructureProvider, acquisition: { mediaType?: string; accession?: string; providerMetadata?: Readonly<Record<string, string>>; parentExportArtifactId?: string } = {}): Promise<StructureLoadResult> {
    if (buffer.length > MAX_STRUCTURE_BYTES) throw new IngestionError("PAYLOAD_TOO_LARGE", "Structure files must be 25 MB or smaller.");
    const safeFilename = basename(filename).replace(/[^A-Za-z0-9._-]/g, "_");
    // This is intentionally before Buffer decoding.  The SourceArtifact
    // digest is evidence for the received byte stream, not parser text.
    const hash = sha256Bytes(buffer);
    const content = buffer.toString("utf8");
    if (!content.trim()) throw new IngestionError("INVALID_INPUT", "The structure input is empty.");
    const formatEvidence = formatEvidenceFor(safeFilename, content);
    const sourceArtifact = await this.sourceArtifacts.seal({
      acquisitionKind: kind === "RCSB" ? "REMOTE_HTTP" : "LOCAL_UPLOAD",
      originalFilename: safeFilename,
      mediaType: acquisition.mediaType ?? (formatEvidence.format === "pdb" ? "chemical/x-pdb" : formatEvidence.format === "pqr" ? "chemical/x-pqr" : formatEvidence.format === "sdf" ? "chemical/x-mdl-sdfile" : formatEvidence.format === "xyz" ? "chemical/x-xyz" : formatEvidence.format === "mol2" ? "chemical/x-mol2" : formatEvidence.format === "pdbqt" ? "chemical/x-pdbqt" : "chemical/x-mmcif"),
      format: formatEvidence.format,
      formatEvidence: formatEvidence.evidence,
      parserProfile: INGESTION_PARSER_PROFILE,
      ...(uri ? { sourceUri: uri } : {}),
      ...(provider ? { provider } : {}),
      ...(acquisition.accession ? { accession: acquisition.accession } : {}),
      ...(acquisition.providerMetadata ? { providerMetadata: acquisition.providerMetadata } : {}),
      ...(acquisition.parentExportArtifactId ? { parentExportArtifactId: acquisition.parentExportArtifactId, acquisitionKind: "DERIVED_EXPORT" as const } : {}),
    }, buffer);
    const parsed = parseSource(safeFilename, content);
    const atomIdsBySerial = new Map<number, string[]>();
    const atoms: CanonicalAtom[] = parsed.atoms.map((atom, index) => {
      const stableId = `${hash.slice(0, 16)}:atom:${index + 1}`;
      const ids = atomIdsBySerial.get(atom.serial) ?? [];
      ids.push(stableId);
      atomIdsBySerial.set(atom.serial, ids);
      return { ...atom, stableId };
    });
    const bondsByKey = new Map<string, CanonicalBond>();
    for (const bond of parsed.bonds) {
      const atom1 = atomIdsBySerial.get(bond.atom1Serial)?.[0];
      const atom2 = atomIdsBySerial.get(bond.atom2Serial)?.[0];
      if (!atom1 || !atom2 || atom1 === atom2) continue;
      const key = canonicalBondKey(atom1, atom2);
      if (!bondsByKey.has(key)) bondsByKey.set(key, { id: `${hash.slice(0, 16)}:bond:${bondsByKey.size + 1}`, atom1, atom2, order: bond.order, source: bond.source });
    }
    const summary = summarize(atoms);
    const source = {
      kind,
      originalFilename: safeFilename,
      format: parsed.format,
      sha256: hash,
      byteLength: buffer.length,
      ...(uri ? { uri } : {}),
      ...(provider ? { provider } : {}),
      ingestedAt: new Date().toISOString(),
      parserProfile: INGESTION_PARSER_PROFILE,
      sourceArtifactId: sourceArtifact.sourceArtifactId,
      acquisitionKind: sourceArtifact.acquisitionKind,
      mediaType: sourceArtifact.mediaType,
      formatEvidence: sourceArtifact.formatEvidence,
      ...(sourceArtifact.providerMetadata ? { providerMetadata: sourceArtifact.providerMetadata } : {}),
      scientificHashProfile: SCIENTIFIC_HASH_PROFILE,
    } as const;
    const hierarchy = makeHierarchy(atoms);
    const bonds = [...bondsByKey.values()];
    const peptideSequenceChains = peptideSequenceChainsFor(hierarchy);
    const coordinateStates: CanonicalCoordinateState[] = (parsed.coordinateStates ?? [{ sourceModelNumber: 1, coordinates: atoms.map((atom, sourceIndex) => ({ sourceIndex, x: atom.x, y: atom.y, z: atom.z })) }]).map((state, index) => {
      const coordinates = Object.fromEntries(state.coordinates.map((coordinate) => {
        const atom = atoms[coordinate.sourceIndex];
        return atom ? [atom.stableId, { x: coordinate.x, y: coordinate.y, z: coordinate.z }] : [];
      })) as Record<string, { x: number; y: number; z: number }>;
      const coordinateHash = createHash("sha256").update(JSON.stringify(coordinates)).digest("hex");
      return { id: `${hash.slice(0, 16)}:state:${state.sourceModelNumber}`, ordinal: index + 1, sourceModelNumber: state.sourceModelNumber, coordinates, coordinateHash };
    });
    const stateOrder = coordinateStates.map((state) => state.id);
    const sourceChargeMap = parsed.partialChargeBySourceIndex
      ? Object.fromEntries(atoms.flatMap((atom, sourceIndex) => {
        const value = parsed.partialChargeBySourceIndex![sourceIndex];
        return typeof value === "number" && Number.isFinite(value) ? [[atom.stableId, value] as const] : [];
      }))
      : parsed.partialChargeValues
      ? Object.fromEntries(atoms.flatMap((atom) => {
        const value = parsed.partialChargeValues![componentAtomKey(atom.residueName, atom.atomName)];
        return typeof value === "number" && Number.isFinite(value) ? [[atom.stableId, value] as const] : [];
      }))
      : {};
    const hasCompleteSourceCharges = (parsed.format === "mmcif" || parsed.format === "pqr" || parsed.format === "pdbqt" || parsed.format === "mol2") && atoms.length > 0 && Object.keys(sourceChargeMap).length === atoms.length;
    const partialChargeDataset = hasCompleteSourceCharges ? {
      datasetId: `${hash.slice(0, 16)}:partial-charge`,
      molecularRevision: "pending",
      chargeModel: parsed.format === "pqr" ? "source-declared PQR atomic charge" : parsed.format === "pdbqt" ? "source-declared PDBQT partial charge" : parsed.format === "mol2" ? "source-declared MOL2 atom charge" : "source-declared mmCIF _chem_comp_atom.partial_charge",
      profileVersion: parsed.format === "pqr" ? "pqr-atomic-charge-v1" : parsed.format === "pdbqt" ? "pdbqt-atomic-charge-v1" : parsed.format === "mol2" ? "mol2-atomic-charge-v1" : "mmcif-chem-comp-partial-charge-v1",
      atomChargeMap: sourceChargeMap,
      units: "e",
      provenance: parsed.format === "pqr" ? "Copied from source PQR charge field; no charge inference performed" : parsed.format === "pdbqt" ? "Copied from source PDBQT partial-charge field; no charge inference performed" : parsed.format === "mol2" ? "Copied from source MOL2 atom charge field; no charge inference performed" : "Copied from source _chem_comp_atom.partial_charge; no charge inference performed",
    } : undefined;
    const chemistryRoles = inferCanonicalChemistryRoles(atoms, bonds);
    const scientificPayload = scientificPayloadFor(atoms, bonds, hierarchy, coordinateStates, stateOrder, summary, parsed, sourceChargeMap, hasCompleteSourceCharges, peptideSequenceChains, chemistryRoles);
    const scientificHash = scientificHashFor(scientificPayload);
    const structure: CanonicalMolecularStructure = {
      id: `structure_${hash.slice(0, 16)}`,
      name: safeFilename.replace(/\.(pdb|pqr|sdf|mol|xyz|mol2|pdbqt|cif|mmcif)$/i, ""),
      format: parsed.format,
      source,
      atoms,
      bonds,
      hierarchy,
      scientificHash,
      scientificHashProfile: SCIENTIFIC_HASH_PROFILE,
      coordinateStates,
      stateOrder,
      ...(parsed.unitCell ? { unitCell: parsed.unitCell } : {}),
      ...(parsed.polymerTypingSource ? { polymerTypingSource: parsed.polymerTypingSource } : {}),
      ...(parsed.secondaryStructureSource ? { secondaryStructureDataset: { datasetId: `${hash.slice(0, 16)}:secondary-structure`, molecularRevision: scientificHash, assignmentSource: parsed.secondaryStructureSource, profileVersion: "pdb-mmcif-structural-records-v1" } } : {}),
      ...(partialChargeDataset ? { partialChargeDataset: { ...partialChargeDataset, molecularRevision: scientificHash } } : {}),
      ...(chemistryRoles ? { chemistryDataset: { datasetId: `${hash.slice(0, 16)}:chemistry-roles`, molecularRevision: scientificHash, profileVersion: "canonical-chemistry-roles-v1" as const, donorAtomIds: chemistryRoles.donorAtomIds, acceptorAtomIds: chemistryRoles.acceptorAtomIds, provenance: chemistryRoles.provenance } } : {}),
      peptideSequenceDataset: { datasetId: `${hash.slice(0, 16)}:peptide-sequence`, molecularRevision: scientificHash, assignmentSource: "canonical polymer residue names mapped to one-letter amino-acid codes", profileVersion: "canonical-peptide-sequence-v1", chains: peptideSequenceChains },
      ...summary,
    };
    this.structures.set(structure.id, structure);
    return { structure, renderSource: { format: parsed.format, content }, sourceArtifact };
  }
}
