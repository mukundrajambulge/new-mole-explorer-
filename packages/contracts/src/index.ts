export const CAPABILITY_STATES = [
  "SUPPORTED",
  "EXPERIMENTAL",
  "COMING_SOON",
  "UNAVAILABLE",
] as const;

export type CapabilityState = (typeof CAPABILITY_STATES)[number];

export type Capability = {
  state: CapabilityState;
  label: string;
  description: string;
};

export type HealthResponse = {
  service: "molecular-api";
  status: "ok";
  gate: "G0";
  timestamp: string;
};

export type BootstrapResponse = {
  product: "Molecular Workstation";
  gate: "G0";
  renderer: {
    mode: "3dmol";
    authoritative: true;
  };
  capabilities: Record<string, Capability>;
};

export const STRUCTURE_FORMATS = ["pdb", "mmcif"] as const;
export type StructureFormat = (typeof STRUCTURE_FORMATS)[number];

export type StructureSourceKind = "LOCAL_FILE" | "RCSB";

export type CanonicalAtom = {
  serial: number;
  atomName: string;
  element: string;
  residueName: string;
  residueNumber: number;
  insertionCode?: string;
  chain: string;
  x: number;
  y: number;
  z: number;
  recordType: "ATOM" | "HETATM";
  isPolymer: boolean;
  isLigand: boolean;
  isWater: boolean;
  isIon: boolean;
};

export type StructureCounts = {
  atoms: number;
  residues: number;
  chains: number;
  polymerAtoms: number;
  ligandAtoms: number;
  waterAtoms: number;
  ionAtoms: number;
  otherAtoms: number;
};

export type CoordinateBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type StructureSourceMetadata = {
  kind: StructureSourceKind;
  originalFilename: string;
  format: StructureFormat;
  sha256: string;
  byteLength: number;
  uri?: string;
  ingestedAt: string;
};

export type CanonicalMolecularStructure = {
  id: string;
  name: string;
  format: StructureFormat;
  source: StructureSourceMetadata;
  counts: StructureCounts;
  bounds: CoordinateBounds;
  atoms: CanonicalAtom[];
};

export type StructureLoadResult = {
  structure: CanonicalMolecularStructure;
  renderSource: {
    format: StructureFormat;
    content: string;
  };
};

export type StructureError = {
  code: "UNSUPPORTED_FORMAT" | "INVALID_INPUT" | "REMOTE_FETCH_FAILED" | "REMOTE_NOT_FOUND" | "PAYLOAD_TOO_LARGE";
  message: string;
};
