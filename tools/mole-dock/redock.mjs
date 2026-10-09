// Smoke redock (task R.1). SMOKE: implementation sanity, not validation. Follows the research protocol shape
// [AT-0142..0150, 0172..0174] at smoke scale; it is not the D9 campaign (40 replicates, Wilson CI, paired bootstrap).
// - Receptor and the crystal reference: the prep worker on the real RCSB entry, ligand cut from the same entry, CCD
//   isomeric SMILES template (R.4). A plan that is UNSUPPORTED/BLOCKED (metal in site, undefined stereo) is reported as such.
// - Starting ligand: prepared from the CCD isomeric SMILES alone (RDKit ETKDGv3 conformer, recorded seed), never the crystal pose.
// - Box: crystal-ligand heavy-atom envelope + 5.0 A on every face (not a cube).
// - Seeds: REPLICATES per complex, derived by domain-separated SHA-256 -> uint64, mapped to Vina's [1, 2^31-1].
// - RMSD: heavy atoms, receptor frame, no superposition; symmetric = min over exact graph isomorphisms; direct kept;
//   UNDEFINED (typed) when no valid mapping exists. Computed by workers/prep/mole_prep/redock_smoke.py.
// Usage: node tools/mole-dock/redock.mjs [--report] [1STP 1IEP ...]   (needs WSL Ubuntu-24.04 with ~/mole-prep and ~/mole-tools/vina)
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PREP_DISTRO, WORKER_ENV, resolvePrepPython, runPrep, runProcess, toWslPath } from "./prep.mjs";
import { runDockJob } from "./run.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIX = join(REPO_ROOT, "tests", "fixtures", "rcsb");
export const HELPER = join(REPO_ROOT, "workers", "prep", "redock_smoke.py");
export const SMOKE_LABEL = "SMOKE: implementation sanity, not validation";
export const THRESHOLDS = Object.freeze([1.0, 1.5, 2.0, 2.5, 3.0]);
export const REPLICATES = 3;
export const BOX_PADDING = 5.0;
export const SEED_DOMAIN = "mole-explorer/R.1/smoke-redock/v1";
const VINA_SEED_MAX = 2_147_483_647n;

// Drug-like complexes (Astex-diverse style; sources in tests/fixtures/rcsb/manifest.json), ligand cut from the same entry; ccd = CCD code of the template.
export const REDOCK_COMPLEXES = Object.freeze({
  "1STP": { file: "1STP.pdb", ccd: "BTN", chain: "A", resSeq: 300, chainIds: ["A"], options: {} },
  "1IEP": { file: "1IEP.pdb", ccd: "STI", chain: "A", resSeq: 201, chainIds: ["A"], options: {} },
  "3PTB": { file: "3PTB.pdb", ccd: "BEN", chain: "A", resSeq: 1, chainIds: ["A"], options: {} },
  "1HVR": { file: "1HVR.pdb", ccd: "XK2", chain: "A", resSeq: 263, chainIds: ["A", "B"], options: {} },
  "4DJW": { file: "4DJW.pdb", ccd: "0KP", chain: "A", resSeq: 501, chainIds: ["A"], options: { addMissingAtoms: true } },
});

/** CCD "SMILES_CANONICAL CACTVS" (isomeric) of tests/fixtures/rcsb/ccd-<code>.cif, as workers/prep/tests/ccd.py reads it. */
export function ccdIsomericSmiles(code) {
  if (!/^[A-Z0-9]{1,5}$/.test(code)) throw new Error("bad CCD code");
  const text = readFileSync(join(FIX, `ccd-${code}.cif`), "utf8");
  const m = new RegExp(`^${code}\\s+SMILES_CANONICAL\\s+CACTVS\\s+\\S+\\s+"?([^"\\s]+)"?\\s*$`, "m").exec(text);
  if (!m) throw new Error(`no CACTVS isomeric SMILES in ccd-${code}.cif`);
  return m[1];
}

/** Domain-separated SHA-256 -> uint64 (first 8 bytes, big-endian), mapped deterministically into Vina's seed range. */
export function deriveSeed(id, replicate, domain = SEED_DOMAIN) {
  const h = createHash("sha256").update(`${domain}\u0000${id}\u0000${replicate}`, "utf8").digest();
  const u64 = h.readBigUInt64BE(0);
  return { u64: u64.toString(), vina: Number(1n + (u64 % VINA_SEED_MAX)) };
}

export function cutHetatm(pdbText, { resName, chain, resSeq }) {
  const lines = pdbText.split(/\r?\n/).filter((l) => l.startsWith("HETATM") && l.slice(17, 20).trim() === resName && l[21] === chain && Number(l.slice(22, 26)) === resSeq);
  if (lines.length === 0) throw new Error(`${resName} ${chain}${resSeq} not found`);
  return lines;
}

export function heavyCoords(hetLines) {
  return hetLines.filter((l) => (l.slice(76, 78).trim() || l.slice(12, 14).trim()) !== "H").map((l) => [Number(l.slice(30, 38)), Number(l.slice(38, 46)), Number(l.slice(46, 54))]);
}

/** Heavy-atom envelope + pad on every face: an axis-aligned box, not a cube [AT-0172]. */
export function envelopeBox(xyz, pad = BOX_PADDING) {
  if (!xyz.length) throw new Error("empty ligand");
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of xyz) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < lo[k]) lo[k] = p[k];
      if (p[k] > hi[k]) hi[k] = p[k];
    }
  }
  const r = (v) => Number(v.toFixed(4));
  const min = lo.map((v) => r(v - pad));
  const max = hi.map((v) => r(v + pad));
  return { min, max, center: [0, 1, 2].map((k) => r((min[k] + max[k]) / 2)), size: [0, 1, 2].map((k) => r(max[k] - min[k])), padding: pad };
}

const rate = (xs, t) => (xs.length ? xs.filter((x) => x !== null && x <= t).length / xs.length : null);

/** Success rates at every threshold (inclusive), top-1 and best-of-N separately; UNDEFINED RMSDs count as failures. */
export function successRates(replicates) {
  const top1 = replicates.map((r) => r.top1SymmetricRmsd);
  const best = replicates.map((r) => r.bestOfNSymmetricRmsd);
  return Object.fromEntries(THRESHOLDS.map((t) => [t.toFixed(1), { top1: rate(top1, t), bestOfN: rate(best, t) }]));
}

/** Overall: the case is the statistical unit, so the overall rate is the mean of the per-case rates (macro). */
export function overallRates(cases) {
  const ok = cases.filter((c) => c.status === "OK");
  return Object.fromEntries(
    THRESHOLDS.map((t) => {
      const k = t.toFixed(1);
      const m = (f) => (ok.length ? ok.reduce((s, c) => s + c.successRates[k][f], 0) / ok.length : null);
      return [k, { top1: m("top1"), bestOfN: m("bestOfN"), cases: ok.length }];
    }),
  );
}

async function runHelper(cmd, jobDir, request, { timeoutMs = 300_000 } = {}) {
  writeFileSync(join(jobDir, `${cmd}-in.json`), JSON.stringify(request));
  const python = resolvePrepPython();
  const envPairs = Object.entries(WORKER_ENV).map(([k, v]) => `${k}=${v}`);
  const secs = String(Math.ceil(timeoutMs / 1000));
  const inv =
    process.platform === "win32"
      ? {
          command: "wsl.exe",
          args: ["-d", PREP_DISTRO, "--cd", toWslPath(jobDir), "--exec", "/usr/bin/timeout", "-k", "5", secs, "/usr/bin/env", "-i", ...envPairs, python, "-I", toWslPath(HELPER), cmd],
          options: { cwd: jobDir, shell: false, windowsHide: true, env: { SystemRoot: process.env.SystemRoot || "C:\\Windows", WSLENV: "" } },
          scrub: [jobDir, REPO_ROOT],
        }
      : { command: "/usr/bin/timeout", args: ["-k", "5", secs, "/usr/bin/env", "-i", ...envPairs, python, "-I", HELPER, cmd], options: { cwd: jobDir, shell: false, detached: true, env: {} }, scrub: [jobDir, REPO_ROOT] };
  const r = await runProcess(inv, { timeoutMs: timeoutMs + 10_000 });
  const outFile = join(jobDir, `${cmd}.json`);
  if (!existsSync(outFile)) throw new Error(`helper ${cmd} ${r.status}: ${r.stderr.slice(0, 400)}`);
  return JSON.parse(readFileSync(outFile, "utf8"));
}

const r3 = (x) => (x === null || x === undefined ? null : Number(x.toFixed(3)));

export async function redock(id, { replicates = REPLICATES, exhaustiveness = 8, numPoses = 9, cpu = 4, keepJob = false } = {}) {
  const c = REDOCK_COMPLEXES[id];
  if (!c) throw new Error(`unknown complex ${id}`);
  const template = ccdIsomericSmiles(c.ccd);
  const job = mkdtempSync(join(tmpdir(), `mole-redock-${id}-`));
  try {
    mkdirSync(join(job, "in"));
    const pdb = readFileSync(join(FIX, c.file), "utf8");
    copyFileSync(join(FIX, c.file), join(job, "in", "receptor.pdb"));
    const het = cutHetatm(pdb, { resName: c.ccd, chain: c.chain, resSeq: c.resSeq });
    writeFileSync(join(job, "in", "ligand.pdb"), het.join("\n") + "\nEND\n");
    writeFileSync(join(job, "in", "template.smi"), template + "\n");
    const opts = { pH: 7.4, protonation: "EXPLICIT_SUBMITTED", ligandProtonation: "EXPLICIT_SUBMITTED", chainIds: c.chainIds, keepWaters: false, addMissingAtoms: false, ...c.options };
    writeFileSync(
      join(job, "job.json"),
      JSON.stringify({ schemaVersion: 1, jobId: `redock-${id}`, receptor: { artifactId: "r1", relPath: "in/receptor.pdb", format: "pdb" }, ligand: { artifactId: "l1", relPath: "in/ligand.pdb", format: "pdb" }, ligandTemplate: { artifactId: "t1", relPath: "in/template.smi", format: "smi" }, options: opts }),
    );
    const base = { id, ligand: `${c.ccd} ${c.chain}${c.resSeq}`, source: `tests/fixtures/rcsb/${c.file}`, template, templateSource: `CCD ${c.ccd} SMILES_CANONICAL CACTVS (tests/fixtures/rcsb/ccd-${c.ccd}.cif)`, prepOptions: opts };
    const p = await runPrep({ mode: "plan", jobDir: job });
    const planFile = join(job, "plan.json");
    const plan = existsSync(planFile) ? JSON.parse(readFileSync(planFile, "utf8")) : null;
    if (p.status !== "OK") {
      if (plan && (plan.status === "UNSUPPORTED" || plan.status === "BLOCKED")) return { ...base, status: plan.status, diagnostics: plan.diagnostics };
      throw new Error(`prep plan ${p.status}: ${p.stderr.slice(0, 400)}`);
    }
    const acks = plan.decisions.filter((d) => d.requiresAck).map((d) => d.key);
    writeFileSync(join(job, "confirmation.json"), JSON.stringify({ jobId: plan.jobId, planDigest: plan.planDigest, acks }));
    const a = await runPrep({ mode: "apply", jobDir: job });
    if (a.status !== "OK") throw new Error(`prep apply ${a.status}: ${a.stderr.slice(0, 400)}`);

    const crystal = heavyCoords(het);
    const box = envelopeBox(crystal);
    const start = await runHelper("start", job, { smiles: template });
    if (start.status !== "OK") return { ...base, status: "BLOCKED", diagnostics: [`start ligand ${start.code}: ${start.message}`] };

    const seeds = [];
    const dockRuns = [];
    let engine = null;
    for (let k = 0; k < replicates; k++) {
      const seed = deriveSeed(id, k);
      seeds.push({ replicate: k, ...seed });
      const dj = join(job, `dock-${k}.json`);
      writeFileSync(dj, JSON.stringify({ schemaVersion: 1, receptor: { path: "out/receptor.pdbqt" }, ligand: { path: "start/ligand.pdbqt" }, box: { center: box.center, size: box.size }, exhaustiveness, numPoses, seed: seed.vina, cpu }));
      const r = await runDockJob({ input: dj, out: join(job, `dock-${k}`) });
      if (r.exitCode !== 0) throw new Error(`dock exit ${r.exitCode}: ${JSON.stringify(r.error)}`);
      engine = r.result.engine;
      dockRuns.push({ vinaMs: r.result.timings.vinaMs });
    }
    const rm = await runHelper("rmsd", job, { ref: "out/ligand.clean.sdf", probe: "start/ligand.sdf", map: "start.json", poses: dockRuns.map((_, k) => `dock-${k}/poses.pdbqt`) });
    if (rm.status === "BLOCKED" || rm.status === "BAD_INPUT") throw new Error(`rmsd helper ${rm.status}: ${rm.code || ""} ${rm.message || ""}`);
    const reps = rm.runs.map((rows, k) => {
      const sym = rows.map((x) => x.symmetricRmsd);
      const defined = sym.filter((x) => x !== null);
      return {
        replicate: k,
        seed: seeds[k],
        top1VinaScore: rows[0].vinaScore,
        top1SymmetricRmsd: r3(sym[0]),
        top1DirectRmsd: r3(rows[0].directRmsd),
        bestOfNSymmetricRmsd: defined.length === sym.length ? r3(Math.min(...defined)) : null,
        bestOfNRank: defined.length === sym.length ? sym.indexOf(Math.min(...defined)) + 1 : null,
        poses: rows.map((x) => ({ rank: x.rank, vinaScore: x.vinaScore, symmetricRmsd: r3(x.symmetricRmsd), directRmsd: r3(x.directRmsd) })),
        vinaMs: dockRuns[k].vinaMs,
      };
    });
    const out = {
      ...base,
      status: rm.status === "OK" ? "OK" : "RMSD_UNDEFINED",
      rmsdStatus: rm.status,
      directRmsdStatus: rm.directStatus,
      validMappings: rm.mappings,
      heavyAtoms: rm.heavyAtoms,
      crystalHeavyAtoms: crystal.length,
      prep: { qualification: plan.qualification, acknowledged: acks, profileId: plan.profileId, lockDigest: plan.lockDigest },
      start: { method: start.conformer.method, conformerSeed: start.conformer.seed, torsions: start.torsions, smiles: start.smiles, notCrystalPose: true },
      box,
      params: { exhaustiveness, numPoses, cpu, replicates },
      replicates: reps,
      engine,
      versions: { vina: engine?.version, vinaReported: engine?.versionReported, vinaSha256: engine?.binarySha256, rdkit: start.versions.rdkit, meeko: start.versions.meeko },
      rmsdMethod: rm.method,
    };
    out.successRates = successRates(reps);
    // Backward-compatible fields (apps/api moleDockRun.test.ts): replicate 0, top-1 pose, symmetric RMSD.
    out.bestPoseRmsd = reps[0].top1SymmetricRmsd;
    out.bestPoseVinaScore = reps[0].top1VinaScore;
    return out;
  } finally {
    if (!keepJob) {
      try {
        rmSync(job, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      } catch {
        /* best effort: a WSL file handle can outlive the process briefly on Windows */
      }
    }
  }
}

const fmt = (x, d = 2) => (x === null || x === undefined ? "UNDEFINED" : Number(x).toFixed(d));
const pct = (x) => (x === null || x === undefined ? "n/a" : `${(100 * x).toFixed(0)}%`);

export function renderReport(summary) {
  const L = [];
  L.push(`# Smoke redock ${summary.date}`, "", `**${SMOKE_LABEL}.** Not a benchmark, not a qualification, not the D9 campaign (40 replicates, Wilson CI, paired bootstrap).`);
  L.push("Nothing was tuned on these numbers. The cases are Astex Diverse Set members (a D9 regression set), so they must never be used to tune any parameter.", "");
  L.push("## Protocol", "");
  L.push(`- Tool: \`node tools/mole-dock/redock.mjs --report\` (git ${summary.git}); RMSD helper workers/prep/mole_prep/redock_smoke.py.`);
  L.push(`- Engine: AutoDock Vina ${summary.versions.vina} (\`${summary.versions.vinaReported}\`), binary sha256 ${summary.versions.vinaSha256}. Vina commit: not recorded by the release binary (official v1.2.7 Linux x86_64 release; the research comparator pin 8eb4040 is not verified for this binary).`);
  L.push(`- Preparation: prep worker ME_PREP_INTERIM_V0, RDKit ${summary.versions.rdkit}, Meeko ${summary.versions.meeko} (the research comparator lane is Meeko 0.7.1; digest C12). Prep acks were all given automatically (listed per case in the JSON).`);
  L.push("- Starting ligand: prepared from the CCD isomeric SMILES alone, RDKit ETKDGv3 conformer (seed below), Gasteiger charges, Meeko torsion tree. Never the crystal pose.");
  L.push(`- Box: crystal-ligand heavy-atom envelope + ${BOX_PADDING.toFixed(1)} A on every face (axis-aligned, not a cube); Vina snaps the grid to 0.375 A.`);
  L.push(`- Search: exhaustiveness ${summary.params.exhaustiveness}, ${summary.params.numPoses} poses, cpu ${summary.params.cpu}, ${summary.params.replicates} replicates per case; seed = 1 + (uint64(SHA-256("${SEED_DOMAIN}" NUL id NUL replicate)[0:8]) mod (2^31-1)).`);
  L.push(`- RMSD: ${summary.rmsdMethod}. Success is inclusive (<=). Top-1 = Vina rank 1; best-of-N = the lowest symmetric RMSD among the ${summary.params.numPoses} poses of one replicate.`);
  L.push("- Overall rates: the case is the unit, so overall = mean of the per-case rates over OK cases.", "");
  L.push("## Cases", "", "| Case | Ligand | Status | Heavy atoms | Valid mappings | Conformer seed | Box center | Box size |", "|---|---|---|---|---|---|---|---|");
  for (const c of summary.cases) {
    if (c.status !== "OK" && !c.box) L.push(`| ${c.id} | ${c.ligand} | ${c.status}${c.error ? " (ERROR)" : ""} | | | | | |`);
    else L.push(`| ${c.id} | ${c.ligand} | ${c.status} | ${c.heavyAtoms} | ${c.validMappings} | ${c.start.conformerSeed} | ${c.box.center.join(", ")} | ${c.box.size.join(" x ")} |`);
  }
  const notOk = summary.cases.filter((c) => c.status !== "OK");
  if (notOk.length) {
    L.push("", "Not docked or not scored:");
    for (const c of notOk) L.push(`- ${c.id}: ${c.status}: ${(c.diagnostics || [c.error || c.rmsdStatus]).join("; ").slice(0, 300)}`);
  }
  L.push("", "## Per case x seed", "", "| Case | Rep | Vina seed | Seed uint64 | Top-1 Vina score | Top-1 sym RMSD | Top-1 direct RMSD | Best-of-N sym RMSD (rank) |", "|---|---|---|---|---|---|---|---|");
  for (const c of summary.cases.filter((x) => x.replicates)) {
    for (const r of c.replicates) L.push(`| ${c.id} | ${r.replicate} | ${r.seed.vina} | ${r.seed.u64} | ${fmt(r.top1VinaScore, 3)} | ${fmt(r.top1SymmetricRmsd, 3)} | ${fmt(r.top1DirectRmsd, 3)} | ${fmt(r.bestOfNSymmetricRmsd, 3)} (${r.bestOfNRank ?? "-"}) |`);
  }
  L.push("", "## Success rates (top-1 / best-of-N)", "", `| Case | ${THRESHOLDS.map((t) => `<= ${t.toFixed(1)} A`).join(" | ")} |`, `|---|${THRESHOLDS.map(() => "---").join("|")}|`);
  for (const c of summary.cases.filter((x) => x.successRates)) L.push(`| ${c.id} | ${THRESHOLDS.map((t) => `${pct(c.successRates[t.toFixed(1)].top1)} / ${pct(c.successRates[t.toFixed(1)].bestOfN)}`).join(" | ")} |`);
  L.push(`| Overall (${summary.overall["2.0"].cases} cases, macro) | ${THRESHOLDS.map((t) => `${pct(summary.overall[t.toFixed(1)].top1)} / ${pct(summary.overall[t.toFixed(1)].bestOfN)}`).join(" | ")} |`);
  L.push("", "Raw numbers (every pose, every seed, versions, box min/max): the JSON next to this file.", "");
  return L.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const report = args.includes("--report");
  const ids = args.filter((x) => !x.startsWith("--"));
  const cases = [];
  for (const id of ids.length ? ids : Object.keys(REDOCK_COMPLEXES)) {
    try {
      cases.push(await redock(id));
    } catch (e) {
      cases.push({ id, ligand: REDOCK_COMPLEXES[id] ? `${REDOCK_COMPLEXES[id].ccd} ${REDOCK_COMPLEXES[id].chain}${REDOCK_COMPLEXES[id].resSeq}` : "?", status: "ERROR", error: String(e?.message || e).slice(0, 600) });
      process.exitCode = 1;
    }
    const c = cases[cases.length - 1];
    console.log(JSON.stringify({ id: c.id, status: c.status, top1: c.replicates?.map((r) => [r.top1SymmetricRmsd, r.bestOfNSymmetricRmsd, r.top1VinaScore]), error: c.error, diagnostics: c.diagnostics }));
  }
  const ok = cases.find((c) => c.versions);
  const date = new Date().toISOString().slice(0, 10);
  const summary = {
    label: SMOKE_LABEL,
    date,
    git: process.env.MOLE_REDOCK_GIT_SHA && /^[0-9a-f]{7,40}$/.test(process.env.MOLE_REDOCK_GIT_SHA) ? process.env.MOLE_REDOCK_GIT_SHA : "unrecorded",
    versions: ok?.versions ?? {},
    params: ok?.params ?? {},
    rmsdMethod: ok?.rmsdMethod ?? "",
    thresholds: THRESHOLDS,
    cases,
    overall: overallRates(cases),
  };
  if (report) {
    const dir = join(REPO_ROOT, "docs", "science");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `redock-smoke-${date}.json`), JSON.stringify(summary, null, 2) + "\n");
    writeFileSync(join(dir, `redock-smoke-${date}.md`), renderReport(summary));
  }
  console.log(JSON.stringify({ overall: summary.overall }));
}
