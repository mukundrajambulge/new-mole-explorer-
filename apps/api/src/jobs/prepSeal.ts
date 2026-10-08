import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { PREP_PROFILE_ID, type D2PreparedLigandStateV1, type PrepComponentSealV1, type PrepManifestV1, type PrepSealSummaryV1 } from "@molecular/contracts";
import { sealLigandFromPdbqt, type LigandD2Outcome } from "./prepLigandD2.js";
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
  /** The D2 PreparedLigandState sealed by sealPreparedLigandState (INTERIM jobs only). */
  ligandState?: D2PreparedLigandStateV1;
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
  const chargeModel = manifest.summary?.chargeModel;
  if (!chargeModel) blockers.push("CHARGE_MODEL_MISSING");
  if (ligand && ligCanon && Array.isArray(ligCanon.atoms) && Array.isArray(ligCanon.bonds)) {
    if (ligCanon.atoms.length !== ligand.graph!.atoms.length || ligCanon.bonds.length !== ligand.graph!.bonds.length) blockers.push("LIGAND_CANONICAL_MISMATCH");
  } else if (ligand) blockers.push("LIGAND_CANONICAL_INVALID");
  if (receptor && recCanon && Array.isArray(recCanon.atoms) && recCanon.atoms.length !== manifest.summary?.receptorAtoms) blockers.push("RECEPTOR_CANONICAL_MISMATCH");

  // Ligand: the existing D2 kinematic + ligand seal functions, fed from the verified PDBQT. Generated chemistry
  // (template hydrogens, 3D embedding, Dimorphite-DL) is never D2-sealed: D2 core admits explicit state only.
  let ligandSeal: PrepComponentSealV1;
  let typedAtoms = 0;
  let ligandD2: LigandD2Outcome | undefined;
  if (qualification === "PREVIEW_UNQUALIFIED") {
    blockers.push("GENERATED_CHEMICAL_STATE");
    ligandSeal = { status: "PREVIEW_UNQUALIFIED", reasonCodes: ["GENERATED_CHEMICAL_STATE"] };
  } else if (!ligand || !chargeModel || blockers.length) {
    ligandSeal = { status: "BLOCKED", reasonCodes: ["LIGAND_SEAL_INPUTS_INVALID"] };
  } else {
    const pdbqt = get("out/ligand.pdbqt");
    const sm = manifest.summary;
    const explicit = sm && sm.ligandProtonation === "EXPLICIT_SUBMITTED" && sm.ligandHydrogensAdded === 0 && !sm.ligandEmbedded3d && state.plan?.tautomer === "AS_SUBMITTED" && manifest.planDigest === state.plan.planDigest;
    ligandD2 = sealLigandFromPdbqt({ adapted: ligand, pdbqt: pdbqt.toString("ascii"), pdbqtSha256: sha256(pdbqt), chargeModel, ...(explicit ? { explicitSubmittedPlanDigest: state.plan!.planDigest } : {}) });
    typedAtoms = ligandD2.typedAtoms;
    ligandSeal = { status: ligandD2.status, reasonCodes: [...ligandD2.reasonCodes].slice(0, 50), ...(ligandD2.ligand ? { digest: ligandD2.ligand.digest } : {}) };
    for (const c of ligandD2.reasonCodes) blockers.push(c);
  }
  // Receptor: sealPreparedReceptorState needs chemical-perception, receptor-typing and scoring profile digests.
  // None exists as a server constant and 5.2 may not add one (owner decision), so the receptor stays BLOCKED.
  const receptorCodes = Object.values(SERVER_D2_DEPENDENCY_DIGESTS).some((d) => !d) ? ["D2_PROFILE_DIGEST_UNAVAILABLE"] : [];
  if (!receptor) receptorCodes.push("RECEPTOR_D2_ADAPTATION_FAILED");
  for (const c of receptorCodes) blockers.push(c);
  const receptorSeal: PrepComponentSealV1 = { status: "BLOCKED", reasonCodes: receptorCodes.length ? receptorCodes : ["RECEPTOR_SEAL_UNWIRED"] };
  if (!receptorCodes.length) blockers.push("RECEPTOR_SEAL_UNWIRED");

  const hard = blockers.filter((b) => b !== "GENERATED_CHEMICAL_STATE");
  const status: PrepSealSummaryV1["status"] = hard.length ? "BLOCKED" : qualification === "PREVIEW_UNQUALIFIED" ? "PREVIEW_UNQUALIFIED" : "SEALED";
  return {
    status,
    qualification,
    reasonCodes: [...new Set(blockers)].slice(0, 100),
    verifiedOutputs: verified,
    components: { receptor: receptorSeal, ligand: ligandSeal },
    ...(receptor ? { receptor: { graphDigest: receptor.graph!.digest, identityDigest: receptor.identity!.digest, atoms: receptor.graph!.atoms.length } } : {}),
    ...(ligand ? { ligand: { graphDigest: ligand.graph!.digest, identityDigest: ligand.identity!.digest, atoms: ligand.graph!.atoms.length, bonds: ligand.graph!.bonds.length, typedAtoms } } : {}),
    ...(ligandD2?.ligand ? { ligandState: ligandD2.ligand } : {}),
  };
};

/** Store sealer: keeps only the schema summary on the job state. */
export const prepSummarySealer = async (store: PrepJobStore, jobId: string): Promise<PrepSealSummaryV1> => {
  const o = await sealFromPrepManifest(store, jobId);
  return { status: o.status, qualification: o.qualification, reasonCodes: [...o.reasonCodes], verifiedOutputs: o.verifiedOutputs, ...(o.components ? { components: o.components } : {}) };
};
