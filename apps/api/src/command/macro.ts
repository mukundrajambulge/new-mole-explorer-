import type { CommandDiagnostic, CommandResult, JsonValue, MacroDefinition, MacroNode } from "@molecular/contracts";
import { CommandDispatcher } from "./dispatcher.js";

export const validateMacro = (macro: MacroDefinition): readonly CommandDiagnostic[] => {
  const diagnostics: CommandDiagnostic[] = [];
  if (macro.schemaVersion !== 1) diagnostics.push({ code: "INVALID_ARGUMENT", message: "Unsupported macro schema version.", retryable: false });
  if (macro.nodes.length === 0 || macro.nodes.length > macro.maxNodes || macro.nodes.length > 512) diagnostics.push({ code: "RESOURCE_LIMIT_EXCEEDED", message: "Macro node count exceeds its bounded limit.", retryable: false });
  if (macro.maxIterations < 1 || macro.maxIterations > 10_000) diagnostics.push({ code: "RESOURCE_LIMIT_EXCEEDED", message: "Macro iteration limit is outside the safe bounded range.", retryable: false });
  const ids = new Set<string>();
  for (const node of macro.nodes) {
    if (ids.has(node.nodeId)) diagnostics.push({ code: "INVALID_ARGUMENT", message: `Duplicate macro node ${node.nodeId}.`, retryable: false });
    ids.add(node.nodeId);
    if (!node.command && !node.macroId) diagnostics.push({ code: "INVALID_ARGUMENT", message: `Macro node ${node.nodeId} has no command or child macro.`, retryable: false });
    if (node.macroId) diagnostics.push({ code: "UNSUPPORTED_COMMAND_SEMANTICS", message: `Child macro ${node.macroId} requires an explicit catalog; implicit recursive macro lookup is disabled.`, retryable: false });
    if (node.foreach && node.foreach.values.length > macro.maxIterations) diagnostics.push({ code: "RESOURCE_LIMIT_EXCEEDED", message: `Macro node ${node.nodeId} exceeds the foreach iteration bound.`, retryable: false });
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const byId = new Map(macro.nodes.map((node) => [node.nodeId, node]));
  const visit = (id: string) => {
    if (visiting.has(id)) { diagnostics.push({ code: "PRECONDITION_FAILED", message: "Macro graph contains a cycle or recursion.", retryable: false }); return; }
    if (visited.has(id)) return;
    const node = byId.get(id);
    if (!node) { diagnostics.push({ code: "PRECONDITION_FAILED", message: `Macro dependency ${id} does not exist.`, retryable: false }); return; }
    visiting.add(id); for (const dependency of node.dependsOn ?? []) visit(dependency); visiting.delete(id); visited.add(id);
  };
  for (const node of macro.nodes) visit(node.nodeId);
  return diagnostics;
};

const orderedNodes = (nodes: readonly MacroNode[]): readonly MacroNode[] => {
  const remaining = new Map(nodes.map((node) => [node.nodeId, node])); const ordered: MacroNode[] = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter((node) => (node.dependsOn ?? []).every((dependency) => ordered.some((done) => done.nodeId === dependency))).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    if (!ready.length) break;
    for (const node of ready) { ordered.push(node); remaining.delete(node.nodeId); }
  }
  return ordered;
};

export type MacroRunResult = { results: readonly CommandResult[]; diagnostics: readonly CommandDiagnostic[] };

export const runMacro = (dispatcher: CommandDispatcher, macro: MacroDefinition): MacroRunResult => {
  const validation = validateMacro(macro);
  if (validation.length) return { results: [], diagnostics: validation };
  const results: CommandResult[] = []; const diagnostics: CommandDiagnostic[] = [];
  for (const node of orderedNodes(macro.nodes)) {
    const commands = node.command ? [node.command] : [];
    const values = node.foreach?.values ?? [null];
    for (const value of values) {
      for (const command of commands) {
        const normalizedArgs = node.foreach ? { ...command.normalizedArgs, [node.foreach.itemArg]: value as JsonValue } : command.normalizedArgs;
        const result = dispatcher.dispatch({ command: { ...command, normalizedArgs, parentCommandId: command.parentCommandId ?? macro.macroId, origin: { ...command.origin, surface: "MACRO" } } });
        results.push(result);
        if (result.status !== "SUCCEEDED" || result.diagnostics.length) {
          diagnostics.push(...result.diagnostics);
          if (macro.errorPolicy === "STOP_ON_ERROR") return { results, diagnostics: diagnostics.length ? diagnostics : [{ code: "PARTIAL_BATCH", message: `Macro stopped at node ${node.nodeId}.`, retryable: false }] };
        }
      }
    }
  }
  return { results, diagnostics };
};
