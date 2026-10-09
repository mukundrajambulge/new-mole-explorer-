import type { PrepJobStateV1 } from "@molecular/contracts";

/** Owner decision 2026-10-09 (RESEARCH-DIGEST section 7): the Vina run is the separate EXPERIMENTAL capability. */
export const VINA_EXPERIMENTAL_BANNER = "Vina comparator preview — EXPERIMENTAL. Implemented, not yet verified or evaluated. Scores are empirical Vina scores, not binding free energies.";

/** Dockable ids of a finished preparation: SEALED ids first, else the PREVIEW_UNQUALIFIED ones; null when none were issued. */
export const preparedIds = (prep: PrepJobStateV1 | null): { receptor: string; ligand: string } | null => {
  if (!prep || prep.state !== "SUCCEEDED") return null;
  if (prep.preparedReceptorId && prep.preparedLigandId) return { receptor: prep.preparedReceptorId, ligand: prep.preparedLigandId };
  if (prep.previewReceptorId && prep.previewLigandId) return { receptor: prep.previewReceptorId, ligand: prep.previewLigandId };
  return null;
};

/** Why a preparation cannot feed a docking run, or null when it can. */
export const prepBlockReason = (prep: PrepJobStateV1 | null): string | null => {
  if (!prep) return null;
  const plan = prep.plan;
  const why = (list: readonly string[] | undefined) => (list && list.length > 0 ? `: ${list.slice(0, 6).join("; ")}` : ".");
  if (plan?.status === "BLOCKED" || plan?.status === "UNSUPPORTED") return `Preparation is ${plan.status}${why(plan.diagnostics ?? plan.warnings)}`;
  if (prep.state === "FAILED" || prep.state === "EXPIRED") return `Preparation ${prep.state}${prep.error ? `: ${prep.error}` : why(plan?.diagnostics)}`;
  if (prep.state === "SUCCEEDED" && !preparedIds(prep)) return `Preparation finished but its seal is ${prep.seal?.status ?? "missing"}${why(prep.seal?.reasonCodes)} No dockable ids were issued.`;
  return null;
};
