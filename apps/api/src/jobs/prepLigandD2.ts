import {
  D2_KINEMATIC_PROFILE_ID,
  D2_LIGAND_PROFILE_ID,
  f64Bits,
  f64Value,
  type D2AtomTypingAssignmentV1,
  type D2AtomUID,
  type D2ChemicalStateV1,
  type D2CoordinateStateV1,
  type D2GraphBondV1,
  type D2KinematicFragmentV1,
  type D2LigandKinematicModelV1,
  type D2PreparedLigandStateV1,
  type D2RotatableEdgeV1,
} from "@molecular/contracts";
import type { D2AdaptedRepresentation } from "../docking/d2Adapters.js";
import { sealLigandKinematicModel, sealPreparedLigandState } from "../docking/d2Preparation.js";
import { deepFreeze } from "../docking/d2Validation.js";
import { scientificDigest } from "../docking/scientificSerialization.js";

/**
 * Maps the worker's Meeko ligand PDBQT onto the D2 ligand graph (adapted from the hash-verified ligand.clean.sdf)
 * and calls the existing D2 seal functions (sealLigandKinematicModel, sealPreparedLigandState).
 * - typing: every PDBQT atom is matched to exactly one graph atom by element and coordinates (PDBQT precision);
 *   its AutoDock type, the manifest charge model and the Gasteiger charge are taken from that record. A nonpolar
 *   hydrogen that Meeko merged into its carbon gets typeId H_MERGED with evidence naming the parent record, but
 *   only when the graph bonds it to exactly one matched carbon. Anything else is BLOCKED, never filled in.
 * - kinematics: the PDBQT ROOT/BRANCH tree gives rigid fragments, rotatable edges, moving sets and axes.
 */
export type LigandD2Outcome = Readonly<{
  status: "SEALED" | "BLOCKED";
  reasonCodes: readonly string[];
  typedAtoms: number;
  mergedHydrogens: number;
  kinematicModel?: D2LigandKinematicModelV1;
  ligand?: D2PreparedLigandStateV1;
}>;

type Rec = { serial: number; name: string; x: number; y: number; z: number; charge: number; type: string; frag: number };
type Branch = { a: number; b: number; parent: number; child: number };

const blocked = (codes: string[], typedAtoms = 0, mergedHydrogens = 0): LigandD2Outcome => ({ status: "BLOCKED", reasonCodes: [...new Set(codes)].slice(0, 50), typedAtoms, mergedHydrogens });

const parsePdbqt = (text: string): { recs: Rec[]; branches: Branch[]; fragParent: number[] } | undefined => {
  const recs: Rec[] = [];
  const branches: Branch[] = [];
  const fragParent: number[] = [];
  const stack: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("ROOT")) {
      if (fragParent.length) return undefined;
      fragParent.push(-1);
      stack.push(0);
    } else if (line.startsWith("BRANCH")) {
      const [a, b] = line.slice(6).trim().split(/\s+/).map(Number);
      if (!stack.length || !Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return undefined;
      const child = fragParent.length;
      fragParent.push(stack[stack.length - 1]!);
      branches.push({ a: a!, b: b!, parent: stack[stack.length - 1]!, child });
      stack.push(child);
    } else if (line.startsWith("ENDBRANCH")) {
      if (stack.length < 2) return undefined;
      stack.pop();
    } else if (line.startsWith("ENDROOT")) {
      if (stack.length !== 1) return undefined;
    } else if (line.startsWith("ATOM") || line.startsWith("HETATM")) {
      if (!stack.length) return undefined;
      const rec: Rec = { serial: Number(line.slice(6, 11)), name: line.slice(12, 16).trim(), x: Number(line.slice(30, 38)), y: Number(line.slice(38, 46)), z: Number(line.slice(46, 54)), charge: Number(line.slice(70, 76)), type: line.slice(77, 79).trim(), frag: stack[stack.length - 1]! };
      if (!rec.type || ![rec.serial, rec.x, rec.y, rec.z, rec.charge].every(Number.isFinite)) return undefined;
      recs.push(rec);
    }
  }
  return fragParent.length ? { recs, branches, fragParent } : undefined;
};

/**
 * The adapter cannot know the chemical state of a bare file and reports UNKNOWN. A confirmed INTERIM prep job is
 * the explicit declaration D2 asks for: the user confirmed a plan that keeps the submitted protonation and
 * tautomer, and the worker reports zero added hydrogens and no 3D embedding. Only then is the state re-declared
 * EXPLICIT_SUBMITTED (with the plan digest as evidence) and the coordinate state re-bound to it.
 */
/** The digest payload of a sealed D2 state: everything except its stateId and digest. */
const withoutSeal = <T extends { stateId: string; digest: string }>(o: T): Omit<T, "stateId" | "digest"> =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== "stateId" && k !== "digest")) as Omit<T, "stateId" | "digest">;

const explicitSubmittedState = (adapted: D2AdaptedRepresentation, planDigest: string): { chemical: D2ChemicalStateV1; coordinate: D2CoordinateStateV1 } | undefined => {
  const c0 = adapted.chemicalState;
  const k0 = adapted.coordinateStates[0];
  if (!c0 || !k0) return undefined;
  const chemPayload = { ...withoutSeal(c0), resolution: "EXPLICIT_SUBMITTED" as const, protonationStatus: "EXPLICIT" as const, tautomerStatus: "EXPLICIT" as const, sourceEvidenceRefs: [...c0.sourceEvidenceRefs, `prep-plan:${planDigest}`] };
  const chemDigest = scientificDigest<"ChemicalStateDigest">("D2_CHEMICAL_STATE", "D2_CHEMICAL_STATE_V1", chemPayload);
  const chemical = deepFreeze({ ...chemPayload, stateId: `chemical:${chemDigest.slice(-16)}`, digest: chemDigest }) as D2ChemicalStateV1;
  const coordPayload = { ...withoutSeal(k0), chemicalStateDigest: chemical.digest };
  const coordDigest = scientificDigest<"CoordinateStateDigest">("D2_COORDINATE_STATE", "D2_COORDINATE_STATE_V1", coordPayload);
  const coordinate = deepFreeze({ ...coordPayload, stateId: `coordinates:${coordDigest.slice(-16)}`, digest: coordDigest }) as D2CoordinateStateV1;
  return { chemical, coordinate };
};

export const sealLigandFromPdbqt = (input: Readonly<{ adapted: D2AdaptedRepresentation; pdbqt: string; pdbqtSha256: string; chargeModel: string; explicitSubmittedPlanDigest?: string }>): LigandD2Outcome => {
  const { adapted } = input;
  const graph = adapted.graph;
  const identity = adapted.identity;
  const declared = input.explicitSubmittedPlanDigest ? explicitSubmittedState(adapted, input.explicitSubmittedPlanDigest) : undefined;
  const chemical = declared?.chemical ?? adapted.chemicalState;
  const coordinate = declared?.coordinate ?? adapted.coordinateStates[0];
  if (!graph || !identity || !chemical || !coordinate) return blocked(["LIGAND_D2_STATE_MISSING"]);
  const ligandComponents = graph.components.filter((c) => c.role === "LIGAND");
  if (ligandComponents.length !== 1) return blocked(["LIGAND_COMPONENT_AMBIGUOUS"]);
  const component = ligandComponents[0]!;
  const parsed = parsePdbqt(input.pdbqt);
  if (!parsed) return blocked(["LIGAND_PDBQT_TREE_INVALID"]);
  const { recs, branches, fragParent } = parsed;
  const ref = (what: string) => `out/ligand.pdbqt@sha256:${input.pdbqtSha256}#${what}`.slice(0, 200);

  const atomsById = new Map(graph.atoms.map((a) => [a.atomUid, a]));
  const xyz = new Map<D2AtomUID, [number, number, number]>();
  for (const uid of component.atomUids) {
    const c = coordinate.coordinates[uid];
    if (!c) return blocked(["LIGAND_COORDINATES_MISSING"]);
    xyz.set(uid, [f64Value(c[0]!), f64Value(c[1]!), f64Value(c[2]!)]);
  }
  // Element + coordinate match (PDBQT keeps 3 decimals). Each record and each atom is used at most once.
  const recOfAtom = new Map<D2AtomUID, number>();
  const atomOfRec = new Map<number, D2AtomUID>();
  for (const uid of component.atomUids) {
    const el = atomsById.get(uid)!.element.toUpperCase();
    const [x, y, z] = xyz.get(uid)!;
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i]!;
      if (atomOfRec.has(i) || !r.name.toUpperCase().startsWith(el) || Math.abs(r.x - x) > 2e-3 || Math.abs(r.y - y) > 2e-3 || Math.abs(r.z - z) > 2e-3) continue;
      recOfAtom.set(uid, i);
      atomOfRec.set(i, uid);
      break;
    }
  }
  if (atomOfRec.size !== recs.length) return blocked(["LIGAND_PDBQT_UNMAPPED"], recOfAtom.size);
  const recBySerial = new Map(recs.map((r, i) => [r.serial, i]));

  const neighbours = new Map<D2AtomUID, D2AtomUID[]>();
  const bondByPair = new Map<string, D2GraphBondV1>();
  const pairKey = (a: D2AtomUID, b: D2AtomUID) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const bond of graph.bonds) {
    if (!xyz.has(bond.atom1Uid) || !xyz.has(bond.atom2Uid)) continue;
    bondByPair.set(pairKey(bond.atom1Uid, bond.atom2Uid), bond);
    (neighbours.get(bond.atom1Uid) ?? neighbours.set(bond.atom1Uid, []).get(bond.atom1Uid)!).push(bond.atom2Uid);
    (neighbours.get(bond.atom2Uid) ?? neighbours.set(bond.atom2Uid, []).get(bond.atom2Uid)!).push(bond.atom1Uid);
  }

  const typing: D2AtomTypingAssignmentV1[] = [];
  const fragOfAtom = new Map<D2AtomUID, number>();
  const codes: string[] = [];
  let merged = 0;
  for (const uid of component.atomUids) {
    const ri = recOfAtom.get(uid);
    if (ri !== undefined) {
      const r = recs[ri]!;
      typing.push({ atomUid: uid, typeId: r.type, chargeModel: input.chargeModel, partialCharge: f64Bits(r.charge), evidenceRef: ref(`ATOM:${r.serial}`) });
      fragOfAtom.set(uid, r.frag);
      continue;
    }
    const nb = neighbours.get(uid) ?? [];
    const parentRec = nb.length === 1 ? recOfAtom.get(nb[0]!) : undefined;
    if (atomsById.get(uid)!.element.toUpperCase() !== "H" || parentRec === undefined || atomsById.get(nb[0]!)!.element.toUpperCase() !== "C") {
      codes.push("LIGAND_TYPING_EVIDENCE_INCOMPLETE");
      continue;
    }
    const parent = recs[parentRec]!;
    typing.push({ atomUid: uid, typeId: "H_MERGED", chargeModel: input.chargeModel, evidenceRef: ref(`MERGED_INTO:${parent.serial}`) });
    fragOfAtom.set(uid, parent.frag);
    merged++;
  }
  if (codes.length) return blocked(codes, typing.length, merged);

  const fragments: D2KinematicFragmentV1[] = fragParent.map((_p, f) => ({ fragmentId: `F${f}`, atomUids: component.atomUids.filter((u) => fragOfAtom.get(u) === f) }));
  const descendants = (f: number): Set<number> => {
    const out = new Set<number>([f]);
    for (let k = f + 1; k < fragParent.length; k++) if (out.has(fragParent[k]!)) out.add(k);
    return out;
  };
  const ringBond = (a: D2AtomUID, b: D2AtomUID): boolean => {
    const seen = new Set<D2AtomUID>([a]);
    const queue: D2AtomUID[] = [a];
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of neighbours.get(u) ?? []) {
        if ((u === a && v === b) || seen.has(v)) continue;
        if (v === b) return true;
        seen.add(v);
        queue.push(v);
      }
    }
    return false;
  };
  const edges: D2RotatableEdgeV1[] = [];
  for (const br of branches) {
    const ia = recBySerial.get(br.a);
    const ib = recBySerial.get(br.b);
    const ua = ia === undefined ? undefined : atomOfRec.get(ia);
    const ub = ib === undefined ? undefined : atomOfRec.get(ib);
    const bond = ua && ub ? bondByPair.get(pairKey(ua, ub)) : undefined;
    if (!ua || !ub || !bond) return blocked(["LIGAND_TORSION_UNMAPPED"], typing.length, merged);
    const moving = descendants(br.child);
    const movingAtomUids = component.atomUids.filter((u) => moving.has(fragOfAtom.get(u)!));
    const [ax, ay, az] = xyz.get(ua)!;
    const [bx, by, bz] = xyz.get(ub)!;
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    if (!(len > 0)) return blocked(["LIGAND_TORSION_AXIS_DEGENERATE"], typing.length, merged);
    edges.push({
      bondUid: bond.bondUid,
      atom1Uid: ua,
      atom2Uid: ub,
      parentFragmentId: `F${br.parent}`,
      childFragmentId: `F${br.child}`,
      movingAtomUids,
      axisOrigin: [f64Bits(ax), f64Bits(ay), f64Bits(az)],
      axisDirection: [f64Bits((bx - ax) / len), f64Bits((by - ay) / len), f64Bits((bz - az) / len)],
      domain: "FULL_TURN",
      periodicity: 1,
      terminalHydrogenOnly: movingAtomUids.every((u) => atomsById.get(u)!.element.toUpperCase() === "H"),
      ringBond: ringBond(ua, ub),
      restrictedBond: false,
      searchTorsion: true,
      scorerTorsion: true,
      evidenceRefs: [ref(`BRANCH:${br.a}-${br.b}`)],
    });
  }
  const rootAtomUid = fragments[0]!.atomUids.find((u) => atomsById.get(u)!.element.toUpperCase() !== "H") ?? fragments[0]!.atomUids[0];
  if (!rootAtomUid) return blocked(["LIGAND_KINEMATIC_ROOT_MISSING"], typing.length, merged);
  const kin = sealLigandKinematicModel({ molecularIdentityDigest: identity.digest, graphRevision: graph, rootAtomUid, fragments, rotatableEdges: edges, profileId: D2_KINEMATIC_PROFILE_ID });
  if (!kin.value) return blocked(kin.diagnostics.filter((d) => d.blocking).map((d) => `D2:${d.code}`.slice(0, 64)).concat("D2_KINEMATIC_SEAL_BLOCKED"), typing.length, merged);
  const lig = sealPreparedLigandState({ molecularIdentity: identity, graphRevision: graph, chemicalState: chemical, coordinateState: coordinate, selectedComponentId: component.componentId, atomTyping: typing, kinematicModel: kin.value, profileId: D2_LIGAND_PROFILE_ID });
  if (!lig.value) return { ...blocked(lig.diagnostics.filter((d) => d.blocking).map((d) => `D2:${d.code}`.slice(0, 64)).concat("D2_LIGAND_SEAL_BLOCKED"), typing.length, merged), kinematicModel: kin.value };
  return { status: "SEALED", reasonCodes: [], typedAtoms: typing.length, mergedHydrogens: merged, kinematicModel: kin.value, ligand: lig.value };
};
