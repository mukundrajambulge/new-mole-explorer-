import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StructureIngestionService } from "../../apps/api/src/structures/ingestion.js";

const MAX_STRUCTURE_BYTES = 25 * 1024 * 1024;
const id = process.argv[2]?.toUpperCase();
const localPath = process.argv[3];
const outPath = process.argv[4] ?? resolve("verification/autonomous-pymol/corpus", `${id ?? "unknown"}.json`);
if (!id && !localPath) throw new Error("Pass a four-character PDB id or a local path.");

const bytes = localPath
  ? await readFile(resolve(localPath))
  : Buffer.from(await (await fetch(`https://files.rcsb.org/download/${id}.cif`, { signal: AbortSignal.timeout(120_000) })).arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
const result: Record<string, unknown> = {
  caseId: id ? `RCSB-${id}` : `LOCAL-${resolve(localPath!).split(/[\\/]/).pop()}`,
  source: id ? "RCSB" : "LOCAL_FIXTURE",
  pdbId: id ?? null,
  inputFormat: id ? "mmcif" : resolve(localPath!).toLowerCase().endsWith(".pdb") ? "pdb" : "mmcif",
  bytes: bytes.length,
  sha256,
  collectedAt: new Date().toISOString(),
};
if (bytes.length > MAX_STRUCTURE_BYTES) {
  result.status = "BLOCKED";
  result.blockedReason = `Application ingestion hard limit is ${MAX_STRUCTURE_BYTES} bytes.`;
} else {
  const service = new StructureIngestionService();
  const filename = id ? `${id}.cif` : resolve(localPath!).split(/[\\/]/).pop()!;
  try {
    const loaded = await service.ingestLocal(filename, bytes);
    const structure = loaded.structure;
    result.status = "PASS";
    result.format = structure.format;
    result.counts = structure.counts;
    result.bondCount = structure.bonds.length;
    result.stateCount = structure.stateOrder.length;
    result.features = {
      multiState: structure.stateOrder.length > 1,
      unitCell: Boolean(structure.unitCell),
      secondaryStructure: Boolean(structure.secondaryStructureDataset),
      partialCharge: Boolean(structure.partialChargeDataset),
      polymerTyping: Boolean(structure.polymerTypingSource),
      chemistryRoles: Boolean(structure.chemistryDataset),
      insertionCodes: structure.atoms.some((atom) => Boolean(atom.insertionCode)),
      alternateLocations: structure.atoms.some((atom) => Boolean(atom.altLoc)),
      formalCharges: structure.atoms.some((atom) => atom.formalCharge !== undefined && atom.formalCharge !== null),
    };
    result.parserProfile = structure.source.parserProfile;
  } catch (error) {
    result.status = "BLOCKED";
    result.blockedReason = error instanceof Error ? error.message : String(error);
    result.errorCode = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "UNKNOWN";
  }
}
await mkdir(resolve(outPath, ".."), { recursive: true });
await writeFile(resolve(outPath), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
