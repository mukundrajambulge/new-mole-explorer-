import { createHash } from "node:crypto";
import type { CommandArgumentSpec, CommandDiagnostic, CommandExecutionMode, CanonicalCommand, CommandSpec, JsonRecord, JsonValue } from "@molecular/contracts";
import { canonicalSemanticHash, COMMAND_SCHEMA_VERSION, SAFE_PYMOL_COMPAT_PROFILE } from "@molecular/contracts";
import { resolveCommand, type CommandResolution } from "./registry.js";

const MAX_COMMAND_LENGTH = 16_384;
const MAX_STATEMENTS = 32;
const MAX_NESTING = 32;
const unsafeHeads = new Set(["python", "exec", "eval", "run", "spawn", "fork", "system", "shell", "powershell", "cmd", "bash", "sh", "javascript", "js", "import"]);

export type CommandSurface = "GUI" | "CONSOLE" | "REST" | "SDK" | "MACRO" | "BATCH";
export type BindingLookup =
  | { id: string; displayName?: string }
  | { status: "NOT_FOUND" | "AMBIGUOUS"; candidates?: readonly string[] };
export type CommandBindingContext = {
  resolveObject?: (reference: string) => BindingLookup;
  resolveSelection?: (query: string) => BindingLookup;
  resolveState?: (objectId: string | undefined, selector: JsonValue) => BindingLookup;
};
export type CompileOptions = { surface?: CommandSurface; profile?: string; requestedMode?: CommandExecutionMode; correlationId?: string; idempotencyKey?: string; target?: CanonicalCommand["target"]; expectedRevisions?: CanonicalCommand["expectedRevisions"]; bindings?: CommandBindingContext };
export type CompileResult = { command: CanonicalCommand | null; diagnostics: readonly CommandDiagnostic[] };

const diagnostic = (code: CommandDiagnostic["code"], message: string, sourceSpan?: { start: number; end: number }, argumentPath?: string, retryable = false): CommandDiagnostic => ({ code, message, ...(sourceSpan ? { sourceSpan } : {}), ...(argumentPath ? { argumentPath } : {}), retryable });

export const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
export const semanticCommandHash = (value: Pick<CanonicalCommand, "commandType" | "commandVersion" | "normalizedArgs" | "boundRefs"> & { policy?: string }): string => canonicalSemanticHash({ commandType: value.commandType, commandVersion: value.commandVersion, normalizedArgs: value.normalizedArgs, boundRefs: value.boundRefs, policy: value.policy ?? SAFE_PYMOL_COMPAT_PROFILE });

type ArgumentPart = { text: string; start: number; end: number };

const splitOutside = (input: string, separator: "," | ";", allowSeparator = true): { parts: ArgumentPart[]; error?: string } => {
  const parts: ArgumentPart[] = [];
  let start = 0;
  let quote = "";
  let escape = false;
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (escape) { escape = false; continue; }
    if (quote) { if (char === "\\") escape = true; else if (char === quote) quote = ""; continue; }
    if (char === "\"" || char === "'") { quote = char; continue; }
    if (char === "(" || char === "[" || char === "{") { depth += 1; if (depth > MAX_NESTING) return { parts, error: "nesting depth exceeded" }; continue; }
    if (char === ")" || char === "]" || char === "}") { depth -= 1; if (depth < 0) return { parts, error: "unbalanced closing delimiter" }; continue; }
    if (allowSeparator && char === separator && depth === 0) { parts.push({ text: input.slice(start, index).trim(), start, end: index }); start = index + 1; }
  }
  if (quote) return { parts, error: "unterminated quote" };
  if (depth !== 0) return { parts, error: "unbalanced delimiter" };
  parts.push({ text: input.slice(start).trim(), start, end: input.length });
  return { parts: parts.filter((part) => part.text.length > 0) };
};

const splitStatements = (input: string): { parts: ArgumentPart[]; error?: string } => splitOutside(input, ";");

const topLevelEquals = (value: string): number => {
  let quote = ""; let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    if (quote) { if (char === "\\") index += 1; else if (char === quote) quote = ""; continue; }
    if (char === "\"" || char === "'") { quote = char; continue; }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    if (char === ")" || char === "]" || char === "}") depth = Math.max(0, depth - 1);
    if (char === "=" && depth === 0) return index;
  }
  return -1;
};

const bindingArgumentTypes = (spec: CommandSpec, normalizedArgs: JsonRecord, bindings: CommandBindingContext): { normalizedArgs: JsonRecord; boundRefs: CanonicalCommand["boundRefs"]; diagnostics: CommandDiagnostic[] } => {
  const nextArgs: JsonRecord = { ...normalizedArgs };
  const diagnostics: CommandDiagnostic[] = [];
  const objectIds: string[] = [];
  const selectionIds: string[] = [];
  const stateIds: string[] = [];
  const objectIdForArgument = new Map<string, string>();
  for (const argument of spec.arguments) {
    const raw = nextArgs[argument.name];
    if (typeof raw !== "string") continue;
    const lookup = argument.type === "object" ? bindings.resolveObject?.(raw) : argument.type === "selection" ? bindings.resolveSelection?.(raw) : undefined;
    if (!lookup) continue;
    if ("status" in lookup) {
      const code = argument.type === "object" ? lookup.status === "AMBIGUOUS" ? "AMBIGUOUS_OBJECT" : "OBJECT_NOT_FOUND" : "SELECTION_BINDING_FAILED";
      diagnostics.push(diagnostic(code, `${argument.name} reference \`${raw}\` could not be bound (${lookup.status.toLowerCase()}).`, undefined, argument.name));
      continue;
    }
    if (argument.type === "object") {
      nextArgs[argument.name] = lookup.id;
      objectIds.push(lookup.id);
      objectIdForArgument.set(argument.name, lookup.id);
    } else {
      selectionIds.push(lookup.id);
    }
  }
  const stateArgument = spec.arguments.find((argument) => argument.type === "state");
  const rawState = stateArgument ? nextArgs[stateArgument.name] : undefined;
  if (stateArgument && rawState !== undefined && bindings.resolveState) {
    const objectArgument = spec.arguments.find((argument) => argument.type === "object");
    const lookup = bindings.resolveState(objectArgument ? objectIdForArgument.get(objectArgument.name) : undefined, rawState);
    if ("status" in lookup) diagnostics.push(diagnostic("STATE_OUT_OF_RANGE", `State selector could not be resolved (${lookup.status.toLowerCase()}).`, undefined, stateArgument.name));
    else { stateIds.push(lookup.id); nextArgs[stateArgument.name] = { kind: "EXPLICIT_STATE_ID", stateId: lookup.id }; }
  }
  const settingScope = typeof nextArgs.scope === "string" ? nextArgs.scope : undefined;
  const targetId = typeof nextArgs.targetId === "string" ? nextArgs.targetId : undefined;
  return { normalizedArgs: nextArgs, boundRefs: { ...(objectIds.length ? { objectIds } : {}), ...(selectionIds.length ? { selectionIds } : {}), ...(stateIds.length ? { stateIds } : {}), ...(settingScope ? { settingScopes: [targetId ? `${settingScope}:${targetId}` : settingScope] } : {}) }, diagnostics };
};

const unquote = (value: string): string => value.length >= 2 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) ? value.slice(1, -1).replace(/\\([\\"'])/g, "$1") : value;

const unsafeDiagnosticFor = (raw: string): CommandDiagnostic | null => {
  if (raw.length > MAX_COMMAND_LENGTH) return diagnostic("RESOURCE_LIMIT_EXCEEDED", `Command exceeds the ${MAX_COMMAND_LENGTH}-character safety limit.`, { start: MAX_COMMAND_LENGTH, end: raw.length });
  if ([...raw].some((char) => [0, 8, 11, 12].includes(char.charCodeAt(0))) || /`|\$\(|\$\{|&&|\|\||>>|<<|\s[<>]\s*(?:[A-Za-z_]|[A-Za-z]:|[\\/])/.test(raw)) return diagnostic("UNSAFE_COMMAND_REJECTED", "Shell/process interpolation or control syntax is not part of SAFE_PYMOL_COMPAT.");
  const head = raw.trim().match(/^([^\s;,()]+)/)?.[1]?.toLowerCase() ?? "";
  if (unsafeHeads.has(head) || /^python(?:\.|\s|$)/i.test(head)) return diagnostic("UNSAFE_COMMAND_REJECTED", `Command \`${head}\` is rejected by the scientific command safety boundary.`, { start: 0, end: head.length });
  if (/(^|[\s;])(python|javascript|js|import|exec|eval|spawn|fork|system|powershell|cmd\.exe|bash|sh)(?:\s|\(|:|$)/i.test(raw) || /(?:javascript|data):/i.test(raw)) return diagnostic("UNSAFE_COMMAND_REJECTED", "General code or host-process execution is rejected before parsing.");
  return null;
};

const asJson = (value: unknown): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(asJson);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, asJson(child)]));
  return String(value);
};

const coerce = (spec: CommandArgumentSpec, rawValue: string, span: { start: number; end: number }): { value?: JsonValue; diagnostic?: CommandDiagnostic } => {
  const value = unquote(rawValue.trim());
  if (spec.type === "string" || spec.type === "selection" || spec.type === "object") return { value };
  if (spec.type === "color") {
    if (/^#[0-9a-f]{6}$/i.test(value) || /^[a-z][a-z0-9-]*$/i.test(value)) return { value };
    return { diagnostic: diagnostic("INVALID_ARGUMENT", `${spec.name} must be a named color or #RRGGBB.`, span, spec.name) };
  }
  if (spec.type === "float3") {
    const components = value.split(/\s+/).map(Number);
    if (components.length !== 3 || components.some((component) => !Number.isFinite(component))) return { diagnostic: diagnostic("INVALID_ARGUMENT", `${spec.name} must contain exactly three finite numbers.`, span, spec.name) };
    return { value: components };
  }
  if (spec.type === "state") {
    const lowered = value.toLowerCase();
    if (lowered === "current" || lowered === "current_resolved") return { value: { kind: "CURRENT_RESOLVED" } };
    if (lowered === "all" || lowered === "all_states") return { value: { kind: "ALL_STATES" } };
    if (lowered === "append" || lowered === "append_state") return { value: { kind: "APPEND_STATE" } };
    if (lowered === "default" || lowered === "object_default") return { value: { kind: "OBJECT_DEFAULT" } };
    const ordinal = Number(value);
    if (Number.isInteger(ordinal) && ordinal > 0) return { value: { kind: "EXPLICIT_STATE", ordinal } };
    if (value) return { value: { kind: "EXPLICIT_STATE_ID", stateId: value } };
    return { diagnostic: diagnostic("STATE_OUT_OF_RANGE", "A state selector is required.", span, spec.name) };
  }
  if (spec.type === "number" || spec.type === "float" || spec.type === "integer") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || (spec.type === "integer" && !Number.isInteger(parsed))) return { diagnostic: diagnostic("INVALID_ARGUMENT", `${spec.name} must be a ${spec.type}.`, span, spec.name) };
    return { value: parsed };
  }
  if (spec.type === "boolean") {
    if (value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "on") return { value: true };
    if (value.toLowerCase() === "false" || value === "0" || value.toLowerCase() === "off") return { value: false };
    return { diagnostic: diagnostic("INVALID_ARGUMENT", `${spec.name} must be boolean.`, span, spec.name) };
  }
  if (spec.type === "enum") {
    const normalized = value.toUpperCase();
    const allowed = spec.enumValues ?? [];
    const match = allowed.find((option) => option.toUpperCase() === normalized);
    if (!match) return { diagnostic: diagnostic("INVALID_ARGUMENT", `${spec.name} must be one of ${allowed.join(", ")}.`, span, spec.name) };
    return { value: match };
  }
  return { value: asJson(value) };
};

const bindArguments = (spec: CommandSpec, rawArgs: string, baseOffset: number): { args?: JsonRecord; diagnostics: CommandDiagnostic[] } => {
  const diagnostics: CommandDiagnostic[] = [];
  const split = splitOutside(rawArgs, ",");
  if (split.error) return { diagnostics: [diagnostic("INVALID_ARGUMENT", split.error)] };
  const parts = split.parts;
  const args: JsonRecord = {};
  const assigned = new Set<string>();
  const assign = (argument: CommandArgumentSpec, rawValue: string, part: ArgumentPart) => {
    if (assigned.has(argument.name)) { diagnostics.push(diagnostic("DUPLICATE_ARGUMENT", `Argument \`${argument.name}\` was supplied more than once.`, { start: baseOffset + part.start, end: baseOffset + part.end }, argument.name)); return; }
    const coerced = coerce(argument, rawValue, { start: baseOffset + part.start, end: baseOffset + part.end });
    if (coerced.diagnostic) diagnostics.push(coerced.diagnostic); else { args[argument.name] = coerced.value ?? null; assigned.add(argument.name); }
  };
  const positional: ArgumentPart[] = [];
  for (const part of parts) {
    const equals = topLevelEquals(part.text);
    if (equals > 0) {
      const name = part.text.slice(0, equals).trim().toLowerCase();
      const argument = spec.arguments.find((item) => item.name.toLowerCase() === name);
      if (!argument) diagnostics.push(diagnostic("UNKNOWN_ARGUMENT", `Unknown argument \`${name}\` for \`${spec.canonicalName}\`.`, { start: baseOffset + part.start, end: baseOffset + part.end }, name));
      else assign(argument, part.text.slice(equals + 1), part);
    } else positional.push(part);
  }
  if (spec.canonicalName === "select" && positional.length > 0) {
    const operation = positional[0]!.text.toLowerCase();
    if (["replace", "add", "subtract", "intersect"].includes(operation) && positional.length > 1) {
      assign(spec.arguments.find((item) => item.name === "operation")!, positional[0]!.text, positional[0]!);
      assign(spec.arguments.find((item) => item.name === "query")!, positional.slice(1).map((part) => part.text).join(", "), { ...positional[0]!, end: positional[positional.length - 1]!.end });
    } else {
      assign(spec.arguments.find((item) => item.name === "query")!, positional.map((part) => part.text).join(", "), { ...positional[0]!, end: positional[positional.length - 1]!.end });
    }
  } else {
    const candidates = spec.arguments.filter((item) => item.positional && !assigned.has(item.name));
    positional.forEach((part, index) => {
      const candidate = candidates[index];
      if (!candidate) diagnostics.push(diagnostic("INVALID_ARGUMENT", `Too many positional arguments for \`${spec.canonicalName}\`.`, { start: baseOffset + part.start, end: baseOffset + part.end }));
      else assign(candidate, part.text, part);
    });
  }
  for (const argument of spec.arguments) {
    if (!assigned.has(argument.name) && argument.defaultValue !== undefined) args[argument.name] = argument.defaultValue;
    if (!assigned.has(argument.name) && argument.required) diagnostics.push(diagnostic("MISSING_REQUIRED_ARGUMENT", `Argument \`${argument.name}\` is required for \`${spec.canonicalName}\`.`, undefined, argument.name));
  }
  return { args: diagnostics.some((item) => item.code === "INVALID_ARGUMENT" || item.code === "UNKNOWN_ARGUMENT" || item.code === "DUPLICATE_ARGUMENT" || item.code === "MISSING_REQUIRED_ARGUMENT") ? undefined : args, diagnostics };
};

const sourceTextAndHead = (raw: string): { head: string; rest: string; headEnd: number } => {
  const match = raw.match(/^(\s*)([^\s;,()]+)([\s\S]*)$/);
  if (!match) return { head: "", rest: "", headEnd: raw.length };
  return { head: match[2]!.toLowerCase(), rest: match[3]!.trim(), headEnd: (match[1]?.length ?? 0) + match[2]!.length };
};

export const compileSafeCommand = (source: string, options: CompileOptions = {}): CompileResult => {
  const raw = source.trim();
  if (!raw) return { command: null, diagnostics: [diagnostic("INVALID_ARGUMENT", "A command is required.")] };
  const unsafe = unsafeDiagnosticFor(raw);
  if (unsafe) return { command: null, diagnostics: [unsafe] };
  const statementCheck = splitStatements(raw);
  if (statementCheck.error) return { command: null, diagnostics: [diagnostic("INVALID_ARGUMENT", statementCheck.error)] };
  if (statementCheck.parts.length > 1) return { command: null, diagnostics: [diagnostic("INVALID_ARGUMENT", "Multiple statements require the bounded batch compiler.")] };
  const { head, rest, headEnd } = sourceTextAndHead(raw);
  const resolution: CommandResolution = resolveCommand(head, options.profile ?? SAFE_PYMOL_COMPAT_PROFILE);
  if ("error" in resolution) {
    const code = resolution.error;
    return { command: null, diagnostics: [diagnostic(code, code === "AMBIGUOUS_COMMAND" ? `Command prefix \`${head}\` is ambiguous: ${resolution.candidates.join(", ")}.` : `Unknown command \`${head}\`.`, { start: 0, end: head.length })] };
  }
  const bound = bindArguments(resolution.spec, rest, headEnd + 1);
  if (!bound.args) return { command: null, diagnostics: bound.diagnostics };
  const sourceHash = sha256(raw);
  const surface = options.surface ?? "CONSOLE";
  const profile = options.profile ?? SAFE_PYMOL_COMPAT_PROFILE;
  const bindings = options.bindings ? bindingArgumentTypes(resolution.spec, bound.args, options.bindings) : { normalizedArgs: bound.args, boundRefs: {}, diagnostics: [] as CommandDiagnostic[] };
  if (bindings.diagnostics.length) return { command: null, diagnostics: [...bound.diagnostics, ...bindings.diagnostics] };
  const normalizedArgs = bindings.normalizedArgs;
  const boundRefs = bindings.boundRefs;
  const requestedMode = options.requestedMode ?? resolution.spec.synchronization;
  const semanticHash = semanticCommandHash({ commandType: resolution.spec.commandType, commandVersion: resolution.spec.registryVersion, normalizedArgs, boundRefs, policy: profile });
  const correlationId = options.correlationId ?? `corr:${semanticHash.slice(0, 24)}`;
  const command: CanonicalCommand = {
    commandId: `cmd:${sourceHash.slice(0, 24)}`,
    commandType: resolution.spec.commandType,
    commandVersion: resolution.spec.registryVersion,
    schemaVersion: COMMAND_SCHEMA_VERSION,
    normalizedArgs,
    boundRefs,
    ...(options.target ? { target: options.target } : {}),
    ...(options.expectedRevisions ? { expectedRevisions: options.expectedRevisions } : {}),
    origin: { surface, profile, profileVersion: profile === SAFE_PYMOL_COMPAT_PROFILE ? "safe-pymol-compat.v1" : profile, syntaxVersion: "r10-safe-grammar.v1", sourceHash, sourceText: raw, resolvedPublicName: resolution.resolvedName, sourceMap: { start: 0, end: raw.length } },
    requestedMode,
    ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    correlationId,
    submittedAt: new Date().toISOString(),
    semanticHash,
  };
  return { command, diagnostics: bound.diagnostics };
};

export const compileSafeCommands = (source: string, options: CompileOptions = {}): { commands: readonly CanonicalCommand[]; diagnostics: readonly CommandDiagnostic[] } => {
  const unsafe = unsafeDiagnosticFor(source);
  if (unsafe) return { commands: [], diagnostics: [unsafe] };
  const statements = splitStatements(source);
  if (statements.error) return { commands: [], diagnostics: [diagnostic("INVALID_ARGUMENT", statements.error)] };
  if (statements.parts.length > MAX_STATEMENTS) return { commands: [], diagnostics: [diagnostic("RESOURCE_LIMIT_EXCEEDED", `A batch is limited to ${MAX_STATEMENTS} statements.`)] };
  const commands: CanonicalCommand[] = [];
  const diagnostics: CommandDiagnostic[] = [];
  statements.parts.forEach((part, index) => {
    const partUnsafe = unsafeDiagnosticFor(part.text);
    if (partUnsafe) { diagnostics.push(partUnsafe); return; }
    const result = compileSafeCommand(part.text, { ...options, correlationId: options.correlationId ? `${options.correlationId}:${index + 1}` : undefined });
    commands.push(...(result.command ? [result.command] : []));
    diagnostics.push(...result.diagnostics);
  });
  if (diagnostics.length && commands.length) diagnostics.push(diagnostic("PARTIAL_BATCH", "One or more bounded batch statements were rejected; accepted statements were not dispatched.", undefined, undefined, false));
  return { commands, diagnostics };
};

export const isSafeCommandText = (source: string): boolean => unsafeDiagnosticFor(source) === null;
