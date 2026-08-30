import { createHash } from "node:crypto";
import { basename } from "node:path";
import type {
  CanonicalAtom,
  CanonicalMolecularStructure,
  CoordinateBounds,
  StructureFormat,
  StructureLoadResult,
  StructureSourceKind,
} from "@molecular/contracts";

export const MAX_STRUCTURE_BYTES = 25 * 1024 * 1024;

const WATER_RESIDUES = new Set(["HOH", "WAT", "H2O", "DOD"]);
const ION_ELEMENTS = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI", "CL", "BR", "IOD"]);
const ION_RESIDUES = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI", "CL", "BR", "IOD"]);

export class IngestionError extends Error {
  constructor(
    public readonly code: "UNSUPPORTED_FORMAT" | "INVALID_INPUT" | "REMOTE_FETCH_FAILED" | "REMOTE_NOT_FOUND" | "PAYLOAD_TOO_LARGE",
    message: string,
    public readonly status = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "REMOTE_NOT_FOUND" ? 404 : 400,
  ) {
    super(message);
    this.name = "IngestionError";
  }
}

type ParsedSource = {
  format: StructureFormat;
  atoms: CanonicalAtom[];
};

const parseNumber = (value: string, label: string): number => {
  const parsed = Number(value.replace(/\(.+\)$/, ""));
  if (!Number.isFinite(parsed)) throw new IngestionError("INVALID_INPUT", `Invalid ${label} value in structure input.`);
  return parsed;
};

const parseInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const atoms: CanonicalAtom[] = [];
  for (const line of content.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
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
      ...classifyAtom(recordType, residueName, element),
    });
  }
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No ATOM or HETATM records with coordinates were found.");
  return { format: "pdb", atoms };
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
      if (token.length > 0) {
        token += character;
      } else quote = character;
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

const cifValue = (row: string[], headers: string[], names: string[]): string | undefined => {
  const index = names.map((name) => headers.indexOf(name)).find((value) => value >= 0);
  if (index === undefined) return undefined;
  const value = row[index];
  return value && value !== "." && value !== "?" ? value : undefined;
};

const parseMmcif = (content: string): ParsedSource => {
  const tokens = tokenizeCif(content);
  const loopIndex = tokens.findIndex((token, index) => token.toLowerCase() === "loop_" && tokens[index + 1]?.startsWith("_atom_site."));
  if (loopIndex < 0) throw new IngestionError("INVALID_INPUT", "No _atom_site loop was found in the mmCIF input.");

  const headers: string[] = [];
  let cursor = loopIndex + 1;
  while (tokens[cursor]?.startsWith("_")) {
    headers.push(tokens[cursor]);
    cursor += 1;
  }
  if (headers.length === 0) throw new IngestionError("INVALID_INPUT", "The mmCIF atom loop has no column definitions.");

  const atoms: CanonicalAtom[] = [];
  let rowIndex = 0;
  while (cursor + headers.length <= tokens.length) {
    const next = tokens[cursor];
    if (!next || next === "loop_" || next.startsWith("data_") || next.startsWith("_")) break;
    const row = tokens.slice(cursor, cursor + headers.length);
    cursor += headers.length;
    const xValue = cifValue(row, headers, ["_atom_site.Cartn_x"]);
    const yValue = cifValue(row, headers, ["_atom_site.Cartn_y"]);
    const zValue = cifValue(row, headers, ["_atom_site.Cartn_z"]);
    if (!xValue || !yValue || !zValue) {
      rowIndex += 1;
      continue;
    }
    const record = (cifValue(row, headers, ["_atom_site.group_PDB"]) ?? "ATOM").toUpperCase() === "HETATM" ? "HETATM" : "ATOM";
    const atomName = cifValue(row, headers, ["_atom_site.label_atom_id", "_atom_site.auth_atom_id"]) ?? "X";
    const residueName = cifValue(row, headers, ["_atom_site.label_comp_id", "_atom_site.auth_comp_id"]) ?? "UNK";
    const chain = cifValue(row, headers, ["_atom_site.label_asym_id", "_atom_site.auth_asym_id"]) ?? "_";
    const residueNumber = parseInteger(cifValue(row, headers, ["_atom_site.label_seq_id", "_atom_site.auth_seq_id"]), 0);
    const insertionCode = cifValue(row, headers, ["_atom_site.pdbx_PDB_ins_code"]);
    const element = normalizeElement(cifValue(row, headers, ["_atom_site.type_symbol"]) ?? "", atomName);
    atoms.push({
      serial: parseInteger(cifValue(row, headers, ["_atom_site.id"]), rowIndex + 1),
      atomName,
      element,
      residueName,
      residueNumber,
      insertionCode,
      chain,
      x: parseNumber(xValue, "x coordinate"),
      y: parseNumber(yValue, "y coordinate"),
      z: parseNumber(zValue, "z coordinate"),
      recordType: record,
      ...classifyAtom(record, residueName, element),
    });
    rowIndex += 1;
  }
  if (atoms.length === 0) throw new IngestionError("INVALID_INPUT", "No _atom_site rows with coordinates were found in the mmCIF input.");
  return { format: "mmcif", atoms };
};

const formatFromFilename = (filename: string): StructureFormat => {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdb") return "pdb";
  if (extension === "cif" || extension === "mmcif") return "mmcif";
  throw new IngestionError("UNSUPPORTED_FORMAT", "Only .pdb, .cif, and .mmcif files are admitted in VIS-01.");
};

const parseSource = (filename: string, content: string): ParsedSource => {
  const format = formatFromFilename(filename);
  if (format === "pdb") return parsePdb(content);
  return parseMmcif(content);
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

export class StructureIngestionService {
  private readonly structures = new Map<string, CanonicalMolecularStructure>();

  async ingestLocal(filename: string, buffer: Buffer): Promise<StructureLoadResult> {
    return this.ingest("LOCAL_FILE", filename, buffer);
  }

  async ingestRcsb(pdbId: string): Promise<StructureLoadResult> {
    const normalizedId = pdbId.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(normalizedId)) throw new IngestionError("INVALID_INPUT", "Enter a valid four-character PDB ID.");
    const uri = `https://files.rcsb.org/download/${normalizedId}.cif`;
    let response: Response;
    try {
      response = await fetch(uri, { signal: AbortSignal.timeout(20_000), headers: { accept: "text/plain" } });
    } catch {
      throw new IngestionError("REMOTE_FETCH_FAILED", "RCSB could not be reached. Check the network and try again.", 502);
    }
    if (response.status === 404) throw new IngestionError("REMOTE_NOT_FOUND", `RCSB could not find structure ${normalizedId}.`, 404);
    if (!response.ok) throw new IngestionError("REMOTE_FETCH_FAILED", `RCSB returned HTTP ${response.status}.`, 502);
    const content = await response.text();
    return this.ingest("RCSB", `${normalizedId}.cif`, Buffer.from(content, "utf8"), uri);
  }

  private async ingest(kind: StructureSourceKind, filename: string, buffer: Buffer, uri?: string): Promise<StructureLoadResult> {
    if (buffer.length > MAX_STRUCTURE_BYTES) throw new IngestionError("PAYLOAD_TOO_LARGE", "Structure files must be 25 MB or smaller.");
    const safeFilename = basename(filename).replace(/[^A-Za-z0-9._-]/g, "_");
    const content = buffer.toString("utf8");
    if (!content.trim()) throw new IngestionError("INVALID_INPUT", "The structure input is empty.");
    const parsed = parseSource(safeFilename, content);
    const hash = createHash("sha256").update(buffer).digest("hex");
    const summary = summarize(parsed.atoms);
    const source = {
      kind,
      originalFilename: safeFilename,
      format: parsed.format,
      sha256: hash,
      byteLength: buffer.length,
      ...(uri ? { uri } : {}),
      ingestedAt: new Date().toISOString(),
    } as const;
    const structure: CanonicalMolecularStructure = {
      id: `structure_${hash.slice(0, 16)}`,
      name: safeFilename.replace(/\.(pdb|cif|mmcif)$/i, ""),
      format: parsed.format,
      source,
      atoms: parsed.atoms,
      ...summary,
    };
    this.structures.set(structure.id, structure);
    return { structure, renderSource: { format: parsed.format, content } };
  }
}
