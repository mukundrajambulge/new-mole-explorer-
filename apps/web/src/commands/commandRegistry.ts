export type CommandDomain = "SYSTEM" | "SELECTION" | "PRESENTATION" | "VIEW" | "LABEL" | "MEASURE" | "OBJECT";
export type CommandVerb = "select" | "show" | "show_as" | "hide" | "color" | "label" | "center" | "zoom" | "measure" | "get_view" | "unpick" | "help";
export type ParsedCommand = { domain: CommandDomain; verb: CommandVerb; raw: string; head: string; argument: string; target: string | null; span: { start: number; end: number } };
export type CommandParseError = { code: "EMPTY" | "UNKNOWN_COMMAND" | "MISSING_ARGUMENT"; message: string; span?: { start: number; end: number } };

const definitions: Record<CommandVerb, CommandDomain> = { select: "SELECTION", show: "PRESENTATION", show_as: "PRESENTATION", hide: "PRESENTATION", color: "PRESENTATION", label: "LABEL", center: "VIEW", zoom: "VIEW", measure: "MEASURE", get_view: "VIEW", unpick: "SELECTION", help: "SYSTEM" };
const verbs = new Set<string>(Object.keys(definitions));

const splitTarget = (value: string): { argument: string; target: string | null } => {
  let braces = 0; let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) { if (char === "\\") index += 1; else if (char === quote) quote = ""; continue; }
    if (char === "\"" || char === "'") { quote = char; continue; }
    if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (char === "," && braces === 0) return { argument: value.slice(0, index).trim(), target: value.slice(index + 1).trim() || null };
  }
  return { argument: value.trim(), target: null };
};

export const parseCommand = (input: string): { command: ParsedCommand | null; error: CommandParseError | null } => {
  const raw = input.trim();
  if (!raw) return { command: null, error: { code: "EMPTY", message: "A command is required." } };
  const match = raw.match(/^([^\s]+)(?:\s+(.*))?$/s);
  const head = match?.[1]?.toLowerCase() ?? "";
  if (!verbs.has(head)) return { command: null, error: { code: "UNKNOWN_COMMAND", message: `Unknown command \`${head}\`.` , span: { start: 0, end: head.length } } };
  const split = splitTarget(match?.[2] ?? "");
  if (!split.argument && !["unpick", "get_view", "help"].includes(head)) return { command: null, error: { code: "MISSING_ARGUMENT", message: `Command \`${head}\` requires an argument.` } };
  return { command: { domain: definitions[head as CommandVerb], verb: head as CommandVerb, raw, head, argument: split.argument, target: split.target, span: { start: 0, end: raw.length } }, error: null };
};

export const commandSuggestions = (prefix: string): readonly string[] => {
  const normalized = prefix.trim().toLowerCase();
  return [...verbs].filter((verb) => !normalized || verb.startsWith(normalized)).sort();
};
