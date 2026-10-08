import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { PREP_PROFILE_ID, type PrepManifestV1, type PrepSealSummaryV1 } from "@molecular/contracts";
import { adaptCanonicalStructure, type D2AdaptedRepresentation } from "../docking/d2Adapters.js";
import { StructureIngestionService } from "../structures/ingestion.js";
import { SourceArtifactStore } from "../lifecycle/sourceArtifactStore.js";
import { repoPrepPins, type PrepPinReport } from "./prepPins.js";
import { confinedPath, PREP_MAX_ARTIFACT_BYTES, PrepError, readCappedJson, type PrepJobStore } from "./prepJobs.js";

/**
 * sealFromPrepManifest (task 5.2b, design 5.2 step 6).
 * 1. Re-reads prep-manifest.json and binds it to the stored job (jobId, planDigest, lock digest, profile ID).
 * 2. Re-hashes every output (size-capped, root-confined); any mismatch is REJECTED.
 * 3. Maps the cleaned outputs through the existing ingestion parsers and the D2 adapter
 *    (adaptCanonicalStructure), then checks every remaining D2 seal input. Profile IDs and digests come only
 *    from server constants; anything the worker does not provide is BLOCKED with a reason code, never a
 *    placeholder. Generated chemistry (PROPKA, Dimorphite-DL, template hydrogens) is PREVIEW_UNQUALIFIED.
 */

export type PrepSealOutcome = PrepSealSummaryV1 & Readonly<{
  receptor?: Readonly<{ graphDigest: string; identityDigest: string; atoms: number }>;
  ligand?: Readonly<{ graphDigest: string; identityDigest: string; atoms: number; bonds: number; typedAtoms: number }>;
}>;

const REQUIRED_OUTPUTS: readonly (readonly [PrepManifestV1["outputs"][number]["role"], string])[] = [
  ["RECEPTOR_PDBQT", "out/receptor.pdbqt"],
  ["RECEPTOR_CLEAN", "out/receptor.clean.pdb"],
  ["CANONICAL_JSON", "out/receptor.canonical.json"],
  ["LIGAND_PDBQT", "out/ligand.pdbqt"],
  ["LIGAND_CLEAN", "out/ligand.clean.sdf"],
  ["CANONICAL_JSON", "out/ligand.canonical.json"],
];

/**
 * D2 scientific dependency profiles the receptor seal needs. No server-side digest constant exists for
 * these yet (owner decision: no new profile IDs/digests in 5.2), so the receptor seal stays BLOCKED.
 */
const SERVER_D2_DEPENDENCY_DIGESTS: Readonly<Record<string, string | undefined>> = Object.freeze({
  chemicalPerceptionProfileRef: undefined,
  receptorAtomTypingProfileRef: undefined,
  scoringProfileRef: undefined,
});

const canonical = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

const reject = (codes: string[], verified: number, qualification: PrepSealSummaryV1["qualification"]): PrepSealOutcome => ({ status: "REJECTED", qualification, reasonCodes: codes.slice(0, 100), verifiedOutputs: verified });

type LigandCanonical = { atoms: { element: string; x: number; y: number; z: number }[]; bonds: { a: number; b: number; order: number }[] };

/** Ligand atom typing evidence: one PDBQT ATOM record per canonical atom, matched by element and coordinates. */
const ligandTypingCoverage = (pdbqt: string, lig: LigandCanonical): number => {
  const records: { el: string; x: number; y: number; z: number; type: string }[] = [];
  for (const line of pdbqt.split("\n")) {
    if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) continue;
    const x = Number(line.slice(30, 38));
    const y = Number(line.slice(38, 46));
    const z = Number(line.slice(46, 54));
    const type = line.slice(77, 79).trim();
    const name = line.slice(12, 16).trim();
    if (!type || ![x, y, z].every(Number.isFinite)) continue;
    records.push({ el: name.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase(), x, y, z, type });
  }
  const used = new Set<number>();
  let typed = 0;
  for (const atom of lig.atoms) {
    const el = atom.element.slice(0, 1).toUpperCase();
    const idx = records.findIndex((r, i) => !used.has(i) && r.el === el && Math.abs(r.x - atom.x) < 2e-3 && Math.abs(r.y - atom.y) < 2e-3 && Math.abs(r.z - atom.z) < 2e-3);
    if (idx >= 0) {
      used.add(idx);
      typed++;
    }
  }
  return typed;
};

const adapt = async (ingestion: StructureIngestionService, filename: string, bytes: Buffer): Promise<D2AdaptedRepresentation | undefined> => {
  try {
    const loaded = await ingestion.ingestLocal(filename, bytes);
    const result = adaptCanonicalStructure({ structure: loaded.structure, ...(loaded.sourceArtifact ? { sourceArtifact: loaded.sourceArtifact } : {}) });
    return result.value?.graph && result.value.identity ? result.value : undefined;
  } catch {
    return undefined;
  }
};

export const sealFromPrepManifest = async (store: PrepJobStore, jobId: string, pins: () => PrepPinReport = repoPrepPins): Promise<PrepSealOutcome> => {
  const state = store.get(jobId);
  const dir = store.jobDir(jobId);
  let manifest: PrepManifestV1;
  try {
    manifest = store.readManifest(state);
  } catch (e) {
    return reject([e instanceof PrepError ? "MANIFEST_REJECTED" : "MANIFEST_UNREADABLE"], 0, "PREVIEW_UNQUALIFIED");
  }
  const qualification: PrepSealSummaryV1["qualification"] =
    manifest.qualification === "INTERIM" && manifest.summary?.protonationSource === "EXPLICIT_SUBMITTED" && manifest.summary.ligandProtonation === "EXPLICIT_SUBMITTED" ? "INTERIM" : "PREVIEW_UNQUALIFIED";
  const codes: string[] = [];
  if (state.manifest && canonical(state.manifest) !== canonical(manifest)) codes.push("MANIFEST_TAMPERED");
  if (manifest.status !== "PREPARED") codes.push("MANIFEST_NOT_PREPARED");
  if (manifest.profileId !== PREP_PROFILE_ID) codes.push("PROFILE_ID_MISMATCH");
  const pin = pins();
  if (!pin.ok || manifest.lockDigest !== pin.lockDigest) codes.push("LOCK_DIGEST_MISMATCH");
  const seen = new Set<string>();
  const bytesByPath = new Map<string, Buffer>();
  let verified = 0;
  for (const out of manifest.outputs) {
    if (seen.has(out.relPath)) {
      codes.push("OUTPUT_DUPLICATE");
      continue;
    }
    seen.add(out.relPath);
    let path: string;
    try {
      path = confinedPath(dir, out.relPath);
    } catch {
      codes.push("OUTPUT_PATH_REJECTED");
      continue;
    }
    try {
      const st = statSync(path);
      if (!st.isFile() || st.size > PREP_MAX_ARTIFACT_BYTES) {
        codes.push("OUTPUT_OVERSIZE");
        continue;
      }
      const data = readFileSync(path);
      if (data.length !== out.bytes || sha256(data) !== out.sha256) {
        codes.push("OUTPUT_TAMPERED");
        continue;
      }
      bytesByPath.set(out.relPath, data);
      verified++;
    } catch {
      codes.push("OUTPUT_MISSING");
    }
  }
  for (const [role, rel] of REQUIRED_OUTPUTS) {
    if (!manifest.outputs.some((o) => o.role === role && o.relPath === rel)) codes.push(`OUTPUT_ROLE_MISSING:${role}`.slice(0, 64));
  }
  if (codes.length) return reject([...new Set(codes)], verified, qualification);

  // Integrity holds. Map the verified outputs into D2 and list every missing seal input.
  const blockers: string[] = [];
  const ingestion = new StructureIngestionService(new SourceArtifactStore());
  const get = (rel: string) => bytesByPath.get(rel)!;
  const receptor = await adapt(ingestion, "receptor.clean.pdb", get("out/receptor.clean.pdb"));
  const ligand = await adapt(ingestion, "ligand.clean.sdf", get("out/ligand.clean.sdf"));
  if (!receptor) blockers.push("RECEPTOR_D2_ADAPTATION_FAILED");
  if (!ligand) blockers.push("LIGAND_D2_ADAPTATION_FAILED");
  let recCanon: { atoms?: unknown[]; bonds?: unknown } | undefined;
  let ligCanon: LigandCanonical | undefined;
  try {
    recCanon = readCappedJson(confinedPath(dir, "out/receptor.canonical.json")) as typeof recCanon;
    ligCanon = readCappedJson(confinedPath(dir, "out/ligand.canonical.json")) as LigandCanonical;
  } catch {
    blockers.push("CANONICAL_JSON_UNREADABLE");
  }
  let typedAtoms = 0;
  if (ligand && ligCanon && Array.isArray(ligCanon.atoms) && Array.isArray(ligCanon.bonds)) {
    if (ligCanon.atoms.length !== ligand.graph!.atoms.length || ligCanon.bonds.length !== ligand.graph!.bonds.length) blockers.push("LIGAND_CANONICAL_MISMATCH");
    typedAtoms = ligandTypingCoverage(get("out/ligand.pdbqt").toString("ascii"), ligCanon);
    // D2 needs typeId + chargeModel + evidenceRef for every ligand atom; Meeko merges nonpolar hydrogens,
    // so those atoms carry no typing evidence. Never fill them in.
    if (typedAtoms !== ligCanon.atoms.length) blockers.push("LIGAND_TYPING_EVIDENCE_INCOMPLETE");
  } else if (ligand) blockers.push("LIGAND_CANONICAL_INVALID");
  if (!manifest.summary?.chargeModel) blockers.push("CHARGE_MODEL_MISSING");
  if (receptor && recCanon && Array.isArray(recCanon.atoms) && recCanon.atoms.length !== manifest.summary?.receptorAtoms) blockers.push("RECEPTOR_CANONICAL_MISMATCH");
  // The worker does not export a D2 kinematic model (fragments, moving sets, axes) for the ligand.
  blockers.push("LIGAND_KINEMATIC_EVIDENCE_UNAVAILABLE");
  if (Object.values(SERVER_D2_DEPENDENCY_DIGESTS).some((d) => !d)) blockers.push("D2_PROFILE_DIGEST_UNAVAILABLE");
  if (qualification === "PREVIEW_UNQUALIFIED") blockers.push("GENERATED_CHEMICAL_STATE");
  const hard = blockers.filter((b) => b !== "GENERATED_CHEMICAL_STATE");
  // SEALED needs the D2 receptor/kinematic/ligand seal calls, which stay unwired until the kinematic evidence
  // and server dependency digests exist; until then a blocker-free INTERIM result still fails closed.
  const status: PrepSealSummaryV1["status"] = hard.length ? "BLOCKED" : qualification === "PREVIEW_UNQUALIFIED" ? "PREVIEW_UNQUALIFIED" : "BLOCKED";
  return {
    status,
    qualification,
    reasonCodes: blockers.slice(0, 100),
    verifiedOutputs: verified,
    ...(receptor ? { receptor: { graphDigest: receptor.graph!.digest, identityDigest: receptor.identity!.digest, atoms: receptor.graph!.atoms.length } } : {}),
    ...(ligand ? { ligand: { graphDigest: ligand.graph!.digest, identityDigest: ligand.identity!.digest, atoms: ligand.graph!.atoms.length, bonds: ligand.graph!.bonds.length, typedAtoms } } : {}),
  };
};

/** Store sealer: keeps only the schema summary on the job state. */
export const prepSummarySealer = async (store: PrepJobStore, jobId: string): Promise<PrepSealSummaryV1> => {
  const o = await sealFromPrepManifest(store, jobId);
  return { status: o.status, qualification: o.qualification, reasonCodes: [...o.reasonCodes], verifiedOutputs: o.verifiedOutputs };
};
