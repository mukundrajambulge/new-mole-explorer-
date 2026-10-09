import { z } from "zod";

/** Request-shape schemas for apps/api routes. Strings are length-capped; the body byte cap is enforced before parsing. */

const shortText = (max = 200) => z.string().max(max);
const jsonRecord = z.record(z.unknown());
const idText = shortText(300);
const modeEnum = z.enum(["SYNC", "ASYNC", "AUTO"]);
const surfaceEnum = z.enum(["GUI", "CONSOLE", "REST", "SDK", "MACRO", "BATCH"]);

export const PROJECT_ID_PATTERN = /^project_[a-f0-9-]{1,80}$/i;
export const REVISION_ID_PATTERN = /^session-revision-(migration-)?[0-9a-f-]{1,80}$/;

export const projectIdSchema = z.string().regex(PROJECT_ID_PATTERN, "Invalid project ID.");
export const revisionIdSchema = z.string().regex(REVISION_ID_PATTERN, "Invalid revision ID.");
export const pathIdSchema = z.string().min(1).max(300);

/** Request bodies must be JSON objects; null, arrays and scalars are rejected up front. */
export const bodyObjectSchema = z.record(z.unknown());

export const projectCreateBodySchema = z.object({ name: shortText().optional() }).passthrough();

export const projectOpenQuerySchema = z.object({ revision: revisionIdSchema.optional() });

const refList = z.array(z.object({ objectId: idText }).passthrough()).max(100_000);
const sessionDraftSchema = z.object({
  objects: z.array(z.object({
    objectId: idText.min(1),
    stateOrder: z.array(idText).max(100_000),
    currentStateId: idText,
    scientificRevisionId: idText.optional(),
    loadResult: jsonRecord.optional(),
  }).passthrough()).max(10_000),
  activeObjectId: idText.nullable().optional(),
  workspaceGroups: z.array(z.object({ objectIds: z.array(idText).max(100_000).optional() }).passthrough()).max(100_000),
  selections: z.array(z.object({ selectionId: idText.optional(), sourceRevisionRefs: refList }).passthrough()).max(100_000),
  results: z.array(z.object({ resultId: idText.optional(), sourceRevisionRefs: refList }).passthrough()).max(100_000),
  sceneCollection: z.object({ scenes: z.array(z.object({ sceneId: idText.optional(), objectRefs: refList }).passthrough()).max(100_000) }).passthrough(),
}).passthrough();

export const projectSaveBodySchema = z.object({
  name: shortText().optional(),
  structure: jsonRecord.nullable().optional(),
  presentation: jsonRecord.optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  session: sessionDraftSchema.optional(),
}).passthrough().refine((body) => body.session !== undefined || body.presentation !== undefined, { message: "session or presentation is required", path: ["presentation"] });

export const canonicalCommandSchema = z.object({
  commandId: idText,
  commandType: idText,
  commandVersion: idText,
  schemaVersion: z.number(),
  normalizedArgs: jsonRecord,
  boundRefs: z.object({
    objectIds: z.array(idText).optional(),
    selectionIds: z.array(idText).optional(),
    stateIds: z.array(idText).optional(),
    settingScopes: z.array(idText).optional(),
  }).passthrough(),
  origin: z.object({
    surface: surfaceEnum,
    profile: idText,
    profileVersion: idText,
    syntaxVersion: idText,
    sourceHash: idText,
    sourceText: z.string().optional(),
    resolvedPublicName: idText.optional(),
  }).passthrough(),
  requestedMode: modeEnum,
  correlationId: idText,
  idempotencyKey: idText.optional(),
  submittedAt: idText,
  semanticHash: idText,
  expectedRevisions: z.record(z.union([z.string(), z.number()])).optional(),
}).passthrough();

const commandMeta = {
  correlationId: idText.optional(),
  idempotencyKey: idText.optional(),
};

export const commandBodySchema = z.object({
  rawCommand: z.string().optional(),
  command: canonicalCommandSchema.optional(),
  surface: surfaceEnum.optional(),
  requestedMode: modeEnum.optional(),
  ...commandMeta,
}).passthrough();

export const commandBatchBodySchema = z.object({
  rawCommand: z.string(),
  requestedMode: modeEnum.optional(),
  ...commandMeta,
}).passthrough();

/** Either { command, ... } or a bare canonical command carrying commandType. */
export const commandExecuteBodySchema = z.union([
  z.object({ command: canonicalCommandSchema, requestedMode: modeEnum.optional(), ...commandMeta }).passthrough(),
  canonicalCommandSchema,
]);

export const commandReplayBodySchema = z.object({ mode: z.enum(["COMMAND_REPLAY", "REVIEW", "REPRODUCTION_ATTEMPT"]).optional() }).passthrough();

export const rcsbBodySchema = z.object({ pdbId: z.string().max(16) });

export const d2AdaptBodySchema = z.object({ structure: jsonRecord, sourceArtifact: jsonRecord.optional() }).passthrough();
export const d2SearchRegionBodySchema = z.object({ input: jsonRecord }).passthrough();

/** Upload metadata that arrives in headers. */
export const uploadHeadersSchema = z.object({ parentExportArtifactId: shortText(300).regex(/^[A-Za-z0-9_.:-]*$/).optional() });
