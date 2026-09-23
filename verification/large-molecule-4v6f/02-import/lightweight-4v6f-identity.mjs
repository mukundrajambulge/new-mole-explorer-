import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const started = performance.now();
const path = new URL("../01-source/4v6f.cif", import.meta.url);
const content = await readFile(path, "utf8");
const tokenize = (line) => line.match(/"[^"]*"|'[^']*'|\S+/g)?.map((value) => value.replace(/^['"]|['"]$/g, "")) ?? [];
const lines = content.split(/\r?\n/);

const entityTypes = new Map();
let entityHeaders = [];
let readingEntities = false;
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("_entity_poly.")) {
    entityHeaders.push(trimmed);
    readingEntities = true;
    continue;
  }
  if (readingEntities && entityHeaders.length && trimmed && !trimmed.startsWith("_") && !trimmed.startsWith("#")) {
    const tokens = tokenize(trimmed);
    const entityIndex = entityHeaders.indexOf("_entity_poly.entity_id");
    const typeIndex = entityHeaders.indexOf("_entity_poly.type");
    if (tokens[entityIndex] && tokens[typeIndex]) entityTypes.set(tokens[entityIndex], tokens[typeIndex]);
    continue;
  }
  if (readingEntities && (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("_"))) {
    if (!trimmed.startsWith("_entity_poly.")) {
      readingEntities = false;
      entityHeaders = [];
    }
  }
}

const atomHeaders = [];
let readingAtoms = false;
const atoms = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("_atom_site.")) {
    atomHeaders.push(trimmed);
    readingAtoms = true;
    continue;
  }
  if (!readingAtoms) continue;
  if (/^(ATOM|HETATM)\s/.test(trimmed)) {
    const tokens = tokenize(trimmed);
    const at = (name) => tokens[atomHeaders.indexOf(name)];
    atoms.push({
      serial: Number(at("_atom_site.id")),
      group: at("_atom_site.group_PDB"),
      element: (at("_atom_site.type_symbol") ?? "").toUpperCase(),
      atomName: at("_atom_site.label_atom_id") ?? at("_atom_site.auth_atom_id") ?? "X",
      residueName: at("_atom_site.label_comp_id") ?? at("_atom_site.auth_comp_id") ?? "UNK",
      chain: at("_atom_site.label_asym_id") ?? at("_atom_site.auth_asym_id") ?? "_",
      entity: at("_atom_site.label_entity_id"),
      residueNumber: Number(at("_atom_site.label_seq_id") ?? at("_atom_site.auth_seq_id") ?? 0),
      insertion: at("_atom_site.pdbx_PDB_ins_code") ?? "",
      model: Number(at("_atom_site.pdbx_PDB_model_num") ?? 1),
    });
    continue;
  }
  if (atoms.length && trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("_")) break;
  if (atoms.length && (trimmed.startsWith("#") || trimmed.startsWith("_"))) break;
}

const waterResidues = new Set(["HOH", "WAT", "H2O", "DOD"]);
const ionElements = new Set(["LI", "NA", "K", "RB", "CS", "MG", "CA", "SR", "BA", "ZN", "FE", "MN", "CU", "CO", "NI", "CL", "BR", "I", "IOD"]);
const polymerTypeFor = (atom) => {
  const type = (entityTypes.get(atom.entity) ?? "").toLowerCase();
  if (type.includes("polypeptide")) return "PROTEIN";
  if (type.includes("ribonucleotide") || type.includes("deoxyribonucleotide") || type.includes("nucleotide")) return "NUCLEIC_ACID";
  if (type.includes("poly") || type.includes("peptide")) return "OTHER_POLYMER";
  return null;
};
const classifications = atoms.map((atom) => {
  const polymerType = polymerTypeFor(atom);
  const water = waterResidues.has(atom.residueName.toUpperCase());
  const ion = ionElements.has(atom.element) || ionElements.has(atom.residueName.toUpperCase());
  const ligand = !polymerType && !water && !ion;
  const proteinBackbone = polymerType === "PROTEIN" && new Set(["N", "CA", "C", "O"]).has(atom.atomName.replaceAll("'", "").trim());
  const nucleicBackbone = polymerType === "NUCLEIC_ACID" && new Set(["P", "OP1", "OP2", "O1P", "O2P", "O3P", "O5", "O5'", "C5", "C5'", "C4", "C4'", "O4", "O4'", "C3", "C3'", "O3", "O3'", "C2", "C2'", "O2", "O2'", "C1", "C1'"]).has(atom.atomName.trim());
  return { ...atom, polymerType, water, ion, ligand, backbone: proteinBackbone || nucleicBackbone, guide: (polymerType === "PROTEIN" && atom.atomName.trim() === "CA") || (polymerType === "NUCLEIC_ACID" && atom.atomName.trim() === "P"), hetatm: atom.group === "HETATM" };
});

const firstModelNumber = classifications.reduce((minimum, atom) => Math.min(minimum, atom.model), Number.POSITIVE_INFINITY);
const firstModel = classifications.filter((atom) => atom.model === firstModelNumber);
const residueKey = (atom) => `${atom.chain}:${atom.residueNumber}:${atom.insertion}:${atom.residueName}`;
const count = (predicate) => firstModel.filter(predicate).length;
const chains = {};
for (const atom of firstModel) {
  const chain = chains[atom.chain] ?? { chainId: atom.chain, entityIds: new Set(), polymerTypes: new Set(), residues: new Set(), atomCount: 0, polymerAtomCount: 0 };
  if (atom.entity) chain.entityIds.add(atom.entity);
  if (atom.polymerType) chain.polymerTypes.add(atom.polymerType);
  chain.residues.add(residueKey(atom));
  chain.atomCount += 1;
  if (atom.polymerType) chain.polymerAtomCount += 1;
  chains[atom.chain] = chain;
}
const chainInventory = Object.fromEntries(Object.entries(chains).map(([chainId, value]) => [chainId, {
  chainId,
  entityIds: [...value.entityIds].sort(),
  polymerTypes: [...value.polymerTypes].sort(),
  protein: value.polymerTypes.has("PROTEIN"),
  nucleic: value.polymerTypes.has("NUCLEIC_ACID"),
  residueCount: value.residues.size,
  atomCount: value.atomCount,
  polymerAtomCount: value.polymerAtomCount,
}]));
const memberships = {
  all: firstModel.length,
  polymer: count((atom) => Boolean(atom.polymerType)),
  "polymer.protein": count((atom) => atom.polymerType === "PROTEIN"),
  "polymer.nucleic": count((atom) => atom.polymerType === "NUCLEIC_ACID"),
  organic: count((atom) => atom.ligand),
  inorganic: count((atom) => atom.ion),
  solvent: count((atom) => atom.water),
  metals: count((atom) => atom.ion && !new Set(["CL", "BR", "I"]).has(atom.element)),
  hydrogens: count((atom) => new Set(["H", "D", "T"]).has(atom.element)),
  hetatm: count((atom) => atom.hetatm),
  backbone: count((atom) => atom.backbone),
  guide: count((atom) => atom.guide),
};
const tuple = (atom) => `${atom.serial}|${atom.chain}|${atom.residueNumber}|${atom.atomName}|${atom.element}`;
const hashFor = (predicate) => createHash("sha256").update(firstModel.filter(predicate).map(tuple).sort().join("\n")).digest("hex");
const hash = hashFor(() => true);
const parsedIdentity = {
  pdbId: "4V6F",
  sourceBytes: Buffer.byteLength(content),
  sourceSha256: createHash("sha256").update(content).digest("hex"),
  atomRows: atoms.length,
  statesModels: new Set(atoms.map((atom) => atom.model)).size,
  parsedIdentity: {
    atoms: firstModel.length,
    residues: new Set(firstModel.map(residueKey)).size,
    chains: Object.keys(chainInventory).length,
    polymerAtoms: memberships.polymer,
    proteinAtoms: memberships["polymer.protein"],
    nucleicAtoms: memberships["polymer.nucleic"],
    organicAtoms: memberships.organic,
    inorganicAtoms: memberships.inorganic,
    hetatmAtoms: memberships.hetatm,
    solventAtoms: memberships.solvent,
    metals: memberships.metals,
    hydrogens: memberships.hydrogens,
    backbone: memberships.backbone,
    sidechain: memberships.polymer - memberships.backbone,
    guide: memberships.guide,
    bondCount: null,
    membershipHash: hash,
  },
  method: "LIGHTWEIGHT_SOURCE_SCAN",
  canonicalServiceStatus: "BLOCKED_CANONICAL_IDENTITY_TIMEOUT_OVER_20_MINUTES",
  elapsedMs: Math.round(performance.now() - started),
};
const selectionResults = Object.fromEntries(Object.entries({
  all: () => true,
  none: () => false,
  polymer: (atom) => Boolean(atom.polymerType),
  "polymer.protein": (atom) => atom.polymerType === "PROTEIN",
  "polymer.nucleic": (atom) => atom.polymerType === "NUCLEIC_ACID",
  organic: (atom) => atom.ligand,
  inorganic: (atom) => atom.ion,
  solvent: (atom) => atom.water,
  metals: (atom) => atom.ion && !new Set(["CL", "BR", "I"]).has(atom.element),
  hydrogens: (atom) => new Set(["H", "D", "T"]).has(atom.element),
  hetatm: (atom) => atom.hetatm,
  backbone: (atom) => atom.backbone,
  guide: (atom) => atom.guide,
}).map(([query, predicate]) => [query, { query, count: firstModel.filter(predicate).length, membershipHash: hashFor(predicate), result: "SOURCE_SCAN_ONLY", applicationStatus: "NOT_EXECUTED_CANONICAL_IMPORT_BLOCKED" }]));
const report = { parsedIdentity, chainInventory, lightweightMemberships: memberships, selectionResults };
await writeFile(new URL("../03-identity/4V6F_PARSED_IDENTITY.json", import.meta.url), JSON.stringify(parsedIdentity, null, 2));
await writeFile(new URL("../03-identity/4V6F_CHAIN_INVENTORY.json", import.meta.url), JSON.stringify(chainInventory, null, 2));
await writeFile(new URL("../02-import/4V6F_LIGHTWEIGHT_SCAN_REPORT.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...parsedIdentity, chainCount: Object.keys(chainInventory).length, lightweightMemberships: memberships, outputFiles: ["03-identity/4V6F_PARSED_IDENTITY.json", "03-identity/4V6F_CHAIN_INVENTORY.json", "02-import/4V6F_LIGHTWEIGHT_SCAN_REPORT.json"] }, null, 2));
