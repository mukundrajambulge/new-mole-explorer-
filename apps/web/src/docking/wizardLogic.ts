import type { CanonicalAtom, CanonicalMolecularStructure, DockResult } from "@molecular/contracts";
import { DOCK_SCORE_LABEL } from "@molecular/contracts";

/** Pure helpers for the docking wizard. Nothing here invents scientific values. */

export const WIZARD_STEPS = ["Inputs", "Prepare", "Box", "Run", "Results"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type Vec3 = readonly [number, number, number];

export type ReceptorSummary = Readonly<{ chains: readonly string[]; atomCount: number }>;
export type LigandCandidate = Readonly<{ key: string; label: string; atomCount: number; atoms: readonly CanonicalAtom[] }>;
export type ComponentSplit = Readonly<{ receptor: ReceptorSummary; ligands: readonly LigandCandidate[] }>;

/** Splits a structure by component role: polymer atoms are the receptor, non-water non-ion ligand atoms are ligand candidates. */
export const splitByRole = (structure: CanonicalMolecularStructure): ComponentSplit => {
  const chains = new Set<string>();
  let receptorAtoms = 0;
  const ligandMap = new Map<string, { label: string; atoms: CanonicalAtom[] }>();
  for (const atom of structure.atoms) {
    if (atom.isPolymer) { receptorAtoms += 1; chains.add(atom.chain); continue; }
    if (!atom.isLigand || atom.isWater || atom.isIon) continue;
    const key = `${atom.chain}:${atom.residueName}:${atom.residueNumber}${atom.insertionCode ?? ""}`;
    let entry = ligandMap.get(key);
    if (!entry) { entry = { label: `${atom.residueName} ${atom.chain}${atom.residueNumber}`, atoms: [] }; ligandMap.set(key, entry); }
    entry.atoms.push(atom);
  }
  const ligands = [...ligandMap.entries()].map(([key, v]) => ({ key, label: v.label, atomCount: v.atoms.length, atoms: v.atoms }));
  return { receptor: { chains: [...chains], atomCount: receptorAtoms }, ligands };
};

export const BOX_MIN = 1;
export const BOX_MAX = 40;

export type BoxNumbers = Readonly<{ center: Vec3; size: Vec3 }>;

/** Box around a set of atoms with padding; edges are clamped to the contract limits [1, 40]. */
export const boxAroundAtoms = (atoms: readonly CanonicalAtom[], paddingAngstrom = 8): BoxNumbers | null => {
  if (atoms.length === 0) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const a of atoms) {
    if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
    if (a.z < minZ) minZ = a.z; if (a.z > maxZ) maxZ = a.z;
  }
  const clamp = (v: number) => Math.min(BOX_MAX, Math.max(BOX_MIN, v));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    center: [round((minX + maxX) / 2), round((minY + maxY) / 2), round((minZ + maxZ) / 2)],
    size: [round(clamp(maxX - minX + 2 * paddingAngstrom)), round(clamp(maxY - minY + 2 * paddingAngstrom)), round(clamp(maxZ - minZ + 2 * paddingAngstrom))],
  };
};

/** Returns a message when the box violates the job contract, else null. */
export const boxProblem = (center: Vec3, size: Vec3): string | null => {
  if (![...center, ...size].every(Number.isFinite)) return "Box values must be finite numbers.";
  if (size.some((s) => s < BOX_MIN || s > BOX_MAX)) return `Each box edge must be between ${BOX_MIN} and ${BOX_MAX} Angstrom (docking service limit).`;
  if (center.some((c) => Math.abs(c) > 10_000)) return "Box center is outside the supported range.";
  return null;
};

/** A reply is stale when the structure it was requested for is no longer the loaded one. */
export const isStaleForStructure = (requestedHash: string, currentHash: string | null): boolean => currentHash === null || requestedHash !== currentHash;

// ---- pose parsing ----

export type PoseAtom = Readonly<{ element: string; x: number; y: number; z: number }>;

const adElement = (raw: string): string => {
  const t = raw.trim();
  if (t === "OA") return "O";
  if (t === "NA" || t === "N") return "N";
  if (t === "HD") return "H";
  if (t === "SA") return "S";
  if (t === "A") return "C";
  return t.length > 1 ? t[0]!.toUpperCase() + t.slice(1).toLowerCase() : t.toUpperCase();
};

/** Parses the first model of a PDBQT/PDB or V2000 SDF text. Returns [] when nothing parsable is found. */
export const parsePoseAtoms = (text: string, format: "sdf" | "pdbqt"): readonly PoseAtom[] => {
  const lines = text.split(/\r?\n/);
  const atoms: PoseAtom[] = [];
  if (format === "sdf") {
    const counts = lines[3] ?? "";
    const n = Number(counts.slice(0, 3));
    if (!Number.isInteger(n) || n <= 0 || n > 5000) return [];
    for (let i = 0; i < n; i += 1) {
      const l = lines[4 + i];
      if (!l) return [];
      const x = Number(l.slice(0, 10)), y = Number(l.slice(10, 20)), z = Number(l.slice(20, 30));
      if (![x, y, z].every(Number.isFinite)) return [];
      atoms.push({ element: l.slice(31, 34).trim(), x, y, z });
    }
    return atoms;
  }
  let seenModel = false;
  for (const l of lines) {
    if (l.startsWith("MODEL")) { if (seenModel) break; seenModel = true; continue; }
    if (l.startsWith("ENDMDL")) break;
    if (!l.startsWith("ATOM") && !l.startsWith("HETATM")) continue;
    const x = Number(l.slice(30, 38)), y = Number(l.slice(38, 46)), z = Number(l.slice(46, 54));
    if (![x, y, z].every(Number.isFinite)) continue;
    const typeField = l.length >= 78 ? l.slice(77).trim() : "";
    atoms.push({ element: adElement(typeField || l.slice(12, 16).replace(/[0-9]/g, "").trim()), x, y, z });
  }
  return atoms;
};

/** Heavy-atom RMSD in the given atom order (no symmetry correction). Null if the atom lists differ. */
export const rmsd = (a: readonly PoseAtom[], b: readonly PoseAtom[]): number | null => {
  const ha = a.filter((p) => p.element !== "H");
  const hb = b.filter((p) => p.element !== "H");
  if (ha.length === 0 || ha.length !== hb.length) return null;
  let sum = 0;
  for (let i = 0; i < ha.length; i += 1) {
    const dx = ha[i]!.x - hb[i]!.x, dy = ha[i]!.y - hb[i]!.y, dz = ha[i]!.z - hb[i]!.z;
    sum += dx * dx + dy * dy + dz * dz;
  }
  return Math.sqrt(sum / ha.length);
};

export type HBondLine = Readonly<{ from: Vec3; to: Vec3; distance: number }>;
const HBOND_MAX = 3.5;

/** Geometric N/O...N/O pairs within 3.5 Angstrom. Distance only, no angle test: a hint, not an energy term. */
export const hbondLines = (pose: readonly PoseAtom[], receptor: readonly CanonicalAtom[]): readonly HBondLine[] => {
  const polar = receptor.filter((r) => r.isPolymer && (r.element === "N" || r.element === "O"));
  const lines: HBondLine[] = [];
  for (const p of pose) {
    if (p.element !== "N" && p.element !== "O") continue;
    for (const r of polar) {
      const dx = p.x - r.x;
      if (Math.abs(dx) > HBOND_MAX) continue;
      const d = Math.hypot(dx, p.y - r.y, p.z - r.z);
      if (d <= HBOND_MAX) lines.push({ from: [p.x, p.y, p.z], to: [r.x, r.y, r.z], distance: d });
    }
  }
  return lines;
};

/** Pose handed to the shared viewer (second argument of renderViewer). */
export type PoseOverlay = Readonly<{ rank: number; format: "sdf" | "pdbqt"; text: string; hbonds: readonly HBondLine[]; structureHash: string }>;

export const resultAsJson = (result: DockResult, mock: boolean, rmsdByRank: Readonly<Record<number, number | null>>): string =>
  JSON.stringify({ mock, scoreStatus: result.scoreStatus, scoreLabel: result.scoreLabel ?? DOCK_SCORE_LABEL, jobId: result.jobId, poses: result.poses.map((p) => ({ ...p, rmsdToBest: rmsdByRank[p.rank] ?? null })) }, null, 2);

export const formatScore = (v: number | null): string => (v === null ? "n/a" : v.toFixed(2));

/**
 * Source artifact ids look like source_<kind>_<sha256> and can exceed the 64 character job-contract limit.
 * Ids that fit are sent unchanged; longer ones are shortened to their last 60 characters (the end holds the sha256).
 */
export const toJobArtifactId = (id: string): string => (id.length <= 64 ? id : `a${id.slice(-60)}`.slice(0, 64));

/**
 * Component identity for a ligand picked from the loaded structure. It must differ from the receptor id
 * (both come from the same source artifact), so it is derived from the component key. Fits the 64 character id contract.
 */
export const ligandComponentId = (sourceArtifactId: string, componentKey: string): string => {
  let h = 5381;
  for (let i = 0; i < componentKey.length; i += 1) h = ((h * 33) ^ componentKey.charCodeAt(i)) >>> 0;
  const label = componentKey.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
  const tail = sourceArtifactId.replace(/[^A-Za-z0-9_-]/g, "").slice(-34);
  return `lig${h.toString(16).padStart(8, "0")}${label}-${tail}`.slice(0, 64);
};
