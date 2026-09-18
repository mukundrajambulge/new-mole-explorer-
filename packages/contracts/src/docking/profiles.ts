import type {
  CapabilityProfileDigest,
  ClusteringProfileDigest,
  FinalModeProfileDigest,
  NumericalBackendProfileDigest,
  PlausibilityProfileDigest,
  ProfileDigest,
  ResourcePolicyProfileDigest,
  RmsdProfileDigest,
  ScoringProfileDigest,
  SearchProfileDigest,
  TieProfileDigest,
  ValidationProfileDigest,
} from "./identity.js";

export const SCIENTIFIC_PROFILE_IDS = Object.freeze({
  core: "ME_DOCKING_V1_CORE_EXPLICIT_STATE_1_0",
  canonicalization: "ME_CANONICAL_CBOR_V1_1_0",
  numericalBackend: "ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0",
  scoring: "ME_DOCKING_V1_VINA_CLASSIC_1_0",
  rng: "ME_DOCKING_V1_RNG_1_0",
  search: "ME_DOCKING_V1_SEARCH_1_0",
  localOptimization: "ME_DOCKING_V1_LOCAL_OPT_1_0",
  clustering: "ME_DOCKING_V1_CLUSTER_SYM_RMSD_2A_BESTFIRST_1_0",
  finalModes: "ME_DOCKING_V1_FINAL_MODES_9_ERANGE3_1_0",
  plausibility: "ME_POSE_PLAUSIBILITY_VDW_0_75_V1_1_0",
  scoreTie: "ME_SCORE_TIE_Q1E6_V1_1_0",
  supportedChemistry: "ME_SUPPORTED_CHEMISTRY_V1_1_0",
  xsTyping: "ME_XS_TYPING_V1_1_0",
  campaignAggregation: "ME_CAMP_AGG_STATE_SEPARATE_V1_1_0",
  statePolicy: "STATE_SEPARATE_NO_CANONICAL_SCORE_V1",
} as const);

export type ScientificProfileId = (typeof SCIENTIFIC_PROFILE_IDS)[keyof typeof SCIENTIFIC_PROFILE_IDS];

export type ProfileManifest<Id extends ScientificProfileId, Digest extends ProfileDigest = ProfileDigest> = Readonly<{
  schemaVersion: 1;
  profileId: Id;
  semanticVersion: string;
  semanticSchemaId: string;
  digest: Digest;
  dependencyProfileDigests: readonly ProfileDigest[];
}>;

export type ScoringProfile = ProfileManifest<typeof SCIENTIFIC_PROFILE_IDS.scoring, ScoringProfileDigest>;
export type SearchProfile = ProfileManifest<typeof SCIENTIFIC_PROFILE_IDS.search, SearchProfileDigest>;
export type NumericalBackendProfile = ProfileManifest<typeof SCIENTIFIC_PROFILE_IDS.numericalBackend, NumericalBackendProfileDigest>;
export type ResourcePolicyProfile = ProfileManifest<ScientificProfileId, ResourcePolicyProfileDigest>;
export type RmsdProfile = ProfileManifest<ScientificProfileId, RmsdProfileDigest>;
export type PlausibilityProfile = ProfileManifest<typeof SCIENTIFIC_PROFILE_IDS.plausibility, PlausibilityProfileDigest>;
export type TieProfile = ProfileManifest<typeof SCIENTIFIC_PROFILE_IDS.scoreTie, TieProfileDigest>;
export type ClusteringProfile = ProfileManifest<typeof SCIENTIFIC_PROFILE_IDS.clustering, ClusteringProfileDigest>;
export type FinalModeProfile = ProfileManifest<typeof SCIENTIFIC_PROFILE_IDS.finalModes, FinalModeProfileDigest>;
export type CapabilityProfile = ProfileManifest<ScientificProfileId, CapabilityProfileDigest>;
export type ValidationProfile = ProfileManifest<ScientificProfileId, ValidationProfileDigest>;
