import type { CanonicalCommand, JsonRecord } from "@molecular/contracts";
import { canonicalSemanticHash, COMMAND_REGISTRY_VERSION, COMMAND_SCHEMA_VERSION, SAFE_PYMOL_COMPAT_PROFILE } from "@molecular/contracts";
import { isRecognizedCommandVerb, parseCommand, type CommandVerb } from "./commandRegistry";

export type UiCommandExecution<T> = (command: CanonicalCommand) => T;

const digest = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const typeFor = (verb: CommandVerb): string => ({
  select: "SELECTION.EVALUATE", show: "REPRESENTATION.SHOW", show_as: "REPRESENTATION.SHOW_AS", hide: "REPRESENTATION.HIDE", color: "COLOR.APPLY", set: "SETTING.SET", label: "LABEL.SET", center: "VIEW.CENTER", zoom: "VIEW.ZOOM", measure: "MEASURE.DISTANCE", get_view: "VIEW.GET", unpick: "SELECTION.CLEAR", help: "SYSTEM.HELP", rename: "OBJECT.RENAME", set_name: "OBJECT.RENAME", copy: "OBJECT.COPY", create: "OBJECT.CREATE", split_states: "OBJECT.SPLIT_STATES", join_states: "OBJECT.JOIN_STATES", group: "OBJECT.GROUP", delete: "OBJECT.DELETE", update: "OBJECT.UPDATE", enable: "OBJECT.ENABLE", disable: "OBJECT.DISABLE", state: "OBJECT.STATE", frame: "OBJECT.FRAME", all_states: "OBJECT.ALL_STATES", count_states: "OBJECT.COUNT_STATES", coordinate_frame: "SETTING.SET", history: "HISTORY.LIST", undo: "HISTORY.UNDO", redo: "HISTORY.REDO", edit_test: "EDIT.TEST", remove: "EDIT.ATOM_DELETE", bond: "EDIT.BOND_CREATE", unbond: "EDIT.BOND_DELETE", set_bond: "EDIT.BOND_ORDER_SET", h_add: "EDIT.HYDROGEN_ADD", h_fill: "EDIT.HYDROGEN_REFILL", h_remove: "EDIT.HYDROGEN_REMOVE", attach: "EDIT.ATOM_ATTACH", replace: "EDIT.ATOM_REPLACE", rms_cur: "ANALYSIS.RMS_CUR", rms: "ANALYSIS.RMS", fit: "ANALYSIS.FIT", pair_fit: "ANALYSIS.PAIR_FIT", align: "ANALYSIS.ALIGN", super: "ANALYSIS.SUPER", cealign: "ANALYSIS.CEALIGN", intra_rms_cur: "ANALYSIS.INTRA_RMS_CUR", intra_rms: "ANALYSIS.INTRA_RMS", intra_fit: "ANALYSIS.INTRA_FIT",
} as Record<CommandVerb, string>)[verb];

const normalizedArgsFor = (verb: CommandVerb, argument: string, target: string | null): JsonRecord => {
  const args: JsonRecord = {};
  if (verb === "select") {
    const operation = argument.match(/^(replace|add|subtract|intersect)$/i)?.[1]?.toLowerCase();
    args.operation = operation ?? "replace";
    args.query = operation ? (target ?? "") : argument;
  } else if (verb === "set") {
    args.name = argument;
    if (target) args.value = target;
  } else if (["show", "show_as", "hide", "color"].includes(verb)) {
    args[verb === "color" ? "color" : "representation"] = argument;
    args.query = target ?? "all";
  } else if (verb === "measure") {
    args.selection1 = argument;
    args.selection2 = target ?? "";
  } else if (["rms_cur", "rms", "fit", "pair_fit", "align", "super", "cealign"].includes(verb)) {
    args.mobile = argument;
    args.target = target ?? "";
  } else if (argument) {
    args.argument = argument;
    if (target) args.target = target;
  }
  return args;
};

export const createUiCanonicalCommand = (source: string, surface: "GUI" | "CONSOLE" = "CONSOLE"): CanonicalCommand => {
  const trimmed = source.trim();
  const sourceHash = digest(trimmed);
  const parsed = parseCommand(trimmed);
  const verb = parsed.command?.verb;
  const commandType = verb && isRecognizedCommandVerb(verb) ? typeFor(verb) : "SELECTION.EVALUATE";
  const normalizedArgs = verb && parsed.command ? normalizedArgsFor(verb, parsed.command.argument, parsed.command.target) : { operation: "replace", query: trimmed };
  const semanticHash = canonicalSemanticHash({ commandType, commandVersion: COMMAND_REGISTRY_VERSION, normalizedArgs, boundRefs: {}, policy: SAFE_PYMOL_COMPAT_PROFILE });
  return {
    commandId: `ui:${sourceHash}`,
    commandType,
    commandVersion: COMMAND_REGISTRY_VERSION,
    schemaVersion: COMMAND_SCHEMA_VERSION,
    normalizedArgs,
    boundRefs: {},
    origin: { surface, profile: SAFE_PYMOL_COMPAT_PROFILE, profileVersion: "safe-pymol-compat.v1", syntaxVersion: "r10-safe-grammar.v1", sourceHash, sourceText: trimmed, ...(verb ? { resolvedPublicName: verb } : {}), sourceMap: { start: 0, end: trimmed.length } },
    requestedMode: "SYNC",
    correlationId: `ui:${semanticHash}`,
    submittedAt: new Date().toISOString(),
    semanticHash,
  };
};

export const dispatchUiCommand = <T>(source: string, execute: UiCommandExecution<T>, surface: "GUI" | "CONSOLE" = "CONSOLE"): { command: CanonicalCommand; result: T } => {
  const command = createUiCanonicalCommand(source, surface);
  return { command, result: execute(command) };
};
