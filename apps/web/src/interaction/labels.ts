import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";

export const LABEL_FIELDS = ["name", "resn", "resi", "chain", "segi", "model", "elem", "alt", "b", "q", "formal_charge", "partial_charge", "ss"] as const;
export type LabelField = (typeof LABEL_FIELDS)[number];
export type SafeLabelExpression = { kind: "template"; parts: readonly ({ kind: "text"; value: string } | { kind: "field"; field: LabelField })[] };
export type LabelMode = "off" | "atom-name" | "residue" | "residue-number" | "chain" | "custom";
export type LabelState = {
  mode: LabelMode;
  expression: SafeLabelExpression | null;
  font: string;
  size: number;
  color: string;
  outline: string;
  offset: { x: number; y: number };
  alignment: "topLeft" | "topCenter" | "center" | "bottomCenter";
  /** Canonical target membership; omitted means the current visible projection. */
  targetStableAtomIds?: readonly string[];
};

export const LABEL_ATOM_SAFETY_LIMIT = 120;
export type LabelPlan = {
  atoms: readonly CanonicalAtom[];
  eligibleAtomCount: number;
  labelCount: number;
  status: "OFF" | "READY" | "GUARDED";
  diagnostic?: string;
};

const fieldSet = new Set<string>(LABEL_FIELDS);

export type LabelExpressionErrorCode = "EMPTY" | "UNSUPPORTED_FIELD" | "UNSAFE_SYNTAX" | "MISSING_FIELD";

export class LabelExpressionError extends Error {
  readonly code: LabelExpressionErrorCode;

  constructor(message: string, code: LabelExpressionErrorCode) {
    super(message);
    this.name = "LabelExpressionError";
    this.code = code;
  }
}

export const parseSafeLabelExpression = (input: string): SafeLabelExpression => {
  const parts: Array<{ kind: "text"; value: string } | { kind: "field"; field: LabelField }> = [];
  const expression = input.trim();
  if (!expression) throw new LabelExpressionError("A label expression is required.", "EMPTY");
  if (/[;()=\x60]|=>/.test(expression)) throw new LabelExpressionError("Label expressions accept fields and plain text only; executable syntax is not allowed.", "UNSAFE_SYNTAX");
  const pattern = /\{([^{}]+)\}/g;
  let cursor = 0;
  for (const match of expression.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ kind: "text", value: expression.slice(cursor, match.index) });
    const field = match[1].trim().toLowerCase();
    if (!fieldSet.has(field)) throw new LabelExpressionError(`Unsupported safe label field: ${field}`, "UNSUPPORTED_FIELD");
    parts.push({ kind: "field", field: field as LabelField });
    cursor = match.index + match[0].length;
  }
  if (/[{}]/.test(expression.replace(/\{[^{}]+\}/g, ""))) throw new LabelExpressionError("Unbalanced braces are not valid in a label expression.", "UNSAFE_SYNTAX");
  if (cursor < expression.length) parts.push({ kind: "text", value: expression.slice(cursor) });
  if (!parts.some((part) => part.kind === "field")) throw new LabelExpressionError("A label must contain at least one supported field such as {name}.", "MISSING_FIELD");
  return { kind: "template", parts };
};

export const labelExpressionForMode = (mode: LabelMode): SafeLabelExpression | null => {
  if (mode === "off") return null;
  if (mode === "atom-name") return parseSafeLabelExpression("{name}");
  if (mode === "residue") return parseSafeLabelExpression("{resn}");
  if (mode === "residue-number") return parseSafeLabelExpression("{resn} {resi}");
  if (mode === "chain") return parseSafeLabelExpression("Chain {chain}");
  return null;
};

const fieldValue = (field: LabelField, atom: CanonicalAtom, structure: CanonicalMolecularStructure): string => {
  if (field === "name") return atom.atomName;
  if (field === "resn") return atom.residueName;
  if (field === "resi") return String(atom.residueNumber);
  if (field === "chain") return atom.chain;
  if (field === "segi") return "";
  if (field === "model") return structure.name;
  if (field === "elem") return atom.element;
  if (field === "alt") return atom.altLoc ?? "";
  if (field === "b") return atom.bFactor === undefined || atom.bFactor === null ? "?" : atom.bFactor.toFixed(2);
  if (field === "q") return atom.occupancy === undefined || atom.occupancy === null ? "?" : atom.occupancy.toFixed(2);
  if (field === "formal_charge") return atom.formalCharge === undefined || atom.formalCharge === null ? "?" : String(atom.formalCharge);
  if (field === "partial_charge") return structure.partialChargeDataset?.atomChargeMap[atom.stableId]?.toFixed(3) ?? "?";
  return atom.secondaryStructure ?? "?";
};

export const resolveSafeLabel = (expression: SafeLabelExpression, atom: CanonicalAtom, structure: CanonicalMolecularStructure): string => expression.parts.map((part) => part.kind === "text" ? part.value : fieldValue(part.field, atom, structure)).join("");

export const serializeSafeLabelExpression = (expression: SafeLabelExpression): string => expression.parts.map((part) => part.kind === "text" ? part.value : `{${part.field}}`).join("");

const residueKey = (atom: CanonicalAtom): string => `${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}`;

/** Resolves label cardinality from canonical fields before the adapter sees renderer atoms. */
export const labelPlanForState = (state: LabelState, visibleAtoms: readonly CanonicalAtom[]): LabelPlan => {
  if (state.mode === "off" || !state.expression) return { atoms: [], eligibleAtomCount: 0, labelCount: 0, status: "OFF" };
  const target = state.targetStableAtomIds ? new Set(state.targetStableAtomIds) : null;
  const targetedAtoms = target ? visibleAtoms.filter((atom) => target.has(atom.stableId)) : visibleAtoms;
  if ((state.mode === "atom-name" || state.mode === "custom") && targetedAtoms.length > LABEL_ATOM_SAFETY_LIMIT) {
    return { atoms: [], eligibleAtomCount: targetedAtoms.length, labelCount: 0, status: "GUARDED", diagnostic: `Atom-level labels are guarded above ${LABEL_ATOM_SAFETY_LIMIT} eligible atoms (${targetedAtoms.length} requested). Narrow the target before rendering.` };
  }
  if (state.mode === "residue" || state.mode === "residue-number") {
    const seen = new Set<string>();
    const atoms = targetedAtoms.filter((atom) => { const key = residueKey(atom); if (seen.has(key)) return false; seen.add(key); return true; });
    return { atoms, eligibleAtomCount: targetedAtoms.length, labelCount: atoms.length, status: "READY" };
  }
  if (state.mode === "chain") {
    const seen = new Set<string>();
    const atoms = targetedAtoms.filter((atom) => { const key = atom.chain || " "; if (seen.has(key)) return false; seen.add(key); return true; });
    return { atoms, eligibleAtomCount: targetedAtoms.length, labelCount: atoms.length, status: "READY" };
  }
  return { atoms: [...targetedAtoms], eligibleAtomCount: targetedAtoms.length, labelCount: targetedAtoms.length, status: "READY" };
};

export const DEFAULT_LABEL_STATE: LabelState = { mode: "off", expression: null, font: "Inter", size: 12, color: "#e8edf5", outline: "#05070a", offset: { x: 0, y: 0 }, alignment: "topCenter" };
