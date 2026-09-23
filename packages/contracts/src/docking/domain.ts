import type { F64Bits } from "./canonical.js";
import type {
  ArtifactByteDigest,
  BackendBuildDigest,
  BackendEquivalenceRecordDigest,
  BackendEquivalenceRecordId,
  BenchmarkDigest,
  CampaignManifestDigest,
  CampaignManifestId,
  CampaignResultDigest,
  CampaignResultId,
  CampaignUnitDigest,
  CampaignUnitId,
  ChemicalStateDigest,
  ChemicalStateId,
  CompoundDockingAggregateDigest,
  CompoundDockingAggregateId,
  CoordinateStateDigest,
  CoordinateStateId,
  DatasetDigest,
  DockingAttemptDigest,
  DockingAttemptId,
  DockingPoseSetDigest,
  DockingPoseSetId,
  ExecutionAttemptDigest,
  ExecutionAttemptId,
  FailureRecordDigest,
  FailureRecordId,
  LigandKinematicModelDigest,
  LigandKinematicModelId,
  MolecularIdentityDigest,
  MolecularIdentityId,
  OpaqueScientificId,
  PoseCoordinateDigest,
  PoseRecordDigest,
  PoseRecordId,
  PreparedLigandDigest,
  PreparedLigandStateId,
  PreparedReceptorDigest,
  PreparedReceptorStateId,
  ProfileDigest,
  ProtocolDigest,
  ProvenanceRecordDigest,
  ProvenanceRecordId,
  ReplayManifestDigest,
  ReplayManifestId,
  ResultDigest,
  SearchCandidateDigest,
  SearchCandidateId,
  SearchRegionDigest,
  SearchRegionId,
  SourceArtifactId,
  StateDockingResultDigest,
  StateDockingResultId,
  ValidationRecordDigest,
  ValidationRecordId,
  EnvironmentDigest,
} from "./identity.js";
import type {
  BackendValidationEquivalenceStatus,
  CampaignCompletionStatus,
  CapabilityAssessmentStatus,
  DurableJobStatus,
  ExecutionEventType,
  ScientificResultStatus,
} from "./status.js";

export type SourceArtifactRef = Readonly<{
  sourceArtifactId: SourceArtifactId;
  artifactByteDigest: ArtifactByteDigest;
}>;

export type MolecularIdentity = Readonly<{
  schemaVersion: 1;
  semanticSchemaId: "MOLECULAR_IDENTITY_V1";
  molecularIdentityId: MolecularIdentityId;
  digest: MolecularIdentityDigest;
  sourceArtifactRefs: readonly SourceArtifactRef[];
}>;

export type ChemicalState = Readonly<{
  schemaVersion: 1;
  semanticSchemaId: "CHEMICAL_STATE_V1";
  chemicalStateId: ChemicalStateId;
  molecularIdentityDigest: MolecularIdentityDigest;
  digest: ChemicalStateDigest;
}>;

export type CoordinateState = Readonly<{
  schemaVersion: 1;
  semanticSchemaId: "COORDINATE_STATE_V1";
  coordinateStateId: CoordinateStateId;
  chemicalStateDigest: ChemicalStateDigest;
  digest: CoordinateStateDigest;
  coordinateFrame: string;
  coordinateUnits: string;
}>;

export type PreparedReceptorStateRef = Readonly<{
  kind: "PREPARED_RECEPTOR_STATE";
  preparedReceptorStateId: PreparedReceptorStateId;
  digest: PreparedReceptorDigest;
}>;

export type PreparedLigandStateRef = Readonly<{
  kind: "PREPARED_LIGAND_STATE";
  preparedLigandStateId: PreparedLigandStateId;
  digest: PreparedLigandDigest;
}>;

export type LigandKinematicModelRef = Readonly<{
  kind: "LIGAND_KINEMATIC_MODEL";
  ligandKinematicModelId: LigandKinematicModelId;
  digest: LigandKinematicModelDigest;
}>;

export type SearchRegionRef = Readonly<{
  kind: "SEARCH_REGION";
  scientificAuthority: "SCIENTIFIC_POSE_ADMISSIBILITY";
  searchRegionId: SearchRegionId;
  digest: SearchRegionDigest;
  receptorCoordinateFrame: string;
}>;

export type DerivedExecutionRepresentationRef = Readonly<{
  kind: "DERIVED_EXECUTION_REPRESENTATION";
  format: string;
  sourceScientificDigest: MolecularIdentityDigest | ChemicalStateDigest | CoordinateStateDigest | PreparedReceptorDigest | PreparedLigandDigest;
  artifactByteDigest?: ArtifactByteDigest;
  authoritativeForMolecularIdentity: false;
}>;

export type PdbqtExecutionRepresentationRef = DerivedExecutionRepresentationRef & Readonly<{
  format: "PDBQT";
  authoritativeForMolecularIdentity: false;
}>;

export type DockingAttempt = Readonly<{
  dockingAttemptId: DockingAttemptId;
  digest: DockingAttemptDigest;
  requestDigest: import("./identity.js").DockingRequestDigest;
  receptorStateDigest: PreparedReceptorDigest;
  ligandStateDigest: PreparedLigandDigest;
}>;

export type ExecutionAttempt = Readonly<{
  executionAttemptId: ExecutionAttemptId;
  digest: ExecutionAttemptDigest;
  dockingAttemptId: DockingAttemptId;
  ordinal: number;
  backendProfileDigest: import("./identity.js").NumericalBackendProfileDigest;
  logicalRngSpecificationDigest: import("./identity.js").ProfileDigest;
  status: DurableJobStatus;
  previousExecutionAttemptId?: ExecutionAttemptId;
}>;

export type SearchCandidate = Readonly<{
  searchCandidateId: SearchCandidateId;
  digest: SearchCandidateDigest;
  dockingAttemptId: DockingAttemptId;
  sourceExecutionAttemptId: ExecutionAttemptId;
  trajectoryId: OpaqueScientificId<"TrajectoryId">;
  terminalEligible: boolean;
}>;

export type PoseValidityStatus = "NOT_EVALUATED" | "VALID" | "INVALID" | "NON_EVALUABLE";
export type PosePlausibilityStatus = "NOT_EVALUATED" | "PLAUSIBLE" | "IMPLAUSIBLE" | "NON_EVALUABLE";

export type PoseRecord = Readonly<{
  poseRecordId: PoseRecordId;
  digest: PoseRecordDigest;
  dockingAttemptId: DockingAttemptId;
  sourceCandidateId: SearchCandidateId;
  preparedReceptorDigest: PreparedReceptorDigest;
  preparedLigandDigest: PreparedLigandDigest;
  poseCoordinatesDigest: PoseCoordinateDigest;
  scoreBits: F64Bits;
  validityStatus: PoseValidityStatus;
  plausibilityStatus: PosePlausibilityStatus;
}>;

export type DockingPoseSet = Readonly<{
  dockingPoseSetId: DockingPoseSetId;
  digest: DockingPoseSetDigest;
  dockingAttemptId: DockingAttemptId;
  poseRecordDigests: readonly PoseRecordDigest[];
}>;

export type StateDockingResult = Readonly<{
  stateDockingResultId: StateDockingResultId;
  digest: StateDockingResultDigest;
  preparedReceptorDigest: PreparedReceptorDigest;
  preparedLigandDigest: PreparedLigandDigest;
  scientificResultStatus: ScientificResultStatus;
  poseSetDigest?: DockingPoseSetDigest;
}>;

export type CompoundDockingAggregate = Readonly<{
  compoundDockingAggregateId: CompoundDockingAggregateId;
  digest: CompoundDockingAggregateDigest;
  molecularIdentityDigest: MolecularIdentityDigest;
  statePolicy: "STATE_SEPARATE_NO_CANONICAL_SCORE_V1";
  stateResultDigests: readonly StateDockingResultDigest[];
}>;

export type CampaignManifest = Readonly<{
  campaignManifestId: CampaignManifestId;
  digest: CampaignManifestDigest;
  stateAggregationProfile: "ME_CAMP_AGG_STATE_SEPARATE_V1_1_0";
  statePolicy: "STATE_SEPARATE_NO_CANONICAL_SCORE_V1";
  campaignUnitDigests: readonly CampaignUnitDigest[];
}>;

export type CampaignUnit = Readonly<{
  campaignUnitId: CampaignUnitId;
  digest: CampaignUnitDigest;
  preparedReceptorDigest: PreparedReceptorDigest;
  preparedLigandDigest: PreparedLigandDigest;
  dockingAttemptId: DockingAttemptId;
}>;

export type CampaignResult = Readonly<{
  campaignResultId: CampaignResultId;
  digest: CampaignResultDigest;
  manifestDigest: CampaignManifestDigest;
  status: CampaignCompletionStatus;
  requestedUnits: number;
  completedUnits: number;
  failedUnits: number;
  unsupportedUnits: number;
  stateResultDigests: readonly StateDockingResultDigest[];
}>;

export type ValidationRecord = Readonly<{
  validationRecordId: ValidationRecordId;
  digest: ValidationRecordDigest;
  benchmarkDigest: BenchmarkDigest;
  protocolDigest: ProtocolDigest;
  profileDigests: readonly ProfileDigest[];
  datasetDigest: DatasetDigest;
  resultDigest: ResultDigest;
  qualificationOutcome: "PASS" | "FAIL" | "NOT_EVALUATED";
}>;

export type ReplayManifest = Readonly<{
  replayManifestId: ReplayManifestId;
  digest: ReplayManifestDigest;
  requestDigest: import("./identity.js").DockingRequestDigest;
  profileDigests: readonly ProfileDigest[];
  provenanceRecordId: ProvenanceRecordId;
}>;

export type ProvenanceRecord = Readonly<{
  provenanceRecordId: ProvenanceRecordId;
  digest: ProvenanceRecordDigest;
  scientificInputDigests: readonly string[];
  profileDigests: readonly ProfileDigest[];
  executionAttemptIds: readonly ExecutionAttemptId[];
}>;

export type FailureRecord = Readonly<{
  failureRecordId: FailureRecordId;
  digest: FailureRecordDigest;
  stageKind: "SCIENTIFIC" | "TECHNICAL";
  stage: string;
  stableCode: string;
  blocking: boolean;
  retryable: boolean;
  dockingAttemptId?: DockingAttemptId;
  executionAttemptId?: ExecutionAttemptId;
  provenanceRecordId?: ProvenanceRecordId;
}>;

export type BackendEquivalenceRecord = Readonly<{
  backendEquivalenceRecordId: BackendEquivalenceRecordId;
  digest: BackendEquivalenceRecordDigest;
  backendBuildDigest: BackendBuildDigest;
  environmentDigest: EnvironmentDigest;
  referenceProfileDigest: ProfileDigest;
  candidateProfileDigest: ProfileDigest;
  status: BackendValidationEquivalenceStatus;
  evidenceResultDigest: ResultDigest;
}>;

export type CapabilityAssessmentV1 = Readonly<{
  assessmentId: OpaqueScientificId<"CapabilityAssessmentId">;
  taskType: OpaqueScientificId<"DockingTaskType">;
  status: CapabilityAssessmentStatus;
  reasonCodes: readonly string[];
  affectedObjectRefs: readonly string[];
  profileBundleDigest: ProfileDigest;
  scientificLayerAssessment: Readonly<{
    representable: boolean;
    preparable: boolean;
    typeable: boolean;
    scorable: boolean;
    searchable: boolean;
    validated: boolean;
    productSupported: boolean;
  }>;
  userSummary: string;
  scientificExplanation: string;
  allowedCorrections: readonly string[];
  claimLimits: readonly string[];
  assessmentDigest: ProfileDigest;
}>;

export type DockingLifecycleEventV1 = Readonly<{
  eventId: OpaqueScientificId<"DockingLifecycleEventId">;
  jobId: OpaqueScientificId<"DockingJobId">;
  executionAttemptId?: ExecutionAttemptId;
  eventType: ExecutionEventType;
  timestamp: string;
  sequence: number;
  reasonCode?: string;
  actorSoftwareRef: string;
  provenanceRef: ProvenanceRecordId;
}>;

export type DockingJobV1 = Readonly<{
  jobId: OpaqueScientificId<"DockingJobId">;
  requestDigest: import("./identity.js").DockingRequestDigest;
  status: DurableJobStatus;
}>;

export type DockingResultEnvelopeV1 = Readonly<{
  jobId: OpaqueScientificId<"DockingJobId">;
  requestDigest: import("./identity.js").DockingRequestDigest;
  scientificResultStatus: ScientificResultStatus;
  poseRecordRefs: readonly PoseRecordDigest[];
  finalModeRefs: readonly PoseRecordDigest[];
  warnings: readonly import("./status.js").ScientificWarningV1[];
  errors: readonly import("./status.js").ScientificErrorV1[];
  backendProfileDigest: import("./identity.js").NumericalBackendProfileDigest;
  backendEquivalenceStatus: BackendValidationEquivalenceStatus;
  validationStatus: BackendValidationEquivalenceStatus;
  resultDigest: ResultDigest;
  provenanceRef: ProvenanceRecordId;
  replayManifestRef: ReplayManifestId;
  exportOptions: readonly string[];
  cacheReuseDisclosure: string;
}>;
