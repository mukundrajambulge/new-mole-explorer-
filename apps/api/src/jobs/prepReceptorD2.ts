import {
  D2_RECEPTOR_PROFILE_ID,
  SCIENTIFIC_PROFILE_IDS,
  type D2AltlocResolution,
  type D2PreparedReceptorScientificDependenciesV2,
  type D2PreparedReceptorStateV2,
  type D2ReceptorComponentRoleV1,
  type PrepPlanV1,
} from "@molecular/contracts";
import type { D2AdaptedRepresentation } from "../docking/d2Adapters.js";
import { sealPreparedReceptorState } from "../docking/d2Preparation.js";
import { scientificDigest } from "../docking/scientificSerialization.js";
import { explicitSubmittedState } from "./prepLigandD2.js";

/**
 * Maps a verified prep receptor (receptor.clean.pdb adapted by the D2 adapter) into the existing
 * sealPreparedReceptorState (task 5.2b fix round). Every input is derived from the confirmed plan and the
 * hash-verified outputs; nothing is filled with a placeholder:
 * - chemical state: re-declared EXPLICIT_SUBMITTED only for an INTERIM job that kept the submitted hydrogens
 *   (zero added), with the plan digest as evidence; otherwise the adapter's UNKNOWN state goes in and D2 blocks it
 * - assembly: the asymmetric unit of model 1 restricted to the kept chains; membership digest over the component ids
 * - altloc: PRESERVE_ALL/NOT_APPLICABLE when the plan had no ALTLOC decision, else the user-acknowledged label choice
 * - component roles: POLYMER -> CORE, ION -> ION, COFACTOR -> COFACTOR, WATER -> MOBILE_WATER (D2 CORE_DRY blocks it)
 * - scientific dependencies: the three profile references below, from server constants only.
 */

/** The receptor seal's dependency profiles (IDs from contracts SCIENTIFIC_PROFILE_IDS). */
export const RECEPTOR_DEPENDENCY_PROFILE_IDS = Object.freeze({
  chemicalPerceptionProfileRef: SCIENTIFIC_PROFILE_IDS.supportedChemistry,
  receptorAtomTypingProfileRef: SCIENTIFIC_PROFILE_IDS.xsTyping,
  scoringProfileRef: SCIENTIFIC_PROFILE_IDS.scoring,
});
export type ReceptorDependencyField = keyof typeof RECEPTOR_DEPENDENCY_PROFILE_IDS;
export type ReceptorDependencyRefs = Readonly<Partial<D2PreparedReceptorScientificDependenciesV2>>;

/**
 * Server-side profile digests for the receptor dependencies. No server constant exists for any of them
 * (packages/contracts profiles.ts has the IDs only; native scoring.hpp has IDs only), and 5.2 may not add
 * one (owner decision, CLAUDE.md: never invent profile digests). Every missing entry is reported by name as
 * D2_PROFILE_DIGEST_UNAVAILABLE:<profileId> and the receptor stays BLOCKED until the owner publishes it.
 */
export const SERVER_D2_RECEPTOR_DEPENDENCIES: ReceptorDependencyRefs = Object.freeze({});

const SHA = /^sha256:[0-9a-f]{64}$/;

/** Names every dependency that is absent, malformed or bound to the wrong profile ID. */
export const missingReceptorDependencies = (deps: ReceptorDependencyRefs): string[] => {
  const out: string[] = [];
  for (const [field, profileId] of Object.entries(RECEPTOR_DEPENDENCY_PROFILE_IDS) as [ReceptorDependencyField, string][]) {
    const ref = deps[field];
    if (!ref || ref.profileId !== profileId || !SHA.test(ref.profileDigest)) out.push(`D2_PROFILE_DIGEST_UNAVAILABLE:${profileId}`.slice(0, 64));
  }
  return out;
};

export type ReceptorD2Outcome = Readonly<{ status: "SEALED" | "BLOCKED"; reasonCodes: readonly string[]; receptor?: D2PreparedReceptorStateV2 }>;

const ROLE: Readonly<Record<string, D2ReceptorComponentRoleV1["role"]>> = Object.freeze({
  POLYMER: "CORE",
  ION: "ION",
  COFACTOR: "COFACTOR",
  WATER: "MOBILE_WATER",
  REFERENCE_LIGAND: "REFERENCE_LIGAND",
  LIGAND: "OTHER",
  UNKNOWN: "OTHER",
});

export const sealReceptorFromPrep = (input: Readonly<{
  adapted: D2AdaptedRepresentation;
  plan: PrepPlanV1;
  /** True only for an INTERIM job whose manifest reports zero added receptor hydrogens and binds this plan. */
  explicitSubmitted: boolean;
  dependencies: ReceptorDependencyRefs;
}>): ReceptorD2Outcome => {
  const missing = missingReceptorDependencies(input.dependencies);
  if (missing.length) return { status: "BLOCKED", reasonCodes: missing };
  const { adapted, plan } = input;
  const graph = adapted.graph;
  const identity = adapted.identity;
  const declared = input.explicitSubmitted ? explicitSubmittedState(adapted, plan.planDigest) : undefined;
  const chemical = declared?.chemical ?? adapted.chemicalState;
  const coordinate = declared?.coordinate ?? adapted.coordinateStates[0];
  if (!graph || !identity || !chemical || !coordinate) return { status: "BLOCKED", reasonCodes: ["RECEPTOR_D2_STATE_MISSING"] };
  const evidence = `prep-plan:${plan.planDigest}`;
  const chains = new Set<string>();
  for (const atom of graph.atoms) for (const alias of atom.aliases) if (alias.chainId) chains.add(alias.chainId);
  const chainIds = [...chains].sort();
  const componentIds = graph.components.map((c) => c.componentId).sort();
  const membershipDigest = scientificDigest<"ProvenanceRecordDigest">("PREP_RECEPTOR_ASSEMBLY_MEMBERSHIP", "PREP_RECEPTOR_ASSEMBLY_MEMBERSHIP_V1", { graphRevisionDigest: graph.digest, modelNumber: 1, chainIds, componentIds });
  const altlocDecision = plan.decisions.find((d) => d.key === "ALTLOC");
  const altlocResolution: D2AltlocResolution = altlocDecision
    ? { policy: "EXPLICIT_LABEL", status: "UNIQUE", evidenceRef: `${evidence}#ALTLOC` }
    : { policy: "PRESERVE_ALL", status: "NOT_APPLICABLE" };
  const componentRoles: D2ReceptorComponentRoleV1[] = graph.components.map((c) => ({ componentId: c.componentId, role: ROLE[c.role] ?? "OTHER", evidenceRefs: [`${evidence}#COMPONENT_ROLE`] }));
  const deps = input.dependencies as D2PreparedReceptorScientificDependenciesV2;
  const sealed = sealPreparedReceptorState({
    receptorIdentity: identity,
    graphRevision: graph,
    chemicalState: chemical,
    coordinateState: coordinate,
    assembly: { selectionKind: "EXPLICIT_ASYMMETRIC_UNIT", assemblyId: `asymmetric-unit:model-1:chains-${chainIds.join(",")}`.slice(0, 200), membershipDigest },
    modelNumber: coordinate.sourceModelNumber ?? 1,
    chainIds,
    altlocResolution,
    componentRoles,
    profileId: D2_RECEPTOR_PROFILE_ID,
    scientificDependencies: { chemicalPerceptionProfileRef: deps.chemicalPerceptionProfileRef, receptorAtomTypingProfileRef: deps.receptorAtomTypingProfileRef, scoringProfileRef: deps.scoringProfileRef },
    siteCriticalAtomUids: [],
  });
  if (!sealed.value) return { status: "BLOCKED", reasonCodes: [...new Set(sealed.diagnostics.filter((d) => d.blocking).map((d) => `D2:${d.code}`.slice(0, 64)).concat("D2_RECEPTOR_SEAL_BLOCKED"))].slice(0, 50) };
  return { status: "SEALED", reasonCodes: [], receptor: sealed.value };
};
