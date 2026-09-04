import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";
import type { CoordinateContext } from "./picking";

export type MeasurementKind = "DISTANCE" | "ANGLE" | "DIHEDRAL";
export type MeasurementStatus = "CURRENT" | "STALE" | "INVALID" | "HIDDEN";

export type MeasurementParticipant = {
  ordinal: number;
  objectId?: string;
  stableAtomId: string;
  atomName: string;
  residueName: string;
  residueNumber: number;
  chain: string;
};

export type MeasurementPresentation = {
  visible: boolean;
  color: string;
  lineWidth: number;
};

export type MeasurementObject = {
  schemaVersion: 1;
  id: string;
  objectId?: string;
  kind: MeasurementKind;
  participants: readonly MeasurementParticipant[];
  rawValue: number;
  displayUnit: "Å" | "°";
  displayPrecision: number;
  coordinateContext: CoordinateContext;
  molecularRevision: string;
  provenance: "canonical-coordinate-kernel";
  status: MeasurementStatus;
  presentation: MeasurementPresentation;
};

export class MeasurementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementError";
  }
}

type Vec3 = { x: number; y: number; z: number };
const vector = (atom: CanonicalAtom): Vec3 => ({ x: atom.x, y: atom.y, z: atom.z });
const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const magnitude = (value: Vec3): number => Math.sqrt(dot(value, value));
const scale = (value: Vec3, factor: number): Vec3 => ({ x: value.x * factor, y: value.y * factor, z: value.z * factor });
const normalized = (value: Vec3): Vec3 => {
  const length = magnitude(value);
  if (!Number.isFinite(length) || length < 1e-10) throw new MeasurementError("Measurement is degenerate because two coordinates coincide.");
  return scale(value, 1 / length);
};
const radiansToDegrees = (value: number): number => value * 180 / Math.PI;

export const getDistance = (a: CanonicalAtom, b: CanonicalAtom): number => {
  const distance = magnitude(subtract(vector(a), vector(b)));
  if (!Number.isFinite(distance)) throw new MeasurementError("Distance is not finite for the selected coordinates.");
  return distance;
};

export const getAngle = (a: CanonicalAtom, b: CanonicalAtom, c: CanonicalAtom): number => {
  const ba = normalized(subtract(vector(a), vector(b)));
  const bc = normalized(subtract(vector(c), vector(b)));
  const cosine = Math.max(-1, Math.min(1, dot(ba, bc)));
  return radiansToDegrees(Math.acos(cosine));
};

export const getDihedral = (a: CanonicalAtom, b: CanonicalAtom, c: CanonicalAtom, d: CanonicalAtom): number => {
  const b0 = subtract(vector(a), vector(b));
  const b1 = subtract(vector(c), vector(b));
  const b2 = subtract(vector(d), vector(c));
  const b1Unit = normalized(b1);
  const v = subtract(b0, scale(b1Unit, dot(b0, b1Unit)));
  const w = subtract(b2, scale(b1Unit, dot(b2, b1Unit)));
  const vUnit = normalized(v);
  const wUnit = normalized(w);
  return radiansToDegrees(Math.atan2(dot(cross(b1Unit, vUnit), wUnit), dot(vUnit, wUnit)));
};

const atomById = (structure: CanonicalMolecularStructure, stableAtomId: string): CanonicalAtom => {
  const atom = structure.atoms.find((candidate) => candidate.stableId === stableAtomId);
  if (!atom) throw new MeasurementError(`Atom ${stableAtomId} is not present in the canonical molecular revision.`);
  return atom;
};

const participantFor = (atom: CanonicalAtom, ordinal: number, objectId?: string): MeasurementParticipant => ({
  ordinal,
  ...(objectId ? { objectId } : {}),
  stableAtomId: atom.stableId,
  atomName: atom.atomName,
  residueName: atom.residueName,
  residueNumber: atom.residueNumber,
  chain: atom.chain,
});

export const measurementCardinality = (kind: MeasurementKind): number => kind === "DISTANCE" ? 2 : kind === "ANGLE" ? 3 : 4;

export const createMeasurementObject = (
  kind: MeasurementKind,
  stableAtomIds: readonly string[],
  structure: CanonicalMolecularStructure,
  coordinateContext: CoordinateContext,
  sequence: number,
  objectId?: string,
): MeasurementObject => {
  const expected = measurementCardinality(kind);
  if (stableAtomIds.length !== expected) throw new MeasurementError(`${kind} requires exactly ${expected} ordered atom picks.`);
  const atoms = stableAtomIds.map((stableAtomId) => atomById(structure, stableAtomId));
  const rawValue = kind === "DISTANCE" ? getDistance(atoms[0], atoms[1]) : kind === "ANGLE" ? getAngle(atoms[0], atoms[1], atoms[2]) : getDihedral(atoms[0], atoms[1], atoms[2], atoms[3]);
  return {
    schemaVersion: 1,
    id: `measurement:${objectId ?? structure.id}:${sequence}`,
    kind,
    ...(objectId ? { objectId } : {}),
    participants: atoms.map((atom, index) => participantFor(atom, index + 1, objectId)),
    rawValue,
    displayUnit: kind === "DISTANCE" ? "Å" : "°",
    displayPrecision: kind === "DISTANCE" ? 2 : 1,
    coordinateContext,
    molecularRevision: structure.scientificHash,
    provenance: "canonical-coordinate-kernel",
    status: "CURRENT",
    presentation: { visible: true, color: "#e5ae32", lineWidth: 2 },
  };
};

export const measurementStatus = (measurement: MeasurementObject, structure: CanonicalMolecularStructure | null): MeasurementStatus => {
  if (!measurement.presentation.visible) return "HIDDEN";
  if (!structure || structure.scientificHash !== measurement.molecularRevision || (!measurement.objectId && structure.id !== measurement.coordinateContext.modelId)) return "STALE";
  return measurement.status;
};

export const formatMeasurement = (measurement: MeasurementObject): string => `${measurement.rawValue.toFixed(measurement.displayPrecision)} ${measurement.displayUnit}`;

export class MeasurementAccumulator {
  private slots: string[] = [];
  private objectId: string | undefined;

  add(stableAtomId: string, kind: MeasurementKind, objectId?: string): readonly string[] {
    if (this.slots.length >= measurementCardinality(kind)) {
      this.slots = [];
      this.objectId = undefined;
    }
    if (this.slots.length > 0 && this.objectId !== objectId) throw new MeasurementError("Measurements must use atoms from one workspace object; clear the current picks before changing objects.");
    this.objectId = objectId;
    this.slots = [...this.slots, stableAtomId];
    return this.slots;
  }

  clear(): void { this.slots = []; this.objectId = undefined; }
  current(): readonly string[] { return this.slots; }
  currentObjectId(): string | undefined { return this.objectId; }
};
