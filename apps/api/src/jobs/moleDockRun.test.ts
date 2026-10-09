import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Unit tests for tools/mole-dock/run.mjs (task 5.3): job validation, exit codes, result.json, Vina output parsing.
// No Vina needed: the engine is injected. Fixtures: tests/fixtures/dock/1STP-BTN-* were produced from the real
// 1STP entry by the prep worker (ligand PDBQT) and by the pinned Vina 1.2.7 (poses, seed 20261009).
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const fx = join(repo, "tests", "fixtures");
const runUrl = pathToFileURL(join(repo, "tools/mole-dock/run.mjs")).href;
const redockUrl = pathToFileURL(join(repo, "tools/mole-dock/redock.mjs")).href;
const cli = join(repo, "tools/mole-dock/mole-dock.mjs");

interface Pose { rank: number; vinaScore: number | null; atoms: unknown[] }
interface RunOut { exitCode: number; error?: { code: string; message: string }; result?: Record<string, unknown> & { vinaScore: number; poses: { meScore: null }[] } }
interface Engine {
  pin(): Promise<{ sha256: string; version: string }>;
  verify(outDir: string, pin: unknown): Promise<{ vina: string; binarySha256: string; versionLine: string }>;
  dock(outDir: string, job: unknown, v: unknown): Promise<{ durationMs: number; log: string }>;
}
interface RunMod {
  validateJob(raw: string, o: { root: string }): { job: Record<string, unknown> };
  parseToolsVinaPin(md: string): { sha256: string; version: string } | null;
  parseVinaPoses(t: string): Pose[];
  vinaArgs(job: unknown): string[];
  buildEngineInvocation(o: { program: string; args: string[]; cwd: string; timeoutMs: number; platform?: string }): { command: string; args: string[]; options: { shell: boolean; env: Record<string, string> } };
  createVinaEngine(o?: object): Engine;
  runDockJob(a: { input: string; out: string; root?: string }, d?: { engineImpl?: Engine }): Promise<RunOut>;
}
const load = async () => (await import(runUrl)) as RunMod;

const PIN = "f31f774f723bba7bbe6e9d1c47577020eea9a8da16424284c043d22593570644";
const baseJob = { schemaVersion: 1, receptor: { path: "rec.pdbqt" }, ligand: { path: "lig.pdbqt" }, box: { center: [11.4, 2.4, -11.4], size: [22, 22, 22] }, seed: 42 };

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "moledock-"));
  copyFileSync(join(fx, "multitype-receptor.pdbqt"), join(root, "rec.pdbqt"));
  copyFileSync(join(fx, "dock", "1STP-BTN-ligand.pdbqt"), join(root, "lig.pdbqt"));
  return root;
}
const fakeEngine = (dock: Engine["dock"], sha = PIN): Engine => ({
  pin: async () => ({ sha256: PIN, version: "1.2.7" }),
  verify: async (_o, pin) => {
    if (sha !== (pin as { sha256: string }).sha256) throw Object.assign(new Error("Vina binary sha256 does not match TOOLS.md"), { exitCode: 3, code: "VINA_DIGEST_MISMATCH" });
    return { vina: "/opt/vina", binarySha256: sha, versionLine: "AutoDock Vina v1.2.7" };
  },
  dock,
});

describe("mole-dock run", () => {
  it("validates job.json: defaults, caps, finite box, integer seed, confined paths", async () => {
    const m = await load();
    const root = makeRoot();
    try {
      const { job } = m.validateJob(JSON.stringify(baseJob), { root });
      expect(job).toMatchObject({ exhaustiveness: 8, numPoses: 9, seed: 42 });
      const codeOf = (raw: string) => {
        try {
          m.validateJob(raw, { root });
        } catch (e) {
          return (e as { code?: string }).code;
        }
        return "ACCEPTED";
      };
      const rejects = (patch: object, code = "JOB_INVALID") => expect(codeOf(JSON.stringify({ ...baseJob, ...patch }))).toBe(code);
      rejects({ seed: 1.5 });
      rejects({ seed: undefined });
      rejects({ exhaustiveness: 1000 });
      rejects({ numPoses: 0 });
      rejects({ box: { center: [0, 0, 1e9], size: [20, 20, 20] } });
      rejects({ box: { center: [0, 0, 0], size: [20, 20, 500] } });
      rejects({ box: { center: [0, 0, 0], size: [100, 100, 100] } });
      rejects({ box: { center: [0, 0], size: [20, 20, 20] } });
      rejects({ receptor: { path: "../rec.pdbqt" } });
      rejects({ receptor: { path: "/etc/passwd.pdbqt" } });
      rejects({ receptor: { path: "rec.pdb" } });
      rejects({ extra: true });
      expect(() => m.validateJob("{not json", { root })).toThrow();
      // NaN cannot be encoded in JSON; a string or null in its place is rejected.
      expect(codeOf(JSON.stringify(baseJob).replace("[22,22,22]", "[22,null,22]"))).toBe("JOB_INVALID");
      // Symlink/escape via a nested "..": rejected by the schema before any filesystem access.
      expect(codeOf(JSON.stringify({ ...baseJob, ligand: { path: "sub/../../x.pdbqt" } }))).toBe("JOB_INVALID");
      expect(() => m.validateJob(JSON.stringify({ ...baseJob, ligand: { path: "missing.pdbqt" } }), { root })).toThrow(/not found/);
      // A ligand without ROOT/BRANCH torsion tree is not a Vina ligand.
      copyFileSync(join(fx, "halogen-ligand.pdbqt"), join(root, "flat.pdbqt"));
      expect(() => m.validateJob(JSON.stringify({ ...baseJob, ligand: { path: "flat.pdbqt" } }), { root })).toThrow(/ROOT/);
      writeFileSync(join(root, "nan.pdbqt"), readFileSync(join(root, "lig.pdbqt"), "latin1").replace(/^(ATOM.{26}).{8}/m, "$1     nan"));
      expect(() => m.validateJob(JSON.stringify({ ...baseJob, ligand: { path: "nan.pdbqt" } }), { root })).toThrow(/non-finite/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reads the Vina pin from TOOLS.md and builds a shell-free, env-scrubbed argv", async () => {
    const m = await load();
    expect(m.parseToolsVinaPin(readFileSync(join(repo, "native/third_party/TOOLS.md"), "utf8"))).toEqual({ sha256: PIN, version: "1.2.7" });
    expect(m.parseToolsVinaPin("## AutoDock Vina\n| Version | 1.2.7 |\n")).toBeNull();
    const root = makeRoot();
    try {
      const { job } = m.validateJob(JSON.stringify(baseJob), { root });
      const args = m.vinaArgs(job);
      expect(args).toEqual(expect.arrayContaining(["--seed", "42", "--exhaustiveness", "8", "--num_modes", "9", "--out", "poses.pdbqt"]));
      const inv = m.buildEngineInvocation({ program: "/home/u/mole-tools/vina", args, cwd: root, timeoutMs: 5000, platform: process.platform });
      expect(inv.options.shell).toBe(false);
      expect(inv.args).toContain("-i");
      if (process.platform === "win32") {
        expect(inv.command).toBe("wsl.exe");
        expect(inv.options.env.WSLENV).toBe("");
      }
      expect(() => m.buildEngineInvocation({ program: "vina; rm -rf /", args, cwd: root, timeoutMs: 5000 })).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("parses real Vina 1.2.7 output (1STP biotin redock)", async () => {
    const m = await load();
    const poses = m.parseVinaPoses(readFileSync(join(fx, "dock", "1STP-BTN-vina-poses.pdbqt"), "latin1"));
    expect(poses.length).toBe(9);
    expect(poses[0].vinaScore).toBeLessThan(-5);
    expect(poses.every((p) => p.atoms.length === 19)).toBe(true);
    for (let i = 1; i < poses.length; i++) expect(poses[i].vinaScore!).toBeGreaterThanOrEqual(poses[i - 1].vinaScore!);
  });

  it("writes result.json + manifest.json and maps exit codes 0 / 2 / 3", async () => {
    const m = await load();
    const root = makeRoot();
    try {
      writeFileSync(join(root, "job.json"), JSON.stringify(baseJob));
      const poses = readFileSync(join(fx, "dock", "1STP-BTN-vina-poses.pdbqt"));
      const ok = await m.runDockJob({ input: join(root, "job.json"), out: join(root, "out-ok") }, { engineImpl: fakeEngine(async (o) => (writeFileSync(join(o, "poses.pdbqt"), poses), { durationMs: 1, log: "" })) });
      expect(ok.exitCode, JSON.stringify(ok.error)).toBe(0);
      const res = JSON.parse(readFileSync(join(root, "out-ok", "result.json"), "utf8"));
      expect(res).toMatchObject({ status: "OK", label: "PREVIEW_UNQUALIFIED", meScore: null, meScoreStatus: { status: "UNAVAILABLE" }, params: { seed: 42 }, engine: { binarySha256: PIN } });
      expect(res.poses).toHaveLength(9);
      expect(res.vinaScore).toBe(res.poses[0].vinaScore);
      expect(res.inputs.ligand.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(existsSync(join(root, "out-ok", "manifest.json"))).toBe(true);

      const mismatch = await m.runDockJob({ input: join(root, "job.json"), out: join(root, "out-sha") }, { engineImpl: fakeEngine(async () => ({ durationMs: 0, log: "" }), "0".repeat(64)) });
      expect(mismatch.exitCode).toBe(3);
      expect(mismatch.error?.code).toBe("VINA_DIGEST_MISMATCH");
      const nothing = await m.runDockJob({ input: join(root, "job.json"), out: join(root, "out-none") }, { engineImpl: fakeEngine(async () => ({ durationMs: 0, log: "" })) });
      expect(nothing.exitCode).toBe(3);
      expect(JSON.parse(readFileSync(join(root, "out-none", "result.json"), "utf8")).status).toBe("FAILED");
      // Out dir must be empty: reusing out-ok is bad input.
      expect((await m.runDockJob({ input: join(root, "job.json"), out: join(root, "out-ok") }, { engineImpl: fakeEngine(async () => ({ durationMs: 0, log: "" })) })).exitCode).toBe(2);
      // Fail closed when TOOLS.md has no pin.
      const md = join(root, "TOOLS.md");
      writeFileSync(md, "# nothing pinned\n");
      const nopin = await m.runDockJob({ input: join(root, "job.json"), out: join(root, "out-nopin") }, { engineImpl: m.createVinaEngine({ toolsMd: md }) });
      expect(nopin.exitCode).toBe(3);
      expect(nopin.error?.code).toBe("VINA_PIN_MISSING");

      // Real CLI process: bad input exits 2 before any engine is touched, and errors carry no host paths.
      writeFileSync(join(root, "bad.json"), JSON.stringify({ ...baseJob, ligand: { path: "../../x.pdbqt" } }));
      const r = spawnSync(process.execPath, [cli, "run", "--input", join(root, "bad.json"), "--out", join(root, "out-bad")], { encoding: "utf8", timeout: 30_000 });
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/JOB_INVALID/);
      expect(r.stderr).not.toContain(root);
      expect(spawnSync(process.execPath, [cli, "frobnicate"], { encoding: "utf8", timeout: 30_000 }).status).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  // Real prep worker + pinned Vina through WSL (opt-in). Fixed seed; RMSD is heavy-atom and symmetry-naive.
  it.skipIf(process.platform !== "win32" || process.env.MOLE_DOCK_E2E !== "1")("redocks 1STP biotin and 1IEP imatinib within 2.0 A", async () => {
    const r = (await import(redockUrl)) as { redock(id: string): Promise<{ id: string; bestPoseRmsd: number; bestPoseVinaScore: number }> };
    const rows = [];
    for (const id of ["1STP", "1IEP"]) rows.push(await r.redock(id));
    mkdirSync(join(repo, "test-results"), { recursive: true });
    writeFileSync(join(repo, "test-results", "redock-5.3.json"), JSON.stringify(rows, null, 2));
    console.log(`REDOCK ${JSON.stringify(rows.map((x) => [x.id, x.bestPoseRmsd, x.bestPoseVinaScore]))}`);
    for (const x of rows) expect(x.bestPoseRmsd, x.id).toBeLessThanOrEqual(2.0);
  }, 600_000);
});
