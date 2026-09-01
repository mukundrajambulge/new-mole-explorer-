import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";

export type SelectionStatus =
  | "VALID_NONEMPTY"
  | "VALID_EMPTY"
  | "SYNTAX_ERROR"
  | "UNSUPPORTED_OPERATOR_OR_PROFILE"
  | "UNKNOWN_PROPERTY"
  | "UNKNOWN_NAME"
  | "AMBIGUOUS_NAME"
  | "INVALID_VALUE"
  | "STALE_REVISION"
  | "MISSING_DEPENDENCY"
  | "OBJECT_NOT_FOUND"
  | "COORDINATE_CONTEXT_ERROR"
  | "TOPOLOGY_CONTEXT_ERROR";

export type SourceSpan = { start: number; end: number; line: number; column: number };
export type SelectionDiagnostic = { code: SelectionStatus | "EXPECTED_TOKEN"; message: string; span?: SourceSpan };

export type SelectionTokenKind = "WORD" | "STRING" | "LPAREN" | "RPAREN" | "COMMA" | "OPERATOR" | "EOF";
export type SelectionToken = { kind: SelectionTokenKind; lexeme: string; span: SourceSpan };

export type SelectionProperty = "name" | "resn" | "resi" | "chain" | "segi" | "elem" | "id" | "index" | "rank" | "model" | "object" | "alt";
export type SelectionAst =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "predicate"; property: SelectionProperty; operator: "EQ" | "NE"; value: string; span?: SourceSpan }
  | { kind: "category"; category: "polymer" | "ligand" | "water" | "ion" | "other"; span?: SourceSpan }
  | { kind: "named"; name: string; required: boolean; span?: SourceSpan }
  | { kind: "not"; operand: SelectionAst }
  | { kind: "and" | "or"; left: SelectionAst; right: SelectionAst }
  | { kind: "byres" | "bychain"; operand: SelectionAst }
  | { kind: "neighbor" | "bound_to"; operand: SelectionAst }
  | { kind: "within" | "around"; distance: number; reference: SelectionAst; candidate?: SelectionAst };

export type SelectionProvenance = {
  kind: "query" | "pick" | "named-snapshot" | "command";
  rawQuery?: string;
  parentResultIds?: readonly string[];
};

export type SelectionResult = {
  schemaVersion: 2;
  resultId: string;
  source: SelectionProvenance;
  query: string;
  grammarVersion: string;
  normalizedAst: string;
  normalizedAstHash: string;
  profile: { id: string; version: string; fingerprint: string };
  molecularIdentity: { structureId: string; molecularRevision: string };
  structureId: string;
  molecularRevision: string;
  objectScope: { kind: "structure"; objectId: string };
  universeFingerprint: string;
  coordinateContext: { structureId: string; revision: string; stateId: string } | null;
  topologyRevision: string | null;
  namespaceRevision: string;
  stableAtomIds: readonly string[];
  membershipHash: string;
  count: number;
  status: SelectionStatus;
  diagnostics: readonly SelectionDiagnostic[];
  dependencyVector: { needsCoordinates: boolean; needsTopology: boolean; needsNamespaces: boolean };
};

export class SelectionResolutionError extends Error {
  readonly result?: SelectionResult;
  constructor(message: string, result?: SelectionResult) {
    super(message);
    this.name = "SelectionResolutionError";
    this.result = result;
  }
}

const PROFILE = { id: "pymol-oss-mvp", version: "1", fingerprint: "pymol-oss-mvp-selection-v1" } as const;
const GRAMMAR_VERSION = "selection-lexer-pratt-v1";
const hash = (value: string): string => {
  let result = 2166136261;
  for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(16).padStart(8, "0");
};
const stableSort = (ids: readonly string[], structure: CanonicalMolecularStructure): string[] => {
  const order = new Map(structure.atoms.map((atom, index) => [atom.stableId, index]));
  return [...new Set(ids)].sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
};
const spanAt = (query: string, start: number, end: number): SourceSpan => {
  const before = query.slice(0, start);
  return { start, end, line: before.split("\n").length, column: start - (before.lastIndexOf("\n") + 1) + 1 };
};

export const lexSelection = (query: string): { tokens: readonly SelectionToken[]; diagnostics: readonly SelectionDiagnostic[] } => {
  const tokens: SelectionToken[] = [];
  const diagnostics: SelectionDiagnostic[] = [];
  let cursor = 0;
  while (cursor < query.length) {
    if (/\s/.test(query[cursor])) { cursor += 1; continue; }
    const start = cursor;
    const char = query[cursor];
    if (char === "(") { cursor += 1; tokens.push({ kind: "LPAREN", lexeme: char, span: spanAt(query, start, cursor) }); continue; }
    if (char === ")") { cursor += 1; tokens.push({ kind: "RPAREN", lexeme: char, span: spanAt(query, start, cursor) }); continue; }
    if (char === ",") { cursor += 1; tokens.push({ kind: "COMMA", lexeme: char, span: spanAt(query, start, cursor) }); continue; }
    if (char === "!" || char === "&" || char === "|") { cursor += 1; tokens.push({ kind: "OPERATOR", lexeme: char, span: spanAt(query, start, cursor) }); continue; }
    if (char === "\"" || char === "'") {
      const quote = char; cursor += 1; let value = ""; let closed = false;
      while (cursor < query.length) { const next = query[cursor++]; if (next === "\\" && cursor < query.length) { value += query[cursor++]; continue; } if (next === quote) { closed = true; break; } value += next; }
      const span = spanAt(query, start, cursor);
      if (!closed) diagnostics.push({ code: "SYNTAX_ERROR", message: "Unterminated quoted value.", span });
      tokens.push({ kind: "STRING", lexeme: value, span }); continue;
    }
    while (cursor < query.length && !/\s/.test(query[cursor]) && !/[(),!&|]/.test(query[cursor])) cursor += 1;
    tokens.push({ kind: "WORD", lexeme: query.slice(start, cursor), span: spanAt(query, start, cursor) });
  }
  tokens.push({ kind: "EOF", lexeme: "", span: spanAt(query, query.length, query.length) });
  return { tokens, diagnostics };
};

const isWord = (token: SelectionToken | undefined, value?: string): boolean => token?.kind === "WORD" && (value === undefined || token.lexeme.toLowerCase() === value);
const propertyNames = new Set<SelectionProperty>(["name", "resn", "resi", "chain", "segi", "elem", "id", "index", "rank", "model", "object", "alt"]);
const categoryNames = new Map([["polymer", "polymer"], ["protein", "polymer"], ["ligand", "ligand"], ["organic", "ligand"], ["water", "water"], ["ion", "ion"], ["ions", "ion"], ["other", "other"]] as const);

class SelectionParser {
  private cursor = 0;
  readonly diagnostics: SelectionDiagnostic[] = [];
  constructor(private readonly query: string, private readonly tokens: readonly SelectionToken[]) {}
  private current() { return this.tokens[this.cursor]; }
  private take() { return this.tokens[this.cursor++]; }
  private fail(message: string, token = this.current()): never { const diagnostic = { code: "SYNTAX_ERROR" as const, message, span: token?.span }; this.diagnostics.push(diagnostic); throw new Error(message); }
  private expectWord(value: string) { if (!isWord(this.current(), value)) this.fail(`Expected \`${value}\`.`); return this.take(); }
  parse(): SelectionAst {
    const ast = this.expression(0);
    if (this.current().kind !== "EOF") this.fail(`Unexpected token \`${this.current().lexeme}\`.`);
    return ast;
  }
  private expression(minBindingPower: number): SelectionAst {
    let left = this.prefix();
    while (true) {
      const token = this.current();
      const word = token.lexeme.toLowerCase();
      const bindingPower = word === "or" || token.lexeme === "|" ? 10 : word === "and" || token.lexeme === "&" ? 20 : word === "within" ? 25 : -1;
      if (bindingPower < minBindingPower) break;
      this.take();
      if (word === "within") {
        const distance = this.distance(); this.expectWord("of");
        left = { kind: "within", distance, candidate: left, reference: this.expression(bindingPower + 1) }; continue;
      }
      const right = this.expression(bindingPower + 1);
      left = { kind: word === "or" || token.lexeme === "|" ? "or" : "and", left, right };
    }
    return left;
  }
  private prefix(): SelectionAst {
    const token = this.take();
    if (!token || token.kind === "EOF") this.fail("A selection expression is required.", token);
    const word = token.lexeme.toLowerCase();
    if (token.kind === "LPAREN") { const nested = this.expression(0); if (this.current().kind !== "RPAREN") this.fail("Expected `)`."); this.take(); return nested; }
    if (token.kind === "OPERATOR" && token.lexeme === "!") return { kind: "not", operand: this.expression(60) };
    if (word === "not") return { kind: "not", operand: this.expression(60) };
    if (word === "byres" || word === "bychain") return { kind: word, operand: this.expression(15) };
    if (word === "neighbor" || word === "bound_to" || word === "bound-to") return { kind: word === "bound-to" ? "bound_to" : word, operand: this.expression(35) };
    if (word === "within" || word === "around") {
      const distance = this.distance();
      if (word === "within") this.expectWord("of");
      const reference = this.expression(35);
      return { kind: word, distance, reference };
    }
    if (word === "all" || word === "*" || word === "everything") return { kind: "all" };
    if (word === "none") return { kind: "none" };
    const category = categoryNames.get(word as "polymer" | "protein" | "ligand" | "organic" | "water" | "ion" | "ions" | "other");
    if (category) return { kind: "category", category, span: token.span };
    if (propertyNames.has(word as SelectionProperty)) {
      const value = this.take();
      if (!value || value.kind === "EOF" || value.kind === "RPAREN") this.fail(`Property \`${word}\` requires a value.`, value);
      return { kind: "predicate", property: word as SelectionProperty, operator: "EQ", value: value.lexeme, span: token.span };
    }
    if (token.kind === "STRING" || token.kind === "WORD") {
      if (token.lexeme.startsWith("%")) return { kind: "named", name: token.lexeme.slice(1), required: true, span: token.span };
      if (token.lexeme.startsWith("?") && token.lexeme.length > 1) return { kind: "named", name: token.lexeme.slice(1), required: false, span: token.span };
      return { kind: "named", name: token.lexeme, required: true, span: token.span };
    }
    this.fail(`Unexpected token \`${token.lexeme}\`.`, token);
  }
  private distance(): number {
    const token = this.take(); const value = Number(token?.lexeme);
    if (!token || !Number.isFinite(value) || value < 0) this.fail("A non-negative finite distance is required.", token);
    return value;
  }
}

export const parseSelection = (query: string): { ast: SelectionAst | null; tokens: readonly SelectionToken[]; diagnostics: readonly SelectionDiagnostic[] } => {
  const lexical = lexSelection(query);
  if (lexical.diagnostics.length > 0) return { ast: null, tokens: lexical.tokens, diagnostics: lexical.diagnostics };
  const parser = new SelectionParser(query, lexical.tokens);
  try {
    return { ast: parser.parse(), tokens: lexical.tokens, diagnostics: parser.diagnostics };
  } catch { return { ast: null, tokens: lexical.tokens, diagnostics: parser.diagnostics }; }
};

const normalize = (ast: SelectionAst): SelectionAst => {
  if (ast.kind === "and" || ast.kind === "or") return { ...ast, left: normalize(ast.left), right: normalize(ast.right) };
  if (ast.kind === "not" || ast.kind === "byres" || ast.kind === "bychain" || ast.kind === "neighbor" || ast.kind === "bound_to") return { ...ast, operand: normalize(ast.operand) };
  if (ast.kind === "within" || ast.kind === "around") return { ...ast, reference: normalize(ast.reference), ...(ast.candidate ? { candidate: normalize(ast.candidate) } : {}) };
  if (ast.kind === "predicate") return { ...ast, property: ast.property.toLowerCase() as SelectionProperty, value: ast.value.trim() };
  if (ast.kind === "named") return { ...ast, name: ast.name.trim() };
  return ast;
};
const serialize = (ast: SelectionAst): string => {
  if (ast.kind === "all" || ast.kind === "none") return ast.kind;
  if (ast.kind === "category") return ast.category;
  if (ast.kind === "named") return `${ast.required ? "%" : "?"}${ast.name}`;
  if (ast.kind === "predicate") return `${ast.property}=${JSON.stringify(ast.value)}`;
  if (ast.kind === "not") return `not(${serialize(ast.operand)})`;
  if (ast.kind === "and" || ast.kind === "or") return `(${serialize(ast.left)} ${ast.kind} ${serialize(ast.right)})`;
  if (ast.kind === "byres" || ast.kind === "bychain" || ast.kind === "neighbor" || ast.kind === "bound_to") return `${ast.kind}(${serialize(ast.operand)})`;
  if (ast.kind === "within" || ast.kind === "around") return `${ast.kind}(${ast.distance},${serialize(ast.reference)}${ast.candidate ? `,${serialize(ast.candidate)}` : ""})`;
  return "invalid";
};

type EvalContext = { universe: Set<string>; diagnostics: SelectionDiagnostic[]; needsCoordinates: boolean; needsTopology: boolean; named?: NamedSelectionStore; query: string };
const wildcardMatch = (value: string, pattern: string): boolean => {
  const escaped = [...pattern].map((char) => char === "*" ? ".*" : char === "?" ? "." : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
  return new RegExp(`^${escaped}$`, "i").test(value);
};
const residueParts = (value: string): { number: number; insertion: string } | null => { const match = value.match(/^(-?\d+)([A-Za-z]?)$/); return match ? { number: Number(match[1]), insertion: match[2].toUpperCase() } : null; };
const residueMatch = (atom: CanonicalAtom, value: string): boolean => {
  const range = value.match(/^(-?\d+[A-Za-z]?)(?:-|:)(-?\d+[A-Za-z]?)$/);
  const current = { number: atom.residueNumber, insertion: (atom.insertionCode ?? "").toUpperCase() };
  if (range) { const low = residueParts(range[1]); const high = residueParts(range[2]); if (!low || !high) return false; const cmp = (a: typeof current, b: typeof current) => a.number === b.number ? a.insertion.localeCompare(b.insertion) : a.number - b.number; return cmp(current, low) >= 0 && cmp(current, high) <= 0; }
  const exact = residueParts(value); return !!exact && current.number === exact.number && current.insertion === exact.insertion;
};
const atomCategory = (atom: CanonicalAtom): "polymer" | "ligand" | "water" | "ion" | "other" => atom.isPolymer ? "polymer" : atom.isLigand ? "ligand" : atom.isWater ? "water" : atom.isIon ? "ion" : "other";
const predicateMatches = (atom: CanonicalAtom, property: SelectionProperty, value: string, structure: CanonicalMolecularStructure, context: EvalContext): boolean => {
  if (property === "segi") { if (!context.diagnostics.some((diagnostic) => diagnostic.code === "UNSUPPORTED_OPERATOR_OR_PROFILE")) context.diagnostics.push({ code: "UNSUPPORTED_OPERATOR_OR_PROFILE", message: "Segment identity is not present in the current canonical structure; the query was not mapped to chain identity." }); return false; }
  if (property === "name") return wildcardMatch(atom.atomName, value);
  if (property === "resn") return wildcardMatch(atom.residueName, value);
  if (property === "resi") return residueMatch(atom, value);
  if (property === "chain") return wildcardMatch(atom.chain, value);
  if (property === "elem") return wildcardMatch(atom.element, value);
  if (property === "alt") return wildcardMatch(atom.altLoc ?? "", value);
  if (property === "id") return atom.stableId === value || String(atom.serial) === value;
  if (property === "index") { const index = structure.atoms.findIndex((candidate) => candidate.stableId === atom.stableId) + 1; return index === Number(value); }
  if (property === "rank") { const index = structure.atoms.findIndex((candidate) => candidate.stableId === atom.stableId); return index === Number(value); }
  if (property === "model" || property === "object") return wildcardMatch(structure.id, value) || wildcardMatch(structure.name, value);
  context.diagnostics.push({ code: "UNKNOWN_PROPERTY", message: `Unknown canonical property: ${property}.` }); return false;
};
const evaluateAst = (ast: SelectionAst, structure: CanonicalMolecularStructure, context: EvalContext): Set<string> => {
  const all = () => new Set(context.universe);
  if (ast.kind === "all") return all();
  if (ast.kind === "none") return new Set();
  if (ast.kind === "category") return new Set(structure.atoms.filter((atom) => atomCategory(atom) === ast.category).map((atom) => atom.stableId).filter((id) => context.universe.has(id)));
  if (ast.kind === "predicate") return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && predicateMatches(atom, ast.property, ast.value, structure, context)).map((atom) => atom.stableId));
  if (ast.kind === "named") {
    const named = context.named?.get(ast.name);
    if (!named) { if (ast.required) context.diagnostics.push({ code: "UNKNOWN_NAME", message: `Named selection \`${ast.name}\` does not exist.` }); return new Set(); }
    return new Set(named.stableAtomIds.filter((id) => context.universe.has(id)));
  }
  if (ast.kind === "not") { const operand = evaluateAst(ast.operand, structure, context); return new Set([...context.universe].filter((id) => !operand.has(id))); }
  if (ast.kind === "and" || ast.kind === "or") { const left = evaluateAst(ast.left, structure, context); const right = evaluateAst(ast.right, structure, context); return ast.kind === "and" ? new Set([...left].filter((id) => right.has(id))) : new Set([...left, ...right]); }
  if (ast.kind === "byres" || ast.kind === "bychain") {
    const operand = evaluateAst(ast.operand, structure, context); const groups = new Set(structure.atoms.filter((atom) => operand.has(atom.stableId)).map((atom) => ast.kind === "byres" ? `${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}` : atom.chain));
    return new Set(structure.atoms.filter((atom) => groups.has(ast.kind === "byres" ? `${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}` : atom.chain) && context.universe.has(atom.stableId)).map((atom) => atom.stableId));
  }
  if (ast.kind === "neighbor" || ast.kind === "bound_to") {
    context.needsTopology = true; if (!structure.bonds) { context.diagnostics.push({ code: "TOPOLOGY_CONTEXT_ERROR", message: "Topology is unavailable for neighbor expansion." }); return new Set(); }
    const target = evaluateAst(ast.operand, structure, context); const result = new Set<string>();
    for (const bond of structure.bonds) { const first = target.has(bond.atom1); const second = target.has(bond.atom2); if (first && context.universe.has(bond.atom2)) result.add(bond.atom2); if (second && context.universe.has(bond.atom1)) result.add(bond.atom1); }
    if (ast.kind === "neighbor") for (const id of target) result.delete(id);
    return result;
  }
  if (ast.kind !== "within" && ast.kind !== "around") return new Set();
  context.needsCoordinates = true;
  if (ast.distance < 0 || !Number.isFinite(ast.distance)) { context.diagnostics.push({ code: "INVALID_VALUE", message: "Spatial distance must be finite and non-negative." }); return new Set(); }
  const reference = evaluateAst(ast.reference, structure, context); const candidate = ast.candidate ? evaluateAst(ast.candidate, structure, context) : new Set(context.universe); const refAtoms = structure.atoms.filter((atom) => reference.has(atom.stableId));
  const result = new Set<string>(); const radiusSquared = ast.distance * ast.distance;
  for (const atom of structure.atoms) {
    if (!candidate.has(atom.stableId)) continue;
    const inside = refAtoms.some((ref) => { const dx = atom.x - ref.x; const dy = atom.y - ref.y; const dz = atom.z - ref.z; return dx * dx + dy * dy + dz * dz <= radiusSquared; });
    if (inside && (ast.kind !== "around" || !reference.has(atom.stableId))) result.add(atom.stableId);
  }
  return result;
};

const resultId = (query: string, structure: CanonicalMolecularStructure, ids: readonly string[]) => hash(`${query}\u0000${structure.id}\u0000${structure.scientificHash}\u0000${ids.join("\u0000")}`);
const baseResult = (query: string, structure: CanonicalMolecularStructure, source: SelectionProvenance, status: SelectionStatus, diagnostics: readonly SelectionDiagnostic[], astText: string, ids: readonly string[], deps: EvalContext): SelectionResult => {
  const stableAtomIds = stableSort(ids, structure); const normalizedAstHash = hash(astText); const membershipHash = hash(stableAtomIds.join("\u0000"));
  return { schemaVersion: 2, resultId: resultId(query, structure, stableAtomIds), source, query, grammarVersion: GRAMMAR_VERSION, normalizedAst: astText, normalizedAstHash, profile: PROFILE, molecularIdentity: { structureId: structure.id, molecularRevision: structure.scientificHash }, structureId: structure.id, molecularRevision: structure.scientificHash, objectScope: { kind: "structure", objectId: structure.id }, universeFingerprint: hash(structure.atoms.map((atom) => atom.stableId).join("\u0000")), coordinateContext: deps.needsCoordinates ? { structureId: structure.id, revision: structure.scientificHash, stateId: "active" } : null, topologyRevision: deps.needsTopology ? hash(structure.bonds.map((bond) => `${bond.atom1}:${bond.atom2}:${bond.order}`).join("\u0000")) : null, namespaceRevision: hash(structure.atoms.map((atom) => `${atom.stableId}:${atom.chain}:${atom.residueNumber}`).join("\u0000")), stableAtomIds, membershipHash, count: stableAtomIds.length, status, diagnostics, dependencyVector: { needsCoordinates: deps.needsCoordinates, needsTopology: deps.needsTopology, needsNamespaces: true } };
};

export type SelectionEvaluationOptions = { named?: NamedSelectionStore; expectedRevision?: string; source?: SelectionProvenance };
export const evaluateSelectionQuery = (query: string, structure: CanonicalMolecularStructure, options: SelectionEvaluationOptions = {}): SelectionResult => {
  const trimmed = query.trim(); const parsed = parseSelection(trimmed); const source = options.source ?? { kind: "query", rawQuery: trimmed };
  const emptyContext: EvalContext = { universe: new Set(structure.atoms.map((atom) => atom.stableId)), diagnostics: [...parsed.diagnostics], needsCoordinates: false, needsTopology: false, named: options.named, query: trimmed };
  if (options.expectedRevision && options.expectedRevision !== structure.scientificHash) return baseResult(trimmed, structure, source, "STALE_REVISION", [{ code: "STALE_REVISION", message: "The selection context revision is stale; the active structure was not changed." }], "", [], emptyContext);
  const gated = trimmed.match(/\b(gap|pbc|bycell|symmetry|byring|byfragment)\b/i);
  if (gated) return baseResult(trimmed, structure, source, "UNSUPPORTED_OPERATOR_OR_PROFILE", [{ code: "UNSUPPORTED_OPERATOR_OR_PROFILE", message: `Selection operator \`${gated[1]}\` is gated until its validated scientific profile is available.` }], "", [], emptyContext);
  if (!trimmed || !parsed.ast) return baseResult(trimmed, structure, source, "SYNTAX_ERROR", parsed.diagnostics.length ? parsed.diagnostics : [{ code: "SYNTAX_ERROR", message: "A selection expression is required." }], "", [], emptyContext);
  const ast = normalize(parsed.ast); const normalized = serialize(ast); const context: EvalContext = { ...emptyContext, diagnostics: [] };
  const ids = evaluateAst(ast, structure, context);
  let status: SelectionStatus = ids.size > 0 ? "VALID_NONEMPTY" : "VALID_EMPTY";
  if (context.diagnostics.some((diagnostic) => diagnostic.code === "UNSUPPORTED_OPERATOR_OR_PROFILE")) status = "UNSUPPORTED_OPERATOR_OR_PROFILE";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_PROPERTY")) status = "UNKNOWN_PROPERTY";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_NAME")) status = "UNKNOWN_NAME";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "TOPOLOGY_CONTEXT_ERROR")) status = "TOPOLOGY_CONTEXT_ERROR";
  return baseResult(trimmed, structure, source, status, context.diagnostics, normalized, [...ids], context);
};

export const requireValidSelection = (result: SelectionResult): SelectionResult => {
  if (result.status !== "VALID_NONEMPTY" && result.status !== "VALID_EMPTY") throw new SelectionResolutionError(result.diagnostics[0]?.message ?? `Selection rejected with status ${result.status}.`, result);
  return result;
};
export const resolveSelection = (query: string, structure: CanonicalMolecularStructure, options?: SelectionEvaluationOptions): SelectionResult => requireValidSelection(evaluateSelectionQuery(query, structure, options));
export const selectionForStableIds = (stableAtomIds: readonly string[], structure: CanonicalMolecularStructure): SelectionResult => baseResult("<pick>", structure, { kind: "pick" }, stableAtomIds.length ? "VALID_NONEMPTY" : "VALID_EMPTY", [], "pick", stableAtomIds, { universe: new Set(), diagnostics: [], needsCoordinates: false, needsTopology: false, query: "<pick>" });

export const combineSelections = (left: SelectionResult, right: SelectionResult, operation: "replace" | "add" | "subtract" | "intersect"): SelectionResult => {
  if (left.structureId !== right.structureId || left.molecularRevision !== right.molecularRevision) throw new SelectionResolutionError("Selections belong to different molecular revisions.");
  const a = new Set(left.stableAtomIds); const b = new Set(right.stableAtomIds); const ids = operation === "replace" ? [...b] : operation === "add" ? [...a, ...b] : operation === "subtract" ? [...a].filter((id) => !b.has(id)) : [...a].filter((id) => b.has(id));
  return { ...right, resultId: hash(`${left.resultId}:${operation}:${right.resultId}`), source: { kind: "command", parentResultIds: [left.resultId, right.resultId] }, query: `${operation}(${left.query},${right.query})`, normalizedAst: `${operation}(${left.normalizedAst},${right.normalizedAst})`, normalizedAstHash: hash(`${operation}:${left.normalizedAstHash}:${right.normalizedAstHash}`), stableAtomIds: ids, membershipHash: hash(ids.join("\u0000")), count: ids.length, status: ids.length ? "VALID_NONEMPTY" : "VALID_EMPTY" };
};

export type NamedSelectionSnapshot = { name: string; stableAtomIds: readonly string[]; selectionResult: SelectionResult; createdAtRevision: string; immutable: true };
export class NamedSelectionStore {
  private readonly snapshots = new Map<string, NamedSelectionSnapshot>();
  constructor(private readonly structure: CanonicalMolecularStructure) {}
  get(name: string) { return this.snapshots.get(name); }
  list() { return [...this.snapshots.values()]; }
  createSnapshot(name: string, result: SelectionResult): NamedSelectionSnapshot {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new SelectionResolutionError("Named selections must use an identifier such as active_site.");
    if (result.structureId !== this.structure.id || result.molecularRevision !== this.structure.scientificHash) throw new SelectionResolutionError("A named selection cannot be created from a stale molecular revision.");
    const snapshot: NamedSelectionSnapshot = { name, stableAtomIds: [...result.stableAtomIds], selectionResult: { ...result, source: { kind: "named-snapshot", parentResultIds: [result.resultId] } }, createdAtRevision: this.structure.scientificHash, immutable: true };
    this.snapshots.set(name, snapshot); return snapshot;
  }
  delete(name: string) { return this.snapshots.delete(name); }
  clear() { this.snapshots.clear(); }
}
