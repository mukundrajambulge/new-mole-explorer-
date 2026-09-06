import type { CanonicalAtom, CanonicalCoordinateState, CanonicalMolecularStructure } from "@molecular/contracts";
import type { WorkspaceObject } from "../workspace/workspaceModel";

export type ExportFormat = "PDB" | "MMCIF";
export type ExportStateScope = "CURRENT_RESOLVED" | "EXPLICIT_STATE" | "ALL_STATES";
export type ExportLossPolicy = "FAIL_ON_LOSS" | "ALLOW_WITH_MANIFEST";
export type ExportSelection = { objectId: string; stableAtomIds: readonly string[]; membershipHash?: string; sourceRevisionId?: string };
export type ExportLossEntry = { code: string; severity: "WARNING" | "ERROR"; message: string; affectedFields: readonly string[] };
export type ExportLossManifest = { schemaVersion: 1; policy: ExportLossPolicy; entries: readonly ExportLossEntry[]; complete: boolean };
export type ExportArtifact = {
  schemaVersion: 1;
  exportArtifactId: string;
  objectId: string;
  sourceRevisionId: string;
  selectionStableAtomIds: readonly string[];
  stateScope: ExportStateScope;
  stateIds: readonly string[];
  format: ExportFormat;
  writerProfile: string;
  writerVersion: string;
  bytes: Uint8Array;
  byteLength: number;
  sha256: string;
  lossManifest: ExportLossManifest;
  createdAt: string;
  provenance: { sourceArtifactId?: string; parentExportArtifactId?: string; sourceUri?: string };
};

export type ExportRequest = {
  object: WorkspaceObject;
  selection?: ExportSelection;
  stateScope?: ExportStateScope;
  stateId?: string;
  format: ExportFormat;
  lossPolicy?: ExportLossPolicy;
  scientificRevisionId?: string;
  parentExportArtifactId?: string;
};

export class ExportError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "STALE_REFERENCE" | "UNSUPPORTED_STATE_SCOPE" | "EXPORT_WOULD_LOSE_SEMANTICS" | "WRITER_FAILED", message: string) {
    super(message);
    this.name = "ExportError";
  }
}

const utf8 = new TextEncoder();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const digest = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new ExportError("WRITER_FAILED", "SHA-256 WebCrypto is unavailable; no export was written.");
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
};
const membershipHash = (ids: readonly string[]): string => {
  let result = 2166136261;
  for (const id of ids) for (const character of id) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(16).padStart(8, "0");
};
const coordinateFor = (state: CanonicalCoordinateState, atom: CanonicalAtom) => state.coordinates[atom.stableId] ?? { x: atom.x, y: atom.y, z: atom.z };
const stateFor = (object: WorkspaceObject, scope: ExportStateScope, stateId?: string): CanonicalCoordinateState[] => {
  const states = object.loadResult.structure.coordinateStates?.length ? object.loadResult.structure.coordinateStates : [{ id: object.currentStateId, ordinal: 1, coordinates: Object.fromEntries(object.loadResult.structure.atoms.map((atom) => [atom.stableId, { x: atom.x, y: atom.y, z: atom.z }])), coordinateHash: object.loadResult.structure.scientificHash }];
  if (scope === "ALL_STATES") return states.map(clone);
  if (scope === "EXPLICIT_STATE") {
    const state = states.find((candidate) => candidate.id === stateId);
    if (!state) throw new ExportError("UNSUPPORTED_STATE_SCOPE", `Coordinate state ${stateId ?? "<empty>"} is not present on ${object.displayName}.`);
    return [clone(state)];
  }
  const state = states.find((candidate) => candidate.id === object.currentStateId) ?? states[0];
  if (!state) throw new ExportError("UNSUPPORTED_STATE_SCOPE", `Object ${object.displayName} has no coordinate state.`);
  return [clone(state)];
};

const pdbLine = (atom: CanonicalAtom, coordinate: { x: number; y: number; z: number }): string => {
  const record = atom.recordType.padEnd(6, " ");
  const name = atom.atomName.length < 4 ? ` ${atom.atomName.padEnd(3, " ")}` : atom.atomName.slice(0, 4);
  const residue = atom.residueName.slice(0, 3).padStart(3, " ");
  const chain = (atom.chain || " ").slice(0, 1);
  const residueNumber = String(atom.residueNumber).slice(-4).padStart(4, " ");
  const insertion = (atom.insertionCode ?? " ").slice(0, 1);
  const element = atom.element.slice(0, 2).toUpperCase().padStart(2, " ");
  return `${record}${String(atom.serial).slice(-5).padStart(5, " ")} ${name} ${residue} ${chain}${residueNumber}${insertion}   ${coordinate.x.toFixed(3).padStart(8, " ")}${coordinate.y.toFixed(3).padStart(8, " ")}${coordinate.z.toFixed(3).padStart(8, " ")}  ${(atom.occupancy ?? 1).toFixed(2).padStart(4, " ")} ${(atom.bFactor ?? 0).toFixed(2).padStart(6, " ")}          ${element}`;
};
const writePdb = (structure: CanonicalMolecularStructure, atoms: readonly CanonicalAtom[], states: readonly CanonicalCoordinateState[]): string => {
  const atomSet = new Set(atoms.map((atom) => atom.stableId));
  const lines: string[] = [];
  states.forEach((state, stateIndex) => {
    if (states.length > 1) lines.push(`MODEL     ${String(state.sourceModelNumber ?? stateIndex + 1).padStart(4, " ")}`);
    atoms.forEach((atom) => lines.push(pdbLine(atom, coordinateFor(state, atom))));
    structure.bonds.filter((bond) => atomSet.has(bond.atom1) && atomSet.has(bond.atom2)).forEach((bond) => {
      const first = atoms.find((atom) => atom.stableId === bond.atom1)?.serial;
      const second = atoms.find((atom) => atom.stableId === bond.atom2)?.serial;
      if (first !== undefined && second !== undefined) lines.push(`CONECT${String(first).padStart(5, " ")}${String(second).padStart(5, " ")}`);
    });
    if (states.length > 1) lines.push("ENDMDL");
  });
  lines.push("END");
  return `${lines.join("\n")}\n`;
};

const cifQuote = (value: string): string => /^[A-Za-z0-9_.+-]+$/.test(value) ? value : `'${value.replaceAll("'", "''")}'`;
const writeMmcif = (structure: CanonicalMolecularStructure, atoms: readonly CanonicalAtom[], states: readonly CanonicalCoordinateState[]): string => {
  const lines = [`data_${structure.name.replace(/[^A-Za-z0-9_]/g, "_") || "molecule"}`, "#", "loop_", "_atom_site.group_PDB", "_atom_site.id", "_atom_site.type_symbol", "_atom_site.label_atom_id", "_atom_site.label_comp_id", "_atom_site.label_asym_id", "_atom_site.label_seq_id", "_atom_site.label_alt_id", "_atom_site.pdbx_PDB_ins_code", "_atom_site.Cartn_x", "_atom_site.Cartn_y", "_atom_site.Cartn_z", "_atom_site.occupancy", "_atom_site.B_iso_or_equiv", "_atom_site.pdbx_PDB_model_num"];
  states.forEach((state, stateIndex) => atoms.forEach((atom) => {
    const coordinate = coordinateFor(state, atom);
    lines.push([atom.recordType, atom.serial, atom.element, cifQuote(atom.atomName), atom.residueName, cifQuote(atom.chain || "_"), atom.residueNumber, atom.altLoc ?? ".", atom.insertionCode ?? ".", coordinate.x.toFixed(3), coordinate.y.toFixed(3), coordinate.z.toFixed(3), (atom.occupancy ?? 1).toFixed(2), (atom.bFactor ?? 0).toFixed(2), state.sourceModelNumber ?? stateIndex + 1].join(" "));
  }));
  return `${lines.join("\n")}\n#\n`;
};

const lossManifestFor = (object: WorkspaceObject, format: ExportFormat, selectedAtoms: readonly CanonicalAtom[], states: readonly CanonicalCoordinateState[], policy: ExportLossPolicy): ExportLossManifest => {
  const entries: ExportLossEntry[] = [];
  const structure = object.loadResult.structure;
  const add = (code: string, message: string, affectedFields: readonly string[], severity: ExportLossEntry["severity"] = "WARNING") => entries.push({ code, message, affectedFields, severity });
  if (structure.secondaryStructureDataset) add("SECONDARY_STRUCTURE_DATASET", `${format} writer does not encode the source secondary-structure assignment dataset.`, ["secondaryStructureDataset"]);
  if (structure.chemistryDataset) add("CHEMISTRY_DATASET", `${format} writer does not encode the revision-bound donor/acceptor dataset.`, ["chemistryDataset"]);
  if (structure.fragmentDataset) add("FRAGMENT_DATASET", `${format} writer does not encode source fragment memberships.`, ["fragmentDataset"]);
  if (structure.peptideSequenceDataset) add("PEPTIDE_SEQUENCE_DATASET", `${format} writer does not encode the derived sequence dataset.`, ["peptideSequenceDataset"]);
  if (structure.unitCell && format === "PDB") add("UNIT_CELL", "The bounded PDB writer does not emit CRYST1 unit-cell metadata.", ["unitCell"]);
  if (selectedAtoms.length !== structure.atoms.length) add("SELECTION_SCOPE", "Export is a frozen atom subset; atoms outside the requested selection are not represented.", ["atoms"]);
  if (states.length > 1 && format === "PDB") add("MULTI_STATE_BONDS", "PDB CONECT records are repeated per model by the bounded writer.", ["bonds", "coordinateStates"]);
  if (policy === "FAIL_ON_LOSS" && entries.length) throw new ExportError("EXPORT_WOULD_LOSE_SEMANTICS", `Export would lose ${entries.length} semantic field${entries.length === 1 ? "" : "s"}; choose Allow with manifest to continue.`);
  return { schemaVersion: 1, policy, entries, complete: entries.length === 0 };
};

export const exportStructure = async (request: ExportRequest): Promise<ExportArtifact> => {
  const object = request.object;
  const structure = object.loadResult.structure;
  const sourceRevisionId = request.scientificRevisionId ?? structure.scientificHash;
  if (request.selection?.objectId && request.selection.objectId !== object.objectId) throw new ExportError("INVALID_INPUT", "The frozen export selection belongs to a different workspace object.");
  if (request.selection?.sourceRevisionId && request.selection.sourceRevisionId !== sourceRevisionId) throw new ExportError("STALE_REFERENCE", "The frozen export selection belongs to a stale scientific revision.");
  if (request.format !== "PDB" && request.format !== "MMCIF") throw new ExportError("INVALID_INPUT", "Export format must be PDB or mmCIF.");
  const scope = request.stateScope ?? "CURRENT_RESOLVED";
  const states = stateFor(object, scope, request.stateId);
  const atomIds = request.selection?.stableAtomIds ? [...new Set(request.selection.stableAtomIds)] : structure.atoms.map((atom) => atom.stableId);
  if (request.selection?.membershipHash && request.selection.membershipHash !== membershipHash(atomIds)) throw new ExportError("STALE_REFERENCE", "The frozen selection membership hash does not match its atom IDs.");
  const atomSet = new Set(atomIds);
  const atoms = structure.atoms.filter((atom) => atomSet.has(atom.stableId)).map(clone);
  if (!atoms.length) throw new ExportError("INVALID_INPUT", "Export requires a non-empty frozen atom selection.");
  const lossManifest = lossManifestFor(object, request.format, atoms, states, request.lossPolicy ?? "ALLOW_WITH_MANIFEST");
  const content = request.format === "PDB" ? writePdb(structure, atoms, states) : writeMmcif(structure, atoms, states);
  const bytes = utf8.encode(content);
  const sha256 = await digest(bytes);
  const exportArtifactId = `export_${sha256.slice(0, 24)}`;
  return {
    schemaVersion: 1,
    exportArtifactId,
    objectId: object.objectId,
    sourceRevisionId,
    selectionStableAtomIds: atomIds,
    stateScope: scope,
    stateIds: states.map((state) => state.id),
    format: request.format,
    writerProfile: request.format === "PDB" ? "molexplorer-pdb-canonical-v1" : "molexplorer-mmcif-canonical-v1",
    writerVersion: "r09",
    bytes,
    byteLength: bytes.byteLength,
    sha256,
    lossManifest,
    createdAt: new Date().toISOString(),
    provenance: {
      ...(structure.source.sourceArtifactId ? { sourceArtifactId: structure.source.sourceArtifactId } : {}),
      ...(request.parentExportArtifactId ? { parentExportArtifactId: request.parentExportArtifactId } : {}),
      ...(structure.source.uri ? { sourceUri: structure.source.uri } : {}),
    },
  };
};

export { membershipHash };
