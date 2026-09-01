import type { CanonicalAtom, CanonicalMolecularStructure } from "@molecular/contracts";
import type { ColorMode, ColorState, RepresentationType } from "./presentationState";

export type ColorSchemeId =
  | "classic-cpk"
  | "modern-jmol"
  | "by-molecule"
  | "by-formal-charge"
  | "by-partial-charge"
  | "esp"
  | "hydrophobicity"
  | "rainbow"
  | "monochrome"
  | "colourblind-safe"
  | "secondary-structure-standard"
  | "secondary-structure-jmol"
  | "chain"
  | "element"
  | "white";

export type ColorSchemeDefinition = {
  id: ColorSchemeId;
  name: string;
  targetLevel: "atom" | "object" | "residue" | "polymer";
  requiredProperties: readonly string[];
  propertySource: string;
  normalization: string;
  palette: string;
  missingValuePolicy: string;
  legend: string;
  version: string;
  capability: "SUPPORTED" | "SUPPORTED_WITH_LIMITATIONS" | "EXPERIMENTAL";
};

export const COLOR_SCHEME_DEFINITIONS: readonly ColorSchemeDefinition[] = [
  { id: "classic-cpk", name: "Classic CPK", targetLevel: "atom", requiredProperties: ["element"], propertySource: "CanonicalAtom.element", normalization: "element lookup", palette: "CPK 1.0", missingValuePolicy: "unknown element -> explicit neutral grey", legend: "element", version: "cpk-v1", capability: "SUPPORTED" },
  { id: "modern-jmol", name: "Modern/Jmol", targetLevel: "atom", requiredProperties: ["element"], propertySource: "CanonicalAtom.element", normalization: "element lookup", palette: "Jmol element palette", missingValuePolicy: "unknown element -> explicit neutral grey", legend: "element", version: "jmol-v1", capability: "SUPPORTED" },
  { id: "by-molecule", name: "By Molecule", targetLevel: "object", requiredProperties: ["structure.id"], propertySource: "CanonicalMolecularStructure.id", normalization: "stable hash", palette: "deterministic categorical", missingValuePolicy: "structure id is always present", legend: "molecule", version: "molecule-hash-v1", capability: "SUPPORTED" },
  { id: "by-formal-charge", name: "By Formal Charge", targetLevel: "atom", requiredProperties: ["formal_charge"], propertySource: "CanonicalAtom.formalCharge", normalization: "signed diverging scale [-3,+3]", palette: "blue-white-red", missingValuePolicy: "unknown remains unknown and emits diagnostic", legend: "negative / zero / positive", version: "formal-charge-diverging-v1", capability: "SUPPORTED_WITH_LIMITATIONS" },
  { id: "by-partial-charge", name: "By Partial Charge", targetLevel: "atom", requiredProperties: ["PartialChargeDataset.atomChargeMap"], propertySource: "CanonicalMolecularStructure.partialChargeDataset", normalization: "dataset min/max", palette: "blue-white-red", missingValuePolicy: "no dataset -> PARTIAL_CHARGE_UNAVAILABLE", legend: "partial charge", version: "partial-charge-diverging-v1", capability: "SUPPORTED_WITH_LIMITATIONS" },
  { id: "esp", name: "ESP", targetLevel: "atom", requiredProperties: ["potential field"], propertySource: "ESP field engine", normalization: "declared electrostatic model", palette: "potential diverging", missingValuePolicy: "no field -> experimental diagnostic", legend: "electrostatic potential", version: "esp-field-v1", capability: "EXPERIMENTAL" },
  { id: "hydrophobicity", name: "Hydrophobicity", targetLevel: "residue", requiredProperties: ["polymer residue identity"], propertySource: "CanonicalResidue.name", normalization: "Kyte-Doolittle score [-4.5,+4.5]", palette: "blue-white-orange", missingValuePolicy: "unknown residue -> neutral grey", legend: "hydrophilic / hydrophobic", version: "kyte-doolittle-1982-v1", capability: "SUPPORTED_WITH_LIMITATIONS" },
  { id: "rainbow", name: "Rainbow", targetLevel: "polymer", requiredProperties: ["canonical chain/residue order"], propertySource: "CanonicalHierarchy chain.residueIds", normalization: "declared ordered residue ordinal", palette: "ROYGBIV", missingValuePolicy: "non-polymer -> stable neutral", legend: "polymer order", version: "polymer-order-rainbow-v1", capability: "SUPPORTED" },
  { id: "monochrome", name: "Monochrome", targetLevel: "atom", requiredProperties: [], propertySource: "presentation explicit monochrome color", normalization: "none", palette: "#d7e0ea", missingValuePolicy: "none", legend: "one color", version: "monochrome-v1", capability: "SUPPORTED" },
  { id: "colourblind-safe", name: "Colourblind-safe", targetLevel: "object", requiredProperties: ["stable object/chain identity"], propertySource: "CanonicalMolecularStructure.id and ChainID", normalization: "deterministic categorical index", palette: "Okabe-Ito", missingValuePolicy: "stable hash fallback", legend: "accessible categorical", version: "okabe-ito-2018-v1", capability: "SUPPORTED" },
  { id: "secondary-structure-standard", name: "Secondary Structure (Standard)", targetLevel: "residue", requiredProperties: ["SecondaryStructureDataset"], propertySource: "canonical imported assignment", normalization: "HELIX/SHEET/LOOP categories", palette: "standard helix/sheet/loop", missingValuePolicy: "no accepted assignment -> SECONDARY_STRUCTURE_UNAVAILABLE", legend: "helix / sheet / loop", version: "secondary-standard-v1", capability: "SUPPORTED_WITH_LIMITATIONS" },
  { id: "secondary-structure-jmol", name: "Secondary Structure (Jmol)", targetLevel: "residue", requiredProperties: ["SecondaryStructureDataset"], propertySource: "same canonical imported assignment", normalization: "HELIX/SHEET/LOOP categories", palette: "Jmol helix/sheet/loop", missingValuePolicy: "no accepted assignment -> SECONDARY_STRUCTURE_UNAVAILABLE", legend: "helix / sheet / loop", version: "secondary-jmol-v1", capability: "SUPPORTED_WITH_LIMITATIONS" },
  { id: "chain", name: "By Chain", targetLevel: "object", requiredProperties: ["CanonicalChain.id"], propertySource: "CanonicalChain.id", normalization: "stable categorical hash", palette: "chain categorical", missingValuePolicy: "missing chain -> neutral", legend: "chain", version: "chain-hash-v1", capability: "SUPPORTED" },
  { id: "element", name: "By Element (CPK)", targetLevel: "atom", requiredProperties: ["element"], propertySource: "CanonicalAtom.element", normalization: "element lookup", palette: "CPK 1.0", missingValuePolicy: "unknown element -> explicit neutral grey", legend: "element", version: "cpk-v1", capability: "SUPPORTED" },
  { id: "white", name: "White", targetLevel: "atom", requiredProperties: [], propertySource: "presentation constant", normalization: "none", palette: "#ffffff", missingValuePolicy: "none", legend: "white", version: "white-v1", capability: "SUPPORTED" },
];

const CPK: Record<string, string> = { H: "#ffffff", C: "#909090", N: "#3050f8", O: "#ff0d0d", F: "#90e050", CL: "#1ff01f", BR: "#a62929", I: "#940094", P: "#ff8000", S: "#ffff30", B: "#ffb5b5", SI: "#f0c8a0", FE: "#e06633", NA: "#ab5cf2", MG: "#8aff00", K: "#8f40d4", CA: "#3dff00", ZN: "#7d80b0", CU: "#c88033" };
const JMOL: Record<string, string> = { ...CPK, C: "#c8c8c8", N: "#8f8fff", O: "#f00000", S: "#ffc832", P: "#ff8000", FE: "#ffa500", NA: "#ab5cf2", CL: "#1ff01f" };
const ACCESSIBLE = ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#56b4e9", "#f0e442", "#000000"];
const HYDROPHOBICITY: Record<string, number> = { ILE: 4.5, VAL: 4.2, LEU: 3.8, PHE: 2.8, CYS: 2.5, MET: 1.9, ALA: 1.8, GLY: -0.4, THR: -0.7, SER: -0.8, TRP: -0.9, TYR: -1.3, PRO: -1.6, HIS: -3.2, GLU: -3.5, GLN: -3.5, ASP: -3.5, ASN: -3.5, LYS: -3.9, ARG: -4.5 };

const hash = (value: string): number => { let result = 2166136261; for (const char of value) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); } return result >>> 0; };
const hexFromHsl = (hue: number, saturation = 72, lightness = 62): string => {
  const s = saturation / 100; const l = lightness / 100; const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs((hue / 60) % 2 - 1)); const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
};
const diverging = (value: number): string => { const normalized = Math.max(-1, Math.min(1, value)); if (normalized < 0) return hexFromHsl(220, 76, 58 + normalized * 4); if (normalized > 0) return hexFromHsl(8, 76, 58 - normalized * 4); return "#ffffff"; };
const residueFor = (structure: CanonicalMolecularStructure, atom: CanonicalAtom) => Object.values(structure.hierarchy.residues).find((residue) => residue.chainId === `chain:${atom.chain}` && residue.number === atom.residueNumber && (residue.insertionCode ?? "") === (atom.insertionCode ?? ""));

export type ColorResolution = { status: "READY" | "UNAVAILABLE" | "EXPERIMENTAL"; color: string; diagnostic?: string };

const representationTypeFor = (representation: "lines" | "sticks" | "spheres" | "cartoon" | "licorice" | "cross" | RepresentationType): RepresentationType => {
  if (representation === "lines") return "LINES";
  if (representation === "sticks" || representation === "licorice") return "STICKS";
  if (representation === "spheres" || representation === "cross") return "SPHERES";
  if (representation === "cartoon") return "CARTOON";
  return representation;
};

/** Resolve explicit presentation colors before the inherited global scheme. */
export const resolveProjectedAtomColor = (
  color: Pick<ColorState, "mode" | "customHex" | "atomColors" | "representationOverrides"> & Partial<Pick<ColorState, "componentColors">>,
  representation: "lines" | "sticks" | "spheres" | "cartoon" | "licorice" | "cross" | RepresentationType,
  atom: CanonicalAtom | undefined,
  structure: CanonicalMolecularStructure,
  explicitGlobalColor?: string,
): ColorResolution => {
  const stableId = atom?.stableId;
  const atomOverride = stableId ? color.atomColors[stableId] : undefined;
  if (atomOverride) return { status: "READY", color: atomOverride };
  const representationOverride = stableId ? color.representationOverrides[stableId]?.[representationTypeFor(representation)] : undefined;
  if (representationOverride) return { status: "READY", color: representationOverride };
  if (!atom) return { status: "READY", color: explicitGlobalColor ?? "#7f8791" };
  const category = atom.isPolymer ? "protein" : atom.isLigand ? "ligand" : atom.isWater ? "water" : atom.isIon ? "ions" : "other";
  const componentOverride = color.componentColors?.[category];
  if (componentOverride && componentOverride.mode !== "inherit") {
    if (componentOverride.mode === "custom") return { status: "READY", color: componentOverride.customHex ?? "#d7e0ea" };
    return resolveAtomColor(componentOverride.mode, atom, structure);
  }
  if (color.mode === "named" && explicitGlobalColor) return { status: "READY", color: explicitGlobalColor };
  return resolveAtomColor(color.mode, atom, structure, color.customHex);
};

export const colorSchemeDefinition = (id: ColorMode): ColorSchemeDefinition => COLOR_SCHEME_DEFINITIONS.find((definition) => definition.id === id) ?? COLOR_SCHEME_DEFINITIONS[0];

export const resolveAtomColor = (mode: ColorMode, atom: CanonicalAtom, structure: CanonicalMolecularStructure, customHex?: string | null): ColorResolution => {
  if (mode === "white") return { status: "READY", color: "#ffffff" };
  if (mode === "monochrome" || mode === "uniform" || mode === "custom") return { status: "READY", color: customHex ?? "#d7e0ea" };
  if (mode === "classic-cpk" || mode === "element") return { status: "READY", color: CPK[atom.element.toUpperCase()] ?? "#7f8791" };
  if (mode === "modern-jmol") return { status: "READY", color: JMOL[atom.element.toUpperCase()] ?? "#808080" };
  if (mode === "chain") return { status: "READY", color: hexFromHsl((hash(atom.chain) % 360), 65, 58) };
  if (mode === "by-molecule" || mode === "object") return { status: "READY", color: hexFromHsl(hash(structure.id) % 360, 65, 58) };
  if (mode === "colourblind-safe") return { status: "READY", color: ACCESSIBLE[hash(atom.chain || structure.id) % ACCESSIBLE.length] };
  if (mode === "rainbow") {
    const residue = residueFor(structure, atom); const chain = structure.hierarchy.chains[`chain:${atom.chain}`]; const ordinal = chain ? Math.max(0, chain.residueIds.indexOf(residue?.id ?? "")) : atom.residueNumber;
    const total = chain ? Math.max(1, chain.residueIds.length - 1) : Math.max(1, atom.residueNumber); return { status: "READY", color: hexFromHsl((ordinal / total) * 280, 82, 58) };
  }
  if (mode === "hydrophobicity") {
    const score = HYDROPHOBICITY[atom.residueName.toUpperCase()]; if (score === undefined) return { status: "UNAVAILABLE", color: "#7f8791", diagnostic: "HYDROPHOBICITY_RESIDUE_UNAVAILABLE" }; return { status: "READY", color: diverging(score / 4.5) };
  }
  if (mode === "by-formal-charge") {
    if (atom.formalCharge === undefined || atom.formalCharge === null) return { status: "UNAVAILABLE", color: "#7f8791", diagnostic: "FORMAL_CHARGE_UNKNOWN" }; return { status: "READY", color: diverging(atom.formalCharge / 3) };
  }
  if (mode === "by-partial-charge") {
    const dataset = structure.partialChargeDataset; if (!dataset) return { status: "UNAVAILABLE", color: "#7f8791", diagnostic: "Partial-charge data unavailable for this molecular revision." }; const value = dataset.atomChargeMap[atom.stableId]; if (value === undefined) return { status: "UNAVAILABLE", color: "#7f8791", diagnostic: "Partial-charge data unavailable for this molecular revision." }; const values = Object.values(dataset.atomChargeMap); const max = Math.max(...values.map((entry) => Math.abs(entry)), 1e-9); return { status: "READY", color: diverging(value / max) };
  }
  if (mode === "esp") return { status: "EXPERIMENTAL", color: "#7f8791", diagnostic: "ESP field unavailable: no electrostatic potential computation is registered for this molecular revision." };
  if (mode === "secondary-structure-standard" || mode === "secondary-structure-jmol" || mode === "secondary-structure") {
    if (!structure.secondaryStructureDataset || !atom.secondaryStructure) return { status: "UNAVAILABLE", color: "#7f8791", diagnostic: "Secondary-structure assignment unavailable for this molecular revision." };
    const standard = { HELIX: "#e65c5c", SHEET: "#f0c84b", LOOP: "#8f9aa8" }; const jmol = { HELIX: "#ff8c69", SHEET: "#ffc107", LOOP: "#b0bec5" }; return { status: "READY", color: (mode === "secondary-structure-jmol" ? jmol : standard)[atom.secondaryStructure] };
  }
  return { status: "READY", color: "#7f8791" };
};

export const colorSchemeLabel = (mode: ColorMode): string => (({ named: "Named", custom: "Custom", uniform: "Monochrome", residue: "Residue", object: "Object", "secondary-structure": "Secondary Structure" } as Record<string, string>)[mode] ?? colorSchemeDefinition(mode).name);
