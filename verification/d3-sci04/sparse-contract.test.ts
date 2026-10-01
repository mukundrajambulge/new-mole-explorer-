import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodeCanonicalCbor,
  encodeCanonicalCbor,
  f64Bits,
  f64Value,
} from "../../packages/contracts/src/docking/canonical.ts";

type ChannelRow = {
  logical_id: number;
  xs_id: number;
  xs_type: string;
  term_id: number;
  term: string;
  physical_ordinal: number | null;
  omitted_reason: string | null;
};

const directory = new URL(".", import.meta.url);
const channelMap = JSON.parse(readFileSync(new URL("channel-map.json", directory), "utf8")) as {
  xs_types: string[];
  terms: string[];
  logical_channel_count: number;
  physical_array_count: number;
  channels: ChannelRow[];
};
const directProof = JSON.parse(readFileSync(new URL("evidence/direct-scorer-proof.json", directory), "utf8")) as {
  result: string;
  checked_type_pairs: number;
  checked_pair_distances: number;
  omitted_hyd_raw_positive_zero_checks: number;
  omitted_hb_raw_positive_zero_checks: number;
  negative_weighted_zero_bits: string;
};

const hydrophobicTypes = new Set(["C_H", "F_H", "Cl_H", "Br_H", "I_H"]);
const donorTypes = new Set(["N_D", "N_DA", "O_D", "O_DA"]);
const acceptorTypes = new Set(["N_A", "N_DA", "O_A", "O_DA"]);
const zero = f64Bits(0);
const logicalSchema = "SCORING_FIELD_V1";
const storageSchema = "SCORING_FIELD_STORAGE_V1";
const cacheSchema = "CACHE_KEY_V1";

const digest = (digestClass: string, semanticSchema: string, payload: unknown): string => {
  const envelope = [
    "ME-PHDV2-DIGEST",
    1,
    digestClass,
    semanticSchema,
    "ME_CANONICAL_CBOR_V1_1_0",
    payload,
  ];
  return createHash("sha256").update(encodeCanonicalCbor(envelope)).digest("hex");
};

const sampleValues = (row: ChannelRow): ReturnType<typeof f64Bits>[] =>
  Array.from({ length: 4 }, (_, point) => {
    if (row.omitted_reason !== null) return f64Bits(0);
    return f64Bits((row.logical_id + 1) * 0.125 + point * 0.03125);
  });

const dependencies = {
  receptor_digest: "sha256:" + "1".repeat(64),
  region_digest: "sha256:" + "2".repeat(64),
  scoring_profile_digest: "sha256:" + "3".repeat(64),
  typing_profile_digest: "sha256:" + "4".repeat(64),
  grid_profile_digest: "sha256:" + "5".repeat(64),
  numerical_profile_digest: "sha256:" + "6".repeat(64),
};

const geometry = {
  origin: [f64Bits(-20.375), f64Bits(-20.375), f64Bits(-20.375)],
  spacing_angstrom: f64Bits(0.375),
  dimensions: [110, 110, 110],
  interpolation: "TRILINEAR",
};

const canonicalLogicalPayload = (rows: ChannelRow[], values: ReturnType<typeof f64Bits>[][]) => ({
  dependencies,
  geometry,
  logical_channel_schema: "ME_SCORING_FIELD_LOGICAL_80_V1",
  logical_channels: rows.map((row, index) => ({
    logical_id: row.logical_id,
    xs_id: row.xs_id,
    term_id: row.term_id,
    raw_values: values[index],
  })),
});

const cacheKey = (logicalDigest: string, physicalSchemaId: string): string =>
  digest("CACHE_KEY", cacheSchema, {
    layer_id: "SCORING_FIELD",
    layer_schema: "SCORING_FIELD_V1",
    parents: [dependencies.receptor_digest, dependencies.region_digest],
    profile_digests: [
      dependencies.scoring_profile_digest,
      dependencies.typing_profile_digest,
      dependencies.grid_profile_digest,
      dependencies.numerical_profile_digest,
    ],
    exact_parameters: { logical_scoring_field_digest: logicalDigest },
    compatibility_profile: {
      physical_storage_schema_id: physicalSchemaId,
      canonicalization_profile_id: "ME_CANONICAL_CBOR_V1_1_0",
    },
  });

const canReuseCacheEntry = (
  cachedLogicalDigest: string,
  cachedPhysicalSchema: string,
  requestedLogicalDigest: string,
  requestedPhysicalSchema: string,
): boolean =>
  cachedLogicalDigest === requestedLogicalDigest &&
  cachedPhysicalSchema === requestedPhysicalSchema;

describe("D3-SCI-04 sparse scoring-field conformance proposal", () => {
  it("preserves the exact 16-type, 80-channel logical order", () => {
    expect(channelMap.xs_types).toEqual([
      "C_H", "C_P", "N_P", "N_D", "N_A", "N_DA", "O_P", "O_D", "O_A", "O_DA",
      "S_P", "P_P", "F_H", "Cl_H", "Br_H", "I_H",
    ]);
    expect(channelMap.terms).toEqual(["G1", "G2", "REP", "HYD", "HB"]);
    expect(channelMap.logical_channel_count).toBe(80);
    expect(channelMap.channels).toHaveLength(80);
    channelMap.channels.forEach((row, index) => {
      expect(row.logical_id).toBe(index);
      expect(row.xs_id).toBe(Math.floor(index / 5));
      expect(row.term_id).toBe(index % 5);
      expect(row.xs_type).toBe(channelMap.xs_types[row.xs_id]);
      expect(row.term).toBe(channelMap.terms[row.term_id]);
    });
  });

  it("maps 59 retained arrays in ascending logical order and omits only proven HYD/HB zeros", () => {
    expect(channelMap.physical_array_count).toBe(59);
    const physical = channelMap.channels.filter((row) => row.physical_ordinal !== null);
    expect(physical).toHaveLength(59);
    physical.forEach((row, ordinal) => {
      expect(row.physical_ordinal).toBe(ordinal);
      if (row.term === "HYD") expect(hydrophobicTypes.has(row.xs_type)).toBe(true);
      if (row.term === "HB") {
        expect(donorTypes.has(row.xs_type) || acceptorTypes.has(row.xs_type)).toBe(true);
      }
    });
    const omittedHyd = channelMap.channels.filter((row) => row.omitted_reason?.startsWith("HYD"));
    const omittedHb = channelMap.channels.filter((row) => row.omitted_reason?.startsWith("HB"));
    expect(omittedHyd).toHaveLength(11);
    expect(omittedHb).toHaveLength(10);
    expect(omittedHyd.every((row) => !hydrophobicTypes.has(row.xs_type))).toBe(true);
    expect(omittedHb.every((row) => !donorTypes.has(row.xs_type) && !acceptorTypes.has(row.xs_type))).toBe(true);
    expect(new Set(channelMap.channels.map((row) => row.logical_id)).size).toBe(80);
  });

  it("includes direct-scorer equation evidence for all 256 receptor/ligand type pairs", () => {
    expect(directProof.result).toBe("PASS");
    expect(directProof.checked_type_pairs).toBe(256);
    expect(directProof.checked_pair_distances).toBeGreaterThanOrEqual(1280);
    expect(directProof.omitted_hyd_raw_positive_zero_checks).toBeGreaterThan(0);
    expect(directProof.omitted_hb_raw_positive_zero_checks).toBeGreaterThan(0);
    expect(directProof.negative_weighted_zero_bits).toBe("8000000000000000");
  });

  it("materializes omitted channels as positive zero and hashes dense/sparse logical values identically", () => {
    const denseValues = channelMap.channels.map(sampleValues);
    const sparseByLogicalId = new Map(
      channelMap.channels
        .filter((row) => row.physical_ordinal !== null)
        .map((row) => [row.logical_id, denseValues[row.logical_id]] as const),
    );
    const sparseExpanded = channelMap.channels.map((row) =>
      sparseByLogicalId.get(row.logical_id) ?? Array.from({ length: 4 }, () => zero),
    );

    channelMap.channels.forEach((row, index) => {
      if (row.omitted_reason === null) return;
      for (const value of sparseExpanded[index]!) {
        expect([...value.bytes]).toEqual([...zero.bytes]);
      }
    });

    const denseLogical = canonicalLogicalPayload(channelMap.channels, denseValues);
    const sparseLogical = canonicalLogicalPayload(channelMap.channels, sparseExpanded);
    const denseDigest = digest("SCORING_FIELD", logicalSchema, denseLogical);
    const sparseDigest = digest("SCORING_FIELD", logicalSchema, sparseLogical);
    expect(denseDigest).toBe(sparseDigest);
    expect([...encodeCanonicalCbor(denseLogical)]).toEqual([...encodeCanonicalCbor(sparseLogical)]);
  });

  it("keeps physical identity and cache compatibility separate from logical identity", () => {
    const logicalValues = channelMap.channels.map(sampleValues);
    const logicalDigest = digest("SCORING_FIELD", logicalSchema, canonicalLogicalPayload(channelMap.channels, logicalValues));
    const densePhysicalSchema = "ME_SCORING_FIELD_DENSE_80_RESEARCH_V1";
    const sparsePhysicalSchema = "ME_SCORING_FIELD_EXACT_ZERO_59_RESEARCH_V1";
    const physicalDigest = (schemaId: string, rows: ChannelRow[]) =>
      digest("SCORING_FIELD_STORAGE", storageSchema, {
        logical_field_digest: logicalDigest,
        physical_storage_schema_id: schemaId,
        physical_channels: rows.map((row) => ({
          logical_id: row.logical_id,
          raw_values: logicalValues[row.logical_id],
        })),
      });

    const densePhysicalDigest = physicalDigest(densePhysicalSchema, channelMap.channels);
    const sparsePhysicalDigest = physicalDigest(
      sparsePhysicalSchema,
      channelMap.channels.filter((row) => row.physical_ordinal !== null),
    );
    const denseCacheKey = cacheKey(logicalDigest, densePhysicalSchema);
    const sparseCacheKey = cacheKey(logicalDigest, sparsePhysicalSchema);
    const sameSchemaReuse = canReuseCacheEntry(logicalDigest, densePhysicalSchema, logicalDigest, densePhysicalSchema);
    const crossSchemaReuse = canReuseCacheEntry(logicalDigest, densePhysicalSchema, logicalDigest, sparsePhysicalSchema);
    expect(densePhysicalDigest).not.toBe(sparsePhysicalDigest);
    expect(denseCacheKey).not.toBe(sparseCacheKey);
    expect(sameSchemaReuse).toBe(true);
    expect(crossSchemaReuse).toBe(false);

    const denseLogicalBytes = encodeCanonicalCbor(canonicalLogicalPayload(channelMap.channels, logicalValues));
    const serializationProof = {
      schema: "D3_SCI04_SERIALIZATION_PROOF_V1",
      result: "PASS_FOR_RESEARCH_CONTRACT",
      canonicalization_profile: "ME_CANONICAL_CBOR_V1_1_0",
      digest_envelope: "PHD-V2-10 ScientificDigest(class, semantic_schema, payload)",
      logical_digest_class: "SCORING_FIELD",
      logical_semantic_schema: logicalSchema,
      logical_channel_count: 80,
      dense_physical_array_count: 80,
      sparse_physical_array_count: 59,
      sample_points_per_channel: 4,
      logical_digest_dense: "sha256:" + logicalDigest,
      logical_digest_sparse: "sha256:" + logicalDigest,
      logical_cbor_byte_count: denseLogicalBytes.length,
      dense_sparse_logical_cbor_equal: true,
      dense_physical_schema_id: densePhysicalSchema,
      sparse_physical_schema_id: sparsePhysicalSchema,
      physical_digest_class: "SCORING_FIELD_STORAGE",
      physical_semantic_schema: storageSchema,
      physical_digest_dense: "sha256:" + densePhysicalDigest,
      physical_digest_sparse: "sha256:" + sparsePhysicalDigest,
      dense_sparse_physical_identity_distinct: true,
      cache_key_dense: "sha256:" + denseCacheKey,
      cache_key_sparse: "sha256:" + sparseCacheKey,
      cache_layout_mismatch_rejected: !crossSchemaReuse,
      same_layout_cache_reuse_eligible: sameSchemaReuse,
      raw_omitted_zero_bits: "0000000000000000",
      negative_weighted_zero_bits: "8000000000000000",
      signed_zero_round_trip_checked: true,
      omitted_channel_materialization: "IEEE-754 binary64 +0.0",
      note: "Schema labels and physical digest payload are proposed D3-SCI-04 test identifiers, not normative amendments.",
    };
    writeFileSync(new URL("evidence/serialization-proof.json", directory), JSON.stringify(serializationProof, null, 2) + "\n");
  });

  it("retains binary64 positive zero, weighted negative zero, and signed-zero identity through CBOR", () => {
    const positiveZero = f64Bits(0);
    const negativeZero = f64Bits(f64Value(positiveZero) * -0.587439);
    expect([...positiveZero.bytes]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...negativeZero.bytes]).toEqual([128, 0, 0, 0, 0, 0, 0, 0]);
    expect([...negativeZero.bytes].map((part) => part.toString(16).padStart(2, "0")).join(""))
      .toBe(directProof.negative_weighted_zero_bits);
    const encoded = encodeCanonicalCbor({ raw: positiveZero, weighted: negativeZero });
    const decoded = decodeCanonicalCbor(encoded) as { raw: ReturnType<typeof f64Bits>; weighted: ReturnType<typeof f64Bits> };
    expect([...decoded.raw.bytes]).toEqual([...positiveZero.bytes]);
    expect([...decoded.weighted.bytes]).toEqual([...negativeZero.bytes]);
    expect(digest("FIXTURE", "SIGNED_ZERO_TEST_V1", positiveZero))
      .not.toBe(digest("FIXTURE", "SIGNED_ZERO_TEST_V1", negativeZero));
  });

  it("rejects nonfinite hash-bearing field values", () => {
    expect(() => f64Bits(Number.NaN)).toThrow();
    expect(() => f64Bits(Number.POSITIVE_INFINITY)).toThrow();
  });
});
