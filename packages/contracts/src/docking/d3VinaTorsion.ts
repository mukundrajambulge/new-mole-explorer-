import type { F64Bits } from "./canonical.js";
import type {
  ArtifactByteDigest,
  MolecularIdentityDigest,
  ProfileDigest,
  ProvenanceRecordDigest,
  Sha256Digest,
  SourceArtifactId,
} from "./identity.js";
import type { D2AtomUID, D2BondUID } from "./d2.js";

export const D3_VINA_TORSION_SCHEMA_VERSION = 1 as const;
export const D3_VINA_TORSION_PROFILE_ID = "ME_D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1" as const;
export const D3_VINA_TORSION_PROFILE_SOURCE = Object.freeze({
  software: "AutoDock Vina",
  version: "1.2.7",
  commit: "8eb40404f4f45608acb3b01427587ac049f27c1",
} as const);

export type D3VinaTorsionProfileV1 = Readonly<{
  schemaVersion: typeof D3_VINA_TORSION_SCHEMA_VERSION;
  semanticSchemaId: "D3_VINA_TORSION_PROFILE_V1";
  profileId: typeof D3_VINA_TORSION_PROFILE_ID;
  source: typeof D3_VINA_TORSION_PROFILE_SOURCE;
  torsdofMeaning: "PRESERVED_RAW_INPUT_ONLY";
  branchMeaning: "ORDERED_RAW_TOPOLOGY_WITH_EMPTY_BRANCH_FILTER_FOR_SEARCH_AXES";
  searchAxisRule: "A_BRANCH_IS_ACTIVE_IF_ITS_SUBTREE_HAS_AT_LEAST_ONE_ATOM_OTHER_THAN_ITS_IMMOBILE_AXIS_ENDPOINT";
  scorerEndpointRule: "FOR_EACH_ACTIVE_HEAVY_HEAVY_ROTOR_ENDPOINT_ADD_0_5_IF_THE_PARTNER_HAS_MORE_THAN_ONE_HEAVY_GRAPH_NEIGHBOR";
  scorerTorsionUnit: F64Bits;
  allowedBondContributions: readonly [F64Bits, F64Bits, F64Bits];
  canonicalizationProfile: "ME_CANONICAL_CBOR_V1_1_0";
}>;

export type D3VinaTorsionProfileDigest = ProfileDigest;
export type D3VinaPdbqtEvidenceDigest = Sha256Digest<"D3VinaPdbqtEvidenceDigest">;
export type D3VinaSearchTopologyDigest = Sha256Digest<"D3VinaSearchTopologyDigest">;
export type D3VinaScorerAssignmentDigest = Sha256Digest<"D3VinaScorerAssignmentDigest">;
export type D3VinaAtomMappingDigest = ProvenanceRecordDigest;

export type D3VinaValidationStatus = "VALID" | "INVALID" | "AMBIGUOUS" | "UNSUPPORTED" | "RESOURCE_REJECTED";
export type D3VinaDiagnostic = Readonly<{
  code: string;
  severity: "ERROR" | "WARNING";
  blocking: boolean;
  message: string;
  path?: string;
}>;

export type D3VinaProducerProvenanceV1 =
  | Readonly<{ status: "KNOWN"; name: string; version?: string; settingsRefs: readonly string[] }>
  | Readonly<{ status: "UNKNOWN"; reason: string; evidenceRefs: readonly string[] }>;

export type D3VinaAuthoritativeAtomMappingV1 = Readonly<{
  status: "AUTHORITATIVE";
  schemaVersion: typeof D3_VINA_TORSION_SCHEMA_VERSION;
  semanticSchemaId: "D3_VINA_AUTHORITATIVE_ATOM_MAPPING_V1";
  graphRevisionDigest: MolecularIdentityDigest;
  representationArtifactDigest: ArtifactByteDigest;
  serialToAtomUid: Readonly<Record<string, D2AtomUID>>;
  evidenceRefs: readonly string[];
  digest: D3VinaAtomMappingDigest;
}>;

export type D3VinaPdbqtAtomV1 = Readonly<{
  serial: number;
  element: string;
  atomType: string;
  atomUid: D2AtomUID;
  line: number;
  branchOrdinal: number | null;
}>;

export type D3VinaRawBranchV1 = Readonly<{
  ordinal: number;
  parentOrdinal: number | null;
  fromSerial: number;
  toSerial: number;
  startLine: number;
  endLine: number;
  rawStartRecord: string;
  rawEndRecord: string;
  directAtomSerials: readonly number[];
}>;

export type D3VinaPdbqtEvidenceV1 = Readonly<{
  schemaVersion: typeof D3_VINA_TORSION_SCHEMA_VERSION;
  semanticSchemaId: "D3_VINA_PDBQT_EVIDENCE_V1";
  profileId: typeof D3_VINA_TORSION_PROFILE_ID;
  profileDigest: D3VinaTorsionProfileDigest;
  sourceArtifactId: SourceArtifactId;
  sourceArtifactDigest: ArtifactByteDigest;
  representationByteDigest: ArtifactByteDigest;
  graphRevisionDigest: MolecularIdentityDigest;
  producer: D3VinaProducerProvenanceV1;
  mapping: D3VinaAuthoritativeAtomMappingV1;
  rootAtomSerials: readonly number[];
  atoms: readonly D3VinaPdbqtAtomV1[];
  rawTorsdof: number;
  rawBranches: readonly D3VinaRawBranchV1[];
  diagnostics: readonly D3VinaDiagnostic[];
  digest: D3VinaPdbqtEvidenceDigest;
}>;

export type D3VinaSearchAxisV1 = Readonly<{
  rawBranchOrdinal: number;
  parentAxisOrdinal: number | null;
  axisAtom1Uid: D2AtomUID;
  axisAtom2Uid: D2AtomUID;
  movingAtomUids: readonly D2AtomUID[];
  status: "ACTIVE" | "INACTIVE";
  reason: "MOVABLE_ATOMS_PRESENT" | "ONLY_IMMOBILE_AXIS_ENDPOINT";
}>;

export type D3VinaSearchTopologyV1 = Readonly<{
  schemaVersion: typeof D3_VINA_TORSION_SCHEMA_VERSION;
  semanticSchemaId: "D3_VINA_SEARCH_TOPOLOGY_V1";
  profileId: typeof D3_VINA_TORSION_PROFILE_ID;
  profileDigest: D3VinaTorsionProfileDigest;
  pdbqtEvidenceDigest: D3VinaPdbqtEvidenceDigest;
  rawTorsdof: number;
  rawBranchCount: number;
  axes: readonly D3VinaSearchAxisV1[];
  activeSearchTorsionCount: number;
  digest: D3VinaSearchTopologyDigest;
}>;

export type D3VinaScorerBondAssignmentV1 = Readonly<{
  bondUid: D2BondUID;
  endpointAUid: D2AtomUID;
  endpointBUid: D2AtomUID;
  rotorFlag: boolean;
  endpointAContribution: F64Bits;
  endpointBContribution: F64Bits;
  totalBondContribution: F64Bits;
  evidenceRefs: readonly string[];
}>;

export type D3VinaScorerTorsionAssignmentV1 = Readonly<{
  schemaVersion: typeof D3_VINA_TORSION_SCHEMA_VERSION;
  semanticSchemaId: "D3_VINA_SCORER_TORSION_ASSIGNMENT_V1";
  profileId: typeof D3_VINA_TORSION_PROFILE_ID;
  profileDigest: D3VinaTorsionProfileDigest;
  graphRevisionDigest: MolecularIdentityDigest;
  pdbqtEvidenceDigest: D3VinaPdbqtEvidenceDigest;
  bondAssignments: readonly D3VinaScorerBondAssignmentV1[];
  nTorsVina: F64Bits;
  digest: D3VinaScorerAssignmentDigest;
}>;

export type D3VinaTorsionSealResult<T> = Readonly<{
  status: D3VinaValidationStatus;
  value?: T;
  diagnostics: readonly D3VinaDiagnostic[];
}>;
