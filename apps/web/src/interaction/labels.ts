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
};

const fieldSet = new Set<string>(LABEL_FIELDS);

export class LabelExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LabelExpressionError";
  }
}

export const parseSafeLabelExpression = (input: string): SafeLabelExpression => {
  const parts: Array<{ kind: "text"; value: string } | { kind: "field"; field: LabelField }> = [];
  const expression = input.trim();
  if (!expression) throw new LabelExpressionError("A label expression is required.");
  const pattern = /\{([^{}]+)\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(expression))) {
    if (match.index > cursor) parts.push({ kind: "text", value: expression.slice(cursor, match.index) });
    const field = match[1].trim().toLowerCase();
    if (!fieldSet.has(field)) throw new LabelExpressionError(`Unsupported safe label field: ${field}`);
    parts.push({ kind: "field", field: field as LabelField });
    cursor = match.index + match[0].length;
  }
  if (cursor < expression.length) parts.push({ kind: "text", value: expression.slice(cursor) });
  if (!parts.some((part) => part.kind === "field")) throw new LabelExpressionError("A label must contain at least one supported field such as {name}.");
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

export const DEFAULT_LABEL_STATE: LabelState = { mode: "off", expression: null, font: "Inter", size: 12, color: "#e8edf5", outline: "#05070a", offset: { x: 0, y: 0 }, alignment: "topCenter" };

