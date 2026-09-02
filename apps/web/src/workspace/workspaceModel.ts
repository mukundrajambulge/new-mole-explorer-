import type { CanonicalCoordinateState, CanonicalMolecularStructure, StructureLoadResult } from "@molecular/contracts";
import { createDefaultRenderProjection, type RenderProjection } from "../rendering/renderProjection";

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
};

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
  };
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
  const atoms = scoped.flatMap((object) => {
    const state = stateForObject(object);
    const ordinal = state?.ordinal ?? Math.max(1, object.stateOrder.indexOf(object.currentStateId) + 1);
    return structureForWorkspaceObjectState(object).atoms.map((atom) => ({ ...atom, stableId: workspaceScopedStableAtomId(object.objectId, atom.stableId), workspaceObjectId: object.objectId, workspaceObjectName: object.displayName, workspaceObjectEnabled: object.enabled, workspaceCoordinateStateId: state?.id, workspaceStateOrdinal: ordinal }));
  });
  const bonds = scoped.flatMap((object) => object.loadResult.structure.bonds.map((bond) => ({ ...bond, atom1: workspaceScopedStableAtomId(object.objectId, bond.atom1), atom2: workspaceScopedStableAtomId(object.objectId, bond.atom2) })));
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
  return { ...first, id: "workspace", name: "workspace", atoms, bonds, counts, bounds, scientificHash: `workspace:${scoped.map((object) => `${object.objectId}:${object.loadResult.structure.scientificHash}:${stateForObject(object)?.id ?? object.currentStateId}:${stateForObject(object)?.coordinateHash ?? ""}`).join("|")}` };
};
