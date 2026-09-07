import type { CapabilityState, CommandArgumentSpec, CommandSpec, JsonRecord, JsonValue } from "@molecular/contracts";
import { COMMAND_REGISTRY_VERSION, SAFE_PYMOL_COMPAT_PROFILE } from "@molecular/contracts";
import { PYMOL_INVENTORY, PYMOL_SOURCE_COMMIT } from "./pymolInventory.js";

const argument = (name: string, type: CommandArgumentSpec["type"], description: string, options: Partial<CommandArgumentSpec> = {}): CommandArgumentSpec => ({ name, type, description, ...options });
const schema = (spec: Omit<CommandSpec, "registryVersion" | "aliasesByProfile"> & { aliases?: readonly string[] }): CommandSpec => ({
  ...spec,
  aliasesByProfile: { [SAFE_PYMOL_COMPAT_PROFILE]: spec.aliases ?? [] },
  registryVersion: COMMAND_REGISTRY_VERSION,
});

const safeCommand = (name: string, type: string, args: readonly CommandArgumentSpec[], effectClass: CommandSpec["effectClass"], capabilityKey: string, handlerKey: string, aliases: readonly string[] = [], capabilityState: CapabilityState = "SUPPORTED_WITH_LIMITATIONS"): CommandSpec => schema({
  commandType: type, canonicalName: name, arguments: args, outputSchema: {}, effectClass, capabilityKey, capabilityState, safetyClass: "SAFE_TRANSLATABLE", deterministic: true, synchronization: effectClass === "LONG_RUNNING_SCIENTIFIC" ? "AUTO" : "SYNC", resourceClass: effectClass === "LONG_RUNNING_SCIENTIFIC" ? "LONG_RUNNING" : "BOUNDED", handlerKey, provenanceVersion: "r10-provenance.v1", replayVersion: "r10-replay.v1", aliases, pymolReference: { sourceCommit: PYMOL_SOURCE_COMMIT, publicNames: [name], oracleStatus: "ORACLE_PENDING" },
});

const builtinSpecs: readonly CommandSpec[] = [
  safeCommand("select", "SELECTION.EVALUATE", [argument("query", "selection", "Canonical selection expression.", { required: true, positional: true }), argument("operation", "enum", "Selection operation.", { enumValues: ["replace", "add", "subtract", "intersect"], positional: true, defaultValue: "replace" })], "VISUAL_MUTATION", "SELECTION.EVALUATE", "selection.evaluate", ["sel"]),
  safeCommand("show", "REPRESENTATION.SHOW", [argument("representation", "string", "Representation profile.", { required: true, positional: true }), argument("query", "selection", "Target selection.", { positional: true, defaultValue: "all" })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "presentation.show"),
  safeCommand("show_as", "REPRESENTATION.SHOW_AS", [argument("representation", "string", "Representation profile.", { required: true, positional: true }), argument("query", "selection", "Target selection.", { positional: true, defaultValue: "all" })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "presentation.showAs", ["as"]),
  safeCommand("hide", "REPRESENTATION.HIDE", [argument("representation", "string", "Representation profile.", { required: true, positional: true }), argument("query", "selection", "Target selection.", { positional: true, defaultValue: "all" })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "presentation.hide"),
  safeCommand("color", "COLOR.APPLY", [argument("color", "string", "Named, canonical or custom color.", { required: true, positional: true }), argument("query", "selection", "Target selection.", { positional: true, defaultValue: "all" })], "VISUAL_MUTATION", "COLOR.APPLY", "presentation.color", ["colour", "recolor"]),
  safeCommand("set", "SETTING.SET", [argument("name", "string", "Setting or representation setting name.", { required: true, positional: true }), argument("value", "string", "Typed setting value.", { required: true, positional: true }), argument("query", "selection", "Optional presentation scope.", { positional: true }), argument("scope", "enum", "Durable setting scope.", { enumValues: ["global", "session", "object", "selection", "representation", "scene"] }), argument("targetId", "string", "Stable scope target ID.")], "VISUAL_MUTATION", "SETTING.SET", "setting.set", ["set_colour"]),
  safeCommand("get", "SETTING.GET", [argument("name", "string", "Setting name.", { required: true, positional: true }), argument("scope", "enum", "Durable setting scope.", { enumValues: ["global", "session", "object", "selection", "representation", "scene"] }), argument("targetId", "string", "Stable scope target ID.")], "READ_ONLY_QUERY", "SETTING.GET", "setting.get"),
  safeCommand("unset", "SETTING.UNSET", [argument("name", "string", "Setting name.", { required: true, positional: true }), argument("scope", "enum", "Durable setting scope.", { enumValues: ["global", "session", "object", "selection", "representation", "scene"] }), argument("targetId", "string", "Stable scope target ID.")], "VISUAL_MUTATION", "SETTING.UNSET", "setting.unset"),
  safeCommand("label", "LABEL.SET", [argument("query", "selection", "Target selection.", { required: true, positional: true }), argument("expression", "string", "Safe field-template expression.", { required: true, positional: true })], "VISUAL_MUTATION", "LABELS.SET", "presentation.label"),
  safeCommand("center", "VIEW.CENTER", [argument("query", "selection", "Target selection.", { required: true, positional: true })], "VISUAL_MUTATION", "VIEW.CENTER", "view.center"),
  safeCommand("zoom", "VIEW.ZOOM", [argument("query", "selection", "Target selection.", { required: true, positional: true })], "VISUAL_MUTATION", "VIEW.FIT", "view.zoom"),
  safeCommand("get_view", "VIEW.GET", [], "READ_ONLY_QUERY", "VIEW.CAMERA", "view.get", ["view"]),
  safeCommand("unpick", "SELECTION.CLEAR", [], "VISUAL_MUTATION", "SELECTION.EVALUATE", "selection.clear"),
  safeCommand("help", "SYSTEM.HELP", [argument("topic", "string", "Command, capability or setting topic.", { positional: true })], "READ_ONLY_QUERY", "HELP.OPEN", "system.help"),
  safeCommand("history", "HISTORY.LIST", [], "READ_ONLY_QUERY", "PROJECT.OPEN", "history.list"),
  safeCommand("undo", "HISTORY.UNDO", [], "SCIENTIFIC_MUTATION", "HISTORY.UNDO", "history.undo"),
  safeCommand("redo", "HISTORY.REDO", [], "SCIENTIFIC_MUTATION", "HISTORY.REDO", "history.redo"),
  safeCommand("enable", "OBJECT.ENABLE", [argument("object", "object", "Stable object or unambiguous display name.", { required: true, positional: true })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "object.enable"),
  safeCommand("disable", "OBJECT.DISABLE", [argument("object", "object", "Stable object or unambiguous display name.", { required: true, positional: true })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "object.disable"),
  safeCommand("state", "OBJECT.STATE", [argument("object", "object", "Target object.", { required: true, positional: true }), argument("state", "state", "Coordinate state selector.", { required: true, positional: true })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "object.state"),
  safeCommand("frame", "OBJECT.FRAME", [argument("state", "state", "Global one-based frame ordinal.", { required: true, positional: true })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "object.frame"),
  safeCommand("all_states", "OBJECT.ALL_STATES", [argument("object", "object", "Target object.", { required: true, positional: true })], "VISUAL_MUTATION", "REPRESENTATION.SET_STYLE", "object.allStates"),
  safeCommand("count_states", "OBJECT.COUNT_STATES", [argument("object", "object", "Target object.", { required: true, positional: true })], "READ_ONLY_QUERY", "REPRESENTATION.SET_STYLE", "object.countStates"),
  safeCommand("rename", "OBJECT.RENAME", [argument("old", "object", "Existing object or named selection.", { required: true, positional: true }), argument("new", "string", "New display name.", { required: true, positional: true })], "ADMINISTRATIVE", "PROJECT.SAVE", "object.rename"),
  safeCommand("copy", "OBJECT.COPY", [argument("target", "string", "New object name.", { required: true, positional: true }), argument("source", "object", "Source object.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "PROJECT.SAVE", "object.copy"),
  safeCommand("create", "OBJECT.CREATE", [argument("target", "string", "New object name.", { required: true, positional: true }), argument("query", "selection", "Source selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "PROJECT.SAVE", "object.create"),
  safeCommand("group", "OBJECT.GROUP", [argument("operation", "string", "Bounded group operation.", { required: true, positional: true }), argument("name", "string", "Group name.", { positional: true })], "ADMINISTRATIVE", "PROJECT.SAVE", "object.group"),
  safeCommand("remove", "EDIT.ATOM_DELETE", [argument("query", "selection", "Exact atom selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "EDIT.ATOM_DELETE", "edit.remove"),
  safeCommand("bond", "EDIT.BOND_CREATE", [argument("selection1", "selection", "First singleton selection.", { required: true, positional: true }), argument("selection2", "selection", "Second singleton selection.", { required: true, positional: true }), argument("order", "enum", "Bond order.", { enumValues: ["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"], positional: true, defaultValue: "SINGLE" })], "SCIENTIFIC_MUTATION", "EDIT.BOND_CREATE", "edit.bond"),
  safeCommand("unbond", "EDIT.BOND_DELETE", [argument("selection1", "selection", "First singleton selection.", { required: true, positional: true }), argument("selection2", "selection", "Second singleton selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "EDIT.BOND_DELETE", "edit.unbond"),
  safeCommand("set_bond", "EDIT.BOND_ORDER_SET", [argument("order", "enum", "Bond order.", { required: true, positional: true, enumValues: ["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"] }), argument("selection1", "selection", "First singleton selection.", { required: true, positional: true }), argument("selection2", "selection", "Second singleton selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "EDIT.BOND_ORDER_SET", "edit.setBond"),
  safeCommand("h_add", "EDIT.HYDROGEN_ADD", [argument("query", "selection", "Exact chemistry target.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "EDIT.HYDROGEN_ADD", "edit.hAdd"),
  safeCommand("h_fill", "EDIT.HYDROGEN_REFILL", [argument("query", "selection", "Exact chemistry target.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "EDIT.HYDROGEN_REFILL", "edit.hFill"),
  safeCommand("h_remove", "EDIT.HYDROGEN_REMOVE", [argument("query", "selection", "Exact chemistry target.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "EDIT.HYDROGEN_REMOVE", "edit.hRemove"),
  safeCommand("rms_cur", "ANALYSIS.RMS_CUR", [argument("mobile", "selection", "Mobile selection.", { required: true, positional: true }), argument("target", "selection", "Target selection.", { required: true, positional: true })], "READ_ONLY_QUERY", "ANALYSIS.RMS_CUR", "analysis.rmsCur"),
  safeCommand("rms", "ANALYSIS.RMS", [argument("mobile", "selection", "Mobile selection.", { required: true, positional: true }), argument("target", "selection", "Target selection.", { required: true, positional: true })], "READ_ONLY_QUERY", "ANALYSIS.RMS", "analysis.rms"),
  safeCommand("fit", "ANALYSIS.FIT", [argument("mobile", "selection", "Mobile selection.", { required: true, positional: true }), argument("target", "selection", "Target selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "ANALYSIS.FIT", "analysis.fit"),
  safeCommand("pair_fit", "ANALYSIS.PAIR_FIT", [argument("mobile", "selection", "Mobile selection.", { required: true, positional: true }), argument("target", "selection", "Target selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "ANALYSIS.PAIR_FIT", "analysis.pairFit"),
  safeCommand("align", "ANALYSIS.ALIGN", [argument("mobile", "selection", "Mobile selection.", { required: true, positional: true }), argument("target", "selection", "Target selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "ANALYSIS.ALIGN", "analysis.align"),
  safeCommand("super", "ANALYSIS.SUPER", [argument("mobile", "selection", "Mobile selection.", { required: true, positional: true }), argument("target", "selection", "Target selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "ANALYSIS.SUPER", "analysis.super"),
  safeCommand("cealign", "ANALYSIS.CEALIGN", [argument("mobile", "selection", "Mobile selection.", { required: true, positional: true }), argument("target", "selection", "Target selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "ANALYSIS.CEALIGN", "analysis.cealign", [], "UNAVAILABLE"),
  safeCommand("intra_rms_cur", "ANALYSIS.INTRA_RMS_CUR", [argument("query", "selection", "State comparison selection.", { required: true, positional: true })], "READ_ONLY_QUERY", "ANALYSIS.INTRA_RMS_CUR", "analysis.intraRmsCur"),
  safeCommand("intra_rms", "ANALYSIS.INTRA_RMS", [argument("query", "selection", "State comparison selection.", { required: true, positional: true })], "READ_ONLY_QUERY", "ANALYSIS.INTRA_RMS", "analysis.intraRms"),
  safeCommand("intra_fit", "ANALYSIS.INTRA_FIT", [argument("query", "selection", "State comparison selection.", { required: true, positional: true })], "SCIENTIFIC_MUTATION", "ANALYSIS.INTRA_FIT", "analysis.intraFit"),
  safeCommand("save", "PROJECT.SAVE", [argument("path", "string", "Logical project artifact name; server paths are never accepted.", { required: true, positional: true })], "EXTERNAL_IO", "PROJECT.SAVE", "project.save", [], "SUPPORTED_WITH_LIMITATIONS"),
  safeCommand("load", "PROJECT.OPEN", [argument("path", "string", "Logical project artifact name; server paths are never accepted.", { required: true, positional: true })], "EXTERNAL_IO", "PROJECT.OPEN", "project.open", [], "SUPPORTED_WITH_LIMITATIONS"),
];

const builtInByName = new Map(builtinSpecs.map((spec) => [spec.canonicalName, spec]));
const builtInNames = new Set(builtinSpecs.flatMap((spec) => [spec.canonicalName, ...Object.values(spec.aliasesByProfile).flat()]));
const builtInTypes = new Set(builtinSpecs.map((spec) => spec.commandType));
const inventorySpecs = PYMOL_INVENTORY.filter((entry) => !builtInByName.has(entry.publicName) && !builtInNames.has(entry.publicName) && !builtInTypes.has(entry.canonicalCommandType ?? "")).map((entry): CommandSpec => ({
  commandType: entry.canonicalCommandType ?? `PYMOL.${entry.publicName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
  canonicalName: entry.publicName,
  registryVersion: COMMAND_REGISTRY_VERSION,
  aliasesByProfile: { [SAFE_PYMOL_COMPAT_PROFILE]: entry.aliases },
  arguments: [argument("raw", "string", "Source-pinned command arguments.", { positional: true })],
  outputSchema: {},
  effectClass: entry.effectClass,
  capabilityKey: entry.canonicalCommandType ?? entry.publicName,
  capabilityState: entry.capabilityState,
  safetyClass: entry.disposition === "UNSAFE_REJECTED" ? "UNSAFE_REJECTED" : entry.disposition === "ORACLE_PENDING" ? "SAFE_BUT_NOT_IMPLEMENTED" : entry.disposition,
  deterministic: entry.effectClass !== "EXTERNAL_IO",
  synchronization: entry.effectClass === "LONG_RUNNING_SCIENTIFIC" ? "AUTO" : "SYNC",
  resourceClass: entry.effectClass === "EXTERNAL_IO" ? "EXTERNAL" : "BOUNDED",
  handlerKey: "registry.unimplemented",
  provenanceVersion: "r10-provenance.v1",
  replayVersion: "r10-replay.v1",
  pymolReference: { sourceCommit: entry.sourceCommit, publicNames: [entry.publicName], parserMode: entry.parserMode, oracleStatus: entry.oracleStatus },
  knownDivergences: entry.notes,
}));

export const COMMAND_SPECS: readonly CommandSpec[] = Object.freeze([...builtinSpecs, ...inventorySpecs]);

export type CommandResolution = { spec: CommandSpec; resolvedName: string; matchedAlias?: string } | { error: "UNKNOWN_COMMAND" | "AMBIGUOUS_COMMAND"; candidates: readonly string[] };

const aliasesFor = (spec: CommandSpec): readonly string[] => spec.aliasesByProfile[SAFE_PYMOL_COMPAT_PROFILE] ?? [];

export const resolveCommand = (input: string, profile: string = SAFE_PYMOL_COMPAT_PROFILE): CommandResolution => {
  const normalized = input.trim().toLowerCase();
  const candidates = COMMAND_SPECS.flatMap((spec) => {
    const names = [spec.canonicalName, ...(spec.aliasesByProfile[profile] ?? [])];
    return names.some((name) => name.toLowerCase() === normalized || name.toLowerCase().startsWith(normalized)) ? [{ spec, name: spec.canonicalName, alias: names.find((name) => name.toLowerCase() === normalized && name !== spec.canonicalName) }] : [];
  });
  const unique = [...new Map(candidates.map((candidate) => [candidate.spec.canonicalName, candidate])).values()];
  if (unique.length === 0) return { error: "UNKNOWN_COMMAND", candidates: [] };
  const exact = candidates.find((candidate) => candidate.spec.canonicalName.toLowerCase() === normalized || candidate.alias?.toLowerCase() === normalized);
  if (exact) return { spec: exact.spec, resolvedName: exact.name, ...(exact.alias ? { matchedAlias: exact.alias } : {}) };
  if (unique.length > 1) return { error: "AMBIGUOUS_COMMAND", candidates: unique.map((candidate) => candidate.spec.canonicalName).sort() };
  const selected = unique[0]!;
  return { spec: selected.spec, resolvedName: selected.name, ...(selected.alias ? { matchedAlias: selected.alias } : {}) };
};

export const validateCommandRegistry = (specs: readonly CommandSpec[] = COMMAND_SPECS): readonly string[] => {
  const errors: string[] = [];
  const commandTypes = new Set<string>();
  const names = new Map<string, string>();
  for (const spec of specs) {
    if (commandTypes.has(spec.commandType)) errors.push(`duplicate command type ${spec.commandType}`);
    commandTypes.add(spec.commandType);
    if (names.has(spec.canonicalName)) errors.push(`duplicate canonical name ${spec.canonicalName}`);
    names.set(spec.canonicalName, spec.commandType);
    for (const alias of aliasesFor(spec)) {
      const previous = names.get(alias);
      if (previous && previous !== spec.commandType) errors.push(`alias collision ${alias}: ${previous} vs ${spec.commandType}`);
      names.set(alias, spec.commandType);
    }
  }
  return errors;
};

export const commandInventorySummary = () => ({
  registryVersion: COMMAND_REGISTRY_VERSION,
  compatibilityProfile: SAFE_PYMOL_COMPAT_PROFILE,
  sourceCommit: PYMOL_SOURCE_COMMIT,
  count: COMMAND_SPECS.length,
  sourceKeywordCount: PYMOL_INVENTORY.length,
  validationErrors: [...validateCommandRegistry()],
});

export const commandSpecFor = (name: string): CommandSpec | undefined => {
  const resolution = resolveCommand(name);
  return "spec" in resolution ? resolution.spec : undefined;
};

export const jsonValueFrom = (value: unknown): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(jsonValueFrom);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, jsonValueFrom(child)]));
  return String(value);
};

export const commandRegistryAsJson = (): JsonRecord => ({
  summary: commandInventorySummary(),
  commands: COMMAND_SPECS.map((spec) => ({
    canonicalName: spec.canonicalName,
    commandType: spec.commandType,
    effectClass: spec.effectClass,
    capabilityState: spec.capabilityState,
    safetyClass: spec.safetyClass,
    aliases: [...aliasesFor(spec)],
    arguments: spec.arguments.map((item) => ({ name: item.name, type: item.type, ...(item.required !== undefined ? { required: item.required } : {}), ...(item.positional !== undefined ? { positional: item.positional } : {}), ...(item.repeated !== undefined ? { repeated: item.repeated } : {}), ...(item.enumValues ? { enumValues: [...item.enumValues] } : {}), ...(item.defaultValue !== undefined ? { defaultValue: item.defaultValue } : {}), description: item.description })),
    oracleStatus: spec.pymolReference?.oracleStatus ?? "NOT_APPLICABLE",
  })),
});
