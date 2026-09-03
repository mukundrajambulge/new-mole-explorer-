import type {
  CanonicalAtom,
  CanonicalCoordinateState,
  CanonicalEditCommand,
  CanonicalHierarchy,
  CanonicalMolecularStructure,
  Coordinate3D,
  EditOperationKind,
  EditStateSelector,
  StructureLoadResult,
} from "@molecular/contracts";
import type { SelectionResult } from "../selection/selectionEngine";

export type ScientificDomain = "TOPOLOGY" | "COORDINATES" | "CHEMISTRY" | "IDENTITY" | "NAMESPACE" | "PRESENTATION";

export type InvalidationCategory =
  | "TOPOLOGY_SELECTION"
  | "SPATIAL_SELECTION"
  | "NEIGHBOR_ANALYSIS"
  | "RING_ANALYSIS"
  | "FRAGMENT_ANALYSIS"
  | "CONTACT_ANALYSIS"
  | "CLASH_ANALYSIS"
  | "HYDROGEN_BOND_ANALYSIS"
  | "MEASUREMENT"
  | "SURFACE_CACHE"
  | "ALIGNMENT_RESULT"
  | "SPATIAL_CACHE"
  | "GEOMETRY_CACHE"
  | "CHEMISTRY_ANALYSIS";

export type EntityKind = "ATOM" | "BOND" | "RESIDUE" | "COORDINATE_STATE";
export type EntityLineageOutcome = "PRESERVED" | "NEW" | "RETIRED" | "REPLACED" | "UNRESOLVED";

export type EntityLineageRecord = {
  entityKind: EntityKind;
  sourceId?: string;
  resultId?: string;
  outcome: EntityLineageOutcome;
};

export type IdentityTransition = {
  sourceIdentityId: string;
  resultIdentityId: string;
  outcome: "PRESERVED" | "DERIVED";
  reason: string;
};

export type InvalidationManifest = {
  changedDomains: readonly ScientificDomain[];
  staleArtifactCategories: readonly InvalidationCategory[];
  staleArtifactIds: readonly string[];
  presentationOnly: boolean;
};

export type ScientificProvenanceRecord = {
  provenanceRecordId: string;
  transactionId: string;
  commandId: string;
  operation: EditOperationKind | "ROOT" | "PRESENTATION_ONLY";
  objectId: string;
  baseRevisionId: string | null;
  resultRevisionId: string | null;
  producerId: string;
  producerVersion: string;
  requestedAt: string;
  actor?: string;
  metadata?: Readonly<Record<string, string>>;
};

export type ScientificEditCommand = CanonicalEditCommand & {
  /** The full immutable selection evidence is carried alongside its compact target reference. */
  selectionResult?: SelectionResult;
};

export type ScientificRevision = {
  schemaVersion: 1;
  revisionId: string;
  objectId: string;
  molecularIdentityId: string;
  scientificContentHash: string;
  loadResult: StructureLoadResult;
  parentRevisionId: string | null;
  parentRevisionIds: readonly string[];
  transactionId: string | null;
  operation: "ROOT" | EditOperationKind;
  changedDomains: readonly ScientificDomain[];
  invalidationManifest: InvalidationManifest;
  identityTransition: IdentityTransition;
  entityLineage: readonly EntityLineageRecord[];
  provenance: ScientificProvenanceRecord;
  stateOrder: readonly string[];
  currentStateId: string;
  sequence: number;
};

export type HistoryState = {
  objectId: string;
  currentRevisionId: string;
  parentRevisionId: string | null;
  childRevisionIds: readonly string[];
  retainedRevisionCount: number;
  canUndo: boolean;
  canRedo: boolean;
};

export type HistoryNavigationSuccess = {
  ok: true;
  operation: "UNDO" | "REDO";
  objectId: string;
  fromRevisionId: string;
  toRevisionId: string;
  revision: ScientificRevision;
  history: HistoryState;
};

export type HistoryNavigationFailure = {
  ok: false;
  operation: "UNDO" | "REDO";
  objectId: string;
  code: "HISTORY_UNAVAILABLE" | "UNDO_UNAVAILABLE" | "REDO_UNAVAILABLE" | "REDO_BRANCH_AMBIGUOUS";
  message: string;
  history: HistoryState | null;
};

export type HistoryNavigationResult = HistoryNavigationSuccess | HistoryNavigationFailure;

export type EditFailureCode =
  | "INVALID_EDIT_INPUT"
  | "STALE_BASE_REVISION"
  | "TARGET_NOT_FOUND"
  | "AMBIGUOUS_TARGET"
  | "INVALID_STATE_SCOPE"
  | "UNSUPPORTED_EDIT_OPERATION"
  | "MISSING_SCIENTIFIC_DEPENDENCY"
  | "TRANSACTION_VALIDATION_FAILED"
  | "REVISION_CONFLICT"
  | "HISTORY_UNAVAILABLE"
  | "INVALID_SELECTION";

export type EditFailure = {
  ok: false;
  outcome: "REJECTED";
  code: EditFailureCode;
  message: string;
  transactionId: string;
  objectId: string;
  baseRevisionId: string;
  invalidationManifest: InvalidationManifest;
};

export type EditSuccess = {
  ok: true;
  outcome: "COMMITTED";
  transactionId: string;
  objectId: string;
  baseRevisionId: string;
  resultRevisionId: string;
  revision: ScientificRevision;
  invalidationManifest: InvalidationManifest;
  identityTransition: IdentityTransition;
  entityLineage: readonly EntityLineageRecord[];
  provenanceRecordId: string;
  diagnostics: readonly string[];
};

export type EditResult = EditSuccess | EditFailure;

export type PresentationOnlyResult = {
  ok: true;
  objectId: string;
  scientificRevisionId: string;
  createdScientificRevision: false;
  invalidationManifest: InvalidationManifest;
};

type ObjectRevisionHistory = {
  objectId: string;
  nodes: Map<string, ScientificRevision>;
  children: Map<string, Set<string>>;
  currentRevisionId: string;
};

const EMPTY_INVALIDATION: InvalidationManifest = Object.freeze({
  changedDomains: Object.freeze([]),
  staleArtifactCategories: Object.freeze([]),
  staleArtifactIds: Object.freeze([]),
  presentationOnly: true,
});

const hash32 = (value: string, seed: number): string => {
  let result = seed;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
};

/** Stable key ordering keeps content/revision identifiers reproducible across runtimes. */
export const stableStringify = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
};

const stableHash = (value: unknown): string => {
  const serialized = stableStringify(value);
  return `${hash32(serialized, 2166136261)}${hash32(serialized, 2654435761)}`;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
};

const coordinateFor = (state: CanonicalCoordinateState, atom: CanonicalAtom): Coordinate3D => state.coordinates[atom.stableId] ?? { x: atom.x, y: atom.y, z: atom.z };

const stateForStructure = (structure: CanonicalMolecularStructure): CanonicalCoordinateState[] => {
  if (structure.coordinateStates?.length) return structure.coordinateStates.map(clone).sort((left, right) => left.ordinal - right.ordinal);
  return [{
    id: `${structure.id}:state:1`,
    ordinal: 1,
    sourceModelNumber: 1,
    coordinates: Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, { x: atom.x, y: atom.y, z: atom.z }])),
    coordinateHash: structure.scientificHash,
  }];
};

const stateOrderFor = (structure: CanonicalMolecularStructure, states: readonly CanonicalCoordinateState[]): string[] => {
  const available = new Set(states.map((state) => state.id));
  const declared = structure.stateOrder?.filter((stateId) => available.has(stateId)) ?? [];
  return declared.length ? declared : states.map((state) => state.id);
};

const atomsForState = (atoms: readonly CanonicalAtom[], state: CanonicalCoordinateState): CanonicalAtom[] => atoms.map((atom) => ({ ...atom, ...coordinateFor(state, atom) }));

const boundsFor = (atoms: readonly CanonicalAtom[]) => {
  const first = atoms[0] ?? { x: 0, y: 0, z: 0 };
  return atoms.reduce((current, atom) => ({
    min: { x: Math.min(current.min.x, atom.x), y: Math.min(current.min.y, atom.y), z: Math.min(current.min.z, atom.z) },
    max: { x: Math.max(current.max.x, atom.x), y: Math.max(current.max.y, atom.y), z: Math.max(current.max.z, atom.z) },
  }), { min: { x: first.x, y: first.y, z: first.z }, max: { x: first.x, y: first.y, z: first.z } });
};

const scientificAtomPayload = (atom: CanonicalAtom) => ({
  stableId: atom.stableId,
  atomName: atom.atomName,
  element: atom.element,
  residueName: atom.residueName,
  residueNumber: atom.residueNumber,
  insertionCode: atom.insertionCode ?? null,
  chain: atom.chain,
  segmentId: atom.segmentId ?? null,
  recordType: atom.recordType,
  isPolymer: atom.isPolymer,
  polymerType: atom.polymerType ?? null,
  isLigand: atom.isLigand,
  isWater: atom.isWater,
  isIon: atom.isIon,
  formalCharge: atom.formalCharge ?? null,
  altLoc: atom.altLoc ?? null,
});

const scientificPayloadFor = (structure: CanonicalMolecularStructure) => {
  const states = stateForStructure(structure);
  return {
    structureId: structure.id,
    atoms: structure.atoms.map(scientificAtomPayload),
    bonds: structure.bonds.map((bond) => ({ id: bond.id, atom1: bond.atom1, atom2: bond.atom2, order: bond.order, source: bond.source })),
    hierarchy: structure.hierarchy,
    coordinateStates: states.map((state) => ({ id: state.id, ordinal: state.ordinal, sourceModelNumber: state.sourceModelNumber ?? null, coordinates: state.coordinates })),
    stateOrder: stateOrderFor(structure, states),
    unitCell: structure.unitCell ?? null,
    chemistryDataset: structure.chemistryDataset ?? null,
    fragmentDataset: structure.fragmentDataset ?? null,
    partialChargeDataset: structure.partialChargeDataset ?? null,
    secondaryStructureDataset: structure.secondaryStructureDataset ?? null,
    peptideSequenceDataset: structure.peptideSequenceDataset ?? null,
  };
};

export const deterministicScientificContentHash = (structure: CanonicalMolecularStructure): string => `r07-content-${stableHash(scientificPayloadFor(structure))}`;

const identityIdFor = (structure: CanonicalMolecularStructure): string => `identity:${structure.id}:${stableHash({ atoms: structure.atoms.map(scientificAtomPayload), bonds: structure.bonds })}`;

const hierarchyFor = (atoms: readonly CanonicalAtom[], previous: CanonicalHierarchy): CanonicalHierarchy => {
  const atomIds = new Set(atoms.map((atom) => atom.stableId));
  const chains: CanonicalHierarchy["chains"] = {};
  const residues: CanonicalHierarchy["residues"] = {};
  for (const chainId of previous.chainIds) {
    const chain = previous.chains[chainId];
    if (!chain) continue;
    const residueIds = chain.residueIds.filter((residueId) => previous.residues[residueId]?.atomIds.some((atomId) => atomIds.has(atomId)));
    if (residueIds.length) chains[chainId] = { ...chain, residueIds };
  }
  for (const residueId of Object.keys(previous.residues)) {
    const residue = previous.residues[residueId]!;
    const residueAtomIds = residue.atomIds.filter((atomId) => atomIds.has(atomId));
    if (residueAtomIds.length) residues[residueId] = { ...residue, atomIds: residueAtomIds };
  }
  return { chainIds: Object.keys(chains), chains, residues };
};

const renderSourceFor = (structure: CanonicalMolecularStructure, states: readonly CanonicalCoordinateState[]): string => {
  const atomLine = (atom: CanonicalAtom, state: CanonicalCoordinateState) => {
    const coordinate = coordinateFor(state, atom);
    const record = atom.recordType.padEnd(6, " ");
    const name = atom.atomName.length < 4 ? ` ${atom.atomName.padEnd(3, " ")}` : atom.atomName.slice(0, 4);
    const residue = atom.residueName.slice(0, 3).padStart(3, " ");
    const chain = (atom.chain || " ").slice(0, 1);
    const residueNumber = String(atom.residueNumber).slice(-4).padStart(4, " ");
    const element = atom.element.slice(0, 2).toUpperCase().padStart(2, " ");
    return `${record}${String(atom.serial).slice(-5).padStart(5, " ")} ${name} ${residue} ${chain}${residueNumber}    ${coordinate.x.toFixed(3).padStart(8, " ")}${coordinate.y.toFixed(3).padStart(8, " ")}${coordinate.z.toFixed(3).padStart(8, " ")}  1.00 ${(atom.bFactor ?? 0).toFixed(2).padStart(6, " ")}          ${element}`;
  };
  const lines: string[] = [];
  states.forEach((state, index) => {
    if (states.length > 1) lines.push(`MODEL     ${String(state.sourceModelNumber ?? index + 1).padStart(4, " ")}`);
    structure.atoms.forEach((atom) => lines.push(atomLine(atom, state)));
    structure.bonds.forEach((bond) => {
      const first = structure.atoms.find((atom) => atom.stableId === bond.atom1)?.serial;
      const second = structure.atoms.find((atom) => atom.stableId === bond.atom2)?.serial;
      if (first !== undefined && second !== undefined) lines.push(`CONECT${String(first).padStart(5, " ")}${String(second).padStart(5, " ")}`);
    });
    if (states.length > 1) lines.push("ENDMDL");
  });
  lines.push("END");
  return `${lines.join("\n")}\n`;
};

const rebindDatasets = (structure: CanonicalMolecularStructure, revisionId: string): CanonicalMolecularStructure => ({
  ...structure,
  ...(structure.chemistryDataset ? { chemistryDataset: { ...structure.chemistryDataset, molecularRevision: revisionId } } : {}),
  ...(structure.fragmentDataset ? { fragmentDataset: { ...structure.fragmentDataset, molecularRevision: revisionId } } : {}),
  ...(structure.partialChargeDataset ? { partialChargeDataset: { ...structure.partialChargeDataset, molecularRevision: revisionId } } : {}),
  ...(structure.secondaryStructureDataset ? { secondaryStructureDataset: { ...structure.secondaryStructureDataset, molecularRevision: revisionId } } : {}),
  ...(structure.peptideSequenceDataset ? { peptideSequenceDataset: { ...structure.peptideSequenceDataset, molecularRevision: revisionId } } : {}),
});

const coordinateEditParameters = (command: ScientificEditCommand): { coordinates?: Record<string, unknown>; coordinatesByState?: Record<string, Record<string, unknown>> } | null => {
  const value = command.parameters;
  if (value && typeof value === "object" && ("coordinates" in value || "coordinatesByState" in value)) return value as { coordinates?: Record<string, unknown>; coordinatesByState?: Record<string, Record<string, unknown>> };
  return null;
};

const validCoordinate = (value: unknown): value is Coordinate3D => Boolean(value) && typeof value === "object" && Number.isFinite((value as Coordinate3D).x) && Number.isFinite((value as Coordinate3D).y) && Number.isFinite((value as Coordinate3D).z);

const stateSelectorText = (selector: EditStateSelector): string => selector.kind === "COORDINATE_STATE_ID" ? selector.stateId : selector.kind === "EXPLICIT_ORDINAL" ? String(selector.ordinal) : selector.kind;

const resolveStateIds = (revision: ScientificRevision, selector: EditStateSelector): { ids: string[] } | { code: "INVALID_STATE_SCOPE"; message: string } => {
  const states = stateForStructure(revision.loadResult.structure);
  const byId = new Map(states.map((state) => [state.id, state]));
  const ordered = revision.stateOrder.filter((stateId) => byId.has(stateId));
  if (selector.kind === "COORDINATE_STATE_ID") return byId.has(selector.stateId) ? { ids: [selector.stateId] } : { code: "INVALID_STATE_SCOPE", message: `CoordinateStateID ${selector.stateId} is not present on object ${revision.objectId}.` };
  if (selector.kind === "EXPLICIT_ORDINAL") {
    if (!Number.isInteger(selector.ordinal) || selector.ordinal < 1) return { code: "INVALID_STATE_SCOPE", message: "An explicit state ordinal must be a positive integer." };
    const stateId = ordered[selector.ordinal - 1];
    return stateId ? { ids: [stateId] } : { code: "INVALID_STATE_SCOPE", message: `State ordinal ${selector.ordinal} is not present on object ${revision.objectId}.` };
  }
  if (selector.kind === "CURRENT") return byId.has(revision.currentStateId) ? { ids: [revision.currentStateId] } : { code: "INVALID_STATE_SCOPE", message: `Current CoordinateStateID ${revision.currentStateId} is not present on object ${revision.objectId}.` };
  if (selector.kind === "ALL") return ordered.length ? { ids: ordered } : { code: "INVALID_STATE_SCOPE", message: `Object ${revision.objectId} has no coordinate states.` };
  return { code: "INVALID_STATE_SCOPE", message: `State selector ${stateSelectorText(selector)} is not valid for coordinate editing; resolve it to an explicit state or ALL first.` };
};

export const invalidationManifestFor = (changedDomains: readonly ScientificDomain[], staleArtifactIds: readonly string[] = []): InvalidationManifest => {
  const categories = new Set<InvalidationCategory>();
  if (changedDomains.includes("TOPOLOGY") || changedDomains.includes("IDENTITY")) {
    ["TOPOLOGY_SELECTION", "NEIGHBOR_ANALYSIS", "RING_ANALYSIS", "FRAGMENT_ANALYSIS", "CONTACT_ANALYSIS", "CLASH_ANALYSIS", "HYDROGEN_BOND_ANALYSIS", "SURFACE_CACHE", "GEOMETRY_CACHE"].forEach((category) => categories.add(category as InvalidationCategory));
  }
  if (changedDomains.includes("COORDINATES")) {
    ["SPATIAL_SELECTION", "MEASUREMENT", "CONTACT_ANALYSIS", "CLASH_ANALYSIS", "HYDROGEN_BOND_ANALYSIS", "ALIGNMENT_RESULT", "SPATIAL_CACHE", "GEOMETRY_CACHE", "SURFACE_CACHE"].forEach((category) => categories.add(category as InvalidationCategory));
  }
  if (changedDomains.includes("CHEMISTRY")) categories.add("CHEMISTRY_ANALYSIS");
  return {
    changedDomains: [...changedDomains],
    staleArtifactCategories: [...categories],
    staleArtifactIds: [...staleArtifactIds],
    presentationOnly: changedDomains.length === 0 || changedDomains.every((domain) => domain === "PRESENTATION"),
  };
};

const makeTransactionId = (command: CanonicalEditCommand): string => `transaction:${stableHash({ objectId: command.objectId, baseRevisionId: command.baseRevisionId, operation: command.operation, target: command.target, stateScope: command.stateScope, parameters: command.parameters })}`;

const fail = (code: EditFailureCode, message: string, command: ScientificEditCommand, transactionId: string): EditFailure => ({ ok: false, outcome: "REJECTED", code, message, transactionId, objectId: command.objectId, baseRevisionId: command.baseRevisionId, invalidationManifest: EMPTY_INVALIDATION });

const freezeLoadResult = (loadResult: StructureLoadResult): StructureLoadResult => deepFreeze(clone(loadResult));

const lineageFor = (parent: CanonicalMolecularStructure, child: CanonicalMolecularStructure): EntityLineageRecord[] => [
  ...parent.atoms.map((atom) => ({ entityKind: "ATOM" as const, sourceId: atom.stableId, resultId: child.atoms.some((candidate) => candidate.stableId === atom.stableId) ? atom.stableId : undefined, outcome: child.atoms.some((candidate) => candidate.stableId === atom.stableId) ? "PRESERVED" as const : "RETIRED" as const })),
  ...parent.bonds.map((bond) => ({ entityKind: "BOND" as const, sourceId: bond.id, resultId: child.bonds.some((candidate) => candidate.id === bond.id) ? bond.id : undefined, outcome: child.bonds.some((candidate) => candidate.id === bond.id) ? "PRESERVED" as const : "RETIRED" as const })),
  ...parent.hierarchy.chainIds.flatMap((chainId) => parent.hierarchy.chains[chainId]?.residueIds ?? []).map((residueId) => ({ entityKind: "RESIDUE" as const, sourceId: residueId, resultId: child.hierarchy.residues[residueId] ? residueId : undefined, outcome: child.hierarchy.residues[residueId] ? "PRESERVED" as const : "RETIRED" as const })),
];

export const createCoordinateEditCommand = (input: {
  objectId: string;
  baseRevisionId: string;
  selectionResult?: SelectionResult;
  stableAtomIds?: readonly string[];
  stateScope: EditStateSelector;
  coordinates?: Readonly<Record<string, Coordinate3D>>;
  coordinatesByState?: Readonly<Record<string, Readonly<Record<string, Coordinate3D>>>>;
  origin: CanonicalEditCommand["origin"];
  provenance?: Partial<CanonicalEditCommand["provenance"]>;
  commandId?: string;
}): ScientificEditCommand => {
  const atomIds = input.stableAtomIds ?? input.selectionResult?.stableAtomIds ?? [];
  const parameters: Record<string, unknown> = {};
  if (input.coordinates) parameters.coordinates = input.coordinates;
  if (input.coordinatesByState) parameters.coordinatesByState = input.coordinatesByState;
  const target = { objectId: input.objectId, atomIds: [...atomIds], ...(input.selectionResult ? { selectionResultId: input.selectionResult.resultId } : {}) };
  const commandFingerprint = { operation: "APPLY_COORDINATE_EDIT", objectId: input.objectId, baseRevisionId: input.baseRevisionId, stateScope: input.stateScope, target, parameters };
  return {
    schemaVersion: 1,
    commandId: input.commandId ?? `command:${stableHash(commandFingerprint)}`,
    operation: "APPLY_COORDINATE_EDIT",
    objectId: input.objectId,
    baseRevisionId: input.baseRevisionId,
    stateScope: input.stateScope,
    target,
    parameters,
    origin: input.origin,
    provenance: { producerId: "molecular-workstation.r07", producerVersion: "1", requestedAt: new Date().toISOString(), ...input.provenance },
    ...(input.selectionResult ? { selectionResult: input.selectionResult } : {}),
  };
};

export class EditTransaction {
  constructor(private readonly history: ObjectRevisionHistory, private readonly command: ScientificEditCommand) {}

  commit(): EditResult {
    const transactionId = makeTransactionId(this.command);
    const current = this.history.nodes.get(this.history.currentRevisionId);
    if (!current) return fail("HISTORY_UNAVAILABLE", `No current revision is retained for object ${this.command.objectId}.`, this.command, transactionId);
    if (this.command.schemaVersion !== 1 || !this.command.commandId || !this.command.objectId || !this.command.baseRevisionId) return fail("INVALID_EDIT_INPUT", "A canonical edit command requires schema, command ID, object ID and base revision.", this.command, transactionId);
    if (this.command.objectId !== this.history.objectId || (this.command.target.objectId && this.command.target.objectId !== this.history.objectId)) return fail("REVISION_CONFLICT", `Command target object ${this.command.target.objectId ?? this.command.objectId} does not match transaction object ${this.history.objectId}.`, this.command, transactionId);
    if (this.command.baseRevisionId !== current.revisionId) return fail("STALE_BASE_REVISION", `Expected base revision ${this.command.baseRevisionId}, but object ${this.command.objectId} is at ${current.revisionId}.`, this.command, transactionId);
    if (this.command.operation !== "APPLY_COORDINATE_EDIT") return fail("UNSUPPORTED_EDIT_OPERATION", `${this.command.operation} is typed but not implemented in R07-B1.`, this.command, transactionId);

    const baseStructure = current.loadResult.structure;
    const selection = this.command.selectionResult;
    if (selection) {
      if (selection.status !== "VALID_NONEMPTY" && selection.status !== "VALID_EMPTY") return fail("INVALID_SELECTION", `Selection ${selection.resultId} is not a valid materialized selection.`, this.command, transactionId);
      if (selection.structureId !== baseStructure.id || selection.molecularRevision !== baseStructure.scientificHash) return fail("STALE_BASE_REVISION", `Selection ${selection.resultId} is bound to a different molecular revision.`, this.command, transactionId);
      if (this.command.target.selectionResultId !== selection.resultId) return fail("INVALID_EDIT_INPUT", "The compact selection reference does not match the supplied SelectionResult.", this.command, transactionId);
    }
    const requestedAtomIds = this.command.target.atomIds ?? selection?.stableAtomIds ?? [];
    if (!requestedAtomIds.length) return fail("INVALID_EDIT_INPUT", "A coordinate edit requires at least one stable AtomUID target.", this.command, transactionId);
    if (new Set(requestedAtomIds).size !== requestedAtomIds.length) return fail("AMBIGUOUS_TARGET", "A coordinate edit cannot contain duplicate stable AtomUID targets.", this.command, transactionId);
    const atomIds = new Set(baseStructure.atoms.map((atom) => atom.stableId));
    const missingAtomId = requestedAtomIds.find((atomId) => !atomIds.has(atomId));
    if (missingAtomId) return fail("TARGET_NOT_FOUND", `Stable AtomUID ${missingAtomId} is not present in revision ${current.revisionId}.`, this.command, transactionId);

    const stateResolution = resolveStateIds(current, this.command.stateScope);
    if ("code" in stateResolution) return fail(stateResolution.code, stateResolution.message, this.command, transactionId);
    const parameters = coordinateEditParameters(this.command);
    if (!parameters) return fail("INVALID_EDIT_INPUT", "APPLY_COORDINATE_EDIT requires coordinates or coordinatesByState parameters.", this.command, transactionId);
    if (stateResolution.ids.length > 1 && !parameters.coordinatesByState) return fail("INVALID_STATE_SCOPE", "ALL coordinate edits require an explicit patch for every selected CoordinateState; coordinates are never cloned implicitly.", this.command, transactionId);

    const states = stateForStructure(baseStructure);
    const selectedStateIds = new Set(stateResolution.ids);
    const patchesByState = new Map<string, Record<string, Coordinate3D>>();
    for (const stateId of stateResolution.ids) {
      const sourcePatch = parameters.coordinatesByState?.[stateId] ?? parameters.coordinates;
      if (!sourcePatch) return fail("INVALID_STATE_SCOPE", `No explicit coordinate patch was supplied for CoordinateStateID ${stateId}.`, this.command, transactionId);
      const patch: Record<string, Coordinate3D> = {};
      for (const atomId of requestedAtomIds) {
        const coordinate = sourcePatch[atomId];
        if (!validCoordinate(coordinate)) return fail("TRANSACTION_VALIDATION_FAILED", `Coordinate patch for AtomUID ${atomId} in state ${stateId} must contain finite x, y and z values.`, this.command, transactionId);
        patch[atomId] = { x: coordinate.x, y: coordinate.y, z: coordinate.z };
      }
      const unknownPatchedAtom = Object.keys(sourcePatch).find((atomId) => !atomIds.has(atomId));
      if (unknownPatchedAtom) return fail("TARGET_NOT_FOUND", `Coordinate patch references unknown stable AtomUID ${unknownPatchedAtom}.`, this.command, transactionId);
      patchesByState.set(stateId, patch);
    }

    const changed = states.some((state) => {
      const patch = patchesByState.get(state.id);
      return patch ? Object.entries(patch).some(([atomId, coordinate]) => stableStringify(state.coordinates[atomId] ?? null) !== stableStringify(coordinate)) : false;
    });
    if (!changed) return fail("TRANSACTION_VALIDATION_FAILED", "The coordinate edit would not change scientific coordinates; no child revision was published.", this.command, transactionId);

    const nextStates = states.map((state) => {
      const patch = selectedStateIds.has(state.id) ? patchesByState.get(state.id) ?? {} : {};
      return { ...state, coordinates: { ...state.coordinates, ...patch }, coordinateHash: `r07-state-${stableHash({ stateId: state.id, coordinates: { ...state.coordinates, ...patch } })}` };
    });
    const firstState = nextStates.find((state) => state.id === current.stateOrder[0]) ?? nextStates[0]!;
    const nextAtoms = atomsForState(baseStructure.atoms, firstState);
    const nextStructureBase: CanonicalMolecularStructure = {
      ...clone(baseStructure),
      atoms: nextAtoms,
      bounds: boundsFor(nextAtoms),
      hierarchy: hierarchyFor(nextAtoms, baseStructure.hierarchy),
      coordinateStates: nextStates,
      stateOrder: [...current.stateOrder],
    };
    const contentHash = deterministicScientificContentHash(nextStructureBase);
    const revisionId = `r07-revision-${stableHash({ parentRevisionId: current.revisionId, operation: this.command.operation, target: this.command.target, stateScope: this.command.stateScope, parameters: this.command.parameters, contentHash })}`;
    const nextStructure = rebindDatasets({ ...nextStructureBase, scientificHash: revisionId }, revisionId);
    const nextLoadResult: StructureLoadResult = freezeLoadResult(nextLoadResultFrom(nextStructure, nextStates));
    const invalidationManifest = invalidationManifestFor(["COORDINATES"]);
    const entityLineage = lineageFor(baseStructure, nextStructure);
    const provenance: ScientificProvenanceRecord = {
      provenanceRecordId: `provenance:${transactionId}`,
      transactionId,
      commandId: this.command.commandId,
      operation: this.command.operation,
      objectId: this.command.objectId,
      baseRevisionId: current.revisionId,
      resultRevisionId: revisionId,
      producerId: this.command.provenance.producerId,
      producerVersion: this.command.provenance.producerVersion,
      requestedAt: this.command.provenance.requestedAt,
      ...(this.command.provenance.actor ? { actor: this.command.provenance.actor } : {}),
      ...(this.command.provenance.metadata ? { metadata: this.command.provenance.metadata } : {}),
    };
    const revision: ScientificRevision = deepFreeze({
      schemaVersion: 1,
      revisionId,
      objectId: this.command.objectId,
      molecularIdentityId: current.molecularIdentityId,
      scientificContentHash: contentHash,
      loadResult: nextLoadResult,
      parentRevisionId: current.revisionId,
      parentRevisionIds: [current.revisionId],
      transactionId,
      operation: this.command.operation,
      changedDomains: ["COORDINATES"],
      invalidationManifest,
      identityTransition: { sourceIdentityId: current.molecularIdentityId, resultIdentityId: current.molecularIdentityId, outcome: "PRESERVED", reason: "Coordinate-only edits preserve MolecularIdentity while creating a new scientific revision." },
      entityLineage,
      provenance,
      stateOrder: [...current.stateOrder],
      currentStateId: current.currentStateId,
      sequence: current.sequence + 1,
    });
    // Publication is the final operation: all validation and candidate construction happened above.
    this.history.nodes.set(revisionId, revision);
    this.history.children.set(revisionId, new Set());
    const parentChildren = this.history.children.get(current.revisionId) ?? new Set<string>();
    parentChildren.add(revisionId);
    this.history.children.set(current.revisionId, parentChildren);
    this.history.currentRevisionId = revisionId;
    return { ok: true, outcome: "COMMITTED", transactionId, objectId: this.command.objectId, baseRevisionId: current.revisionId, resultRevisionId: revisionId, revision, invalidationManifest, identityTransition: revision.identityTransition, entityLineage, provenanceRecordId: provenance.provenanceRecordId, diagnostics: [`CoordinateState scope: ${stateResolution.ids.join(", ")}`, "Scientific candidate validated before publication."] };
  }
}

const nextLoadResultFrom = (structure: CanonicalMolecularStructure, states: readonly CanonicalCoordinateState[]): StructureLoadResult => ({
  structure,
  renderSource: { format: "pdb", content: renderSourceFor(structure, states) },
});

export class ScientificHistoryService {
  private readonly histories = new Map<string, ObjectRevisionHistory>();

  registerRoot(objectId: string, loadResult: StructureLoadResult, currentStateId?: string): ScientificRevision {
    if (!objectId.trim()) throw new Error("A scientific history root requires an ObjectID.");
    const structure = freezeLoadResult(loadResult);
    const states = stateForStructure(structure.structure);
    const stateOrder = stateOrderFor(structure.structure, states);
    const revisionId = structure.structure.scientificHash || `r07-root-${deterministicScientificContentHash(structure.structure)}`;
    const identityId = identityIdFor(structure.structure);
    const transactionId = `transaction:root:${stableHash({ objectId, revisionId })}`;
    const revision: ScientificRevision = deepFreeze({
      schemaVersion: 1,
      revisionId,
      objectId,
      molecularIdentityId: identityId,
      scientificContentHash: deterministicScientificContentHash(structure.structure),
      loadResult: structure,
      parentRevisionId: null,
      parentRevisionIds: [],
      transactionId: null,
      operation: "ROOT",
      changedDomains: [],
      invalidationManifest: EMPTY_INVALIDATION,
      identityTransition: { sourceIdentityId: identityId, resultIdentityId: identityId, outcome: "PRESERVED", reason: "Imported canonical structure root." },
      entityLineage: [],
      provenance: { provenanceRecordId: `provenance:${transactionId}`, transactionId, commandId: "root", operation: "ROOT", objectId, baseRevisionId: null, resultRevisionId: revisionId, producerId: "molecular-workstation.ingestion", producerVersion: "1", requestedAt: structure.structure.source.ingestedAt },
      stateOrder,
      currentStateId: currentStateId && stateOrder.includes(currentStateId) ? currentStateId : stateOrder[0]!,
      sequence: 0,
    });
    this.histories.set(objectId, { objectId, nodes: new Map([[revisionId, revision]]), children: new Map([[revisionId, new Set()]]), currentRevisionId: revisionId });
    return revision;
  }

  hasObject(objectId: string): boolean { return this.histories.has(objectId); }

  currentRevision(objectId: string): ScientificRevision | null {
    const history = this.histories.get(objectId);
    return history?.nodes.get(history.currentRevisionId) ?? null;
  }

  revision(objectId: string, revisionId: string): ScientificRevision | null { return this.histories.get(objectId)?.nodes.get(revisionId) ?? null; }

  historyState(objectId: string): HistoryState | null {
    const history = this.histories.get(objectId);
    const current = history?.nodes.get(history.currentRevisionId);
    if (!history || !current) return null;
    return { objectId, currentRevisionId: current.revisionId, parentRevisionId: current.parentRevisionId, childRevisionIds: [...(history.children.get(current.revisionId) ?? [])], retainedRevisionCount: history.nodes.size, canUndo: current.parentRevisionId !== null, canRedo: (history.children.get(current.revisionId)?.size ?? 0) > 0 };
  }

  execute(command: ScientificEditCommand): EditResult {
    const history = this.histories.get(command.objectId);
    if (!history) return fail("HISTORY_UNAVAILABLE", `No scientific history is registered for object ${command.objectId}.`, command, makeTransactionId(command));
    return new EditTransaction(history, command).commit();
  }

  undo(objectId: string): HistoryNavigationResult {
    const history = this.histories.get(objectId);
    const current = history?.nodes.get(history.currentRevisionId);
    if (!history || !current) return { ok: false, operation: "UNDO", objectId, code: "HISTORY_UNAVAILABLE", message: `No scientific history is registered for object ${objectId}.`, history: null };
    if (!current.parentRevisionId) return { ok: false, operation: "UNDO", objectId, code: "UNDO_UNAVAILABLE", message: `Undo is unavailable at root revision ${current.revisionId}.`, history: this.historyState(objectId) };
    history.currentRevisionId = current.parentRevisionId;
    return { ok: true, operation: "UNDO", objectId, fromRevisionId: current.revisionId, toRevisionId: history.currentRevisionId, revision: history.nodes.get(history.currentRevisionId)!, history: this.historyState(objectId)! };
  }

  redo(objectId: string, childRevisionId?: string): HistoryNavigationResult {
    const history = this.histories.get(objectId);
    const current = history?.nodes.get(history.currentRevisionId);
    if (!history || !current) return { ok: false, operation: "REDO", objectId, code: "HISTORY_UNAVAILABLE", message: `No scientific history is registered for object ${objectId}.`, history: null };
    const children = [...(history.children.get(current.revisionId) ?? [])];
    if (!children.length) return { ok: false, operation: "REDO", objectId, code: "REDO_UNAVAILABLE", message: `Redo is unavailable at revision ${current.revisionId}.`, history: this.historyState(objectId) };
    const target = childRevisionId ? children.find((revisionId) => revisionId === childRevisionId) : children.length === 1 ? children[0] : undefined;
    if (!target) return { ok: false, operation: "REDO", objectId, code: children.length > 1 ? "REDO_BRANCH_AMBIGUOUS" : "REDO_UNAVAILABLE", message: children.length > 1 ? `Redo is ambiguous at ${current.revisionId}; choose one retained child revision.` : `Redo child revision ${childRevisionId ?? ""} is not available.`, history: this.historyState(objectId) };
    history.currentRevisionId = target;
    return { ok: true, operation: "REDO", objectId, fromRevisionId: current.revisionId, toRevisionId: target, revision: history.nodes.get(target)!, history: this.historyState(objectId)! };
  }

  presentationOnly(objectId: string): PresentationOnlyResult | EditFailure {
    const current = this.currentRevision(objectId);
    if (!current) return { ok: false, outcome: "REJECTED", code: "HISTORY_UNAVAILABLE", message: `No scientific history is registered for object ${objectId}.`, transactionId: `transaction:presentation:${objectId}`, objectId, baseRevisionId: "", invalidationManifest: EMPTY_INVALIDATION };
    return { ok: true, objectId, scientificRevisionId: current.revisionId, createdScientificRevision: false, invalidationManifest: invalidationManifestFor(["PRESENTATION"]) };
  }

  /** Serializable reference graph for the future R09 persistence layer; canonical payloads remain in loadResult revisions. */
  persistenceManifest(objectId: string): { schemaVersion: 1; objectId: string; currentRevisionId: string; retainedRevisionIds: readonly string[]; parentByRevision: Readonly<Record<string, string | null>> } | null {
    const history = this.histories.get(objectId);
    if (!history) return null;
    return { schemaVersion: 1, objectId, currentRevisionId: history.currentRevisionId, retainedRevisionIds: [...history.nodes.keys()], parentByRevision: Object.fromEntries([...history.nodes.values()].map((revision) => [revision.revisionId, revision.parentRevisionId])) };
  }
}
