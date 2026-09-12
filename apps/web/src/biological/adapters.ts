/**
 * Biological data adapters deliberately produce typed, non-atomic datasets.
 * Sequence, density, trajectory, and topology inputs never become fabricated
 * coordinate structures.  Coordinate-bearing files continue through the API
 * structure ingestion path.
 */

export const BIOLOGICAL_FORMATS = [
  "fasta", "fastq", "genbank", "embl", "dx", "mrc", "ccp4", "xyz-trajectory", "dcd", "xtc", "trr", "gro", "psf", "prmtop", "smiles",
] as const;
export type BiologicalFormat = (typeof BIOLOGICAL_FORMATS)[number];
export type BiologicalKind = "SEQUENCE" | "SEQUENCE_QUALITY" | "MAP" | "TRAJECTORY" | "TOPOLOGY" | "SMILES";

export type SequenceRecord = {
  id: string;
  description: string;
  sequence: string;
  quality?: readonly number[];
};

export type MapGrid = {
  dimensions: readonly [number, number, number];
  origin: readonly [number, number, number];
  spacing: readonly [number, number, number];
  values: readonly number[];
  valueRange: { min: number; max: number; mean: number };
  valueCount: number;
  dataComplete: boolean;
};

export type TrajectoryAtom = { index: number; element: string; x: number; y: number; z: number; name?: string; residue?: string; chain?: string };
export type TrajectoryFrame = { index: number; label: string; atoms: readonly TrajectoryAtom[] };

export type BiologicalData =
  | { kind: "SEQUENCE"; format: Exclude<BiologicalFormat, "fastq" | "dx" | "mrc" | "ccp4" | "xyz-trajectory" | "dcd" | "xtc" | "trr" | "gro" | "psf" | "prmtop" | "smiles">; sourceName: string; records: readonly SequenceRecord[]; alphabet: "DNA" | "RNA" | "PROTEIN" | "MIXED" }
  | { kind: "SEQUENCE_QUALITY"; format: "fastq"; sourceName: string; records: readonly SequenceRecord[]; alphabet: "DNA" | "RNA" | "PROTEIN" | "MIXED" }
  | { kind: "MAP"; format: "dx" | "mrc" | "ccp4"; sourceName: string; grid: MapGrid; encoding: "ASCII_DX" | "MRC_BINARY" }
  | { kind: "TRAJECTORY"; format: "xyz-trajectory" | "dcd" | "xtc" | "trr" | "gro"; sourceName: string; frames: readonly TrajectoryFrame[]; atomCount: number; status: "READY" | "HEADER_ONLY"; diagnostic?: string }
  | { kind: "TOPOLOGY"; format: "psf" | "prmtop"; sourceName: string; atomCount: number; bondCount: number | null; residueCount: number | null; status: "READY" | "METADATA_ONLY"; diagnostic?: string }
  | { kind: "SMILES"; format: "smiles"; sourceName: string; records: readonly { id: string; notation: string; name?: string }[] };

export class BiologicalAdapterError extends Error {
  constructor(message: string, public readonly code: "UNSUPPORTED_FORMAT" | "INVALID_INPUT" | "PARSE_FAILED" = "PARSE_FAILED") {
    super(message);
    this.name = "BiologicalAdapterError";
  }
}

const MAX_SEQUENCE_RECORDS = 100_000;
const MAX_SEQUENCE_LENGTH = 10_000_000;
const MAX_MAP_VALUES = 2_000_000;

const alphabetFor = (records: readonly SequenceRecord[]): "DNA" | "RNA" | "PROTEIN" | "MIXED" => {
  const sequence = records.map((record) => record.sequence).join("").toUpperCase();
  if (!sequence) return "MIXED";
  if (/^[ACGTNRYKMSWBDHV-]+$/.test(sequence)) return "DNA";
  if (/^[ACGUNRYKMSWBDHV-]+$/.test(sequence)) return "RNA";
  if (/^[ABCDEFGHIKLMNPQRSTVWXYZUO*-]+$/.test(sequence)) return "PROTEIN";
  return "MIXED";
};

const normalizeSequence = (value: string, label: string): string => {
  const sequence = value.replace(/[\s\d]/g, "").toUpperCase();
  if (!sequence) throw new BiologicalAdapterError(`${label} contains an empty sequence.`, "INVALID_INPUT");
  if (!/^[A-Z*.-]+$/.test(sequence)) throw new BiologicalAdapterError(`${label} contains characters outside the biological alphabet.`, "INVALID_INPUT");
  if (sequence.length > MAX_SEQUENCE_LENGTH) throw new BiologicalAdapterError(`${label} exceeds the bounded ${MAX_SEQUENCE_LENGTH.toLocaleString()} residue limit.`, "INVALID_INPUT");
  return sequence;
};

const parseFasta = (content: string): SequenceRecord[] => {
  const records: SequenceRecord[] = [];
  let current: { header: string; sequence: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const header = current.header.trim();
    const [id, ...description] = header.split(/\s+/);
    if (!id) throw new BiologicalAdapterError("FASTA header is missing an identifier.", "INVALID_INPUT");
    records.push({ id, description: description.join(" "), sequence: normalizeSequence(current.sequence.join(""), `FASTA record ${id}`) });
    current = null;
  };
  for (const line of content.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith(">")) {
      flush();
      current = { header: line.slice(1), sequence: [] };
    } else {
      if (!current) throw new BiologicalAdapterError("FASTA sequence data appeared before the first header.", "INVALID_INPUT");
      current.sequence.push(line.trim());
    }
    if (records.length > MAX_SEQUENCE_RECORDS) throw new BiologicalAdapterError("FASTA contains too many records for the bounded viewer.", "INVALID_INPUT");
  }
  flush();
  if (!records.length) throw new BiologicalAdapterError("No FASTA records were found.", "INVALID_INPUT");
  return records;
};

const parseFastq = (content: string): SequenceRecord[] => {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line, index, all) => !(index === all.length - 1 && !line));
  if (lines.length < 4 || lines.length % 4 !== 0) throw new BiologicalAdapterError("FASTQ input must contain complete four-line records.", "INVALID_INPUT");
  const records: SequenceRecord[] = [];
  for (let index = 0; index < lines.length; index += 4) {
    const header = lines[index]!.startsWith("@") ? lines[index]!.slice(1).trim() : "";
    if (!header || !lines[index + 2]!.startsWith("+")) throw new BiologicalAdapterError(`FASTQ record ${index / 4 + 1} has an invalid header or separator.`, "INVALID_INPUT");
    const [id, ...description] = header.split(/\s+/);
    const sequence = normalizeSequence(lines[index + 1]!, `FASTQ record ${id}`);
    const quality = [...lines[index + 3]!].map((character) => character.charCodeAt(0) - 33);
    if (quality.length !== sequence.length || quality.some((value) => value < 0 || value > 93)) throw new BiologicalAdapterError(`FASTQ record ${id} has quality data that does not match its sequence.`, "INVALID_INPUT");
    records.push({ id: id!, description: description.join(" "), sequence, quality });
  }
  return records;
};

const parseGenbank = (content: string): SequenceRecord[] => {
  const origin = content.match(/(?:^|\n)ORIGIN[^\n]*\n([\s\S]*?)(?:\n\/\/|\/\/)/i)?.[1] ?? "";
  const sequence = origin.replace(/[^A-Za-z]/g, "");
  if (!sequence) throw new BiologicalAdapterError("GenBank input has no ORIGIN sequence.", "INVALID_INPUT");
  const locus = content.match(/^LOCUS\s+(\S+)(?:\s+(.+))?$/im);
  return [{ id: locus?.[1] ?? "genbank-record", description: locus?.[2]?.trim() ?? "", sequence: normalizeSequence(sequence, "GenBank ORIGIN") }];
};

const parseEmbl = (content: string): SequenceRecord[] => {
  const sequence = (content.match(/^SQ[^\n]*\n([\s\S]*?)(?:\n\/\/|\/\/)/im)?.[1] ?? "").replace(/[^A-Za-z]/g, "");
  if (!sequence) throw new BiologicalAdapterError("EMBL input has no SQ sequence.", "INVALID_INPUT");
  const id = content.match(/^ID\s+([^;\s]+)/im)?.[1] ?? "embl-record";
  return [{ id, description: "", sequence: normalizeSequence(sequence, "EMBL SQ") }];
};

const parseDx = (content: string): MapGrid => {
  const countsMatch = content.match(/gridpositions\s+counts\s+(\d+)\s+(\d+)\s+(\d+)/i);
  const originMatch = content.match(/^origin\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/im);
  const deltas = [...content.matchAll(/^delta\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/gim)].map((match) => [Number(match[1]), Number(match[2]), Number(match[3])] as const);
  if (!countsMatch || !originMatch || deltas.length < 3) throw new BiologicalAdapterError("OpenDX input requires grid counts, origin, and three delta vectors.", "INVALID_INPUT");
  const dimensions = [Number(countsMatch[1]), Number(countsMatch[2]), Number(countsMatch[3])] as const;
  const valueCount = dimensions[0] * dimensions[1] * dimensions[2];
  if (!Number.isSafeInteger(valueCount) || valueCount < 1 || valueCount > MAX_MAP_VALUES) throw new BiologicalAdapterError(`OpenDX grid exceeds the bounded ${MAX_MAP_VALUES.toLocaleString()} value limit.`, "INVALID_INPUT");
  const dataStart = content.search(/data\s+follows/i);
  if (dataStart < 0) throw new BiologicalAdapterError("OpenDX input has no data follows section.", "INVALID_INPUT");
  const raw = content.slice(dataStart).replace(/^data\s+follows/i, "").match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  const values = raw.slice(0, valueCount).map(Number);
  if (values.some((value) => !Number.isFinite(value))) throw new BiologicalAdapterError("OpenDX contains a non-numeric density value.", "INVALID_INPUT");
  if (!values.length) throw new BiologicalAdapterError("OpenDX data follows section is empty.", "INVALID_INPUT");
  const min = Math.min(...values); const max = Math.max(...values); const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { dimensions, origin: [Number(originMatch[1]), Number(originMatch[2]), Number(originMatch[3])], spacing: [Math.hypot(...deltas[0]!), Math.hypot(...deltas[1]!), Math.hypot(...deltas[2]!)], values, valueRange: { min, max, mean }, valueCount, dataComplete: values.length === valueCount };
};

const readI32 = (view: DataView, offset: number, little: boolean) => view.getInt32(offset, little);
const readF32 = (view: DataView, offset: number, little: boolean) => view.getFloat32(offset, little);

const parseMrc = (buffer: ArrayBuffer): MapGrid => {
  if (buffer.byteLength < 1024) throw new BiologicalAdapterError("MRC/CCP4 input is shorter than its 1024-byte header.", "INVALID_INPUT");
  const view = new DataView(buffer);
  const plausible = (little: boolean) => {
    const nx = readI32(view, 0, little); const ny = readI32(view, 4, little); const nz = readI32(view, 8, little); const mode = readI32(view, 12, little);
    return nx > 0 && ny > 0 && nz > 0 && nx <= 10000 && ny <= 10000 && nz <= 10000 && [0, 1, 2, 6].includes(mode);
  };
  const little = plausible(true) ? true : plausible(false) ? false : (() => { throw new BiologicalAdapterError("MRC/CCP4 header endianness or mode is not supported.", "INVALID_INPUT"); })();
  const nx = readI32(view, 0, little); const ny = readI32(view, 4, little); const nz = readI32(view, 8, little); const mode = readI32(view, 12, little);
  const mx = readI32(view, 28, little) || nx; const my = readI32(view, 32, little) || ny; const mz = readI32(view, 36, little) || nz;
  const cell = [readF32(view, 40, little), readF32(view, 44, little), readF32(view, 48, little)];
  const origin = [readF32(view, 196, little), readF32(view, 200, little), readF32(view, 204, little)];
  const nsymbt = Math.max(0, readI32(view, 92, little));
  const bytesPerValue = mode === 0 ? 1 : mode === 1 || mode === 6 ? 2 : 4;
  const valueCount = nx * ny * nz; const offset = 1024 + nsymbt;
  if (offset + valueCount * bytesPerValue > buffer.byteLength) throw new BiologicalAdapterError("MRC/CCP4 density payload is incomplete.", "INVALID_INPUT");
  const values: number[] = [];
  for (let index = 0; index < valueCount; index += 1) {
    const byteOffset = offset + index * bytesPerValue;
    values.push(mode === 0 ? view.getInt8(byteOffset) : mode === 1 ? view.getInt16(byteOffset, little) : mode === 6 ? view.getUint16(byteOffset, little) : readF32(view, byteOffset, little));
  }
  const finite = values.filter(Number.isFinite); if (finite.length !== values.length) throw new BiologicalAdapterError("MRC/CCP4 density payload contains non-finite values.", "INVALID_INPUT");
  const min = Math.min(...values); const max = Math.max(...values); const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { dimensions: [nx, ny, nz], origin: [origin[0], origin[1], origin[2]].map((value) => Number.isFinite(value) ? value : 0) as [number, number, number], spacing: [cell[0] / mx || 1, cell[1] / my || 1, cell[2] / mz || 1], values, valueRange: { min, max, mean }, valueCount, dataComplete: true };
};

const parseXyzTrajectory = (content: string): TrajectoryFrame[] => {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const frames: TrajectoryFrame[] = []; let cursor = 0; let atomCount: number | null = null;
  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor]!.trim()) cursor += 1;
    if (cursor >= lines.length) break;
    const count = Number.parseInt(lines[cursor]!.trim(), 10); if (!Number.isInteger(count) || count < 1) throw new BiologicalAdapterError(`XYZ trajectory frame ${frames.length + 1} has an invalid atom count.`, "INVALID_INPUT");
    if (atomCount === null) atomCount = count; else if (count !== atomCount) throw new BiologicalAdapterError("XYZ trajectory frames must have identical atom counts.", "INVALID_INPUT");
    const label = lines[cursor + 1]?.trim() || `Frame ${frames.length + 1}`; const atoms: TrajectoryAtom[] = [];
    for (let index = 0; index < count; index += 1) {
      const fields = lines[cursor + 2 + index]?.trim().split(/\s+/) ?? [];
      if (fields.length < 4 || !/^[A-Za-z]{1,3}$/.test(fields[0] ?? "")) throw new BiologicalAdapterError(`XYZ trajectory frame ${frames.length + 1} atom ${index + 1} is invalid.`, "INVALID_INPUT");
      const coordinates = fields.slice(1, 4).map(Number); if (coordinates.some((value) => !Number.isFinite(value))) throw new BiologicalAdapterError(`XYZ trajectory frame ${frames.length + 1} has a non-finite coordinate.`, "INVALID_INPUT");
      atoms.push({ index, element: fields[0]!.toUpperCase(), x: coordinates[0]!, y: coordinates[1]!, z: coordinates[2]! });
    }
    frames.push({ index: frames.length, label, atoms }); cursor += count + 2;
  }
  if (frames.length < 2) throw new BiologicalAdapterError("A trajectory requires at least two XYZ coordinate frames.", "INVALID_INPUT");
  return frames;
};

const parseGro = (content: string): TrajectoryFrame[] => {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/); if (lines.length < 3) throw new BiologicalAdapterError("GRO input is incomplete.", "INVALID_INPUT");
  const count = Number.parseInt(lines[1]!.trim(), 10); if (!Number.isInteger(count) || count < 1 || lines.length < count + 3) throw new BiologicalAdapterError("GRO atom count or atom block is invalid.", "INVALID_INPUT");
  const atoms: TrajectoryAtom[] = [];
  for (let index = 0; index < count; index += 1) {
    const line = lines[index + 2]!; const residue = line.slice(0, 5).trim(); const name = line.slice(10, 15).trim() || line.slice(15, 20).trim(); const x = Number(line.slice(20, 28)); const y = Number(line.slice(28, 36)); const z = Number(line.slice(36, 44));
    if (![x, y, z].every(Number.isFinite)) throw new BiologicalAdapterError(`GRO atom ${index + 1} has invalid coordinates.`, "INVALID_INPUT");
    atoms.push({ index, element: (name.match(/[A-Za-z]+/)?.[0] ?? "X").slice(0, 2).toUpperCase(), name, residue, x: x * 10, y: y * 10, z: z * 10 });
  }
  return [{ index: 0, label: lines[0]!.trim() || "GRO frame", atoms }];
};

const parseDcdHeader = (buffer: ArrayBuffer): { frameCount: number; atomCount: number } => {
  if (buffer.byteLength < 32) throw new BiologicalAdapterError("DCD input is shorter than its header.", "INVALID_INPUT");
  const view = new DataView(buffer); const little = view.getInt32(0, true) === 84 ? true : view.getInt32(0, false) === 84 ? false : null;
  if (little === null || String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7)) !== "CORD") throw new BiologicalAdapterError("DCD header signature is not recognized.", "INVALID_INPUT");
  const frameCount = view.getInt32(8, little); let offset = 4 + view.getInt32(0, little) + 4;
  if (offset + 8 > buffer.byteLength) throw new BiologicalAdapterError("DCD title block is missing.", "INVALID_INPUT");
  const titleBytes = view.getInt32(offset, little); offset += 4 + titleBytes + 4;
  if (offset + 8 > buffer.byteLength) throw new BiologicalAdapterError("DCD atom-count block is missing.", "INVALID_INPUT");
  const atomBytes = view.getInt32(offset, little); if (atomBytes < 4 || offset + atomBytes + 8 > buffer.byteLength) throw new BiologicalAdapterError("DCD atom-count block is invalid.", "INVALID_INPUT");
  const atomCount = view.getInt32(offset + 4, little); if (frameCount < 1 || atomCount < 1) throw new BiologicalAdapterError("DCD header declares no frames or atoms.", "INVALID_INPUT");
  return { frameCount, atomCount };
};

const parseResearchTrajectoryHeader = (buffer: ArrayBuffer, format: "xtc" | "trr"): number => {
  if (buffer.byteLength < 4) throw new BiologicalAdapterError(`${format.toUpperCase()} input is shorter than its binary header.`, "INVALID_INPUT");
  const view = new DataView(buffer);
  const magic = view.getInt32(0, false);
  const expected = format === "xtc" ? 1995 : 1993;
  if (magic !== expected) throw new BiologicalAdapterError(`${format.toUpperCase()} header magic is not recognized.`, "INVALID_INPUT");
  return magic;
};

const parsePsf = (content: string): { atomCount: number; bondCount: number | null; residueCount: number | null } => {
  const atomMatch = content.match(/\n\s*(\d+)\s+!NATOM/i); if (!atomMatch) throw new BiologicalAdapterError("PSF input has no !NATOM section.", "INVALID_INPUT");
  const atomCount = Number(atomMatch[1]); const bondMatch = content.match(/\n\s*(\d+)\s+!NBOND/i); const bondCount = bondMatch ? Number(bondMatch[1]) : null;
  const atomStart = content.indexOf(atomMatch[0]) + atomMatch[0].length; const atomLines = content.slice(atomStart).split(/\r?\n/).slice(0, atomCount); const residues = new Set(atomLines.map((line) => line.trim().split(/\s+/)[2]).filter(Boolean));
  return { atomCount, bondCount, residueCount: residues.size || null };
};

const parsePrmtop = (content: string): { atomCount: number; bondCount: number | null; residueCount: number | null } => {
  const pointerBlock = content.match(/%FLAG POINTERS[\s\S]*?%FLAG/i)?.[0] ?? ""; const values = pointerBlock.replace(/%FLAG POINTERS|%FORMAT[^\n]*/gi, "").match(/[-+]?\d+/g)?.map(Number) ?? [];
  if (!values.length) throw new BiologicalAdapterError("AMBER PRMTOP input has no POINTERS section.", "INVALID_INPUT");
  const atomCount = values[0] ?? 0; const residueCount = values[11] ?? null; const bondCount = values[2] !== undefined && values[3] !== undefined ? Math.floor((values[2] + values[3]) / 3) : null;
  if (atomCount < 1) throw new BiologicalAdapterError("AMBER PRMTOP declares no atoms.", "INVALID_INPUT");
  return { atomCount, residueCount: residueCount && residueCount > 0 ? residueCount : null, bondCount };
};

export const detectBiologicalFormat = (filename: string, content = ""): BiologicalFormat | null => {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const byExtension: Record<string, BiologicalFormat> = { fasta: "fasta", fa: "fasta", fna: "fasta", faa: "fasta", fastq: "fastq", fq: "fastq", gb: "genbank", gbk: "genbank", genbank: "genbank", embl: "embl", emb: "embl", dx: "dx", mrc: "mrc", map: "mrc", ccp4: "ccp4", xyztrajectory: "xyz-trajectory", "xyz-trajectory": "xyz-trajectory", dcd: "dcd", xtc: "xtc", trr: "trr", gro: "gro", psf: "psf", prmtop: "prmtop", prm7: "prmtop", smiles: "smiles", smi: "smiles" };
  if (byExtension[extension]) return byExtension[extension];
  if (/^\s*>/m.test(content)) return "fasta";
  if (/^\s*@[^\n]+\n[^\n]+\n\+\s*$/m.test(content)) return "fastq";
  if (/gridpositions\s+counts/i.test(content) && /data\s+follows/i.test(content)) return "dx";
  const smilesCandidate = content.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("#"));
  const smilesNotation = smilesCandidate?.includes("\t") ? smilesCandidate.split(/\t+/, 2)[1] : smilesCandidate?.split(/\s+/, 2)[0];
  const looksLikeSmiles = Boolean(smilesNotation && (/[-[\]=#()@+]/.test(smilesNotation) || /^(?:Cl|Br|[BCNOFPSI]|[cnops]|\d+)+$/.test(smilesNotation)));
  if (looksLikeSmiles && !/^(ATOM|HETATM|data_|@<TRIPOS>)/m.test(content)) return "smiles";
  return null;
};

export const parseBiologicalData = (filename: string, input: string | ArrayBuffer, forcedFormat?: BiologicalFormat): BiologicalData => {
  const format = forcedFormat ?? detectBiologicalFormat(filename, typeof input === "string" ? input : "");
  if (!format) throw new BiologicalAdapterError(`No biological adapter recognizes ${filename}.`, "UNSUPPORTED_FORMAT");
  const sourceName = filename;
  if (format === "fasta") { const records = parseFasta(String(input)); return { kind: "SEQUENCE", format, sourceName, records, alphabet: alphabetFor(records) }; }
  if (format === "fastq") { const records = parseFastq(String(input)); return { kind: "SEQUENCE_QUALITY", format, sourceName, records, alphabet: alphabetFor(records) }; }
  if (format === "genbank") { const records = parseGenbank(String(input)); return { kind: "SEQUENCE", format, sourceName, records, alphabet: alphabetFor(records) }; }
  if (format === "embl") { const records = parseEmbl(String(input)); return { kind: "SEQUENCE", format, sourceName, records, alphabet: alphabetFor(records) }; }
  if (format === "dx") return { kind: "MAP", format, sourceName, grid: parseDx(String(input)), encoding: "ASCII_DX" };
  if (format === "mrc" || format === "ccp4") { if (typeof input === "string") throw new BiologicalAdapterError("MRC/CCP4 adapters require binary file bytes.", "INVALID_INPUT"); return { kind: "MAP", format, sourceName, grid: parseMrc(input), encoding: "MRC_BINARY" }; }
  if (format === "xyz-trajectory") { const frames = parseXyzTrajectory(String(input)); return { kind: "TRAJECTORY", format, sourceName, frames, atomCount: frames[0]!.atoms.length, status: "READY" }; }
  if (format === "gro") { const frames = parseGro(String(input)); return { kind: "TRAJECTORY", format, sourceName, frames, atomCount: frames[0]!.atoms.length, status: "READY" }; }
  if (format === "dcd") { if (typeof input === "string") throw new BiologicalAdapterError("DCD adapters require binary file bytes.", "INVALID_INPUT"); const header = parseDcdHeader(input); return { kind: "TRAJECTORY", format, sourceName, frames: [], atomCount: header.atomCount, status: "HEADER_ONLY", diagnostic: `DCD header verified: ${header.frameCount.toLocaleString()} frames and ${header.atomCount.toLocaleString()} atoms. Coordinate frame decoding is not enabled in this build.` }; }
  if (format === "xtc" || format === "trr") { parseResearchTrajectoryHeader(typeof input === "string" ? (() => { throw new BiologicalAdapterError(`${format.toUpperCase()} adapters require binary file bytes.`, "INVALID_INPUT"); })() : input, format); return { kind: "TRAJECTORY", format, sourceName, frames: [], atomCount: 0, status: "HEADER_ONLY", diagnostic: `${format.toUpperCase()} header verified; compressed/binary coordinate decoding is not enabled in this build.` }; }
  if (format === "psf") { const result = parsePsf(String(input)); return { kind: "TOPOLOGY", format, sourceName, ...result, status: "READY" }; }
  if (format === "prmtop") { const result = parsePrmtop(String(input)); return { kind: "TOPOLOGY", format, sourceName, ...result, status: "READY" }; }
  const records = String(input).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((notation, index) => { const [name, value] = notation.includes("\t") ? notation.split(/\t+/, 2) : notation.split(/\s+/, 2); return { id: `smiles-${index + 1}`, notation: value ?? name!, ...(value ? { name } : {}) }; });
  if (!records.length || records.some((record) => !record.notation)) throw new BiologicalAdapterError("SMILES input is empty.", "INVALID_INPUT");
  if (records.some((record) => !(/[-[\]=#()@+]/.test(record.notation) || /^(?:Cl|Br|[BCNOFPSI]|[cnops]|\d+)+$/.test(record.notation)))) throw new BiologicalAdapterError("SMILES input contains notation outside the supported atom and bond syntax.", "INVALID_INPUT");
  return { kind: "SMILES", format: "smiles", sourceName, records };
};

/** A trajectory-specific XYZ alias is detected only when two or more frames exist. */
export const isMultiFrameXyz = (content: string): boolean => {
  try { return parseXyzTrajectory(content).length > 1; } catch { return false; }
};
