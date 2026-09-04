import type { CanonicalAtom, CanonicalMolecularStructure, CanonicalUnitCell } from "@molecular/contracts";
import { vdwRadiusForElementStrict, VDW_RADIUS_PROFILE } from "../science/vdwRadii";
import { canonicalChemistryRolesDatasetComplete, canonicalFragmentDatasetComplete, canonicalPartialChargeDatasetComplete } from "../science/datasetValidity";
import { beyondSurfaceGapBoundary, withinSpatialBoundary } from "./spatialPolicy";

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

/**
 * Coordinate policy is part of the scientific selection contract.  The
 * policy is deliberately explicit for cross-object spatial queries: raw
 * canonical coordinates may be compared only when the workspace has
 * declared that policy, and presentation/camera transforms are never
 * inferred from the renderer.
 */
export type CoordinateFramePolicy = "LOCAL_SCIENTIFIC" | "EFFECTIVE_WORLD";
export type SelectionCoordinateStateScope = {
  objectId: string;
  stateId: string;
  ordinal: number;
};
export type SelectionCoordinateContext = {
  structureId: string;
  revision: string;
  stateId: string;
  framePolicy: CoordinateFramePolicy;
  objectIds: readonly string[];
  /** The exact coordinate realization consulted for each workspace object. */
  stateScopes: readonly SelectionCoordinateStateScope[];
};

export type SourceSpan = { start: number; end: number; line: number; column: number };
export type SelectionDiagnostic = { code: SelectionStatus | "EXPECTED_TOKEN"; message: string; span?: SourceSpan };

export type SelectionTokenKind = "WORD" | "STRING" | "LPAREN" | "RPAREN" | "COMMA" | "OPERATOR" | "EOF";
export type SelectionToken = { kind: SelectionTokenKind; lexeme: string; span: SourceSpan };

export type SelectionProperty = "name" | "resn" | "resi" | "chain" | "segi" | "elem" | "id" | "index" | "rank" | "model" | "object" | "alt" | "formal_charge" | "partial_charge" | "b" | "q" | "occupancy" | "ss" | "x" | "y" | "z" | "state" | "label" | "pepseq" | "rep" | "color" | "cartoon_color" | "ribbon_color";
export type SelectionCategory = "polymer" | "ligand" | "water" | "ion" | "other" | "hydrogen" | "hetatm" | "inorganic" | "solvent" | "protein" | "nucleic" | "backbone" | "sidechain" | "guide" | "metals" | "bonded" | "donors" | "acceptors" | "enabled" | "present" | "visible";
export type SelectionAst =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "predicate"; property: SelectionProperty; operator: "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE"; value: string; span?: SourceSpan }
  | { kind: "category"; category: SelectionCategory; span?: SourceSpan }
  | { kind: "named"; name: string; required: boolean; span?: SourceSpan }
  | { kind: "not"; operand: SelectionAst }
  | { kind: "and" | "or"; left: SelectionAst; right: SelectionAst }
  | { kind: "byobject" | "bysegi" | "bychain" | "byres" | "bycalpha" | "bymolecule" | "byfragment" | "byring" | "bycell" | "first" | "last"; operand: SelectionAst }
  | { kind: "neighbor" | "bound_to"; operand: SelectionAst }
  | { kind: "extend"; distance: number; operand: SelectionAst }
  | { kind: "identifier_match"; mode: "in" | "like"; left: SelectionAst; right: SelectionAst }
  | { kind: "within" | "around" | "expand" | "near_to" | "beyond" | "gap"; distance: number; reference: SelectionAst; candidate?: SelectionAst };

export type SelectionProvenance = {
  kind: "query" | "pick" | "named-snapshot" | "command";
  rawQuery?: string;
  parentResultIds?: readonly string[];
};

export type ScientificSelectionProfile = {
  id: string;
  version: string;
  fingerprint: string;
};

export type BoundSelectionPlan = {
  schemaVersion: 1;
  query: string;
  ast: SelectionAst;
  normalizedAst: string;
  structureId: string;
  molecularRevision: string;
  objectScope: { kind: "structure"; objectId: string };
  universeFingerprint: string;
  coordinateContext: SelectionCoordinateContext | null;
  topologyRevision: string | null;
  namespaceRevision: string;
  scientificProfiles: readonly ScientificSelectionProfile[];
  presentationContext: { revision: string } | null;
  dependencyVector: { needsCoordinates: boolean; needsTopology: boolean; needsNamespaces: boolean; needsPresentation: boolean };
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
  coordinateContext: SelectionCoordinateContext | null;
  topologyRevision: string | null;
  namespaceRevision: string;
  scientificProfiles: readonly ScientificSelectionProfile[];
  presentationContext: { revision: string } | null;
  stableAtomIds: readonly string[];
  membershipHash: string;
  count: number;
  status: SelectionStatus;
  diagnostics: readonly SelectionDiagnostic[];
  dependencyVector: { needsCoordinates: boolean; needsTopology: boolean; needsNamespaces: boolean; needsPresentation: boolean };
  boundPlan: BoundSelectionPlan | null;
};

export class SelectionResolutionError extends Error {
  readonly result?: SelectionResult;
  constructor(message: string, result?: SelectionResult) {
    super(message);
    this.name = "SelectionResolutionError";
    this.result = result;
  }
}

export type SelectionPresentationContext = {
  /** Stable IDs that currently contribute to at least one visible render directive. */
  visibleStableAtomIds: readonly string[];
  /** Presentation representation tokens contributed by each visible canonical atom. */
  representationTokensByStableAtomId?: Readonly<Record<string, readonly string[]>>;
  /** Effective color tokens (hex, canonical name, and color id) for each visible atom. */
  colorTokensByStableAtomId?: Readonly<Record<string, readonly string[]>>;
  /** Effective colors partitioned by renderer representation for representation-specific selectors. */
  representationColorTokensByStableAtomId?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** Text emitted by the active safe label projection for each labeled atom. */
  labelTokensByStableAtomId?: Readonly<Record<string, readonly string[]>>;
  /** Changes whenever presentation visibility or its target directives change. */
  revision: string;
};

export type SelectionWorkspaceGroup = {
  groupId: string;
  name: string;
  objectIds: readonly string[];
};

const PROFILE = { id: "pymol-oss-mvp", version: "1", fingerprint: "pymol-oss-mvp-selection-v1" } as const;
const UNIT_CELL_PROFILE = { id: "canonical-unit-cell-membership", version: "1", fingerprint: "canonical-unit-cell-membership-v1" } as const;
const CHEMISTRY_ROLES_PROFILE = { id: "canonical-chemistry-roles", version: "1", fingerprint: "canonical-chemistry-roles-v1" } as const;
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
    if (char === "!" && query[cursor + 1] === "=") { cursor += 2; tokens.push({ kind: "OPERATOR", lexeme: "!=", span: spanAt(query, start, cursor) }); continue; }
    if (char === "=" || char === "!" || char === "&" || char === "|" || char === "<" || char === ">") { cursor += 1; if ((char === "<" || char === ">") && query[cursor] === "=") cursor += 1; tokens.push({ kind: "OPERATOR", lexeme: query.slice(start, cursor), span: spanAt(query, start, cursor) }); continue; }
    if (char === "\"" || char === "'") {
      const quote = char; cursor += 1; let value = ""; let closed = false;
      while (cursor < query.length) { const next = query[cursor++]; if (next === "\\" && cursor < query.length) { value += query[cursor++]; continue; } if (next === quote) { closed = true; break; } value += next; }
      const span = spanAt(query, start, cursor);
      if (!closed) diagnostics.push({ code: "SYNTAX_ERROR", message: "Unterminated quoted value.", span });
      tokens.push({ kind: "STRING", lexeme: value, span }); continue;
    }
    while (cursor < query.length && !/\s/.test(query[cursor]) && !/[(),!&|=]/.test(query[cursor])) cursor += 1;
    tokens.push({ kind: "WORD", lexeme: query.slice(start, cursor), span: spanAt(query, start, cursor) });
  }
  tokens.push({ kind: "EOF", lexeme: "", span: spanAt(query, query.length, query.length) });
  return { tokens, diagnostics };
};

const isWord = (token: SelectionToken | undefined, value?: string): boolean => token?.kind === "WORD" && (value === undefined || token.lexeme.toLowerCase() === value);
const propertyNames = new Set<SelectionProperty>(["name", "resn", "resi", "chain", "segi", "elem", "id", "index", "rank", "model", "object", "alt", "formal_charge", "partial_charge", "b", "q", "occupancy", "ss", "x", "y", "z", "state", "label", "pepseq", "rep", "color", "cartoon_color", "ribbon_color"]);
const categoryNames = new Map<string, SelectionCategory>([
  ["polymer", "polymer"], ["protein", "protein"], ["polymer.protein", "protein"], ["nucleic", "nucleic"], ["polymer.nucleic", "nucleic"], ["ligand", "ligand"], ["organic", "ligand"], ["water", "water"], ["solvent", "solvent"], ["ion", "ion"], ["ions", "ion"], ["inorganic", "inorganic"], ["hetatm", "hetatm"], ["hydrogens", "hydrogen"], ["hydrogen", "hydrogen"], ["hydro", "hydrogen"], ["backbone", "backbone"], ["sidechain", "sidechain"], ["guide", "guide"], ["metals", "metals"], ["bonded", "bonded"], ["donors", "donors"], ["acceptors", "acceptors"], ["enabled", "enabled"], ["present", "present"], ["visible", "visible"], ["other", "other"],
] as const);

class SelectionParser {
  private cursor = 0;
  readonly diagnostics: SelectionDiagnostic[] = [];
  constructor(private readonly query: string, private readonly tokens: readonly SelectionToken[]) {}
  private current() { return this.tokens[this.cursor]; }
  private take() { return this.tokens[this.cursor++]; }
  private fail(message: string, token = this.current()): never { const diagnostic = { code: "SYNTAX_ERROR" as const, message, span: token?.span }; this.diagnostics.push(diagnostic); throw new Error(message); }
  private failWith(code: SelectionDiagnostic["code"], message: string, token = this.current()): never { this.diagnostics.push({ code, message, span: token?.span }); throw new Error(message); }
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
      const implicitOr = !["in", "like", "or", "and", "within", "around", "expand", "near_to", "beyond", "gap", "extend", "of"].includes(word)
        && (token.kind === "LPAREN" || (token.kind === "OPERATOR" && token.lexeme === "!") || ((token.kind === "WORD" || token.kind === "STRING") && !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(token.lexeme)));
      const bindingPower = word === "or" || token.lexeme === "|" || implicitOr ? 10 : word === "and" || token.lexeme === "&" ? 20 : ["in", "like", "within", "around", "expand", "near_to", "beyond", "gap", "extend"].includes(word) ? 25 : -1;
      if (bindingPower < minBindingPower) break;
      if (word === "in" || word === "like") {
        this.take();
        left = { kind: "identifier_match", mode: word, left, right: this.expression(bindingPower + 1) }; continue;
      }
      if (word === "within" || word === "around" || word === "near_to" || word === "beyond") {
        this.take();
        const distance = this.distance();
        if (this.current().lexeme.toLowerCase() === "of") this.take();
        left = { kind: word, distance, candidate: left, reference: this.expression(bindingPower + 1) }; continue;
      }
      if (word === "gap") {
        this.take();
        left = { kind: "gap", distance: this.distance(), reference: left }; continue;
      }
      if (word === "expand") {
        this.take();
        left = { kind: "expand", distance: this.distance(), reference: left }; continue;
      }
      if (word === "extend") {
        this.take();
        left = { kind: "extend", distance: this.distance(), operand: left }; continue;
      }
      if (!implicitOr) this.take();
      if (implicitOr) {
        left = { kind: "or", left, right: this.expression(bindingPower + 1) }; continue;
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
    if (["byobject", "bysegi", "byres", "bychain", "bycalpha", "bymolecule", "byfragment", "byring", "bycell"].includes(word)) return { kind: word as "byobject" | "bysegi" | "byres" | "bychain" | "bycalpha" | "bymolecule" | "byfragment" | "byring" | "bycell", operand: this.expression(0) };
    if (word === "first" || word === "last") return { kind: word, operand: this.expression(60) };
    if (word === "neighbor" || word === "bound_to" || word === "bound-to") return { kind: word === "bound-to" ? "bound_to" : word, operand: this.expression(35) };
    if (word === "extend") return { kind: "extend", distance: this.distance(), operand: this.expression(35) };
    if (word === "within" || word === "around") {
      const distance = this.distance();
      if (word === "within") this.expectWord("of"); else if (this.current().lexeme.toLowerCase() === "of") this.take();
      const reference = this.expression(35);
      return { kind: word, distance, reference };
    }
    if (word === "expand" || word === "near_to" || word === "beyond") {
      const distance = this.distance();
      if (this.current().lexeme.toLowerCase() === "of") this.take();
      return { kind: word, distance, reference: this.expression(35) };
    }
    if (word === "gap") {
      const distance = this.distance();
      if (this.current().lexeme.toLowerCase() === "of") this.take();
      return { kind: "gap", distance, reference: this.expression(35) };
    }
    if (word === "all" || word === "*" || word === "everything") return { kind: "all" };
    if (word === "none") return { kind: "none" };
    const category = categoryNames.get(word as "polymer" | "protein" | "ligand" | "organic" | "water" | "ion" | "ions" | "other");
    if (category) return { kind: "category", category, span: token.span };
    if (propertyNames.has(word as SelectionProperty)) {
      if (isWord(this.current(), "in") || isWord(this.current(), "like")) this.fail(`Identifier matching requires two selection expressions; \`${word} ${this.current().lexeme}\` is not a property value.`);
      let operator: "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE" = "EQ";
      if (this.current().kind === "OPERATOR" && ["=", "!=", "<", "<=", ">", ">="].includes(this.current().lexeme)) { const operatorToken = this.take().lexeme; operator = operatorToken === "!=" ? "NE" : operatorToken === "<" ? "LT" : operatorToken === "<=" ? "LTE" : operatorToken === ">" ? "GT" : operatorToken === ">=" ? "GTE" : "EQ"; }
      const value = this.take();
      if (!value || value.kind === "EOF" || value.kind === "RPAREN") this.fail(`Property \`${word}\` requires a value.`, value);
      return { kind: "predicate", property: word as SelectionProperty, operator, value: value.lexeme, span: token.span };
    }
    if (token.kind === "STRING" || token.kind === "WORD") {
      if (token.lexeme.startsWith("%")) return { kind: "named", name: token.lexeme.slice(1), required: true, span: token.span };
      if (token.lexeme.startsWith("?") && token.lexeme.length > 1) return { kind: "named", name: token.lexeme.slice(1), required: false, span: token.span };
      const infixOperator = ["in", "like", "or", "and", "within", "around", "expand", "near_to", "beyond", "gap", "extend", "of"].includes(this.current().lexeme.toLowerCase());
      if (this.current().kind === "WORD" && !infixOperator && !/^-?\d+(?:\.\d+)?$/.test(this.current().lexeme)) this.failWith("UNKNOWN_PROPERTY", `Unknown property or malformed selector \`${token.lexeme}\`.`, token);
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
  const cached = selectionParseCache.get(query);
  if (cached) return cached;
  const lexical = lexSelection(query);
  if (lexical.diagnostics.length > 0) {
    const result = { ast: null, tokens: lexical.tokens, diagnostics: lexical.diagnostics };
    selectionParseCache.set(query, result);
    return result;
  }
  const parser = new SelectionParser(query, lexical.tokens);
  let result: { ast: SelectionAst | null; tokens: readonly SelectionToken[]; diagnostics: readonly SelectionDiagnostic[] };
  try { result = { ast: parser.parse(), tokens: lexical.tokens, diagnostics: parser.diagnostics }; }
  catch { result = { ast: null, tokens: lexical.tokens, diagnostics: parser.diagnostics }; }
  selectionParseCache.set(query, result);
  return result;
};

const selectionParseCache = new Map<string, { ast: SelectionAst | null; tokens: readonly SelectionToken[]; diagnostics: readonly SelectionDiagnostic[] }>();

const normalize = (ast: SelectionAst): SelectionAst => {
  if (ast.kind === "and" || ast.kind === "or") return { ...ast, left: normalize(ast.left), right: normalize(ast.right) };
  if (ast.kind === "not" || ast.kind === "byobject" || ast.kind === "bysegi" || ast.kind === "byres" || ast.kind === "bychain" || ast.kind === "bycalpha" || ast.kind === "bymolecule" || ast.kind === "byfragment" || ast.kind === "byring" || ast.kind === "bycell" || ast.kind === "first" || ast.kind === "last" || ast.kind === "neighbor" || ast.kind === "bound_to" || ast.kind === "extend") return { ...ast, operand: normalize(ast.operand) };
  if (ast.kind === "identifier_match") return { ...ast, left: normalize(ast.left), right: normalize(ast.right) };
  if (ast.kind === "within" || ast.kind === "around" || ast.kind === "expand" || ast.kind === "near_to" || ast.kind === "beyond" || ast.kind === "gap") return { ...ast, reference: normalize(ast.reference), ...(ast.candidate ? { candidate: normalize(ast.candidate) } : {}) };
  if (ast.kind === "predicate") return { ...ast, property: ast.property.toLowerCase() as SelectionProperty, value: ast.value.trim() };
  if (ast.kind === "named") return { ...ast, name: ast.name.trim() };
  return ast;
};
const serialize = (ast: SelectionAst): string => {
  if (ast.kind === "all" || ast.kind === "none") return ast.kind;
  if (ast.kind === "category") return ast.category;
  if (ast.kind === "named") return `${ast.required ? "%" : "?"}${ast.name}`;
  if (ast.kind === "predicate") return `${ast.property}${ast.operator === "EQ" ? "=" : ast.operator === "NE" ? "!=" : ast.operator === "LT" ? "<" : ast.operator === "LTE" ? "<=" : ast.operator === "GT" ? ">" : ">="}${JSON.stringify(ast.value)}`;
  if (ast.kind === "not") return `not(${serialize(ast.operand)})`;
  if (ast.kind === "and" || ast.kind === "or") return `(${serialize(ast.left)} ${ast.kind} ${serialize(ast.right)})`;
  if (ast.kind === "extend") return `extend(${ast.distance},${serialize(ast.operand)})`;
  if (ast.kind === "byobject" || ast.kind === "bysegi" || ast.kind === "byres" || ast.kind === "bychain" || ast.kind === "bycalpha" || ast.kind === "bymolecule" || ast.kind === "byfragment" || ast.kind === "byring" || ast.kind === "bycell" || ast.kind === "first" || ast.kind === "last" || ast.kind === "neighbor" || ast.kind === "bound_to") return `${ast.kind}(${serialize(ast.operand)})`;
  if (ast.kind === "identifier_match") return `${ast.kind}:${ast.mode}(${serialize(ast.left)},${serialize(ast.right)})`;
  if (ast.kind === "within" || ast.kind === "around" || ast.kind === "expand" || ast.kind === "near_to" || ast.kind === "beyond" || ast.kind === "gap") return `${ast.kind}(${ast.distance},${serialize(ast.reference)}${ast.candidate ? `,${serialize(ast.candidate)}` : ""})`;
  return "invalid";
};

type EvalContext = { universe: Set<string>; diagnostics: SelectionDiagnostic[]; needsCoordinates: boolean; needsTopology: boolean; needsPresentation: boolean; presentationRevision: string | null; scientificProfiles: ScientificSelectionProfile[]; peptideSelectionMatches: Map<string, Set<string>>; visibleAtomIds?: ReadonlySet<string>; representationTokensByStableAtomId?: Readonly<Record<string, readonly string[]>>; colorTokensByStableAtomId?: Readonly<Record<string, readonly string[]>>; representationColorTokensByStableAtomId?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>; labelTokensByStableAtomId?: Readonly<Record<string, readonly string[]>>; named?: NamedSelectionStore; groups?: readonly SelectionWorkspaceGroup[]; query: string; indexByStableId: Map<string, number>; rankByStableId: Map<string, number>; coordinateStateId?: string; stateOrdinal?: number; coordinateFramePolicy?: CoordinateFramePolicy; coordinateObjectIds: Set<string>; coordinateObjectStates: Map<string, SelectionCoordinateStateScope>; objectMatches: Map<string, Set<string>> };
const recordScientificProfile = (context: EvalContext, profile: ScientificSelectionProfile): void => {
  if (!context.scientificProfiles.some((candidate) => candidate.fingerprint === profile.fingerprint)) context.scientificProfiles.push(profile);
};
const wildcardMatch = (value: string, pattern: string): boolean => {
  const escaped = [...pattern].map((char) => char === "*" ? ".*" : char === "?" ? "." : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
  return new RegExp(`^${escaped}$`, "i").test(value);
};
const residueParts = (value: string): { number: number; insertion: string } | null => { const match = value.match(/^(-?\d+)([A-Za-z]?)$/); return match ? { number: Number(match[1]), insertion: match[2].toUpperCase() } : null; };
const residueIdFor = (atom: CanonicalAtom): string => {
  const scoped = atom.workspaceObjectId && atom.stableId.startsWith(`${atom.workspaceObjectId}::`);
  return `${scoped ? `${atom.workspaceObjectId}::` : ""}chain:${atom.chain}:residue:${atom.residueNumber}:${atom.insertionCode ?? ""}`;
};
const peptideSelectionAtomIdsFor = (value: string, structure: CanonicalMolecularStructure, context: EvalContext): Set<string> => {
  const cached = context.peptideSelectionMatches.get(value);
  if (cached) return cached;
  const matches = new Set<string>();
  const normalized = value.trim().toUpperCase();
  if (!/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(normalized)) {
    context.diagnostics.push({ code: "INVALID_VALUE", message: "pepseq requires a non-empty one-letter amino-acid sequence." });
    context.peptideSelectionMatches.set(value, matches);
    return matches;
  }
  const dataset = structure.peptideSequenceDataset;
  if (!dataset || dataset.molecularRevision !== structure.scientificHash) {
    context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical pepseq data is unavailable for this molecular revision." });
    context.peptideSelectionMatches.set(value, matches);
    return matches;
  }
  const matchedResidues = new Set<string>();
  for (const chain of Object.values(dataset.chains)) {
    for (let start = 0; start <= chain.sequence.length - normalized.length; start += 1) {
      if (chain.sequence.slice(start, start + normalized.length) !== normalized) continue;
      for (const residueId of chain.residueIds.slice(start, start + normalized.length)) matchedResidues.add(residueId);
    }
  }
  for (const atom of structure.atoms) if (matchedResidues.has(residueIdFor(atom))) matches.add(atom.stableId);
  context.peptideSelectionMatches.set(value, matches);
  return matches;
};
const residueMatch = (atom: CanonicalAtom, value: string): boolean => {
  const range = value.match(/^(-?\d+[A-Za-z]?)(?:-|:)(-?\d+[A-Za-z]?)$/);
  const current = { number: atom.residueNumber, insertion: (atom.insertionCode ?? "").toUpperCase() };
  if (range) { const low = residueParts(range[1]); const high = residueParts(range[2]); if (!low || !high) return false; const cmp = (a: typeof current, b: typeof current) => a.number === b.number ? a.insertion.localeCompare(b.insertion) : a.number - b.number; return cmp(current, low) >= 0 && cmp(current, high) <= 0; }
  const exact = residueParts(value); return !!exact && current.number === exact.number && current.insertion === exact.insertion;
};
const atomCategory = (atom: CanonicalAtom): "polymer" | "ligand" | "water" | "ion" | "other" => atom.isPolymer ? "polymer" : atom.isLigand ? "ligand" : atom.isWater ? "water" : atom.isIon ? "ion" : "other";
const backboneNames = new Set(["N", "CA", "C", "O", "OXT"]);
const metalElements = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI"]);
const normalizedPresentationToken = (value: string): string => value.trim().toLowerCase().replaceAll("_", "-");
const representationAliases = (value: string): readonly string[] => {
  const normalized = normalizedPresentationToken(value);
  const aliases: Record<string, readonly string[]> = {
    line: ["line", "lines"], lines: ["line", "lines"],
    stick: ["stick", "sticks"], sticks: ["stick", "sticks"],
    sphere: ["sphere", "spheres", "space-filling"], spheres: ["sphere", "spheres", "space-filling"], "space-filling": ["sphere", "spheres", "space-filling"],
    cartoon: ["cartoon"], ribbon: ["ribbon"], trace: ["trace"], putty: ["putty"],
    "ball-and-stick": ["ball-and-stick", "ball&stick"], "ball&stick": ["ball-and-stick", "ball&stick"], licorice: ["licorice"],
    surface: ["surface", "van-der-waals-surface"], "van-der-waals-surface": ["surface", "van-der-waals-surface"],
    mesh: ["mesh"], dots: ["dots", "dot-surface"], "dot-surface": ["dots", "dot-surface"],
    nonbonded: ["nonbonded", "nonbonded-crosses"], "nonbonded-crosses": ["nonbonded", "nonbonded-crosses"],
    "nonbonded-spheres": ["nonbonded-spheres"],
  };
  return aliases[normalized] ?? [normalized];
};
const presentationTokensMatch = (tokens: readonly string[] | undefined, value: string, aliases = false): boolean => {
  if (!tokens) return false;
  const requested = aliases ? representationAliases(value) : [normalizedPresentationToken(value)];
  return requested.some((candidate) => tokens.some((token) => wildcardMatch(token, candidate)));
};
type CanonicalTopologyGraph = { adjacency: Map<string, Set<string>>; componentByAtom: Map<string, string> };
const canonicalTopologyGraphFor = (structure: CanonicalMolecularStructure): CanonicalTopologyGraph => {
  const atomIds = new Set(structure.atoms.map((atom) => atom.stableId));
  const adjacency = new Map<string, Set<string>>();
  for (const atomId of atomIds) adjacency.set(atomId, new Set());
  for (const bond of structure.bonds) {
    if (!atomIds.has(bond.atom1) || !atomIds.has(bond.atom2)) continue;
    adjacency.get(bond.atom1)!.add(bond.atom2);
    adjacency.get(bond.atom2)!.add(bond.atom1);
  }
  const componentByAtom = new Map<string, string>();
  for (const atom of structure.atoms) {
    if (componentByAtom.has(atom.stableId)) continue;
    const componentId = atom.stableId;
    const stack = [atom.stableId];
    componentByAtom.set(atom.stableId, componentId);
    while (stack.length) {
      const current = stack.pop()!;
      for (const next of adjacency.get(current) ?? []) {
        if (!componentByAtom.has(next)) { componentByAtom.set(next, componentId); stack.push(next); }
      }
    }
  }
  return { adjacency, componentByAtom };
};
/**
 * Returns atoms belonging to canonical simple cycles of size 3..7.  The
 * minimum-ordered atom is used as the DFS root to deduplicate cycles; a path
 * budget keeps malformed or very dense source graphs from blocking selection.
 */
const canonicalRingsFor = (structure: CanonicalMolecularStructure, context: EvalContext): Set<string>[] | null => {
  context.needsTopology = true;
  if (structure.bonds.length === 0) {
    context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical bond topology is unavailable; ring membership cannot be established." });
    return null;
  }
  const graph = canonicalTopologyGraphFor(structure);
  const order = new Map(structure.atoms.map((atom, index) => [atom.stableId, index]));
  const rings: Set<string>[] = [];
  const cycleKeys = new Set<string>();
  const maxPaths = 250_000;
  let exploredPaths = 0;
  let budgetExceeded = false;
  const visit = (start: string, current: string, path: string[]) => {
    if (budgetExceeded) return;
    exploredPaths += 1;
    if (exploredPaths > maxPaths) { budgetExceeded = true; return; }
    for (const next of graph.adjacency.get(current) ?? []) {
      if (next === start) {
        if (path.length >= 3 && path.length <= 7) {
          const key = [...path].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)).join("\u0000");
          if (!cycleKeys.has(key)) { cycleKeys.add(key); rings.push(new Set(path)); }
        }
        continue;
      }
      if (path.length >= 7 || path.includes(next) || (order.get(next) ?? Number.MAX_SAFE_INTEGER) < (order.get(start) ?? Number.MAX_SAFE_INTEGER)) continue;
      visit(start, next, [...path, next]);
    }
  };
  for (const atom of structure.atoms) {
    if (budgetExceeded) break;
    for (const next of graph.adjacency.get(atom.stableId) ?? []) {
      if ((order.get(next) ?? Number.MAX_SAFE_INTEGER) > (order.get(atom.stableId) ?? Number.MAX_SAFE_INTEGER)) visit(atom.stableId, next, [atom.stableId, next]);
    }
  }
  if (budgetExceeded) {
    context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical ring search exceeded its bounded cycle budget; ring membership was not returned." });
    return null;
  }
  return rings;
};
const fractionalCellCoordinatesFor = (atom: CanonicalAtom, cell: CanonicalUnitCell): [number, number, number] | null => {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const alpha = toRadians(cell.alpha);
  const beta = toRadians(cell.beta);
  const gamma = toRadians(cell.gamma);
  const sinGamma = Math.sin(gamma);
  if (Math.abs(sinGamma) < 1e-10) return null;
  const cosAlpha = Math.cos(alpha);
  const cosBeta = Math.cos(beta);
  const cosGamma = Math.cos(gamma);
  const by = cell.b * sinGamma;
  const czSquared = cell.c * cell.c - Math.pow(cell.c * (cosBeta), 2) - Math.pow(cell.c * (cosAlpha - cosBeta * cosGamma) / sinGamma, 2);
  if (by <= 0 || czSquared <= 1e-10) return null;
  const zFraction = (atom.z - 0) / Math.sqrt(czSquared);
  const yFraction = (atom.y - cell.c * (cosAlpha - cosBeta * cosGamma) / sinGamma * zFraction) / by;
  const xFraction = (atom.x - cell.b * cosGamma * yFraction - cell.c * cosBeta * zFraction) / cell.a;
  return [xFraction, yFraction, zFraction];
};
const fractionalCellKeyFor = (atom: CanonicalAtom, cell: CanonicalUnitCell): string | null => {
  const fractional = fractionalCellCoordinatesFor(atom, cell);
  return fractional ? fractional.map((value) => Math.floor(value)).join(",") : null;
};
const scopedFractionalCellKeyFor = (atom: CanonicalAtom, structure: CanonicalMolecularStructure): string | null => {
  const cell = structure.unitCell ?? atom.workspaceUnitCell;
  const key = cell ? fractionalCellKeyFor(atom, cell) : null;
  return key ? `${atom.workspaceObjectId ?? structure.id}\u0000${key}` : null;
};
const coordinateStateScopeFor = (atom: CanonicalAtom, structure: CanonicalMolecularStructure, context: EvalContext): SelectionCoordinateStateScope => {
  const objectId = atom.workspaceObjectId ?? structure.id;
  const stateId = atom.workspaceCoordinateStateId ?? context.coordinateStateId ?? structure.stateOrder?.[0] ?? structure.coordinateStates?.[0]?.id ?? `${structure.id}:state:1`;
  const ordinal = atom.workspaceStateOrdinal
    ?? context.stateOrdinal
    ?? structure.coordinateStates?.find((state) => state.id === stateId)?.ordinal
    ?? Math.max(1, structure.stateOrder?.indexOf(stateId) === undefined ? 1 : (structure.stateOrder.indexOf(stateId) + 1));
  return { objectId, stateId, ordinal };
};
const recordCoordinateAtom = (atom: CanonicalAtom, structure: CanonicalMolecularStructure, context: EvalContext): void => {
  const scope = coordinateStateScopeFor(atom, structure, context);
  context.coordinateObjectIds.add(scope.objectId);
  context.coordinateObjectStates.set(scope.objectId, scope);
};
const canonicalPolymerTypingComplete = (structure: CanonicalMolecularStructure): boolean => Boolean(structure.polymerTypingSource) && structure.atoms.filter((atom) => atom.isPolymer).every((atom) => atom.polymerType !== undefined);
const categoryMatches = (atom: CanonicalAtom, category: SelectionCategory, structure: CanonicalMolecularStructure, context: EvalContext): boolean => {
  if (category === "enabled") return atom.workspaceObjectEnabled ?? true;
  if (category === "present") { context.needsCoordinates = true; recordCoordinateAtom(atom, structure, context); return true; }
  if (category === "visible") {
    context.needsPresentation = true;
    if (!context.visibleAtomIds) { context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Presentation visibility is not bound into this selection context." }); return false; }
    return context.visibleAtomIds.has(atom.stableId);
  }
  if (category === "polymer") return atom.isPolymer;
  if (category === "protein") {
    if (structure.polymerTypingSource) {
      if (!canonicalPolymerTypingComplete(structure)) {
        if (!context.diagnostics.some((diagnostic) => diagnostic.code === "MISSING_DEPENDENCY")) context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical protein-versus-nucleic polymer typing is incomplete for this molecular revision." });
        return false;
      }
      return atom.isPolymer && atom.polymerType === "PROTEIN";
    }
    return atom.isPolymer;
  }
  if (category === "nucleic") {
    const typingComplete = canonicalPolymerTypingComplete(structure);
    if (!typingComplete) {
      if (!context.diagnostics.some((diagnostic) => diagnostic.code === "MISSING_DEPENDENCY")) context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical nucleic-versus-protein polymer typing is unavailable for this molecular revision." });
      return false;
    }
    return atom.isPolymer && atom.polymerType === "NUCLEIC_ACID";
  }
  if (category === "ligand") return atom.isLigand;
  if (category === "water" || category === "solvent") return atom.isWater;
  if (category === "ion" || category === "inorganic") return atom.isIon;
  if (category === "other") return atomCategory(atom) === "other";
  if (category === "hydrogen") return atom.element.toUpperCase() === "H";
  if (category === "hetatm") return atom.recordType === "HETATM";
  if (category === "backbone") return atom.isPolymer && backboneNames.has(atom.atomName.toUpperCase());
  if (category === "sidechain") return atom.isPolymer && !backboneNames.has(atom.atomName.toUpperCase());
  if (category === "guide") return atom.isPolymer && atom.atomName.toUpperCase() === "CA";
  if (category === "metals") return atom.isIon && metalElements.has(atom.element.toUpperCase());
  if (category === "bonded") { context.needsTopology = true; return structure.bonds.some((bond) => bond.atom1 === atom.stableId || bond.atom2 === atom.stableId); }
  if (category === "donors" || category === "acceptors") {
    context.needsTopology = true;
    recordScientificProfile(context, CHEMISTRY_ROLES_PROFILE);
    if (!canonicalChemistryRolesDatasetComplete(structure)) {
      if (!context.diagnostics.some((diagnostic) => diagnostic.code === "MISSING_DEPENDENCY")) context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Complete revision-matched canonical chemistry-role data is unavailable for donor/acceptor selection." });
      return false;
    }
    const atomIds = category === "donors" ? structure.chemistryDataset!.donorAtomIds : structure.chemistryDataset!.acceptorAtomIds;
    return atomIds.includes(atom.stableId);
  }
  return false;
};
type SelectionOperator = "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE";
const predicateMatches = (atom: CanonicalAtom, property: SelectionProperty, operator: SelectionOperator, value: string, structure: CanonicalMolecularStructure, context: EvalContext): boolean => {
  if (property === "segi" && !structure.atoms.some((atom) => atom.segmentId)) {
    if (!context.diagnostics.some((diagnostic) => diagnostic.code === "UNSUPPORTED_OPERATOR_OR_PROFILE")) context.diagnostics.push({ code: "UNSUPPORTED_OPERATOR_OR_PROFILE", message: "Segment identity is not present in the current canonical structure." });
    return false;
  }
  if (["rep", "color", "cartoon_color", "ribbon_color", "label"].includes(property)) {
    context.needsPresentation = true;
    if (!context.presentationRevision) {
      context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Presentation state is not bound into this selection context." });
      return false;
    }
    const representationTokens = context.representationTokensByStableAtomId?.[atom.stableId];
    const colorTokens = context.colorTokensByStableAtomId?.[atom.stableId];
    const representationColorTokens = context.representationColorTokensByStableAtomId?.[atom.stableId];
    const labelTokens = context.labelTokensByStableAtomId?.[atom.stableId];
    const matches = property === "rep"
      ? presentationTokensMatch(representationTokens, value, true)
      : property === "color"
        ? presentationTokensMatch(colorTokens, value)
        : property === "label"
          ? presentationTokensMatch(labelTokens, value)
          : presentationTokensMatch(representationColorTokens?.[property === "cartoon_color" ? "CARTOON" : "RIBBON"], value);
    if (operator === "NE") return !matches;
    if (operator !== "EQ") {
      context.diagnostics.push({ code: "INVALID_VALUE", message: `${property} only supports equality and inequality matching.` });
      return false;
    }
    return matches;
  }
  const markInvalid = (message: string) => { if (!context.diagnostics.some((diagnostic) => diagnostic.code === "INVALID_VALUE" && diagnostic.message === message)) context.diagnostics.push({ code: "INVALID_VALUE", message }); };
  if ((property === "index" && (!/^\d+$/.test(value) || Number(value) < 1)) || (property === "rank" && (!/^\d+$/.test(value) || Number(value) < 0))) { markInvalid(`${property} requires a non-negative integer with ${property === "index" ? "one-based" : "zero-based"} semantics.`); return false; }
  if (property === "resi" && !/^-?\d+[A-Za-z]?(?:[-:]-?\d+[A-Za-z]?)?$/.test(value)) { markInvalid(`Residue selector \`${value}\` is not an integer, insertion-aware value, or range.`); return false; }
  let matches = false;
  if (property === "name") matches = wildcardMatch(atom.atomName, value);
  else if (property === "resn") matches = wildcardMatch(atom.residueName, value);
  else if (property === "resi") matches = residueMatch(atom, value);
  else if (property === "chain") matches = wildcardMatch(atom.chain, value);
  else if (property === "segi") matches = wildcardMatch(atom.segmentId ?? "", value);
  else if (property === "elem") matches = wildcardMatch(atom.element, value);
  else if (property === "alt") matches = wildcardMatch(atom.altLoc ?? "", value);
  else if (property === "id") matches = atom.stableId === value || String(atom.serial) === value;
  else if (property === "index") matches = context.indexByStableId.get(atom.stableId) === Number(value);
  else if (property === "rank") matches = context.rankByStableId.get(atom.stableId) === Number(value);
  else if (property === "model" || property === "object") {
    if (atom.workspaceObjectId) {
      let matchingObjects = context.objectMatches.get(value);
      if (!matchingObjects) {
        matchingObjects = new Set(structure.atoms.filter((candidate) => candidate.workspaceObjectId && (wildcardMatch(candidate.workspaceObjectId, value) || wildcardMatch(candidate.workspaceObjectId.replace(/^object:/i, ""), value) || wildcardMatch(candidate.workspaceObjectName ?? "", value))).map((candidate) => candidate.workspaceObjectId!));
        context.objectMatches.set(value, matchingObjects);
      }
      const exactObjectId = wildcardMatch(atom.workspaceObjectId, value) || wildcardMatch(atom.workspaceObjectId.replace(/^object:/i, ""), value);
      if (matchingObjects.size > 1 && !exactObjectId) {
        if (!context.diagnostics.some((diagnostic) => diagnostic.code === "AMBIGUOUS_NAME")) context.diagnostics.push({ code: "AMBIGUOUS_NAME", message: `Object name \`${value}\` resolves to multiple workspace objects; use a durable ObjectID.` });
        return false;
      }
      matches = exactObjectId || wildcardMatch(atom.workspaceObjectName ?? "", value);
    } else matches = wildcardMatch(structure.id, value) || wildcardMatch(structure.name, value) || wildcardMatch(structure.source.originalFilename, value);
  }
  else if (["b", "q", "occupancy", "formal_charge", "partial_charge", "x", "y", "z", "state"].includes(property)) {
    context.needsCoordinates = true;
    recordCoordinateAtom(atom, structure, context);
    const chargeDataset = structure.partialChargeDataset;
    if (property === "partial_charge" && !canonicalPartialChargeDatasetComplete(structure)) {
      if (!context.diagnostics.some((diagnostic) => diagnostic.code === "MISSING_DEPENDENCY")) context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Complete revision-matched canonical partial_charge data is unavailable for this selection context." });
      return false;
    }
    const numeric = property === "b"
      ? atom.bFactor
      : property === "q" || property === "occupancy"
        ? atom.occupancy
        : property === "formal_charge"
          ? atom.formalCharge
          : property === "partial_charge"
            ? chargeDataset!.atomChargeMap[atom.stableId]
            : property === "x"
              ? atom.x
              : property === "y"
                ? atom.y
                : property === "z"
                  ? atom.z
                  : property === "state"
                    ? atom.workspaceStateOrdinal ?? context.stateOrdinal
                    : undefined;
    const requested = Number(value);
    if (!Number.isFinite(requested)) { markInvalid(`${property} requires a finite numeric value.`); return false; }
    if (numeric === undefined || numeric === null || !Number.isFinite(numeric)) { if (property === "partial_charge" || property === "state" || !context.diagnostics.some((diagnostic) => diagnostic.code === "MISSING_DEPENDENCY")) context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: `Canonical ${property} data is unavailable for this selection context.` }); return false; }
    matches = operator === "EQ" ? numeric === requested : operator === "NE" ? numeric !== requested : operator === "LT" ? numeric < requested : operator === "LTE" ? numeric <= requested : operator === "GT" ? numeric > requested : numeric >= requested;
  } else if (property === "ss") {
    if (!atom.secondaryStructure) { context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical secondary-structure data is unavailable for this molecular revision." }); return false; }
    matches = wildcardMatch(atom.secondaryStructure, value);
  } else if (property === "pepseq") {
    matches = peptideSelectionAtomIdsFor(value, structure, context).has(atom.stableId);
  }
  else { context.diagnostics.push({ code: "UNKNOWN_PROPERTY", message: `Unknown canonical property: ${property}.` }); return false; }
  if (["EQ", "NE"].includes(operator)) return operator === "NE" ? !matches : matches;
  if (["name", "resn", "chain", "segi", "elem", "alt", "id", "model", "object", "ss", "rep", "color", "cartoon_color", "ribbon_color", "label"].includes(property)) { context.diagnostics.push({ code: "INVALID_VALUE", message: `${property} only supports equality and inequality matching.` }); return false; }
  return matches;
};
const evaluateAst = (ast: SelectionAst, structure: CanonicalMolecularStructure, context: EvalContext): Set<string> => {
  const all = () => new Set(context.universe);
  if (ast.kind === "all") return all();
  if (ast.kind === "none") return new Set();
  if (ast.kind === "category") return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && categoryMatches(atom, ast.category, structure, context)).map((atom) => atom.stableId));
  if (ast.kind === "predicate") return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && predicateMatches(atom, ast.property, ast.operator, ast.value, structure, context)).map((atom) => atom.stableId));
  if (ast.kind === "named") {
    const named = context.named?.get(ast.name);
    if (named) return new Set(named.stableAtomIds.filter((id) => context.universe.has(id)));
    const normalizedName = ast.name.toLowerCase();
    const objectIds = [...new Set(structure.atoms.filter((atom) => atom.workspaceObjectId && (atom.workspaceObjectId.toLowerCase() === normalizedName || atom.workspaceObjectId.replace(/^object:/i, "").toLowerCase() === normalizedName || atom.workspaceObjectName?.toLowerCase() === normalizedName)).map((atom) => atom.workspaceObjectId!))];
    const matchingGroups = (context.groups ?? []).filter((group) => group.groupId.toLowerCase() === normalizedName || group.name.toLowerCase() === normalizedName);
    if (objectIds.length + matchingGroups.length > 1) {
      context.diagnostics.push({ code: "AMBIGUOUS_NAME", message: `Workspace name \`${ast.name}\` resolves to multiple objects or groups; use a durable ID or explicit named-selection syntax.` });
      return new Set();
    }
    if (objectIds.length === 1) return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && atom.workspaceObjectId === objectIds[0]).map((atom) => atom.stableId));
    if (matchingGroups.length === 1) {
      const members = new Set(matchingGroups[0]!.objectIds);
      return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && atom.workspaceObjectId && members.has(atom.workspaceObjectId)).map((atom) => atom.stableId));
    }
    if (ast.required) context.diagnostics.push({ code: "UNKNOWN_NAME", message: `Named selection \`${ast.name}\` does not exist.` });
    return new Set();
  }
  if (ast.kind === "not") { const operand = evaluateAst(ast.operand, structure, context); return new Set([...context.universe].filter((id) => !operand.has(id))); }
  if (ast.kind === "and" || ast.kind === "or") { const left = evaluateAst(ast.left, structure, context); const right = evaluateAst(ast.right, structure, context); return ast.kind === "and" ? new Set([...left].filter((id) => right.has(id))) : new Set([...left, ...right]); }
  if (ast.kind === "first" || ast.kind === "last") {
    const operand = evaluateAst(ast.operand, structure, context);
    const ordered = structure.atoms.map((atom) => atom.stableId).filter((id) => operand.has(id));
    return new Set(ordered.length ? [ast.kind === "first" ? ordered[0]! : ordered[ordered.length - 1]!] : []);
  }
  if (ast.kind === "identifier_match") {
    const left = evaluateAst(ast.left, structure, context);
    const right = evaluateAst(ast.right, structure, context);
    const key = (atom: CanonicalAtom) => ast.mode === "in"
      ? [atom.atomName, atom.residueNumber, atom.insertionCode ?? "", atom.residueName, atom.chain, atom.segmentId ?? ""].join("\u0000")
      : [atom.atomName, atom.residueNumber, atom.insertionCode ?? ""].join("\u0000");
    const rightKeys = new Set(structure.atoms.filter((atom) => right.has(atom.stableId)).map(key));
    return new Set(structure.atoms.filter((atom) => left.has(atom.stableId) && rightKeys.has(key(atom))).map((atom) => atom.stableId));
  }
  if (ast.kind === "byobject" || ast.kind === "bymolecule" || ast.kind === "byfragment" || ast.kind === "byring" || ast.kind === "bycell" || ast.kind === "bysegi" || ast.kind === "byres" || ast.kind === "bychain" || ast.kind === "bycalpha") {
    const operand = evaluateAst(ast.operand, structure, context); const scope = (atom: CanonicalAtom) => `${atom.workspaceObjectId ?? structure.id}\u0000`; const groups = new Set(structure.atoms.filter((atom) => operand.has(atom.stableId)).map((atom) => ast.kind === "byobject" ? scope(atom) : ast.kind === "byres" || ast.kind === "bycalpha" ? `${scope(atom)}${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}` : ast.kind === "bysegi" ? `${scope(atom)}${atom.segmentId ?? ""}` : `${scope(atom)}${atom.chain}`));
    if (ast.kind === "byobject") return new Set(structure.atoms.filter((atom) => groups.has(scope(atom)) && context.universe.has(atom.stableId)).map((atom) => atom.stableId));
    if (ast.kind === "bycell") {
      context.needsCoordinates = true;
      recordScientificProfile(context, UNIT_CELL_PROFILE);
      if (!structure.unitCell && structure.atoms.some((atom) => !atom.workspaceUnitCell)) {
        context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical unit-cell parameters are unavailable; bycell was not evaluated." });
        return new Set();
      }
      const selectedCells = new Set<string>();
      for (const atom of structure.atoms) {
        recordCoordinateAtom(atom, structure, context);
        if (!operand.has(atom.stableId)) continue;
        const key = scopedFractionalCellKeyFor(atom, structure);
        if (!key) {
          context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical unit-cell parameters could not produce a valid fractional coordinate transform; bycell was not evaluated." });
          return new Set();
        }
        selectedCells.add(key);
      }
      const result = new Set<string>();
      for (const atom of structure.atoms) {
        if (!context.universe.has(atom.stableId)) continue;
        const key = scopedFractionalCellKeyFor(atom, structure);
        if (!key) {
          context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical unit-cell parameters could not produce a valid fractional coordinate transform; bycell was not evaluated." });
          return new Set();
        }
        if (selectedCells.has(key)) result.add(atom.stableId);
      }
      return result;
    }
    if (ast.kind === "bymolecule") {
      context.needsTopology = true;
      const { componentByAtom } = canonicalTopologyGraphFor(structure);
      const selectedComponents = new Set([...operand].map((id) => componentByAtom.get(id)).filter((id): id is string => Boolean(id)));
      return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && selectedComponents.has(componentByAtom.get(atom.stableId)!)).map((atom) => atom.stableId));
    }
    if (ast.kind === "byfragment") {
      context.needsTopology = true;
      const fragmentDataset = structure.fragmentDataset;
      if (!canonicalFragmentDatasetComplete(structure)) {
        context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Canonical fragment assignment data is unavailable or incomplete; byfragment was not evaluated." });
        return new Set();
      }
      const fragmentIdsByAtom = new Map(structure.atoms.map((atom) => [atom.stableId, fragmentDataset!.atomFragmentMap[atom.stableId]!.trim()]));
      const selectedFragments = new Set(structure.atoms.filter((atom) => operand.has(atom.stableId)).map((atom) => `${scope(atom)}${fragmentIdsByAtom.get(atom.stableId)!}`));
      return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && selectedFragments.has(`${scope(atom)}${fragmentIdsByAtom.get(atom.stableId)!}`)).map((atom) => atom.stableId));
    }
    if (ast.kind === "byring") {
      const rings = canonicalRingsFor(structure, context);
      if (!rings) return new Set();
      const selectedRingAtoms = new Set<string>();
      for (const ring of rings) if ([...ring].some((atomId) => operand.has(atomId))) for (const atomId of ring) selectedRingAtoms.add(atomId);
      return new Set(structure.atoms.filter((atom) => context.universe.has(atom.stableId) && selectedRingAtoms.has(atom.stableId)).map((atom) => atom.stableId));
    }
    if (ast.kind === "bysegi" && !structure.atoms.some((atom) => atom.segmentId)) { context.diagnostics.push({ code: "UNSUPPORTED_OPERATOR_OR_PROFILE", message: "Segment identity is not present in the current canonical structure." }); return new Set(); }
    if (ast.kind === "bycalpha") {
      const residues = new Set(structure.atoms.filter((atom) => operand.has(atom.stableId)).map((atom) => `${scope(atom)}${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}`));
      return new Set(structure.atoms.filter((atom) => atom.atomName.toUpperCase() === "CA" && residues.has(`${scope(atom)}${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}`) && context.universe.has(atom.stableId)).map((atom) => atom.stableId));
    }
    const groupKey = (atom: CanonicalAtom) => ast.kind === "byres" ? `${scope(atom)}${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}` : ast.kind === "bysegi" ? `${scope(atom)}${atom.segmentId ?? ""}` : `${scope(atom)}${atom.chain}`;
    return new Set(structure.atoms.filter((atom) => groups.has(groupKey(atom)) && context.universe.has(atom.stableId)).map((atom) => atom.stableId));
  }
  if (ast.kind === "neighbor" || ast.kind === "bound_to" || ast.kind === "extend") {
    context.needsTopology = true; if (!structure.bonds) { context.diagnostics.push({ code: "TOPOLOGY_CONTEXT_ERROR", message: "Topology is unavailable for neighbor expansion." }); return new Set(); }
    const target = evaluateAst(ast.operand, structure, context); const result = new Set<string>();
    if (ast.kind === "extend") {
      if (!Number.isInteger(ast.distance) || ast.distance < 0) { context.diagnostics.push({ code: "INVALID_VALUE", message: "Topology extension distance must be a non-negative integer." }); return new Set(); }
      let frontier = new Set(target);
      for (let step = 0; step < ast.distance; step += 1) {
        const next = new Set<string>();
        for (const bond of structure.bonds) {
          if (frontier.has(bond.atom1) && context.universe.has(bond.atom2)) next.add(bond.atom2);
          if (frontier.has(bond.atom2) && context.universe.has(bond.atom1)) next.add(bond.atom1);
        }
        for (const id of next) result.add(id);
        frontier = next;
      }
      for (const id of target) result.add(id);
      return result;
    }
    for (const bond of structure.bonds) { const first = target.has(bond.atom1); const second = target.has(bond.atom2); if (first && context.universe.has(bond.atom2)) result.add(bond.atom2); if (second && context.universe.has(bond.atom1)) result.add(bond.atom1); }
    if (ast.kind === "neighbor") for (const id of target) result.delete(id);
    return result;
  }
  if (ast.kind === "gap") {
    context.needsCoordinates = true;
    recordScientificProfile(context, VDW_RADIUS_PROFILE);
    if (ast.distance < 0 || !Number.isFinite(ast.distance)) { context.diagnostics.push({ code: "INVALID_VALUE", message: "VDW surface gap distance must be finite and non-negative." }); return new Set(); }
    const reference = evaluateAst(ast.reference, structure, context);
    const candidate = ast.candidate ? evaluateAst(ast.candidate, structure, context) : new Set(context.universe);
    const refAtoms = structure.atoms.filter((atom) => reference.has(atom.stableId));
    const candidateAtoms = structure.atoms.filter((atom) => candidate.has(atom.stableId));
    const referenceObjectIds = new Set(refAtoms.map((atom) => atom.workspaceObjectId ?? structure.id));
    const candidateObjectIds = new Set(candidateAtoms.map((atom) => atom.workspaceObjectId ?? structure.id));
    const coordinateObjectIds = new Set([...referenceObjectIds, ...candidateObjectIds]);
    for (const objectId of coordinateObjectIds) context.coordinateObjectIds.add(objectId);
    const crossesObjectBoundary = [...referenceObjectIds].some((referenceObjectId) => [...candidateObjectIds].some((candidateObjectId) => candidateObjectId !== referenceObjectId));
    if (crossesObjectBoundary && !context.coordinateFramePolicy) {
      context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Cross-object spatial selection requires an explicit LOCAL_SCIENTIFIC or EFFECTIVE_WORLD coordinate context." });
      return new Set();
    }
    for (const atom of [...refAtoms, ...candidateAtoms]) recordCoordinateAtom(atom, structure, context);
    const radiusByStableId = new Map<string, number>();
    for (const atom of [...refAtoms, ...candidateAtoms]) {
      const radius = vdwRadiusForElementStrict(atom.element);
      if (radius === null) {
        context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: `VDW radius for element \`${atom.element}\` is unavailable under profile ${VDW_RADIUS_PROFILE.id}@${VDW_RADIUS_PROFILE.version}; the gap result was not returned.` });
        return new Set();
      }
      radiusByStableId.set(atom.stableId, radius);
    }
    const result = new Set<string>();
    for (const atom of candidateAtoms) {
      if (reference.has(atom.stableId)) continue;
      const atomRadius = radiusByStableId.get(atom.stableId)!;
      const minimumGap = refAtoms.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...refAtoms.map((ref) => {
        const dx = atom.x - ref.x; const dy = atom.y - ref.y; const dz = atom.z - ref.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) - atomRadius - radiusByStableId.get(ref.stableId)!;
      }));
      if (beyondSurfaceGapBoundary(minimumGap, ast.distance)) result.add(atom.stableId);
    }
    return result;
  }
  if (ast.kind !== "within" && ast.kind !== "around" && ast.kind !== "expand" && ast.kind !== "near_to" && ast.kind !== "beyond") return new Set();
  context.needsCoordinates = true;
  if (ast.distance < 0 || !Number.isFinite(ast.distance)) { context.diagnostics.push({ code: "INVALID_VALUE", message: "Spatial distance must be finite and non-negative." }); return new Set(); }
  const reference = evaluateAst(ast.reference, structure, context); const candidate = ast.candidate ? evaluateAst(ast.candidate, structure, context) : new Set(context.universe); const refAtoms = structure.atoms.filter((atom) => reference.has(atom.stableId));
  const candidateAtoms = structure.atoms.filter((atom) => candidate.has(atom.stableId));
  const referenceObjectIds = new Set(refAtoms.map((atom) => atom.workspaceObjectId ?? structure.id));
  const candidateObjectIds = new Set(candidateAtoms.map((atom) => atom.workspaceObjectId ?? structure.id));
  const coordinateObjectIds = new Set([...referenceObjectIds, ...candidateObjectIds]);
  for (const objectId of coordinateObjectIds) context.coordinateObjectIds.add(objectId);
  const crossesObjectBoundary = [...referenceObjectIds].some((referenceObjectId) => [...candidateObjectIds].some((candidateObjectId) => candidateObjectId !== referenceObjectId));
  if (crossesObjectBoundary && !context.coordinateFramePolicy) {
    context.diagnostics.push({ code: "MISSING_DEPENDENCY", message: "Cross-object spatial selection requires an explicit LOCAL_SCIENTIFIC or EFFECTIVE_WORLD coordinate context." });
    return new Set();
  }
  for (const atom of [...refAtoms, ...candidateAtoms]) recordCoordinateAtom(atom, structure, context);
  const result = new Set<string>(); const radiusSquared = ast.distance * ast.distance;
  for (const atom of structure.atoms) {
    if (!candidate.has(atom.stableId)) continue;
    const inside = refAtoms.some((ref) => { const dx = atom.x - ref.x; const dy = atom.y - ref.y; const dz = atom.z - ref.z; return withinSpatialBoundary(dx * dx + dy * dy + dz * dz, radiusSquared); });
    if ((ast.kind === "within" || ast.kind === "expand") && inside) result.add(atom.stableId);
    if ((ast.kind === "around" || ast.kind === "near_to") && inside && !reference.has(atom.stableId)) result.add(atom.stableId);
    if (ast.kind === "beyond" && !inside) result.add(atom.stableId);
  }
  return result;
};

const resultId = (query: string, structure: CanonicalMolecularStructure, ids: readonly string[]) => hash(`${query}\u0000${structure.id}\u0000${structure.scientificHash}\u0000${ids.join("\u0000")}`);
const topologyRevisionFor = (structure: CanonicalMolecularStructure): string => hash(structure.bonds.map((bond) => `${bond.atom1}:${bond.atom2}:${bond.order}`).join("\u0000"));
const namespaceRevisionFor = (structure: CanonicalMolecularStructure, named?: NamedSelectionStore, groups?: readonly SelectionWorkspaceGroup[]): string => hash(JSON.stringify({
  atoms: structure.atoms.map((atom) => ({
    stableId: atom.stableId,
    atomName: atom.atomName,
    residueName: atom.residueName,
    residueNumber: atom.residueNumber,
    insertionCode: atom.insertionCode ?? "",
    chain: atom.chain,
    segmentId: atom.segmentId ?? "",
    workspaceObjectId: atom.workspaceObjectId ?? "",
    workspaceObjectName: atom.workspaceObjectName ?? "",
    workspaceObjectEnabled: atom.workspaceObjectEnabled ?? true,
    workspaceCoordinateStateId: atom.workspaceCoordinateStateId ?? "",
    workspaceStateOrdinal: atom.workspaceStateOrdinal ?? null,
    polymerType: atom.polymerType ?? null,
  })),
  polymerTypingSource: structure.polymerTypingSource ?? null,
  partialChargeDataset: structure.partialChargeDataset ? {
    datasetId: structure.partialChargeDataset.datasetId,
    molecularRevision: structure.partialChargeDataset.molecularRevision,
    chargeModel: structure.partialChargeDataset.chargeModel,
    profileVersion: structure.partialChargeDataset.profileVersion,
    atomChargeMap: structure.partialChargeDataset.atomChargeMap,
    units: structure.partialChargeDataset.units,
    provenance: structure.partialChargeDataset.provenance,
  } : null,
  peptideSequenceDataset: structure.peptideSequenceDataset ? {
    datasetId: structure.peptideSequenceDataset.datasetId,
    molecularRevision: structure.peptideSequenceDataset.molecularRevision,
    profileVersion: structure.peptideSequenceDataset.profileVersion,
    chains: structure.peptideSequenceDataset.chains,
  } : null,
  chemistryDataset: structure.chemistryDataset ? {
    datasetId: structure.chemistryDataset.datasetId,
    molecularRevision: structure.chemistryDataset.molecularRevision,
    profileVersion: structure.chemistryDataset.profileVersion,
    donorAtomIds: structure.chemistryDataset.donorAtomIds,
    acceptorAtomIds: structure.chemistryDataset.acceptorAtomIds,
    provenance: structure.chemistryDataset.provenance,
  } : null,
  fragmentDataset: structure.fragmentDataset ? {
    datasetId: structure.fragmentDataset.datasetId,
    molecularRevision: structure.fragmentDataset.molecularRevision,
    profileVersion: structure.fragmentDataset.profileVersion,
    atomFragmentMap: structure.fragmentDataset.atomFragmentMap,
    assignmentSource: structure.fragmentDataset.assignmentSource,
    provenance: structure.fragmentDataset.provenance,
  } : null,
  namedNamespaceRevision: named?.namespaceRevision ?? "none",
  workspaceGroups: groups?.map((group) => ({ groupId: group.groupId, name: group.name, objectIds: [...group.objectIds].sort() })).sort((left, right) => left.groupId.localeCompare(right.groupId)) ?? [],
}));
const coordinateContextFor = (structure: CanonicalMolecularStructure, needsCoordinates: boolean, framePolicy: CoordinateFramePolicy | undefined, objectIds: ReadonlySet<string>, stateScopes: ReadonlyMap<string, SelectionCoordinateStateScope>, coordinateStateId?: string, stateOrdinal?: number): SelectionCoordinateContext | null => {
  if (!needsCoordinates || (!framePolicy && objectIds.size > 1)) return null;
  const scopes = [...stateScopes.values()].sort((left, right) => left.objectId.localeCompare(right.objectId));
  const fallbackObjectIds = [...objectIds].sort();
  const resolvedScopes = scopes.length > 0 ? scopes : fallbackObjectIds.map((objectId) => ({ objectId, stateId: coordinateStateId ?? "active", ordinal: stateOrdinal ?? 1 }));
  return {
    structureId: structure.id,
    revision: structure.scientificHash,
    stateId: resolvedScopes.length === 1 ? resolvedScopes[0]!.stateId : "workspace-active",
    framePolicy: framePolicy ?? "LOCAL_SCIENTIFIC",
    objectIds: fallbackObjectIds,
    stateScopes: resolvedScopes,
  };
};
const baseResult = (query: string, structure: CanonicalMolecularStructure, source: SelectionProvenance, status: SelectionStatus, diagnostics: readonly SelectionDiagnostic[], astText: string, ids: readonly string[], deps: EvalContext, boundPlan: BoundSelectionPlan | null = null): SelectionResult => {
  const stableAtomIds = stableSort(ids, structure); const normalizedAstHash = hash(astText); const membershipHash = hash(stableAtomIds.join("\u0000"));
  const coordinateContext = coordinateContextFor(structure, deps.needsCoordinates, deps.coordinateFramePolicy, deps.coordinateObjectIds, deps.coordinateObjectStates, deps.coordinateStateId, deps.stateOrdinal);
  return { schemaVersion: 2, resultId: resultId(query, structure, stableAtomIds), source, query, grammarVersion: GRAMMAR_VERSION, normalizedAst: astText, normalizedAstHash, profile: PROFILE, molecularIdentity: { structureId: structure.id, molecularRevision: structure.scientificHash }, structureId: structure.id, molecularRevision: structure.scientificHash, objectScope: { kind: "structure", objectId: structure.id }, universeFingerprint: hash(structure.atoms.map((atom) => atom.stableId).join("\u0000")), coordinateContext, topologyRevision: deps.needsTopology ? topologyRevisionFor(structure) : null, namespaceRevision: namespaceRevisionFor(structure, deps.named, deps.groups), scientificProfiles: deps.scientificProfiles, presentationContext: deps.needsPresentation && deps.presentationRevision ? { revision: deps.presentationRevision } : null, stableAtomIds, membershipHash, count: stableAtomIds.length, status, diagnostics, dependencyVector: { needsCoordinates: deps.needsCoordinates, needsTopology: deps.needsTopology, needsNamespaces: true, needsPresentation: deps.needsPresentation }, boundPlan };
};

export type SelectionEvaluationOptions = { named?: NamedSelectionStore; groups?: readonly SelectionWorkspaceGroup[]; expectedRevision?: string; source?: SelectionProvenance; coordinateStateId?: string; stateOrdinal?: number; coordinateFrame?: CoordinateFramePolicy; presentation?: SelectionPresentationContext };
type CachedEvaluation = { normalized: string; ast: SelectionAst; ids: readonly string[]; status: SelectionStatus; diagnostics: readonly SelectionDiagnostic[]; needsCoordinates: boolean; needsTopology: boolean; needsPresentation: boolean; scientificProfiles: readonly ScientificSelectionProfile[]; coordinateFramePolicy?: CoordinateFramePolicy; coordinateObjectIds: readonly string[]; coordinateObjectStates: readonly SelectionCoordinateStateScope[] };
const selectionEvaluationCache = new Map<string, CachedEvaluation>();
const contextFor = (structure: CanonicalMolecularStructure, query: string, named?: NamedSelectionStore, diagnostics: SelectionDiagnostic[] = [], presentation?: SelectionPresentationContext, coordinateFramePolicy?: CoordinateFramePolicy, groups?: readonly SelectionWorkspaceGroup[]): EvalContext => ({
  universe: new Set(structure.atoms.map((atom) => atom.stableId)),
  diagnostics,
  needsCoordinates: false,
  needsTopology: false,
  needsPresentation: false,
  presentationRevision: presentation?.revision ?? null,
  scientificProfiles: [],
  peptideSelectionMatches: new Map(),
  visibleAtomIds: presentation ? new Set(presentation.visibleStableAtomIds) : undefined,
  representationTokensByStableAtomId: presentation?.representationTokensByStableAtomId,
  colorTokensByStableAtomId: presentation?.colorTokensByStableAtomId,
  representationColorTokensByStableAtomId: presentation?.representationColorTokensByStableAtomId,
  labelTokensByStableAtomId: presentation?.labelTokensByStableAtomId,
  named,
  groups,
  query,
  indexByStableId: new Map(structure.atoms.map((atom, index) => [atom.stableId, index + 1])),
  rankByStableId: new Map(structure.atoms.map((atom, index) => [atom.stableId, index])),
  coordinateFramePolicy,
  coordinateObjectIds: new Set(),
  coordinateObjectStates: new Map(),
  objectMatches: new Map(),
});

export type SelectionBindingDependencies = { needsCoordinates: boolean; needsTopology: boolean; needsPresentation: boolean; presentationRevision?: string | null; scientificProfiles?: readonly ScientificSelectionProfile[]; named?: NamedSelectionStore; groups?: readonly SelectionWorkspaceGroup[]; coordinateFramePolicy?: CoordinateFramePolicy; coordinateObjectIds?: readonly string[]; coordinateObjectStates?: readonly SelectionCoordinateStateScope[]; coordinateStateId?: string; stateOrdinal?: number };
export const bindSelectionPlan = (query: string, ast: SelectionAst, normalizedAst: string, structure: CanonicalMolecularStructure, dependencies: SelectionBindingDependencies): BoundSelectionPlan => ({
  schemaVersion: 1,
  query,
  ast,
  normalizedAst,
  structureId: structure.id,
  molecularRevision: structure.scientificHash,
  objectScope: { kind: "structure", objectId: structure.id },
  universeFingerprint: hash(structure.atoms.map((atom) => atom.stableId).join("\u0000")),
  coordinateContext: coordinateContextFor(structure, dependencies.needsCoordinates, dependencies.coordinateFramePolicy, new Set(dependencies.coordinateObjectIds ?? []), new Map((dependencies.coordinateObjectStates ?? []).map((scope) => [scope.objectId, scope])), dependencies.coordinateStateId, dependencies.stateOrdinal),
  topologyRevision: dependencies.needsTopology ? topologyRevisionFor(structure) : null,
  namespaceRevision: namespaceRevisionFor(structure, dependencies.named, dependencies.groups),
  scientificProfiles: dependencies.scientificProfiles ?? [],
  presentationContext: dependencies.needsPresentation && dependencies.presentationRevision ? { revision: dependencies.presentationRevision } : null,
  dependencyVector: { needsCoordinates: dependencies.needsCoordinates, needsTopology: dependencies.needsTopology, needsNamespaces: true, needsPresentation: dependencies.needsPresentation },
});

export const evaluateSelectionQuery = (query: string, structure: CanonicalMolecularStructure, options: SelectionEvaluationOptions = {}): SelectionResult => {
  const trimmed = query.trim(); const parsed = parseSelection(trimmed); const source = options.source ?? { kind: "query", rawQuery: trimmed };
  const emptyContext = { ...contextFor(structure, trimmed, options.named, [...parsed.diagnostics], options.presentation, options.coordinateFrame, options.groups), coordinateStateId: options.coordinateStateId, stateOrdinal: options.stateOrdinal };
  if (options.expectedRevision && options.expectedRevision !== structure.scientificHash) return baseResult(trimmed, structure, source, "STALE_REVISION", [{ code: "STALE_REVISION", message: "The selection context revision is stale; the active structure was not changed." }], "", [], emptyContext);
  const gated = trimmed.match(/\b(pbc|symmetry|arbitrary)\b/i);
  if (gated) return baseResult(trimmed, structure, source, "UNSUPPORTED_OPERATOR_OR_PROFILE", [{ code: "UNSUPPORTED_OPERATOR_OR_PROFILE", message: `Selection operator \`${gated[1]}\` is gated until its validated scientific profile is available.` }], "", [], emptyContext);
  if (!trimmed || !parsed.ast) {
    const diagnostics = parsed.diagnostics.length ? parsed.diagnostics : [{ code: "SYNTAX_ERROR" as const, message: "A selection expression is required." }];
    const parseStatus: SelectionStatus = diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_PROPERTY") ? "UNKNOWN_PROPERTY" : "SYNTAX_ERROR";
    return baseResult(trimmed, structure, source, parseStatus, diagnostics, "", [], emptyContext);
  }
  const ast = normalize(parsed.ast); const normalized = serialize(ast); const context: EvalContext = { ...emptyContext, diagnostics: [] };
  const presentationRevision = options.presentation ? hash(JSON.stringify([options.presentation.revision, options.presentation.visibleStableAtomIds])) : "none";
  const cacheKey = hash(`${trimmed}\u0000${structure.id}\u0000${structure.scientificHash}\u0000${options.coordinateStateId ?? "active"}\u0000${options.coordinateFrame ?? "undeclared"}\u0000${namespaceRevisionFor(structure, options.named, options.groups)}\u0000${topologyRevisionFor(structure)}\u0000${presentationRevision}\u0000${PROFILE.fingerprint}`);
  const cached = selectionEvaluationCache.get(cacheKey);
  if (cached) {
    context.needsCoordinates = cached.needsCoordinates;
    context.needsTopology = cached.needsTopology;
    context.needsPresentation = cached.needsPresentation;
    context.scientificProfiles = [...cached.scientificProfiles];
    context.coordinateFramePolicy = cached.coordinateFramePolicy;
    context.coordinateObjectIds = new Set(cached.coordinateObjectIds);
    context.coordinateObjectStates = new Map(cached.coordinateObjectStates.map((scope) => [scope.objectId, scope]));
    return baseResult(trimmed, structure, source, cached.status, cached.diagnostics, cached.normalized, cached.ids, context, bindSelectionPlan(trimmed, cached.ast, cached.normalized, structure, { named: options.named, groups: options.groups, needsCoordinates: cached.needsCoordinates, needsTopology: cached.needsTopology, needsPresentation: cached.needsPresentation, scientificProfiles: cached.scientificProfiles, presentationRevision: options.presentation?.revision ?? null, coordinateFramePolicy: cached.coordinateFramePolicy, coordinateObjectIds: cached.coordinateObjectIds, coordinateObjectStates: cached.coordinateObjectStates, coordinateStateId: options.coordinateStateId, stateOrdinal: options.stateOrdinal }));
  }
  const ids = evaluateAst(ast, structure, context);
  let status: SelectionStatus = ids.size > 0 ? "VALID_NONEMPTY" : "VALID_EMPTY";
  if (context.diagnostics.some((diagnostic) => diagnostic.code === "UNSUPPORTED_OPERATOR_OR_PROFILE")) status = "UNSUPPORTED_OPERATOR_OR_PROFILE";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_PROPERTY")) status = "UNKNOWN_PROPERTY";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_NAME")) status = "UNKNOWN_NAME";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "AMBIGUOUS_NAME")) status = "AMBIGUOUS_NAME";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "INVALID_VALUE")) status = "INVALID_VALUE";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "MISSING_DEPENDENCY")) status = "MISSING_DEPENDENCY";
  else if (context.diagnostics.some((diagnostic) => diagnostic.code === "TOPOLOGY_CONTEXT_ERROR")) status = "TOPOLOGY_CONTEXT_ERROR";
  const boundPlan = bindSelectionPlan(trimmed, ast, normalized, structure, { named: options.named, groups: options.groups, needsCoordinates: context.needsCoordinates, needsTopology: context.needsTopology, needsPresentation: context.needsPresentation, scientificProfiles: context.scientificProfiles, presentationRevision: context.presentationRevision, coordinateFramePolicy: context.coordinateFramePolicy, coordinateObjectIds: [...context.coordinateObjectIds], coordinateObjectStates: [...context.coordinateObjectStates.values()], coordinateStateId: options.coordinateStateId, stateOrdinal: options.stateOrdinal });
  const cachedValue: CachedEvaluation = { normalized, ast, ids: [...ids], status, diagnostics: [...context.diagnostics], needsCoordinates: context.needsCoordinates, needsTopology: context.needsTopology, needsPresentation: context.needsPresentation, scientificProfiles: [...context.scientificProfiles], coordinateFramePolicy: context.coordinateFramePolicy, coordinateObjectIds: [...context.coordinateObjectIds], coordinateObjectStates: [...context.coordinateObjectStates.values()] };
  selectionEvaluationCache.set(cacheKey, cachedValue);
  return baseResult(trimmed, structure, source, status, context.diagnostics, normalized, [...ids], context, boundPlan);
};

export const requireValidSelection = (result: SelectionResult): SelectionResult => {
  if (result.status !== "VALID_NONEMPTY" && result.status !== "VALID_EMPTY") throw new SelectionResolutionError(result.diagnostics[0]?.message ?? `Selection rejected with status ${result.status}.`, result);
  return result;
};
export const resolveSelection = (query: string, structure: CanonicalMolecularStructure, options?: SelectionEvaluationOptions): SelectionResult => requireValidSelection(evaluateSelectionQuery(query, structure, options));
export const selectionForStableIds = (stableAtomIds: readonly string[], structure: CanonicalMolecularStructure): SelectionResult => baseResult("<pick>", structure, { kind: "pick" }, stableAtomIds.length ? "VALID_NONEMPTY" : "VALID_EMPTY", [], "pick", stableAtomIds, contextFor(structure, "<pick>"));

export const combineSelections = (left: SelectionResult, right: SelectionResult, operation: "replace" | "add" | "subtract" | "intersect"): SelectionResult => {
  if (left.structureId !== right.structureId || left.molecularRevision !== right.molecularRevision) throw new SelectionResolutionError("Selections belong to different molecular revisions.");
  const a = new Set(left.stableAtomIds); const b = new Set(right.stableAtomIds); const ids = operation === "replace" ? [...b] : operation === "add" ? [...a, ...b] : operation === "subtract" ? [...a].filter((id) => !b.has(id)) : [...a].filter((id) => b.has(id));
  return { ...right, resultId: hash(`${left.resultId}:${operation}:${right.resultId}`), source: { kind: "command", parentResultIds: [left.resultId, right.resultId] }, query: `${operation}(${left.query},${right.query})`, normalizedAst: `${operation}(${left.normalizedAst},${right.normalizedAst})`, normalizedAstHash: hash(`${operation}:${left.normalizedAstHash}:${right.normalizedAstHash}`), stableAtomIds: ids, membershipHash: hash(ids.join("\u0000")), count: ids.length, status: ids.length ? "VALID_NONEMPTY" : "VALID_EMPTY" };
};

export type NamedSelectionSnapshot = { name: string; stableAtomIds: readonly string[]; selectionResult: SelectionResult; createdAtRevision: string; immutable: true };
export class NamedSelectionStore {
  private readonly snapshots = new Map<string, NamedSelectionSnapshot>();
  private revision = 0;
  constructor(private readonly structure: CanonicalMolecularStructure) {}
  get namespaceRevision(): string { return hash(`${this.structure.scientificHash}:${this.revision}:${[...this.snapshots.keys()].sort().join("\u0000")}`); }
  get(name: string) { return this.snapshots.get(name); }
  list() { return [...this.snapshots.values()]; }
  has(name: string) { return this.snapshots.has(name); }
  createSnapshot(name: string, result: SelectionResult): NamedSelectionSnapshot {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new SelectionResolutionError("Named selections must use an identifier such as active_site.");
    if (result.structureId !== this.structure.id || result.molecularRevision !== this.structure.scientificHash) throw new SelectionResolutionError("A named selection cannot be created from a stale molecular revision.");
    const snapshot: NamedSelectionSnapshot = { name, stableAtomIds: [...result.stableAtomIds], selectionResult: { ...result, source: { kind: "named-snapshot", parentResultIds: [result.resultId] } }, createdAtRevision: this.structure.scientificHash, immutable: true };
    this.snapshots.set(name, snapshot); this.revision += 1; return snapshot;
  }
  updateSnapshot(name: string, result: SelectionResult): NamedSelectionSnapshot {
    if (!this.snapshots.has(name)) throw new SelectionResolutionError(`Named selection \`${name}\` does not exist.`);
    return this.createSnapshot(name, result);
  }
  rename(name: string, nextName: string): NamedSelectionSnapshot {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nextName)) throw new SelectionResolutionError("Named selections must use an identifier such as active_site.");
    const snapshot = this.snapshots.get(name);
    if (!snapshot) throw new SelectionResolutionError(`Named selection \`${name}\` does not exist.`);
    if (name !== nextName && this.snapshots.has(nextName)) throw new SelectionResolutionError(`Named selection \`${nextName}\` already exists.`);
    const renamed: NamedSelectionSnapshot = { ...snapshot, name: nextName };
    this.snapshots.delete(name); this.snapshots.set(nextName, renamed); this.revision += 1; return renamed;
  }
  delete(name: string) { const deleted = this.snapshots.delete(name); if (deleted) this.revision += 1; return deleted; }
  clear() { if (this.snapshots.size > 0) { this.snapshots.clear(); this.revision += 1; } }
}
