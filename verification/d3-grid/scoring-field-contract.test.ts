import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  f64Bits,
  f64BitsFromBytes,
  f64Value,
} from "../../packages/contracts/src/docking/canonical.js";
import {
  SCORING_FIELD_LOGICAL_TO_PHYSICAL,
  SCORING_FIELD_TERMS,
  SCORING_FIELD_XS_TYPES,
  encodeScoringFieldLogicalDigestInputV2,
  scoringFieldLogicalChannelId,
  scoringFieldLogicalPayloadV2,
  type ScoringFieldGridGeometryV1,
  type ScoringFieldPhysicalInputV1,
} from "../../packages/contracts/src/docking/scoringField.js";

const dependencies: ScoringFieldPhysicalInputV1["dependencies"] = {
  receptorStateDigest: `sha256:${"1".repeat(64)}`,
  receptorTypingAssignmentDigest: `sha256:${"2".repeat(64)}`,
  searchRegionDigest: `sha256:${"3".repeat(64)}`,
  receptorProfileId: "ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0",
  scoringProfileId: "ME_DOCKING_V1_VINA_CLASSIC_1_0",
  scoringProfileDigest: `sha256:${"4".repeat(64)}`,
  typingProfileId: "ME_XS_TYPING_V1_1_0",
  typingProfileDigest: `sha256:${"5".repeat(64)}`,
  chemistryProfileId: "ME_SUPPORTED_CHEMISTRY_V1_1_0",
  chemistryProfileDigest: `sha256:${"6".repeat(64)}`,
  numericalBackendProfileId: "ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0",
  numericalBackendProfileDigest: `sha256:${"7".repeat(64)}`,
};

const geometry: ScoringFieldGridGeometryV1 = {
  coordinateUnits: "ANGSTROM",
  dimensions: [4, 4, 4],
  domainMaximum: [f64Bits(0.75), f64Bits(0.75), f64Bits(0.75)],
  origin: [f64Bits(-0.375), f64Bits(-0.375), f64Bits(-0.375)],
  searchRegionBounds: [
    [f64Bits(0.0), f64Bits(0.0), f64Bits(0.0)],
    [f64Bits(0.1), f64Bits(0.1), f64Bits(0.1)],
  ],
  spacingAngstrom: f64Bits(0.375),
};

const logicalIdForPhysical = (ordinal: number): number =>
  SCORING_FIELD_LOGICAL_TO_PHYSICAL.findIndex((physical) => physical === ordinal);

const physicalChannels = Array.from({ length: 59 }, (_, ordinal) => {
  const logicalId = logicalIdForPhysical(ordinal);
  return Array.from({ length: 64 }, (_, point) => f64Bits((logicalId * 3 + point + 1) / 16));
});

const input: ScoringFieldPhysicalInputV1 = {
  dependencies,
  geometry,
  pointCount: 64,
  physicalChannels,
};

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

describe("SCORING_FIELD_LOGICAL_V2", () => {
  it("keeps 16 XS IDs, 5 term IDs and all 80 stable logical channels", () => {
    expect(SCORING_FIELD_XS_TYPES).toEqual([
      "C_H", "C_P", "N_P", "N_D", "N_A", "N_DA", "O_P", "O_D", "O_A", "O_DA",
      "S_P", "P_P", "F_H", "Cl_H", "Br_H", "I_H",
    ]);
    expect(SCORING_FIELD_TERMS).toEqual(["G1", "G2", "REP", "HYD", "HB"]);
    expect(Array.from({ length: 80 }, (_, channel) => channel)).toEqual(
      Array.from({ length: 16 }, (_, xsId) =>
        Array.from({ length: 5 }, (_, termId) => scoringFieldLogicalChannelId(xsId, termId))).flat(),
    );
    expect(SCORING_FIELD_LOGICAL_TO_PHYSICAL.filter((ordinal) => ordinal !== null)).toHaveLength(59);
    expect(SCORING_FIELD_LOGICAL_TO_PHYSICAL.filter((ordinal) => ordinal === null)).toHaveLength(21);
  });

  it("materializes omitted raw channels as exact +0.0 and preserves weighted -0.0", () => {
    const payload = scoringFieldLogicalPayloadV2(input);
    for (const channel of payload.logicalChannels) {
      if (SCORING_FIELD_LOGICAL_TO_PHYSICAL[channel[0]] !== null) continue;
      expect(channel[4]).toHaveLength(64);
      for (const value of channel[4]) {
        expect(value.tag).toBe("f64");
        expect([...value.bytes]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      }
      const termId = channel[2];
      const coefficient = [-0.035579, -0.005156, 0.840245, -0.035069, -0.587439][termId]!;
      expect(Object.is(f64Value(channel[4][0]!) * coefficient, -0)).toBe(true);
    }
  });

  it("matches the C++ canonical-CBOR/SHA-256 fixture", () => {
    const bytes = encodeScoringFieldLogicalDigestInputV2(input);
    expect(digest(bytes)).toBe("sha256:a4943906c807e256972c7d575e6ae69353b70e0d04d88be8704f89e011f53a69");
  });

  it("rejects a nonfinite raw F64Bits channel before canonical serialization", () => {
    const infinity = f64BitsFromBytes(Uint8Array.of(0x7f, 0xf0, 0, 0, 0, 0, 0, 0));
    const badChannels = physicalChannels.map((channel) => [...channel]);
    badChannels[0]![0] = infinity;
    expect(() => encodeScoringFieldLogicalDigestInputV2({ ...input, physicalChannels: badChannels })).toThrow(
      /finite F64Bits/,
    );
  });

  it("keeps raw channel +0.0 and -0.0 distinct in the canonical payload", () => {
    const positive = [...physicalChannels[0]!];
    const negative = [...physicalChannels[0]!];
    positive[0] = f64Bits(0.0);
    negative[0] = f64Bits(-0.0);
    const positiveDigest = digest(encodeScoringFieldLogicalDigestInputV2({
      ...input,
      physicalChannels: [positive, ...physicalChannels.slice(1)],
    }));
    const negativeDigest = digest(encodeScoringFieldLogicalDigestInputV2({
      ...input,
      physicalChannels: [negative, ...physicalChannels.slice(1)],
    }));
    expect(positiveDigest).not.toBe(negativeDigest);
  });
});
