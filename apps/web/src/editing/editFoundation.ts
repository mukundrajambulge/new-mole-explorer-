import type {
  CanonicalAtom,
  CanonicalBond,
  CanonicalCoordinateState,
  CanonicalEditCommand,
  CanonicalHierarchy,
  CanonicalMolecularStructure,
  Coordinate3D,
  BondOrder,
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
  | "CHEMISTRY_ANALYSIS"
  | "STRUCTURAL_ANALYSIS"
  | "DOCKING_PREPARATION";

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
  | "INVALID_SELECTION"
  | "EMPTY_SELECTION"
  | "CROSS_OBJECT_TOPOLOGY_UNSUPPORTED"
  | "SELF_BOND"
  | "DUPLICATE_BOND"
  | "BOND_NOT_FOUND"
  | "UNSUPPORTED_BOND_ORDER"
  | "CHEMISTRY_AMBIGUOUS"
  | "CHEMISTRY_UNSUPPORTED";

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

const countsFor = (atoms: readonly CanonicalAtom[], hierarchy: CanonicalHierarchy) => ({
  atoms: atoms.length,
  residues: Object.keys(hierarchy.residues).length,
  chains: hierarchy.chainIds.length,
  polymerAtoms: atoms.filter((atom) => atom.isPolymer).length,
  ligandAtoms: atoms.filter((atom) => atom.isLigand).length,
  waterAtoms: atoms.filter((atom) => atom.isWater).length,
  ionAtoms: atoms.filter((atom) => atom.isIon).length,
  otherAtoms: atoms.filter((atom) => !atom.isPolymer && !atom.isLigand && !atom.isWater && !atom.isIon).length,
});

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

const rebindDatasets = (structure: CanonicalMolecularStructure, revisionId: string): CanonicalMolecularStructure => {
  const atomIds = new Set(structure.atoms.map((atom) => atom.stableId));
  const residueIds = new Set(Object.keys(structure.hierarchy.residues));
  const chemistryDataset = structure.chemistryDataset ? {
    ...structure.chemistryDataset,
    molecularRevision: revisionId,
    donorAtomIds: structure.chemistryDataset.donorAtomIds.filter((id) => atomIds.has(id)),
    acceptorAtomIds: structure.chemistryDataset.acceptorAtomIds.filter((id) => atomIds.has(id)),
  } : undefined;
  const fragmentDataset = structure.fragmentDataset ? {
    ...structure.fragmentDataset,
    molecularRevision: revisionId,
    atomFragmentMap: Object.fromEntries(Object.entries(structure.fragmentDataset.atomFragmentMap).filter(([atomId]) => atomIds.has(atomId))),
  } : undefined;
  const partialChargeDataset = structure.partialChargeDataset ? {
    ...structure.partialChargeDataset,
    molecularRevision: revisionId,
    atomChargeMap: Object.fromEntries(Object.entries(structure.partialChargeDataset.atomChargeMap).filter(([atomId]) => atomIds.has(atomId))),
  } : undefined;
  const peptideSequenceDataset = structure.peptideSequenceDataset ? {
    ...structure.peptideSequenceDataset,
    molecularRevision: revisionId,
    chains: Object.fromEntries(Object.entries(structure.peptideSequenceDataset.chains).map(([chainId, chain]) => {
      const kept = chain.residueIds.flatMap((residueId, index) => residueIds.has(residueId) ? [{ residueId, index }] : []);
      return [chainId, { residueIds: kept.map((entry) => entry.residueId), sequence: kept.map((entry) => chain.sequence[entry.index] ?? "").join("") }];
    }).filter(([, chain]) => (chain as { residueIds: string[] }).residueIds.length > 0)),
  } : undefined;
  return {
    ...structure,
    ...(chemistryDataset ? { chemistryDataset } : {}),
    ...(fragmentDataset ? { fragmentDataset } : {}),
    ...(partialChargeDataset ? { partialChargeDataset } : {}),
    ...(structure.secondaryStructureDataset ? { secondaryStructureDataset: { ...structure.secondaryStructureDataset, molecularRevision: revisionId } } : {}),
    ...(peptideSequenceDataset ? { peptideSequenceDataset } : {}),
  };
};

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
    ["TOPOLOGY_SELECTION", "NEIGHBOR_ANALYSIS", "RING_ANALYSIS", "FRAGMENT_ANALYSIS", "CONTACT_ANALYSIS", "CLASH_ANALYSIS", "HYDROGEN_BOND_ANALYSIS", "SURFACE_CACHE", "GEOMETRY_CACHE", "CHEMISTRY_ANALYSIS", "STRUCTURAL_ANALYSIS", "DOCKING_PREPARATION"].forEach((category) => categories.add(category as InvalidationCategory));
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

const topologyLineageFor = (parent: CanonicalMolecularStructure, child: CanonicalMolecularStructure, operation: EditOperationKind, replacedBond?: { sourceId: string; resultId: string }): EntityLineageRecord[] => {
  const records = lineageFor(parent, child);
  if (operation === "EDIT_ADD_BOND") {
    const added = child.bonds.find((bond) => !parent.bonds.some((candidate) => candidate.id === bond.id));
    if (added) records.push({ entityKind: "BOND", resultId: added.id, outcome: "NEW" });
  }
  if (replacedBond) {
    const source = records.find((record) => record.entityKind === "BOND" && record.sourceId === replacedBond.sourceId);
    if (source) { source.outcome = "REPLACED"; source.resultId = replacedBond.resultId; }
    records.push({ entityKind: "BOND", resultId: replacedBond.resultId, outcome: "NEW" });
  }
  return records;
};

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

type TopologyCommandInput = {
  objectId: string;
  baseRevisionId: string;
  selectionResult: SelectionResult;
  atomIds: readonly string[];
  origin: CanonicalEditCommand["origin"];
  provenance?: Partial<CanonicalEditCommand["provenance"]>;
  commandId?: string;
  objectIds?: readonly string[];
  parameters?: Readonly<Record<string, unknown>>;
};

const createTopologyCommand = (input: TopologyCommandInput, operation: Extract<EditOperationKind, "EDIT_DELETE_ATOMS" | "EDIT_ADD_BOND" | "EDIT_DELETE_BOND" | "EDIT_REPLACE_BOND_SEMANTICS">): ScientificEditCommand => {
  const target = { objectId: input.objectId, atomIds: [...input.atomIds], ...(input.objectIds ? { objectIds: [...input.objectIds] } : {}), selectionResultId: input.selectionResult.resultId };
  const parameters = { ...(input.parameters ?? {}) };
  const fingerprint = { operation, objectId: input.objectId, baseRevisionId: input.baseRevisionId, stateScope: { kind: "ALL" as const }, target, parameters };
  return {
    schemaVersion: 1,
    commandId: input.commandId ?? `command:${stableHash(fingerprint)}`,
    operation,
    objectId: input.objectId,
    baseRevisionId: input.baseRevisionId,
    stateScope: { kind: "ALL" },
    target,
    parameters,
    origin: input.origin,
    provenance: { producerId: "molecular-workstation.r07", producerVersion: "2", requestedAt: new Date().toISOString(), ...input.provenance },
    selectionResult: input.selectionResult,
  };
};

export const createDeleteAtomsCommand = (input: Omit<TopologyCommandInput, "parameters" | "objectIds">): ScientificEditCommand => createTopologyCommand(input, "EDIT_DELETE_ATOMS");

export const createAddBondCommand = (input: Omit<TopologyCommandInput, "parameters"> & { order: Exclude<BondOrder, "UNKNOWN">; objectIds?: readonly string[] }): ScientificEditCommand => createTopologyCommand({ ...input, parameters: { order: input.order } }, "EDIT_ADD_BOND");

export const createDeleteBondCommand = (input: Omit<TopologyCommandInput, "parameters" | "objectIds"> & { bondId?: string; objectIds?: readonly string[] }): ScientificEditCommand => createTopologyCommand({ ...input, parameters: input.bondId ? { bondId: input.bondId } : {} }, "EDIT_DELETE_BOND");

export const createReplaceBondSemanticsCommand = (input: Omit<TopologyCommandInput, "parameters"> & { order: Exclude<BondOrder, "UNKNOWN">; bondId?: string; objectIds?: readonly string[] }): ScientificEditCommand => createTopologyCommand({ ...input, parameters: { order: input.order, ...(input.bondId ? { bondId: input.bondId } : {}) } }, "EDIT_REPLACE_BOND_SEMANTICS");

const topologyOperations = new Set<EditOperationKind>(["EDIT_DELETE_ATOMS", "EDIT_ADD_BOND", "EDIT_DELETE_BOND", "EDIT_REPLACE_BOND_SEMANTICS"]);
const supportedBondOrders = new Set<Exclude<BondOrder, "UNKNOWN">>(["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"]);
const bondWeight = (order: BondOrder): number => order === "DOUBLE" ? 2 : order === "TRIPLE" ? 3 : order === "AROMATIC" ? 1.5 : 1;
const valenceCeiling = (element: string): number => {
  const normalized = element.trim().toUpperCase();
  if (normalized === "H") return 1;
  if (normalized === "B") return 3;
  if (normalized === "C") return 4;
  if (normalized === "N") return 4;
  if (normalized === "O") return 2;
  if (["F", "CL", "BR", "I"].includes(normalized)) return 1;
  if (["P", "S"].includes(normalized)) return 6;
  return 8;
};
const endpointKey = (left: string, right: string): string => [left, right].sort().join("\u0000");
const endpointsFor = (bond: CanonicalBond): string => endpointKey(bond.atom1, bond.atom2);
const sameIds = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && new Set(left).size === left.length && left.every((id) => right.includes(id));
const commandOrder = (command: ScientificEditCommand): BondOrder | null => {
  const order = command.parameters.order;
  return typeof order === "string" && supportedBondOrders.has(order as Exclude<BondOrder, "UNKNOWN">) ? order as Exclude<BondOrder, "UNKNOWN"> : null;
};
const objectIdsForCommand = (command: ScientificEditCommand): readonly string[] => command.target.objectIds ?? [command.objectId];

export class EditTransaction {
  constructor(private readonly history: ObjectRevisionHistory, private readonly command: ScientificEditCommand) {}

  commit(): EditResult {
    if (topologyOperations.has(this.command.operation)) return this.commitTopologyEdit();
    return this.commitCoordinateEdit();
  }

  private commitCoordinateEdit(): EditResult {
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
    const invalidationManifest = invalidationManifestFor(["COORDINATES"], [...requestedAtomIds, ...(selection ? [selection.resultId] : [])]);
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

  private commitTopologyEdit(): EditResult {
    const transactionId = makeTransactionId(this.command);
    const current = this.history.nodes.get(this.history.currentRevisionId);
    if (!current) return fail("HISTORY_UNAVAILABLE", `No current revision is retained for object ${this.command.objectId}.`, this.command, transactionId);
    if (this.command.schemaVersion !== 1 || !this.command.commandId || !this.command.objectId || !this.command.baseRevisionId) return fail("INVALID_EDIT_INPUT", "A canonical topology command requires schema, command ID, object ID and base revision.", this.command, transactionId);
    if (this.command.objectId !== this.history.objectId || (this.command.target.objectId && this.command.target.objectId !== this.history.objectId)) return fail("REVISION_CONFLICT", `Command target object ${this.command.target.objectId ?? this.command.objectId} does not match transaction object ${this.history.objectId}.`, this.command, transactionId);
    if (this.command.baseRevisionId !== current.revisionId) return fail("STALE_BASE_REVISION", `Expected base revision ${this.command.baseRevisionId}, but object ${this.command.objectId} is at ${current.revisionId}.`, this.command, transactionId);

    const baseStructure = current.loadResult.structure;
    const selection = this.command.selectionResult;
    if (!selection || (selection.status !== "VALID_NONEMPTY" && selection.status !== "VALID_EMPTY")) return fail("INVALID_SELECTION", "Every topology edit requires a valid immutable SelectionResult.", this.command, transactionId);
    if (selection.status === "VALID_EMPTY") return fail("EMPTY_SELECTION", "The selection is empty; no topology revision was created.", this.command, transactionId);
    if (selection.structureId !== baseStructure.id || selection.molecularRevision !== baseStructure.scientificHash) return fail("STALE_BASE_REVISION", `Selection ${selection.resultId} is bound to a different molecular revision.`, this.command, transactionId);
    if (this.command.target.selectionResultId !== selection.resultId) return fail("INVALID_EDIT_INPUT", "The compact selection reference does not match the supplied SelectionResult.", this.command, transactionId);
    const requestedAtomIds = this.command.target.atomIds ?? selection.stableAtomIds;
    if (!requestedAtomIds.length) return fail("EMPTY_SELECTION", "The topology edit requires at least one stable AtomUID target.", this.command, transactionId);
    if (this.command.operation !== "EDIT_DELETE_ATOMS" && requestedAtomIds.length === 2 && requestedAtomIds[0] === requestedAtomIds[1]) return fail("SELF_BOND", "A bond cannot connect an atom to itself.", this.command, transactionId);
    if (new Set(requestedAtomIds).size !== requestedAtomIds.length || !sameIds(requestedAtomIds, selection.stableAtomIds)) return fail("AMBIGUOUS_TARGET", "Topology targets must exactly match the unique SelectionResult AtomUID membership.", this.command, transactionId);
    const scopedObjectIds = objectIdsForCommand(this.command);
    if (scopedObjectIds.length !== 1 || scopedObjectIds[0] !== this.history.objectId || requestedAtomIds.some((atomId) => atomId.includes("::"))) return fail("CROSS_OBJECT_TOPOLOGY_UNSUPPORTED", "Topology edits are object-scoped in B2; cross-object targets are rejected atomically.", this.command, transactionId);
    if (this.command.stateScope.kind !== "ALL") return fail("INVALID_STATE_SCOPE", "Topology edits apply to every explicit coordinate state; use stateScope ALL.", this.command, transactionId);
    const stateResolution = resolveStateIds(current, this.command.stateScope);
    if ("code" in stateResolution) return fail(stateResolution.code, stateResolution.message, this.command, transactionId);
    if (stateResolution.ids.length !== current.stateOrder.length) return fail("INVALID_STATE_SCOPE", "Topology edits require all coordinate states to be present in the canonical state order.", this.command, transactionId);

    const atomById = new Map(baseStructure.atoms.map((atom) => [atom.stableId, atom]));
    const missingAtomId = requestedAtomIds.find((atomId) => !atomById.has(atomId));
    if (missingAtomId) return fail("TARGET_NOT_FOUND", `Stable AtomUID ${missingAtomId} is not present in revision ${current.revisionId}.`, this.command, transactionId);
    let nextAtoms = baseStructure.atoms.map((atom) => ({ ...atom }));
    let nextBonds = baseStructure.bonds.map((bond) => ({ ...bond }));
    const endpointPair = requestedAtomIds.length === 2 ? endpointKey(requestedAtomIds[0]!, requestedAtomIds[1]!) : null;
    const matchingBonds = endpointPair ? baseStructure.bonds.filter((bond) => endpointsFor(bond) === endpointPair) : [];
    let replacedBond: { sourceId: string; resultId: string } | undefined;
    const parameters = this.command.parameters;

    if (this.command.operation === "EDIT_DELETE_ATOMS") {
      const deleted = new Set(requestedAtomIds);
      nextAtoms = nextAtoms.filter((atom) => !deleted.has(atom.stableId));
      nextBonds = nextBonds.filter((bond) => !deleted.has(bond.atom1) && !deleted.has(bond.atom2));
    } else {
      if (requestedAtomIds.length !== 2) return fail("AMBIGUOUS_TARGET", `${this.command.operation} requires exactly two endpoint AtomUIDs.`, this.command, transactionId);
      if (requestedAtomIds[0] === requestedAtomIds[1]) return fail("SELF_BOND", "A bond cannot connect an atom to itself.", this.command, transactionId);
      const left = atomById.get(requestedAtomIds[0]!);
      const right = atomById.get(requestedAtomIds[1]!);
      if (!left || !right) return fail("TARGET_NOT_FOUND", "Both bond endpoints must resolve to canonical AtomUIDs in the same object.", this.command, transactionId);
      if (this.command.operation === "EDIT_ADD_BOND") {
        const order = commandOrder(this.command);
        if (!order) return fail("UNSUPPORTED_BOND_ORDER", "Bond creation supports only SINGLE, DOUBLE, TRIPLE, or AROMATIC order.", this.command, transactionId);
        if (matchingBonds.length) return fail("DUPLICATE_BOND", "The selected endpoint pair already has a canonical bond.", this.command, transactionId);
        const usedValence = (atomId: string) => baseStructure.bonds.filter((bond) => bond.atom1 === atomId || bond.atom2 === atomId).reduce((sum, bond) => sum + bondWeight(bond.order), 0);
        if (usedValence(left.stableId) + bondWeight(order) > valenceCeiling(left.element) || usedValence(right.stableId) + bondWeight(order) > valenceCeiling(right.element)) return fail("CHEMISTRY_AMBIGUOUS", "The requested bond exceeds the bounded valence profile; no implicit hydrogen or aromaticity inference was attempted.", this.command, transactionId);
        const canonicalEndpoints = [left.stableId, right.stableId].sort();
        nextBonds.push({ id: `bond:${this.command.objectId}:${stableHash({ parentRevisionId: current.revisionId, endpoints: endpointPair, order })}`, atom1: canonicalEndpoints[0]!, atom2: canonicalEndpoints[1]!, order, source: "UNKNOWN" });
      } else if (this.command.operation === "EDIT_DELETE_BOND") {
        const requestedBondId = typeof parameters.bondId === "string" ? parameters.bondId : undefined;
        const removable = requestedBondId ? matchingBonds.filter((bond) => bond.id === requestedBondId) : matchingBonds;
        if (!removable.length) return fail("BOND_NOT_FOUND", "No canonical bond exists for the exact endpoint pair and requested BondUID.", this.command, transactionId);
        const removableIds = new Set(removable.map((bond) => bond.id));
        nextBonds = nextBonds.filter((bond) => !removableIds.has(bond.id));
      } else {
        const oldBondId = typeof parameters.bondId === "string" ? parameters.bondId : undefined;
        const candidates = oldBondId ? matchingBonds.filter((bond) => bond.id === oldBondId) : matchingBonds;
        if (!candidates.length) return fail("BOND_NOT_FOUND", "No canonical bond exists for the exact endpoint pair and requested BondUID.", this.command, transactionId);
        if (candidates.length !== 1) return fail("AMBIGUOUS_TARGET", "Bond order replacement requires one authoritative BondUID.", this.command, transactionId);
        const order = commandOrder(this.command);
        if (!order) return fail("UNSUPPORTED_BOND_ORDER", "Bond replacement supports only SINGLE, DOUBLE, TRIPLE, or AROMATIC order.", this.command, transactionId);
        const oldBond = candidates[0]!;
        if (oldBond.order === order) return fail("TRANSACTION_VALIDATION_FAILED", "The requested bond order is already canonical; no child revision was published.", this.command, transactionId);
        if (matchingBonds.some((bond) => bond.id !== oldBond.id && bond.order === order)) return fail("DUPLICATE_BOND", "Another canonical bond with the requested endpoint semantics already exists.", this.command, transactionId);
        const usedValence = (atomId: string) => baseStructure.bonds.filter((bond) => bond.id !== oldBond.id && (bond.atom1 === atomId || bond.atom2 === atomId)).reduce((sum, bond) => sum + bondWeight(bond.order), 0);
        if (usedValence(left.stableId) + bondWeight(order) > valenceCeiling(left.element) || usedValence(right.stableId) + bondWeight(order) > valenceCeiling(right.element)) return fail("CHEMISTRY_AMBIGUOUS", "The requested bond order exceeds the bounded valence profile; no implicit hydrogen or aromaticity inference was attempted.", this.command, transactionId);
        const resultBondId = `bond:${this.command.objectId}:${stableHash({ parentRevisionId: current.revisionId, sourceBondId: oldBond.id, order })}`;
        nextBonds = nextBonds.filter((bond) => bond.id !== oldBond.id);
        nextBonds.push({ ...oldBond, id: resultBondId, order, source: "UNKNOWN" });
        replacedBond = { sourceId: oldBond.id, resultId: resultBondId };
      }
    }

    const states = stateForStructure(baseStructure);
    const deletedIds = this.command.operation === "EDIT_DELETE_ATOMS" ? new Set(requestedAtomIds) : new Set<string>();
    const nextStates = states.map((state) => {
      const coordinates = deletedIds.size ? Object.fromEntries(Object.entries(state.coordinates).filter(([atomId]) => !deletedIds.has(atomId))) : { ...state.coordinates };
      return { ...state, coordinates, coordinateHash: `r07-state-${stableHash({ stateId: state.id, coordinates })}` };
    });
    const currentState = nextStates.find((state) => state.id === current.currentStateId) ?? nextStates[0]!;
    const realizedAtoms = atomsForState(nextAtoms, currentState);
    const hierarchy = hierarchyFor(realizedAtoms, baseStructure.hierarchy);
    const nextStructureBase: CanonicalMolecularStructure = {
      ...clone(baseStructure),
      atoms: realizedAtoms,
      bonds: nextBonds,
      counts: countsFor(realizedAtoms, hierarchy),
      bounds: boundsFor(realizedAtoms),
      hierarchy,
      coordinateStates: nextStates,
      stateOrder: [...current.stateOrder],
    };
    const contentHash = deterministicScientificContentHash(nextStructureBase);
    const revisionId = `r07-revision-${stableHash({ parentRevisionId: current.revisionId, operation: this.command.operation, target: this.command.target, stateScope: this.command.stateScope, parameters: this.command.parameters, contentHash })}`;
    const resultIdentityId = identityIdFor(nextStructureBase);
    const nextStructure = rebindDatasets({ ...nextStructureBase, scientificHash: revisionId }, revisionId);
    const nextLoadResult: StructureLoadResult = freezeLoadResult(nextLoadResultFrom(nextStructure, nextStates));
    const affectedBondIds = this.command.operation === "EDIT_DELETE_ATOMS" ? baseStructure.bonds.filter((bond) => requestedAtomIds.includes(bond.atom1) || requestedAtomIds.includes(bond.atom2)).map((bond) => bond.id) : matchingBonds.map((bond) => bond.id);
    const staleIds = [...new Set([...requestedAtomIds, ...affectedBondIds, ...(replacedBond ? [replacedBond.resultId] : []), selection.resultId])];
    const invalidationManifest = invalidationManifestFor(["TOPOLOGY", "IDENTITY"], staleIds);
    const entityLineage = topologyLineageFor(baseStructure, nextStructure, this.command.operation, replacedBond);
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
      molecularIdentityId: resultIdentityId,
      scientificContentHash: contentHash,
      loadResult: nextLoadResult,
      parentRevisionId: current.revisionId,
      parentRevisionIds: [current.revisionId],
      transactionId,
      operation: this.command.operation,
      changedDomains: ["TOPOLOGY", "IDENTITY"],
      invalidationManifest,
      identityTransition: { sourceIdentityId: current.molecularIdentityId, resultIdentityId, outcome: "DERIVED", reason: "Topology editing derives a new MolecularIdentity; atom and surviving-bond identities are preserved by lineage." },
      entityLineage,
      provenance,
      stateOrder: [...current.stateOrder],
      currentStateId: current.currentStateId,
      sequence: current.sequence + 1,
    });
    this.history.nodes.set(revisionId, revision);
    this.history.children.set(revisionId, new Set());
    const parentChildren = this.history.children.get(current.revisionId) ?? new Set<string>();
    parentChildren.add(revisionId);
    this.history.children.set(current.revisionId, parentChildren);
    this.history.currentRevisionId = revisionId;
    return { ok: true, outcome: "COMMITTED", transactionId, objectId: this.command.objectId, baseRevisionId: current.revisionId, resultRevisionId: revisionId, revision, invalidationManifest, identityTransition: revision.identityTransition, entityLineage, provenanceRecordId: provenance.provenanceRecordId, diagnostics: [`Topology operation: ${this.command.operation}`, "All coordinate states were reconciled without cloning or fallback coordinates.", "Scientific candidate validated before publication."] };
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
