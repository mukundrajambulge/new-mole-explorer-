// Redocking check (task 5.3): prepare a real RCSB complex with the prep worker, redock the crystal ligand with
// the pinned Vina through runDockJob, and report heavy-atom RMSD of the poses vs the crystal ligand.
// RMSD is symmetry-naive: atoms are paired by identity (prepared ligand atom -> crystal atom it was built from),
// with no symmetry-equivalent remapping, so symmetric groups can only make the reported value larger.
// Usage: node tools/mole-dock/redock.mjs [1STP|1IEP ...]  (needs WSL Ubuntu-24.04 with ~/mole-prep and ~/mole-tools/vina)
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runPrep } from "./prep.mjs";
import { parseVinaPoses, pdbqtHeavyAtoms, runDockJob } from "./run.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIX = join(REPO_ROOT, "tests", "fixtures", "rcsb");

export const REDOCK_COMPLEXES = Object.freeze({
  "1STP": { file: "1STP.pdb", resName: "BTN", chain: "A", resSeq: 300, template: "OC(=O)CCCCC1SCC2NC(=O)NC12" },
  "1IEP": { file: "1IEP.pdb", resName: "STI", chain: "A", resSeq: 201, template: "Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1" },
});
export const REDOCK_SEED = 20261009;

export function cutHetatm(pdbText, { resName, chain, resSeq }) {
  const lines = pdbText.split(/\r?\n/).filter((l) => l.startsWith("HETATM") && l.slice(17, 20).trim() === resName && l[21] === chain && Number(l.slice(22, 26)) === resSeq);
  if (lines.length === 0) throw new Error(`${resName} ${chain}${resSeq} not found`);
  return lines;
}

const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

/** Pair each prepared heavy atom with the crystal atom at the same position (prep keeps crystal coordinates). */
export function mapToCrystal(prepared, crystal, tol = 0.05) {
  return prepared.map((p) => {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < crystal.length; i++) {
      const d = d2(p, crystal[i]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (Math.sqrt(bd) > tol) throw new Error("prepared ligand atoms do not coincide with the crystal ligand; cannot pair atoms");
    return best;
  });
}

export function rmsd(pose, crystal, map) {
  let s = 0;
  for (let i = 0; i < map.length; i++) s += d2(pose[i], crystal[map[i]]);
  return Math.sqrt(s / map.length);
}

export async function redock(id, { exhaustiveness = 8, seed = REDOCK_SEED, cpu = 4 } = {}) {
  const c = REDOCK_COMPLEXES[id];
  if (!c) throw new Error(`unknown complex ${id}`);
  const job = mkdtempSync(join(tmpdir(), `mole-redock-${id}-`));
  mkdirSync(join(job, "in"));
  const pdb = readFileSync(join(FIX, c.file), "utf8");
  copyFileSync(join(FIX, c.file), join(job, "in", "receptor.pdb"));
  const het = cutHetatm(pdb, c);
  writeFileSync(join(job, "in", "ligand.pdb"), het.join("\n") + "\nEND\n");
  writeFileSync(join(job, "in", "template.smi"), c.template + "\n");
  const opts = { pH: 7.4, protonation: "EXPLICIT_SUBMITTED", ligandProtonation: "EXPLICIT_SUBMITTED", chainIds: [c.chain], keepWaters: false, addMissingAtoms: false };
  writeFileSync(
    join(job, "job.json"),
    JSON.stringify({ schemaVersion: 1, jobId: `redock-${id}`, receptor: { artifactId: "r1", relPath: "in/receptor.pdb", format: "pdb" }, ligand: { artifactId: "l1", relPath: "in/ligand.pdb", format: "pdb" }, ligandTemplate: { artifactId: "t1", relPath: "in/template.smi", format: "smi" }, options: opts }),
  );
  const p = await runPrep({ mode: "plan", jobDir: job });
  if (p.status !== "OK") throw new Error(`prep plan ${p.status}: ${p.stderr.slice(0, 400)}`);
  const plan = JSON.parse(readFileSync(join(job, "plan.json"), "utf8"));
  writeFileSync(join(job, "confirmation.json"), JSON.stringify({ jobId: plan.jobId, planDigest: plan.planDigest, acks: plan.decisions.filter((d) => d.requiresAck).map((d) => d.key) }));
  const a = await runPrep({ mode: "apply", jobDir: job });
  if (a.status !== "OK") throw new Error(`prep apply ${a.status}: ${a.stderr.slice(0, 400)}`);

  const crystal = het
    .filter((l) => (l.slice(76, 78).trim() || l.slice(12, 14).trim()) !== "H")
    .map((l) => ({ x: Number(l.slice(30, 38)), y: Number(l.slice(38, 46)), z: Number(l.slice(46, 54)) }));
  const prepared = pdbqtHeavyAtoms(readFileSync(join(job, "out", "ligand.pdbqt"), "latin1"));
  const map = mapToCrystal(prepared, crystal);
  const lo = [0, 1, 2].map((k) => Math.min(...crystal.map((q) => [q.x, q.y, q.z][k])));
  const hi = [0, 1, 2].map((k) => Math.max(...crystal.map((q) => [q.x, q.y, q.z][k])));
  const center = [0, 1, 2].map((k) => Number(((lo[k] + hi[k]) / 2).toFixed(3)));
  const edge = Math.ceil(Math.max(22, Math.max(...[0, 1, 2].map((k) => hi[k] - lo[k])) + 10));
  writeFileSync(join(job, "dock.json"), JSON.stringify({ schemaVersion: 1, receptor: { path: "out/receptor.pdbqt" }, ligand: { path: "out/ligand.pdbqt" }, box: { center, size: [edge, edge, edge] }, exhaustiveness, numPoses: 9, seed, cpu }));
  const out = join(job, "dock");
  const r = await runDockJob({ input: join(job, "dock.json"), out });
  if (r.exitCode !== 0) throw new Error(`dock exit ${r.exitCode}: ${JSON.stringify(r.error)}`);
  const poses = parseVinaPoses(readFileSync(join(out, "poses.pdbqt"), "latin1"));
  const heavy = poses.map((q) => q.atoms.filter((t) => t.type !== "H" && t.type !== "HD" && t.type !== "HS"));
  if (heavy.some((h) => h.length !== prepared.length)) throw new Error("pose heavy-atom count differs from the prepared ligand");
  const rmsds = heavy.map((h) => rmsd(h, crystal, map));
  return {
    id,
    ligand: `${c.resName} ${c.chain}${c.resSeq}`,
    heavyAtoms: prepared.length,
    crystalHeavyAtoms: crystal.length,
    box: { center, edge },
    seed,
    exhaustiveness,
    bestPoseRmsd: Number(rmsds[0].toFixed(3)),
    bestPoseVinaScore: r.result.vinaScore,
    minRmsdAnyPose: Number(Math.min(...rmsds).toFixed(3)),
    rmsdByRank: rmsds.map((x) => Number(x.toFixed(2))),
    vinaMs: r.result.timings.vinaMs,
    engineSha256: r.result.engine.binarySha256,
    rmsdMethod: "heavy-atom, symmetry-naive, no superposition",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(REDOCK_COMPLEXES);
  for (const id of ids) {
    try {
      console.log(JSON.stringify(await redock(id)));
    } catch (e) {
      console.log(JSON.stringify({ id, error: String(e?.message || e).slice(0, 600) }));
      process.exitCode = 1;
    }
  }
}
