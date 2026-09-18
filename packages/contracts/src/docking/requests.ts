import { DOCKING_CANONICALIZATION_PROFILE } from "./canonical.js";
import type {
  CachePolicyDigest,
  CapabilityProfileDigest,
  ClusteringProfileDigest,
  DockingDraftDigest,
  DockingDraftRequestId,
  DockingRequestDigest,
  DockingRequestId,
  FinalModeProfileDigest,
  NumericalBackendProfileDigest,
  OpaqueScientificId,
  PlausibilityProfileDigest,
  PreflightReportDigest,
  PreparedLigandDigest,
  PreparedReceptorDigest,
  ProfileDigest,
  ProvenancePolicyDigest,
  ResourcePolicyProfileDigest,
  ResultPolicyDigest,
  RmsdProfileDigest,
  ScoringProfileDigest,
  SearchProfileDigest,
  SearchRegionDigest,
  TieProfileDigest,
  ValidationProfileDigest,
} from "./identity.js";
import type { CapabilityAssessmentV1, PreparedLigandStateRef, PreparedReceptorStateRef, SearchRegionRef, SourceArtifactRef } from "./domain.js";
import type { BackendValidationEquivalenceStatus, RequestPreflightStatus, ScientificErrorV1, ScientificWarningV1 } from "./status.js";

export type DockingTaskType = OpaqueScientificId<"DockingTaskType">;
export type SeedPolicy = Readonly<Record<string, string | number | boolean>>;
export type DraftProfileSelection = Readonly<Record<string, string>>;
export type DraftResourcePolicySelection = Readonly<Record<string, string | number | boolean>>;
export type DraftOutputPolicySelection = Readonly<Record<string, string | number | boolean>>;
export type DraftProvenancePolicy = Readonly<Record<string, string | number | boolean>>;

export type DraftReceptorRef = SourceArtifactRef | PreparedReceptorStateRef | Readonly<{ kind: "RECEPTOR_CANDIDATE"; ref: string }>;
export type DraftLigandRef = SourceArtifactRef | PreparedLigandStateRef | Readonly<{ kind: "LIGAND_CANDIDATE"; ref: string }>;
export type DraftSiteProposal = SearchRegionRef | Readonly<{ kind: "SITE_PROPOSAL"; ref: string }>;

export type DockingDraftRequestV1 = {
  schemaVersion: 1;
  draftId: DockingDraftRequestId;
  taskType: DockingTaskType;
  receptorRef: DraftReceptorRef;
  ligandRef: DraftLigandRef;
  siteProposal: DraftSiteProposal;
  profileSelection: DraftProfileSelection;
  seedPolicy: SeedPolicy;
  resourcePolicySelection: DraftResourcePolicySelection;
  outputPolicySelection: DraftOutputPolicySelection;
  provenancePolicy: DraftProvenancePolicy;
  status: RequestPreflightStatus;
  revision: number;
  userFacingLabels?: Readonly<Record<string, string>>;
  unresolvedConvenienceSelectors?: readonly string[];
  preparationRequests?: readonly string[];
  acknowledgementProposals?: readonly string[];
};

export type DockingRequestV1 = Readonly<{
  schemaVersion: 1;
  requestId: DockingRequestId;
  taskType: DockingTaskType;
  preparedReceptorDigest: PreparedReceptorDigest;
  preparedLigandDigest: PreparedLigandDigest;
  searchRegionDigest: SearchRegionDigest;
  scoringProfileDigest: ScoringProfileDigest;
  searchProfileDigest: SearchProfileDigest;
  rmsdProfileDigest: RmsdProfileDigest;
  plausibilityProfileDigest: PlausibilityProfileDigest;
  tieProfileDigest: TieProfileDigest;
  clusteringProfileDigest: ClusteringProfileDigest;
  finalModeProfileDigest: FinalModeProfileDigest;
  numericalBackendProfileDigest: NumericalBackendProfileDigest;
  resourcePolicyProfileDigest: ResourcePolicyProfileDigest;
  capabilityProfileDigest: CapabilityProfileDigest;
  validationProfileDigest: ValidationProfileDigest;
  rng: Readonly<{
    algorithmProfile: string;
    masterSeed: string;
    seedOrigin: "GENERATED_CSPRNG" | "USER_SUPPLIED";
  }>;
  executionPolicy: Readonly<{
    technicalRetryMaximum: 2;
    cachePolicyDigest: CachePolicyDigest;
  }>;
  resultPolicyDigest: ResultPolicyDigest;
  provenancePolicyDigest: ProvenancePolicyDigest;
  preflightReportDigest: PreflightReportDigest;
  parentDraftDigest: DockingDraftDigest;
  canonicalizationProfile: typeof DOCKING_CANONICALIZATION_PROFILE;
  requestDigest: DockingRequestDigest;
}>;

export type DockingPreflightReportV1 = Readonly<{
  schemaVersion: 1;
  preflightReportId: OpaqueScientificId<"DockingPreflightReportId">;
  draftProjectionDigest: DockingDraftDigest;
  resolvedScientificObjectDigests: readonly string[];
  resolvedProfileDigests: readonly ProfileDigest[];
  capabilityAssessment: CapabilityAssessmentV1;
  resourceAssessmentRef: string;
  warnings: readonly ScientificWarningV1[];
  errors: readonly ScientificErrorV1[];
  acknowledgementsRequired: readonly string[];
  seedResolution: Readonly<{ resolved: boolean; seed?: string; origin?: "GENERATED_CSPRNG" | "USER_SUPPLIED" }>;
  cacheAssessment: string;
  validationDomainAssessment: BackendValidationEquivalenceStatus;
  backendEquivalenceAssessment: BackendValidationEquivalenceStatus;
  expectedExecutionUnits: number;
  provenanceCompleteness: boolean;
  readyToFreeze: boolean;
  blockingReasonCodes: readonly string[];
  reportDigest: PreflightReportDigest;
}>;

export type DockingWorkflowStage = "CONFIGURE" | "PREFLIGHT" | "FREEZE" | "RUN";
export const DOCKING_WORKFLOW = ["CONFIGURE", "PREFLIGHT", "FREEZE", "RUN"] as const satisfies readonly DockingWorkflowStage[];

export type IdempotencyBindingV1 = Readonly<{
  callerSecurityScope: string;
  operation: string;
  target: string;
  canonicalPayloadDigest: string;
}>;

export type TechnicalRetryContractV1 = Readonly<{
  dockingAttemptId: import("./identity.js").DockingAttemptId;
  priorExecutionAttemptId: import("./identity.js").ExecutionAttemptId;
  successorExecutionAttemptId: import("./identity.js").ExecutionAttemptId;
  logicalRngSpecificationDigest: ProfileDigest;
}>;

export type RerunContractV1 = Readonly<{
  parentRequestDigest: DockingRequestDigest;
  newRequestDigest: DockingRequestDigest;
  scientificLineageChanges: readonly string[];
}>;
