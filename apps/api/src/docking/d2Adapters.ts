import type {
  ArtifactByteDigest,
  CanonicalMolecularStructure,
  CanonicalAtom,
  CanonicalBond,
  CanonicalCoordinateState,
  D2AtomCorrespondenceMapV1,
  D2AtomUID,
  D2BondEvidence,
  D2BondUID,
  D2ChemicalStateV1,
  D2CoordinateStateV1,
  D2GraphAtomV1,
  D2GraphBondV1,
  D2GraphComponentV1,
  D2MolecularGraphRevisionV1,
  D2MolecularIdentityV1,
  D2ProvenanceRecordV1,
  D2SealResult,
  SourceArtifact,
  SourceArtifactId,
  StructureFormat,
} from "@molecular/contracts";
import {
  D2_SCHEMA_VERSION,
  D2_SUPPORTED_CORE_ELEMENTS,
  D2_CORE_PROFILE_ID,
  D2_KINEMATIC_PROFILE_ID,
  D2_LIGAND_PROFILE_ID,
  D2_RECEPTOR_PROFILE_ID,
  D2_SEARCH_REGION_PROFILE_ID,
  D2_VALIDATION_STATUSES,
  f64Bits,
  scientificId,
  sha256Digest,
  type D2BondOrder,
  type D2ComponentId,
  type D2CoordinateFrameId,
  type D2SourceAlias,
} from "@molecular/contracts";
import { scientificDigest } from "./scientificSerialization.js";
import { d2Error, d2Warning, sealResult, deepFreeze } from "./d2Validation.js";

const MAX_PDBQT_LINES = 200_000;
const MAX_PDBQT_LINE_LENGTH = 512;

type D2ExecutionRepresentation = Readonly<{
  kind: "DERIVED_EXECUTION_REPRESENTATION";
  format: StructureFormat;
  sourceScientificDigest?: string;
  artifactByteDigest: ArtifactByteDigest;
  authoritativeForMolecularIdentity: false;
  parsedKinematicEvidence?: D2PdbqtKinematicEvidence;
}>;

export type D2AdaptedRepresentation = Readonly<{
  sourceFormat: StructureFormat;
  sourceArtifactId: SourceArtifactId;
  sourceArtifactDigest: ArtifactByteDigest;
  identity?: D2MolecularIdentityV1;
  graph?: D2MolecularGraphRevisionV1;
  chemicalState?: D2ChemicalStateV1;
  coordinateStates: readonly D2CoordinateStateV1[];
  correspondence: D2AtomCorrespondenceMapV1;
  authoritativeForMolecularIdentity: boolean;
  executionRepresentation?: D2ExecutionRepresentation;
  diagnostics: readonly string[];
}>;

export type D2AdapterInput = Readonly<{
  structure: CanonicalMolecularStructure;
  sourceArtifact?: SourceArtifact;
  /** mmCIF imports must explicitly say whether auth_* and label_* namespaces were retained. */
  mmcifNamespaceMode?: "PRESERVED_AUTH_AND_LABEL" | "LABEL_ONLY";
}>;

export type D2PdbqtBranchEvidence = Readonly<{ atom1Serial: number; atom2Serial: number; line: number }>;
export type D2PdbqtKinematicEvidence = Readonly<{
  rootAtomSerial?: number;
  branchEdges: readonly D2PdbqtBranchEvidence[];
  torsdof?: number;
  atomSerials: readonly number[];
  diagnostics: readonly string[];
}>;

export type D2MappedPdbqtKinematicEvidence = Readonly<{
  rootAtomUid?: D2AtomUID;
  branchBondUids: readonly D2BondUID[];
  torsdof?: number;
}>;

const sourceArtifactIdFor = (input: D2AdapterInput): SourceArtifactId => scientificId<"SourceArtifactId">(input.sourceArtifact?.sourceArtifactId ?? input.structure.source.sourceArtifactId ?? `source:${input.structure.source.sha256}`);

const asArtifactDigest = (value: string): ArtifactByteDigest => sha256Digest<"ArtifactByteDigest">(value.startsWith("sha256:") ? value : `sha256:${value}`);
const asD2AtomUid = (value: string): D2AtomUID => value as D2AtomUID;
const asD2BondUid = (value: string): D2BondUID => value as D2BondUID;
const asD2ComponentId = (value: string): D2ComponentId => value as D2ComponentId;

const namespaceFor = (format: StructureFormat, mmcifNamespaceMode: D2AdapterInput["mmcifNamespaceMode"]): D2SourceAlias["sourceNamespace"] => {
  if (format === "pdb") return "PDB_AUTH";
  if (format === "mmcif") return mmcifNamespaceMode === "PRESERVED_AUTH_AND_LABEL" ? "MMCIF_AUTH" : "MMCIF_LABEL";
  if (format === "sdf") return "SDF";
  if (format === "mol2") return "MOL2";
  if (format === "pdbqt") return "PDBQT";
  return "INTERNAL";
};

const aliasFor = (atom: CanonicalAtom, index: number, format: StructureFormat, mmcifNamespaceMode: D2AdapterInput["mmcifNamespaceMode"]): D2SourceAlias => ({
  sourceNamespace: namespaceFor(format, mmcifNamespaceMode),
  sourceSerial: atom.serial,
  sourceIndex: index,
  chainId: atom.chain,
  residueId: `${atom.residueName}:${atom.residueNumber}:${atom.insertionCode ?? ""}`,
  ...(atom.insertionCode ? { insertionCode: atom.insertionCode } : {}),
  atomName: atom.atomName,
  ...(atom.altLoc ? { altLoc: atom.altLoc } : {}),
});

const componentKeyFor = (atom: CanonicalAtom): string => `${atom.chain}\u0000${atom.residueName}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}`;

const bondOrderFor = (order: CanonicalBond["order"]): D2BondOrder => order;
const bondEvidenceFor = (source: CanonicalBond["source"], format: StructureFormat): D2BondEvidence => source === "UNKNOWN" && format !== "sdf" && format !== "mol2" ? "UNKNOWN" : format === "pdbqt" ? "IMPORTED_EXECUTION" : source === "PDB_CONECT" || source === "MMCIF_STRUCT_CONN" || source === "MMCIF_CHEM_COMP_BOND" || format === "sdf" || format === "mol2" ? "SOURCE_EXPLICIT" : "SOURCE_INFERRED";

const provenanceFor = (operation: string, profileId: string, inputDigests: readonly string[], sourceArtifactRefs: readonly string[], mappingRefs: readonly string[], informationLoss: D2ProvenanceRecordV1["informationLoss"]): D2ProvenanceRecordV1 => {
  const payload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_PROVENANCE_RECORD_V1", operation, softwareRef: "molecular-workstation-d2", profileId, inputDigests, sourceArtifactRefs, mappingRefs, informationLoss } as const;
  const digest = scientificDigest<"ProvenanceRecordDigest">("D2_PROVENANCE_RECORD", "D2_PROVENANCE_RECORD_V1", payload);
  return deepFreeze({ ...payload, recordId: `provenance:${digest.slice(-16)}`, digest });
};

const f64Coordinate = (value: number, path: string, diagnostics: ReturnType<typeof d2Error>[]): ReturnType<typeof f64Bits> => {
  if (!Number.isFinite(value)) {
    diagnostics.push(d2Error("INVALID_NONFINITE_COORDINATE", `${path} must be finite.`, path));
    return f64Bits(0);
  }
  return f64Bits(value);
};

const coordinatesFor = (state: CanonicalCoordinateState | undefined, atom: CanonicalAtom, index: number, diagnostics: ReturnType<typeof d2Error>[]) => {
  const coordinate = state?.coordinates[atom.stableId] ?? { x: atom.x, y: atom.y, z: atom.z };
  return [f64Coordinate(coordinate.x, `coordinates[${index}].x`, diagnostics), f64Coordinate(coordinate.y, `coordinates[${index}].y`, diagnostics), f64Coordinate(coordinate.z, `coordinates[${index}].z`, diagnostics)] as const;
};

const createGraph = (input: D2AdapterInput, sourceArtifactDigest: ArtifactByteDigest, diagnostics: ReturnType<typeof d2Error>[]): { graph: D2MolecularGraphRevisionV1; identity: D2MolecularIdentityV1; correspondence: D2AtomCorrespondenceMapV1; coordinates: readonly D2CoordinateStateV1[]; chemicalState: D2ChemicalStateV1 } => {
  const { structure } = input;
  const atoms = structure.atoms;
  const atomUids = new Map<string, D2AtomUID>();
  const seenAtomUids = new Set<D2AtomUID>();
  const aliases = new Map<D2AtomUID, D2SourceAlias[]>();
  const sourceToCanonical: Record<string, D2AtomUID> = {};
  const canonicalAtoms: D2GraphAtomV1[] = [];
  const componentAtoms = new Map<string, D2AtomUID[]>();
  for (const [index, atom] of atoms.entries()) {
    const alias = aliasFor(atom, index, structure.format, input.mmcifNamespaceMode);
    const semanticKey = {
      sourceArtifactDigest,
      namespace: alias.sourceNamespace,
      serial: alias.sourceSerial ?? null,
      chain: atom.chain,
      residue: `${atom.residueName}:${atom.residueNumber}:${atom.insertionCode ?? ""}`,
      atomName: atom.atomName,
      altLoc: atom.altLoc ?? null,
      element: atom.element.toUpperCase(),
    };
    const atomUid = asD2AtomUid(`atom:${scientificDigest<"MolecularIdentityDigest">("D2_ATOM_UID", "D2_ATOM_UID_V1", semanticKey).slice(-32)}`);
    if (atomUids.has(atom.stableId)) diagnostics.push(d2Error("INVALID_DUPLICATE_ATOM_STABLE_ID", `Atom stable ID ${atom.stableId} occurs more than once.`, `atoms[${index}].stableId`));
    if (seenAtomUids.has(atomUid)) diagnostics.push(d2Error("INVALID_DUPLICATE_ATOM_UID", `AtomUID ${atomUid} is not unique within the adapted graph.`, `atoms[${index}]`));
    seenAtomUids.add(atomUid);
    atomUids.set(atom.stableId, atomUid);
    aliases.set(atomUid, [alias]);
    sourceToCanonical[`serial:${atom.serial}`] = atomUid;
    sourceToCanonical[`index:${index}`] = atomUid;
    const componentKey = componentKeyFor(atom);
    const componentId = asD2ComponentId(`component:${scientificDigest<"MolecularIdentityDigest">("D2_COMPONENT", "D2_COMPONENT_V1", { sourceArtifactDigest, componentKey }).slice(-24)}`);
    const members = componentAtoms.get(componentKey) ?? [];
    members.push(atomUid);
    componentAtoms.set(componentKey, members);
    canonicalAtoms.push({
      atomUid,
      element: atom.element.toUpperCase(),
      atomName: atom.atomName,
      componentId,
      ...(atom.formalCharge !== undefined ? { formalCharge: atom.formalCharge } : {}),
      aliases: [alias],
    });
  }
  const componentRows: D2GraphComponentV1[] = [...componentAtoms.entries()].map(([componentKey, memberUids]) => {
    const first = atoms.find((atom) => componentKeyFor(atom) === componentKey)!;
    const role = first.isPolymer ? "POLYMER" : first.isWater ? "WATER" : first.isIon ? "ION" : first.isLigand ? "LIGAND" : "UNKNOWN";
    return { componentId: canonicalAtoms.find((atom) => atom.atomUid === memberUids[0])!.componentId, role, atomUids: memberUids, sourceRefs: [`component:${componentKey}`] };
  });
  const canonicalBonds: D2GraphBondV1[] = [];
  const stableIdToUid = (stableId: string): D2AtomUID | undefined => atomUids.get(stableId);
  for (const [index, bond] of structure.bonds.entries()) {
    const atom1Uid = stableIdToUid(bond.atom1);
    const atom2Uid = stableIdToUid(bond.atom2);
    if (!atom1Uid || !atom2Uid) {
      diagnostics.push(d2Error("INVALID_BOND_ATOM_REFERENCE", `Bond ${bond.id} references an atom absent from the adapted graph.`, `bonds[${index}]`));
      continue;
    }
    const bondUid = asD2BondUid(`bond:${scientificDigest<"MolecularIdentityDigest">("D2_BOND_UID", "D2_BOND_UID_V1", { sourceArtifactDigest, index, atom1Uid, atom2Uid, order: bond.order }).slice(-32)}`);
    canonicalBonds.push({ bondUid, atom1Uid, atom2Uid, order: bondOrderFor(bond.order), evidence: bondEvidenceFor(bond.source, structure.format), sourceRef: bond.id });
  }
  const graphPayload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_MOLECULAR_GRAPH_REVISION_V1", atoms: canonicalAtoms, bonds: canonicalBonds, components: componentRows, sourceArtifactIds: [scientificId<"SourceArtifactId">(input.sourceArtifact?.sourceArtifactId ?? structure.source.sourceArtifactId ?? `source:${sourceArtifactDigest}`)] } as const;
  const graphDigest = scientificDigest<"MolecularIdentityDigest">("D2_MOLECULAR_GRAPH", "D2_MOLECULAR_GRAPH_REVISION_V1", graphPayload);
  const graph: D2MolecularGraphRevisionV1 = deepFreeze({ ...graphPayload, revisionId: `graph:${graphDigest.slice(-16)}`, digest: graphDigest });
  const identityPayload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_MOLECULAR_IDENTITY_V1", graphRevisionDigest: graph.digest, sourceArtifactRefs: [{ sourceArtifactId: sourceArtifactIdFor(input), artifactByteDigest: sourceArtifactDigest }] } as const;
  const identityDigest = scientificDigest<"MolecularIdentityDigest">("D2_MOLECULAR_IDENTITY", "D2_MOLECULAR_IDENTITY_V1", identityPayload);
  const identity: D2MolecularIdentityV1 = deepFreeze({ ...identityPayload, identityId: `molecular:${identityDigest.slice(-16)}`, digest: identityDigest });
  const correspondencePayload = { schemaVersion: D2_SCHEMA_VERSION, sourceToCanonical, canonicalToSource: Object.fromEntries([...aliases.entries()]), sourceArtifactDigest };
  const correspondenceDigest = scientificDigest<"ProvenanceRecordDigest">("D2_ATOM_CORRESPONDENCE", "D2_ATOM_CORRESPONDENCE_V1", correspondencePayload);
  const correspondence: D2AtomCorrespondenceMapV1 = deepFreeze({ ...correspondencePayload, mapId: `mapping:${correspondenceDigest.slice(-16)}`, digest: correspondenceDigest });
  const formalCharges = Object.fromEntries(canonicalAtoms.map((atom) => [atom.atomUid, atom.formalCharge ?? null]));
  const chemicalPayload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_CHEMICAL_STATE_V1", molecularIdentityDigest: identity.digest, resolution: "UNKNOWN", formalCharges, stereo: [], selectedComponentIds: componentRows.map((component) => component.componentId), sourceEvidenceRefs: [sourceArtifactDigest] } as const;
  const chemicalDigest = scientificDigest<"ChemicalStateDigest">("D2_CHEMICAL_STATE", "D2_CHEMICAL_STATE_V1", chemicalPayload);
  const chemicalState: D2ChemicalStateV1 = deepFreeze({ ...chemicalPayload, stateId: `chemical:${chemicalDigest.slice(-16)}`, digest: chemicalDigest });
  const coordinateStates = (structure.coordinateStates?.length ? structure.coordinateStates : [undefined]).map((state, index) => {
    const coordinateMap = Object.fromEntries(atoms.map((atom, atomIndex) => [atomUids.get(atom.stableId)!, coordinatesFor(state, atom, atomIndex, diagnostics)]));
    const coordinatePayload = { schemaVersion: D2_SCHEMA_VERSION, semanticSchemaId: "D2_COORDINATE_STATE_V1", chemicalStateDigest: chemicalState.digest, coordinateFrame: "receptor-source-frame" as D2CoordinateFrameId, coordinateUnits: "ANGSTROM" as const, dimensionality: 3 as const, origin: [f64Bits(0), f64Bits(0), f64Bits(0)] as const, coordinates: coordinateMap, sourceArtifactRefs: [sourceArtifactDigest], stateIndex: index } as const;
    const coordinateDigest = scientificDigest<"CoordinateStateDigest">("D2_COORDINATE_STATE", "D2_COORDINATE_STATE_V1", coordinatePayload);
    return deepFreeze({ ...coordinatePayload, stateId: `coordinates:${coordinateDigest.slice(-16)}`, digest: coordinateDigest });
  });
  return { graph, identity, correspondence, coordinates: coordinateStates, chemicalState };
};

export const adaptCanonicalStructure = (input: D2AdapterInput): D2SealResult<D2AdaptedRepresentation> => {
  const diagnostics: ReturnType<typeof d2Error>[] = [];
  const warnings: ReturnType<typeof d2Warning>[] = [];
  if (!input.sourceArtifact) diagnostics.push(d2Error("INVALID_SOURCE_ARTIFACT_EVIDENCE", "D2 adaptation requires the immutable SourceArtifact record alongside canonical structure data."));
  const sourceArtifactDigest = input.sourceArtifact ? asArtifactDigest(input.sourceArtifact.sha256) : asArtifactDigest(input.structure.source.sha256);
  const sourceArtifactId = sourceArtifactIdFor(input);
  if (!input.structure.atoms.length && input.structure.compact) diagnostics.push(d2Error("RESOURCE_COMPACT_MATERIALIZATION_REQUIRED", "D2 sealing requires a materialized bounded atom graph; compact transport must be expanded by an explicit adapter before sealing."));
  if (!input.structure.atoms.length) diagnostics.push(d2Error("INVALID_EMPTY_GRAPH", "A molecular graph must contain at least one atom."));
  if (input.structure.format === "mmcif" && input.mmcifNamespaceMode !== "PRESERVED_AUTH_AND_LABEL") diagnostics.push(d2Error("AMBIGUOUS_MMCIF_NAMESPACE", "mmCIF adaptation requires explicit preservation of distinct auth_* and label_* structural namespaces."));
  const graphResult = input.structure.atoms.length ? createGraph(input, sourceArtifactDigest, diagnostics) : undefined;
  const allDiagnostics = [...diagnostics, ...warnings];
  if (!graphResult) return sealResult(undefined, allDiagnostics);
  const provenance = provenanceFor("ADAPT_CANONICAL_STRUCTURE", input.structure.format === "pdbqt" ? "D2_PDBQT_IMPORT_EVIDENCE_1_0" : D2_CORE_PROFILE_ID, [input.structure.scientificHash], [sourceArtifactDigest], [graphResult.correspondence.digest], [
    { field: "source_bytes", status: "PRESERVED", explanation: "Source artifact digest is retained." },
    { field: "canonical_graph", status: input.structure.format === "pdbqt" ? "DROPPED" : "DERIVED", explanation: input.structure.format === "pdbqt" ? "PDBQT is execution evidence, never canonical molecular identity." : "Graph was adapted into D2 AtomUID/bond/component records." },
  ]);
  const executionRepresentation: D2ExecutionRepresentation | undefined = input.structure.format === "pdbqt" ? {
    kind: "DERIVED_EXECUTION_REPRESENTATION",
    format: "pdbqt",
    sourceScientificDigest: input.structure.scientificHash,
    artifactByteDigest: sourceArtifactDigest,
    authoritativeForMolecularIdentity: false,
  } : undefined;
  const value: D2AdaptedRepresentation = deepFreeze({
    sourceFormat: input.structure.format,
    sourceArtifactId,
    sourceArtifactDigest,
    ...(input.structure.format === "pdbqt" ? {} : { identity: graphResult.identity, graph: graphResult.graph, chemicalState: graphResult.chemicalState }),
    coordinateStates: graphResult.coordinates,
    correspondence: graphResult.correspondence,
    authoritativeForMolecularIdentity: input.structure.format !== "pdbqt",
    ...(executionRepresentation ? { executionRepresentation } : {}),
    diagnostics: warnings.map((warning) => warning.code),
  });
  if (input.structure.format === "pdbqt") allDiagnostics.push(d2Warning("PDBQT_NOT_IDENTITY_AUTHORITY", "PDBQT is retained only as derived execution evidence; it cannot establish canonical MolecularIdentity or ChemicalState."));
  return sealResult(value, allDiagnostics, provenance);
};

export const parsePdbqtKinematicEvidence = (content: string): D2SealResult<D2PdbqtKinematicEvidence> => {
  const diagnostics: ReturnType<typeof d2Error>[] = [];
  const lines = content.split(/\r?\n/);
  if (lines.length > MAX_PDBQT_LINES) diagnostics.push(d2Error("RESOURCE_PARSER_LIMIT", `PDBQT input exceeds the ${MAX_PDBQT_LINES}-line parser limit.`));
  let rootAtomSerial: number | undefined;
  let inRoot = false;
  let torsdof: number | undefined;
  const branchEdges: D2PdbqtBranchEvidence[] = [];
  const atomSerials: number[] = [];
  const stack: Array<{ atom1Serial: number; atom2Serial: number; line: number }> = [];
  for (const [index, rawLine] of lines.entries()) {
    if (rawLine.length > MAX_PDBQT_LINE_LENGTH) { diagnostics.push(d2Error("RESOURCE_PARSER_LINE_LIMIT", `PDBQT line ${index + 1} exceeds the parser line limit.`, `line:${index + 1}`)); continue; }
    const line = rawLine.trim();
    if (!line) continue;
    const record = line.split(/\s+/)[0]!.toUpperCase();
    if (record === "ATOM" || record === "HETATM") {
      const serial = Number.parseInt(rawLine.slice(6, 11).trim(), 10);
      if (!Number.isSafeInteger(serial) || serial < 0) diagnostics.push(d2Error("INVALID_PDBQT_ATOM_SERIAL", `PDBQT atom line ${index + 1} has an invalid serial.`, `line:${index + 1}`));
      else {
        atomSerials.push(serial);
        if (inRoot && rootAtomSerial === undefined) rootAtomSerial = serial;
      }
      continue;
    }
    if (record === "ROOT") {
      if (rootAtomSerial !== undefined) diagnostics.push(d2Error("INVALID_PDBQT_ROOT_COUNT", "PDBQT may contain at most one ROOT marker."));
      inRoot = true;
      continue;
    }
    if (record === "ENDROOT") { inRoot = false; continue; }
    if (record === "BRANCH") {
      const [a, b] = line.split(/\s+/).slice(1).map((value) => Number.parseInt(value, 10));
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b < 0 || a === b) diagnostics.push(d2Error("INVALID_PDBQT_BRANCH", `PDBQT BRANCH at line ${index + 1} must name two distinct atom serials.`, `line:${index + 1}`));
      else { const edge = { atom1Serial: a, atom2Serial: b, line: index + 1 }; branchEdges.push(edge); stack.push(edge); }
      continue;
    }
    if (record === "ENDBRANCH") {
      const [a, b] = line.split(/\s+/).slice(1).map((value) => Number.parseInt(value, 10));
      const open = stack.pop();
      if (!open || open.atom1Serial !== a || open.atom2Serial !== b) diagnostics.push(d2Error("INVALID_PDBQT_BRANCH_NESTING", `PDBQT ENDBRANCH at line ${index + 1} does not close the most recent BRANCH.`, `line:${index + 1}`));
      continue;
    }
    if (record === "TORSDOF") {
      const value = Number.parseInt(line.split(/\s+/)[1] ?? "", 10);
      if (!Number.isSafeInteger(value) || value < 0) diagnostics.push(d2Error("INVALID_PDBQT_TORSDOF", `PDBQT TORSDOF at line ${index + 1} must be a non-negative integer.`, `line:${index + 1}`));
      else if (torsdof !== undefined) diagnostics.push(d2Error("INVALID_PDBQT_TORSDOF_COUNT", "PDBQT may contain at most one TORSDOF marker."));
      else torsdof = value;
    }
  }
  if (stack.length) diagnostics.push(d2Error("INVALID_PDBQT_BRANCH_NESTING", "PDBQT contains an unclosed BRANCH marker."));
  const evidence: D2PdbqtKinematicEvidence = deepFreeze({ ...(rootAtomSerial !== undefined ? { rootAtomSerial } : {}), branchEdges, ...(torsdof !== undefined ? { torsdof } : {}), atomSerials, diagnostics: diagnostics.map((diagnostic) => diagnostic.code) });
  if (torsdof !== undefined && torsdof !== branchEdges.length) diagnostics.push(d2Error("INVALID_PDBQT_TORSDOF_MISMATCH", `PDBQT TORSDOF ${torsdof} does not match ${branchEdges.length} explicit BRANCH edges.`));
  return sealResult(evidence, diagnostics);
};

const aliasSerialMap = (correspondence: D2AtomCorrespondenceMapV1): Map<number, D2AtomUID> => {
  const result = new Map<number, D2AtomUID>();
  for (const [key, value] of Object.entries(correspondence.sourceToCanonical)) if (key.startsWith("serial:")) result.set(Number(key.slice(7)), value);
  return result;
};

export const mapPdbqtKinematicEvidence = (evidence: D2PdbqtKinematicEvidence, correspondence: D2AtomCorrespondenceMapV1, graph: D2MolecularGraphRevisionV1): D2SealResult<D2MappedPdbqtKinematicEvidence> => {
  const diagnostics: ReturnType<typeof d2Error>[] = [];
  const serialMap = aliasSerialMap(correspondence);
  const rootAtomUid = evidence.rootAtomSerial === undefined ? undefined : serialMap.get(evidence.rootAtomSerial);
  if (evidence.rootAtomSerial !== undefined && !rootAtomUid) diagnostics.push(d2Error("UNSUPPORTED_PDBQT_ROOT_MAPPING", `PDBQT ROOT serial ${evidence.rootAtomSerial} is not present in the authoritative atom correspondence map.`));
  const branchBondUids: D2BondUID[] = [];
  for (const branch of evidence.branchEdges) {
    const atom1Uid = serialMap.get(branch.atom1Serial);
    const atom2Uid = serialMap.get(branch.atom2Serial);
    if (!atom1Uid || !atom2Uid) { diagnostics.push(d2Error("UNSUPPORTED_PDBQT_BRANCH_MAPPING", `PDBQT BRANCH at line ${branch.line} references an unmapped atom.`)); continue; }
    const bond = graph.bonds.find((candidate) => (candidate.atom1Uid === atom1Uid && candidate.atom2Uid === atom2Uid) || (candidate.atom1Uid === atom2Uid && candidate.atom2Uid === atom1Uid));
    if (!bond) diagnostics.push(d2Error("UNSUPPORTED_PDBQT_BRANCH_BOND", `PDBQT BRANCH at line ${branch.line} does not map to an authoritative graph bond.`));
    else branchBondUids.push(bond.bondUid);
  }
  const value: D2MappedPdbqtKinematicEvidence = { ...(rootAtomUid ? { rootAtomUid } : {}), branchBondUids, ...(evidence.torsdof !== undefined ? { torsdof: evidence.torsdof } : {}) };
  return sealResult(value, diagnostics);
};

export type D2SmilesIdentityEvidence = Readonly<{
  sourceArtifactId: SourceArtifactId;
  sourceArtifactDigest: ArtifactByteDigest;
  notation: string;
  identityDigest: string;
  graphAuthority: "SMILES_GRAPH_INPUT_ONLY";
  executionReady: false;
  requiresExplicitCoordinateState: true;
}>;

/** SMILES is retained as graph/identity evidence only; this adapter never embeds or generates 3D. */
export const adaptSmilesIdentity = (input: Readonly<{ notation: string; sourceArtifact: SourceArtifact }>): D2SealResult<D2SmilesIdentityEvidence> => {
  const diagnostics: ReturnType<typeof d2Error>[] = [];
  const notation = input.notation.trim();
  if (!notation) diagnostics.push(d2Error("INVALID_EMPTY_SMILES", "SMILES notation must be non-empty."));
  if (notation.length > 1_000_000) diagnostics.push(d2Error("RESOURCE_SMILES_LIMIT", "SMILES notation exceeds the bounded adapter limit."));
  const sourceDigest = asArtifactDigest(input.sourceArtifact.sha256);
  const identityDigest = scientificDigest<"MolecularIdentityDigest">("D2_SMILES_GRAPH_INPUT", "D2_SMILES_GRAPH_INPUT_V1", { notation, sourceDigest });
  const value: D2SmilesIdentityEvidence = { sourceArtifactId: scientificId<"SourceArtifactId">(input.sourceArtifact.sourceArtifactId), sourceArtifactDigest: sourceDigest, notation, identityDigest, graphAuthority: "SMILES_GRAPH_INPUT_ONLY", executionReady: false, requiresExplicitCoordinateState: true };
  return sealResult(value, diagnostics, provenanceFor("ADAPT_SMILES_GRAPH_INPUT", "D2_SMILES_GRAPH_INPUT_V1", [identityDigest], [sourceDigest], [], [{ field: "three_dimensional_coordinates", status: "DROPPED", explanation: "SMILES has no native 3D coordinates; no embedding or conformer generation is performed." }]));
};

export const D2_ADAPTER_PROFILE_IDS = Object.freeze({ core: D2_CORE_PROFILE_ID, receptor: D2_RECEPTOR_PROFILE_ID, ligand: D2_LIGAND_PROFILE_ID, kinematic: D2_KINEMATIC_PROFILE_ID, searchRegion: D2_SEARCH_REGION_PROFILE_ID, supportedElements: D2_SUPPORTED_CORE_ELEMENTS, validationStatuses: D2_VALIDATION_STATUSES });
