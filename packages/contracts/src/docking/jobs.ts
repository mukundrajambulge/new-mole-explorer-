import { z } from "zod";

/**
 * Docking job API contract (task 5.0), shared by UI and backend.
 * Clients send opaque artifact ids only: never sha256 values, profile ids or
 * profile digests. All objects are strict, so extra keys are rejected.
 */

export const JOB_CAPS = {
  idMax: 64,
  stringMax: 500,
  acksMax: 32,
  decisionsMax: 200,
  stagesMax: 16,
  outputsMax: 32,
  diagnosticsMax: 100,
  posesMax: 100,
  termsMax: 32,
  eventsMax: 10_000,
  boxSizeMin: 1,
  boxSizeMax: 40,
  boxCenterAbsMax: 10_000,
} as const;

const idRe = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
export const ArtifactIdSchema = z.string().min(1).max(JOB_CAPS.idMax).regex(idRe);
export const JobIdSchema = z.string().min(1).max(JOB_CAPS.idMax).regex(idRe);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const shortText = z.string().max(JOB_CAPS.stringMax);
const finite = z.number().finite();
const relPath = z
  .string()
  .min(1)
  .max(260)
  .refine(
    (p) => !p.startsWith("/") && !p.includes("\\") && !/^[A-Za-z]:/.test(p) && !p.split("/").some((s) => s === ".." || s === "." || s === ""),
    "relative path inside job dir only",
  );

const centerCoord = finite.min(-JOB_CAPS.boxCenterAbsMax).max(JOB_CAPS.boxCenterAbsMax);
const boxCenter = z.tuple([centerCoord, centerCoord, centerCoord]);
const boxEdge = finite.min(JOB_CAPS.boxSizeMin).max(JOB_CAPS.boxSizeMax);

// ---- Preparation (aligned with docs/sprint/design/5.2.md) ----

export const PrepareRequestSchema = z
  .object({
    receptorArtifactId: ArtifactIdSchema,
    ligandArtifactId: ArtifactIdSchema,
    pH: finite.min(0).max(14).default(7.4),
    protonation: z.enum(["EXPLICIT_SUBMITTED", "PROPKA_PREVIEW"]).default("EXPLICIT_SUBMITTED"),
    chainIds: z.array(z.string().min(1).max(4)).max(16).optional(),
    keepWaters: z.boolean().default(false),
  })
  .strict();
export type PrepareRequest = z.infer<typeof PrepareRequestSchema>;

export const PrepDecisionSchema = z
  .object({
    key: z.string().min(1).max(64),
    choice: shortText,
    atomsBefore: z.number().int().min(0).max(1_000_000),
    atomsAfter: z.number().int().min(0).max(1_000_000),
    requiresAck: z.boolean(),
  })
  .strict();

export const PrepPlanV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: JobIdSchema,
    receptorArtifactId: ArtifactIdSchema,
    ligandArtifactId: ArtifactIdSchema,
    pH: finite.min(0).max(14),
    protonationSource: z.enum(["EXPLICIT_SUBMITTED", "PROPKA_PREVIEW"]),
    chargeModel: shortText,
    tautomer: shortText,
    rotatableBonds: z.number().int().min(0).max(100),
    decisions: z.array(PrepDecisionSchema).max(JOB_CAPS.decisionsMax),
    warnings: z.array(shortText).max(JOB_CAPS.diagnosticsMax),
    planDigest: hex64,
  })
  .strict();
export type PrepPlanV1 = z.infer<typeof PrepPlanV1Schema>;

export const PrepConfirmationV1Schema = z
  .object({
    jobId: JobIdSchema,
    planDigest: hex64,
    acks: z.array(z.string().min(1).max(64)).max(JOB_CAPS.acksMax),
  })
  .strict();
export type PrepConfirmationV1 = z.infer<typeof PrepConfirmationV1Schema>;

export const PrepManifestV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: JobIdSchema,
    status: z.enum(["PREPARED", "BLOCKED"]),
    stages: z
      .array(
        z
          .object({
            tool: z.string().min(1).max(64),
            version: z.string().min(1).max(32),
            params: z.record(z.string().max(64), z.union([z.string().max(200), z.number().finite(), z.boolean()])),
            inSha: hex64,
            outSha: hex64,
            decisions: z.array(shortText).max(JOB_CAPS.decisionsMax),
          })
          .strict(),
      )
      .max(JOB_CAPS.stagesMax),
    outputs: z
      .array(
        z
          .object({
            role: z.enum(["RECEPTOR_PDBQT", "LIGAND_PDBQT", "RECEPTOR_CLEAN", "LIGAND_CLEAN", "CANONICAL_JSON"]),
            relPath,
            sha256: hex64,
            bytes: z.number().int().min(0).max(20 * 1024 * 1024),
          })
          .strict(),
      )
      .max(JOB_CAPS.outputsMax),
    diagnostics: z.array(shortText).max(JOB_CAPS.diagnosticsMax),
  })
  .strict();
export type PrepManifestV1 = z.infer<typeof PrepManifestV1Schema>;

export const PREP_JOB_STATES = ["AWAITING_CONFIRMATION", "APPLYING", "SUCCEEDED", "FAILED", "EXPIRED"] as const;
export const PrepJobStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: JobIdSchema,
    state: z.enum(PREP_JOB_STATES),
    plan: PrepPlanV1Schema.optional(),
    manifest: PrepManifestV1Schema.optional(),
    preparedReceptorId: ArtifactIdSchema.optional(),
    preparedLigandId: ArtifactIdSchema.optional(),
    error: shortText.optional(),
    createdAt: z.string().max(40),
    expiresAt: z.string().max(40),
  })
  .strict();
export type PrepJobStateV1 = z.infer<typeof PrepJobStateV1Schema>;
/** Prepare report shown to the user: the job state once preparation ended. */
export const PrepareReportSchema = PrepJobStateV1Schema;
export type PrepareReport = PrepJobStateV1;

// ---- Docking jobs ----

export const DockJobRequestSchema = z
  .object({
    receptorPreparedId: ArtifactIdSchema,
    ligandPreparedId: ArtifactIdSchema,
    boxCenter,
    boxSize: z.tuple([boxEdge, boxEdge, boxEdge]),
    exhaustiveness: z.number().int().min(1).max(64).default(8),
    numPoses: z.number().int().min(1).max(20).default(9),
    seed: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();
export type DockJobRequest = z.infer<typeof DockJobRequestSchema>;

export const DOCK_JOB_STATUSES = ["QUEUED", "PREPARING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;
export type DockJobStatusName = (typeof DOCK_JOB_STATUSES)[number];
export const DOCK_JOB_TERMINAL_STATUSES = ["SUCCEEDED", "FAILED", "CANCELLED"] as const;

export const JobStatusSchema = z
  .object({
    jobId: JobIdSchema,
    status: z.enum(DOCK_JOB_STATUSES),
    progress: z.number().min(0).max(1),
    message: shortText.optional(),
    error: shortText.optional(),
    createdAt: z.string().max(40),
    updatedAt: z.string().max(40),
  })
  .strict();
export type JobStatus = z.infer<typeof JobStatusSchema>;

const termsSchema = z.record(z.string().min(1).max(48), finite).refine((r) => Object.keys(r).length <= JOB_CAPS.termsMax, "too many terms");

export const DockPoseSchema = z
  .object({
    rank: z.number().int().min(1).max(JOB_CAPS.posesMax),
    vinaScore: finite,
    meScore: finite.nullable(),
    meTerms: termsSchema,
    vinaTerms: termsSchema.optional(),
    poseArtifactId: ArtifactIdSchema,
  })
  .strict();

export const DockResultSchema = z
  .object({
    jobId: JobIdSchema,
    poses: z.array(DockPoseSchema).max(JOB_CAPS.posesMax),
    manifestRef: z.object({ artifactId: ArtifactIdSchema }).strict(),
    scoreStatus: z.enum(["QUALIFIED", "PREVIEW_UNQUALIFIED", "UNAVAILABLE"]),
  })
  .strict();
export type DockResult = z.infer<typeof DockResultSchema>;

const evBase = { jobId: JobIdSchema, seq: z.number().int().min(0).max(JOB_CAPS.eventsMax), at: z.string().max(40) };
export const JobEventSchema = z.discriminatedUnion("type", [
  z.object({ ...evBase, type: z.literal("status"), status: z.enum(DOCK_JOB_STATUSES) }).strict(),
  z.object({ ...evBase, type: z.literal("progress"), progress: z.number().min(0).max(1), message: shortText.optional() }).strict(),
  z.object({ ...evBase, type: z.literal("log"), line: z.string().max(1000) }).strict(),
  z.object({ ...evBase, type: z.literal("result"), resultReady: z.literal(true) }).strict(),
  z.object({ ...evBase, type: z.literal("error"), message: shortText }).strict(),
]);
export type JobEvent = z.infer<typeof JobEventSchema>;
