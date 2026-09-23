import type { CanonicalAtom, CanonicalCoordinateState, CanonicalMolecularStructure, Coordinate3D } from "@molecular/contracts";
import type { CoordinateContext } from "../interaction/picking";
import type { SelectionResult } from "../selection/selectionEngine";

export type Vec3 = Coordinate3D;
export type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];
export type MappingMode = "EXPLICIT" | "SOURCE_IDENTITY_STRICT" | "SEQUENCE_GUIDED" | "SYMMETRY_AWARE_LIGAND" | "STRUCTURE_GUIDED" | "INDEX_ORDER";
export type TransformUniqueness = "UNIQUE" | "NON_UNIQUE_TRANSFORM" | "DEGENERATE_GEOMETRY" | "ILL_CONDITIONED_FIT";
export type ResultDisposition = "VALID" | "UNVALIDATED" | "STALE" | "UNSUPPORTED" | "FAILED";
export type AlignmentOperationKind = "RMS_CUR" | "RMS" | "FIT" | "PAIR_FIT" | "ALIGN" | "SUPER" | "CEALIGN" | "INTRA_RMS_CUR" | "INTRA_RMS" | "INTRA_FIT";

export type AlignmentErrorCode =
  | "INVALID_INPUT" | "NO_CORRESPONDENCE" | "AMBIGUOUS_MAPPING" | "AMBIGUOUS_STATE" | "STALE_SNAPSHOT" | "MISSING_COORDINATE"
  | "INVALID_COORDINATE" | "INVALID_WEIGHTS" | "CARDINALITY_ERROR" | "INSUFFICIENT_POINTS"
  | "DEGENERATE_GEOMETRY" | "NON_UNIQUE_TRANSFORM" | "ILL_CONDITIONED_FIT" | "REFLECTION_DISALLOWED"
  | "MAPPING_DUPLICATE_TARGET" | "MAPPING_COVERAGE_LOW" | "ALTLOC_UNRESOLVED" | "INCOMPATIBLE_POLYMER_TYPES"
  | "CHAIN_MAPPING_AMBIGUOUS" | "OUTLIER_REJECTION_INSUFFICIENT_CORE" | "SYMMETRY_SEARCH_LIMIT_REACHED"
  | "UNSUPPORTED_COORDINATE_POLICY" | "UNSUPPORTED_CAPABILITY" | "PROFILE_NOT_FOUND" | "NUMERICAL_FAILURE" | "VALIDATION_MISMATCH";

export type AlignmentError = { code: AlignmentErrorCode; message: string; disposition: ResultDisposition; diagnostics?: readonly string[] };

export type SnapshotRef = {
  objectId: string;
  revisionId: string;
  structureId: string;
  molecularRevision: string;
  stateId: string;
  context: CoordinateContext;
};

export type AlignmentPairInput = {
  sourceAtomUid: string;
  targetAtomUid: string;
  mappingReason?: string;
  weight?: number;
};

export type AlignmentPairRecord = Readonly<{
  pairId: string;
  sourceObjectId: string;
  sourceAtomUid: string;
  targetObjectId: string;
  targetAtomUid: string;
  sourceResidueSiteUid?: string;
  targetResidueSiteUid?: string;
  mappingReason: string;
  weight: number;
  retainedStatus: "RETAINED" | "REJECTED" | "UNRESOLVED";
  rejectionCycle: number | null;
  residual: number | null;
}>;

export type AlignmentMapping = Readonly<{
  mappingId: string;
  schemaVersion: 1;
  mappingAlgorithmId: string;
  mappingAlgorithmVersion: string;
  mappingMode: MappingMode;
  compatibilityProfile: string;
  sourceSnapshotRef: SnapshotRef;
  targetSnapshotRef: SnapshotRef;
  sourceSelectionResultId: string;
  targetSelectionResultId: string;
  sourceStateId: string;
  targetStateId: string;
  pairRecords: readonly AlignmentPairRecord[];
  residueMapping: readonly { sourceResidueSiteUid: string; targetResidueSiteUid: string; score: number }[];
  chainMapping: readonly { sourceChainId: string; targetChainId: string; score: number }[];
  atomTemplate: string;
  symmetryPolicy: string;
  altlocPolicy: string;
  missingCoordinatePolicy: string;
  coverage: { source: number; target: number; paired: number };
  diagnostics: readonly string[];
  mappingHash: string;
}>;

export type FitSetPolicy = Readonly<{
  fitPairIds?: readonly string[];
  evaluationPairIds?: readonly string[];
}>;

export type RefinementProfile = Readonly<{
  cycles: number;
  cutoffAngstrom: number;
  minCorePairs: number;
}>;

export type AlignmentRequest = Readonly<{
  schemaVersion: 1;
  operationKind: AlignmentOperationKind;
  sourceObjectId: string;
  targetObjectId: string;
  sourceRevisionId: string;
  targetRevisionId: string;
  sourceStructure: CanonicalMolecularStructure;
  targetStructure: CanonicalMolecularStructure;
  sourceStateId: string;
  targetStateId: string;
  sourceSelection: SelectionResult;
  targetSelection: SelectionResult;
  sourceCoordinateContext: CoordinateContext;
  targetCoordinateContext: CoordinateContext;
  mappingMode: MappingMode;
  compatibilityProfile: string;
  explicitPairs?: readonly AlignmentPairInput[];
  fitSetPolicy?: FitSetPolicy;
  weightingProfile: "UNWEIGHTED" | "EXPLICIT_PAIR_WEIGHTS";
  reflectionPolicy: "PROPER_ROTATION_ONLY" | "ALLOW_REFLECTION";
  toleranceProfile: { degeneracy: number; conditioning: number; orthogonality: number };
  refinementProfile: RefinementProfile;
  symmetryPolicy: string;
  altlocPolicy: "EXACT_ALTLOC" | "PREFER_PRIMARY" | "FAIL_AMBIGUOUS";
  missingCoordinatePolicy: "FAIL" | "DROP_PAIR";
  transformRequested: boolean;
  alignmentObjectRequested: boolean;
  algorithmVersion: string;
  sourceWorldTransform?: RigidTransform;
  targetWorldTransform?: RigidTransform;
}>;

export type AlignmentWorkflowOptions = Readonly<{
  mappingMode: MappingMode;
  sourceStateId?: string;
  targetStateId?: string;
  refinementCycles: number;
  transformMode: "ANALYZE_ONLY" | "FIT_AND_APPLY";
  alignmentObjectRequested: boolean;
}>;

export type RigidTransform = Readonly<{
  rotation: Matrix3;
  translation: Vec3;
}>;

export type RefinementStep = Readonly<{
  cycle: number;
  fitPairIds: readonly string[];
  rejectedPairIds: readonly string[];
  rmsd: number;
  cutoffAngstrom: number;
}>;

export type AlignmentResult = Readonly<{
  resultId: string;
  schemaVersion: 1;
  operationKind: AlignmentOperationKind;
  algorithmId: string;
  algorithmVersion: string;
  compatibilityProfile: string;
  sourceSnapshotRef: SnapshotRef;
  targetSnapshotRef: SnapshotRef;
  sourceSelectionResultId: string;
  targetSelectionResultId: string;
  sourceCoordinateContext: CoordinateContext;
  targetCoordinateContext: CoordinateContext;
  alignmentMappingId: string;
  mappingMode: MappingMode;
  mappingHash: string;
  fitPairIds: readonly string[];
  evaluationPairIds: readonly string[];
  initialPairCount: number;
  retainedPairCount: number;
  evaluationPairCount: number;
  currentRmsd: number | null;
  initialFittedRmsd: number | null;
  refinedCoreRmsd: number | null;
  evaluationRmsd: number | null;
  rotationMatrix?: Matrix3;
  translationVector?: Vec3;
  homogeneousTransform?: readonly number[];
  determinant: number | null;
  orthogonalityError: number | null;
  singularValues: readonly number[];
  effectiveRank: number;
  conditioning: number | null;
  transformUniqueness: TransformUniqueness;
  perPairResiduals: Readonly<Record<string, number>>;
  rejectedPairIds: readonly string[];
  refinementHistory: readonly RefinementStep[];
  alignedResidueCount: number;
  sequenceAlignmentScore: number | null;
  coverage: { source: number; target: number; paired: number };
  symmetryPolicy: string;
  altlocPolicy: string;
  statePolicy: string;
  warnings: readonly string[];
  resultDisposition: ResultDisposition;
  error?: AlignmentError;
  dependencySignature: string;
  provenanceRecordId: string;
}>;

export type AlignmentObject = Readonly<{
  alignmentObjectId: string;
  resultId: string;
  sourceObjectId: string;
  targetObjectId: string;
  retainedPairIds: readonly string[];
  rejectedPairIds: readonly string[];
  links: readonly { pairId: string; sourceAtomUid: string; targetAtomUid: string; retained: boolean; residual: number | null }[];
  presentationOnly: true;
}>;

export type AlignmentServiceResult<T> = { ok: true; value: T } | { ok: false; error: AlignmentError };

const EPSILON = 1e-12;
const finite = (value: number) => Number.isFinite(value);
const freezeDeep = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  }
  return value;
};
const stable = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
};
const hash = (value: unknown): string => {
  const input = stable(value); let a = 2166136261; let b = 2654435761;
  for (const char of input) { a = Math.imul(a ^ char.charCodeAt(0), 16777619); b = Math.imul(b ^ char.charCodeAt(0), 2246822519); }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
};
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3, s: number): Vec3 => v(a.x * s, a.y * s, a.z * s);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3) => Math.sqrt(dot(a, a));
const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));
const matrixVector = (m: Matrix3, a: Vec3): Vec3 => v(m[0] * a.x + m[1] * a.y + m[2] * a.z, m[3] * a.x + m[4] * a.y + m[5] * a.z, m[6] * a.x + m[7] * a.y + m[8] * a.z);
const matrixTranspose = (m: Matrix3): Matrix3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const determinant = (m: Matrix3) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
const homogeneous = (m: Matrix3, t: Vec3): readonly number[] => [m[0], m[1], m[2], t.x, m[3], m[4], m[5], t.y, m[6], m[7], m[8], t.z, 0, 0, 0, 1];
const identity: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const stateFor = (structure: CanonicalMolecularStructure, stateId: string): CanonicalCoordinateState | null => {
  const states = structure.coordinateStates?.length ? structure.coordinateStates : [{ id: `${structure.id}:state:1`, ordinal: 1, coordinates: Object.fromEntries(structure.atoms.map((atom) => [atom.stableId, { x: atom.x, y: atom.y, z: atom.z }])), coordinateHash: structure.scientificHash }];
  return states.find((state) => state.id === stateId) ?? null;
};
const atomMap = (structure: CanonicalMolecularStructure) => new Map(structure.atoms.map((atom) => [atom.stableId, atom]));
const coordinateFor = (structure: CanonicalMolecularStructure, stateId: string, atomId: string): Vec3 | null => {
  const state = stateFor(structure, stateId); const atom = atomMap(structure).get(atomId);
  if (!state || !atom) return null;
  const coordinate = state.coordinates[atomId] ?? { x: atom.x, y: atom.y, z: atom.z };
  return finite(coordinate.x) && finite(coordinate.y) && finite(coordinate.z) ? { ...coordinate } : null;
};
const worldCoordinate = (coordinate: Vec3, transform?: RigidTransform): Vec3 => transform ? add(matrixVector(transform.rotation, coordinate), transform.translation) : coordinate;
const residueKey = (atom: CanonicalAtom) => `${atom.chain}:${atom.residueNumber}:${atom.insertionCode ?? ""}`;
const residueSite = (atom: CanonicalAtom) => `residue:${atom.chain}:${atom.residueNumber}:${atom.insertionCode ?? ""}`;
const atomIdentityKey = (atom: CanonicalAtom) => `${atom.chain}|${atom.residueName}|${atom.residueNumber}|${atom.insertionCode ?? ""}|${atom.atomName}|${atom.altLoc ?? ""}`;
const oneLetter: Record<string, string> = { ALA: "A", ARG: "R", ASN: "N", ASP: "D", CYS: "C", GLN: "Q", GLU: "E", GLY: "G", HIS: "H", ILE: "I", LEU: "L", LYS: "K", MET: "M", PHE: "F", PRO: "P", SER: "S", THR: "T", TRP: "W", TYR: "Y", VAL: "V", ADE: "A", A: "A", CYT: "C", C: "C", GUA: "G", G: "G", THY: "T", T: "T", URA: "U", U: "U" };

const error = (code: AlignmentErrorCode, message: string, disposition: ResultDisposition = "FAILED", diagnostics?: readonly string[]): AlignmentError => ({ code, message, disposition, ...(diagnostics ? { diagnostics } : {}) });

export const createAlignmentRequest = (input: Omit<AlignmentRequest, "schemaVersion"> & Partial<Pick<AlignmentRequest, "schemaVersion">>): AlignmentRequest => freezeDeep({ schemaVersion: 1, ...input });

const snapshotFor = (request: AlignmentRequest, side: "source" | "target"): SnapshotRef => {
  const source = side === "source";
  const structure = source ? request.sourceStructure : request.targetStructure;
  return { objectId: source ? request.sourceObjectId : request.targetObjectId, revisionId: source ? request.sourceRevisionId : request.targetRevisionId, structureId: structure.id, molecularRevision: structure.scientificHash, stateId: source ? request.sourceStateId : request.targetStateId, context: source ? request.sourceCoordinateContext : request.targetCoordinateContext };
};

const validateRequest = (request: AlignmentRequest): AlignmentError | null => {
  if (!request.sourceObjectId || !request.targetObjectId || !request.sourceRevisionId || !request.targetRevisionId) return error("INVALID_INPUT", "Source and target object/revision identities are required.");
  if (request.sourceSelection.molecularRevision !== request.sourceStructure.scientificHash || request.targetSelection.molecularRevision !== request.targetStructure.scientificHash) return error("STALE_SNAPSHOT", "Selection membership is stale relative to the requested molecular revision.");
  if (!stateFor(request.sourceStructure, request.sourceStateId) || !stateFor(request.targetStructure, request.targetStateId)) return error("AMBIGUOUS_STATE", "The requested CoordinateStateID is not present on one side of the alignment.");
  if (request.mappingMode === "INDEX_ORDER" && request.compatibilityProfile !== "PYMOL_INDEX_ORDER") return error("UNSUPPORTED_CAPABILITY", "INDEX_ORDER is not a native scientific mapping mode; request the explicit PYMOL_INDEX_ORDER compatibility profile.", "UNSUPPORTED");
  if (request.weightingProfile === "EXPLICIT_PAIR_WEIGHTS" && request.explicitPairs?.some((pair) => pair.weight !== undefined && (!finite(pair.weight) || pair.weight <= 0))) return error("INVALID_WEIGHTS", "All explicit pair weights must be finite and strictly positive.");
  return null;
};

const residueGroups = (structure: CanonicalMolecularStructure, ids: readonly string[]) => {
  const wanted = new Set(ids); const groups = new Map<string, CanonicalAtom[]>();
  for (const atom of structure.atoms) if (wanted.has(atom.stableId)) groups.set(residueKey(atom), [...(groups.get(residueKey(atom)) ?? []), atom]);
  return [...groups.values()].sort((a, b) => (a[0]!.chain.localeCompare(b[0]!.chain) || a[0]!.residueNumber - b[0]!.residueNumber || (a[0]!.insertionCode ?? "").localeCompare(b[0]!.insertionCode ?? "")));
};
const sequenceForResidues = (residues: readonly CanonicalAtom[][]) => residues.map((atoms) => oneLetter[atoms[0]!.residueName.toUpperCase()] ?? "X").join("");
const alignSequence = (source: string, target: string): { pairs: Array<[number, number]>; score: number } => {
  const gap = -2; const match = 2; const mismatch = -1; const score: number[][] = Array.from({ length: source.length + 1 }, () => Array(target.length + 1).fill(0));
  for (let i = 1; i <= source.length; i++) score[i]![0] = score[i - 1]![0]! + gap;
  for (let j = 1; j <= target.length; j++) score[0]![j] = score[0]![j - 1]! + gap;
  for (let i = 1; i <= source.length; i++) for (let j = 1; j <= target.length; j++) score[i]![j] = Math.max(score[i - 1]![j - 1]! + (source[i - 1] === target[j - 1] && source[i - 1] !== "X" ? match : mismatch), score[i - 1]![j]! + gap, score[i]![j - 1]! + gap);
  const pairs: Array<[number, number]> = []; let i = source.length; let j = target.length;
  while (i > 0 && j > 0) {
    const diagonal = score[i - 1]![j - 1]! + (source[i - 1] === target[j - 1] && source[i - 1] !== "X" ? match : mismatch);
    if (score[i]![j] === diagonal) { if (source[i - 1] !== "X" && target[j - 1] !== "X") pairs.unshift([i - 1, j - 1]); i--; j--; }
    else if (score[i]![j] === score[i - 1]![j]! + gap) i--; else j--;
  }
  return { pairs, score: score[source.length]![target.length]! };
};

const explicitMapping = (request: AlignmentRequest): AlignmentServiceResult<{ pairs: AlignmentPairInput[]; residues: Array<{ sourceResidueSiteUid: string; targetResidueSiteUid: string; score: number }>; chains: Array<{ sourceChainId: string; targetChainId: string; score: number }>; diagnostics: string[] }> => {
  const sourceIds = new Set(request.sourceSelection.stableAtomIds); const targetIds = new Set(request.targetSelection.stableAtomIds); const sourceAtoms = atomMap(request.sourceStructure); const targetAtoms = atomMap(request.targetStructure);
  let pairs: AlignmentPairInput[];
  if (request.mappingMode === "EXPLICIT") pairs = [...(request.explicitPairs ?? [])];
  else if (request.mappingMode === "SOURCE_IDENTITY_STRICT") {
    const targetByKey = new Map([...targetIds].map((id) => { const atom = targetAtoms.get(id)!; return [atomIdentityKey(atom), id] as const; }));
    pairs = [...sourceIds].sort().flatMap((id) => { const atom = sourceAtoms.get(id)!; const targetId = targetByKey.get(atomIdentityKey(atom)); return targetId ? [{ sourceAtomUid: id, targetAtomUid: targetId, mappingReason: "source-identity-strict" }] : []; });
  } else if (request.mappingMode === "INDEX_ORDER") {
    const left = [...sourceIds]; const right = [...targetIds];
    pairs = left.slice(0, Math.min(left.length, right.length)).map((sourceAtomUid, index) => ({ sourceAtomUid, targetAtomUid: right[index]!, mappingReason: "pymol-index-order-compatibility" }));
  } else return { ok: false, error: error("UNSUPPORTED_CAPABILITY", `Mapping mode ${request.mappingMode} is not implemented by the fixed correspondence mapper.`, "UNSUPPORTED") };
  if (new Set(pairs.map((pair) => pair.sourceAtomUid)).size !== pairs.length) return { ok: false, error: error("AMBIGUOUS_MAPPING", "Explicit mapping contains a duplicate source endpoint.") };
  if (new Set(pairs.map((pair) => pair.targetAtomUid)).size !== pairs.length) return { ok: false, error: error("MAPPING_DUPLICATE_TARGET", "Explicit mapping contains a duplicate target endpoint.") };
  if (pairs.some((pair) => !sourceIds.has(pair.sourceAtomUid) || !targetIds.has(pair.targetAtomUid) || !sourceAtoms.has(pair.sourceAtomUid) || !targetAtoms.has(pair.targetAtomUid))) return { ok: false, error: error("INVALID_INPUT", "Every mapping endpoint must be present in the corresponding SelectionResult and structure.") };
  const residues = pairs.map((pair) => ({ sourceResidueSiteUid: residueSite(sourceAtoms.get(pair.sourceAtomUid)!), targetResidueSiteUid: residueSite(targetAtoms.get(pair.targetAtomUid)!), score: 1 }));
  return { ok: true, value: { pairs, residues: [...new Map(residues.map((item) => [`${item.sourceResidueSiteUid}|${item.targetResidueSiteUid}`, item])).values()], chains: [], diagnostics: [] } };
};

const sequenceMapping = (request: AlignmentRequest): AlignmentServiceResult<{ pairs: AlignmentPairInput[]; residues: Array<{ sourceResidueSiteUid: string; targetResidueSiteUid: string; score: number }>; chains: Array<{ sourceChainId: string; targetChainId: string; score: number }>; diagnostics: string[] }> => {
  const sourceResidues = residueGroups(request.sourceStructure, request.sourceSelection.stableAtomIds); const targetResidues = residueGroups(request.targetStructure, request.targetSelection.stableAtomIds);
  if (!sourceResidues.length || !targetResidues.length) return { ok: false, error: error("NO_CORRESPONDENCE", "Sequence-guided mapping requires at least one residue on each side.") };
  const sourceChains = [...new Set(sourceResidues.map((atoms) => atoms[0]!.chain))]; const targetChains = [...new Set(targetResidues.map((atoms) => atoms[0]!.chain))]; const usedTargets = new Set<string>();
  const chains: Array<{ sourceChainId: string; targetChainId: string; score: number }> = []; const residues: Array<{ sourceResidueSiteUid: string; targetResidueSiteUid: string; score: number }> = []; const pairs: AlignmentPairInput[] = []; const diagnostics: string[] = [];
  for (const sourceChain of sourceChains) {
    const left = sourceResidues.filter((atoms) => atoms[0]!.chain === sourceChain); let best: { targetChain: string; alignment: { pairs: Array<[number, number]>; score: number } } | null = null;
    for (const targetChain of targetChains) {
      if (usedTargets.has(targetChain)) continue;
      const alignment = alignSequence(sequenceForResidues(left), sequenceForResidues(targetResidues.filter((atoms) => atoms[0]!.chain === targetChain)));
      if (!best || alignment.score > best.alignment.score || (alignment.score === best.alignment.score && targetChain < best.targetChain)) best = { targetChain, alignment };
    }
    if (!best) { diagnostics.push(`No unused target chain was available for source chain ${sourceChain}.`); continue; }
    usedTargets.add(best.targetChain); chains.push({ sourceChainId: sourceChain, targetChainId: best.targetChain, score: best.alignment.score });
    const right = targetResidues.filter((atoms) => atoms[0]!.chain === best!.targetChain);
    for (const [sourceIndex, targetIndex] of best.alignment.pairs) {
      const sourceGroup = left[sourceIndex]!; const targetGroup = right[targetIndex]!; const sourceByName = new Map(sourceGroup.map((atom) => [`${atom.atomName}|${atom.altLoc ?? ""}`, atom]));
      const targetByName = new Map(targetGroup.map((atom) => [`${atom.atomName}|${atom.altLoc ?? ""}`, atom]));
      const atomNames = [...sourceByName.keys()].filter((key) => targetByName.has(key)).sort();
      if (!atomNames.length) diagnostics.push(`Residue ${residueKey(sourceGroup[0]!)} mapped to ${residueKey(targetGroup[0]!)} but has no shared atom template.`);
      for (const key of atomNames) pairs.push({ sourceAtomUid: sourceByName.get(key)!.stableId, targetAtomUid: targetByName.get(key)!.stableId, mappingReason: "sequence-guided-residue-atom-expansion" });
      residues.push({ sourceResidueSiteUid: residueSite(sourceGroup[0]!), targetResidueSiteUid: residueSite(targetGroup[0]!), score: sequenceForResidues([sourceGroup]) === sequenceForResidues([targetGroup]) ? 1 : 0 });
    }
  }
  if (!pairs.length) return { ok: false, error: error("NO_CORRESPONDENCE", "Sequence-guided mapping produced no shared atom pairs.", "FAILED", diagnostics) };
  return { ok: true, value: { pairs, residues, chains, diagnostics } };
};

export const buildAlignmentMapping = (request: AlignmentRequest): AlignmentServiceResult<AlignmentMapping> => {
  const requestError = validateRequest(request); if (requestError) return { ok: false, error: requestError };
  if (request.mappingMode === "SYMMETRY_AWARE_LIGAND" || request.mappingMode === "STRUCTURE_GUIDED") return { ok: false, error: error("UNSUPPORTED_CAPABILITY", `${request.mappingMode} is capability-gated in this CPU implementation.`, "UNSUPPORTED") };
  const mapped = request.mappingMode === "SEQUENCE_GUIDED" ? sequenceMapping(request) : explicitMapping(request); if (!mapped.ok) return mapped;
  const sourceSnapshotRef = snapshotFor(request, "source"); const targetSnapshotRef = snapshotFor(request, "target");
  const pairs = mapped.value.pairs.map((pair, index) => { const source = atomMap(request.sourceStructure).get(pair.sourceAtomUid)!; const target = atomMap(request.targetStructure).get(pair.targetAtomUid)!; return { pairId: `pair:${index + 1}:${hash(pair)}`, sourceObjectId: request.sourceObjectId, sourceAtomUid: pair.sourceAtomUid, targetObjectId: request.targetObjectId, targetAtomUid: pair.targetAtomUid, sourceResidueSiteUid: residueSite(source), targetResidueSiteUid: residueSite(target), mappingReason: pair.mappingReason ?? "explicit", weight: pair.weight ?? 1, retainedStatus: "RETAINED" as const, rejectionCycle: null, residual: null }; });
  const sourceCount = request.sourceSelection.stableAtomIds.length; const targetCount = request.targetSelection.stableAtomIds.length;
  const mappingPayload = { sourceSnapshotRef, targetSnapshotRef, pairs, residues: mapped.value.residues, chains: mapped.value.chains, mode: request.mappingMode, profile: request.compatibilityProfile };
  return { ok: true, value: freezeDeep({ mappingId: `mapping:${hash(mappingPayload)}`, schemaVersion: 1, mappingAlgorithmId: request.mappingMode === "SEQUENCE_GUIDED" ? "molexplorer.sequence-guided-global-v1" : "molexplorer.fixed-correspondence-v1", mappingAlgorithmVersion: request.algorithmVersion, mappingMode: request.mappingMode, compatibilityProfile: request.compatibilityProfile, sourceSnapshotRef, targetSnapshotRef, sourceSelectionResultId: request.sourceSelection.resultId, targetSelectionResultId: request.targetSelection.resultId, sourceStateId: request.sourceStateId, targetStateId: request.targetStateId, pairRecords: pairs, residueMapping: mapped.value.residues, chainMapping: mapped.value.chains, atomTemplate: request.mappingMode === "SEQUENCE_GUIDED" ? "same atom name + exact altloc" : "explicit endpoint", symmetryPolicy: request.symmetryPolicy, altlocPolicy: request.altlocPolicy, missingCoordinatePolicy: request.missingCoordinatePolicy, coverage: { source: sourceCount ? pairs.length / sourceCount : 0, target: targetCount ? pairs.length / targetCount : 0, paired: pairs.length }, diagnostics: mapped.value.diagnostics, mappingHash: hash(mappingPayload) }) };
};

type PointPair = { pair: AlignmentPairRecord; source: Vec3; target: Vec3 };
const pointPairs = (request: AlignmentRequest, mapping: AlignmentMapping, ids: readonly string[], frame: "LOCAL_SCIENTIFIC" | "EFFECTIVE_WORLD" = "LOCAL_SCIENTIFIC"): AlignmentServiceResult<PointPair[]> => {
  const set = new Set(ids); const result: PointPair[] = []; const sourceTransform = frame === "EFFECTIVE_WORLD" ? request.sourceWorldTransform : undefined; const targetTransform = frame === "EFFECTIVE_WORLD" ? request.targetWorldTransform : undefined;
  for (const pair of mapping.pairRecords) {
    if (!set.has(pair.pairId)) continue;
    const source = coordinateFor(request.sourceStructure, request.sourceStateId, pair.sourceAtomUid); const target = coordinateFor(request.targetStructure, request.targetStateId, pair.targetAtomUid);
    if (!source || !target) { if (request.missingCoordinatePolicy === "DROP_PAIR") continue; return { ok: false, error: error("MISSING_COORDINATE", `CoordinateState ${request.sourceStateId}/${request.targetStateId} has no finite coordinate for pair ${pair.pairId}.`) }; }
    result.push({ pair, source: worldCoordinate(source, sourceTransform), target: worldCoordinate(target, targetTransform) });
  }
  return result.length ? { ok: true, value: result } : { ok: false, error: error("NO_CORRESPONDENCE", "No finite mapped pairs were available for this operation.") };
};

const weightedCentroid = (points: readonly PointPair[], side: "source" | "target") => { let total = 0; let result = v(0, 0, 0); for (const point of points) { const weight = point.pair.weight; total += weight; result = add(result, scale(side === "source" ? point.source : point.target, weight)); } return total > 0 ? scale(result, 1 / total) : result; };
const rms = (points: readonly PointPair[], transform?: RigidTransform) => { if (!points.length) return null; let sum = 0; let total = 0; for (const point of points) { const moved = transform ? add(matrixVector(transform.rotation, point.source), transform.translation) : point.source; sum += point.pair.weight * (distance(moved, point.target) ** 2); total += point.pair.weight; } return total > 0 ? Math.sqrt(sum / total) : null; };

type SymmetricMatrix = number[][];
const jacobiEigen = (input: SymmetricMatrix): { values: number[]; vectors: number[][] } => {
  const n = input.length; const a = input.map((row) => [...row]); const vectors: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j): number => i === j ? 1 : 0));
  for (let iteration = 0; iteration < 80; iteration++) { let p = 0; let q = 1; let largest = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(a[i]![j]!) > largest) { largest = Math.abs(a[i]![j]!); p = i; q = j; } if (largest < 1e-14) break; const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!); const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)); const c = 1 / Math.sqrt(t * t + 1); const s = t * c; const app = a[p]![p]!; const aqq = a[q]![q]!; const apq = a[p]![q]!; a[p]![p] = c * c * app - 2 * s * c * apq + s * s * aqq; a[q]![q] = s * s * app + 2 * s * c * apq + c * c * aqq; a[p]![q] = 0; a[q]![p] = 0; for (let k = 0; k < n; k++) if (k !== p && k !== q) { const akp = a[k]![p]!; const akq = a[k]![q]!; a[k]![p] = a[p]![k] = c * akp - s * akq; a[k]![q] = a[q]![k] = s * akp + c * akq; } for (let k = 0; k < n; k++) { const vkp = vectors[k]![p]!; const vkq = vectors[k]![q]!; vectors[k]![p] = c * vkp - s * vkq; vectors[k]![q] = s * vkp + c * vkq; } }
  return { values: a.map((row, index) => row[index]!), vectors };
};

const kabsch = (points: readonly PointPair[], tolerance: number): { transform: RigidTransform; initialRmsd: number; fittedRmsd: number; determinant: number; orthogonalityError: number; singularValues: number[]; effectiveRank: number; conditioning: number; uniqueness: TransformUniqueness; warnings: string[] } | AlignmentError => {
  const sourceCentroid = weightedCentroid(points, "source"); const targetCentroid = weightedCentroid(points, "target"); const covariance = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const point of points) { const p = sub(point.source, sourceCentroid); const q = sub(point.target, targetCentroid); const weight = point.pair.weight; covariance[0]![0] += weight * q.x * p.x; covariance[0]![1] += weight * q.x * p.y; covariance[0]![2] += weight * q.x * p.z; covariance[1]![0] += weight * q.y * p.x; covariance[1]![1] += weight * q.y * p.y; covariance[1]![2] += weight * q.y * p.z; covariance[2]![0] += weight * q.z * p.x; covariance[2]![1] += weight * q.z * p.y; covariance[2]![2] += weight * q.z * p.z; }
  const gramCorrect: number[][] = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => covariance[0]![i]! * covariance[0]![j]! + covariance[1]![i]! * covariance[1]![j]! + covariance[2]![i]! * covariance[2]![j]!));
  const gramEigen = jacobiEigen(gramCorrect); const ordered = gramEigen.values.map((value, index) => ({ value: Math.sqrt(Math.max(0, value)), index })).sort((left, right) => right.value - left.value); const singularValues = ordered.map((entry) => entry.value); const maxSingular = singularValues[0] ?? 0; const rankThreshold = Math.max(EPSILON, maxSingular * tolerance); const effectiveRank = singularValues.filter((value) => value > rankThreshold).length;
  const normalize = (input: number[]): number[] => { const length = Math.sqrt(input.reduce((sum, value) => sum + value * value, 0)); return length > EPSILON ? input.map((value) => value / length) : [0, 0, 0]; };
  const cross = (left: number[], right: number[]): number[] => [left[1]! * right[2]! - left[2]! * right[1]!, left[2]! * right[0]! - left[0]! * right[2]!, left[0]! * right[1]! - left[1]! * right[0]!];
  const dotArray = (left: number[], right: number[]) => left.reduce((sum, value, index) => sum + value * right[index]!, 0);
  const vColumns = ordered.map((entry) => gramEigen.vectors.map((row) => row[entry.index]!));
  const uColumns = vColumns.map((column) => normalize([covariance[0]![0]! * column[0]! + covariance[0]![1]! * column[1]! + covariance[0]![2]! * column[2]!, covariance[1]![0]! * column[0]! + covariance[1]![1]! * column[1]! + covariance[1]![2]! * column[2]!, covariance[2]![0]! * column[0]! + covariance[2]![1]! * column[1]! + covariance[2]![2]! * column[2]!]));
  if (norm(v(uColumns[0]![0]!, uColumns[0]![1]!, uColumns[0]![2]!)) < EPSILON) uColumns[0] = [1, 0, 0];
  uColumns[1] = normalize(uColumns[1]!.map((value, index) => value - dotArray(uColumns[0]!, uColumns[1]!) * uColumns[0]![index]!));
  if (norm(v(uColumns[1]![0]!, uColumns[1]![1]!, uColumns[1]![2]!)) < EPSILON) uColumns[1] = Math.abs(uColumns[0]![0]!) < 0.9 ? normalize(cross(uColumns[0]!, [1, 0, 0])) : normalize(cross(uColumns[0]!, [0, 1, 0]));
  uColumns[2] = normalize(cross(uColumns[0]!, uColumns[1]!));
  const uRows = Array.from({ length: 3 }, (_, row) => uColumns.map((column) => column[row]!)); const vRows = Array.from({ length: 3 }, (_, row) => vColumns.map((column) => column[row]!));
  const makeRotation = (): Matrix3 => [uRows[0]![0]! * vRows[0]![0]! + uRows[0]![1]! * vRows[0]![1]! + uRows[0]![2]! * vRows[0]![2]!, uRows[0]![0]! * vRows[1]![0]! + uRows[0]![1]! * vRows[1]![1]! + uRows[0]![2]! * vRows[1]![2]!, uRows[0]![0]! * vRows[2]![0]! + uRows[0]![1]! * vRows[2]![1]! + uRows[0]![2]! * vRows[2]![2]!, uRows[1]![0]! * vRows[0]![0]! + uRows[1]![1]! * vRows[0]![1]! + uRows[1]![2]! * vRows[0]![2]!, uRows[1]![0]! * vRows[1]![0]! + uRows[1]![1]! * vRows[1]![1]! + uRows[1]![2]! * vRows[1]![2]!, uRows[1]![0]! * vRows[2]![0]! + uRows[1]![1]! * vRows[2]![1]! + uRows[1]![2]! * vRows[2]![2]!, uRows[2]![0]! * vRows[0]![0]! + uRows[2]![1]! * vRows[0]![1]! + uRows[2]![2]! * vRows[0]![2]!, uRows[2]![0]! * vRows[1]![0]! + uRows[2]![1]! * vRows[1]![1]! + uRows[2]![2]! * vRows[1]![2]!, uRows[2]![0]! * vRows[2]![0]! + uRows[2]![1]! * vRows[2]![1]! + uRows[2]![2]! * vRows[2]![2]!];
  let rotation = makeRotation(); if (determinant(rotation) < 0) { for (let row = 0; row < 3; row++) uRows[row]![2] = -uRows[row]![2]!; rotation = makeRotation(); }
  const transform: RigidTransform = { rotation, translation: sub(targetCentroid, matrixVector(rotation, sourceCentroid)) }; const det = determinant(rotation); const rt = matrixTranspose(rotation); const product: Matrix3 = [rt[0] * rotation[0] + rt[1] * rotation[3] + rt[2] * rotation[6], rt[0] * rotation[1] + rt[1] * rotation[4] + rt[2] * rotation[7], rt[0] * rotation[2] + rt[1] * rotation[5] + rt[2] * rotation[8], rt[3] * rotation[0] + rt[4] * rotation[3] + rt[5] * rotation[6], rt[3] * rotation[1] + rt[4] * rotation[4] + rt[5] * rotation[7], rt[3] * rotation[2] + rt[4] * rotation[5] + rt[5] * rotation[8], rt[6] * rotation[0] + rt[7] * rotation[3] + rt[8] * rotation[6], rt[6] * rotation[1] + rt[7] * rotation[4] + rt[8] * rotation[7], rt[6] * rotation[2] + rt[7] * rotation[5] + rt[8] * rotation[8]]; const orthogonalityError = Math.sqrt(product.reduce((sum, value, index) => sum + (value - (index % 4 === 0 ? 1 : 0)) ** 2, 0));
  const conditioning = singularValues[2]! > EPSILON ? singularValues[0]! / singularValues[2]! : Number.POSITIVE_INFINITY; let uniqueness: TransformUniqueness = "UNIQUE"; const warnings: string[] = [];
  if (points.length === 1) { uniqueness = "NON_UNIQUE_TRANSFORM"; warnings.push("One pair determines translation but not orientation."); }
  else if (effectiveRank <= 1) { uniqueness = "DEGENERATE_GEOMETRY"; warnings.push("Centered correspondence is collinear or coincident; orientation is non-unique."); }
  else if (points.length === 2) { uniqueness = "NON_UNIQUE_TRANSFORM"; warnings.push("Two pairs determine an axis but leave rotation about that axis underdetermined."); }
  else if (conditioning > 1 / Math.max(tolerance, 1e-15)) { uniqueness = "ILL_CONDITIONED_FIT"; warnings.push(`Near-collinear/ill-conditioned fit; singular-value condition ${conditioning.toExponential(3)}.`); }
  if (det < 1 - tolerance) return error("REFLECTION_DISALLOWED", "The numerical fit produced a reflection; proper rotations are required by the default profile.");
  return { transform, initialRmsd: rms(points)!, fittedRmsd: rms(points, transform)!, determinant: det, orthogonalityError, singularValues, effectiveRank, conditioning, uniqueness, warnings };
};

const resultBase = (request: AlignmentRequest, mapping: AlignmentMapping, disposition: ResultDisposition, dependencySignature: string): Omit<AlignmentResult, "resultId"> => ({ schemaVersion: 1, operationKind: request.operationKind, algorithmId: "molexplorer.r08.alignment", algorithmVersion: request.algorithmVersion, compatibilityProfile: request.compatibilityProfile, sourceSnapshotRef: mapping.sourceSnapshotRef, targetSnapshotRef: mapping.targetSnapshotRef, sourceSelectionResultId: mapping.sourceSelectionResultId, targetSelectionResultId: mapping.targetSelectionResultId, sourceCoordinateContext: request.sourceCoordinateContext, targetCoordinateContext: request.targetCoordinateContext, alignmentMappingId: mapping.mappingId, mappingMode: mapping.mappingMode, mappingHash: mapping.mappingHash, fitPairIds: [], evaluationPairIds: [], initialPairCount: 0, retainedPairCount: 0, evaluationPairCount: 0, currentRmsd: null, initialFittedRmsd: null, refinedCoreRmsd: null, evaluationRmsd: null, determinant: null, orthogonalityError: null, singularValues: [], effectiveRank: 0, conditioning: null, transformUniqueness: "NON_UNIQUE_TRANSFORM", perPairResiduals: {}, rejectedPairIds: [], refinementHistory: [], alignedResidueCount: mapping.residueMapping.length, sequenceAlignmentScore: mapping.chainMapping.length ? mapping.chainMapping.reduce((sum, item) => sum + item.score, 0) : null, coverage: mapping.coverage, symmetryPolicy: mapping.symmetryPolicy, altlocPolicy: mapping.altlocPolicy, statePolicy: `${request.sourceStateId}→${request.targetStateId}`, warnings: [], resultDisposition: disposition, dependencySignature, provenanceRecordId: `provenance:alignment:${dependencySignature}` });

export const dependencySignatureFor = (request: AlignmentRequest, mapping: AlignmentMapping): string => hash({ source: [request.sourceObjectId, request.sourceRevisionId, request.sourceStateId, request.sourceCoordinateContext], target: [request.targetObjectId, request.targetRevisionId, request.targetStateId, request.targetCoordinateContext], sourceSelection: request.sourceSelection.membershipHash, targetSelection: request.targetSelection.membershipHash, mapping: mapping.mappingHash, profile: [request.mappingMode, request.compatibilityProfile, request.reflectionPolicy, request.refinementProfile, request.algorithmVersion] });

export const analyzeAlignment = (request: AlignmentRequest, mapping: AlignmentMapping, frame: "LOCAL_SCIENTIFIC" | "EFFECTIVE_WORLD" = "LOCAL_SCIENTIFIC"): AlignmentResult => {
  const dependencySignature = dependencySignatureFor(request, mapping); const allPairIds = mapping.pairRecords.map((pair) => pair.pairId); const fitIds = request.fitSetPolicy?.fitPairIds ? [...request.fitSetPolicy.fitPairIds] : allPairIds; const evaluationIds = request.fitSetPolicy?.evaluationPairIds ? [...request.fitSetPolicy.evaluationPairIds] : allPairIds; const base = resultBase(request, mapping, "FAILED", dependencySignature);
  const mappedPoints = pointPairs(request, mapping, allPairIds, frame); if (!mappedPoints.ok) return freezeDeep({ ...base, resultId: `result:${hash({ dependencySignature, error: mappedPoints.error })}`, error: mappedPoints.error, warnings: [mappedPoints.error.message] });
  const fitPoints = mappedPoints.value.filter((point) => fitIds.includes(point.pair.pairId)); const evalPoints = mappedPoints.value.filter((point) => evaluationIds.includes(point.pair.pairId)); if (!fitPoints.length || !evalPoints.length) { const failure = error("NO_CORRESPONDENCE", "Fit and evaluation sets must each contain at least one mapped pair."); return freezeDeep({ ...base, resultId: `result:${hash({ dependencySignature, failure })}`, error: failure, warnings: [failure.message] }); }
  const currentRmsd = rms(evalPoints); if (request.operationKind === "RMS_CUR" || request.operationKind === "INTRA_RMS_CUR") return freezeDeep({ ...base, resultId: `result:${hash({ dependencySignature, operation: request.operationKind })}`, fitPairIds: fitIds, evaluationPairIds: evaluationIds, initialPairCount: fitPoints.length, retainedPairCount: fitPoints.length, evaluationPairCount: evalPoints.length, currentRmsd, evaluationRmsd: currentRmsd, refinedCoreRmsd: currentRmsd, determinant: 1, orthogonalityError: 0, rotationMatrix: identity, translationVector: v(0, 0, 0), homogeneousTransform: homogeneous(identity, v(0, 0, 0)), transformUniqueness: fitPoints.length < 3 ? "NON_UNIQUE_TRANSFORM" : "UNIQUE", resultDisposition: "VALID" });
  const fit = kabsch(fitPoints, request.toleranceProfile.degeneracy); if ("code" in fit) return freezeDeep({ ...base, resultId: `result:${hash({ dependencySignature, error: fit })}`, fitPairIds: fitIds, evaluationPairIds: evaluationIds, initialPairCount: fitPoints.length, evaluationPairCount: evalPoints.length, currentRmsd, error: fit, warnings: [fit.message] });
  let retained = [...fitPoints]; let transform = fit.transform; let refinedCoreRmsd = fit.fittedRmsd; const rejected: string[] = []; const refinementHistory: RefinementStep[] = [{ cycle: 0, fitPairIds: retained.map((point) => point.pair.pairId), rejectedPairIds: [], rmsd: fit.fittedRmsd, cutoffAngstrom: request.refinementProfile.cutoffAngstrom }];
  const cycles = request.refinementProfile.cycles; for (let cycle = 1; cycle <= cycles; cycle++) { const residuals = retained.map((point) => ({ point, residual: distance(add(matrixVector(transform.rotation, point.source), transform.translation), point.target) })); const next = residuals.filter((item) => item.residual <= request.refinementProfile.cutoffAngstrom).map((item) => item.point); const removed = residuals.filter((item) => item.residual > request.refinementProfile.cutoffAngstrom).map((item) => item.point.pair.pairId); if (!removed.length) break; if (next.length < request.refinementProfile.minCorePairs) { const failure = error("OUTLIER_REJECTION_INSUFFICIENT_CORE", `Refinement cycle ${cycle} would leave ${next.length} pairs, below the minimum core of ${request.refinementProfile.minCorePairs}.`); return freezeDeep({ ...base, resultId: `result:${hash({ dependencySignature, failure })}`, fitPairIds: fitIds, evaluationPairIds: evaluationIds, initialPairCount: fitPoints.length, retainedPairCount: retained.length, evaluationPairCount: evalPoints.length, currentRmsd, initialFittedRmsd: fit.fittedRmsd, rejectedPairIds: [...rejected, ...removed], refinementHistory, error: failure, warnings: [failure.message] }); } const nextFit = kabsch(next, request.toleranceProfile.degeneracy); if ("code" in nextFit) return freezeDeep({ ...base, resultId: `result:${hash({ dependencySignature, error: nextFit })}`, fitPairIds: fitIds, evaluationPairIds: evaluationIds, currentRmsd, initialFittedRmsd: fit.fittedRmsd, rejectedPairIds: [...rejected, ...removed], refinementHistory, error: nextFit, warnings: [nextFit.message] }); retained = next; transform = nextFit.transform; refinedCoreRmsd = nextFit.fittedRmsd; rejected.push(...removed); refinementHistory.push({ cycle, fitPairIds: retained.map((point) => point.pair.pairId), rejectedPairIds: removed, rmsd: refinedCoreRmsd, cutoffAngstrom: request.refinementProfile.cutoffAngstrom }); }
  const perPairResiduals: Record<string, number> = {}; for (const point of mappedPoints.value) perPairResiduals[point.pair.pairId] = distance(add(matrixVector(transform.rotation, point.source), transform.translation), point.target);
  const evaluationRmsd = rms(evalPoints, transform); const warnings = [...fit.warnings]; if (fit.uniqueness !== "UNIQUE") warnings.push(`Transform uniqueness: ${fit.uniqueness}.`); if (cycles === 0) warnings.push("Refinement disabled by explicit cycles=0 profile.");
  const result = { ...base, resultId: `result:${hash({ dependencySignature, transform, rejected })}`, fitPairIds: retained.map((point) => point.pair.pairId), evaluationPairIds: evaluationIds, initialPairCount: fitPoints.length, retainedPairCount: retained.length, evaluationPairCount: evalPoints.length, currentRmsd, initialFittedRmsd: fit.fittedRmsd, refinedCoreRmsd, evaluationRmsd, rotationMatrix: transform.rotation, translationVector: transform.translation, homogeneousTransform: homogeneous(transform.rotation, transform.translation), determinant: fit.determinant, orthogonalityError: fit.orthogonalityError, singularValues: fit.singularValues, effectiveRank: fit.effectiveRank, conditioning: fit.conditioning, transformUniqueness: fit.uniqueness, perPairResiduals, rejectedPairIds: rejected, refinementHistory, warnings, resultDisposition: "VALID" as const };
  return freezeDeep(result);
};

export const isAlignmentResultStale = (result: AlignmentResult, request: AlignmentRequest, mapping: AlignmentMapping): boolean => result.dependencySignature !== dependencySignatureFor(request, mapping);
export const markAlignmentResultStale = (result: AlignmentResult): AlignmentResult => freezeDeep({ ...result, resultDisposition: "STALE", warnings: [...result.warnings, "Dependencies changed; the immutable historical result was not recomputed."] });

export const createAlignmentObject = (result: AlignmentResult, mapping: AlignmentMapping): AlignmentObject => freezeDeep({ alignmentObjectId: `alignment-object:${result.resultId}`, resultId: result.resultId, sourceObjectId: mapping.sourceSnapshotRef.objectId, targetObjectId: mapping.targetSnapshotRef.objectId, retainedPairIds: result.fitPairIds, rejectedPairIds: result.rejectedPairIds, links: mapping.pairRecords.map((pair) => ({ pairId: pair.pairId, sourceAtomUid: pair.sourceAtomUid, targetAtomUid: pair.targetAtomUid, retained: result.fitPairIds.includes(pair.pairId), residual: result.perPairResiduals[pair.pairId] ?? null })), presentationOnly: true });
export const getRawAlignment = (object: AlignmentObject): readonly (readonly [{ objectId: string; atomUid: string }, { objectId: string; atomUid: string }])[] => object.links.filter((link) => link.retained).map((link) => [{ objectId: object.sourceObjectId, atomUid: link.sourceAtomUid }, { objectId: object.targetObjectId, atomUid: link.targetAtomUid }] as const);
export const applyRigidTransform = (coordinate: Vec3, transform: RigidTransform): Vec3 => add(matrixVector(transform.rotation, coordinate), transform.translation);
export const coordinatePatchForTransform = (structure: CanonicalMolecularStructure, stateId: string, atomIds: readonly string[], transform: RigidTransform): Record<string, Vec3> => Object.fromEntries(atomIds.map((atomId) => { const coordinate = coordinateFor(structure, stateId, atomId); return [atomId, coordinate ? applyRigidTransform(coordinate, transform) : undefined]; }).filter((entry): entry is [string, Vec3] => Boolean(entry[1])));

export type PyMOLCompatibilityTuple = readonly [number, number, number, number, number, number, number];
export const pyMolCompatibilityTuple = (result: AlignmentResult): PyMOLCompatibilityTuple | null => result.currentRmsd === null || result.initialFittedRmsd === null ? null : [result.refinedCoreRmsd ?? result.evaluationRmsd ?? result.initialFittedRmsd, result.retainedPairCount, Math.max(0, result.refinementHistory.length - 1), result.initialFittedRmsd, result.initialPairCount, result.sequenceAlignmentScore ?? 0, result.alignedResidueCount];

export type FittingProfile = Readonly<{ id: string; operation: AlignmentOperationKind; mutatesCoordinates: boolean; compatibility: string }>;
export const PYMOL_RMS_CUR_PROFILE: FittingProfile = Object.freeze({ id: "PYMOL_RMS_CUR_PROFILE", operation: "RMS_CUR", mutatesCoordinates: false, compatibility: "pymol-5e8bfca:rms_cur" });
export const PYMOL_RMS_PROFILE: FittingProfile = Object.freeze({ id: "PYMOL_RMS_PROFILE", operation: "RMS", mutatesCoordinates: false, compatibility: "pymol-5e8bfca:rms" });
export const PYMOL_FIT_PROFILE: FittingProfile = Object.freeze({ id: "PYMOL_FIT_PROFILE", operation: "FIT", mutatesCoordinates: true, compatibility: "pymol-5e8bfca:fit" });
export const PYMOL_PAIR_FIT_PROFILE: FittingProfile = Object.freeze({ id: "PYMOL_PAIR_FIT_PROFILE", operation: "PAIR_FIT", mutatesCoordinates: true, compatibility: "pymol-5e8bfca:pair_fit" });
export const createDefaultAlignmentRequest = (input: Partial<AlignmentRequest> & Pick<AlignmentRequest, "operationKind" | "sourceObjectId" | "targetObjectId" | "sourceRevisionId" | "targetRevisionId" | "sourceStructure" | "targetStructure" | "sourceStateId" | "targetStateId" | "sourceSelection" | "targetSelection" | "sourceCoordinateContext" | "targetCoordinateContext">): AlignmentRequest => createAlignmentRequest({ ...input, mappingMode: input.mappingMode ?? "EXPLICIT", compatibilityProfile: input.compatibilityProfile ?? "MOLEXPLORER_NATIVE_FIXED_CORRESPONDENCE_V1", weightingProfile: input.weightingProfile ?? "UNWEIGHTED", reflectionPolicy: input.reflectionPolicy ?? "PROPER_ROTATION_ONLY", toleranceProfile: input.toleranceProfile ?? { degeneracy: 1e-10, conditioning: 1e8, orthogonality: 1e-8 }, refinementProfile: input.refinementProfile ?? { cycles: 0, cutoffAngstrom: 2, minCorePairs: 3 }, symmetryPolicy: input.symmetryPolicy ?? "NONE", altlocPolicy: input.altlocPolicy ?? "FAIL_AMBIGUOUS", missingCoordinatePolicy: input.missingCoordinatePolicy ?? "FAIL", transformRequested: input.transformRequested ?? false, alignmentObjectRequested: input.alignmentObjectRequested ?? false, algorithmVersion: input.algorithmVersion ?? "r08.1" });

export const alignmentCapabilityMatrix = Object.freeze({ rms_cur: "IMPLEMENTED_UNVERIFIED", rms: "IMPLEMENTED_UNVERIFIED", fit: "IMPLEMENTED_UNVERIFIED", pair_fit: "IMPLEMENTED_UNVERIFIED", align: "IMPLEMENTED_UNVERIFIED", super: "IMPLEMENTED_UNVERIFIED", cealign: "UNSUPPORTED", intra_rms_cur: "IMPLEMENTED_UNVERIFIED", intra_rms: "IMPLEMENTED_UNVERIFIED", intra_fit: "IMPLEMENTED_UNVERIFIED", get_raw_alignment: "SUPPORTED" } as const);
