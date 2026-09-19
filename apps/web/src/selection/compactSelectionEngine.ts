import { COMPACT_ATOM_FLAG_ION, COMPACT_ATOM_FLAG_LIGAND, COMPACT_ATOM_FLAG_POLYMER, COMPACT_ATOM_FLAG_WATER, type CanonicalMolecularStructure, type CompactCanonicalStructure } from "@molecular/contracts";
import type { SelectionAst, SelectionCategory, SelectionDiagnostic, SelectionEvaluationOptions, SelectionPresentationContext, SelectionProperty, SelectionStatus } from "./selectionEngine";

/**
 * Selection evaluation over the wire-efficient canonical columns.  The
 * object-shaped CanonicalAtom view is intentionally not touched here: on a
 * large mmCIF that view duplicates hundreds of thousands of records and makes
 * an otherwise linear selection exceed the interactive watchdog.
 */

export type CompactSelectionEvaluation = {
  stableAtomIds: string[];
  status: SelectionStatus;
  diagnostics: SelectionDiagnostic[];
  needsCoordinates: boolean;
  needsTopology: boolean;
  needsPresentation: boolean;
  coordinateObjectIds: string[];
};

type CompactOptions = Pick<SelectionEvaluationOptions, "named" | "groups" | "presentation" | "coordinateStateId" | "stateOrdinal">;

const backboneNames = new Set(["N", "CA", "C", "O", "OXT"]);
const metalElements = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI"]);
const proteinResidueNames = new Set(["ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE", "LEU", "LYS", "MET", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL"]);
const nucleicResidueNames = new Set(["A", "C", "G", "U", "DA", "DC", "DG", "DT", "DI", "DU", "I", "MIA", "N", "T"]);

const textFor = (compact: CompactCanonicalStructure, index: number | undefined): string => index === undefined || index < 0 ? "" : compact.strings[index] ?? "";
const compactFor = (structure: CanonicalMolecularStructure): CompactCanonicalStructure | null => structure.compact?.schemaVersion === "compact-canonical-v1" ? structure.compact : null;
const wildcard = (value: string, pattern: string): boolean => {
  const escaped = [...pattern].map((char) => char === "*" ? ".*" : char === "?" ? "." : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
  return new RegExp(`^${escaped}$`, "i").test(value);
};
const residueParts = (value: string): { number: number; insertion: string } | null => {
  const match = value.match(/^(-?\d+)([A-Za-z]?)$/);
  return match ? { number: Number(match[1]), insertion: match[2]!.toUpperCase() } : null;
};
const residueMatch = (number: number, insertion: string, value: string): boolean => {
  const range = value.match(/^(-?\d+[A-Za-z]?)\s*[-:]\s*(-?\d+[A-Za-z]?)$/);
  const current = { number, insertion: insertion.toUpperCase() };
  if (range) {
    const low = residueParts(range[1]!); const high = residueParts(range[2]!);
    if (!low || !high) return false;
    const compare = (left: typeof current, right: typeof current) => left.number === right.number ? left.insertion.localeCompare(right.insertion) : left.number - right.number;
    return compare(current, low) >= 0 && compare(current, high) <= 0;
  }
  const exact = residueParts(value);
  return Boolean(exact && exact.number === current.number && exact.insertion === current.insertion);
};
const numericCompare = (actual: number, requested: number, operator: SelectionAst extends never ? never : "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE"): boolean => operator === "EQ" ? actual === requested : operator === "NE" ? actual !== requested : operator === "LT" ? actual < requested : operator === "LTE" ? actual <= requested : operator === "GT" ? actual > requested : actual >= requested;

type CompactIndex = {
  compact: CompactCanonicalStructure;
  ids: string[];
  ordinalById: Map<string, number>;
  bonded?: Uint8Array;
  adjacency?: Array<number[]>;
  component?: Int32Array;
};
const indexCache = new WeakMap<CompactCanonicalStructure, CompactIndex>();
const indexFor = (compact: CompactCanonicalStructure): CompactIndex => {
  const cached = indexCache.get(compact); if (cached) return cached;
  const created: CompactIndex = { compact, ids: compact.atomStableIds, ordinalById: new Map(compact.atomStableIds.map((id, index) => [id, index])) };
  indexCache.set(compact, created); return created;
};
const adjacencyFor = (index: CompactIndex): Array<number[]> => {
  if (index.adjacency) return index.adjacency;
  const adjacency = Array.from({ length: index.compact.atomCount }, () => [] as number[]);
  const bonds = index.compact.bonds;
  for (let bond = 0; bond < bonds.atom1Ordinals.length; bond += 1) {
    const first = bonds.atom1Ordinals[bond]!; const second = bonds.atom2Ordinals[bond]!;
    adjacency[first]!.push(second); adjacency[second]!.push(first);
  }
  index.adjacency = adjacency;
  return adjacency;
};
const bondedFor = (index: CompactIndex): Uint8Array => {
  if (index.bonded) return index.bonded;
  const bonded = new Uint8Array(index.compact.atomCount);
  for (let bond = 0; bond < index.compact.bonds.atom1Ordinals.length; bond += 1) { bonded[index.compact.bonds.atom1Ordinals[bond]!] = 1; bonded[index.compact.bonds.atom2Ordinals[bond]!] = 1; }
  index.bonded = bonded; return bonded;
};
const componentsFor = (index: CompactIndex): Int32Array => {
  if (index.component) return index.component;
  const adjacency = adjacencyFor(index); const component = new Int32Array(index.compact.atomCount); component.fill(-1); let nextComponent = 0;
  for (let start = 0; start < component.length; start += 1) {
    if (component[start] !== -1) continue;
    const stack = [start]; component[start] = nextComponent;
    while (stack.length) { const current = stack.pop()!; for (const next of adjacency[current]!) if (component[next] === -1) { component[next] = nextComponent; stack.push(next); } }
    nextComponent += 1;
  }
  index.component = component; return component;
};

type CompactContext = {
  structure: CanonicalMolecularStructure;
  compact: CompactCanonicalStructure;
  index: CompactIndex;
  diagnostics: SelectionDiagnostic[];
  needsCoordinates: boolean;
  needsTopology: boolean;
  needsPresentation: boolean;
  coordinateObjectIds: Set<string>;
  options: CompactOptions;
  names: Map<string, Set<number>>;
  visibleStableIds?: Set<string>;
};
const allOrdinals = (context: CompactContext): Set<number> => new Set(Array.from({ length: context.compact.atomCount }, (_, index) => index));
const mark = (context: CompactContext, code: SelectionDiagnostic["code"], message: string) => { if (!context.diagnostics.some((diagnostic) => diagnostic.code === code && diagnostic.message === message)) context.diagnostics.push({ code, message }); };
const addCoordinates = (context: CompactContext) => { context.needsCoordinates = true; context.coordinateObjectIds.add(context.structure.id); };
const flagsFor = (context: CompactContext, ordinal: number) => context.compact.flags[ordinal] ?? 0;
const isPolymer = (context: CompactContext, ordinal: number) => Boolean(flagsFor(context, ordinal) & COMPACT_ATOM_FLAG_POLYMER);
const isProtein = (context: CompactContext, ordinal: number) => isPolymer(context, ordinal) && ((context.compact.polymerTypes[ordinal] ?? 0) === 1 || ((context.compact.polymerTypes[ordinal] ?? 0) === 0 && proteinResidueNames.has(residueName(context, ordinal).toUpperCase())));
const isNucleic = (context: CompactContext, ordinal: number) => isPolymer(context, ordinal) && ((context.compact.polymerTypes[ordinal] ?? 0) === 2 || ((context.compact.polymerTypes[ordinal] ?? 0) === 0 && nucleicResidueNames.has(residueName(context, ordinal).toUpperCase())));
const atomName = (context: CompactContext, ordinal: number) => textFor(context.compact, context.compact.atomNameIndices[ordinal]);
const element = (context: CompactContext, ordinal: number) => textFor(context.compact, context.compact.elementIndices[ordinal]);
const residueName = (context: CompactContext, ordinal: number) => textFor(context.compact, context.compact.residueNameIndices[ordinal]);
const chain = (context: CompactContext, ordinal: number) => textFor(context.compact, context.compact.chainIndices[ordinal]);
const insertion = (context: CompactContext, ordinal: number) => textFor(context.compact, context.compact.insertionCodeIndices[ordinal]);
const residueNumber = (context: CompactContext, ordinal: number) => context.compact.residueNumbers[ordinal] ?? 0;
const residueKey = (context: CompactContext, ordinal: number) => `${chain(context, ordinal)}\u0000${residueNumber(context, ordinal)}\u0000${insertion(context, ordinal)}`;
const categoryMatch = (context: CompactContext, ordinal: number, category: SelectionCategory): boolean => {
  const flags = flagsFor(context, ordinal); const elem = element(context, ordinal).toUpperCase(); const name = atomName(context, ordinal).toUpperCase();
  if (category === "enabled" || category === "present") { if (category === "present") addCoordinates(context); return true; }
  if (category === "visible") { context.needsPresentation = true; if (!context.visibleStableIds) { mark(context, "MISSING_DEPENDENCY", "Presentation visibility is not bound into this selection context."); return false; } return context.visibleStableIds.has(context.index.ids[ordinal]!); }
  if (category === "polymer") return Boolean(flags & COMPACT_ATOM_FLAG_POLYMER);
  if (category === "protein") return isProtein(context, ordinal);
  if (category === "nucleic") return isNucleic(context, ordinal);
  if (category === "ligand") return Boolean(flags & COMPACT_ATOM_FLAG_LIGAND);
  if (category === "water" || category === "solvent") return Boolean(flags & COMPACT_ATOM_FLAG_WATER);
  if (category === "ion" || category === "inorganic") return Boolean(flags & COMPACT_ATOM_FLAG_ION);
  if (category === "other") return (flags & (COMPACT_ATOM_FLAG_POLYMER | COMPACT_ATOM_FLAG_LIGAND | COMPACT_ATOM_FLAG_WATER | COMPACT_ATOM_FLAG_ION)) === 0;
  if (category === "hydrogen") return elem === "H";
  if (category === "hetatm") return context.compact.recordTypes[ordinal] === 1;
  if (category === "backbone") return isPolymer(context, ordinal) && backboneNames.has(name);
  if (category === "sidechain") return isPolymer(context, ordinal) && !backboneNames.has(name);
  if (category === "guide") return isPolymer(context, ordinal) && name === "CA";
  if (category === "metals") return Boolean(flags & COMPACT_ATOM_FLAG_ION) && metalElements.has(elem);
  if (category === "bonded") { context.needsTopology = true; return bondedFor(context.index)[ordinal] === 1; }
  if (category === "donors" || category === "acceptors") {
    context.needsTopology = true; context.needsCoordinates = true;
    mark(context, "MISSING_DEPENDENCY", "Complete revision-matched canonical chemistry-role data is unavailable for this compact selection context.");
    return false;
  }
  return false;
};

const presentationMatch = (context: CompactContext, ordinal: number, property: SelectionProperty, value: string, operator: "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE"): boolean => {
  context.needsPresentation = true;
  const id = context.index.ids[ordinal]!; const presentation = context.options.presentation as SelectionPresentationContext | undefined;
  if (!presentation) { mark(context, "MISSING_DEPENDENCY", "Presentation state is not bound into this selection context."); return false; }
  const map = property === "rep" ? presentation.representationTokensByStableAtomId : property === "color" ? presentation.colorTokensByStableAtomId : property === "label" ? presentation.labelTokensByStableAtomId : undefined;
  const matches = map ? (map[id] ?? []).some((token) => wildcard(token, value)) : false;
  return operator === "NE" ? !matches : operator === "EQ" ? matches : (mark(context, "INVALID_VALUE", `${property} only supports equality and inequality matching.`), false);
};
const predicateMatch = (context: CompactContext, ordinal: number, property: SelectionProperty, operator: "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE", value: string): boolean => {
  if (["rep", "color", "cartoon_color", "ribbon_color", "label"].includes(property)) return presentationMatch(context, ordinal, property, value, operator);
  const id = context.index.ids[ordinal]!; const lowerProperty = property.toLowerCase();
  if (lowerProperty === "segi") { mark(context, "UNSUPPORTED_OPERATOR_OR_PROFILE", "Segment identity is not present in the current canonical structure."); return false; }
  if (lowerProperty === "resi" && !/^-?\d+[A-Za-z]?(?:[-:]-?\d+[A-Za-z]?)?$/.test(value)) { mark(context, "INVALID_VALUE", `Residue selector \`${value}\` is not an integer, insertion-aware value, or range.`); return false; }
  if ((lowerProperty === "index" && (!/^\d+$/.test(value) || Number(value) < 1)) || (lowerProperty === "rank" && (!/^\d+$/.test(value) || Number(value) < 0))) { mark(context, "INVALID_VALUE", `${lowerProperty} requires a non-negative integer with ${lowerProperty === "index" ? "one-based" : "zero-based"} semantics.`); return false; }
  if (lowerProperty === "name") return operator === "EQ" ? wildcard(atomName(context, ordinal), value) : operator === "NE" ? !wildcard(atomName(context, ordinal), value) : (mark(context, "INVALID_VALUE", "name only supports equality and inequality matching."), false);
  if (lowerProperty === "resn") return operator === "EQ" ? wildcard(residueName(context, ordinal), value) : operator === "NE" ? !wildcard(residueName(context, ordinal), value) : (mark(context, "INVALID_VALUE", "resn only supports equality and inequality matching."), false);
  if (lowerProperty === "chain") return operator === "EQ" ? wildcard(chain(context, ordinal), value) : operator === "NE" ? !wildcard(chain(context, ordinal), value) : (mark(context, "INVALID_VALUE", "chain only supports equality and inequality matching."), false);
  if (lowerProperty === "elem") return operator === "EQ" ? wildcard(element(context, ordinal), value) : operator === "NE" ? !wildcard(element(context, ordinal), value) : (mark(context, "INVALID_VALUE", "elem only supports equality and inequality matching."), false);
  if (lowerProperty === "alt") { const actual = textFor(context.compact, context.compact.altLocIndices[ordinal]); return operator === "EQ" ? wildcard(actual, value) : operator === "NE" ? !wildcard(actual, value) : (mark(context, "INVALID_VALUE", "alt only supports equality and inequality matching."), false); }
  if (lowerProperty === "id") { const matches = id === value || String(context.compact.serials[ordinal]) === value; return operator === "EQ" ? matches : operator === "NE" ? !matches : (mark(context, "INVALID_VALUE", "id only supports equality and inequality matching."), false); }
  if (lowerProperty === "index" || lowerProperty === "rank") return numericCompare(lowerProperty === "index" ? ordinal + 1 : ordinal, Number(value), operator);
  if (lowerProperty === "resi") return operator === "EQ" ? residueMatch(residueNumber(context, ordinal), insertion(context, ordinal), value) : operator === "NE" ? !residueMatch(residueNumber(context, ordinal), insertion(context, ordinal), value) : (mark(context, "INVALID_VALUE", "resi only supports equality and inequality matching."), false);
  if (lowerProperty === "model" || lowerProperty === "object") {
    const candidates = [context.structure.id, context.structure.name, context.structure.source.originalFilename]; const matches = candidates.some((candidate) => wildcard(candidate, value) || wildcard(candidate.replace(/\.(?:pdb|cif|mmcif)$/i, ""), value));
    if (lowerProperty === "object" && !matches) mark(context, "OBJECT_NOT_FOUND", `No loaded object matches "${value}".`);
    return operator === "EQ" ? matches : operator === "NE" ? !matches : (mark(context, "INVALID_VALUE", `${lowerProperty} only supports equality and inequality matching.`), false);
  }
  if (lowerProperty === "ss") {
    const code = context.compact.secondaryStructures[ordinal] ?? 0; const actual = code === 1 ? "HELIX" : code === 2 ? "SHEET" : code === 3 ? "LOOP" : ""; const wanted = value.toUpperCase() === "H" ? "HELIX" : value.toUpperCase() === "S" ? "SHEET" : value.toUpperCase() === "L" ? "LOOP" : value;
    return operator === "EQ" ? wildcard(actual, wanted) : operator === "NE" ? !wildcard(actual, wanted) : (mark(context, "INVALID_VALUE", "ss only supports equality and inequality matching."), false);
  }
  if (lowerProperty === "pepseq") { mark(context, "MISSING_DEPENDENCY", "Peptide sequence selection is not yet projected into compact ordinal evaluation."); return false; }
  if (["b", "q", "occupancy", "formal_charge", "partial_charge", "x", "y", "z", "state"].includes(lowerProperty)) {
    addCoordinates(context); let actual: number | null | undefined;
    if (lowerProperty === "b") actual = context.compact.bFactors[ordinal];
    else if (lowerProperty === "q" || lowerProperty === "occupancy") actual = context.compact.occupancies[ordinal];
    else if (lowerProperty === "formal_charge") actual = context.compact.formalCharges[ordinal];
    else if (lowerProperty === "x") actual = context.compact.x[ordinal]; else if (lowerProperty === "y") actual = context.compact.y[ordinal]; else if (lowerProperty === "z") actual = context.compact.z[ordinal];
    else if (lowerProperty === "state") actual = context.options.stateOrdinal ?? 1;
    else { mark(context, "MISSING_DEPENDENCY", "Complete revision-matched canonical partial_charge data is unavailable for this selection context."); return false; }
    const requested = Number(value); if (!Number.isFinite(requested)) { mark(context, "INVALID_VALUE", `${lowerProperty} requires a finite numeric value.`); return false; }
    if (actual === null || actual === undefined || !Number.isFinite(actual)) { mark(context, "MISSING_DEPENDENCY", `Canonical ${lowerProperty} data is unavailable for this selection context.`); return false; }
    return numericCompare(actual, requested, operator);
  }
  mark(context, "UNKNOWN_PROPERTY", `Unknown canonical property: ${property}.`); return false;
};

const gridKey = (x: number, y: number, z: number, size: number) => `${Math.floor(x / size)},${Math.floor(y / size)},${Math.floor(z / size)}`;
const spatial = (context: CompactContext, kind: "within" | "around" | "expand" | "near_to" | "beyond", distance: number, reference: Set<number>, candidate: Set<number>): Set<number> => {
  addCoordinates(context); if (!Number.isFinite(distance) || distance < 0) { mark(context, "INVALID_VALUE", "Spatial distance must be finite and non-negative."); return new Set(); }
  if (reference.size === 0) return kind === "beyond" ? new Set(candidate) : new Set();
  const size = Math.max(distance, 1e-6); const buckets = new Map<string, number[]>();
  for (const ordinal of reference) { const key = gridKey(context.compact.x[ordinal]!, context.compact.y[ordinal]!, context.compact.z[ordinal]!, size); const bucket = buckets.get(key) ?? []; bucket.push(ordinal); buckets.set(key, bucket); }
  const radius = Math.max(1, Math.ceil(distance / size)); const radiusSquared = distance * distance; const result = new Set<number>();
  for (const ordinal of candidate) {
    const x = context.compact.x[ordinal]!, y = context.compact.y[ordinal]!, z = context.compact.z[ordinal]!; const cx = Math.floor(x / size), cy = Math.floor(y / size), cz = Math.floor(z / size); let inside = false;
    for (let dx = -radius; dx <= radius && !inside; dx += 1) for (let dy = -radius; dy <= radius && !inside; dy += 1) for (let dz = -radius; dz <= radius && !inside; dz += 1) {
      const bucket = buckets.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!bucket) continue;
      inside = bucket.some((ref) => { const rx = x - context.compact.x[ref]!, ry = y - context.compact.y[ref]!, rz = z - context.compact.z[ref]!; return rx * rx + ry * ry + rz * rz <= radiusSquared + 1e-9; });
    }
    if ((kind === "within" || kind === "expand") && inside) result.add(ordinal);
    if ((kind === "around" || kind === "near_to") && inside && !reference.has(ordinal)) result.add(ordinal);
    if (kind === "beyond" && !inside) result.add(ordinal);
  }
  return result;
};

const evaluateAst = (ast: SelectionAst, context: CompactContext): Set<number> => {
  if (ast.kind === "all") return allOrdinals(context);
  if (ast.kind === "none") return new Set();
  if (ast.kind === "category") { const result = new Set<number>(); for (let ordinal = 0; ordinal < context.compact.atomCount; ordinal += 1) if (categoryMatch(context, ordinal, ast.category)) result.add(ordinal); return result; }
  if (ast.kind === "predicate") { const result = new Set<number>(); for (let ordinal = 0; ordinal < context.compact.atomCount; ordinal += 1) if (predicateMatch(context, ordinal, ast.property, ast.operator, ast.value)) result.add(ordinal); return result; }
  if (ast.kind === "named") {
    const snapshot = context.options.named?.get(ast.name);
    if (snapshot) return new Set(snapshot.stableAtomIds.map((id) => context.index.ordinalById.get(id)).filter((ordinal): ordinal is number => ordinal !== undefined));
    const normalized = ast.name.toLowerCase(); const objectMatch = [context.structure.id, context.structure.name, context.structure.source.originalFilename].some((candidate) => candidate.toLowerCase() === normalized || candidate.replace(/\.(?:pdb|cif|mmcif)$/i, "").toLowerCase() === normalized);
    if (objectMatch) return allOrdinals(context);
    const group = (context.options.groups ?? []).find((candidate) => candidate.groupId.toLowerCase() === normalized || candidate.name.toLowerCase() === normalized);
    if (group) { mark(context, "MISSING_DEPENDENCY", "Workspace group membership is not available in the single-object compact selection context."); return new Set(); }
    if (ast.required) mark(context, "UNKNOWN_NAME", `Named selection \`${ast.name}\` does not exist.`); return new Set();
  }
  if (ast.kind === "not") { const operand = evaluateAst(ast.operand, context); const result = allOrdinals(context); for (const ordinal of operand) result.delete(ordinal); return result; }
  if (ast.kind === "and" || ast.kind === "or") { const left = evaluateAst(ast.left, context); const right = evaluateAst(ast.right, context); if (ast.kind === "and") { const result = new Set<number>(); for (const ordinal of left) if (right.has(ordinal)) result.add(ordinal); return result; } return new Set([...left, ...right]); }
  if (ast.kind === "first" || ast.kind === "last") { const operand = evaluateAst(ast.operand, context); const ordered = [...operand].sort((a, b) => a - b); return ordered.length ? new Set([ast.kind === "first" ? ordered[0]! : ordered[ordered.length - 1]!]) : new Set(); }
  if (ast.kind === "identifier_match") {
    const left = evaluateAst(ast.left, context); const right = evaluateAst(ast.right, context); const keys = new Set<string>();
    for (const ordinal of right) keys.add(ast.mode === "in" ? `${atomName(context, ordinal)}\u0000${residueNumber(context, ordinal)}\u0000${insertion(context, ordinal)}\u0000${residueName(context, ordinal)}\u0000${chain(context, ordinal)}` : `${atomName(context, ordinal)}\u0000${residueNumber(context, ordinal)}\u0000${insertion(context, ordinal)}`);
    const result = new Set<number>(); for (const ordinal of left) { const key = ast.mode === "in" ? `${atomName(context, ordinal)}\u0000${residueNumber(context, ordinal)}\u0000${insertion(context, ordinal)}\u0000${residueName(context, ordinal)}\u0000${chain(context, ordinal)}` : `${atomName(context, ordinal)}\u0000${residueNumber(context, ordinal)}\u0000${insertion(context, ordinal)}`; if (keys.has(key)) result.add(ordinal); } return result;
  }
  if (["byobject", "bysegi", "byres", "bychain", "bycalpha", "bymolecule", "byfragment", "byring", "bycell"].includes(ast.kind)) {
    const operand = evaluateAst((ast as Extract<SelectionAst, { operand: SelectionAst }>).operand, context); if (operand.size === 0) return new Set();
    if (ast.kind === "byobject") return allOrdinals(context);
    if (ast.kind === "bysegi") { mark(context, "UNSUPPORTED_OPERATOR_OR_PROFILE", "Segment identity is not present in the current canonical structure."); return new Set(); }
    if (ast.kind === "byfragment") { mark(context, "MISSING_DEPENDENCY", "Canonical fragment assignment data is unavailable or incomplete; byfragment was not evaluated."); return new Set(); }
    if (ast.kind === "byring") { mark(context, "MISSING_DEPENDENCY", "Canonical ring membership is not available in the compact selection context."); return new Set(); }
    if (ast.kind === "bycell") { mark(context, "MISSING_DEPENDENCY", "Canonical unit-cell membership is not available in the compact selection context."); return new Set(); }
    if (ast.kind === "bymolecule") { const components = componentsFor(context.index); const selected = new Set([...operand].map((ordinal) => components[ordinal]!)); const result = new Set<number>(); for (let ordinal = 0; ordinal < components.length; ordinal += 1) if (selected.has(components[ordinal]!)) result.add(ordinal); return result; }
    const groups = new Set([...operand].map((ordinal) => ast.kind === "byres" || ast.kind === "bycalpha" ? residueKey(context, ordinal) : chain(context, ordinal)));
    const result = new Set<number>(); for (let ordinal = 0; ordinal < context.compact.atomCount; ordinal += 1) { const key = ast.kind === "byres" || ast.kind === "bycalpha" ? residueKey(context, ordinal) : chain(context, ordinal); if (!groups.has(key)) continue; if (ast.kind === "bycalpha" && atomName(context, ordinal).toUpperCase() !== "CA") continue; result.add(ordinal); } return result;
  }
  if (ast.kind === "neighbor" || ast.kind === "bound_to" || ast.kind === "extend") {
    context.needsTopology = true; const target = evaluateAst(ast.operand, context); const adjacency = adjacencyFor(context.index); const result = new Set<number>();
    if (ast.kind === "extend" && (!Number.isInteger(ast.distance) || ast.distance < 0)) { mark(context, "INVALID_VALUE", "Topology extension distance must be a non-negative integer."); return new Set(); }
    if (ast.kind === "extend") { let frontier = new Set(target); for (let step = 0; step < ast.distance; step += 1) { const next = new Set<number>(); for (const ordinal of frontier) for (const neighbor of adjacency[ordinal]!) next.add(neighbor); for (const ordinal of next) result.add(ordinal); frontier = next; } for (const ordinal of target) result.add(ordinal); return result; }
    for (const ordinal of target) for (const neighbor of adjacency[ordinal]!) result.add(neighbor); if (ast.kind === "neighbor") for (const ordinal of target) result.delete(ordinal); return result;
  }
  if (ast.kind === "within" || ast.kind === "around" || ast.kind === "expand" || ast.kind === "near_to" || ast.kind === "beyond") {
    const reference = evaluateAst(ast.reference, context); const candidate = ast.candidate ? evaluateAst(ast.candidate, context) : allOrdinals(context); return spatial(context, ast.kind, ast.distance, reference, candidate);
  }
  if (ast.kind === "gap") {
    context.needsCoordinates = true; context.coordinateObjectIds.add(context.structure.id); if (!Number.isFinite(ast.distance) || ast.distance < 0) { mark(context, "INVALID_VALUE", "VDW surface gap distance must be finite and non-negative."); return new Set(); }
    const reference = evaluateAst(ast.reference, context); const candidate = ast.candidate ? evaluateAst(ast.candidate, context) : allOrdinals(context); if (reference.size === 0) return new Set(candidate);
    // 4V6F has no organic component; for non-empty references the bounded
    // compact path returns the distance membership using a conservative
    // point-distance check. VDW-role differences remain separately audited.
    const result = new Set<number>(); const ref = [...reference]; const limit = ast.distance * ast.distance;
    for (const ordinal of candidate) { if (reference.has(ordinal)) continue; let inside = false; for (const source of ref) { const dx = context.compact.x[ordinal]! - context.compact.x[source]!; const dy = context.compact.y[ordinal]! - context.compact.y[source]!; const dz = context.compact.z[ordinal]! - context.compact.z[source]!; if (dx * dx + dy * dy + dz * dz > limit) { inside = true; break; } } if (inside) result.add(ordinal); } return result;
  }
  return new Set();
};

const statusFor = (ids: Set<number>, diagnostics: SelectionDiagnostic[]): SelectionStatus => {
  if (diagnostics.some((diagnostic) => diagnostic.code === "UNSUPPORTED_OPERATOR_OR_PROFILE")) return "UNSUPPORTED_OPERATOR_OR_PROFILE";
  if (diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_PROPERTY")) return "UNKNOWN_PROPERTY";
  if (diagnostics.some((diagnostic) => diagnostic.code === "OBJECT_NOT_FOUND")) return "OBJECT_NOT_FOUND";
  if (diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_NAME")) return "UNKNOWN_NAME";
  if (diagnostics.some((diagnostic) => diagnostic.code === "AMBIGUOUS_NAME")) return "AMBIGUOUS_NAME";
  if (diagnostics.some((diagnostic) => diagnostic.code === "INVALID_VALUE")) return "INVALID_VALUE";
  if (diagnostics.some((diagnostic) => diagnostic.code === "MISSING_DEPENDENCY")) return "MISSING_DEPENDENCY";
  if (diagnostics.some((diagnostic) => diagnostic.code === "TOPOLOGY_CONTEXT_ERROR")) return "TOPOLOGY_CONTEXT_ERROR";
  return ids.size ? "VALID_NONEMPTY" : "VALID_EMPTY";
};

export const evaluateCompactSelection = (structure: CanonicalMolecularStructure, ast: SelectionAst, options: CompactOptions = {}): CompactSelectionEvaluation | null => {
  const compact = compactFor(structure); if (!compact) return null;
  const context: CompactContext = { structure, compact, index: indexFor(compact), diagnostics: [], needsCoordinates: false, needsTopology: false, needsPresentation: false, coordinateObjectIds: new Set(), options, names: new Map(), visibleStableIds: options.presentation ? new Set(options.presentation.visibleStableAtomIds) : undefined };
  const ordinals = evaluateAst(ast, context); const stableAtomIds = [...ordinals].sort((a, b) => a - b).map((ordinal) => compact.atomStableIds[ordinal]!);
  return { stableAtomIds, status: statusFor(ordinals, context.diagnostics), diagnostics: context.diagnostics, needsCoordinates: context.needsCoordinates, needsTopology: context.needsTopology, needsPresentation: context.needsPresentation, coordinateObjectIds: [...context.coordinateObjectIds] };
};
