import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { StructureIngestionService } from "../../apps/api/src/structures/ingestion.ts";

const input = process.argv[2];
if (!input) throw new Error("Usage: tsx verification/p0-perf/measure-ingestion.ts <path>");

const filePath = resolve(input);
const bytes = await readFile(filePath);
if (typeof global.gc === "function") global.gc();
const before = process.memoryUsage();
const started = performance.now();
const result = await new StructureIngestionService().ingestLocal(filePath, bytes);
const elapsedMs = performance.now() - started;
if (typeof global.gc === "function") global.gc();
const after = process.memoryUsage();
const structure = result.structure;

console.log(JSON.stringify({
  filePath,
  bytes: bytes.length,
  elapsedMs: Math.round(elapsedMs * 100) / 100,
  memory: {
    beforeRssBytes: before.rss,
    afterRssBytes: after.rss,
    peakUnavailable: true,
  },
  structure: {
    scientificHash: structure.scientificHash,
    canonicalStorage: structure.compact?.schemaVersion ?? "object",
    atoms: structure.counts.atoms,
    bonds: structure.compact?.bonds.ids.length ?? structure.bonds.length,
    residues: structure.counts.residues,
    chains: structure.counts.chains,
    coordinateStates: structure.coordinateStates.length,
    polymerAtoms: structure.counts.polymerAtoms,
    ligandAtoms: structure.counts.ligandAtoms,
    waterAtoms: structure.counts.waterAtoms,
    ionAtoms: structure.counts.ionAtoms,
  },
}, null, 2));
