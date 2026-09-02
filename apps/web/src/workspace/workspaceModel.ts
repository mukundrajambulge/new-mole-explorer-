import type { CanonicalAtom, CanonicalBond, CanonicalCoordinateState, CanonicalHierarchy, CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { createDefaultRenderProjection, type RenderProjection } from "../rendering/renderProjection";

export type WorkspaceLineageOperation = "LOAD" | "COPY" | "CREATE_FROM_SELECTION" | "SPLIT_STATE" | "JOIN_STATES";

export type WorkspaceLineage = {
  operation: WorkspaceLineageOperation;
  parentObjectIds: string[];
  parentStructureIds: string[];
  sourceAtomMap?: Record<string, string>;
  sourceStateIds?: string[];
};

export type WorkspaceObject = {
  /** Durable application identity; never a 3Dmol model index. */
  objectId: string;
  displayName: string;
  loadResult: StructureLoadResult;
  enabled: boolean;
  projection: RenderProjection;
  stateOrder: string[];
  currentStateId: string;
  allStates: boolean;
  lineage: WorkspaceLineage;
};

export type WorkspaceOperationResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type WorkspaceGroup = {
  groupId: string;
  name: string;
  objectIds: string[];
  open: boolean;
};

export const createWorkspaceGroup = (name: string, existingIds: readonly string[]): WorkspaceOperationResult<WorkspaceGroup> => {
  const normalized = name.trim();
  if (!normalized) return { ok: false, message: "group create requires a non-empty group name; no group was created." };
  const baseId = `group:${shortHash(normalized.toLowerCase())}`;
  let groupId = baseId;
  let suffix = 2;
  while (existingIds.includes(groupId)) groupId = `${baseId}:${suffix++}`;
  return { ok: true, value: { groupId, name: normalized, objectIds: [], open: true } };
};

export const updateWorkspaceGroup = (group: WorkspaceGroup, update: Partial<Pick<WorkspaceGroup, "name" | "objectIds" | "open">>): WorkspaceGroup => ({ ...group, ...update, name: update.name?.trim() || group.name, objectIds: update.objectIds ? [...new Set(update.objectIds)] : group.objectIds });

export type StateSelector =
  | { kind: "coordinate-state"; stateId: string }
  | { kind: "ordinal"; ordinal: number };

export type ObjectDisplayState = {
  enabled: boolean;
  currentStateId: string;
  allStates: boolean;
};

export const objectDisplayStateFor = (object: WorkspaceObject): ObjectDisplayState => ({
  enabled: object.enabled,
  currentStateId: object.currentStateId,
  allStates: object.allStates,
});

export type FrameStateResolver = (object: WorkspaceObject, globalFrameIndex: number) => CanonicalCoordinateState | null;

export type MolecularWorkspace = {
  objects: WorkspaceObject[];
  activeObjectId: string | null;
  globalFrameIndex: number;
};

/** Namespaces a canonical atom ID only inside the derived multi-object selection universe. */
export const workspaceScopedStableAtomId = (objectId: string, stableAtomId: string): string => `${objectId}::${stableAtomId}`;

const legacyState = (structure: CanonicalMolecularStructure): CanonicalCoordinateState => ({
  id: `${structure.id}:state:1`,
  ordinal: 1,
  sourceModelNumber: 1,
  coordinates: Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, { x: atom.x, y: atom.y, z: atom.z }])),
  coordinateHash: structure.scientificHash,
});

export const coordinateStatesFor = (structure: CanonicalMolecularStructure): CanonicalCoordinateState[] => {
  const states = structure.coordinateStates?.length ? structure.coordinateStates : [legacyState(structure)];
  return [...states].sort((left, right) => left.ordinal - right.ordinal);
};

const shortHash = (value: string): string => {
  let result = 2166136261;
  for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(16).padStart(8, "0");
};

const cloneProjection = (projection: RenderProjection): RenderProjection => JSON.parse(JSON.stringify(projection)) as RenderProjection;
const cloneLoadResult = (loadResult: StructureLoadResult): StructureLoadResult => JSON.parse(JSON.stringify(loadResult)) as StructureLoadResult;

const objectIdFor = (structureId: string, existingIds: readonly string[]): string => {
  const baseId = `object:${structureId}`;
  let objectId = baseId;
  let suffix = 2;
  while (existingIds.includes(objectId)) objectId = `${baseId}:${suffix++}`;
  return objectId;
};

const hierarchyFor = (atoms: readonly CanonicalAtom[]): CanonicalHierarchy => {
  const chains: CanonicalHierarchy["chains"] = {};
  const residues: CanonicalHierarchy["residues"] = {};
  for (const atom of atoms) {
    const chainId = `chain:${atom.chain}`;
    const residueId = `${chainId}:residue:${atom.residueNumber}:${atom.insertionCode ?? ""}`;
    if (!chains[chainId]) chains[chainId] = { id: chainId, name: atom.chain, residueIds: [] };
    if (!residues[residueId]) {
      residues[residueId] = { id: residueId, name: atom.residueName, number: atom.residueNumber, ...(atom.insertionCode ? { insertionCode: atom.insertionCode } : {}), chainId, atomIds: [], isPolymer: atom.isPolymer, ...(atom.secondaryStructure ? { secondaryStructure: atom.secondaryStructure } : {}) };
      chains[chainId].residueIds.push(residueId);
    }
    residues[residueId].atomIds.push(atom.stableId);
    residues[residueId].isPolymer ||= atom.isPolymer;
    if (!residues[residueId].secondaryStructure && atom.secondaryStructure) residues[residueId].secondaryStructure = atom.secondaryStructure;
  }
  return { chainIds: Object.keys(chains), chains, residues };
};

const summaryFor = (atoms: readonly CanonicalAtom[]) => {
  const residueKeys = new Set(atoms.map((atom) => `${atom.chain}:${atom.residueNumber}:${atom.insertionCode ?? ""}`));
  const chainKeys = new Set(atoms.map((atom) => atom.chain));
  const first = atoms[0] ?? { x: 0, y: 0, z: 0 };
  const bounds = atoms.reduce((current, atom) => ({
    min: { x: Math.min(current.min.x, atom.x), y: Math.min(current.min.y, atom.y), z: Math.min(current.min.z, atom.z) },
    max: { x: Math.max(current.max.x, atom.x), y: Math.max(current.max.y, atom.y), z: Math.max(current.max.z, atom.z) },
  }), { min: { x: first.x, y: first.y, z: first.z }, max: { x: first.x, y: first.y, z: first.z } });
  return {
    counts: {
      atoms: atoms.length,
      residues: residueKeys.size,
      chains: chainKeys.size,
      polymerAtoms: atoms.filter((atom) => atom.isPolymer).length,
      ligandAtoms: atoms.filter((atom) => atom.isLigand).length,
      waterAtoms: atoms.filter((atom) => atom.isWater).length,
      ionAtoms: atoms.filter((atom) => atom.isIon).length,
      otherAtoms: atoms.filter((atom) => !atom.isPolymer && !atom.isLigand && !atom.isWater && !atom.isIon).length,
    },
    bounds,
  };
};

const pdbContentFor = (structure: CanonicalMolecularStructure, states: readonly CanonicalCoordinateState[]): string => {
  const coordinateFor = (state: CanonicalCoordinateState, atom: CanonicalAtom) => state.coordinates[atom.stableId] ?? { x: atom.x, y: atom.y, z: atom.z };
  const atomLine = (atom: CanonicalAtom, state: CanonicalCoordinateState) => {
    const coordinate = coordinateFor(state, atom);
    const record = atom.recordType.padEnd(6, " ");
    const name = atom.atomName.length < 4 ? ` ${atom.atomName.padEnd(3, " ")}` : atom.atomName.slice(0, 4);
    const residue = atom.residueName.slice(0, 3).padStart(3, " ");
    const chain = (atom.chain || " ").slice(0, 1);
    const residueNumber = String(atom.residueNumber).slice(-4).padStart(4, " ");
    const insertion = (atom.insertionCode ?? " ").slice(0, 1);
    const element = atom.element.slice(0, 2).toUpperCase().padStart(2, " ");
    return `${record}${String(atom.serial).slice(-5).padStart(5, " ")} ${name} ${residue} ${chain}${residueNumber}${insertion}   ${coordinate.x.toFixed(3).padStart(8, " ")}${coordinate.y.toFixed(3).padStart(8, " ")}${coordinate.z.toFixed(3).padStart(8, " ")}  1.00 ${(atom.bFactor ?? 0).toFixed(2).padStart(6, " ")}          ${element}`;
  };
  const lines: string[] = [];
  states.forEach((state, stateIndex) => {
    if (states.length > 1) lines.push(`MODEL     ${String(state.sourceModelNumber ?? stateIndex + 1).padStart(4, " ")}`);
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

const derivedStructure = (
  source: WorkspaceObject,
  sourceAtoms: readonly CanonicalAtom[],
  stateIds: readonly string[],
  objectId: string,
  operation: Exclude<WorkspaceLineageOperation, "LOAD" | "COPY">,
  displayName: string,
  additionalStates?: readonly { id: string; sourceObject: WorkspaceObject; sourceState: CanonicalCoordinateState; sourceAtomIdMap?: Record<string, string> }[],
): { loadResult: StructureLoadResult; sourceAtomMap: Record<string, string>; sourceStateIds: string[] } => {
  const parentStructure = source.loadResult.structure;
  const sourceStates = coordinateStatesFor(parentStructure).filter((state) => stateIds.includes(state.id));
  const stateInputs = additionalStates?.length ? [...sourceStates.map((state) => ({ sourceObject: source, sourceState: state, sourceAtomIdMap: undefined })), ...additionalStates.map(({ sourceObject, sourceState, sourceAtomIdMap }) => ({ sourceObject, sourceState, sourceAtomIdMap }))] : sourceStates.map((state) => ({ sourceObject: source, sourceState: state, sourceAtomIdMap: undefined }));
  const coordinateError = coordinateValidationError(sourceAtoms, stateInputs);
  if (coordinateError) throw new Error(coordinateError);
  const structureId = `derived_${shortHash(`${operation}|${objectId}|${displayName}|${sourceAtoms.map((atom) => atom.stableId).join("|")}|${stateInputs.map(({ sourceObject, sourceState }) => `${sourceObject.objectId}:${sourceState.id}`).join("|")}`)}`;
  const sourceAtomMap: Record<string, string> = {};
  const childIdBySourceId = new Map<string, string>();
  const initialState = stateInputs[0]?.sourceState;
  const atoms = sourceAtoms.map((sourceAtom, index) => {
    const childStableId = `${structureId}:object:${shortHash(objectId)}:atom:${index + 1}`;
    sourceAtomMap[childStableId] = sourceAtom.stableId;
    childIdBySourceId.set(sourceAtom.stableId, childStableId);
    const coordinate = initialState?.coordinates[sourceAtom.stableId] ?? { x: sourceAtom.x, y: sourceAtom.y, z: sourceAtom.z };
    return { ...sourceAtom, stableId: childStableId, serial: index + 1, x: coordinate.x, y: coordinate.y, z: coordinate.z };
  });
  const bonds: CanonicalBond[] = parentStructure.bonds.flatMap((bond, index) => {
    const atom1 = childIdBySourceId.get(bond.atom1); const atom2 = childIdBySourceId.get(bond.atom2);
    return atom1 && atom2 ? [{ ...bond, id: `${structureId}:bond:${index + 1}`, atom1, atom2 }] : [];
  });
  const coordinateStates = stateInputs.map(({ sourceObject, sourceState }, index) => {
    const coordinates = Object.fromEntries(sourceAtoms.map((sourceAtom) => {
      const childId = childIdBySourceId.get(sourceAtom.stableId)!;
      const coordinate = sourceState.coordinates[stateInputs[index]?.sourceAtomIdMap?.[sourceAtom.stableId] ?? sourceAtom.stableId];
      return [childId, coordinate ?? { x: sourceAtom.x, y: sourceAtom.y, z: sourceAtom.z }];
    }));
    return { id: `${structureId}:state:${index + 1}`, ordinal: index + 1, sourceModelNumber: sourceState.sourceModelNumber, coordinates, coordinateHash: shortHash(JSON.stringify({ sourceObject: sourceObject.objectId, sourceState: sourceState.id, coordinates })) };
  });
  const summary = summaryFor(atoms);
  const hierarchy = hierarchyFor(atoms);
  const partialChargeDataset = parentStructure.partialChargeDataset?.molecularRevision === parentStructure.scientificHash && sourceAtoms.every((atom) => parentStructure.partialChargeDataset?.atomChargeMap[atom.stableId] !== undefined)
    ? { ...parentStructure.partialChargeDataset, molecularRevision: "pending" as string, atomChargeMap: Object.fromEntries(sourceAtoms.map((atom) => [childIdBySourceId.get(atom.stableId)!, parentStructure.partialChargeDataset!.atomChargeMap[atom.stableId]!])) }
    : undefined;
  const scientificHash = shortHash(JSON.stringify({ atoms, bonds, hierarchy, counts: summary.counts, bounds: summary.bounds, coordinateStates, stateOrder: coordinateStates.map((state) => state.id), partialChargeDataset: partialChargeDataset?.atomChargeMap ?? null }));
  const structure: CanonicalMolecularStructure = {
    id: structureId,
    name: displayName,
    format: parentStructure.format,
    source: { ...parentStructure.source, originalFilename: `${displayName}.${parentStructure.format === "mmcif" ? "cif" : "pdb"}`, parserProfile: `${parentStructure.source.parserProfile}+workspace-${operation.toLowerCase()}-v1` },
    counts: summary.counts,
    bounds: summary.bounds,
    atoms,
    bonds,
    hierarchy,
    scientificHash,
    coordinateStates,
    stateOrder: coordinateStates.map((state) => state.id),
    ...(partialChargeDataset ? { partialChargeDataset: { ...partialChargeDataset, molecularRevision: scientificHash } } : {}),
    ...(parentStructure.secondaryStructureDataset ? { secondaryStructureDataset: { ...parentStructure.secondaryStructureDataset, molecularRevision: scientificHash } } : {}),
  };
  return { loadResult: { structure, renderSource: { format: "pdb", content: pdbContentFor(structure, coordinateStates) } }, sourceAtomMap, sourceStateIds: stateInputs.map(({ sourceState }) => sourceState.id) };
};

export const createWorkspaceObject = (loadResult: StructureLoadResult, existingIds: readonly string[] = []): WorkspaceObject => {
  const baseId = `object:${loadResult.structure.id}`;
  let objectId = baseId;
  let suffix = 2;
  while (existingIds.includes(objectId)) objectId = `${baseId}:${suffix++}`;
  const states = coordinateStatesFor(loadResult.structure);
  const stateOrder = loadResult.structure.stateOrder?.filter((id) => states.some((state) => state.id === id)) ?? states.map((state) => state.id);
  const safeStateOrder = stateOrder.length ? stateOrder : states.map((state) => state.id);
  return {
    objectId,
    displayName: loadResult.structure.source.originalFilename || loadResult.structure.name,
    loadResult,
    enabled: true,
    projection: createDefaultRenderProjection(loadResult.structure),
    stateOrder: safeStateOrder,
    currentStateId: safeStateOrder[0]!,
    allStates: false,
    lineage: { operation: "LOAD", parentObjectIds: [], parentStructureIds: [loadResult.structure.id] },
  };
};

const withLineage = (object: WorkspaceObject, lineage: WorkspaceLineage): WorkspaceObject => ({ ...object, lineage });

export const copyWorkspaceObject = (source: WorkspaceObject, displayName: string, existingIds: readonly string[]): WorkspaceObject => {
  const copied = createWorkspaceObject(cloneLoadResult(source.loadResult), existingIds);
  return withLineage({ ...copied, displayName: displayName.trim() || copied.displayName, enabled: source.enabled, projection: cloneProjection(source.projection), stateOrder: [...source.stateOrder], currentStateId: source.currentStateId, allStates: source.allStates }, {
    operation: "COPY",
    parentObjectIds: [source.objectId],
    parentStructureIds: [source.loadResult.structure.id],
    sourceAtomMap: Object.fromEntries(source.loadResult.structure.atoms.map((atom) => [atom.stableId, atom.stableId])),
    sourceStateIds: [...source.stateOrder],
  });
};

const coordinateValidationError = (sourceAtoms: readonly CanonicalAtom[], stateInputs: readonly { sourceObject: WorkspaceObject; sourceState: CanonicalCoordinateState; sourceAtomIdMap?: Record<string, string> }[]): string | null => {
  for (const { sourceObject, sourceState, sourceAtomIdMap } of stateInputs) {
    for (const atom of sourceAtoms) {
      const sourceAtomId = sourceAtomIdMap?.[atom.stableId] ?? atom.stableId;
      if (!sourceState.coordinates[sourceAtomId]) return `State ${sourceState.id} of ${sourceObject.displayName} lacks coordinates for canonical atom ${sourceAtomId}; no derived object was created.`;
    }
  }
  return null;
};

export const createWorkspaceObjectFromSelection = (source: WorkspaceObject, selectedStableAtomIds: readonly string[], displayName: string, existingIds: readonly string[]): WorkspaceOperationResult<WorkspaceObject> => {
  const selected = new Set(selectedStableAtomIds);
  const sourceAtoms = source.loadResult.structure.atoms.filter((atom) => selected.has(atom.stableId));
  if (!sourceAtoms.length) return { ok: false, message: "create requires a non-empty canonical selection; no object was created." };
  const normalizedName = displayName.trim();
  if (!normalizedName) return { ok: false, message: "create requires a non-empty target object name; no object was created." };
  const structureSeed = `create|${source.objectId}|${normalizedName}|${sourceAtoms.map((atom) => atom.stableId).join("|")}`;
  const provisionalStructureId = `derived_${shortHash(structureSeed)}`;
  const objectId = objectIdFor(provisionalStructureId, existingIds);
  const sourceStateIds = coordinateStatesFor(source.loadResult.structure).map((state) => state.id);
  const coordinateError = coordinateValidationError(sourceAtoms, coordinateStatesFor(source.loadResult.structure).map((sourceState) => ({ sourceObject: source, sourceState })));
  if (coordinateError) return { ok: false, message: coordinateError };
  const materialized = derivedStructure(source, sourceAtoms, sourceStateIds, objectId, "CREATE_FROM_SELECTION", normalizedName);
  const object = withLineage({ ...createWorkspaceObject(materialized.loadResult, existingIds), displayName: normalizedName }, {
    operation: "CREATE_FROM_SELECTION",
    parentObjectIds: [source.objectId],
    parentStructureIds: [source.loadResult.structure.id],
    sourceAtomMap: materialized.sourceAtomMap,
    sourceStateIds: materialized.sourceStateIds,
  });
  const currentStateIndex = materialized.sourceStateIds.indexOf(source.currentStateId);
  return { ok: true, value: currentStateIndex >= 0 ? { ...object, currentStateId: object.stateOrder[currentStateIndex] ?? object.currentStateId } : object };
};

const stateIdsForSplit = (object: WorkspaceObject, selector: string | null): WorkspaceOperationResult<string[]> => {
  const states = coordinateStatesFor(object.loadResult.structure);
  if (states.length < 2) return { ok: false, message: `Object ${object.displayName} has one canonical coordinate state; split_states made no changes.` };
  const normalized = selector?.trim().toLowerCase() ?? "all";
  if (!normalized || normalized === "all") return { ok: true, value: states.slice(0, 64).map((state) => state.id) };
  if (normalized === "first") return { ok: true, value: [states[0]!.id] };
  if (normalized === "last") return { ok: true, value: [states[states.length - 1]!.id] };
  const prefix = normalized.match(/^prefix\s+(.+)$/)?.[1]?.trim();
  if (prefix) {
    const matched = states.filter((state) => state.id.toLowerCase().startsWith(prefix)).slice(0, 64).map((state) => state.id);
    return matched.length ? { ok: true, value: matched } : { ok: false, message: `No canonical state ID begins with prefix ${prefix}; split_states made no changes.` };
  }
  return { ok: false, message: "split_states accepts an optional selector: first, last, or prefix <state-id-prefix>; no object was created." };
};

export const splitWorkspaceObjectStates = (source: WorkspaceObject, selector: string | null, existingIds: readonly string[]): WorkspaceOperationResult<WorkspaceObject[]> => {
  if (!source.loadResult.structure.coordinateStates?.length || source.loadResult.structure.coordinateStates.length < 2) return { ok: false, message: `Object ${source.displayName} has no multi-state canonical source; split_states made no changes.` };
  const requested = stateIdsForSplit(source, selector);
  if (!requested.ok) return requested;
  const states = coordinateStatesFor(source.loadResult.structure);
  const coordinateError = coordinateValidationError(source.loadResult.structure.atoms, states.filter((state) => requested.value.includes(state.id)).map((sourceState) => ({ sourceObject: source, sourceState })));
  if (coordinateError) return { ok: false, message: coordinateError };
  const created: WorkspaceObject[] = [];
  let occupiedIds = [...existingIds];
  for (const stateId of requested.value) {
    const state = states.find((candidate) => candidate.id === stateId);
    if (!state) continue;
    const ordinal = state.ordinal;
    const namePrefix = selector?.trim().toLowerCase().startsWith("prefix ") ? selector.trim().slice("prefix ".length).trim() : source.displayName.replace(/\.(pdb|cif|mmcif)$/i, "");
    const displayName = `${namePrefix || source.displayName}_state_${ordinal}`;
    const provisionalStructureId = `derived_${shortHash(`split|${source.objectId}|${state.id}|${displayName}`)}`;
    const objectId = objectIdFor(provisionalStructureId, occupiedIds);
    const materialized = derivedStructure(source, source.loadResult.structure.atoms, [state.id], objectId, "SPLIT_STATE", displayName);
    const splitObject = withLineage({ ...createWorkspaceObject(materialized.loadResult, occupiedIds), displayName }, {
      operation: "SPLIT_STATE",
      parentObjectIds: [source.objectId],
      parentStructureIds: [source.loadResult.structure.id],
      sourceAtomMap: materialized.sourceAtomMap,
      sourceStateIds: [state.id],
    });
    created.push({ ...splitObject, enabled: source.enabled, projection: source.projection });
    occupiedIds = [...occupiedIds, splitObject.objectId];
  }
  return created.length ? { ok: true, value: created } : { ok: false, message: `No canonical states matched split_states; no object was created.` };
};

const correspondenceKey = (atom: CanonicalAtom): string => [atom.atomName, atom.element, atom.residueName, atom.residueNumber, atom.insertionCode ?? "", atom.chain, atom.recordType].join("\u0000");

export const joinWorkspaceObjectStates = (left: WorkspaceObject, right: WorkspaceObject, existingIds: readonly string[]): WorkspaceOperationResult<WorkspaceObject> => {
  if (left.objectId === right.objectId) return { ok: false, message: "join_states requires two distinct workspace objects; no object was created." };
  if (coordinateStatesFor(left.loadResult.structure).length !== 1 || coordinateStatesFor(right.loadResult.structure).length !== 1) return { ok: false, message: "join_states currently accepts only one-state objects; no object was created." };
  const leftAtoms = left.loadResult.structure.atoms;
  const rightAtoms = right.loadResult.structure.atoms;
  if (leftAtoms.length !== rightAtoms.length || leftAtoms.some((atom, index) => correspondenceKey(atom) !== correspondenceKey(rightAtoms[index]!))) return { ok: false, message: "join_states requires strict ordered atom correspondence; matching atom counts are insufficient, so no object was created." };
  const leftState = stateForObject(left); const rightState = stateForObject(right);
  if (!leftState || !rightState) return { ok: false, message: "join_states requires explicit canonical coordinates for both objects; no object was created." };
  const rightAtomIdByLeftId = Object.fromEntries(leftAtoms.map((atom, index) => [atom.stableId, rightAtoms[index]!.stableId]));
  const coordinateError = coordinateValidationError(leftAtoms, [{ sourceObject: left, sourceState: leftState }, { sourceObject: right, sourceState: rightState, sourceAtomIdMap: rightAtomIdByLeftId }]);
  if (coordinateError) return { ok: false, message: coordinateError };
  const atomIndexById = (object: WorkspaceObject) => new Map(object.loadResult.structure.atoms.map((atom, index) => [atom.stableId, index]));
  const leftAtomIndexById = atomIndexById(left); const rightAtomIndexById = atomIndexById(right);
  const edgeKey = (indexById: Map<string, number>, atom1: string, atom2: string) => [indexById.get(atom1), indexById.get(atom2)].sort((a, b) => (a ?? -1) - (b ?? -1)).join("\u0000");
  const leftEdges = new Set(left.loadResult.structure.bonds.map((bond) => `${edgeKey(leftAtomIndexById, bond.atom1, bond.atom2)}\u0000${bond.order}`));
  const rightEdges = new Set(right.loadResult.structure.bonds.map((bond) => `${edgeKey(rightAtomIndexById, bond.atom1, bond.atom2)}\u0000${bond.order}`));
  if (leftEdges.size !== rightEdges.size || [...leftEdges].some((edge) => !rightEdges.has(edge))) return { ok: false, message: "join_states requires identical canonical bond topology; no object was created." };
  const displayName = `${left.displayName}_joined`;
  const provisionalStructureId = `derived_${shortHash(`join|${left.objectId}|${right.objectId}|${left.currentStateId}|${right.currentStateId}`)}`;
  const objectId = objectIdFor(provisionalStructureId, existingIds);
  const materialized = derivedStructure(left, leftAtoms, [leftState.id], objectId, "JOIN_STATES", displayName, [{ id: right.currentStateId, sourceObject: right, sourceState: rightState, sourceAtomIdMap: rightAtomIdByLeftId }]);
  return { ok: true, value: withLineage({ ...createWorkspaceObject(materialized.loadResult, existingIds), displayName }, {
    operation: "JOIN_STATES",
    parentObjectIds: [left.objectId, right.objectId],
    parentStructureIds: [left.loadResult.structure.id, right.loadResult.structure.id],
    sourceAtomMap: materialized.sourceAtomMap,
    sourceStateIds: materialized.sourceStateIds,
  }) };
};

export const stateForObject = (object: WorkspaceObject): CanonicalCoordinateState | null => {
  const states = coordinateStatesFor(object.loadResult.structure);
  return states.find((state) => state.id === object.currentStateId) ?? states[0] ?? null;
};

export const structureForWorkspaceObjectState = (object: WorkspaceObject): CanonicalMolecularStructure => {
  const state = stateForObject(object);
  if (!state) return object.loadResult.structure;
  return { ...object.loadResult.structure, atoms: object.loadResult.structure.atoms.map((atom) => ({ ...atom, ...(state.coordinates[atom.stableId] ?? {}) })) };
};

export const resolveGlobalFrameState: FrameStateResolver = (object, globalFrameIndex) => {
  if (object.allStates) return null;
  const states = coordinateStatesFor(object.loadResult.structure);
  if (states.length === 1) return states[0] ?? null;
  const ordinal = Math.max(1, globalFrameIndex + 1);
  return states.find((state) => state.ordinal === ordinal) ?? stateForObject(object);
};

export const renameWorkspaceObject = (object: WorkspaceObject, displayName: string): WorkspaceObject => ({ ...object, displayName: displayName.trim() || object.displayName });

export const setWorkspaceObjectEnabled = (object: WorkspaceObject, enabled: boolean): WorkspaceObject => ({ ...object, enabled });

export const setWorkspaceObjectState = (object: WorkspaceObject, stateId: string): WorkspaceObject => object.stateOrder.includes(stateId) ? { ...object, currentStateId: stateId, allStates: false } : object;
export const setWorkspaceObjectAllStates = (object: WorkspaceObject, allStates: boolean): WorkspaceObject => object.stateOrder.length > 1 ? { ...object, allStates } : object;

export const cycleWorkspaceObjectState = (object: WorkspaceObject, direction: -1 | 1): WorkspaceObject => {
  if (object.stateOrder.length < 2) return object;
  const current = Math.max(0, object.stateOrder.indexOf(object.currentStateId));
  const next = (current + direction + object.stateOrder.length) % object.stateOrder.length;
  return { ...object, currentStateId: object.stateOrder[next]!, allStates: false };
};

/** Builds a derived selection universe; source objects remain canonical and untouched. */
export const workspaceSelectionStructure = (objects: readonly WorkspaceObject[]): CanonicalMolecularStructure | null => {
  const scoped = objects;
  const first = scoped[0]?.loadResult.structure;
  if (!first) return null;
  const namespaceIds = scoped.length > 1;
  const atoms = scoped.flatMap((object) => {
    const state = stateForObject(object);
    const ordinal = state?.ordinal ?? Math.max(1, object.stateOrder.indexOf(object.currentStateId) + 1);
    return structureForWorkspaceObjectState(object).atoms.map((atom) => ({ ...atom, stableId: namespaceIds ? workspaceScopedStableAtomId(object.objectId, atom.stableId) : atom.stableId, workspaceObjectId: object.objectId, workspaceObjectName: object.displayName, workspaceObjectEnabled: object.enabled, workspaceCoordinateStateId: state?.id, workspaceStateOrdinal: ordinal }));
  });
  const bonds = scoped.flatMap((object) => object.loadResult.structure.bonds.map((bond) => ({ ...bond, atom1: namespaceIds ? workspaceScopedStableAtomId(object.objectId, bond.atom1) : bond.atom1, atom2: namespaceIds ? workspaceScopedStableAtomId(object.objectId, bond.atom2) : bond.atom2 })));
  const chains = new Set(atoms.map((atom) => `${atom.workspaceObjectId}\u0000${atom.chain}`));
  const residues = new Set(atoms.map((atom) => `${atom.workspaceObjectId}\u0000${atom.chain}\u0000${atom.residueNumber}\u0000${atom.insertionCode ?? ""}`));
  const counts = {
    atoms: atoms.length,
    residues: residues.size,
    chains: chains.size,
    polymerAtoms: atoms.filter((atom) => atom.isPolymer).length,
    ligandAtoms: atoms.filter((atom) => atom.isLigand).length,
    waterAtoms: atoms.filter((atom) => atom.isWater).length,
    ionAtoms: atoms.filter((atom) => atom.isIon).length,
    otherAtoms: atoms.filter((atom) => !atom.isPolymer && !atom.isLigand && !atom.isWater && !atom.isIon).length,
  };
  const points = atoms;
  const bounds = points.reduce((current, atom) => ({ min: { x: Math.min(current.min.x, atom.x), y: Math.min(current.min.y, atom.y), z: Math.min(current.min.z, atom.z) }, max: { x: Math.max(current.max.x, atom.x), y: Math.max(current.max.y, atom.y), z: Math.max(current.max.z, atom.z) } }), { min: { x: points[0]!.x, y: points[0]!.y, z: points[0]!.z }, max: { x: points[0]!.x, y: points[0]!.y, z: points[0]!.z } });
  return { ...first, id: namespaceIds ? "workspace" : first.id, name: namespaceIds ? "workspace" : first.name, atoms, bonds, counts, bounds, scientificHash: namespaceIds ? `workspace:${scoped.map((object) => `${object.objectId}:${object.loadResult.structure.scientificHash}:${stateForObject(object)?.id ?? object.currentStateId}:${stateForObject(object)?.coordinateHash ?? ""}`).join("|")}` : first.scientificHash };
};
