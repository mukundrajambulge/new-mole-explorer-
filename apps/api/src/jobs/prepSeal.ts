import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { PREP_PROFILE_ID, type D2PreparedLigandStateV1, type D2PreparedReceptorStateV2,type PrepComponentSealV1, type PrepManifestV1, type PrepSealSummaryV1 } from "@molecular/contracts";
import { sealLigandFromPdbqt, type LigandD2Outcome } from "./prepLigandD2.js";
import { adaptCanonicalStructure, type D2AdaptedRepresentation } from "../docking/d2Adapters.js";
import { StructureIngestionService } from "../structures/ingestion.js";
import { SourceArtifactStore } from "../lifecycle/sourceArtifactStore.js";
import { checkStageVersions, repoPrepPins, type PrepPinReport } from "./prepPins.js";
import { bindReceptorPdbqt, sealReceptorFromPrep, SERVER_D2_RECEPTOR_DEPENDENCIES, type ReceptorD2Outcome, type ReceptorDependencyRefs } from "./prepReceptorD2.js";
import { confinedPath, PREP_MAX_ARTIFACT_BYTES, PrepError, type PrepJobStore } from "./prepJobs.js";

/**
 * sealFromPrepManifest (task 5.2b, design 5.2 step 6).
 * 1. Re-reads prep-manifest.json and binds it to the stored job (jobId, planDigest, lock digest, profile ID).
 * 2. Re-hashes every output (size-capped, root-confined); any mismatch is REJECTED.
 * 3. Maps the cleaned outputs through the existing ingestion parsers and the D2 adapter
 *    (adaptCanonicalStructure), then checks every remaining D2 seal input. Profile IDs and digests come only
 *    from server constants; anything the worker does not provide is BLOCKED with a reason code, never a
 *    placeholder. Generated chemistry (PROPKA, Dimorphite-DL, template hydrogens) is PREVIEW_UNQUALIFIED.
 * 4. Tool drift: every manifest stages[].version must equal native/third_party/TOOLS.md (REJECTED otherwise).
 * 5. Receptor: sealPreparedReceptorState via prepReceptorD2.ts; ligand: kinematic + ligand seals via
 *    prepLigandD2.ts. SEALED overall needs both components SEALED.
 */

export type PrepSealOutcome = PrepSealSummaryV1 & Readonly<{
  /** pdbqtAtoms: receptor.pdbqt records bound to graph atoms; mergedHydrogens: graph H on carbon absent from the PDBQT. */
  receptor?: Readonly<{ graphDigest: string; identityDigest: string; atoms: number; pdbqtAtoms: number; mergedHydrogens: number }>;
  ligand?: Readonly<{ graphDigest: string; identityDigest: string; atoms: number; bonds: number; typedAtoms: number }>;
  /** The D2 PreparedLigandState sealed by sealPreparedLigandState (INTERIM jobs only). */
  ligandState?: D2PreparedLigandStateV1;
  /** The D2 PreparedReceptorState sealed by sealPreparedReceptorState (INTERIM jobs with published dependency digests). */
  receptorState?: D2PreparedReceptorStateV2;
}>;

const REQUIRED_OUTPUTS: readonly (readonly [PrepManifestV1["outputs"][number]["role"], string])[] = [
  ["RECEPTOR_PDBQT", "out/receptor.pdbqt"],
  ["RECEPTOR_CLEAN", "out/receptor.clean.pdb"],
  ["CANONICAL_JSON", "out/receptor.canonical.json"],
  ["LIGAND_PDBQT", "out/ligand.pdbqt"],
  ["LIGAND_CLEAN", "out/ligand.clean.sdf"],
  ["CANONICAL_JSON", "out/ligand.canonical.json"],
];

export type PrepSealOptions = Readonly<{
  pins?: () => PrepPinReport;
  /**
   * Receptor dependency profile references. Production uses SERVER_D2_RECEPTOR_DEPENDENCIES (server constants
   * only, currently none published); tests inject references to exercise the real sealPreparedReceptorState.
   * Never reachable from a request.
   */
  receptorDependencies?: ReceptorDependencyRefs;
}>;

const RECEPTOR_INPUT_BLOCKERS = new Set([
  "RECEPTOR_D2_ADAPTATION_FAILED",
  "RECEPTOR_CANONICAL_MISMATCH",
  "RECEPTOR_SUMMARY_MISMATCH",
  "CANONICAL_JSON_UNREADABLE",
  "RECEPTOR_D2_STATE_MISSING",
  "RECEPTOR_COORDINATES_MISSING",
  "RECEPTOR_PDBQT_INVALID",
  "RECEPTOR_PDBQT_UNMAPPED",
  "RECEPTOR_PDBQT_HEAVY_ATOM_MISSING",
  "RECEPTOR_PDBQT_POLAR_H_MISSING",
]);

const canonical =(v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
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

export const sealFromPrepManifest = async (store: PrepJobStore, jobId: string, options: PrepSealOptions = {}): Promise<PrepSealOutcome> => {
  const pins = options.pins ?? repoPrepPins;
  const dependencies = options.receptorDependencies ?? SERVER_D2_RECEPTOR_DEPENDENCIES;
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
  // Tool drift: every stage must have run the TOOLS.md version (fail closed, the job becomes FAILED).
  for (const c of checkStageVersions(manifest.stages, pin)) codes.push(c);
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
  // Parsed from the hash-verified bytes (not re-read from disk), so what is checked is what was hashed.
  let recCanon: unknown;
  let ligCanon: LigandCanonical | undefined;
  try {
    recCanon = JSON.parse(get("out/receptor.canonical.json").toString("utf8")) as unknown;
    ligCanon = JSON.parse(get("out/ligand.canonical.json").toString("utf8")) as LigandCanonical;
  } catch {
    blockers.push("CANONICAL_JSON_UNREADABLE");
  }
  const chargeModel = manifest.summary?.chargeModel;
  if (!chargeModel) blockers.push("CHARGE_MODEL_MISSING");
  if (ligand && ligCanon && Array.isArray(ligCanon.atoms) && Array.isArray(ligCanon.bonds)) {
    if (ligCanon.atoms.length !== ligand.graph!.atoms.length || ligCanon.bonds.length !== ligand.graph!.bonds.length) blockers.push("LIGAND_CANONICAL_MISMATCH");
  } else if (ligand) blockers.push("LIGAND_CANONICAL_INVALID");
  // Receptor: bind the docked receptor.pdbqt to the graph adapted from receptor.clean.pdb, and canonical.json
  // plus the summary count to that PDBQT (prepReceptorD2.bindReceptorPdbqt). Any mismatch blocks the receptor.
  const binding = receptor && recCanon !== undefined
    ? bindReceptorPdbqt({ adapted: receptor, pdbqt: get("out/receptor.pdbqt").toString("latin1"), canonical: recCanon, summaryAtoms: manifest.summary?.receptorAtoms })
    : undefined;
  for (const c of binding?.codes ?? []) blockers.push(c);

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
  // Receptor: the existing sealPreparedReceptorState, fed from the verified receptor.clean.pdb and the confirmed
  // plan (prepReceptorD2.ts). Its three dependency profile digests come from server constants only; a missing one
  // is named (D2_PROFILE_DIGEST_UNAVAILABLE:<profileId>) and keeps the receptor BLOCKED. Generated receptor
  // chemistry (PROPKA, template hydrogens) is never D2-sealed: it stays PREVIEW_UNQUALIFIED.
  let receptorSeal: PrepComponentSealV1;
  let receptorD2: ReceptorD2Outcome | undefined;
  if (qualification === "PREVIEW_UNQUALIFIED") {
    receptorSeal = { status: "PREVIEW_UNQUALIFIED", reasonCodes: ["GENERATED_CHEMICAL_STATE"] };
  } else if (!receptor || !state.plan || blockers.some((b) => RECEPTOR_INPUT_BLOCKERS.has(b))) {
    receptorSeal = { status: "BLOCKED", reasonCodes: ["RECEPTOR_SEAL_INPUTS_INVALID"] };
    blockers.push("RECEPTOR_SEAL_INPUTS_INVALID");
  } else {
    const sm = manifest.summary;
    const explicit = !!sm && sm.protonationSource === "EXPLICIT_SUBMITTED" && sm.receptorHydrogensAdded === 0 && manifest.planDigest === state.plan.planDigest;
    receptorD2 = sealReceptorFromPrep({ adapted: receptor, plan: state.plan, explicitSubmitted: explicit, dependencies });
    receptorSeal = { status: receptorD2.status, reasonCodes: [...receptorD2.reasonCodes].slice(0, 50), ...(receptorD2.receptor ? { digest: receptorD2.receptor.digest } : {}) };
    for (const c of receptorD2.reasonCodes) blockers.push(c);
  }

  const hard = blockers.filter((b) => b !== "GENERATED_CHEMICAL_STATE");
  const bothSealed = receptorSeal.status === "SEALED" && ligandSeal.status === "SEALED";
  const status: PrepSealSummaryV1["status"] = hard.length ? "BLOCKED" : qualification === "PREVIEW_UNQUALIFIED" ? "PREVIEW_UNQUALIFIED" : bothSealed ? "SEALED" : "BLOCKED";
  return {
    status,
    qualification,
    reasonCodes: [...new Set(blockers)].slice(0, 100),
    verifiedOutputs: verified,
    components: { receptor: receptorSeal, ligand: ligandSeal },
    ...(receptor ? { receptor: { graphDigest: receptor.graph!.digest, identityDigest: receptor.identity!.digest, atoms: receptor.graph!.atoms.length, pdbqtAtoms: binding?.mappedAtoms ?? 0, mergedHydrogens: binding?.mergedHydrogens ?? 0 } } : {}),
    ...(ligand ? { ligand: { graphDigest: ligand.graph!.digest, identityDigest: ligand.identity!.digest, atoms: ligand.graph!.atoms.length, bonds: ligand.graph!.bonds.length, typedAtoms } } : {}),
    ...(ligandD2?.ligand ? { ligandState: ligandD2.ligand } : {}),
    ...(receptorD2?.receptor ? { receptorState: receptorD2.receptor } : {}),
  };
};

/** Store sealer: keeps only the schema summary on the job state. */
export const createPrepSummarySealer = (options: PrepSealOptions = {}) => async (store: PrepJobStore, jobId: string): Promise<PrepSealSummaryV1> => {
  const o = await sealFromPrepManifest(store, jobId, options);
  return { status: o.status, qualification: o.qualification, reasonCodes: [...o.reasonCodes], verifiedOutputs: o.verifiedOutputs, ...(o.components ? { components: o.components } : {}) };
};
/** The production sealer: server constants only. */
export const prepSummarySealer = createPrepSummarySealer();
