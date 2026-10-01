import { encodeCanonicalCbor, f64Bits, f64Value, type F64Bits } from "./canonical.js";

export const SCORING_FIELD_LOGICAL_SCHEMA_ID = "SCORING_FIELD_LOGICAL_V2" as const;
export const SCORING_FIELD_STORAGE_SCHEMA_ID = "SCORING_FIELD_STORAGE_V1" as const;
export const SCORING_FIELD_PHYSICAL_LAYOUT_ID = "ME_SCORING_FIELD_80_TO_59_F64_V1" as const;
export const SCORING_FIELD_GRID_PROFILE_ID = "ME_VINA_GRID_V1_1_0" as const;
export const SCORING_FIELD_CANONICALIZATION_PROFILE = "ME_CANONICAL_CBOR_V1_1_0" as const;

export const SCORING_FIELD_XS_TYPES = Object.freeze([
  "C_H", "C_P", "N_P", "N_D", "N_A", "N_DA", "O_P", "O_D", "O_A", "O_DA",
  "S_P", "P_P", "F_H", "Cl_H", "Br_H", "I_H",
] as const);
export const SCORING_FIELD_TERMS = Object.freeze(["G1", "G2", "REP", "HYD", "HB"] as const);

export const scoringFieldLogicalChannelId = (xsId: number, termId: number): number => {
  if (!Number.isInteger(xsId) || xsId < 0 || xsId >= SCORING_FIELD_XS_TYPES.length) {
    throw new RangeError("XS_ID must be an integer from 0 through 15.");
  }
  if (!Number.isInteger(termId) || termId < 0 || termId >= SCORING_FIELD_TERMS.length) {
    throw new RangeError("TERM_ID must be an integer from 0 through 4.");
  }
  return 5 * xsId + termId;
};

const isPhysical = (logicalId: number): boolean => {
  const xsId = Math.floor(logicalId / 5);
  const termId = logicalId % 5;
  if (termId < 3) return true;
  if (termId === 3) return xsId === 0 || xsId >= 12;
  return [3, 4, 5, 7, 8, 9].includes(xsId);
};

const physicalOrdinals: readonly (number | null)[] = Object.freeze((() => {
  let nextOrdinal = 0;
  return Array.from({ length: 80 }, (_, logicalId) => {
    if (!isPhysical(logicalId)) return null;
    const ordinal = nextOrdinal;
    nextOrdinal += 1;
    return ordinal;
  });
})());

if (physicalOrdinals.filter((ordinal) => ordinal !== null).length !== 59) {
  throw new Error("SCORING_FIELD_LOGICAL_V2 must map exactly 59 physical channels.");
}

export const SCORING_FIELD_LOGICAL_TO_PHYSICAL = physicalOrdinals;

export type ScoringFieldGridGeometryV1 = Readonly<{
  coordinateUnits: "ANGSTROM";
  dimensions: readonly [number, number, number];
  domainMaximum: readonly [F64Bits, F64Bits, F64Bits];
  origin: readonly [F64Bits, F64Bits, F64Bits];
  searchRegionBounds: readonly [
    readonly [F64Bits, F64Bits, F64Bits],
    readonly [F64Bits, F64Bits, F64Bits],
  ];
  spacingAngstrom: F64Bits;
}>;

export type ScoringFieldScientificDependenciesV1 = Readonly<{
  receptorStateDigest: string;
  receptorTypingAssignmentDigest: string;
  searchRegionDigest: string;
  receptorProfileId: string;
  scoringProfileId: string;
  scoringProfileDigest: string;
  typingProfileId: string;
  typingProfileDigest: string;
  chemistryProfileId: string;
  chemistryProfileDigest: string;
  numericalBackendProfileId: string;
  numericalBackendProfileDigest: string;
}>;

export type ScoringFieldLogicalPayloadV2 = Readonly<{
  canonicalizationProfile: typeof SCORING_FIELD_CANONICALIZATION_PROFILE;
  chemistryProfileDigest: string;
  chemistryProfileId: string;
  gridGeometry: ScoringFieldGridGeometryV1;
  gridProfileId: typeof SCORING_FIELD_GRID_PROFILE_ID;
  logicalChannels: readonly (readonly [
    logicalChannelId: number,
    xsId: number,
    termId: number,
    xsType: (typeof SCORING_FIELD_XS_TYPES)[number],
    rawValues: readonly F64Bits[],
  ])[];
  numericalBackendProfileDigest: string;
  numericalBackendProfileId: string;
  receptorProfileId: string;
  receptorStateDigest: string;
  receptorTypingAssignmentDigest: string;
  scoringProfileDigest: string;
  scoringProfileId: string;
  searchRegionDigest: string;
  semanticSchemaId: typeof SCORING_FIELD_LOGICAL_SCHEMA_ID;
  typingProfileDigest: string;
  typingProfileId: string;
}>;

export type ScoringFieldPhysicalInputV1 = Readonly<{
  dependencies: ScoringFieldScientificDependenciesV1;
  geometry: ScoringFieldGridGeometryV1;
  pointCount: number;
  physicalChannels: readonly (readonly F64Bits[])[];
}>;

const finiteBits = (bits: F64Bits): boolean => Number.isFinite(f64Value(bits));

/**
 * Builds the canonical logical payload from the 59 physical arrays. Omitted
 * logical raw channels are expanded as exact binary64 +0.0 before encoding.
 */
export const scoringFieldLogicalPayloadV2 = (
  input: ScoringFieldPhysicalInputV1,
): ScoringFieldLogicalPayloadV2 => {
  if (!Number.isSafeInteger(input.pointCount) || input.pointCount < 1) {
    throw new RangeError("ScoringField pointCount must be a positive safe integer.");
  }
  const [nx, ny, nz] = input.geometry.dimensions;
  if (![nx, ny, nz].every((value) => Number.isSafeInteger(value) && value >= 2) || nx * ny * nz !== input.pointCount) {
    throw new RangeError("ScoringField dimensions must describe the complete point array.");
  }
  if (input.physicalChannels.length !== 59 ||
      input.physicalChannels.some((channel) => channel.length !== input.pointCount)) {
    throw new RangeError("ScoringField storage must contain 59 complete physical arrays.");
  }
  if (input.physicalChannels.some((channel) => channel.some((value) => !finiteBits(value)))) {
    throw new TypeError("ScoringField raw channels must contain finite F64Bits values.");
  }

  const logicalChannels = Array.from({ length: 80 }, (_, logicalId) => {
    const xsId = Math.floor(logicalId / 5);
    const termId = logicalId % 5;
    const ordinal = physicalOrdinals[logicalId];
    const rawValues = ordinal === null
      ? Array.from({ length: input.pointCount }, () => f64Bits(0.0))
      : input.physicalChannels[ordinal]!;
    return Object.freeze([
      logicalId,
      xsId,
      termId,
      SCORING_FIELD_XS_TYPES[xsId]!,
      rawValues,
    ] as const);
  });
  const dependencies = input.dependencies;
  return Object.freeze({
    canonicalizationProfile: SCORING_FIELD_CANONICALIZATION_PROFILE,
    chemistryProfileDigest: dependencies.chemistryProfileDigest,
    chemistryProfileId: dependencies.chemistryProfileId,
    gridGeometry: input.geometry,
    gridProfileId: SCORING_FIELD_GRID_PROFILE_ID,
    logicalChannels: Object.freeze(logicalChannels),
    numericalBackendProfileDigest: dependencies.numericalBackendProfileDigest,
    numericalBackendProfileId: dependencies.numericalBackendProfileId,
    receptorProfileId: dependencies.receptorProfileId,
    receptorStateDigest: dependencies.receptorStateDigest,
    receptorTypingAssignmentDigest: dependencies.receptorTypingAssignmentDigest,
    scoringProfileDigest: dependencies.scoringProfileDigest,
    scoringProfileId: dependencies.scoringProfileId,
    searchRegionDigest: dependencies.searchRegionDigest,
    semanticSchemaId: SCORING_FIELD_LOGICAL_SCHEMA_ID,
    typingProfileDigest: dependencies.typingProfileDigest,
    typingProfileId: dependencies.typingProfileId,
  });
};

export const encodeScoringFieldLogicalCborV2 = (input: ScoringFieldPhysicalInputV1): Uint8Array =>
  encodeCanonicalCbor(scoringFieldLogicalPayloadV2(input));

export const encodeScoringFieldLogicalDigestInputV2 = (input: ScoringFieldPhysicalInputV1): Uint8Array =>
  encodeCanonicalCbor([
    "ME-PHDV2-DIGEST",
    1,
    "SCORING_FIELD",
    SCORING_FIELD_LOGICAL_SCHEMA_ID,
    SCORING_FIELD_CANONICALIZATION_PROFILE,
    scoringFieldLogicalPayloadV2(input),
  ]);
