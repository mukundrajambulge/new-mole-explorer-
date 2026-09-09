import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const corpus = join(root, "verification/autonomous-pymol/corpus");
const cases = [
  ["g1c-small-molecule.pdb.json", "XS", "local", null, ["bonds", "elements", "ligand colors", "sticks", "VDW", "labels", "selection", "editing"], "Small chemically distinct ligand fixture."],
  ["ring-ligand.pdb.json", "XS", "local", null, ["aromatic/ring connectivity", "sticks", "labels", "selection"], "Ring connectivity fixture."],
  ["mini-protein.pdb.json", "XS", "local", null, ["protein/ligand/water/ion classification", "selection", "multi-chain"], "Deterministic mixed-component fixture."],
  ["multistate.pdb.json", "S", "local", null, ["multi-state", "state selection", "intra analysis"], "Deterministic two-state structure."],
  ["typed-nucleic.mmcif.json", "S/M", "local", null, ["typed nucleic polymer", "mmCIF identity"], "Typed nucleic-acid mmCIF fixture."],
  ["edge-identity.mmcif.json", "S/M", "local", null, ["altloc", "insertion/identity edge cases"], "Canonical identity and alternate-location fixture."],
  ["g1c-secondary-formal.pdb.json", "S", "local", null, ["secondary structure", "formal properties"], "Secondary-structure metadata fixture."],
  ["unit-cell.pdb.json", "S", "local", null, ["unit cell", "water", "ion"], "Unit-cell and solvent/ion fixture."],
  ["LOCAL-g1c-malformed.json", "S", "local", null, ["malformed input rejection"], "Negative import case."],
  ["RCSB-1CRN.json", "S", "RCSB", "1CRN", ["small protein", "real RCSB", "unit cell"], "Canonical small protein baseline."],
  ["RCSB-1UBQ.json", "S/M", "RCSB", "1UBQ", ["standard protein", "waters", "two chains"], "Standard protein with crystallographic waters."],
  ["RCSB-4DJW.json", "M", "RCSB", "4DJW", ["protein-ligand complex", "4DJW canonical counts", "water", "multi-chain"], "Required canonical acceptance structure."],
  ["RCSB-1BNA.json", "S/M", "RCSB", "1BNA", ["DNA duplex", "nucleic acid", "water"], "Canonical DNA duplex."],
  ["RCSB-1TRA.json", "S/M", "RCSB", "1TRA", ["tRNA/RNA", "ligands", "ions", "water"], "RNA/tRNA class with bound components."],
  ["RCSB-1EH1.json", "S/M", "RCSB", "1EH1", ["nonstandard/biopolymer comparison"], "Additional real polymer structure."],
  ["RCSB-1G6V.json", "M", "RCSB", "1G6V", ["glycosylation candidate", "hetero/ion classification"], "Real complex used to inspect hetero-component handling."],
  ["RCSB-1C3W.json", "M", "RCSB", "1C3W", ["membrane protein", "multi-chain", "ligand/water"], "Membrane-protein class."],
  ["RCSB-1AON.json", "L", "RCSB", "1AON", ["multi-chain complex", "large structure", "parser latency"], "Large oligomeric hemoglobin assembly; canonical ingester parsed it."],
  ["RCSB-5LE5.json", "L", "RCSB", "5LE5", ["large assembly", "alternate locations", "ions", "waters", "ligands"], "Large real assembly; 52k-atom stress case."],
  ["RCSB-3J9M.json", "XL", "RCSB", "3J9M", ["XL assembly", "ribosomal/large complex"], "XL stress case; parser result is recorded if completed."],
  ["RCSB-4V6F.json", "XXL", "RCSB", "4V6F", ["ribosomal biological assembly", ">500k target class"], "XXL attempt bounded by the 25 MB ingestion limit."],
  ["RCSB-1AFO.json", "M", "RCSB", "1AFO", ["membrane/multi-model import edge"], "Real structure rejected because coordinate models lack validated correspondence."],
];

const rows = [];
for (const [file, sizeClass, source, pdbId, scientificFeatures, reason] of cases) {
  const path = join(corpus, file);
  let probe;
  try { probe = JSON.parse(await readFile(path, "utf8")); }
  catch { rows.push({ caseId: file, status: "BLOCKED", source, pdbId, sizeClass, reason: "Probe output missing." }); continue; }
  const counts = probe.counts ?? {};
  rows.push({
    caseId: source === "RCSB" ? `RCSB-${pdbId}` : probe.caseId,
    source,
    pdbId,
    sizeClass,
    downloadTimestamp: probe.collectedAt,
    sha256: probe.sha256,
    inputFormat: probe.inputFormat,
    fileSizeBytes: probe.bytes,
    atomCount: counts.atoms ?? null,
    residueCount: counts.residues ?? null,
    chainCount: counts.chains ?? null,
    stateCount: probe.stateCount ?? null,
    proteinAtoms: counts.polymerAtoms ?? null,
    nucleicAtoms: null,
    ligandAtoms: counts.ligandAtoms ?? null,
    waterAtoms: counts.waterAtoms ?? null,
    ionAtoms: counts.ionAtoms ?? null,
    otherAtoms: counts.otherAtoms ?? null,
    bondCount: probe.bondCount ?? null,
    scientificFeatures,
    reason,
    testsPerformed: probe.status === "PASS" ? ["canonical ingestion", "count/hash capture", "feature flags"] : ["negative/limit import probe"],
    status: probe.status === "PASS" ? "PASS" : "BLOCKED",
    blockedReason: probe.blockedReason ?? null,
    parserFeatures: probe.features ?? null,
  });
}

const pass = rows.filter((row) => row.status === "PASS" && typeof row.atomCount === "number");
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourcePolicy: "RCSB/wwPDB files are authoritative real structures; local fixtures remain deterministic edge/negative controls.",
  applicationLimitBytes: 25 * 1024 * 1024,
  cases: rows,
  summary: {
    structureCount: rows.length,
    passCount: rows.filter((row) => row.status === "PASS").length,
    blockedCount: rows.filter((row) => row.status === "BLOCKED").length,
    atomSizeRange: { min: Math.min(...pass.map((row) => row.atomCount)), max: Math.max(...pass.map((row) => row.atomCount)) },
    structuralClasses: [...new Set(rows.map((row) => row.sizeClass))],
  },
};
await writeFile(join(root, "verification/autonomous-pymol/DATASET_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(JSON.stringify(manifest.summary, null, 2) + "\n");
