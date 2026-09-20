import type { F64Bits } from "./canonical.js";
import type {
  ArtifactByteDigest,
  ChemicalStateDigest,
  CoordinateStateDigest,
  LigandKinematicModelDigest,
  MolecularIdentityDigest,
  PreparedLigandDigest,
  PreparedReceptorDigest,
  ProvenanceRecordDigest,
  SearchRegionDigest,
  SourceArtifactId,
} from "./identity.js";

export const D2_SCHEMA_VERSION = 1 as const;
export const D2_CORE_PROFILE_ID = "ME_DOCKING_V1_CORE_EXPLICIT_STATE_1_0" as const;
export const D2_RECEPTOR_PROFILE_ID = "ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0" as const;
export const D2_LIGAND_PROFILE_ID = "ME_DOCKING_V1_LIGAND_EXPLICIT_STATE_1_0" as const;
export const D2_SEARCH_REGION_PROFILE_ID = "ME_DOCKING_V1_SEARCH_REGION_AABB_1_0" as const;
export const D2_KINEMATIC_PROFILE_ID = "ME_DOCKING_V1_KINEMATIC_MODEL_1_0" as const;

export const D2_VALIDATION_STATUSES = ["VALID", "INVALID", "AMBIGUOUS", "UNSUPPORTED", "RESOURCE_REJECTED"] as const;
export type D2ValidationStatus = (typeof D2_VALIDATION_STATUSES)[number];

export type D2DiagnosticSeverity = "ERROR" | "WARNING";
export type D2Diagnostic = Readonly<{
  code: string;
  severity: D2DiagnosticSeverity;
  blocking: boolean;
  message: string;
  path?: string;
  objectRef?: string;
}>;

export type D2SealResult<T> = Readonly<{
  status: D2ValidationStatus;
  value?: T;
  diagnostics: readonly D2Diagnostic[];
  provenance?: D2ProvenanceRecordV1;
}>;

export type D2AtomUID = string & { readonly __d2AtomUID: unique symbol };
export type D2BondUID = string & { readonly __d2BondUID: unique symbol };
export type D2ComponentId = string & { readonly __d2ComponentId: unique symbol };
export type D2CoordinateFrameId = string & { readonly __d2CoordinateFrameId: unique symbol };
export type D2SelectionProfileId = string & { readonly __d2SelectionProfileId: unique symbol };

export type D2SourceAlias = Readonly<{
  sourceNamespace: "PDB_AUTH" | "PDB_LABEL" | "MMCIF_AUTH" | "MMCIF_LABEL" | "SDF" | "MOL2" | "PDBQT" | "SMILES" | "INTERNAL";
  sourceSerial?: number;
  sourceIndex?: number;
  modelNumber?: number;
  chainId?: string;
  residueId?: string;
  insertionCode?: string;
  atomName?: string;
  altLoc?: string;
}>;

export type D2GraphAtomV1 = Readonly<{
  atomUid: D2AtomUID;
  element: string;
  atomName: string;
  componentId: D2ComponentId;
  formalCharge?: number | null;
  aliases: readonly D2SourceAlias[];
}>;

export type D2BondOrder = "SINGLE" | "DOUBLE" | "TRIPLE" | "AROMATIC" | "UNKNOWN";
export type D2BondEvidence = "SOURCE_EXPLICIT" | "SOURCE_INFERRED" | "IMPORTED_EXECUTION" | "UNKNOWN";

export type D2GraphBondV1 = Readonly<{
  bondUid: D2BondUID;
  atom1Uid: D2AtomUID;
  atom2Uid: D2AtomUID;
  order: D2BondOrder;
  evidence: D2BondEvidence;
  sourceRef?: string;
}>;

export type D2GraphComponentV1 = Readonly<{
  componentId: D2ComponentId;
  role: "POLYMER" | "LIGAND" | "WATER" | "ION" | "COFACTOR" | "REFERENCE_LIGAND" | "UNKNOWN";
  atomUids: readonly D2AtomUID[];
  sourceRefs: readonly string[];
}>;

export type D2MolecularGraphRevisionV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_MOLECULAR_GRAPH_REVISION_V1";
  revisionId: string;
  atoms: readonly D2GraphAtomV1[];
  bonds: readonly D2GraphBondV1[];
  components: readonly D2GraphComponentV1[];
  sourceArtifactIds: readonly SourceArtifactId[];
  digest: MolecularIdentityDigest;
}>;

export type D2MolecularIdentityV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_MOLECULAR_IDENTITY_V1";
  identityId: string;
  graphRevisionDigest: MolecularIdentityDigest;
  sourceArtifactRefs: readonly Readonly<{ sourceArtifactId: SourceArtifactId; artifactByteDigest: ArtifactByteDigest }>[];
  digest: MolecularIdentityDigest;
}>;

export type D2StereoStatus = "KNOWN" | "DERIVED" | "UNSPECIFIED" | "UNKNOWN" | "CONTRADICTORY";
export type D2StateResolution = "EXPLICIT_SUBMITTED" | "EXPLICIT_DERIVED_PROFILE" | "GENERATED_PROFILE" | "AMBIGUOUS" | "UNKNOWN";

export type D2ChemicalStateV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_CHEMICAL_STATE_V1";
  stateId: string;
  molecularIdentityDigest: MolecularIdentityDigest;
  resolution: D2StateResolution;
  targetPH?: number;
  protonationProfileId?: string;
  tautomerStateId?: string;
  formalCharges: Readonly<Record<D2AtomUID, number | null>>;
  stereo: readonly Readonly<{ atomUid: D2AtomUID; status: D2StereoStatus; descriptor?: string }>[];
  selectedComponentIds: readonly D2ComponentId[];
  sourceEvidenceRefs: readonly string[];
  digest: ChemicalStateDigest;
}>;

export type D2CoordinateStateV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_COORDINATE_STATE_V1";
  stateId: string;
  chemicalStateDigest: ChemicalStateDigest;
  coordinateFrame: D2CoordinateFrameId;
  coordinateUnits: "ANGSTROM";
  dimensionality: 3;
  origin: readonly [F64Bits, F64Bits, F64Bits];
  coordinates: Readonly<Record<D2AtomUID, readonly [F64Bits, F64Bits, F64Bits]>>;
  sourceArtifactRefs: readonly string[];
  derivedFromCoordinateStateDigest?: CoordinateStateDigest;
  digest: CoordinateStateDigest;
}>;

export type D2ProvenanceRecordV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_PROVENANCE_RECORD_V1";
  recordId: string;
  operation: string;
  softwareRef: string;
  profileId: string;
  inputDigests: readonly string[];
  sourceArtifactRefs: readonly string[];
  mappingRefs: readonly string[];
  informationLoss: readonly Readonly<{ field: string; status: "PRESERVED" | "DERIVED" | "UNKNOWN" | "DROPPED" | "UNSUPPORTED"; explanation: string }>[];
  digest: ProvenanceRecordDigest;
}>;

export type D2AtomCorrespondenceMapV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  mapId: string;
  sourceToCanonical: Readonly<Record<string, D2AtomUID>>;
  canonicalToSource: Readonly<Record<D2AtomUID, readonly D2SourceAlias[]>>;
  sourceArtifactDigest: ArtifactByteDigest;
  digest: ProvenanceRecordDigest;
}>;

export type D2ReceptorAssemblySelection = Readonly<{
  selectionKind: "EXPLICIT_ASSEMBLY" | "EXPLICIT_ASYMMETRIC_UNIT" | "EXPLICIT_OPERATOR_APPLIED";
  assemblyId: string;
  membershipDigest: ProvenanceRecordDigest;
}>;

export type D2AltlocResolution = Readonly<{
  policy: "PRESERVE_ALL" | "COHERENT_MAX_OCCUPANCY_V1" | "EXPLICIT_LABEL";
  status: "NOT_APPLICABLE" | "UNIQUE" | "AMBIGUOUS";
  selectedLabels?: Readonly<Record<string, string>>;
  evidenceRef?: string;
}>;

export type D2ReceptorComponentRoleV1 = Readonly<{
  componentId: D2ComponentId;
  role: "CORE" | "FIXED_WATER" | "MOBILE_WATER" | "ION" | "COFACTOR" | "REFERENCE_LIGAND" | "OTHER";
  evidenceRefs: readonly string[];
}>;

export type D2PreparedReceptorStateV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_PREPARED_RECEPTOR_STATE_V1";
  preparedStateId: string;
  receptorIdentity: D2MolecularIdentityV1;
  graphRevision: D2MolecularGraphRevisionV1;
  chemicalState: D2ChemicalStateV1;
  coordinateState: D2CoordinateStateV1;
  assembly: D2ReceptorAssemblySelection;
  modelNumber: number;
  chainIds: readonly string[];
  altlocResolution: D2AltlocResolution;
  componentRoles: readonly D2ReceptorComponentRoleV1[];
  profileId: typeof D2_RECEPTOR_PROFILE_ID;
  siteCriticalAtomUids: readonly D2AtomUID[];
  validationDigest: ProvenanceRecordDigest;
  provenance: D2ProvenanceRecordV1;
  digest: PreparedReceptorDigest;
}>;

export type D2AtomTypingAssignmentV1 = Readonly<{
  atomUid: D2AtomUID;
  typeId: string;
  chargeModel: string;
  partialCharge?: F64Bits;
  evidenceRef: string;
}>;

export type D2KinematicFragmentV1 = Readonly<{
  fragmentId: string;
  atomUids: readonly D2AtomUID[];
}>;

export type D2RotatableEdgeV1 = Readonly<{
  bondUid: D2BondUID;
  atom1Uid: D2AtomUID;
  atom2Uid: D2AtomUID;
  parentFragmentId: string;
  childFragmentId: string;
  movingAtomUids: readonly D2AtomUID[];
  axisOrigin: readonly [F64Bits, F64Bits, F64Bits];
  axisDirection: readonly [F64Bits, F64Bits, F64Bits];
  domain: "FULL_TURN" | "RESTRICTED_PROFILE";
  periodicity: number;
  terminalHydrogenOnly: boolean;
  ringBond: boolean;
  restrictedBond: boolean;
  searchTorsion: boolean;
  scorerTorsion: boolean;
  evidenceRefs: readonly string[];
}>;

export type D2LigandKinematicModelV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_LIGAND_KINEMATIC_MODEL_V1";
  modelId: string;
  molecularIdentityDigest: MolecularIdentityDigest;
  rootAtomUid: D2AtomUID;
  fragments: readonly D2KinematicFragmentV1[];
  rotatableEdges: readonly D2RotatableEdgeV1[];
  searchTorsionCount: number;
  scorerTorsionCount: number;
  profileId: typeof D2_KINEMATIC_PROFILE_ID;
  provenance: D2ProvenanceRecordV1;
  digest: LigandKinematicModelDigest;
}>;

export type D2PreparedLigandStateV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_PREPARED_LIGAND_STATE_V1";
  preparedStateId: string;
  molecularIdentity: D2MolecularIdentityV1;
  graphRevision: D2MolecularGraphRevisionV1;
  chemicalState: D2ChemicalStateV1;
  coordinateState: D2CoordinateStateV1;
  selectedComponentId: D2ComponentId;
  atomTyping: readonly D2AtomTypingAssignmentV1[];
  kinematicModel: D2LigandKinematicModelV1;
  profileId: typeof D2_LIGAND_PROFILE_ID;
  provenance: D2ProvenanceRecordV1;
  digest: PreparedLigandDigest;
}>;

export type D2SearchRegionV1 = Readonly<{
  schemaVersion: typeof D2_SCHEMA_VERSION;
  semanticSchemaId: "D2_SEARCH_REGION_V1";
  searchRegionId: string;
  bindingSiteRef: string;
  preparedReceptorDigest: PreparedReceptorDigest;
  coordinateStateDigest: CoordinateStateDigest;
  coordinateFrame: D2CoordinateFrameId;
  geometryType: "AXIS_ALIGNED_BOX_V1";
  min: readonly [F64Bits, F64Bits, F64Bits];
  max: readonly [F64Bits, F64Bits, F64Bits];
  center: readonly [F64Bits, F64Bits, F64Bits];
  fullExtents: readonly [F64Bits, F64Bits, F64Bits];
  units: "ANGSTROM";
  boundary: "CLOSED_AABB_V1";
  posePolicy: "ALL_LIGAND_HEAVY_ATOMS_IN_OR_ON";
  derivationMode: "EXPLICIT_BOUNDS" | "REFERENCE_LIGAND_ENVELOPE";
  paddingAngstrom: readonly [F64Bits, F64Bits, F64Bits];
  fixedAcrossLigandStates: boolean;
  provenance: D2ProvenanceRecordV1;
  digest: SearchRegionDigest;
}>;

export const D2_SUPPORTED_CORE_ELEMENTS = Object.freeze(["H", "C", "N", "O", "F", "P", "S", "CL", "BR", "I"] as const);
export type D2SupportedCoreElement = (typeof D2_SUPPORTED_CORE_ELEMENTS)[number];
