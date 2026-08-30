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
  gate: "G1B";
  timestamp: string;
};

export type BootstrapResponse = {
  product: "Molecular Workstation";
  gate: "G1B";
  renderer: {
    mode: "3dmol";
    authoritative: true;
  };
  capabilities: Record<string, Capability>;
};

export const STRUCTURE_FORMATS = ["pdb", "mmcif"] as const;
export type StructureFormat = (typeof STRUCTURE_FORMATS)[number];

export type StructureSourceKind = "LOCAL_FILE" | "RCSB";

export type BondOrder = "SINGLE" | "DOUBLE" | "TRIPLE" | "AROMATIC" | "UNKNOWN";

export type CanonicalBond = {
  id: string;
  atom1: string;
  atom2: string;
  order: BondOrder;
  source: "PDB_CONECT" | "MMCIF_STRUCT_CONN" | "MMCIF_GEOM_BOND" | "MMCIF_CHEM_COMP_BOND" | "UNKNOWN";
};

export type CanonicalResidue = {
  id: string;
  name: string;
  number: number;
  insertionCode?: string;
  chainId: string;
  atomIds: string[];
  isPolymer: boolean;
};

export type CanonicalChain = {
  id: string;
  name: string;
  residueIds: string[];
};

export type CanonicalHierarchy = {
  chainIds: string[];
  chains: Record<string, CanonicalChain>;
  residues: Record<string, CanonicalResidue>;
};

export type CanonicalAtom = {
  stableId: string;
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
  parserProfile: string;
};

export type CanonicalMolecularStructure = {
  id: string;
  name: string;
  format: StructureFormat;
  source: StructureSourceMetadata;
  counts: StructureCounts;
  bounds: CoordinateBounds;
  atoms: CanonicalAtom[];
  bonds: CanonicalBond[];
  hierarchy: CanonicalHierarchy;
  scientificHash: string;
};

export type StructureLoadResult = {
  structure: CanonicalMolecularStructure;
  renderSource: {
    format: StructureFormat;
    content: string;
  };
};

export type StructureError = {
  code: "UNSUPPORTED_FORMAT" | "INVALID_INPUT" | "REMOTE_FETCH_FAILED" | "REMOTE_NOT_FOUND" | "PAYLOAD_TOO_LARGE" | "PROJECT_NOT_FOUND" | "PROJECT_INVALID" | "INTERNAL_ERROR";
  message: string;
};

export type ProjectPresentationState = {
  schemaVersion: 1;
  representation: string;
  layerVisibility: {
    protein: boolean;
    ligand: boolean;
    water: boolean;
    ions: boolean;
    other: boolean;
  };
  color: {
    mode: string;
    colorId?: string;
    customHex?: string;
  };
  background: {
    preset: string;
    color: string;
  };
  camera: {
    view: number[] | null;
    defaultView: number[] | null;
  };
};

export type ProjectRecord = {
  id: string;
  name: string;
  schemaVersion: 1;
  revision: number;
  createdAt: string;
  updatedAt: string;
  structure: StructureLoadResult | null;
  presentation: ProjectPresentationState;
};

export type ProjectSaveRequest = {
  name?: string;
  structure: StructureLoadResult | null;
  presentation: ProjectPresentationState;
  expectedRevision?: number;
};
