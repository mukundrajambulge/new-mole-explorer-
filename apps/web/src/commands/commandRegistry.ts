export type CommandDomain = "SYSTEM" | "SELECTION" | "PRESENTATION" | "VIEW" | "LABEL" | "MEASURE" | "OBJECT";
export type CommandVerb = "select" | "show" | "show_as" | "hide" | "color" | "label" | "center" | "zoom" | "measure" | "get_view" | "unpick" | "help" | "rename" | "delete" | "update";
export type ParsedCommand = { domain: CommandDomain; verb: CommandVerb; raw: string; head: string; argument: string; target: string | null; span: { start: number; end: number } };
export type CommandParseError = { code: "EMPTY" | "UNKNOWN_COMMAND" | "MISSING_ARGUMENT"; message: string; span?: { start: number; end: number } };
export type CommandDefinition = { verb: CommandVerb; domain: CommandDomain; synopsis: string; description: string; requiresArgument: boolean };

export const COMMAND_REGISTRY: readonly CommandDefinition[] = [
  { verb: "select", domain: "SELECTION", synopsis: "select [replace|add|subtract|intersect] <query>", description: "Evaluate canonical atom membership and update the active selection.", requiresArgument: true },
  { verb: "show", domain: "PRESENTATION", synopsis: "show <representation>, <query>", description: "Show one representation for the selected canonical scope.", requiresArgument: true },
  { verb: "show_as", domain: "PRESENTATION", synopsis: "show_as <representation>, <query>", description: "Show one representation and make it the target representation.", requiresArgument: true },
  { verb: "hide", domain: "PRESENTATION", synopsis: "hide <representation>, <query>", description: "Hide one representation for the selected canonical scope.", requiresArgument: true },
  { verb: "color", domain: "PRESENTATION", synopsis: "color <named-color|inherit>, <query>", description: "Apply or clear a presentation color without changing canonical data.", requiresArgument: true },
  { verb: "label", domain: "LABEL", synopsis: "label <query>, <safe-expression>", description: "Apply a non-evaluating canonical label expression.", requiresArgument: true },
  { verb: "center", domain: "VIEW", synopsis: "center <query>", description: "Center the camera on a canonical target.", requiresArgument: true },
  { verb: "zoom", domain: "VIEW", synopsis: "zoom <query>", description: "Fit the camera to a canonical target.", requiresArgument: true },
  { verb: "measure", domain: "MEASURE", synopsis: "measure <distance|angle|dihedral|clear>", description: "Start or clear canonical-coordinate measurements.", requiresArgument: true },
  { verb: "get_view", domain: "VIEW", synopsis: "get_view", description: "Report the current presentation camera state.", requiresArgument: false },
  { verb: "unpick", domain: "SELECTION", synopsis: "unpick", description: "Clear transient selection and pick state.", requiresArgument: false },
  { verb: "help", domain: "SYSTEM", synopsis: "help [command]", description: "Show the bounded command registry and capability notes.", requiresArgument: false },
  { verb: "rename", domain: "OBJECT", synopsis: "rename <old>, <new>", description: "Rename a named selection namespace entry.", requiresArgument: true },
  { verb: "delete", domain: "OBJECT", synopsis: "delete <named-selection>", description: "Delete a named selection snapshot.", requiresArgument: true },
  { verb: "update", domain: "OBJECT", synopsis: "update <name>, <query>", description: "Re-evaluate and replace a named selection snapshot.", requiresArgument: true },
];
const definitions = Object.fromEntries(COMMAND_REGISTRY.map((definition) => [definition.verb, definition])) as Record<CommandVerb, CommandDefinition>;
const verbs = new Set<string>(COMMAND_REGISTRY.map((definition) => definition.verb));

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
  if (!split.argument && definitions[head as CommandVerb].requiresArgument) return { command: null, error: { code: "MISSING_ARGUMENT", message: `Command \`${head}\` requires an argument.` } };
  return { command: { domain: definitions[head as CommandVerb].domain, verb: head as CommandVerb, raw, head, argument: split.argument, target: split.target, span: { start: 0, end: raw.length } }, error: null };
};

export const commandSuggestions = (prefix: string): readonly string[] => {
  const raw = prefix.toLowerCase();
  const normalized = raw.trim();
  const head = normalized.split(/\s+/, 1)[0] ?? "";
  if (/\s/.test(raw)) {
    if (["show", "show_as", "hide"].includes(head)) return ["lines", "sticks", "spheres", "ball-and-stick", "cartoon", "surface", "mesh", "dots"];
    if (head === "measure") return ["distance", "angle", "dihedral", "clear"];
    if (head === "color") return ["red", "green", "blue", "cyan", "yellow", "inherit"];
    if (head === "select" || head === "center" || head === "zoom" || head === "label") return ["all", "none", "polymer", "ligand", "water", "ion", "chain", "resi", "name"];
  }
  return [...verbs].filter((verb) => !normalized || verb.startsWith(normalized)).sort();
};

export const commandHelp = (input = ""): readonly CommandDefinition[] => {
  const normalized = input.trim().toLowerCase();
  return COMMAND_REGISTRY.filter((definition) => !normalized || definition.verb === normalized || definition.domain.toLowerCase() === normalized);
};
