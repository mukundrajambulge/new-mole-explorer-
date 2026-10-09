import {
  D2_RECEPTOR_PROFILE_ID,
  f64Value,
  SCIENTIFIC_PROFILE_IDS,
  type D2AltlocResolution,
  type D2AtomUID,
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

/**
 * Binds the docked receptor.pdbqt to the sealed receptor graph (adapted from receptor.clean.pdb) and binds the
 * worker's receptor.canonical.json to that PDBQT (5.2b review fix). Without it a SEALED receptor state could sit
 * next to a PDBQT that Vina docks but that describes another structure. Rules (all fail closed, named codes):
 * - the PDBQT is rigid (no ROOT/BRANCH/TORSDOF) with 1..PDBQT_MAX_RECORDS well-formed ATOM/HETATM records;
 * - every record maps to exactly one distinct graph atom with the same chain, residue (name:number:icode),
 *   atom name, element (from the AutoDock type) and coordinates (PDBQT precision, 3 decimals);
 * - every heavy graph atom appears in the PDBQT; an absent graph atom may only be a hydrogen on carbon
 *   (AutoDock merges nonpolar hydrogens), so no polar hydrogen and no heavy atom can be dropped;
 * - canonical.json lists the same records in the same order (name, residue, chain, coordinates, type, charge)
 *   and the manifest summary reports the same receptor atom count.
 */
export const PDBQT_MAX_RECORDS = 200_000;

type ReceptorRec = { name: string; res: string; chain: string; seq: number; icode: string; x: number; y: number; z: number; charge: number; type: string };

const AD_ELEMENT: Readonly<Record<string, string>> = Object.freeze({ A: "C", C: "C", N: "N", NA: "N", NS: "N", OA: "O", OS: "O", O: "O", SA: "S", S: "S", H: "H", HD: "H", HS: "H" });
const adElement = (type: string): string => (AD_ELEMENT[type] ?? type).toUpperCase();
const RIGID_ONLY = /^(ROOT|ENDROOT|BRANCH|ENDBRANCH|TORSDOF|BEGIN_RES|END_RES)/;

const parseRigidPdbqt = (text: string): ReceptorRec[] | undefined => {
  const recs: ReceptorRec[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (RIGID_ONLY.test(line)) return undefined;
    if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) continue;
    if (recs.length >= PDBQT_MAX_RECORDS) return undefined;
    const rec: ReceptorRec = { name: line.slice(12, 16).trim(), res: line.slice(17, 20).trim(), chain: line.slice(21, 22).trim(), seq: Number(line.slice(22, 26)), icode: line.slice(26, 27).trim(), x: Number(line.slice(30, 38)), y: Number(line.slice(38, 46)), z: Number(line.slice(46, 54)), charge: Number(line.slice(70, 76)), type: line.slice(77, 79).trim() };
    if (!rec.name || !rec.type || !Number.isSafeInteger(rec.seq) || ![rec.x, rec.y, rec.z, rec.charge].every(Number.isFinite)) return undefined;
    recs.push(rec);
  }
  return recs.length ? recs : undefined;
};

const coordKey = (x: number, y: number, z: number): string => `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;
const CELL = 1.5;
const cellKey = (x: number, y: number, z: number): string => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
const push = <K, V>(m: Map<K, V[]>, k: K, v: V): void => {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
};

export type ReceptorPdbqtBinding = Readonly<{ codes: readonly string[]; mappedAtoms: number; mergedHydrogens: number }>;

const canonicalMatches = (catoms: readonly unknown[], recs: readonly ReceptorRec[]): boolean => {
  if (catoms.length !== recs.length) return false;
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i]!;
    const c = catoms[i] as Record<string, unknown> | null;
    if (!c || typeof c !== "object") return false;
    if (c.name !== r.name || c.res !== r.res || (c.chain ?? "") !== r.chain || c.seq !== r.seq || c.adType !== r.type) return false;
    if (typeof c.x !== "number" || typeof c.y !== "number" || typeof c.z !== "number" || typeof c.charge !== "number") return false;
    if (!near(c.x, r.x, 1.5e-3) || !near(c.y, r.y, 1.5e-3) || !near(c.z, r.z, 1.5e-3) || !near(c.charge, r.charge, 1.5e-3)) return false;
  }
  return true;
};

export const bindReceptorPdbqt = (input: Readonly<{ adapted: D2AdaptedRepresentation; pdbqt: string; canonical: unknown; summaryAtoms: number | undefined }>): ReceptorPdbqtBinding => {
  const graph = input.adapted.graph;
  const coordinate = input.adapted.coordinateStates[0];
  const fail = (code: string): ReceptorPdbqtBinding => ({ codes: [code], mappedAtoms: 0, mergedHydrogens: 0 });
  if (!graph || !coordinate) return fail("RECEPTOR_D2_STATE_MISSING");
  const recs = parseRigidPdbqt(input.pdbqt);
  if (!recs) return fail("RECEPTOR_PDBQT_INVALID");
  const codes = new Set<string>();

  // canonical.json <-> PDBQT, record by record; summary count <-> PDBQT.
  const canon = input.canonical as { atoms?: unknown } | null | undefined;
  if (!canon || typeof canon !== "object" || !Array.isArray(canon.atoms) || !canonicalMatches(canon.atoms, recs)) codes.add("RECEPTOR_CANONICAL_MISMATCH");
  if (input.summaryAtoms !== recs.length) codes.add("RECEPTOR_SUMMARY_MISMATCH");

  // PDBQT <-> graph: exact 3-decimal coordinate lookup, then chain/residue/name/element identity.
  const byCoord = new Map<string, D2AtomUID[]>();
  const heavyByCell = new Map<string, D2AtomUID[]>();
  const xyz = new Map<D2AtomUID, readonly [number, number, number]>();
  const atomsById = new Map(graph.atoms.map((a) => [a.atomUid, a]));
  for (const atom of graph.atoms) {
    const c = coordinate.coordinates[atom.atomUid];
    if (!c) return fail("RECEPTOR_COORDINATES_MISSING");
    const p = [f64Value(c[0]!), f64Value(c[1]!), f64Value(c[2]!)] as const;
    xyz.set(atom.atomUid, p);
    push(byCoord, coordKey(p[0], p[1], p[2]), atom.atomUid);
    if (atom.element.toUpperCase() !== "H") push(heavyByCell, cellKey(p[0], p[1], p[2]), atom.atomUid);
  }
  const mapped = new Set<D2AtomUID>();
  for (const r of recs) {
    const el = adElement(r.type);
    const residueId = `${r.res}:${r.seq}:${r.icode}`;
    const hit = (byCoord.get(coordKey(r.x, r.y, r.z)) ?? []).find((uid) => {
      if (mapped.has(uid)) return false;
      const a = atomsById.get(uid)!;
      return a.element.toUpperCase() === el && a.atomName.trim() === r.name && a.aliases.some((al) => (al.chainId ?? "") === r.chain && al.residueId === residueId);
    });
    if (hit === undefined) codes.add("RECEPTOR_PDBQT_UNMAPPED");
    else mapped.add(hit);
  }

  // Unmapped graph atoms may only be hydrogens on carbon: the bonded heavy atom, else the nearest heavy atom
  // within 1.3 A (PDB files without CONECT for protein hydrogens).
  const heavyNeighbours = new Map<D2AtomUID, D2AtomUID[]>();
  for (const b of graph.bonds) {
    const e1 = atomsById.get(b.atom1Uid)?.element.toUpperCase();
    const e2 = atomsById.get(b.atom2Uid)?.element.toUpperCase();
    if (e1 === "H" && e2 !== "H") push(heavyNeighbours, b.atom1Uid, b.atom2Uid);
    if (e2 === "H" && e1 !== "H") push(heavyNeighbours, b.atom2Uid, b.atom1Uid);
  }
  const parentOf = (uid: D2AtomUID): D2AtomUID | undefined => {
    const bonded = heavyNeighbours.get(uid);
    if (bonded) return bonded.length === 1 ? bonded[0] : undefined;
    const [x, y, z] = xyz.get(uid)!;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
    let best: D2AtomUID | undefined;
    let bestD = 1.3 * 1.3;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const n of heavyByCell.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        const p = xyz.get(n)!;
        const d = (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
    }
    return best;
  };
  let merged = 0;
  for (const a of graph.atoms) {
    if (mapped.has(a.atomUid)) continue;
    if (a.element.toUpperCase() !== "H") {
      codes.add("RECEPTOR_PDBQT_HEAVY_ATOM_MISSING");
      continue;
    }
    const parent = parentOf(a.atomUid);
    if (parent === undefined || atomsById.get(parent)!.element.toUpperCase() !== "C") codes.add("RECEPTOR_PDBQT_POLAR_H_MISSING");
    else merged++;
  }
  return { codes: [...codes], mappedAtoms: mapped.size, mergedHydrogens: merged };
};
