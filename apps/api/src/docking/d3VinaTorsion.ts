import {
  D2_SCHEMA_VERSION,
  D2_SUPPORTED_CORE_ELEMENTS,
  D3_VINA_TORSION_PROFILE_ID,
  D3_VINA_TORSION_PROFILE_SOURCE,
  D3_VINA_TORSION_SCHEMA_VERSION,
  f64Bits,
  sha256Digest,
  scientificId,
  type ArtifactByteDigest,
  type D2AtomUID,
  type D2GraphAtomV1,
  type D2GraphBondV1,
  type D2MolecularGraphRevisionV1,
  type D3VinaAtomMappingDigest,
  type D3VinaAuthoritativeAtomMappingV1,
  type D3VinaDiagnostic,
  type D3VinaPdbqtAtomV1,
  type D3VinaPdbqtEvidenceV1,
  type D3VinaProducerProvenanceV1,
  type D3VinaRawBranchV1,
  type D3VinaScorerBondAssignmentV1,
  type D3VinaScorerTorsionAssignmentV1,
  type D3VinaSearchAxisV1,
  type D3VinaSearchTopologyV1,
  type D3VinaTorsionProfileDigest,
  type D3VinaTorsionSealResult,
  type SourceArtifact,
} from "@molecular/contracts";
import { scientificDigest, artifactByteDigest } from "./scientificSerialization.js";

const MAX_PDBQT_BYTES = 5_000_000;
const MAX_PDBQT_LINES = 200_000;
const MAX_PDBQT_LINE_LENGTH = 512;
const MAX_RAW_TORSDOF = 1_000_000;
const HALF = f64Bits(0.5);
const ZERO = f64Bits(0);
const ONE = f64Bits(1);
const SUPPORTED_ELEMENTS = new Set<string>(D2_SUPPORTED_CORE_ELEMENTS);
const ATOM_TYPE_ELEMENT: Readonly<Record<string, string>> = Object.freeze({
  A: "C", C: "C", N: "N", NA: "N", O: "O", OA: "O", S: "S", SA: "S", P: "P",
  F: "F", CL: "CL", BR: "BR", I: "I", H: "H", HD: "H",
});

export const D3_VINA_TORSION_PROFILE_V1 = Object.freeze({
  schemaVersion: D3_VINA_TORSION_SCHEMA_VERSION,
  semanticSchemaId: "D3_VINA_TORSION_PROFILE_V1",
  profileId: D3_VINA_TORSION_PROFILE_ID,
  source: D3_VINA_TORSION_PROFILE_SOURCE,
  torsdofMeaning: "PRESERVED_RAW_INPUT_ONLY",
  branchMeaning: "ORDERED_RAW_TOPOLOGY_WITH_EMPTY_BRANCH_FILTER_FOR_SEARCH_AXES",
  searchAxisRule: "A_BRANCH_IS_ACTIVE_IF_ITS_SUBTREE_HAS_AT_LEAST_ONE_ATOM_OTHER_THAN_ITS_IMMOBILE_AXIS_ENDPOINT",
  scorerEndpointRule: "FOR_EACH_ACTIVE_HEAVY_HEAVY_ROTOR_ENDPOINT_ADD_0_5_IF_THE_PARTNER_HAS_MORE_THAN_ONE_HEAVY_GRAPH_NEIGHBOR",
  scorerTorsionUnit: HALF,
  allowedBondContributions: [ZERO, HALF, ONE] as const,
  canonicalizationProfile: "ME_CANONICAL_CBOR_V1_1_0",
} as const);

export const D3_VINA_TORSION_PROFILE_DIGEST: D3VinaTorsionProfileDigest = scientificDigest<"ProfileDigest">(
  "D3_VINA_TORSION_PROFILE",
  "D3_VINA_TORSION_PROFILE_V1",
  D3_VINA_TORSION_PROFILE_V1,
);

export type D3VinaImportedRepresentationV1 = Readonly<{
  sourceEvidence: D3VinaPdbqtEvidenceV1;
  searchTopology: D3VinaSearchTopologyV1;
  scorerTorsionAssignment: D3VinaScorerTorsionAssignmentV1;
}>;

export type D3VinaAtomMappingInput = Readonly<{
  graph: D2MolecularGraphRevisionV1;
  representationArtifactDigest: ArtifactByteDigest;
  serialToAtomUid: Readonly<Record<string, D2AtomUID>>;
  evidenceRefs: readonly string[];
}>;

export type D3VinaPdbqtImportInput = Readonly<{
  bytes: Uint8Array;
  sourceArtifact: SourceArtifact;
  graph: D2MolecularGraphRevisionV1;
  mapping: D3VinaAuthoritativeAtomMappingV1;
  producer: D3VinaProducerProvenanceV1;
}>;

type ParsedAtom = {
  serial: number;
  element: string;
  atomType: string;
  x: number;
  y: number;
  z: number;
  line: number;
  branchOrdinal: number | null;
};

type MutableBranch = {
  ordinal: number;
  parentOrdinal: number | null;
  fromSerial: number;
  toSerial: number;
  startLine: number;
  endLine?: number;
  rawStartRecord: string;
  rawEndRecord?: string;
  directAtomSerials: number[];
};

type ParsedPdbqt = Readonly<{
  atoms: readonly ParsedAtom[];
  rootAtomSerials: readonly number[];
  branches: readonly MutableBranch[];
  torsdof: number;
}>;

const d3Error = (code: string, message: string, path?: string): D3VinaDiagnostic => ({
  code, severity: "ERROR", blocking: true, message, ...(path ? { path } : {}),
});
const d3Warning = (code: string, message: string, path?: string): D3VinaDiagnostic => ({
  code, severity: "WARNING", blocking: false, message, ...(path ? { path } : {}),
});
const fail = <T>(diagnostic: D3VinaDiagnostic, status: D3VinaTorsionSealResult<T>["status"] = "INVALID"): D3VinaTorsionSealResult<T> => ({ status, diagnostics: [diagnostic] });
const valid = <T>(value: T, diagnostics: readonly D3VinaDiagnostic[] = []): D3VinaTorsionSealResult<T> => ({ status: "VALID", value, diagnostics });
const isSha256 = (value: string): boolean => /^sha256:[0-9a-f]{64}$/.test(value);
const uidCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const graphPayload = (graph: D2MolecularGraphRevisionV1) => ({
  schemaVersion: graph.schemaVersion,
  semanticSchemaId: graph.semanticSchemaId,
  atoms: graph.atoms,
  bonds: graph.bonds,
  components: graph.components,
  sourceArtifactIds: graph.sourceArtifactIds,
});

const verifyGraph = (graph: D2MolecularGraphRevisionV1): D3VinaDiagnostic | undefined => {
  if (graph.schemaVersion !== D2_SCHEMA_VERSION || graph.semanticSchemaId !== "D2_MOLECULAR_GRAPH_REVISION_V1") {
    return d3Error("D3_GRAPH_SCHEMA_UNSUPPORTED", "The authoritative graph must be a supported D2 molecular graph revision.", "graph");
  }
  if (!isSha256(graph.digest)) return d3Error("D3_GRAPH_DIGEST_INVALID", "The authoritative graph digest is not a valid SHA-256 reference.", "graph.digest");
  const recomputed = scientificDigest<"MolecularIdentityDigest">("D2_MOLECULAR_GRAPH", "D2_MOLECULAR_GRAPH_REVISION_V1", graphPayload(graph));
  if (recomputed !== graph.digest) return d3Error("D3_GRAPH_DIGEST_MISMATCH", "The supplied graph content does not match its D2 graph digest.", "graph.digest");
  const atomUids = new Set<string>();
  for (const atom of graph.atoms) {
    if (!atom.atomUid || atomUids.has(atom.atomUid)) return d3Error("D3_GRAPH_ATOM_UID_AMBIGUOUS", "The authoritative graph contains an empty or duplicate AtomUID.", "graph.atoms");
    if (!SUPPORTED_ELEMENTS.has(atom.element.toUpperCase())) return d3Error("D3_CHEMISTRY_UNSUPPORTED", `Element ${atom.element} is outside the D3-TOR-01 compatibility boundary.`, "graph.atoms");
    atomUids.add(atom.atomUid);
  }
  const bondKeys = new Set<string>();
  for (const bond of graph.bonds) {
    if (!atomUids.has(bond.atom1Uid) || !atomUids.has(bond.atom2Uid) || bond.atom1Uid === bond.atom2Uid) {
      return d3Error("D3_GRAPH_BOND_INVALID", "The authoritative graph contains a bond with an invalid atom reference.", "graph.bonds");
    }
    const key = edgeKey(bond.atom1Uid, bond.atom2Uid);
    if (bondKeys.has(key)) return d3Error("D3_GRAPH_BOND_AMBIGUOUS", "The authoritative graph contains multiple bonds between the same atom pair.", "graph.bonds");
    bondKeys.add(key);
  }
  return undefined;
};

const mappingPayload = (input: Omit<D3VinaAtomMappingInput, "graph"> & { graphRevisionDigest: D2MolecularGraphRevisionV1["digest"] }) => ({
  schemaVersion: D3_VINA_TORSION_SCHEMA_VERSION,
  semanticSchemaId: "D3_VINA_AUTHORITATIVE_ATOM_MAPPING_V1" as const,
  graphRevisionDigest: input.graphRevisionDigest,
  representationArtifactDigest: input.representationArtifactDigest,
  serialToAtomUid: Object.fromEntries(Object.entries(input.serialToAtomUid).sort(([left], [right]) => Number(left) - Number(right))),
  evidenceRefs: [...input.evidenceRefs],
});

export const sealD3VinaAuthoritativeAtomMapping = (
  input: D3VinaAtomMappingInput,
): D3VinaTorsionSealResult<D3VinaAuthoritativeAtomMappingV1> => {
  const graphError = verifyGraph(input.graph);
  if (graphError) return fail(graphError, graphError.code.includes("UNSUPPORTED") ? "UNSUPPORTED" : "INVALID");
  if (!isSha256(input.representationArtifactDigest)) return fail(d3Error("D3_MAPPING_SOURCE_DIGEST_INVALID", "The PDBQT representation digest must be a SHA-256 reference."), "INVALID");
  if (!input.evidenceRefs.length || input.evidenceRefs.some((ref) => !ref.trim())) {
    return fail(d3Error("D3_MAPPING_PROVENANCE_MISSING", "An authoritative atom mapping requires at least one non-empty provenance reference."), "AMBIGUOUS");
  }
  const atomUids = new Set(input.graph.atoms.map((atom) => atom.atomUid));
  const seenUids = new Set<string>();
  for (const [serial, atomUid] of Object.entries(input.serialToAtomUid)) {
    if (!/^[1-9]\d*$/.test(serial) || !Number.isSafeInteger(Number(serial))) return fail(d3Error("D3_MAPPING_SERIAL_INVALID", `Atom serial key ${serial} is not a positive canonical integer.`, `mapping.serialToAtomUid.${serial}`));
    if (!atomUids.has(atomUid)) return fail(d3Error("D3_MAPPING_ATOM_UID_UNKNOWN", `AtomUID ${atomUid} is absent from the authoritative graph.`, `mapping.serialToAtomUid.${serial}`), "AMBIGUOUS");
    if (seenUids.has(atomUid)) return fail(d3Error("D3_MAPPING_ATOM_UID_AMBIGUOUS", `More than one PDBQT serial maps to AtomUID ${atomUid}.`, `mapping.serialToAtomUid.${serial}`), "AMBIGUOUS");
    seenUids.add(atomUid);
  }
  const payload = mappingPayload({ ...input, graphRevisionDigest: input.graph.digest });
  const digest = scientificDigest<"ProvenanceRecordDigest">("D3_VINA_ATOM_MAPPING", "D3_VINA_AUTHORITATIVE_ATOM_MAPPING_V1", payload) as D3VinaAtomMappingDigest;
  return valid(Object.freeze({ status: "AUTHORITATIVE", ...payload, digest }));
};

const edgeKey = (left: string, right: string): string => left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;

const parseAtom = (line: string, lineNumber: number, branchOrdinal: number | null): ParsedAtom | D3VinaDiagnostic => {
  if (line.length < 54) return d3Error("D3_PDBQT_ATOM_TRUNCATED", `PDBQT atom record on line ${lineNumber} is shorter than its required coordinate fields.`, `line:${lineNumber}`);
  const serialField = line.slice(6, 11);
  const serialText = serialField.trim();
  const serialFieldValid = /^ *[0-9]+ *$/.test(serialField);
  const serial = serialFieldValid ? Number(serialText) : Number.NaN;
  const x = Number(line.slice(30, 38).trim());
  const y = Number(line.slice(38, 46).trim());
  const z = Number(line.slice(46, 54).trim());
  const fields = line.trim().split(/\s+/);
  const atomType = (fields.at(-1) ?? "").toUpperCase();
  const element = ATOM_TYPE_ELEMENT[atomType];
  if (!serialFieldValid || !Number.isSafeInteger(serial) || serial <= 0) return d3Error("D3_PDBQT_ATOM_SERIAL_INVALID", `PDBQT atom record on line ${lineNumber} has an invalid serial.`, `line:${lineNumber}`);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return d3Error("D3_PDBQT_COORDINATE_INVALID", `PDBQT atom record on line ${lineNumber} has a missing, malformed, or non-finite coordinate.`, `line:${lineNumber}`);
  if (!element || !SUPPORTED_ELEMENTS.has(element)) return d3Error("D3_CHEMISTRY_UNSUPPORTED", `AutoDock atom type ${atomType || "<missing>"} on line ${lineNumber} is outside the supported D3-TOR-01 chemistry boundary.`, `line:${lineNumber}`);
  return { serial, element, atomType, x, y, z, line: lineNumber, branchOrdinal };
};

const parseBranchPair = (line: string, keyword: "BRANCH" | "ENDBRANCH", lineNumber: number): readonly [number, number] | D3VinaDiagnostic => {
  const match = new RegExp(`^${keyword}\\s+([0-9]+)\\s+([0-9]+)\\s*$`, "i").exec(line.trim());
  if (!match) return d3Error("D3_PDBQT_BRANCH_RECORD_INVALID", `PDBQT ${keyword} record on line ${lineNumber} must contain exactly two unsigned atom serials.`, `line:${lineNumber}`);
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second) || first <= 0 || second <= 0 || first === second) {
    return d3Error("D3_PDBQT_BRANCH_AXIS_INVALID", `PDBQT ${keyword} record on line ${lineNumber} has an invalid axis pair.`, `line:${lineNumber}`);
  }
  return [first, second];
};

const parsePdbqt = (bytes: Uint8Array): D3VinaTorsionSealResult<ParsedPdbqt> => {
  if (bytes.byteLength === 0) return fail(d3Error("D3_PDBQT_EMPTY", "PDBQT source bytes are empty."));
  if (bytes.byteLength > MAX_PDBQT_BYTES) return fail(d3Error("D3_RESOURCE_BYTES", `PDBQT source exceeds the ${MAX_PDBQT_BYTES}-byte compatibility boundary.`), "RESOURCE_REJECTED");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return fail(d3Error("D3_PDBQT_UTF8_INVALID", "PDBQT source is not valid UTF-8.")); }
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_PDBQT_LINES) return fail(d3Error("D3_RESOURCE_LINES", `PDBQT source exceeds the ${MAX_PDBQT_LINES}-line compatibility boundary.`), "RESOURCE_REJECTED");
  const atoms: ParsedAtom[] = [];
  const serials = new Set<number>();
  const rootAtomSerials: number[] = [];
  const rootScope = new Set<number>();
  const branches: MutableBranch[] = [];
  const stack: MutableBranch[] = [];
  const scopeSerials: Array<Set<number>> = [rootScope];
  let rootSeen = false;
  let rootOpen = false;
  let rootClosed = false;
  let torsdof: number | undefined;
  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    if (rawLine.length > MAX_PDBQT_LINE_LENGTH) return fail(d3Error("D3_RESOURCE_LINE_LENGTH", `PDBQT line ${lineNumber} exceeds ${MAX_PDBQT_LINE_LENGTH} characters.`, `line:${lineNumber}`), "RESOURCE_REJECTED");
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const keyword = trimmed.split(/\s+/, 1)[0]!.toUpperCase();
    if (keyword === "REMARK" || keyword === "WARNING") continue;
    if (keyword === "ROOT") {
      if (trimmed !== "ROOT" || rootSeen || rootOpen || rootClosed || stack.length) return fail(d3Error("D3_PDBQT_ROOT_INVALID", `PDBQT ROOT record on line ${lineNumber} is duplicate or misplaced.`, `line:${lineNumber}`));
      rootSeen = true; rootOpen = true; continue;
    }
    if (keyword === "ENDROOT") {
      if (trimmed !== "ENDROOT" || !rootOpen || !rootAtomSerials.length) return fail(d3Error("D3_PDBQT_ENDROOT_INVALID", `PDBQT ENDROOT record on line ${lineNumber} is unmatched or the root is empty.`, `line:${lineNumber}`));
      rootOpen = false; rootClosed = true; continue;
    }
    if (keyword === "ATOM" || keyword === "HETATM") {
      if (!rootOpen && !stack.length) return fail(d3Error("D3_PDBQT_ATOM_SCOPE_INVALID", `PDBQT atom record on line ${lineNumber} is outside ROOT or BRANCH scope.`, `line:${lineNumber}`));
      const parsed = parseAtom(rawLine, lineNumber, stack.at(-1)?.ordinal ?? null);
      if ("code" in parsed) return fail(parsed, parsed.code === "D3_CHEMISTRY_UNSUPPORTED" ? "UNSUPPORTED" : "INVALID");
      if (serials.has(parsed.serial)) return fail(d3Error("D3_PDBQT_ATOM_SERIAL_DUPLICATE", `PDBQT atom serial ${parsed.serial} occurs more than once.`, `line:${lineNumber}`), "AMBIGUOUS");
      serials.add(parsed.serial);
      atoms.push(parsed);
      if (rootOpen) { rootAtomSerials.push(parsed.serial); rootScope.add(parsed.serial); }
      else {
        const current = stack.at(-1)!;
        current.directAtomSerials.push(parsed.serial);
        scopeSerials.at(-1)!.add(parsed.serial);
      }
      continue;
    }
    if (keyword === "BRANCH") {
      if (!rootClosed || rootOpen || torsdof !== undefined) return fail(d3Error("D3_PDBQT_BRANCH_SCOPE_INVALID", `PDBQT BRANCH record on line ${lineNumber} appears before ENDROOT or after TORSDOF.`, `line:${lineNumber}`));
      const pair = parseBranchPair(rawLine, "BRANCH", lineNumber);
      if ("code" in pair) return fail(pair);
      const [fromSerial, toSerial] = pair;
      if (!scopeSerials.at(-1)!.has(fromSerial)) return fail(d3Error("D3_PDBQT_BRANCH_PARENT_MISSING", `PDBQT BRANCH parent atom ${fromSerial} is not in the current parent scope.`, `line:${lineNumber}`));
      if (branches.some((branch) => edgeKey(String(branch.fromSerial), String(branch.toSerial)) === edgeKey(String(fromSerial), String(toSerial)))) {
        return fail(d3Error("D3_PDBQT_BRANCH_AXIS_DUPLICATE", `PDBQT branch axis ${fromSerial}-${toSerial} is duplicated or contradictory.`, `line:${lineNumber}`), "AMBIGUOUS");
      }
      const branch: MutableBranch = {
        ordinal: branches.length,
        parentOrdinal: stack.at(-1)?.ordinal ?? null,
        fromSerial,
        toSerial,
        startLine: lineNumber,
        rawStartRecord: rawLine,
        directAtomSerials: [],
      };
      branches.push(branch); stack.push(branch); scopeSerials.push(new Set<number>()); continue;
    }
    if (keyword === "ENDBRANCH") {
      const pair = parseBranchPair(rawLine, "ENDBRANCH", lineNumber);
      if ("code" in pair) return fail(pair);
      const branch = stack.at(-1);
      if (!branch || branch.fromSerial !== pair[0] || branch.toSerial !== pair[1]) return fail(d3Error("D3_PDBQT_BRANCH_NESTING_INVALID", `PDBQT ENDBRANCH record on line ${lineNumber} does not close the current innermost branch.`, `line:${lineNumber}`));
      if (!branch.directAtomSerials.includes(branch.toSerial)) return fail(d3Error("D3_PDBQT_BRANCH_ENDPOINT_MISSING", `PDBQT branch endpoint ${branch.toSerial} is absent from its own branch scope.`, `line:${lineNumber}`));
      branch.endLine = lineNumber; branch.rawEndRecord = rawLine; stack.pop(); scopeSerials.pop(); continue;
    }
    if (keyword === "TORSDOF") {
      const match = /^TORSDOF\s+([0-9]+)\s*$/i.exec(trimmed);
      if (stack.length) return fail(d3Error("D3_PDBQT_BRANCH_UNCLOSED", `PDBQT TORSDOF on line ${lineNumber} appears before an open BRANCH was closed.`, `line:${lineNumber}`));
      if (!rootClosed || rootOpen || !match || torsdof !== undefined) return fail(d3Error("D3_PDBQT_TORSDOF_INVALID", `PDBQT TORSDOF record on line ${lineNumber} is malformed, duplicate, or misplaced.`, `line:${lineNumber}`));
      torsdof = Number(match[1]);
      if (!Number.isSafeInteger(torsdof) || torsdof < 0 || torsdof > MAX_RAW_TORSDOF) return fail(d3Error("D3_PDBQT_TORSDOF_INVALID", `PDBQT TORSDOF on line ${lineNumber} is outside the supported nonnegative integer range.`, `line:${lineNumber}`));
      continue;
    }
    return fail(d3Error("D3_PDBQT_RECORD_UNSUPPORTED", `PDBQT record ${keyword} on line ${lineNumber} is outside the D3-TOR-01 representation boundary.`, `line:${lineNumber}`), "UNSUPPORTED");
  }
  if (!rootSeen || !rootClosed || rootOpen) return fail(d3Error("D3_PDBQT_ROOT_UNCLOSED", "PDBQT source must contain one complete non-empty ROOT/ENDROOT block."));
  if (stack.length) return fail(d3Error("D3_PDBQT_BRANCH_UNCLOSED", "PDBQT source ends with an unclosed BRANCH record."));
  if (torsdof === undefined) return fail(d3Error("D3_PDBQT_TORSDOF_MISSING", "PDBQT source must supply exactly one raw TORSDOF value."));
  if (!atoms.length) return fail(d3Error("D3_PDBQT_ATOMS_MISSING", "PDBQT source contains no atom records."));
  if (branches.some((branch) => branch.endLine === undefined || branch.rawEndRecord === undefined)) return fail(d3Error("D3_PDBQT_BRANCH_UNCLOSED", "Every PDBQT BRANCH must have a matching ENDBRANCH."));
  return valid({ atoms, rootAtomSerials, branches, torsdof });
};

const graphBondFor = (graph: D2MolecularGraphRevisionV1, left: D2AtomUID, right: D2AtomUID): D2GraphBondV1 | undefined =>
  graph.bonds.find((bond) => edgeKey(bond.atom1Uid, bond.atom2Uid) === edgeKey(left, right));

const isCyclicBond = (graph: D2MolecularGraphRevisionV1, target: D2GraphBondV1): boolean => {
  const adjacency = new Map<string, string[]>();
  for (const bond of graph.bonds) {
    if (bond.bondUid === target.bondUid) continue;
    const left = adjacency.get(bond.atom1Uid) ?? []; left.push(bond.atom2Uid); adjacency.set(bond.atom1Uid, left);
    const right = adjacency.get(bond.atom2Uid) ?? []; right.push(bond.atom1Uid); adjacency.set(bond.atom2Uid, right);
  }
  const visited = new Set<string>([target.atom1Uid]);
  const queue: string[] = [target.atom1Uid];
  while (queue.length) {
    const uid = queue.shift()!;
    if (uid === target.atom2Uid) return true;
    for (const neighbor of adjacency.get(uid) ?? []) if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
  }
  return false;
};

const verifyMappingDigest = (mapping: D3VinaAuthoritativeAtomMappingV1): boolean => {
  const payload = mappingPayload({
    graphRevisionDigest: mapping.graphRevisionDigest,
    representationArtifactDigest: mapping.representationArtifactDigest,
    serialToAtomUid: mapping.serialToAtomUid,
    evidenceRefs: mapping.evidenceRefs,
  });
  const digest = scientificDigest<"ProvenanceRecordDigest">("D3_VINA_ATOM_MAPPING", "D3_VINA_AUTHORITATIVE_ATOM_MAPPING_V1", payload);
  return digest === mapping.digest;
};

const atomByUid = (graph: D2MolecularGraphRevisionV1): Map<D2AtomUID, D2GraphAtomV1> => new Map(graph.atoms.map((atom) => [atom.atomUid, atom]));

const importFailure = <T>(status: D3VinaTorsionSealResult<T>["status"], code: string, message: string, path?: string): D3VinaTorsionSealResult<T> => fail(d3Error(code, message, path), status);

export const importD3VinaPdbqt = (input: D3VinaPdbqtImportInput): D3VinaTorsionSealResult<D3VinaImportedRepresentationV1> => {
  const graphError = verifyGraph(input.graph);
  if (graphError) return fail(graphError, graphError.code.includes("UNSUPPORTED") ? "UNSUPPORTED" : "INVALID");
  const source = input.sourceArtifact;
  if (source.format !== "pdbqt") return importFailure("INVALID", "D3_SOURCE_FORMAT_MISMATCH", "D3 Vina torsion import requires a PDBQT SourceArtifact.", "sourceArtifact.format");
  if (!Number.isSafeInteger(source.byteLength) || source.byteLength !== input.bytes.byteLength || !/^[0-9a-f]{64}$/.test(source.sha256)) {
    return importFailure("INVALID", "D3_SOURCE_ARTIFACT_INVALID", "SourceArtifact byte length or SHA-256 metadata is invalid for the supplied PDBQT bytes.", "sourceArtifact");
  }
  const sourceDigest = artifactByteDigest(input.bytes);
  const declaredSourceDigest = sha256Digest<"ArtifactByteDigest">(`sha256:${source.sha256}`);
  if (sourceDigest !== declaredSourceDigest) return importFailure("INVALID", "D3_SOURCE_ARTIFACT_DIGEST_MISMATCH", "PDBQT bytes do not match the immutable SourceArtifact digest.", "sourceArtifact.sha256");
  if (input.mapping.status !== "AUTHORITATIVE" || input.mapping.graphRevisionDigest !== input.graph.digest || input.mapping.representationArtifactDigest !== sourceDigest) {
    return importFailure("AMBIGUOUS", "D3_AUTHORITATIVE_MAPPING_REQUIRED", "PDBQT import requires an authoritative mapping bound to this exact graph and representation artifact.", "mapping");
  }
  if (!input.mapping.evidenceRefs.length || input.mapping.evidenceRefs.some((ref) => !ref.trim()) || !verifyMappingDigest(input.mapping)) {
    return importFailure("AMBIGUOUS", "D3_MAPPING_PROVENANCE_INVALID", "Atom mapping evidence is missing or its scientific digest is invalid.", "mapping");
  }
  if (input.producer.status === "KNOWN") {
    if (!input.producer.name.trim() || (input.producer.version !== undefined && !input.producer.version.trim()) || input.producer.settingsRefs.some((ref) => !ref.trim())) {
      return importFailure("INVALID", "D3_PRODUCER_PROVENANCE_INVALID", "Known producer metadata must use non-empty literal values.", "producer");
    }
  } else if (!input.producer.reason.trim() || input.producer.evidenceRefs.some((ref) => !ref.trim())) {
    return importFailure("INVALID", "D3_PRODUCER_PROVENANCE_INVALID", "Unknown producer metadata must state why it is unknown.", "producer");
  }

  const parsed = parsePdbqt(input.bytes);
  if (!parsed.value) return { status: parsed.status, diagnostics: parsed.diagnostics };
  const { atoms: parsedAtoms, rootAtomSerials, branches, torsdof } = parsed.value;
  const graphAtoms = atomByUid(input.graph);
  const graphAtomBySerial = new Map<number, D2GraphAtomV1>();
  const mappedUids = new Set<D2AtomUID>();
  const serialKeys = Object.keys(input.mapping.serialToAtomUid);
  if (serialKeys.length !== parsedAtoms.length || parsedAtoms.some((atom) => !Object.prototype.hasOwnProperty.call(input.mapping.serialToAtomUid, String(atom.serial)))) {
    return importFailure("AMBIGUOUS", "D3_MAPPING_SERIAL_COVERAGE_INVALID", "Authoritative atom mapping must cover each PDBQT atom serial exactly once and no other serials.", "mapping.serialToAtomUid");
  }
  const mappedComponents = new Set<string>();
  const componentById = new Map(input.graph.components.map((component) => [component.componentId, component]));
  for (const atom of parsedAtoms) {
    const uid = input.mapping.serialToAtomUid[String(atom.serial)];
    const graphAtom = graphAtoms.get(uid);
    if (!graphAtom) return importFailure("AMBIGUOUS", "D3_MAPPING_ATOM_UID_UNKNOWN", `PDBQT serial ${atom.serial} maps to an AtomUID absent from the authoritative graph.`, `mapping.serialToAtomUid.${atom.serial}`);
    if (mappedUids.has(uid)) return importFailure("AMBIGUOUS", "D3_MAPPING_ATOM_UID_AMBIGUOUS", `PDBQT serials map more than once to AtomUID ${uid}.`, `mapping.serialToAtomUid.${atom.serial}`);
    if (graphAtom.element.toUpperCase() !== atom.element) return importFailure("UNSUPPORTED", "D3_MAPPING_ELEMENT_MISMATCH", `PDBQT serial ${atom.serial} has element ${atom.element}, but its mapped graph atom has element ${graphAtom.element}.`, `mapping.serialToAtomUid.${atom.serial}`);
    const component = componentById.get(graphAtom.componentId);
    if (!component || component.role !== "LIGAND") return importFailure("UNSUPPORTED", "D3_GRAPH_COMPONENT_UNSUPPORTED", "Mapped PDBQT atoms must resolve to one authoritative LIGAND component.", `mapping.serialToAtomUid.${atom.serial}`);
    mappedComponents.add(component.componentId);
    mappedUids.add(uid);
    graphAtomBySerial.set(atom.serial, graphAtom);
  }
  if (mappedComponents.size !== 1) return importFailure("UNSUPPORTED", "D3_GRAPH_COMPONENT_AMBIGUOUS", "A PDBQT representation must map to exactly one authoritative ligand component.", "mapping");
  const selectedComponentId = [...mappedComponents][0]!;
  const graphHeavyAtoms = input.graph.atoms.filter((atom) => atom.componentId === selectedComponentId && atom.element.toUpperCase() !== "H");
  const mappedHeavyUids = new Set(parsedAtoms.filter((atom) => atom.element !== "H").map((atom) => input.mapping.serialToAtomUid[String(atom.serial)]));
  if (graphHeavyAtoms.some((atom) => !mappedHeavyUids.has(atom.atomUid))) return importFailure("AMBIGUOUS", "D3_MAPPING_HEAVY_ATOM_MISSING", "Every heavy atom in the authoritative ligand component must appear in the PDBQT mapping.", "mapping.serialToAtomUid");

  const branchBonds = new Map<number, D2GraphBondV1>();
  for (const branch of branches) {
    const from = input.mapping.serialToAtomUid[String(branch.fromSerial)];
    const to = input.mapping.serialToAtomUid[String(branch.toSerial)];
    if (!from || !to) return importFailure("AMBIGUOUS", "D3_MAPPING_BRANCH_ENDPOINT_MISSING", `Raw branch ${branch.ordinal} has an unmapped endpoint.`, `branches[${branch.ordinal}]`);
    const bond = graphBondFor(input.graph, from, to);
    if (!bond) return importFailure("UNSUPPORTED", "D3_BRANCH_NOT_IN_AUTHORITATIVE_GRAPH", `Raw branch ${branch.ordinal} is not an edge in the authoritative graph.`, `branches[${branch.ordinal}]`);
    if (bond.order !== "SINGLE") return importFailure("UNSUPPORTED", "D3_BRANCH_BOND_ORDER_UNSUPPORTED", `Raw branch ${branch.ordinal} does not map to a single bond in the authoritative graph.`, `branches[${branch.ordinal}]`);
    if (isCyclicBond(input.graph, bond)) return importFailure("UNSUPPORTED", "D3_BRANCH_RING_BOND_UNSUPPORTED", `Raw branch ${branch.ordinal} maps to a cyclic bond, outside this compatibility boundary.`, `branches[${branch.ordinal}]`);
    branchBonds.set(branch.ordinal, bond);
  }

  const diagnostics: D3VinaDiagnostic[] = [];
  if (torsdof !== branches.length) diagnostics.push(d3Warning("D3_TORSDOF_BRANCH_COUNT_MISMATCH", "Raw TORSDOF is preserved independently from the raw BRANCH count."));
  const canonicalMappingPayload = mappingPayload({
    graphRevisionDigest: input.graph.digest,
    representationArtifactDigest: sourceDigest,
    serialToAtomUid: input.mapping.serialToAtomUid,
    evidenceRefs: input.mapping.evidenceRefs,
  });
  const mappingDigest = scientificDigest<"ProvenanceRecordDigest">("D3_VINA_ATOM_MAPPING", "D3_VINA_AUTHORITATIVE_ATOM_MAPPING_V1", canonicalMappingPayload) as D3VinaAtomMappingDigest;
  const mappedAtoms: D3VinaPdbqtAtomV1[] = parsedAtoms.map((atom) => ({
    serial: atom.serial,
    element: atom.element,
    atomType: atom.atomType,
    atomUid: input.mapping.serialToAtomUid[String(atom.serial)]!,
    line: atom.line,
    branchOrdinal: atom.branchOrdinal,
  }));
  const rawBranches: D3VinaRawBranchV1[] = branches.map((branch) => ({
    ordinal: branch.ordinal,
    parentOrdinal: branch.parentOrdinal,
    fromSerial: branch.fromSerial,
    toSerial: branch.toSerial,
    startLine: branch.startLine,
    endLine: branch.endLine!,
    rawStartRecord: branch.rawStartRecord,
    rawEndRecord: branch.rawEndRecord!,
    directAtomSerials: [...branch.directAtomSerials],
  }));
  const producer = input.producer.status === "KNOWN"
    ? { status: "KNOWN" as const, name: input.producer.name, ...(input.producer.version ? { version: input.producer.version } : {}), settingsRefs: [...input.producer.settingsRefs] }
    : { status: "UNKNOWN" as const, reason: input.producer.reason, evidenceRefs: [...input.producer.evidenceRefs] };
  const evidencePayload = {
    schemaVersion: D3_VINA_TORSION_SCHEMA_VERSION,
    semanticSchemaId: "D3_VINA_PDBQT_EVIDENCE_V1" as const,
    profileId: D3_VINA_TORSION_PROFILE_ID,
    profileDigest: D3_VINA_TORSION_PROFILE_DIGEST,
    sourceArtifactId: scientificId<"SourceArtifactId">(source.sourceArtifactId),
    sourceArtifactDigest: sourceDigest,
    representationByteDigest: sourceDigest,
    graphRevisionDigest: input.graph.digest,
    producer,
    mapping: { status: "AUTHORITATIVE" as const, ...canonicalMappingPayload, digest: mappingDigest },
    rootAtomSerials: [...rootAtomSerials],
    atoms: mappedAtoms,
    rawTorsdof: torsdof,
    rawBranches,
    diagnostics,
  };
  const sourceEvidenceDigest = scientificDigest<"D3VinaPdbqtEvidenceDigest">("D3_VINA_PDBQT_EVIDENCE", "D3_VINA_PDBQT_EVIDENCE_V1", evidencePayload);
  const sourceEvidence: D3VinaPdbqtEvidenceV1 = Object.freeze({ ...evidencePayload, digest: sourceEvidenceDigest });

  const branchesByOrdinal = new Map(branches.map((branch) => [branch.ordinal, branch]));
  const isDescendantOf = (branch: MutableBranch, ancestorOrdinal: number): boolean => {
    let parent = branch.parentOrdinal;
    while (parent !== null) {
      if (parent === ancestorOrdinal) return true;
      parent = branchesByOrdinal.get(parent)?.parentOrdinal ?? null;
    }
    return false;
  };
  const axes: D3VinaSearchAxisV1[] = branches.map((branch) => {
    const relatedBranches = branches.filter((candidate) => candidate.ordinal === branch.ordinal || isDescendantOf(candidate, branch.ordinal));
    const movingAtomUids = [...new Set(parsedAtoms
      .filter((atom) => atom.serial !== branch.toSerial && relatedBranches.some((candidate) => candidate.ordinal === atom.branchOrdinal))
      .map((atom) => input.mapping.serialToAtomUid[String(atom.serial)]!))].sort(uidCompare) as D2AtomUID[];
    const active = movingAtomUids.length > 0;
    return {
      rawBranchOrdinal: branch.ordinal,
      parentAxisOrdinal: branch.parentOrdinal,
      axisAtom1Uid: input.mapping.serialToAtomUid[String(branch.fromSerial)]!,
      axisAtom2Uid: input.mapping.serialToAtomUid[String(branch.toSerial)]!,
      movingAtomUids,
      status: active ? "ACTIVE" : "INACTIVE",
      reason: active ? "MOVABLE_ATOMS_PRESENT" : "ONLY_IMMOBILE_AXIS_ENDPOINT",
    };
  });
  const activeSearchTorsionCount = axes.filter((axis) => axis.status === "ACTIVE").length;
  const searchPayload = {
    schemaVersion: D3_VINA_TORSION_SCHEMA_VERSION,
    semanticSchemaId: "D3_VINA_SEARCH_TOPOLOGY_V1" as const,
    profileId: D3_VINA_TORSION_PROFILE_ID,
    profileDigest: D3_VINA_TORSION_PROFILE_DIGEST,
    pdbqtEvidenceDigest: sourceEvidence.digest,
    rawTorsdof: torsdof,
    rawBranchCount: branches.length,
    axes,
    activeSearchTorsionCount,
  };
  const searchDigest = scientificDigest<"D3VinaSearchTopologyDigest">("D3_VINA_SEARCH_TOPOLOGY", "D3_VINA_SEARCH_TOPOLOGY_V1", searchPayload);
  const searchTopology: D3VinaSearchTopologyV1 = Object.freeze({ ...searchPayload, digest: searchDigest });

  const graphAtomByUid = atomByUid(input.graph);
  const heavyDegree = (uid: D2AtomUID): number => {
    const neighbors = new Set<string>();
    for (const bond of input.graph.bonds) {
      const other = bond.atom1Uid === uid ? bond.atom2Uid : bond.atom2Uid === uid ? bond.atom1Uid : undefined;
      if (other && graphAtomByUid.get(other)?.element.toUpperCase() !== "H") neighbors.add(other);
    }
    return neighbors.size;
  };
  const bondAssignments: D3VinaScorerBondAssignmentV1[] = [];
  let halfUnits = 0;
  for (const branch of branches) {
    const graphBond = branchBonds.get(branch.ordinal)!;
    const [endpointAUid, endpointBUid] = [graphBond.atom1Uid, graphBond.atom2Uid].sort(uidCompare) as [D2AtomUID, D2AtomUID];
    const rotorFlag = axes[branch.ordinal]!.status === "ACTIVE";
    const endpointAElement = graphAtomByUid.get(endpointAUid)!.element.toUpperCase();
    const endpointBElement = graphAtomByUid.get(endpointBUid)!.element.toUpperCase();
    const heavyHeavy = endpointAElement !== "H" && endpointBElement !== "H";
    const endpointAUnits = rotorFlag && heavyHeavy && heavyDegree(endpointBUid) > 1 ? 1 : 0;
    const endpointBUnits = rotorFlag && heavyHeavy && heavyDegree(endpointAUid) > 1 ? 1 : 0;
    halfUnits += endpointAUnits + endpointBUnits;
    const endpointAContribution = endpointAUnits ? HALF : ZERO;
    const endpointBContribution = endpointBUnits ? HALF : ZERO;
    const totalBondContribution = endpointAUnits + endpointBUnits === 2 ? ONE : endpointAUnits + endpointBUnits === 1 ? HALF : ZERO;
    bondAssignments.push({
      bondUid: graphBond.bondUid,
      endpointAUid,
      endpointBUid,
      rotorFlag,
      endpointAContribution,
      endpointBContribution,
      totalBondContribution,
      evidenceRefs: [`source:${sourceDigest}`, `branch:${branch.ordinal}`],
    });
  }
  bondAssignments.sort((left, right) => uidCompare(left.bondUid, right.bondUid));
  const scorerPayload = {
    schemaVersion: D3_VINA_TORSION_SCHEMA_VERSION,
    semanticSchemaId: "D3_VINA_SCORER_TORSION_ASSIGNMENT_V1" as const,
    profileId: D3_VINA_TORSION_PROFILE_ID,
    profileDigest: D3_VINA_TORSION_PROFILE_DIGEST,
    graphRevisionDigest: input.graph.digest,
    pdbqtEvidenceDigest: sourceEvidence.digest,
    bondAssignments,
    nTorsVina: f64Bits(halfUnits / 2),
  };
  const scorerDigest = scientificDigest<"D3VinaScorerAssignmentDigest">("D3_VINA_SCORER_TORSION_ASSIGNMENT", "D3_VINA_SCORER_TORSION_ASSIGNMENT_V1", scorerPayload);
  const scorerTorsionAssignment: D3VinaScorerTorsionAssignmentV1 = Object.freeze({ ...scorerPayload, digest: scorerDigest });
  if (axes.some((axis) => axis.status === "INACTIVE")) diagnostics.push(d3Warning("D3_RAW_BRANCH_INACTIVE", "One or more raw BRANCH records produced no retained Vina search axis."));
  return valid({ sourceEvidence, searchTopology, scorerTorsionAssignment }, diagnostics);
};
