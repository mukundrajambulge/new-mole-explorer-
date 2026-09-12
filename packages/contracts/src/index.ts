export const CAPABILITY_STATES = [
  "SUPPORTED",
  "SUPPORTED_WITH_LIMITATIONS",
  "EXPERIMENTAL",
  "COMING_SOON",
  "UNAVAILABLE",
] as const;

export type CapabilityState = (typeof CAPABILITY_STATES)[number];

export type Capability = {
  state: CapabilityState;
  label: string;
  description: string;
};

export type HealthResponse = {
  service: "molecular-api";
  status: "ok";
  gate: "G1C";
  timestamp: string;
};

export type BootstrapResponse = {
  product: "Molecular Workstation";
  gate: "G1C";
  renderer: {
    mode: "3dmol";
    authoritative: true;
  };
  capabilities: Record<string, Capability>;
};

/** Formats that currently produce an admitted, coordinate-bearing molecular object. */
export const STRUCTURE_FORMATS = ["pdb", "mmcif", "pqr", "sdf", "xyz", "mol2", "pdbqt"] as const;
export type StructureFormat = (typeof STRUCTURE_FORMATS)[number];

export type StructureSourceKind = "LOCAL_FILE" | "RCSB";
export type RemoteStructureProvider = "RCSB" | "PDBE";

export type BondOrder = "SINGLE" | "DOUBLE" | "TRIPLE" | "AROMATIC" | "UNKNOWN";

export type CanonicalBond = {
  id: string;
  atom1: string;
  atom2: string;
  order: BondOrder;
  source: "PDB_CONECT" | "MMCIF_STRUCT_CONN" | "MMCIF_GEOM_BOND" | "MMCIF_CHEM_COMP_BOND" | "UNKNOWN";
};

export type CanonicalResidue = {
  id: string;
  name: string;
  number: number;
  insertionCode?: string;
  chainId: string;
  atomIds: string[];
  isPolymer: boolean;
  secondaryStructure?: SecondaryStructureKind | null;
};

export type SecondaryStructureKind = "HELIX" | "SHEET" | "LOOP";

export type PartialChargeDataset = {
  datasetId: string;
  molecularRevision: string;
  chargeModel: string;
  profileVersion: string;
  atomChargeMap: Record<string, number>;
  units: string;
  provenance: string;
};

/** Complete, revision-bound chemistry roles supplied by an admitted perception profile. */
export type CanonicalChemistryDataset = {
  datasetId: string;
  molecularRevision: string;
  profileVersion: "canonical-chemistry-roles-v1";
  donorAtomIds: string[];
  acceptorAtomIds: string[];
  provenance: string;
};

/** Complete, revision-bound fragment memberships supplied by an admitted profile. */
export type CanonicalFragmentDataset = {
  datasetId: string;
  molecularRevision: string;
  profileVersion: "canonical-fragment-assignment-v1";
  atomFragmentMap: Record<string, string>;
  assignmentSource: string;
  provenance: string;
};

export type SecondaryStructureDataset = {
  datasetId: string;
  molecularRevision: string;
  assignmentSource: string;
  profileVersion: string;
};

export type PeptideSequenceChain = {
  residueIds: string[];
  sequence: string;
};

export type PeptideSequenceDataset = {
  datasetId: string;
  molecularRevision: string;
  assignmentSource: string;
  profileVersion: string;
  chains: Record<string, PeptideSequenceChain>;
};

export type CanonicalChain = {
  id: string;
  name: string;
  residueIds: string[];
};

export type CanonicalHierarchy = {
  chainIds: string[];
  chains: Record<string, CanonicalChain>;
  residues: Record<string, CanonicalResidue>;
};

export type CanonicalPolymerType = "PROTEIN" | "NUCLEIC_ACID" | "OTHER_POLYMER";

export type CanonicalAtom = {
  stableId: string;
  serial: number;
  atomName: string;
  element: string;
  residueName: string;
  residueNumber: number;
  insertionCode?: string;
  chain: string;
  /** Authoritative segment identifier when supplied by the source. */
  segmentId?: string;
  /** Authoritative fragment membership when supplied by an admitted chemistry profile. */
  fragmentId?: string;
  x: number;
  y: number;
  z: number;
  recordType: "ATOM" | "HETATM";
  isPolymer: boolean;
  /** Source-backed polymer entity typing; absent means the source did not establish this distinction. */
  polymerType?: CanonicalPolymerType;
  isLigand: boolean;
  isWater: boolean;
  isIon: boolean;
  /** Authoritative formal charge. null means explicitly unknown; absent means not supplied. */
  formalCharge?: number | null;
  /** Authoritative temperature/B factor when supplied by the source. */
  bFactor?: number | null;
  /** Authoritative occupancy when supplied by the source. */
  occupancy?: number | null;
  /** Authoritative alternate-location identifier when supplied by the source. */
  altLoc?: string | null;
  secondaryStructure?: SecondaryStructureKind | null;
  /** Workspace-only scope metadata used by derived multi-object selection views. */
  workspaceObjectId?: string;
  workspaceObjectName?: string;
  /** Workspace-only presentation scope; scientific `all` still includes disabled objects. */
  workspaceObjectEnabled?: boolean;
  /** Workspace-only coordinate-state metadata used by state-aware selection. */
  workspaceCoordinateStateId?: string;
  workspaceStateOrdinal?: number;
  /** Workspace-only source-backed cell scope used by multi-object bycell evaluation. */
  workspaceUnitCell?: CanonicalUnitCell;
};

export type StructureCounts = {
  atoms: number;
  residues: number;
  chains: number;
  polymerAtoms: number;
  ligandAtoms: number;
  waterAtoms: number;
  ionAtoms: number;
  otherAtoms: number;
};

export type CoordinateBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type Coordinate3D = { x: number; y: number; z: number };

/** A coordinate realization of one molecular object. Identity/topology live on the object. */
export type CanonicalCoordinateState = {
  id: string;
  ordinal: number;
  sourceModelNumber?: number;
  coordinates: Record<string, Coordinate3D>;
  coordinateHash: string;
};

/** Source-backed crystallographic unit-cell parameters for bounded bycell selection. */
export type CanonicalUnitCell = {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
  spaceGroup?: string;
  zValue?: number;
  source: "PDB_CRYST1" | "MMCIF_CELL";
  profileVersion: "fractional-unit-cell-membership-v1";
};

export type StructureSourceMetadata = {
  kind: StructureSourceKind;
  originalFilename: string;
  format: StructureFormat;
  sha256: string;
  byteLength: number;
  uri?: string;
  provider?: RemoteStructureProvider;
  ingestedAt: string;
  parserProfile: string;
  /** R09 immutable acquisition evidence identity. */
  sourceArtifactId?: string;
  acquisitionKind?: "LOCAL_UPLOAD" | "REMOTE_HTTP" | "DERIVED_EXPORT";
  mediaType?: string;
  formatEvidence?: readonly FormatEvidence[];
  providerMetadata?: Readonly<Record<string, string>>;
  scientificHashProfile?: string;
};

export type FormatEvidence = {
  kind: "FILENAME_EXTENSION" | "EXPLICIT_DECLARATION" | "CONTENT_SIGNATURE";
  value: string;
};

/** Exact bytes acquired before decoding or parser normalization. */
export type SourceArtifact = {
  schemaVersion: 1;
  sourceArtifactId: string;
  acquisitionKind: "LOCAL_UPLOAD" | "REMOTE_HTTP" | "DERIVED_EXPORT";
  sourceUri?: string;
  provider?: RemoteStructureProvider;
  accession?: string;
  originalFilename: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  acquiredAt: string;
  providerMetadata?: Readonly<Record<string, string>>;
  format: StructureFormat;
  formatEvidence: readonly FormatEvidence[];
  parserProfile: string;
  rawStorageRef?: string;
  parentExportArtifactId?: string;
};

export type CanonicalMolecularStructure = {
  id: string;
  name: string;
  format: StructureFormat;
  source: StructureSourceMetadata;
  counts: StructureCounts;
  bounds: CoordinateBounds;
  atoms: CanonicalAtom[];
  bonds: CanonicalBond[];
  hierarchy: CanonicalHierarchy;
  scientificHash: string;
  /** Versioned canonical scientific serialization used for this digest. */
  scientificHashProfile?: string;
  /** Optional multi-model foundation; omitted by older persisted G1C records. */
  coordinateStates?: CanonicalCoordinateState[];
  /** Explicit presentation order; never infer scientific identity from array insertion order. */
  stateOrder?: string[];
  /** Optional source-backed crystallographic cell; does not imply symmetry expansion or PBC. */
  unitCell?: CanonicalUnitCell;
  /** Provenance for source-backed polymer entity typing, when available. */
  polymerTypingSource?: string;
  /** Optional complete chemistry-role assignments; absent data must fail closed for donor/acceptor selection. */
  chemistryDataset?: CanonicalChemistryDataset;
  /** Optional complete source-backed fragment memberships; absent data must fail closed for byfragment. */
  fragmentDataset?: CanonicalFragmentDataset;
  partialChargeDataset?: PartialChargeDataset;
  secondaryStructureDataset?: SecondaryStructureDataset;
  peptideSequenceDataset?: PeptideSequenceDataset;
};

export type StructureLoadResult = {
  structure: CanonicalMolecularStructure;
  renderSource: {
    format: StructureFormat;
    content: string;
  };
  /** R09 source evidence; optional for pre-R09 fixtures and historical records. */
  sourceArtifact?: SourceArtifact;
};

export type StructureError = {
  code: LifecycleErrorCode | "REMOTE_FETCH_FAILED" | "REMOTE_NOT_FOUND" | "PROJECT_NOT_FOUND" | "PROJECT_INVALID" | "INTERNAL_ERROR";
  message: string;
};

export type LifecycleErrorCode =
  | "INVALID_INPUT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "FORMAT_MISMATCH"
  | "PARSE_FAILED"
  | "IMPORT_POLICY_CONFLICT"
  | "NAME_COLLISION"
  | "REVISION_CONFLICT"
  | "UNSUPPORTED_STATE_SCOPE"
  | "EXPORT_WOULD_LOSE_SEMANTICS"
  | "WRITER_FAILED"
  | "INTEGRITY_MISMATCH"
  | "SCHEMA_UNSUPPORTED"
  | "MIGRATION_FAILED"
  | "MISSING_DEPENDENCY"
  | "STALE_REFERENCE"
  | "SESSION_RESTORE_FAILED"
  | "SCENE_RESTORE_FAILED"
  | "SECURITY_REJECTED";

export type ProjectPresentationState = {
  schemaVersion: 1;
  representation: string;
  layerVisibility: {
    protein: boolean;
    ligand: boolean;
    water: boolean;
    ions: boolean;
    other: boolean;
  };
  color: {
    mode: string;
    colorId?: string;
    customHex?: string;
    componentColors?: Partial<Record<"protein" | "ligand" | "water" | "ions" | "other", { mode: "inherit" | "element" | "chain" | "custom"; customHex?: string | null }>>;
  };
  background: {
    preset: string;
    color: string;
  };
  camera: {
    view: number[] | null;
    defaultView: number[] | null;
    projectionMode?: "perspective" | "orthographic";
    fov?: number;
    nearClip?: number;
    farClip?: number;
    clippingMode?: "auto" | "manual";
  };
  /** Renderer-neutral presentation parameters; canonical coordinates/topology never live here. */
  representationParameters?: Record<string, number>;
  /** Stable canonical atom identities mapped to the requested representation profile. */
  atomRepresentationStyles?: Record<string, string>;
};

export type ProjectRecord = {
  id: string;
  name: string;
  schemaVersion: 1;
  revision: number;
  createdAt: string;
  updatedAt: string;
  structure: StructureLoadResult | null;
  presentation: ProjectPresentationState;
  /** Native R09 session projection; legacy fields remain for compatibility. */
  session?: SessionManifest;
  restoreStatus?: RestoreStatus;
  dirty?: boolean;
};

export type ProjectSaveRequest = {
  name?: string;
  structure: StructureLoadResult | null;
  presentation: ProjectPresentationState;
  expectedRevision?: number;
  /** Full native R09 workspace checkpoint. */
  session?: SessionDraft;
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };

export type RestoreStatus = "EXACT_RESTORED" | "DEGRADED_RESTORED" | "FAILED";
export type SessionDependencyMode = "SELF_CONTAINED" | "REFERENCED";
export type SessionRevisionType = "USER_CHECKPOINT" | "RECOVERY" | "AUTOSAVE" | "MIGRATION";

export type SessionDependency = {
  dependencyId: string;
  kind: "SOURCE_ARTIFACT" | "EXPORT_ARTIFACT" | "SESSION_COMPONENT";
  required: boolean;
  mode: SessionDependencyMode;
  uri?: string;
  provider?: string;
  expectedSha256: string;
  byteLength?: number;
  localStorageRef?: string;
};

export type SessionObjectRecord = {
  objectId: string;
  displayName: string;
  enabled: boolean;
  currentStateId: string;
  stateOrder: readonly string[];
  allStates: boolean;
  loadResult: StructureLoadResult;
  projection: JsonRecord;
  lineage: JsonRecord;
  molecularIdentityId: string;
  scientificRevisionId: string;
  retainedScientificRevisionIds: readonly string[];
};

export type DurableSelectionRecord = {
  selectionId: string;
  name?: string;
  definition: JsonRecord;
  snapshot?: JsonRecord;
  sourceRevisionRefs: readonly { objectId: string; scientificRevisionId: string }[];
  membershipHash?: string;
  disposition: "VALID" | "STALE" | "UNVALIDATED" | "UNSUPPORTED" | "FAILED";
  staleReason?: string;
};

export type DurableResultRecord = {
  resultId: string;
  kind: "MEASUREMENT" | "STRUCTURAL_ANALYSIS" | "ALIGNMENT" | "ALIGNMENT_OBJECT" | "R07" | "OTHER";
  payload: JsonValue;
  sourceRevisionRefs: readonly { objectId: string; scientificRevisionId: string }[];
  disposition: "VALID" | "STALE" | "UNVALIDATED" | "UNSUPPORTED" | "FAILED";
  staleReason?: string;
};

export type SceneStoreDimension = "VIEW" | "COLOR" | "ACTIVE" | "REPRESENTATION" | "FRAME_STATE";
export type SceneObjectReference = {
  objectId: string;
  scientificRevisionId: string;
  stateId: string;
};

export type SceneRecord = {
  schemaVersion: 1;
  sceneId: string;
  sceneRevision: number;
  name: string;
  orderIndex: number;
  activeObjectId: string | null;
  objectRefs: readonly SceneObjectReference[];
  selectionRefs: readonly string[];
  resultRefs: readonly string[];
  storeMask: readonly SceneStoreDimension[];
  presentation: JsonRecord;
  provenance: JsonRecord;
  dependencyStatus: "VALID" | "STALE" | "MISSING_DEPENDENCY";
};

export type SceneCollection = {
  schemaVersion: 1;
  scenes: readonly SceneRecord[];
  currentSceneId: string | null;
};

export type SessionDraft = {
  sessionFormatVersion?: 2;
  sessionId?: string;
  name?: string;
  documents?: readonly JsonRecord[];
  objects: readonly SessionObjectRecord[];
  activeObjectId: string | null;
  globalFrameIndex: number;
  workspaceGroups: readonly JsonRecord[];
  coordinateFramePolicy?: string | null;
  selections: readonly DurableSelectionRecord[];
  results: readonly DurableResultRecord[];
  sceneCollection: SceneCollection;
  presentationState: JsonRecord;
  activeSelection?: JsonRecord | null;
  namedSelectionSnapshots?: readonly JsonRecord[];
  dependencyMode?: SessionDependencyMode;
  dependencies?: readonly SessionDependency[];
  requiredCapabilities?: readonly string[];
  optionalCapabilities?: readonly string[];
  externalDependencyManifest?: readonly SessionDependency[];
  commandAudit?: readonly JsonRecord[];
  provenanceRefs?: readonly JsonRecord[];
  scientificPolicyVersion?: string;
  canonicalizationProfileVersion?: string;
  applicationBuildId?: string;
  recoveryMetadata?: JsonRecord | null;
};

export type SessionIntegrityEntry = {
  artifactId: string;
  kind: "SESSION_REVISION" | "SOURCE_ARTIFACT" | "EXPORT_ARTIFACT" | "SESSION_COMPONENT";
  sha256: string;
  byteLength?: number;
  storageRef?: string;
};

export type SessionManifest = SessionDraft & {
  sessionFormatVersion: 2;
  sessionId: string;
  sessionRevisionId: string;
  parentSessionRevisionIds: readonly string[];
  revisionType: SessionRevisionType;
  savedAt: string;
  integrityProfileVersion: string;
  integrity: {
    manifestSha256: string;
    entries: readonly SessionIntegrityEntry[];
  };
  migrationHistory: readonly JsonRecord[];
  restoreMetadata: JsonRecord;
};

/**
 * R07 canonical edit vocabulary.  These are domain operations, not renderer
 * or UI commands.  Unsupported operations are still represented here so later
 * editing stages extend one mutation pathway instead of creating another one.
 */
export const EDIT_OPERATION_KINDS = [
  "EDIT_DELETE_ATOMS",
  "EDIT_ADD_BOND",
  "EDIT_DELETE_BOND",
  "EDIT_REPLACE_BOND_SEMANTICS",
  "EDIT_ADD_HYDROGENS",
  "EDIT_REFILL_HYDROGENS",
  "EDIT_REMOVE_HYDROGENS",
  "EDIT_REPLACE_ATOM",
  "EDIT_ADD_ATOM_AND_BOND",
  "EDIT_ATTACH_FRAGMENT",
  "APPLY_COORDINATE_EDIT",
  "APPLY_RIGID_TRANSFORM",
] as const;

export type EditOperationKind = (typeof EDIT_OPERATION_KINDS)[number];

/** Canonical state selectors; raw compatibility sentinels are resolved before execution. */
export type EditStateSelector =
  | { kind: "CURRENT" }
  | { kind: "ALL" }
  | { kind: "EXPLICIT_ORDINAL"; ordinal: number }
  | { kind: "COORDINATE_STATE_ID"; stateId: string }
  | { kind: "APPEND" }
  | { kind: "COMMAND_DEFAULT" };

export type CanonicalEditTarget = {
  objectId?: string;
  /** Object scope for endpoint validation; more than one object is rejected in B2. */
  objectIds?: readonly string[];
  atomIds?: readonly string[];
  bondIds?: readonly string[];
  selectionResultId?: string;
};

export type CanonicalEditCommand = {
  schemaVersion: 1;
  commandId: string;
  operation: EditOperationKind;
  objectId: string;
  baseRevisionId: string;
  stateScope: EditStateSelector;
  target: CanonicalEditTarget;
  parameters: Readonly<Record<string, unknown>>;
  origin: {
    channel: "CONSOLE" | "UI" | "API" | "TEST";
    actionId?: string;
    rawCommand?: string;
  };
  provenance: {
    producerId: string;
    producerVersion: string;
    requestedAt: string;
    actor?: string;
    metadata?: Readonly<Record<string, string>>;
  };
};

/** R10: the shared, transport-independent scientific command vocabulary. */
export const COMMAND_REGISTRY_VERSION = "r10-command-registry.v1" as const;
export const COMMAND_SCHEMA_VERSION = "r10-command-schema.v1" as const;
export const SAFE_PYMOL_COMPAT_PROFILE = "SAFE_PYMOL_COMPAT" as const;

export const COMMAND_EFFECT_CLASSES = [
  "READ_ONLY_QUERY",
  "VISUAL_MUTATION",
  "SCIENTIFIC_MUTATION",
  "LONG_RUNNING_SCIENTIFIC",
  "EXTERNAL_IO",
  "ADMINISTRATIVE",
] as const;
export type CommandEffectClass = (typeof COMMAND_EFFECT_CLASSES)[number];

export const COMMAND_SAFETY_CLASSES = ["SAFE_TRANSLATABLE", "SAFE_BUT_NOT_IMPLEMENTED", "UNSAFE_REJECTED", "REFERENCE_ONLY_OUT_OF_SCOPE", "INTENTIONAL_DIVERGENCE"] as const;
export type CommandSafetyClass = (typeof COMMAND_SAFETY_CLASSES)[number];
export const COMMAND_RESOURCE_CLASSES = ["TINY", "BOUNDED", "LONG_RUNNING", "EXTERNAL"] as const;
export type CommandResourceClass = (typeof COMMAND_RESOURCE_CLASSES)[number];
export const COMMAND_EXECUTION_MODES = ["SYNC", "ASYNC", "AUTO"] as const;
export type CommandExecutionMode = (typeof COMMAND_EXECUTION_MODES)[number];

export type CommandArgumentType = "string" | "number" | "integer" | "float" | "float3" | "boolean" | "enum" | "color" | "selection" | "object" | "state" | "json";
export type CommandArgumentSpec = {
  name: string;
  type: CommandArgumentType;
  required?: boolean;
  positional?: boolean;
  repeated?: boolean;
  enumValues?: readonly string[];
  defaultValue?: JsonValue;
  description: string;
};

export type CommandSpec = {
  commandType: string;
  canonicalName: string;
  registryVersion: typeof COMMAND_REGISTRY_VERSION;
  schemaVersion: typeof COMMAND_SCHEMA_VERSION;
  aliasesByProfile: Readonly<Record<string, readonly string[]>>;
  arguments: readonly CommandArgumentSpec[];
  outputSchema: JsonRecord;
  selectionFields?: readonly string[];
  objectFields?: readonly string[];
  stateFields?: readonly string[];
  settingFields?: readonly string[];
  effectClass: CommandEffectClass;
  capabilityKey: string;
  capabilityState: CapabilityState;
  safetyClass: CommandSafetyClass;
  deterministic: boolean;
  synchronization: CommandExecutionMode;
  resourceClass: CommandResourceClass;
  handlerKey: string;
  provenanceVersion: string;
  replayVersion: string;
  deprecated?: boolean;
  pymolReference?: { sourceCommit: string; publicNames: readonly string[]; parserMode?: string; oracleStatus: "ORACLE_PASS" | "ORACLE_EQUIVALENT" | "ORACLE_PENDING" | "NOT_APPLICABLE" };
  knownDivergences?: readonly string[];
};

export type CommandDiagnosticCode =
  | "UNKNOWN_COMMAND" | "AMBIGUOUS_COMMAND" | "UNSAFE_COMMAND_REJECTED" | "INVALID_ARGUMENT" | "UNKNOWN_ARGUMENT"
  | "DUPLICATE_ARGUMENT" | "MISSING_REQUIRED_ARGUMENT" | "INVALID_SELECTION" | "SELECTION_BINDING_FAILED"
  | "OBJECT_NOT_FOUND" | "AMBIGUOUS_OBJECT" | "STATE_OUT_OF_RANGE" | "INVALID_SETTING" | "UNSUPPORTED_SETTING_SCOPE"
  | "UNSUPPORTED_COMMAND_SEMANTICS" | "UNSUPPORTED_CAPABILITY" | "REVISION_CONFLICT" | "PRECONDITION_FAILED"
  | "RESOURCE_LIMIT_EXCEEDED" | "EXTERNAL_IO_REJECTED" | "EXECUTION_FAILED" | "PROVENANCE_COMMIT_FAILED"
  | "PARTIAL_BATCH" | "REFERENCE_UNAVAILABLE" | "ORACLE_MISMATCH";

export type CommandDiagnostic = {
  code: CommandDiagnosticCode;
  message: string;
  sourceSpan?: { start: number; end: number };
  argumentPath?: string;
  retryable?: boolean;
  details?: JsonRecord;
};

export type BoundCommandRefs = {
  objectIds?: readonly string[];
  selectionIds?: readonly string[];
  stateIds?: readonly string[];
  settingScopes?: readonly string[];
};

export type CanonicalCommand = {
  commandId: string;
  commandType: string;
  commandVersion: string;
  schemaVersion: typeof COMMAND_SCHEMA_VERSION;
  normalizedArgs: JsonRecord;
  boundRefs: BoundCommandRefs;
  target?: { sessionId?: string; projectId?: string; documentId?: string };
  expectedRevisions?: Readonly<Record<string, string | number>>;
  origin: {
    surface: "GUI" | "CONSOLE" | "REST" | "SDK" | "MACRO" | "BATCH";
    profile: string;
    profileVersion: string;
    syntaxVersion: string;
    sourceHash: string;
    sourceTextRef?: string;
    sourceText?: string;
    resolvedPublicName?: string;
    sourceMap?: { start: number; end: number; argumentSpans?: Readonly<Record<string, { start: number; end: number }>> };
  };
  requestedMode: CommandExecutionMode;
  parentCommandId?: string;
  workflowId?: string;
  correlationId: string;
  idempotencyKey?: string;
  submittedAt: string;
  semanticHash: string;
};

/** Cross-runtime semantic hash: stable serialization plus FNV-1a keeps GUI, REST, SDK and macro comparisons deterministic without transport metadata. */
export const canonicalStableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStableSerialize).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalStableSerialize((value as Record<string, unknown>)[key])}`).join(",")}}`;
};
export const canonicalSemanticHash = (value: { commandType: string; commandVersion: string; normalizedArgs: JsonRecord; boundRefs: BoundCommandRefs; policy: string }): string => {
  const input = canonicalStableSerialize(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const COMMAND_JOB_STATES = ["Created", "Queued", "Running", "Completed", "Failed", "Cancelled"] as const;
export type CommandJobState = (typeof COMMAND_JOB_STATES)[number];

export type CommandResult<T extends JsonValue = JsonValue> = {
  commandId: string;
  executionId: string;
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  payload?: T;
  artifacts?: readonly JsonRecord[];
  revisions?: Readonly<Record<string, string | number>>;
  diagnostics: readonly CommandDiagnostic[];
  warnings: readonly CommandDiagnostic[];
  actionRecordId?: string;
  provenanceRef?: string;
  job?: { jobId: string; state: CommandJobState };
};

export type CommandReplayMode = "REVIEW" | "COMMAND_REPLAY" | "REPRODUCTION_ATTEMPT";

export type CommandJob = {
  jobId: string;
  commandId: string;
  executionId: string;
  attempt: number;
  state: CommandJobState;
  createdAt: string;
  updatedAt: string;
  result?: CommandResult;
  cancellationRequestedAt?: string;
  previousAttemptId?: string;
};

export type ActionRecord = {
  schemaVersion: 1;
  actionRecordId: string;
  commandId: string;
  executionId: string;
  rawIntentRef?: string;
  sourceHash: string;
  canonicalCommand: CanonicalCommand;
  registryVersion: string;
  commandSchemaVersion: typeof COMMAND_SCHEMA_VERSION;
  compatibilityProfile: string;
  policyVersion: string;
  handlerVersion: string;
  inputRevisionRefs: readonly string[];
  inputArtifactHashes: readonly string[];
  outputRefs: readonly string[];
  outputHashes: readonly string[];
  validation: readonly CommandDiagnostic[];
  attempt: number;
  inputRef?: string;
  outputRef?: string;
  status: CommandJobState | "SUCCEEDED" | "FAILED" | "CANCELLED";
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  parentCommandId?: string;
  correlationId: string;
  idempotencyKey?: string;
  diagnostics: readonly CommandDiagnostic[];
  redactedSecrets: readonly string[];
};

export const SETTING_SCOPES = ["GLOBAL", "OBJECT", "OBJECT_STATE", "ATOM_SELECTION", "BOND_SELECTION"] as const;
export type SettingScope = (typeof SETTING_SCOPES)[number];
export type SettingValueType = "string" | "integer" | "float" | "float3" | "boolean" | "enum" | "color";
export type SettingSpec = {
  name: string;
  aliases: readonly string[];
  valueType: SettingValueType;
  scope: readonly SettingScope[];
  defaultValue: JsonValue;
  version: string;
  inheritance: "DEFAULT" | "GLOBAL_THEN_OBJECT" | "GLOBAL_THEN_OBJECT_STATE" | "GLOBAL_THEN_SELECTION";
  classification: "PRESENTATION" | "SCIENTIFIC" | "LIFECYCLE";
  enumValues?: readonly string[];
  min?: number;
  max?: number;
  description: string;
  capabilityState: CapabilityState;
};
export type SettingValue = { name: string; value: JsonValue; scope: SettingScope; targetId?: string; revision: number };

export type MacroNode = {
  nodeId: string;
  command?: CanonicalCommand;
  macroId?: string;
  dependsOn?: readonly string[];
  foreach?: { values: readonly JsonValue[]; itemArg: string };
};
export type MacroDefinition = {
  schemaVersion: 1;
  macroId: string;
  name: string;
  version: string;
  nodes: readonly MacroNode[];
  maxNodes: number;
  maxIterations: number;
  errorPolicy: "STOP_ON_ERROR" | "CONTINUE_WITH_RECORDED_FAILURES";
  deterministic: boolean;
  contentHash: string;
  parameters?: readonly { name: string; type: CommandArgumentType; required?: boolean }[];
  declaredOutputs?: readonly string[];
  requiredCapabilities?: readonly string[];
  resourcePolicy?: { maxCommands: number; maxDurationMs?: number };
  provenance: { author?: string; createdAt: string; sourceHash: string };
};

export type PyMolInventoryDisposition = "SAFE_TRANSLATABLE" | "SAFE_BUT_NOT_IMPLEMENTED" | "ORACLE_PENDING" | "UNSAFE_REJECTED" | "REFERENCE_ONLY_OUT_OF_SCOPE" | "INTENTIONAL_DIVERGENCE";
export type PyMolInventoryEntry = {
  publicName: string;
  aliases: readonly string[];
  parserMode?: string;
  disposition: PyMolInventoryDisposition;
  canonicalCommandType?: string;
  effectClass: CommandEffectClass;
  capabilityState: CapabilityState;
  oracleStatus: "ORACLE_PASS" | "ORACLE_EQUIVALENT" | "ORACLE_PENDING" | "NOT_APPLICABLE";
  sourceCommit: string;
  notes?: readonly string[];
};
