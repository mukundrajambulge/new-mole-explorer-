import { createHash } from "node:crypto";
import { basename } from "node:path";
import type {
  BondOrder,
  CanonicalAtom,
  CanonicalBond,
  CanonicalChain,
  CanonicalHierarchy,
  CanonicalMolecularStructure,
  CanonicalResidue,
  CoordinateBounds,
  SecondaryStructureKind,
  StructureFormat,
  StructureLoadResult,
  StructureSourceKind,
} from "@molecular/contracts";
import { BoundedTtlLruStore, type BoundedTtlLruStoreOptions } from "../cache/boundedTtlLruStore.js";

export const MAX_STRUCTURE_BYTES = 25 * 1024 * 1024;
export const INGESTION_PARSER_PROFILE = "molecular-workstation-g1b-canonical-v1";

const WATER_RESIDUES = new Set(["HOH", "WAT", "H2O", "DOD"]);
const ION_ELEMENTS = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI", "CL", "BR", "IOD"]);
const ION_RESIDUES = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI", "CL", "BR", "IOD"]);

export class IngestionError extends Error {
  constructor(
    public readonly code: "UNSUPPORTED_FORMAT" | "INVALID_INPUT" | "REMOTE_FETCH_FAILED" | "REMOTE_NOT_FOUND" | "REMOTE_RESPONSE_TOO_LARGE" | "PAYLOAD_TOO_LARGE" | "PROJECT_NOT_FOUND" | "PROJECT_INVALID" | "REVISION_CONFLICT",
    message: string,
    public readonly status = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "REMOTE_RESPONSE_TOO_LARGE" || code === "REMOTE_FETCH_FAILED" ? 502 : code === "REVISION_CONFLICT" ? 409 : code === "REMOTE_NOT_FOUND" || code === "PROJECT_NOT_FOUND" ? 404 : 400,
  ) {
    super(message);
    this.name = "IngestionError";
  }
}

type AtomSeed = Omit<CanonicalAtom, "stableId">;
type BondSeed = { atom1Serial: number; atom2Serial: number; order: BondOrder; source: CanonicalBond["source"] };
type SecondarySpan = { kind: Exclude<SecondaryStructureKind, "LOOP">; chain: string; start: number; end: number };
type ParsedSource = { format: StructureFormat; atoms: AtomSeed[]; bonds: BondSeed[]; secondaryStructureSource?: string };

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

const parsePdb = (content: string): ParsedSource => {
  const atoms: AtomSeed[] = [];
  const bonds: BondSeed[] = [];
  const secondarySpans: SecondarySpan[] = [];
  for (const line of content.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
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
    atoms.push({
      serial: parseInteger(line.slice(6, 11).trim(), atoms.length + 1),
      atomName,
      element,
      residueName,
      residueNumber,
      insertionCode,
      chain,
      x,
      y,
      z,
      recordType,
      bFactor: parseOptionalNumber(line.slice(60, 66)),
      occupancy: parseOptionalNumber(line.slice(54, 60)),
      altLoc: line.slice(16, 17).trim() || undefined,
      formalCharge: parsePdbFormalCharge(line.slice(78, 80)),
      ...classifyAtom(recordType, residueName, element),
    });
  }
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No ATOM or HETATM records with coordinates were found.");
  for (const atom of atoms) {
    const span = secondarySpans.find((candidate) => candidate.chain === atom.chain && atom.residueNumber >= candidate.start && atom.residueNumber <= candidate.end);
    if (span) atom.secondaryStructure = span.kind;
  }
  return { format: "pdb", atoms, bonds, ...(secondarySpans.length ? { secondaryStructureSource: "PDB HELIX/SHEET records" } : {}) };
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

const parseBondOrder = (value: string | undefined): BondOrder => {
  const normalized = (value ?? "").toUpperCase();
  if (normalized.includes("DOUB")) return "DOUBLE";
  if (normalized.includes("TRIP")) return "TRIPLE";
  if (normalized.includes("AROM")) return "AROMATIC";
  if (normalized.includes("SING")) return "SINGLE";
  return "UNKNOWN";
};

const parseMmcif = (content: string): ParsedSource => {
  const loops = readCifLoops(content);
  const atomLoop = loops.find((loop) => loop.headers.some((header) => header.startsWith("_atom_site.")));
  if (!atomLoop) throw new IngestionError("INVALID_INPUT", "No _atom_site loop was found in the mmCIF input.");
  const atoms: AtomSeed[] = [];
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
    atoms.push({
      serial: parseInteger(cifValue(row, atomLoop.headers, ["_atom_site.id"]), rowIndex + 1),
      atomName,
      element,
      residueName,
      residueNumber,
      insertionCode: cifValue(row, atomLoop.headers, ["_atom_site.pdbx_PDB_ins_code"]),
      chain,
      x: parseNumber(xValue, "x coordinate"),
      y: parseNumber(yValue, "y coordinate"),
      z: parseNumber(zValue, "z coordinate"),
      recordType: record,
      bFactor: parseOptionalNumber(cifValue(row, atomLoop.headers, ["_atom_site.B_iso_or_equiv"])),
      occupancy: parseOptionalNumber(cifValue(row, atomLoop.headers, ["_atom_site.occupancy"])),
      altLoc: cifValue(row, atomLoop.headers, ["_atom_site.label_alt_id", "_atom_site.pdbx_PDB_alt_id"]),
      formalCharge: parseOptionalNumber(cifValue(row, atomLoop.headers, ["_atom_site.pdbx_formal_charge"])),
      ...classifyAtom(record, residueName, element),
    });
  }
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No _atom_site rows with coordinates were found in the mmCIF input.");

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
  return { format: "mmcif", atoms, bonds, ...(secondarySpans.length ? { secondaryStructureSource: "mmCIF struct_conf/struct_sheet_range records" } : {}) };
};

const formatFromFilename = (filename: string): StructureFormat => {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdb") return "pdb";
  if (extension === "cif" || extension === "mmcif") return "mmcif";
  throw new IngestionError("UNSUPPORTED_FORMAT", "Only .pdb, .cif, and .mmcif files are admitted in G1C.");
};

const parseSource = (filename: string, content: string): ParsedSource => {
  const format = formatFromFilename(filename);
  return format === "pdb" ? parsePdb(content) : parseMmcif(content);
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

export class StructureIngestionService {
  private readonly sourceCache: BoundedTtlLruStore<string, Buffer>;
  private readonly parsedCache: BoundedTtlLruStore<string, StructureLoadResult>;
  private readonly rcsbCache: BoundedTtlLruStore<string, StructureLoadResult>;
  private readonly rcsbInflight = new Map<string, Promise<StructureLoadResult>>();

  constructor(options: { sourceCache?: BoundedTtlLruStoreOptions<Buffer>; parsedCache?: BoundedTtlLruStoreOptions<StructureLoadResult>; localCache?: BoundedTtlLruStoreOptions<StructureLoadResult>; rcsbCache?: BoundedTtlLruStoreOptions<StructureLoadResult> } = {}) {
    const positiveEnvNumber = (name: string, fallback: number) => {
      const value = Number(process.env[name]);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    const defaultOptions = (prefix: string): BoundedTtlLruStoreOptions<StructureLoadResult> => ({
      maxEntries: positiveEnvNumber(`MOLECULAR_${prefix}_CACHE_ENTRIES`, 8),
      maxBytes: positiveEnvNumber(`MOLECULAR_${prefix}_CACHE_BYTES`, 128 * 1024 * 1024),
      ttlMs: positiveEnvNumber(`MOLECULAR_${prefix}_CACHE_TTL_MS`, 15 * 60 * 1000),
      sizeOf: (value) => Buffer.byteLength(value.renderSource.content, "utf8") + value.structure.atoms.length * 192 + value.structure.bonds.length * 96,
    });
    const sourceOptions: BoundedTtlLruStoreOptions<Buffer> = {
      maxEntries: positiveEnvNumber("MOLECULAR_SOURCE_CACHE_ENTRIES", 8),
      maxBytes: positiveEnvNumber("MOLECULAR_SOURCE_CACHE_BYTES", 128 * 1024 * 1024),
      ttlMs: positiveEnvNumber("MOLECULAR_SOURCE_CACHE_TTL_MS", 15 * 60 * 1000),
      sizeOf: (value) => value.byteLength,
    };
    this.sourceCache = new BoundedTtlLruStore(options.sourceCache ?? sourceOptions);
    this.parsedCache = new BoundedTtlLruStore(options.parsedCache ?? options.localCache ?? defaultOptions("PARSED"));
    this.rcsbCache = new BoundedTtlLruStore(options.rcsbCache ?? defaultOptions("RCSB"));
  }

  async ingestLocal(filename: string, buffer: Buffer): Promise<StructureLoadResult> {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const source = this.sourceCache.get(hash) ?? Buffer.from(buffer);
    this.sourceCache.set(hash, source);
    const cacheKey = `${filename.toLowerCase()}:${hash}`;
    const cached = this.parsedCache.get(cacheKey);
    if (cached) return cached;
    const result = await this.ingest("LOCAL_FILE", filename, source);
    this.parsedCache.set(cacheKey, result);
    return result;
  }

  async ingestRcsb(pdbId: string): Promise<StructureLoadResult> {
    const normalizedId = pdbId.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(normalizedId)) throw new IngestionError("INVALID_INPUT", "Enter a valid four-character PDB ID.");
    const cached = this.rcsbCache.get(normalizedId);
    if (cached) return cached;
    const inflight = this.rcsbInflight.get(normalizedId);
    if (inflight) return inflight;
    const uri = `https://files.rcsb.org/download/${normalizedId}.cif`;
    const request = this.ingestRcsbRemote(normalizedId, uri);
    this.rcsbInflight.set(normalizedId, request);
    try {
      const result = await request;
      this.rcsbCache.set(normalizedId, result);
      return result;
    } finally {
      this.rcsbInflight.delete(normalizedId);
    }
  }

  private async ingestRcsbRemote(normalizedId: string, uri: string): Promise<StructureLoadResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(uri, { signal: controller.signal, headers: { accept: "text/plain" } });
      if (response.status === 404) throw new IngestionError("REMOTE_NOT_FOUND", `RCSB could not find structure ${normalizedId}.`, 404);
      if (!response.ok) throw new IngestionError("REMOTE_FETCH_FAILED", `RCSB returned HTTP ${response.status}.`, 502);
      const buffer = await readRemoteResponse(response, MAX_STRUCTURE_BYTES, () => controller.abort());
      return this.ingest("RCSB", `${normalizedId}.cif`, buffer, uri);
    } catch (error) {
      if (error instanceof IngestionError) throw error;
      throw new IngestionError("REMOTE_FETCH_FAILED", "RCSB could not be reached. Check the network and try again.", 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async ingest(kind: StructureSourceKind, filename: string, buffer: Buffer, uri?: string): Promise<StructureLoadResult> {
    if (buffer.length > MAX_STRUCTURE_BYTES) throw new IngestionError("PAYLOAD_TOO_LARGE", "Structure files must be 25 MB or smaller.");
    const safeFilename = basename(filename).replace(/[^A-Za-z0-9._-]/g, "_");
    const content = buffer.toString("utf8");
    if (!content.trim()) throw new IngestionError("INVALID_INPUT", "The structure input is empty.");
    const parsed = parseSource(safeFilename, content);
    const hash = createHash("sha256").update(buffer).digest("hex");
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
      ingestedAt: new Date().toISOString(),
      parserProfile: INGESTION_PARSER_PROFILE,
    } as const;
    const hierarchy = makeHierarchy(atoms);
    const bonds = [...bondsByKey.values()];
    const scientificPayload = { atoms, bonds, hierarchy, counts: summary.counts, bounds: summary.bounds };
    const scientificHash = createHash("sha256").update(JSON.stringify(scientificPayload)).digest("hex");
    const structure: CanonicalMolecularStructure = {
      id: `structure_${hash.slice(0, 16)}`,
      name: safeFilename.replace(/\.(pdb|cif|mmcif)$/i, ""),
      format: parsed.format,
      source,
      atoms,
      bonds,
      hierarchy,
      scientificHash,
      ...(parsed.secondaryStructureSource ? { secondaryStructureDataset: { datasetId: `${hash.slice(0, 16)}:secondary-structure`, molecularRevision: scientificHash, assignmentSource: parsed.secondaryStructureSource, profileVersion: "pdb-mmcif-structural-records-v1" } } : {}),
      ...summary,
    };
    return { structure, renderSource: { format: parsed.format, content } };
  }
}

const readRemoteResponse = async (response: Response, maxBytes: number, abort: () => void): Promise<Buffer> => {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    abort();
    throw new IngestionError("REMOTE_RESPONSE_TOO_LARGE", `RCSB response exceeds the ${maxBytes} byte limit.`, 502);
  }
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      abort();
      throw new IngestionError("REMOTE_RESPONSE_TOO_LARGE", `RCSB response exceeds the ${maxBytes} byte limit.`, 502);
    }
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = Buffer.from(next.value);
      size += chunk.length;
      if (size > maxBytes) {
        abort();
        await reader.cancel();
        throw new IngestionError("REMOTE_RESPONSE_TOO_LARGE", `RCSB response exceeds the ${maxBytes} byte limit.`, 502);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
};
