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

/** The only preparation profile (task 5.2). Its digest is computed by the worker from tool versions, lock and options. */
export const PREP_PROFILE_ID = "ME_PREP_INTERIM_V0" as const;
export const PREP_PROTONATION = ["EXPLICIT_SUBMITTED", "PROPKA_PREVIEW"] as const;
export const PREP_LIGAND_PROTONATION = ["EXPLICIT_SUBMITTED", "DIMORPHITE_PREVIEW"] as const;
/** Where receptor hydrogens actually came from (MEEKO_TEMPLATES_PREVIEW: Meeko residue templates generated some; PREVIEW_UNQUALIFIED). */
export const PREP_PROTONATION_SOURCE = ["EXPLICIT_SUBMITTED", "PROPKA_PREVIEW", "MEEKO_TEMPLATES_PREVIEW"] as const;
/** INTERIM: all state came from the submitted files or explicit choices. PREVIEW_UNQUALIFIED: some state was generated (PROPKA, Dimorphite-DL, Meeko template hydrogens). */
export const PREP_QUALIFICATION = ["INTERIM", "PREVIEW_UNQUALIFIED"] as const;
const count = z.number().int().min(0).max(1_000_000);

/** Normalised options echoed by the worker into the plan: exactly what --apply will run. */
export const PrepOptionsV1Schema = z
  .object({
    pH: finite.min(0).max(14),
    protonation: z.enum(PREP_PROTONATION),
    ligandProtonation: z.enum(PREP_LIGAND_PROTONATION),
    chainIds: z.array(z.string().min(1).max(4)).max(16).nullable(),
    keepWaters: z.boolean(),
    addMissingAtoms: z.boolean(),
    ligandTemplate: z.boolean(),
  })
  .strict();
export type PrepOptionsV1 = z.infer<typeof PrepOptionsV1Schema>;

export const PrepSummaryV1Schema = z
  .object({
    protonationSource: z.enum(PREP_PROTONATION_SOURCE),
    ligandProtonation: z.enum(PREP_LIGAND_PROTONATION),
    chargeModel: z.string().min(1).max(64),
    rotatableBonds: z.number().int().min(0).max(100),
    receptorAtoms: count,
    ligandAtoms: count,
    receptorHydrogensSubmitted: count,
    receptorHydrogensAdded: count,
    ligandHydrogensAdded: count,
    ligandFormalCharge: z.number().int().min(-50).max(50),
    ligandEmbedded3d: z.boolean(),
  })
  .strict();
export type PrepSummaryV1 = z.infer<typeof PrepSummaryV1Schema>;

export const PrepareRequestSchema = z
  .object({
    receptorArtifactId: ArtifactIdSchema,
    ligandArtifactId: ArtifactIdSchema,
    pH: finite.min(0).max(14).default(7.4),
    protonation: z.enum(["EXPLICIT_SUBMITTED", "PROPKA_PREVIEW"]).default("EXPLICIT_SUBMITTED"),
    chainIds: z.array(z.string().min(1).max(4)).max(16).optional(),
    keepWaters: z.boolean().default(false),
    // 5.2 worker options. Ligand protonation stays as submitted unless Dimorphite-DL is opted in
    // (PREVIEW_UNQUALIFIED). PDBFixer missing heavy atoms are opt-in. A PDB ligand carries no bond
    // orders, so it needs a SMILES template artifact (explicit bond orders), otherwise BLOCKED.
    ligandProtonation: z.enum(PREP_LIGAND_PROTONATION).default("EXPLICIT_SUBMITTED"),
    addMissingAtoms: z.boolean().default(false),
    ligandTemplateArtifactId: ArtifactIdSchema.optional(),
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

/** R.4: where the ligand stereo came from and every stereo element's assignment (never inferred from PDB geometry alone). */
export const PrepLigandStereoSchema = z
  .object({
    source: z.enum(["ISOMERIC_SMILES_TEMPLATE", "ISOMERIC_SMILES", "SUBMITTED_3D", "SUBMITTED_2D_WEDGES"]),
    detail: shortText,
    elements: z
      .array(z.object({ kind: z.string().min(1).max(32), atoms: z.array(z.string().min(1).max(16)).min(1).max(2), label: z.string().min(1).max(16), hOnly: z.boolean() }).strict())
      .max(128),
  })
  .strict();
/** R.5: each hetero group of the selected model, classified, with its distance to the submitted ligand (null: site undetermined). */
export const PrepSiteHeteroSchema = z
  .object({ group: z.string().min(1).max(24), class: z.enum(["LIGAND", "METAL", "COFACTOR", "OTHER"]), distance: finite.min(0).nullable(), inSite: z.boolean() })
  .strict();
/** R.6: the microstate written for every His and its source. */
export const PrepHistidineSchema = z
  .object({
    chain: z.string().min(1).max(1),
    resSeq: z.number().int(),
    iCode: z.string().max(1),
    state: z.enum(["HID", "HIE", "HIP", "UNPROTONATED"]),
    source: z.enum(["SUBMITTED_H", "MEEKO_TEMPLATE", "PROPKA"]),
    distance: finite.min(0).nullable(),
    inSite: z.boolean(),
  })
  .strict();

export const PrepPlanV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: JobIdSchema,
    receptorArtifactId: ArtifactIdSchema,
    ligandArtifactId: ArtifactIdSchema,
    pH: finite.min(0).max(14),
    protonationSource: z.enum(PREP_PROTONATION_SOURCE),
    chargeModel: shortText,
    tautomer: shortText,
    rotatableBonds: z.number().int().min(0).max(100),
    decisions: z.array(PrepDecisionSchema).max(JOB_CAPS.decisionsMax),
    warnings: z.array(shortText).max(JOB_CAPS.diagnosticsMax),
    planDigest: hex64,
    // 5.2 worker fields (optional for older producers; the worker always writes them).
    // UNSUPPORTED: chemistry the profile cannot model (CHEMISTRY_UNSUPPORTED, e.g. a metal or cofactor in the site; R.5).
    status: z.enum(["READY", "BLOCKED", "UNSUPPORTED"]).optional(),
    diagnostics: z.array(shortText).max(JOB_CAPS.diagnosticsMax).optional(),
    profileId: z.literal(PREP_PROFILE_ID).optional(),
    qualification: z.enum(PREP_QUALIFICATION).optional(),
    options: PrepOptionsV1Schema.optional(),
    lockDigest: hex64.optional(),
    // sha256 of the submitted input bytes; part of planDigest so a swapped input fails --apply.
    inputs: z
      .object({ receptorSha256: hex64.nullable(), ligandSha256: hex64.nullable(), ligandTemplateSha256: hex64.nullable() })
      .strict()
      .optional(),
    // R.4-R.6 evidence (worker writes them on READY plans).
    ligandStereo: PrepLigandStereoSchema.optional(),
    siteHetero: z.array(PrepSiteHeteroSchema).max(500).optional(),
    histidines: z.array(PrepHistidineSchema).max(2000).optional(),
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
    // 5.2 worker fields (optional for older producers; the worker always writes them).
    planDigest: hex64.optional(),
    lockDigest: hex64.optional(),
    profileId: z.literal(PREP_PROFILE_ID).optional(),
    profileDigest: hex64.optional(),
    qualification: z.enum(PREP_QUALIFICATION).optional(),
    summary: PrepSummaryV1Schema.optional(),
  })
  .strict();
export type PrepManifestV1 = z.infer<typeof PrepManifestV1Schema>;

export const PREP_JOB_STATES = ["AWAITING_CONFIRMATION", "APPLYING", "SUCCEEDED", "FAILED", "EXPIRED"] as const;
/**
 * Server-side seal outcome for a SUCCEEDED job (task 5.2b). REJECTED: an output or the manifest failed
 * re-hashing. BLOCKED: D2 evidence is missing (never filled with placeholders). PREVIEW_UNQUALIFIED: every
 * input is present but some chemistry was generated (PROPKA, Dimorphite-DL, template hydrogens). SEALED: D2 sealed.
 */
export const PREP_SEAL_STATUSES = ["SEALED", "PREVIEW_UNQUALIFIED", "BLOCKED", "REJECTED"] as const;
/** Per-component D2 seal result. digest: the sealed D2 state digest (sha256:...), present only when SEALED. */
export const PrepComponentSealV1Schema = z
  .object({
    status: z.enum(["SEALED", "PREVIEW_UNQUALIFIED", "BLOCKED"]),
    reasonCodes: z.array(z.string().min(1).max(64)).max(50),
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  })
  .strict();
export type PrepComponentSealV1 = z.infer<typeof PrepComponentSealV1Schema>;
export const PrepSealSummaryV1Schema = z
  .object({
    status: z.enum(PREP_SEAL_STATUSES),
    qualification: z.enum(PREP_QUALIFICATION),
    reasonCodes: z.array(z.string().min(1).max(64)).max(JOB_CAPS.diagnosticsMax),
    verifiedOutputs: z.number().int().min(0).max(JOB_CAPS.outputsMax),
    /** SEALED overall needs both components SEALED; prepared ids are minted only then. */
    components: z.object({ receptor: PrepComponentSealV1Schema, ligand: PrepComponentSealV1Schema }).strict().optional(),
  })
  .strict();
export type PrepSealSummaryV1 = z.infer<typeof PrepSealSummaryV1Schema>;
export const PrepJobStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: JobIdSchema,
    state: z.enum(PREP_JOB_STATES),
    plan: PrepPlanV1Schema.optional(),
    manifest: PrepManifestV1Schema.optional(),
    preparedReceptorId: ArtifactIdSchema.optional(),
    preparedLigandId: ArtifactIdSchema.optional(),
    /**
     * Server-minted opaque handles for a PREVIEW_UNQUALIFIED result (task 5.4): pvrec_/pvlig_ + job + random
     * token. Dockable only as PREVIEW_UNQUALIFIED (owner decision; capability VINA_COMPARATOR_PREVIEW, 5.6).
     */
    previewReceptorId: ArtifactIdSchema.optional(),
    previewLigandId: ArtifactIdSchema.optional(),
    seal: PrepSealSummaryV1Schema.optional(),
    error: shortText.optional(),
    createdAt: z.string().max(40),
    expiresAt: z.string().max(40),
    /** Last persisted transition (server clock); drives retention/garbage collection. */
    updatedAt: z.string().max(40).optional(),
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
    // Vina needs seed >= 1 (tools/mole-dock/run.mjs); the contract follows the stricter side (task 5.4).
    seed: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();
export type DockJobRequest = z.infer<typeof DockJobRequestSchema>;

/**
 * R.2: exactly the six research job states (AT-0227/0228). BLOCKED is never a job status (it is a failure
 * reason or diagnostic). Old PREPARING/SUCCEEDED values are legacy: see DOCK_LEGACY_STATUS_MAP.
 */
export const DOCK_JOB_STATUSES = ["CREATED", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
export type DockJobStatusName = (typeof DOCK_JOB_STATUSES)[number];
export const DOCK_JOB_TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"] as const;
/** The current stage of a RUNNING job (a field, not a status). */
export const DOCK_JOB_STAGES = ["PREPARING", "DOCKING", "RESCORING"] as const;
export type DockJobStage = (typeof DOCK_JOB_STAGES)[number];
const stageSchema = z.enum(DOCK_JOB_STAGES);
/** Persisted pre-R.2 states: SUCCEEDED -> COMPLETED; PREPARING -> RUNNING with stage PREPARING. */
export const DOCK_LEGACY_STATUS_MAP: Readonly<Record<string, { status: DockJobStatusName; stage?: DockJobStage }>> = Object.freeze({
  SUCCEEDED: { status: "COMPLETED" },
  PREPARING: { status: "RUNNING", stage: "PREPARING" },
});

/**
 * Persisted docking job state (task 5.4, design 5.4): <root>/<jobId>/state.json. The server resolves the
 * prepared ids; everything in provenance is server-computed. Results stay PREVIEW_UNQUALIFIED (meScore null).
 */
export const DockJobProvenanceV1Schema = z
  .object({
    preparedReceptorId: ArtifactIdSchema,
    preparedLigandId: ArtifactIdSchema,
    /** Preparation job of the receptor. */
    prepJobId: JobIdSchema,
    /** Preparation job of the ligand (may differ from the receptor's). */
    ligandPrepJobId: JobIdSchema,
    prepSealStatus: z.enum(["SEALED", "PREVIEW_UNQUALIFIED"]),
    prepQualification: z.enum(PREP_QUALIFICATION),
    receptorSha256: hex64,
    ligandSha256: hex64,
    seed: z.number().int().min(1).max(2_147_483_647),
    /** Vina pin from native/third_party/TOOLS.md. */
    vinaPin: z.object({ version: z.string().min(1).max(32), sha256: hex64 }).strict(),
    /** What the engine reported on this run (null until the run verified the binary). */
    vina: z.object({ versionReported: z.string().max(80), binarySha256: hex64 }).strict().nullable(),
  })
  .strict();
export type DockJobProvenanceV1 = z.infer<typeof DockJobProvenanceV1Schema>;

export const DockJobStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: JobIdSchema,
    inputDigest: hex64,
    status: z.enum(DOCK_JOB_STATUSES),
    /** Current stage while RUNNING (a field, never a status). */
    stage: stageSchema.optional(),
    /** Process boot that last owned this job; a different boot means the run was interrupted. */
    bootId: z.string().regex(/^[0-9a-f-]{36}$/),
    cancelRequested: z.boolean(),
    /** Only real stage points: 0 created/queued, 0.05 running/preparing, 0.1 running/docking, 1 done. */
    progress: z.number().min(0).max(1),
    error: z.object({ code: z.string().min(1).max(64), message: shortText }).strict().optional(),
    provenance: DockJobProvenanceV1Schema,
    /** Last event seq written for this job. */
    seq: z.number().int().min(0).max(JOB_CAPS.eventsMax),
    createdAt: z.string().max(40),
    updatedAt: z.string().max(40),
  })
  .strict();
export type DockJobStateV1 = z.infer<typeof DockJobStateV1Schema>;

/** tools/mole-dock/run.mjs result.json on exit 0 (the fields the API re-checks; other keys pass through). */
export const MoleDockRunResultV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    status: z.literal("OK"),
    label: z.literal("PREVIEW_UNQUALIFIED"),
    engine: z.object({ name: z.string().max(64), version: z.string().max(32), versionReported: z.string().max(80), binarySha256: hex64, pinnedSha256: hex64 }).strict(),
    inputs: z.object({ jobSha256: hex64, receptor: z.object({ sha256: hex64 }).passthrough(), ligand: z.object({ sha256: hex64 }).passthrough() }).strict(),
    vinaScore: finite,
    meScore: z.null(),
    meScoreStatus: z.object({ status: z.literal("UNAVAILABLE"), reason: z.string().min(1).max(64) }).strict(),
    poses: z
      .array(z.object({ rank: z.number().int().min(1), vinaScore: finite, rmsdLbFromBest: finite.nullable(), rmsdUbFromBest: finite.nullable(), atomCount: z.number().int().min(1), meScore: z.null(), terms: z.null() }).strict())
      .min(1)
      .max(JOB_CAPS.posesMax),
    outputs: z.object({ "poses.pdbqt": hex64 }).strict(),
  })
  .passthrough();
export const MoleDockRunManifestV1Schema = z
  .object({ schemaVersion: z.literal(1), kind: z.literal("mole-dock-run"), status: z.literal("OK"), files: z.record(z.string().max(64), hex64), engineSha256: hex64 })
  .passthrough();

/** Result of a COMPLETED docking job, bound to its jobId and inputDigest. Vina scores only; meScore is null. */
export const DockJobResultV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: JobIdSchema,
    inputDigest: hex64,
    label: z.literal("PREVIEW_UNQUALIFIED"),
    vinaScore: finite,
    meScore: z.null(),
    meScoreStatus: z.object({ status: z.literal("UNAVAILABLE"), reason: z.string().min(1).max(64) }).strict(),
    poses: z
      .array(
        z
          .object({
            rank: z.number().int().min(1).max(JOB_CAPS.posesMax),
            vinaScore: finite,
            rmsdLbFromBest: finite.nullable(),
            rmsdUbFromBest: finite.nullable(),
            atomCount: z.number().int().min(1).max(100_000),
            meScore: z.null(),
          })
          .strict(),
      )
      .min(1)
      .max(JOB_CAPS.posesMax),
    posesSha256: hex64,
    provenance: DockJobProvenanceV1Schema,
  })
  .strict();
export type DockJobResultV1 = z.infer<typeof DockJobResultV1Schema>;

export const JobStatusSchema = z
  .object({
    jobId: JobIdSchema,
    status: z.enum(DOCK_JOB_STATUSES),
    stage: stageSchema.optional(),
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

/** Claim semantics for a docking score (RESEARCH-DIGEST section 1): an empirical ranking score, never an energy or affinity. */
export const DOCK_SCORE_LABEL = {
  scoreName: "Vina score",
  scoreDirection: "lower is better",
  scoringProfile: "AutoDock Vina 1.2.7 default scoring",
  unitsNote: "empirical, kcal/mol-scaled; not a binding free energy",
} as const;
export const DockScoreLabelSchema = z
  .object({
    scoreName: z.literal(DOCK_SCORE_LABEL.scoreName),
    scoreDirection: z.literal(DOCK_SCORE_LABEL.scoreDirection),
    scoringProfile: z.string().min(1).max(120),
    unitsNote: z.literal(DOCK_SCORE_LABEL.unitsNote),
  })
  .strict();
export type DockScoreLabel = z.infer<typeof DockScoreLabelSchema>;

export const DockResultSchema = z
  .object({
    jobId: JobIdSchema,
    poses: z.array(DockPoseSchema).max(JOB_CAPS.posesMax),
    manifestRef: z.object({ artifactId: ArtifactIdSchema }).strict(),
    scoreStatus: z.enum(["QUALIFIED", "PREVIEW_UNQUALIFIED", "UNAVAILABLE"]),
    scoreLabel: DockScoreLabelSchema.optional(),
  })
  .strict();
export type DockResult = z.infer<typeof DockResultSchema>;

const evBase = { jobId: JobIdSchema, seq: z.number().int().min(0).max(JOB_CAPS.eventsMax), at: z.string().max(40) };
export const JobEventSchema = z.discriminatedUnion("type", [
  z.object({ ...evBase, type: z.literal("status"), status: z.enum(DOCK_JOB_STATUSES), stage: stageSchema.optional() }).strict(),
  z.object({ ...evBase, type: z.literal("stage"), stage: stageSchema }).strict(),
  z.object({ ...evBase, type: z.literal("progress"), progress: z.number().min(0).max(1), message: shortText.optional() }).strict(),
  z.object({ ...evBase, type: z.literal("log"), line: z.string().max(1000) }).strict(),
  z.object({ ...evBase, type: z.literal("result"), resultReady: z.literal(true) }).strict(),
  z.object({ ...evBase, type: z.literal("error"), message: shortText }).strict(),
]);
export type JobEvent = z.infer<typeof JobEventSchema>;

// ---- Docking job HTTP surface (task 5.5) ----

/**
 * Owner decision 2026-10-09 (RESEARCH-DIGEST section 7, Q1): the Vina run is a separate EXPERIMENTAL capability,
 * VINA_COMPARATOR_PREVIEW, reported on separate axes (never collapsed). DOCKING.RUN (Mole engine) stays
 * UNAVAILABLE until D8 [AT-0240, AT-0262]. The run routes answer only when FEATURE_DOCKING_RUN=1.
 */
export const VINA_COMPARATOR_PREVIEW_ID = "VINA_COMPARATOR_PREVIEW" as const;
export const DOCKING_PREVIEW_NOTICE = "Preview. Results are not scientifically qualified. Scores are empirical ranking scores, not binding affinities." as const;
export const VinaComparatorCapabilityV1Schema = z
  .object({
    id: z.literal(VINA_COMPARATOR_PREVIEW_ID),
    /** Runtime availability: false unless FEATURE_DOCKING_RUN=1. */
    available: z.boolean(),
    capability: z.enum(["EXPERIMENTAL", "UNAVAILABLE"]),
    implementation: z.literal("IMPLEMENTED_UNVERIFIED"),
    validation: z.literal("NOT_EVALUATED"),
    engine: z.object({ name: z.literal("AutoDock Vina"), version: z.string().min(1).max(32) }).strict(),
    resultLabel: z.literal("PREVIEW_UNQUALIFIED"),
    notice: z.literal(DOCKING_PREVIEW_NOTICE),
    /** Why it is unavailable and what would resolve it (V2-01 section 19). */
    unavailableReason: shortText.optional(),
  })
  .strict();
export type VinaComparatorCapabilityV1 = z.infer<typeof VinaComparatorCapabilityV1Schema>;

export const vinaComparatorCapability = (available: boolean, vinaVersion = "1.2.7"): VinaComparatorCapabilityV1 => ({
  id: VINA_COMPARATOR_PREVIEW_ID,
  available,
  capability: available ? "EXPERIMENTAL" : "UNAVAILABLE",
  implementation: "IMPLEMENTED_UNVERIFIED",
  validation: "NOT_EVALUATED",
  engine: { name: "AutoDock Vina", version: vinaVersion },
  resultLabel: "PREVIEW_UNQUALIFIED",
  notice: DOCKING_PREVIEW_NOTICE,
  ...(available ? {} : { unavailableReason: "The Vina comparator preview is off. Start the API with FEATURE_DOCKING_RUN=1 to enable it." }),
});

/** Score semantics carried with every result: name, kind, direction, scale, profile [AT-0107, AT-0108; V2-01 App.C]. */
export const VINA_SCORE_SEMANTICS = Object.freeze({
  name: "Vina docking score",
  kind: "EMPIRICAL_RANKING_SCORE",
  direction: "LOWER_IS_BETTER",
  scale: "Vina empirical ranking scale (kcal/mol-like units; not a binding free energy or affinity)",
  profile: "AutoDock Vina 1.2.7, vina scoring function, pinned binary",
} as const);

/** POST /api/docking/jobs answer (202). */
export const DockJobSubmitResponseV1Schema = z.object({ jobId: JobIdSchema, deduped: z.boolean(), job: DockJobStateV1Schema }).strict();
export type DockJobSubmitResponseV1 = z.infer<typeof DockJobSubmitResponseV1Schema>;

/** GET /api/docking/jobs/:id/result: the stored result plus its capability axes and claim labels. */
export const DockJobResultResponseV1Schema = DockJobResultV1Schema.extend({
  capability: VinaComparatorCapabilityV1Schema,
  notice: z.literal(DOCKING_PREVIEW_NOTICE),
  vinaScoreSemantics: z
    .object({ name: z.string().max(64), kind: z.literal("EMPIRICAL_RANKING_SCORE"), direction: z.literal("LOWER_IS_BETTER"), scale: z.string().max(160), profile: z.string().max(160) })
    .strict(),
}).strict();
export type DockJobResultResponseV1 = z.infer<typeof DockJobResultResponseV1Schema>;

/** Downloadable files of a COMPLETED job (whitelist; nothing else under the job dir is ever served). */
export const DOCK_JOB_ARTIFACTS: Readonly<Record<"poses.pdbqt" | "result.json" | "manifest.json", string>> = Object.freeze({
  "poses.pdbqt": "chemical/x-pdbqt; charset=utf-8",
  "result.json": "application/json; charset=utf-8",
  "manifest.json": "application/json; charset=utf-8",
});
export type DockJobArtifactName = keyof typeof DOCK_JOB_ARTIFACTS;
