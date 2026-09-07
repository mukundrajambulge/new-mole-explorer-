import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ActionRecord, CanonicalCommand, CommandDiagnostic, CommandJob, CommandJobState, CommandResult, JsonRecord, JsonValue } from "@molecular/contracts";
import { COMMAND_REGISTRY_VERSION, SAFE_PYMOL_COMPAT_PROFILE } from "@molecular/contracts";
import { compileSafeCommand, compileSafeCommands, sha256, type CommandBindingContext } from "./compiler.js";
import { COMMAND_SPECS, commandInventorySummary, commandRegistryAsJson, resolveCommand } from "./registry.js";
import { SettingStore } from "./settings.js";

export type CommandHandlerContext = { settings: SettingStore; command: CanonicalCommand; dispatcher: CommandDispatcher };
export type CommandHandler = (context: CommandHandlerContext) => JsonValue;
export type DispatchRequest = { rawCommand?: string; command?: CanonicalCommand; surface?: "GUI" | "CONSOLE" | "REST" | "SDK" | "MACRO" | "BATCH"; requestedMode?: "SYNC" | "ASYNC" | "AUTO"; correlationId?: string; idempotencyKey?: string };
export type BatchDispatchRequest = Omit<DispatchRequest, "command"> & { rawCommand: string };
export type RevisionProvider = Readonly<Record<string, string | number>> | (() => Readonly<Record<string, string | number>>);

const now = () => new Date().toISOString();
const commandDiagnostic = (code: CommandDiagnostic["code"], message: string, retryable = false): CommandDiagnostic => ({ code, message, retryable });
const executionIdFor = (command: CanonicalCommand): string => `exec:${sha256(`${command.commandId}:${command.semanticHash}`).slice(0, 24)}`;

export class ActionRecordStore {
  private readonly records = new Map<string, ActionRecord>();
  private readonly idempotency = new Map<string, string>();
  private readonly filePath?: string;

  constructor(dataRoot?: string) {
    if (!dataRoot) return;
    mkdirSync(dataRoot, { recursive: true });
    this.filePath = join(dataRoot, "command-history.jsonl");
    try {
      const lines = readFileSync(this.filePath, "utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const record = JSON.parse(line) as ActionRecord;
        this.records.set(record.actionRecordId, record);
        if (record.idempotencyKey) this.idempotency.set(record.idempotencyKey, record.actionRecordId);
      }
    } catch { /* A missing history file is an empty history, not a failed command. */ }
  }

  put(record: ActionRecord): void {
    this.records.set(record.actionRecordId, record);
    if (record.idempotencyKey) this.idempotency.set(record.idempotencyKey, record.actionRecordId);
    if (this.filePath) appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }

  get(id: string): ActionRecord | undefined { return this.records.get(id); }
  byIdempotency(key: string): ActionRecord | undefined { const id = this.idempotency.get(key); return id ? this.records.get(id) : undefined; }
  list(): readonly ActionRecord[] { return [...this.records.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)); }
}

const json = (value: unknown): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(json);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, child]) => child !== undefined).map(([key, child]) => [key, json(child)]));
  return String(value);
};

export class CommandDispatcher {
  readonly settings: SettingStore;
  readonly history: ActionRecordStore;
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly jobs = new Map<string, CommandJob>();
  private readonly pendingIdempotency = new Map<string, string>();
  private readonly bindings?: CommandBindingContext;
  private readonly revisions?: RevisionProvider;

  constructor(options: { dataRoot?: string; settings?: SettingStore; history?: ActionRecordStore; bindings?: CommandBindingContext; revisions?: RevisionProvider } = {}) {
    this.settings = options.settings ?? new SettingStore();
    this.history = options.history ?? new ActionRecordStore(options.dataRoot);
    this.bindings = options.bindings;
    this.revisions = options.revisions;
    this.register("system.help", ({ command }) => {
      const topic = typeof command.normalizedArgs.topic === "string" ? command.normalizedArgs.topic.toLowerCase() : "";
      return json(COMMAND_SPECS.filter((entry) => !topic || entry.canonicalName.includes(topic) || entry.commandType.toLowerCase().includes(topic)).map((entry) => ({ canonicalName: entry.canonicalName, commandType: entry.commandType, capabilityState: entry.capabilityState, effectClass: entry.effectClass, aliases: [...(entry.aliasesByProfile[SAFE_PYMOL_COMPAT_PROFILE] ?? [])] })));
    });
    this.register("setting.set", ({ command }) => {
      const name = String(command.normalizedArgs.name ?? "");
      const scope = String(command.normalizedArgs.scope ?? "session") as Parameters<SettingStore["set"]>[2];
      const targetId = typeof command.normalizedArgs.targetId === "string" ? command.normalizedArgs.targetId : undefined;
      const result = this.settings.set(name, (command.normalizedArgs.value ?? null) as Parameters<SettingStore["set"]>[1], scope, targetId);
      return result.value ? json(result.value) : json({ diagnostic: result.diagnostic ?? { code: "INVALID_SETTING", message: "Setting was rejected." } });
    });
    this.register("setting.get", ({ command }) => {
      const result = this.settings.getResult(String(command.normalizedArgs.name ?? ""), String(command.normalizedArgs.scope ?? "session") as Parameters<SettingStore["getResult"]>[1], typeof command.normalizedArgs.targetId === "string" ? command.normalizedArgs.targetId : undefined);
      return json(result.value ?? { diagnostic: result.diagnostic ?? { code: "INVALID_SETTING", message: "Setting was not found." } });
    });
    this.register("setting.unset", ({ command }) => json(this.settings.unset(String(command.normalizedArgs.name ?? ""), String(command.normalizedArgs.scope ?? "session") as Parameters<SettingStore["unset"]>[1], typeof command.normalizedArgs.targetId === "string" ? command.normalizedArgs.targetId : undefined)));
    this.register("registry.unimplemented", () => json({ accepted: false, capability: "COMING_SOON" }));
  }

  register(handlerKey: string, handler: CommandHandler): void { this.handlers.set(handlerKey, handler); }
  getJob(jobId: string): CommandJob | undefined { return this.jobs.get(jobId); }
  listJobs(): readonly CommandJob[] { return [...this.jobs.values()]; }

  private resolveCanonical(command: CanonicalCommand) {
    const byPublicName = command.origin.resolvedPublicName ? resolveCommand(command.origin.resolvedPublicName) : null;
    if (byPublicName && "spec" in byPublicName) return byPublicName;
    return COMMAND_SPECS.find((spec) => spec.commandType === command.commandType) ? { spec: COMMAND_SPECS.find((spec) => spec.commandType === command.commandType)!, resolvedName: command.origin.resolvedPublicName ?? command.commandType } : { error: "UNKNOWN_COMMAND" as const, candidates: [] as readonly string[] };
  }

  private makeRecord(command: CanonicalCommand, executionId: string, status: ActionRecord["status"], diagnostics: readonly CommandDiagnostic[], startedAt?: string, completedAt?: string): ActionRecord {
    return { schemaVersion: 1, actionRecordId: `action:${executionId.slice(5)}`, commandId: command.commandId, executionId, rawIntentRef: command.origin.sourceTextRef ?? `intent:${command.origin.sourceHash}`, sourceHash: command.origin.sourceHash, canonicalCommand: { ...command, origin: { ...command.origin, ...(command.origin.sourceText ? { sourceText: redactSource(command.origin.sourceText) } : {}) } }, registryVersion: COMMAND_REGISTRY_VERSION, compatibilityProfile: command.origin.profile, policyVersion: "r10-safe-policy.v1", inputRef: `input:${command.origin.sourceHash}`, status, submittedAt: command.submittedAt, ...(startedAt ? { startedAt } : {}), ...(completedAt ? { completedAt } : {}), ...(command.parentCommandId ? { parentCommandId: command.parentCommandId } : {}), correlationId: command.correlationId, ...(command.idempotencyKey ? { idempotencyKey: command.idempotencyKey } : {}), diagnostics, redactedSecrets: command.origin.sourceText && redactSource(command.origin.sourceText) !== command.origin.sourceText ? ["sourceText"] : [] };
  }

  private currentRevisions(): Readonly<Record<string, string | number>> | undefined {
    return typeof this.revisions === "function" ? this.revisions() : this.revisions;
  }

  private preconditionDiagnostics(command: CanonicalCommand): readonly CommandDiagnostic[] {
    if (!command.expectedRevisions || Object.keys(command.expectedRevisions).length === 0) return [];
    const current = this.currentRevisions();
    if (!current) return [commandDiagnostic("PRECONDITION_FAILED", "Expected revisions were supplied but no revision provider is configured.")];
    const diagnostics: CommandDiagnostic[] = [];
    for (const [key, expected] of Object.entries(command.expectedRevisions)) {
      if (!(key in current)) diagnostics.push(commandDiagnostic("PRECONDITION_FAILED", `Revision ${key} is not available in the current command context.`));
      else if (current[key] !== expected) diagnostics.push(commandDiagnostic("REVISION_CONFLICT", `Revision ${key} changed from ${String(expected)} to ${String(current[key])}.`, true));
    }
    return diagnostics;
  }

  private canonicalDiagnostics(command: CanonicalCommand): readonly CommandDiagnostic[] {
    const resolution = this.resolveCanonical(command);
    if (!("spec" in resolution)) return [commandDiagnostic("UNKNOWN_COMMAND", "Canonical command is not present in the active registry.")];
    if (command.commandVersion !== resolution.spec.registryVersion) return [commandDiagnostic("UNSUPPORTED_COMMAND_SEMANTICS", `Command registry version ${command.commandVersion} is not active; expected ${resolution.spec.registryVersion}.`)];
    if (command.commandType !== resolution.spec.commandType) return [commandDiagnostic("UNSUPPORTED_COMMAND_SEMANTICS", `Command type ${command.commandType} does not match ${resolution.spec.canonicalName}.`)];
    return [];
  }

  private securityDiagnostics(command: CanonicalCommand): readonly CommandDiagnostic[] {
    const resolution = this.resolveCanonical(command);
    if (!("spec" in resolution)) return [commandDiagnostic("UNKNOWN_COMMAND", "Canonical command is not present in the active registry.")];
    const spec = resolution.spec;
    if (spec.safetyClass === "UNSAFE_REJECTED") return [commandDiagnostic("UNSAFE_COMMAND_REJECTED", "The command is outside the SAFE_PYMOL_COMPAT execution boundary.")];
    if (spec.capabilityState === "UNAVAILABLE" || spec.capabilityState === "COMING_SOON") return [commandDiagnostic("UNSUPPORTED_CAPABILITY", `${spec.canonicalName} is ${spec.capabilityState} in the current capability profile.`)];
    if (spec.capabilityState !== "SUPPORTED" && spec.capabilityState !== "SUPPORTED_WITH_LIMITATIONS" && spec.capabilityState !== "EXPERIMENTAL") return [commandDiagnostic("UNSUPPORTED_COMMAND_SEMANTICS", `No executable semantics are admitted for ${spec.canonicalName}.`)];
    const path = command.normalizedArgs.path;
    if (typeof path === "string" && (/^[a-zA-Z]:[\\/]/.test(path) || path.includes("..") || path.includes("\\") || path.startsWith("/"))) return [commandDiagnostic("EXTERNAL_IO_REJECTED", "External IO accepts logical artifact names only; arbitrary server paths are rejected.")];
    return [];
  }

  private run(command: CanonicalCommand): CommandResult {
    const executionId = executionIdFor(command);
    const startedAt = now();
    const security = [...this.canonicalDiagnostics(command), ...this.preconditionDiagnostics(command), ...this.securityDiagnostics(command)];
    if (security.length) {
      const record = this.makeRecord(command, executionId, "FAILED", security, startedAt, now());
      this.history.put(record);
      return { commandId: command.commandId, executionId, status: "FAILED", diagnostics: security, warnings: [], actionRecordId: record.actionRecordId, provenanceRef: record.actionRecordId };
    }
    const resolution = this.resolveCanonical(command);
    if (!("spec" in resolution)) {
      const diagnostics = [commandDiagnostic("UNKNOWN_COMMAND", "Canonical command could not be resolved.")];
      const record = this.makeRecord(command, executionId, "FAILED", diagnostics, startedAt, now());
      this.history.put(record);
      return { commandId: command.commandId, executionId, status: "FAILED", diagnostics, warnings: [], actionRecordId: record.actionRecordId, provenanceRef: record.actionRecordId };
    }
    const handler = this.handlers.get(resolution.spec.handlerKey) ?? (() => json({ accepted: true, delegatedHandler: resolution.spec.handlerKey, commandType: resolution.spec.commandType, normalizedArgs: command.normalizedArgs }));
    try {
      const payload = json(handler({ settings: this.settings, command, dispatcher: this }));
      const diagnostics: readonly CommandDiagnostic[] = [];
      const record = this.makeRecord(command, executionId, "SUCCEEDED", diagnostics, startedAt, now());
      this.history.put(record);
      return { commandId: command.commandId, executionId, status: "SUCCEEDED", payload, diagnostics, warnings: [], actionRecordId: record.actionRecordId, provenanceRef: record.actionRecordId };
    } catch (error) {
      const diagnostics = [commandDiagnostic("EXECUTION_FAILED", error instanceof Error ? error.message : "Command handler failed.")];
      const record = this.makeRecord(command, executionId, "FAILED", diagnostics, startedAt, now());
      try { this.history.put(record); } catch { return { commandId: command.commandId, executionId, status: "FAILED", diagnostics: [...diagnostics, commandDiagnostic("PROVENANCE_COMMIT_FAILED", "The command failed and its provenance could not be committed.")], warnings: [] }; }
      return { commandId: command.commandId, executionId, status: "FAILED", diagnostics, warnings: [], actionRecordId: record.actionRecordId, provenanceRef: record.actionRecordId };
    }
  }

  dispatch(request: DispatchRequest): CommandResult {
    if (request.idempotencyKey) {
      const previous = this.history.byIdempotency(request.idempotencyKey);
      if (previous) return { commandId: previous.commandId, executionId: previous.executionId, status: previous.status === "SUCCEEDED" ? "SUCCEEDED" : previous.status === "CANCELLED" ? "CANCELLED" : "FAILED", diagnostics: previous.diagnostics, warnings: [], actionRecordId: previous.actionRecordId, provenanceRef: previous.actionRecordId };
      const pendingJobId = this.pendingIdempotency.get(request.idempotencyKey);
      if (pendingJobId) {
        const pending = this.jobs.get(pendingJobId);
        if (pending) return { commandId: pending.commandId, executionId: `exec:${pendingJobId.slice(4)}`, status: "SUCCEEDED", diagnostics: [], warnings: [], job: { jobId: pending.jobId, state: pending.state } };
        this.pendingIdempotency.delete(request.idempotencyKey);
      }
    }
    const compiled = request.rawCommand ? compileSafeCommand(request.rawCommand, { surface: request.surface ?? "REST", requestedMode: request.requestedMode, correlationId: request.correlationId, idempotencyKey: request.idempotencyKey, bindings: this.bindings }) : null;
    const command = request.command ?? compiled?.command ?? null;
    if (!command) {
      const diagnostics = compiled?.diagnostics ?? [commandDiagnostic("INVALID_ARGUMENT", "Either rawCommand or command is required.")];
      return { commandId: "uncompiled", executionId: "uncompiled", status: "FAILED", diagnostics, warnings: [] };
    }
    const resolution = this.resolveCanonical(command);
    const asyncMode = "spec" in resolution && (request.requestedMode === "ASYNC" || (request.requestedMode === "AUTO" && resolution.spec.effectClass === "LONG_RUNNING_SCIENTIFIC"));
    if (asyncMode) return this.enqueue(command);
    return this.run(command);
  }

  dispatchBatch(request: BatchDispatchRequest): CommandResult {
    const compiled = compileSafeCommands(request.rawCommand, { surface: request.surface ?? "BATCH", requestedMode: request.requestedMode, correlationId: request.correlationId, idempotencyKey: request.idempotencyKey, bindings: this.bindings });
    if (compiled.diagnostics.length) return { commandId: "uncompiled-batch", executionId: "uncompiled-batch", status: "FAILED", diagnostics: compiled.diagnostics, warnings: [] };
    const results = compiled.commands.map((command) => this.dispatch({ command, surface: request.surface ?? "BATCH", requestedMode: request.requestedMode }));
    const diagnostics = results.flatMap((result) => result.diagnostics);
    return { commandId: `batch:${sha256(request.rawCommand).slice(0, 24)}`, executionId: `batch:${sha256(request.rawCommand).slice(0, 24)}`, status: diagnostics.length ? "FAILED" : "SUCCEEDED", payload: json(results), diagnostics, warnings: [] };
  }

  private enqueue(command: CanonicalCommand): CommandResult {
    const executionId = executionIdFor(command);
    const jobId = `job:${executionId.slice(5)}`;
    const job: CommandJob = { jobId, commandId: command.commandId, state: "QUEUED", createdAt: now(), updatedAt: now() };
    this.jobs.set(jobId, job);
    if (command.idempotencyKey) this.pendingIdempotency.set(command.idempotencyKey, jobId);
    queueMicrotask(() => {
      const current = this.jobs.get(jobId);
      if (!current || current.state === "CANCEL_REQUESTED") { if (current) this.jobs.set(jobId, { ...current, state: "CANCELLED", updatedAt: now() }); return; }
      this.jobs.set(jobId, { ...current, state: "RUNNING", updatedAt: now() });
      const result = this.run(command);
      this.jobs.set(jobId, { ...this.jobs.get(jobId)!, state: result.status === "SUCCEEDED" ? "SUCCEEDED" : result.status === "CANCELLED" ? "CANCELLED" : "FAILED", updatedAt: now(), result });
    });
    return { commandId: command.commandId, executionId, status: "SUCCEEDED", diagnostics: [], warnings: [], job: { jobId, state: "QUEUED" } };
  }

  cancel(jobId: string): CommandJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job || ["SUCCEEDED", "FAILED", "CANCELLED"].includes(job.state)) return job;
    const next = { ...job, state: "CANCEL_REQUESTED" as CommandJobState, cancellationRequestedAt: now(), updatedAt: now() };
    this.jobs.set(jobId, next);
    return next;
  }

  replay(actionRecordId: string): CommandResult {
    const record = this.history.get(actionRecordId);
    if (!record) return { commandId: "unknown", executionId: "unknown", status: "FAILED", diagnostics: [commandDiagnostic("PRECONDITION_FAILED", `Action record ${actionRecordId} was not found.`)], warnings: [] };
    if (record.registryVersion !== COMMAND_REGISTRY_VERSION || record.compatibilityProfile !== SAFE_PYMOL_COMPAT_PROFILE) return { commandId: record.commandId, executionId: `replay:${record.executionId.slice(5)}`, status: "FAILED", diagnostics: [commandDiagnostic("REFERENCE_UNAVAILABLE", `Historical command profile ${record.compatibilityProfile}/${record.registryVersion} is not active; replay requires an explicit historical registry or migration.`)], warnings: [], actionRecordId: record.actionRecordId, provenanceRef: record.actionRecordId };
    const command = { ...record.canonicalCommand, requestedMode: "SYNC" as const, idempotencyKey: undefined, origin: { ...record.canonicalCommand.origin, surface: "REST" as const } };
    return this.run(command);
  }

  registry(): JsonRecord { return commandRegistryAsJson(); }
  inventorySummary(): JsonRecord { return commandInventorySummary(); }
}

const redactSource = (source: string): string => source.replace(/(api[_-]?key|token|secret)\s*=\s*[^\s,;]+/gi, "$1=<redacted>");
