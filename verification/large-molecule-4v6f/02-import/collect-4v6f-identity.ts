import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { StructureIngestionService } from "../../../apps/api/src/structures/ingestion.ts";
import { evaluateSelectionQuery } from "../../../apps/web/src/selection/selectionEngine.ts";

const sourcePath = new URL("../01-source/4v6f.cif", import.meta.url);
const bytes = await readFile(sourcePath);
const text = bytes.toString("utf8");
const started = performance.now();
const loaded = await new StructureIngestionService().ingestLocal("4v6f.cif", bytes);
const parseCompleted = performance.now();
const structure = loaded.structure;

const atomRows = text.split(/\r?\n/).filter((line) => /^(ATOM|HETATM)\s/.test(line));
const headers = text.split(/\r?\n/).filter((line) => /^_atom_site\./.test(line.trim()));
const headerIndex = (name: string) => headers.findIndex((header) => header.trim() === name);
const entityIndex = headerIndex("_atom_site.label_entity_id");
const chainIndex = headerIndex("_atom_site.label_asym_id");
const serialIndex = headerIndex("_atom_site.id");
const entityBySerial = new Map<number, string>();
const entitiesByChain = new Map<string, Set<string>>();
for (const row of atomRows) {
  const tokens = row.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  const serial = Number(tokens[serialIndex]);
  const chain = tokens[chainIndex];
  const entity = tokens[entityIndex];
  if (Number.isFinite(serial) && chain && entity && entity !== "." && entity !== "?") {
    entityBySerial.set(serial, entity);
    const values = entitiesByChain.get(chain) ?? new Set<string>();
    values.add(entity);
    entitiesByChain.set(chain, values);
  }
}

const membershipHash = (ids: readonly string[]) => createHash("sha256").update(ids.slice().sort().join("\n")).digest("hex");
const queryNames = ["all", "polymer", "polymer.protein", "polymer.nucleic", "organic", "inorganic", "solvent", "metals", "hydrogens", "hetatm", "backbone", "sidechain", "guide"];
const selections = Object.fromEntries(queryNames.map((query) => {
  const result = evaluateSelectionQuery(query, structure);
  return [query, { status: result.status, count: result.count, membershipHash: membershipHash(result.stableAtomIds), diagnostics: result.diagnostics }];
}));

const chains = Object.fromEntries(structure.hierarchy.chainIds.map((chainKey) => {
  const chain = structure.hierarchy.chains[chainKey]!;
  const chainAtoms = structure.atoms.filter((atom) => `chain:${atom.chain}` === chainKey);
  const polymerTypes = [...new Set(chainAtoms.map((atom) => atom.polymerType).filter(Boolean))];
  return [chain.name, {
    chainId: chain.name,
    entityIds: [...(entitiesByChain.get(chain.name) ?? new Set<string>())].sort(),
    polymerTypes,
    protein: polymerTypes.includes("PROTEIN"),
    nucleic: polymerTypes.includes("NUCLEIC_ACID"),
    residueCount: chain.residueIds.length,
    atomCount: chainAtoms.length,
    polymerAtomCount: chainAtoms.filter((atom) => atom.isPolymer).length,
  }];
}));

const atoms = structure.atoms;
const parsedIdentity = {
  pdbId: "4V6F",
  sourceSha256: loaded.source.sha256,
  atoms: atoms.length,
  residues: Object.keys(structure.hierarchy.residues).length,
  chains: structure.hierarchy.chainIds.length,
  statesModels: structure.coordinateStates.length,
  polymerAtoms: atoms.filter((atom) => atom.isPolymer).length,
  proteinAtoms: atoms.filter((atom) => atom.polymerType === "PROTEIN").length,
  nucleicAtoms: atoms.filter((atom) => atom.polymerType === "NUCLEIC_ACID").length,
  organicAtoms: atoms.filter((atom) => atom.isLigand).length,
  inorganicAtoms: atoms.filter((atom) => atom.isIon).length,
  hetatmAtoms: atoms.filter((atom) => atom.recordType === "HETATM").length,
  solventAtoms: atoms.filter((atom) => atom.isWater).length,
  metals: atoms.filter((atom) => atom.isIon && !["CL", "BR", "I"].includes(atom.element.toUpperCase())).length,
  hydrogens: atoms.filter((atom) => ["H", "D", "T"].includes(atom.element.toUpperCase())).length,
  backbone: selections.backbone.count,
  sidechain: selections.sidechain.count,
  guide: selections.guide.count,
  bondCount: structure.bonds.length,
  countsFromCanonicalStructure: structure.counts,
  bounds: structure.bounds,
  polymerTypingSource: structure.polymerTypingSource,
  scientificHash: structure.scientificHash,
  sourceArtifactSha256: loaded.sourceArtifact?.sha256 ?? null,
  parserProfile: loaded.source.parserProfile,
  elapsedMs: Math.round(parseCompleted - started),
};

console.log(JSON.stringify({
  sourceBytes: bytes.length,
  sourceSha256: loaded.source.sha256,
  parsedIdentity,
  chainInventory: chains,
  selections,
}, null, 2));
