import { describe, expect, it } from "vitest";
import {
  PREP_PROFILE_ID,
  PrepManifestV1Schema,
  PrepOptionsV1Schema,
  PrepPlanV1Schema,
  PrepareRequestSchema,
  PrepSummaryV1Schema,
} from "@molecular/contracts";

// 5.2 worker extensions of the 5.0 preparation contracts (plan/apply CLI output shapes).
const sha = "b".repeat(64);
const options = { pH: 7.4, protonation: "EXPLICIT_SUBMITTED", ligandProtonation: "EXPLICIT_SUBMITTED", chainIds: null, keepWaters: false, addMissingAtoms: false, ligandTemplate: false };
const summary = {
  protonationSource: "EXPLICIT_SUBMITTED",
  ligandProtonation: "EXPLICIT_SUBMITTED",
  chargeModel: "gasteiger",
  rotatableBonds: 1,
  receptorAtoms: 400,
  ligandAtoms: 9,
  receptorHydrogensSubmitted: 0,
  receptorHydrogensAdded: 67,
  ligandHydrogensAdded: 6,
  ligandFormalCharge: 0,
  ligandEmbedded3d: true,
};
const plan = {
  schemaVersion: 1,
  jobId: "j1",
  receptorArtifactId: "r",
  ligandArtifactId: "l",
  pH: 7.4,
  protonationSource: "EXPLICIT_SUBMITTED",
  chargeModel: "gasteiger",
  tautomer: "AS_SUBMITTED",
  rotatableBonds: 1,
  decisions: [{ key: "WATERS", choice: "remove 10 waters", atomsBefore: 10, atomsAfter: 0, requiresAck: true }],
  warnings: [],
  planDigest: sha,
  status: "READY",
  diagnostics: [],
  profileId: PREP_PROFILE_ID,
  qualification: "PREVIEW_UNQUALIFIED",
  options,
  lockDigest: sha,
};

describe("5.2 prep worker contracts", () => {
  it("request accepts the new opt-in options with safe defaults", () => {
    const r = PrepareRequestSchema.parse({ receptorArtifactId: "r1", ligandArtifactId: "l1" });
    expect(r.ligandProtonation).toBe("EXPLICIT_SUBMITTED");
    expect(r.addMissingAtoms).toBe(false);
    expect(PrepareRequestSchema.safeParse({ receptorArtifactId: "r1", ligandArtifactId: "l1", ligandProtonation: "AUTO" }).success).toBe(false);
    expect(PrepareRequestSchema.safeParse({ receptorArtifactId: "r1", ligandArtifactId: "l1", ligandTemplateArtifactId: "../x" }).success).toBe(false);
  });
  it("worker plan round-trips and rejects foreign profile ids", () => {
    const parsed = PrepPlanV1Schema.parse(JSON.parse(JSON.stringify(plan)));
    expect(parsed).toEqual(plan);
    expect(PrepPlanV1Schema.safeParse({ ...plan, profileId: "ME_PREP_OTHER" }).success).toBe(false);
    expect(PrepPlanV1Schema.safeParse({ ...plan, status: "PREPARED" }).success).toBe(false);
    expect(PrepPlanV1Schema.safeParse({ ...plan, options: { ...options, extra: 1 } }).success).toBe(false);
    expect(PrepOptionsV1Schema.safeParse({ ...options, pH: Number.NaN }).success).toBe(false);
  });
  it("worker manifest round-trips with summary and enforces caps", () => {
    const m = {
      schemaVersion: 1,
      jobId: "j1",
      status: "PREPARED",
      stages: [{ tool: "meeko.ligand", version: "0.8.0", params: { charge_model: "gasteiger" }, inSha: sha, outSha: sha, decisions: [] }],
      outputs: [{ role: "LIGAND_PDBQT", relPath: "out/ligand.pdbqt", sha256: sha, bytes: 100 }],
      diagnostics: [],
      planDigest: sha,
      lockDigest: sha,
      profileId: PREP_PROFILE_ID,
      profileDigest: sha,
      qualification: "INTERIM",
      summary,
    };
    expect(PrepManifestV1Schema.parse(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(PrepSummaryV1Schema.safeParse({ ...summary, rotatableBonds: 101 }).success).toBe(false);
    expect(PrepSummaryV1Schema.safeParse({ ...summary, ligandAtoms: -1 }).success).toBe(false);
    expect(PrepManifestV1Schema.safeParse({ ...m, profileDigest: "abc" }).success).toBe(false);
    expect(PrepManifestV1Schema.safeParse({ ...m, diagnostics: Array(101).fill("x") }).success).toBe(false);
  });
});
