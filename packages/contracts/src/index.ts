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

export const STRUCTURE_FORMATS = ["pdb", "mmcif"] as const;
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
};

export type StructureError = {
  code: "UNSUPPORTED_FORMAT" | "INVALID_INPUT" | "REMOTE_FETCH_FAILED" | "REMOTE_NOT_FOUND" | "PAYLOAD_TOO_LARGE" | "PROJECT_NOT_FOUND" | "PROJECT_INVALID" | "INTERNAL_ERROR";
  message: string;
};

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
};

export type ProjectSaveRequest = {
  name?: string;
  structure: StructureLoadResult | null;
  presentation: ProjectPresentationState;
  expectedRevision?: number;
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
  "EDIT_REMOVE_HYDROGENS",
  "EDIT_REPLACE_ATOM",
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
