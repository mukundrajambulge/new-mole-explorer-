import type { CommandJobState } from "../index.js";
import type { DockingRequestDigest, ExecutionAttemptId, OpaqueScientificId, ProvenanceRecordId } from "./identity.js";

export const REQUEST_PREFLIGHT_STATUSES = ["DRAFT", "VALIDATING", "BLOCKED", "PREFLIGHT_PASSED", "FROZEN"] as const;
export type RequestPreflightStatus = (typeof REQUEST_PREFLIGHT_STATUSES)[number];

export type DurableJobStatus = CommandJobState;

export const EXECUTION_EVENT_TYPES = [
  "REQUEST_CREATED",
  "PREFLIGHT_STARTED",
  "PREFLIGHT_BLOCKED",
  "REQUEST_FROZEN",
  "JOB_CREATED",
  "JOB_QUEUED",
  "EXECUTION_ATTEMPT_STARTED",
  "TRAJECTORY_PROGRESS",
  "CACHE_REUSED",
  "RETRY_SCHEDULED",
  "CANCELLATION_REQUESTED",
  "CANCELLING",
  "EXECUTION_ATTEMPT_CANCELLED",
  "EXECUTION_ATTEMPT_FAILED",
  "RESULT_VALIDATED",
  "JOB_COMPLETED",
  "JOB_FAILED",
  "JOB_CANCELLED",
] as const;
export type ExecutionEventType = (typeof EXECUTION_EVENT_TYPES)[number];

export const CAPABILITY_ASSESSMENT_STATUSES = ["SUPPORTED", "EXPERIMENTAL", "UNVALIDATED", "AMBIGUOUS", "UNSUPPORTED", "INVALID"] as const;
export type CapabilityAssessmentStatus = (typeof CAPABILITY_ASSESSMENT_STATUSES)[number];

export const SCIENTIFIC_RESULT_STATUSES = ["NOT_PRODUCED", "COMPLETED_WITH_ELIGIBLE_POSE", "COMPLETED_NO_ELIGIBLE_POSE", "INCOMPLETE", "NON_EVALUABLE"] as const;
export type ScientificResultStatus = (typeof SCIENTIFIC_RESULT_STATUSES)[number];

export const BACKEND_VALIDATION_EQUIVALENCE_STATUSES = [
  "NOT_EVALUATED",
  "IN_DOMAIN_VALIDATED",
  "OUTSIDE_VALIDATED_DOMAIN",
  "EXPERIMENTAL",
  "BACKEND_TIER_A_BITWISE",
  "BACKEND_TIER_B_NUMERICALLY_EQUIVALENT",
  "BACKEND_TIER_C_INDEPENDENTLY_VALIDATED",
  "BACKEND_TIER_D_EXPERIMENTAL_UNSUPPORTED",
] as const;
export type BackendValidationEquivalenceStatus = (typeof BACKEND_VALIDATION_EQUIVALENCE_STATUSES)[number];

export const CAMPAIGN_COMPLETION_STATUSES = ["NOT_STARTED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"] as const;
export type CampaignCompletionStatus = (typeof CAMPAIGN_COMPLETION_STATUSES)[number];

export const SCIENTIFIC_ERROR_CATEGORIES = [
  "INPUT_SCHEMA",
  "SCIENTIFIC_INVALIDITY",
  "AMBIGUITY",
  "UNSUPPORTED_CAPABILITY",
  "RESOURCE_REJECTION",
  "EXECUTION_FAILURE",
  "NUMERICAL_FAILURE",
  "TRANSIENT_INFRASTRUCTURE",
  "CANCELLATION",
  "INCOMPLETE_BUDGET",
  "PROVENANCE_REPLAY",
  "SECURITY_REJECTION",
  "AUTHORIZATION",
  "INTERNAL_DEFECT",
] as const;
export type ScientificErrorCategory = (typeof SCIENTIFIC_ERROR_CATEGORIES)[number];

export type ScientificStage = OpaqueScientificId<"ScientificStage">;
export type ScientificCode = OpaqueScientificId<"ScientificCode">;

export type ScientificErrorV1 = Readonly<{
  schemaVersion: 1;
  errorId: OpaqueScientificId<"ScientificErrorId">;
  code: ScientificCode;
  category: ScientificErrorCategory;
  severity: "ERROR";
  blocking: boolean;
  stage: ScientificStage;
  objectRef?: string;
  requestDigest?: DockingRequestDigest;
  jobId?: OpaqueScientificId<"DockingJobId">;
  executionAttemptId?: ExecutionAttemptId;
  humanMessage: string;
  scientificExplanation: string;
  technicalDetails?: Readonly<Record<string, string | number | boolean | null>>;
  recoveryOptions: readonly string[];
  retryable: boolean;
  causeRef?: string;
  provenanceRefs: readonly ProvenanceRecordId[];
  transportMapping?: Readonly<{ httpStatus?: number; cliExitClass?: number }>;
  timestamp: string;
}>;

export type ScientificWarningV1 = Readonly<{
  warningId: OpaqueScientificId<"ScientificWarningId">;
  code: ScientificCode;
  category: ScientificErrorCategory;
  severity: "WARNING";
  blocking: false;
  retryable: false;
  stage: ScientificStage;
  objectRef?: string;
  humanMessage: string;
  scientificExplanation: string;
  claimImpact: string;
  recoveryOptions: readonly string[];
  acknowledgementPolicy: "NONE" | "REQUIRED";
  acknowledgedByRef?: string;
  acknowledgedAt?: string;
  provenanceRefs: readonly ProvenanceRecordId[];
}>;
