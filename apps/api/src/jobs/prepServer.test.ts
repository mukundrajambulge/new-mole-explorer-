import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrepJobStateV1Schema, sha256Digest, type D2PreparedReceptorScientificDependenciesV2, type PrepJobStateV1 } from "@molecular/contracts";
import { PrepJobStore, type PrepRunner } from "./prepJobs.js";
import { REPO_ROOT } from "./prepPins.js";
import { createPrepSummarySealer, prepSummarySealer, sealFromPrepManifest } from "./prepSeal.js";

// Task 5.2b fix round: the prep routes through the real server (server.ts), plus the seal on a real INTERIM job.
// fixtures/prep-1d3z-ethanolh is real worker output (workers/prep via tools/mole-dock/prep.mjs in WSL) for
// tests/fixtures/rcsb/1D3Z.pdb (NMR, explicit hydrogens) and the explicit-H, 3D ethanol SDF that the worker
// itself wrote in fixtures/prep-1crn-ethanol. Nothing is generated, so the plan and manifest are INTERIM.
const here = dirname(fileURLToPath(import.meta.url));
const FX = join(here, "fixtures", "prep-1d3z-ethanolh");
const RECEPTOR = readFileSync(resolve(REPO_ROOT, "tests", "fixtures", "rcsb", "1D3Z.pdb"));
const LIGAND = readFileSync(join(here, "fixtures", "prep-1crn-ethanol", "out", "ligand.clean.sdf"));
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;

// fixtures/prep-1d3z-ethanolh-propka: the same real inputs prepared by the real worker with the PROPKA opt-in
// (protonation PROPKA_PREVIEW), so plan and manifest are PREVIEW_UNQUALIFIED.
const FX_PROPKA = join(here, "fixtures", "prep-1d3z-ethanolh-propka");

/** Replays real worker output into the job dir, rebinding jobId/planDigest like the worker would. */
const replayFrom = (fx: string, tamperManifest?: (m: Record<string, unknown>) => void): PrepRunner => async (mode, dir) => {
  const job = readJson(join(dir, "job.json"));
  if (mode === "plan") {
    writeFileSync(join(dir, "plan.json"), JSON.stringify({ ...readJson(join(fx, "plan.json")), jobId: job.jobId, receptorArtifactId: (job.receptor as { artifactId: string }).artifactId, ligandArtifactId: (job.ligand as { artifactId: string }).artifactId }));
    return { status: "OK", stderr: "" };
  }
  const plan = readJson(join(dir, "plan.json"));
  if (readJson(join(dir, "confirmation.json")).planDigest !== plan.planDigest) return { status: "BLOCKED", stderr: "" };
  cpSync(join(fx, "out"), join(dir, "out"), { recursive: true });
  const manifest = { ...readJson(join(fx, "prep-manifest.json")), jobId: job.jobId, planDigest: plan.planDigest };
  tamperManifest?.(manifest);
  writeFileSync(join(dir, "prep-manifest.json"), JSON.stringify(manifest));
  return { status: "OK", stderr: "" };
};
const replay = replayFrom(FX);

/**
 * TEST-ONLY receptor dependency references (the same shape d2Preparation.test.ts uses). No server constant
 * exists for these digests, so production keeps the receptor BLOCKED; injecting them through the sealer seam
 * exercises the real sealPreparedReceptorState on real worker output. Never reachable from a request.
 */
const TEST_ONLY_RECEPTOR_DEPENDENCIES: D2PreparedReceptorScientificDependenciesV2 = {
  chemicalPerceptionProfileRef: { profileId: "ME_SUPPORTED_CHEMISTRY_V1_1_0", profileDigest: sha256Digest<"ProfileDigest">(`sha256:${"c".repeat(64)}`) },
  receptorAtomTypingProfileRef: { profileId: "ME_XS_TYPING_V1_1_0", profileDigest: sha256Digest<"ProfileDigest">(`sha256:${"d".repeat(64)}`) },
  scoringProfileRef: { profileId: "ME_DOCKING_V1_VINA_CLASSIC_1_0", profileDigest: sha256Digest<"ScoringProfileDigest">(`sha256:${"e".repeat(64)}`) },
};
const UNPUBLISHED = ["D2_PROFILE_DIGEST_UNAVAILABLE:ME_SUPPORTED_CHEMISTRY_V1_1_0", "D2_PROFILE_DIGEST_UNAVAILABLE:ME_XS_TYPING_V1_1_0", "D2_PROFILE_DIGEST_UNAVAILABLE:ME_DOCKING_V1_VINA_CLASSIC_1_0"];

describe("prep routes mounted in the real server (5.2b)", () => {
  let dir: string;
  let base: string;
  let token: string;
  let store: PrepJobStore;
  let close: () => Promise<void>;
  const call = async (method: string, path: string, body?: unknown, opts: { raw?: Buffer | string; type?: string } = {}) => {
    const init: RequestInit = { method, headers: { "x-mole-token": token, "content-type": opts.type ?? "application/json" } };
    if (opts.raw !== undefined) init.body = typeof opts.raw === "string" ? opts.raw : new Uint8Array(opts.raw);
    else if (body !== undefined) init.body = JSON.stringify(body);
    const r = await fetch(`${base}${path}`, init);
    const text = await r.text();
    expect(text).not.toContain(dir);
    expect(text).not.toMatch(/[A-Za-z]:\\|\/tmp\/|\/Users\//);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test JSON is checked by assertions
    return { status: r.status, json: JSON.parse(text) as Record<string, any> };
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mole-prep-http-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MOLE_TOKEN_DIR = join(dir, ".mole");
    const mod = await import("../server.js");
    expect(mod.prepService.pins.ok).toBe(true);
    store = mod.prepService.store;
    store.replaceRunner(replay);
    // The installed-venv probe spawns WSL; its logic is covered in prepJobs.test.ts. Here the venv is "pinned".
    store.replaceInstalledToolCheck(async () => []);
    await mod.startServer(0, "127.0.0.1");
    token = readFileSync(join(dir, ".mole", "token"), "utf8");
    base = `http://127.0.0.1:${(mod.server.address() as AddressInfo).port}`;
    close = () => new Promise((r) => mod.server.close(() => r()));
  });
  afterAll(async () => {
    await close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("uploads, maps source ids, plans, confirms once and seals the ligand from a real INTERIM job", async () => {
    const rec = await call("POST", "/api/docking/prep/artifacts?format=pdb", undefined, { raw: RECEPTOR, type: "application/octet-stream" });
    expect(rec.status).toBe(201);
    expect(rec.json.artifactId).toMatch(/^pa_pdb_[0-9a-f]{40}$/);
    const lig = await call("POST", "/api/docking/prep/artifacts?format=sdf", undefined, { raw: LIGAND, type: "application/octet-stream" });
    expect(lig.status).toBe(201);

    // An 84-char structure source id maps onto the same server-hashed prep artifact.
    const form = new FormData();
    form.append("file", new Blob([RECEPTOR]), "1D3Z.pdb");
    const up = await fetch(`${base}/api/structures/upload`, { method: "POST", headers: { "x-mole-token": token }, body: form });
    expect(up.status).toBe(200);
    const sourceArtifactId = ((await up.json()) as { sourceArtifact: { sourceArtifactId: string } }).sourceArtifact.sourceArtifactId;
    expect(sourceArtifactId.length).toBeGreaterThan(64);
    const mapped = await call("POST", "/api/docking/prep/artifacts/from-source", { sourceArtifactId });
    expect(mapped.status).toBe(201);
    expect(mapped.json.artifactId).toBe(rec.json.artifactId);

    const body = { receptorArtifactId: rec.json.artifactId, ligandArtifactId: lig.json.artifactId, pH: 7.4 };
    const a = await call("POST", "/api/docking/prep/plan", body);
    expect(a.status).toBe(201);
    const planned = PrepJobStateV1Schema.parse(a.json);
    expect(planned.state).toBe("AWAITING_CONFIRMATION");
    expect(planned.plan?.qualification).toBe("INTERIM");
    const id = planned.jobId;
    const acks = planned.plan!.decisions.filter((d) => d.requiresAck).map((d) => d.key);
    const forged = await call("POST", `/api/docking/prep/${id}/confirm`, { jobId: id, planDigest: "0".repeat(64), acks });
    expect(forged.status).toBe(409);
    expect(forged.json.error.code).toBe("PLAN_DIGEST_MISMATCH");
    const ok = await call("POST", `/api/docking/prep/${id}/confirm`, { jobId: id, planDigest: planned.plan!.planDigest, acks });
    expect(ok.status).toBe(202);
    let final: PrepJobStateV1 = PrepJobStateV1Schema.parse((await call("GET", `/api/docking/prep/${id}`)).json);
    for (let i = 0; i < 200 && final.state === "APPLYING"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      final = PrepJobStateV1Schema.parse((await call("GET", `/api/docking/prep/${id}`)).json);
    }
    expect(final.state, final.error).toBe("SUCCEEDED");
    const reused = await call("POST", `/api/docking/prep/${id}/confirm`, { jobId: id, planDigest: planned.plan!.planDigest, acks });
    expect(reused.status).toBe(409);
    expect(reused.json.error.code).toBe("ALREADY_CONFIRMED");

    // The ligand goes through sealLigandKinematicModel + sealPreparedLigandState for real. The receptor seal
    // needs three dependency profile digests that no server constant publishes (5.2 may not add one), so the
    // production sealer names each one and the job stays unsealed overall: no prepared ids are minted.
    expect(final.seal).toMatchObject({ status: "BLOCKED", qualification: "INTERIM", verifiedOutputs: 6 });
    expect(final.seal?.components?.ligand.status).toBe("SEALED");
    expect(final.seal?.components?.ligand.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(final.seal?.components?.receptor).toEqual({ status: "BLOCKED", reasonCodes: UNPUBLISHED });
    expect(final.seal?.reasonCodes).toEqual(UNPUBLISHED);
    expect(final.preparedReceptorId).toBeUndefined();
    expect(final.preparedLigandId).toBeUndefined();
    expect(existsSync(join(store.jobDir(id), "in"))).toBe(false);

    const s1 = await sealFromPrepManifest(store, id);
    const s2 = await sealFromPrepManifest(store, id);
    expect(s1.ligandState?.digest).toBe(final.seal?.components?.ligand.digest);
    expect(s2.ligandState?.digest).toBe(s1.ligandState?.digest);
    expect(s1.ligandState?.atomTyping).toHaveLength(9);
    expect(s1.ligandState?.atomTyping.filter((t) => t.typeId === "H_MERGED")).toHaveLength(5);
    expect(s1.ligandState?.kinematicModel.searchTorsionCount).toBe(1);
    writeFileSync(join(store.jobDir(id), "out", "ligand.pdbqt"), "REMARK tampered\n");
    expect((await sealFromPrepManifest(store, id)).reasonCodes).toContain("OUTPUT_TAMPERED");
  }, 60_000);

  /** Upload the real inputs, plan with `options`, confirm with the plan's acks and wait for the final state. */
  const runJob = async (options: Record<string, unknown> = {}) => {
    const rec = await call("POST", "/api/docking/prep/artifacts?format=pdb", undefined, { raw: RECEPTOR, type: "application/octet-stream" });
    const lig = await call("POST", "/api/docking/prep/artifacts?format=sdf", undefined, { raw: LIGAND, type: "application/octet-stream" });
    const a = await call("POST", "/api/docking/prep/plan", { receptorArtifactId: rec.json.artifactId, ligandArtifactId: lig.json.artifactId, pH: 7.4, ...options });
    expect(a.status, JSON.stringify(a.json.error)).toBe(201);
    const planned = PrepJobStateV1Schema.parse(a.json);
    const id = planned.jobId;
    const acks = planned.plan!.decisions.filter((d) => d.requiresAck).map((d) => d.key);
    expect((await call("POST", `/api/docking/prep/${id}/confirm`, { jobId: id, planDigest: planned.plan!.planDigest, acks })).status).toBe(202);
    let final = PrepJobStateV1Schema.parse((await call("GET", `/api/docking/prep/${id}`)).json);
    for (let i = 0; i < 200 && final.state === "APPLYING"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      final = PrepJobStateV1Schema.parse((await call("GET", `/api/docking/prep/${id}`)).json);
    }
    return { planned, final, id };
  };

  it("a real INTERIM complex (1D3Z + explicit-H ethanol) prepares to SEALED end to end over HTTP once the receptor dependency digests exist", async () => {
    store.replaceRunner(replay);
    store.replaceSealer(createPrepSummarySealer({ receptorDependencies: TEST_ONLY_RECEPTOR_DEPENDENCIES }));
    try {
      const { planned, final, id } = await runJob();
      expect(planned.plan?.qualification).toBe("INTERIM");
      expect(final.state, final.error).toBe("SUCCEEDED");
      expect(final.seal).toMatchObject({ status: "SEALED", qualification: "INTERIM", reasonCodes: [], verifiedOutputs: 6 });
      expect(final.seal?.components?.receptor.status).toBe("SEALED");
      expect(final.seal?.components?.ligand.status).toBe("SEALED");
      expect(final.seal?.components?.receptor.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      // Prepared ids are minted only for a SEALED job.
      const compact = id.replace(/-/g, "");
      expect(final.preparedReceptorId).toBe(`prec_${compact}`);
      expect(final.preparedLigandId).toBe(`plig_${compact}`);

      // The receptor state is the real sealPreparedReceptorState output, deterministic and bound to the plan.
      const s1 = await sealFromPrepManifest(store, id, { receptorDependencies: TEST_ONLY_RECEPTOR_DEPENDENCIES });
      const s2 = await sealFromPrepManifest(store, id, { receptorDependencies: TEST_ONLY_RECEPTOR_DEPENDENCIES });
      const rs = s1.receptorState!;
      expect(rs.digest).toBe(final.seal?.components?.receptor.digest);
      expect(s2.receptorState?.digest).toBe(rs.digest);
      expect(rs.semanticSchemaId).toBe("D2_PREPARED_RECEPTOR_STATE_V2");
      expect(rs.profileId).toBe("ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0");
      expect(rs.modelNumber).toBe(1);
      expect(rs.chainIds).toEqual(["A"]);
      expect(rs.graphRevision.atoms).toHaveLength(1231);
      expect(rs.chemicalState).toMatchObject({ resolution: "EXPLICIT_SUBMITTED", protonationStatus: "EXPLICIT" });
      expect(rs.chemicalState.sourceEvidenceRefs).toContain(`prep-plan:${planned.plan!.planDigest}`);
      expect(rs.componentRoles.every((r) => r.role === "CORE")).toBe(true);
      expect(rs.scientificDependencies).toEqual(TEST_ONLY_RECEPTOR_DEPENDENCIES);
      // The dependency references are hash-active: a different scorer digest gives a different receptor state.
      const other = await sealFromPrepManifest(store, id, { receptorDependencies: { ...TEST_ONLY_RECEPTOR_DEPENDENCIES, scoringProfileRef: { profileId: "ME_DOCKING_V1_VINA_CLASSIC_1_0", profileDigest: sha256Digest<"ScoringProfileDigest">(`sha256:${"1".repeat(64)}`) } } });
      expect(other.status).toBe("SEALED");
      expect(other.receptorState?.digest).not.toBe(rs.digest);
      // A reference bound to the wrong profile ID is not accepted as the dependency.
      const wrongId = await sealFromPrepManifest(store, id, { receptorDependencies: { ...TEST_ONLY_RECEPTOR_DEPENDENCIES, receptorAtomTypingProfileRef: { profileId: "ME_XS_TYPING_V9", profileDigest: TEST_ONLY_RECEPTOR_DEPENDENCIES.receptorAtomTypingProfileRef.profileDigest } } });
      expect(wrongId.status).toBe("BLOCKED");
      expect(wrongId.reasonCodes).toEqual(["D2_PROFILE_DIGEST_UNAVAILABLE:ME_XS_TYPING_V1_1_0"]);
      // Production (server constants only) blocks the very same job and names every missing digest.
      expect((await sealFromPrepManifest(store, id)).components?.receptor).toEqual({ status: "BLOCKED", reasonCodes: UNPUBLISHED });
    } finally {
      store.replaceSealer(prepSummarySealer);
    }
  }, 60_000);

  it("the PROPKA opt-in (real worker output) seals PREVIEW_UNQUALIFIED: generated protonation is never D2-sealed", async () => {
    store.replaceRunner(replayFrom(FX_PROPKA));
    try {
      for (const sealer of [prepSummarySealer, createPrepSummarySealer({ receptorDependencies: TEST_ONLY_RECEPTOR_DEPENDENCIES })]) {
        store.replaceSealer(sealer);
        const { planned, final } = await runJob({ protonation: "PROPKA_PREVIEW" });
        expect(planned.plan?.qualification).toBe("PREVIEW_UNQUALIFIED");
        expect(planned.plan?.protonationSource).toBe("PROPKA_PREVIEW");
        expect(final.state, final.error).toBe("SUCCEEDED");
        expect(final.manifest?.stages.some((s) => s.tool === "pdb2pqr+propka" && s.version === "3.7.1/3.5.1")).toBe(true);
        expect(final.seal).toEqual({
          status: "PREVIEW_UNQUALIFIED",
          qualification: "PREVIEW_UNQUALIFIED",
          reasonCodes: ["GENERATED_CHEMICAL_STATE"],
          verifiedOutputs: 6,
          components: { receptor: { status: "PREVIEW_UNQUALIFIED", reasonCodes: ["GENERATED_CHEMICAL_STATE"] }, ligand: { status: "PREVIEW_UNQUALIFIED", reasonCodes: ["GENERATED_CHEMICAL_STATE"] } },
        });
        expect(final.preparedReceptorId).toBeUndefined();
        expect(final.preparedLigandId).toBeUndefined();
      }
    } finally {
      store.replaceRunner(replay);
      store.replaceSealer(prepSummarySealer);
    }
  }, 60_000);

  it("tool drift fails closed: a manifest stage version off TOOLS.md fails the job; a drifted venv refuses plans (503)", async () => {
    store.replaceRunner(replayFrom(FX, (m) => {
      const stages = m.stages as { tool: string; version: string }[];
      stages.find((s) => s.tool === "meeko.ligand")!.version = "0.8.1";
    }));
    try {
      const { final } = await runJob();
      expect(final.state).toBe("FAILED");
      expect(final.error).toContain("OUTPUT_REJECTED");
      expect(final.seal).toMatchObject({ status: "REJECTED" });
      expect(final.seal?.reasonCodes).toContain("TOOL_VERSION_DRIFT:meeko.ligand");
      expect(final.preparedReceptorId).toBeUndefined();
    } finally {
      store.replaceRunner(replay);
    }
    store.replaceInstalledToolCheck(async () => ["INSTALLED_DRIFT:rdkit"]);
    try {
      const rec = await call("POST", "/api/docking/prep/artifacts?format=pdb", undefined, { raw: RECEPTOR, type: "application/octet-stream" });
      const lig = await call("POST", "/api/docking/prep/artifacts?format=sdf", undefined, { raw: LIGAND, type: "application/octet-stream" });
      const r = await call("POST", "/api/docking/prep/plan", { receptorArtifactId: rec.json.artifactId, ligandArtifactId: lig.json.artifactId, pH: 7.4 });
      expect(r.status).toBe(503);
      expect(r.json.error.code).toBe("PROVENANCE_REPLAY");
      expect(r.json.error.message).toContain("INSTALLED_DRIFT:rdkit");
    } finally {
      store.replaceInstalledToolCheck(async () => []);
    }
  }, 60_000);

  it("streams uploads: oversize bodies answer 413 and leave no temp file", async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1, 0x41);
    const r = await call("POST", "/api/docking/prep/artifacts?format=sdf", undefined, { raw: big, type: "application/octet-stream" });
    expect(r.status).toBe(413);
    expect(r.json.error.code).toBe("OVERSIZE_INPUT");
    const leftovers = readdirSync(join(dir, "prep-artifacts")).filter((n) => n.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  }, 60_000);

  it("rejects traversal, oversize bodies and client digests over HTTP; DOCKING.RUN stays unavailable", async () => {
    const plan = { receptorArtifactId: "pa_pdb_" + "0".repeat(40), ligandArtifactId: "pa_sdf_" + "0".repeat(40), pH: 7.4 };
    expect((await call("POST", "/api/docking/prep/plan", plan)).json.error.code).toBe("ARTIFACT_NOT_FOUND");
    expect((await call("POST", "/api/docking/prep/plan", { ...plan, receptorArtifactId: "../../etc/passwd" })).status).toBe(400);
    expect((await call("GET", "/api/docking/prep/..%2F..%2Fstate.json")).status).toBe(400);
    expect((await call("GET", "/api/docking/prep/00000000-0000-4000-8000-000000000000")).status).toBe(404);
    for (const sid of ["source_local_upload_../../x", "../source-artifacts/x"]) {
      expect((await call("POST", "/api/docking/prep/artifacts/from-source", { sourceArtifactId: sid })).status).toBe(400);
    }
    const sha = await call("POST", "/api/docking/prep/plan", { ...plan, sha256: "a".repeat(64) });
    expect(sha.status).toBe(400);
    expect(sha.json.error.code).toBe("SECURITY_REJECTION");
    expect((await call("POST", "/api/docking/prep/artifacts/from-source", { sourceArtifactId: "x", sha256: "a".repeat(64) })).json.error.code).toBe("SECURITY_REJECTION");
    const big = await call("POST", "/api/docking/prep/plan", undefined, { raw: JSON.stringify({ ...plan, pad: "x".repeat(70 * 1024) }) });
    expect(big.status).toBe(413);
    expect((await call("POST", "/api/docking/prep/artifacts?format=exe", undefined, { raw: "x", type: "application/octet-stream" })).status).toBe(422);
    expect((await call("POST", "/api/docking/prep/artifacts?format=pdb", undefined, { raw: "data_1ABC\n_atom_site.id\n", type: "application/octet-stream" })).status).toBe(422);
    const boot = await call("GET", "/api/bootstrap");
    expect(boot.json.capabilities["DOCKING.RUN"].state).toBe("UNAVAILABLE");
  });
});

describe("prep job garbage collection and quota (5.2b)", () => {
  it("deletes expired/failed jobs after retention, evicts oldest terminal jobs and refuses plans over quota", async () => {
    const root = mkdtempSync(join(tmpdir(), "prepgc-"));
    try {
      let t = Date.now();
      const resolveArtifact = async (id: string) => (id === "r" ? { format: "pdb", bytes: RECEPTOR } : id === "l" ? { format: "sdf", bytes: LIGAND } : undefined);
      const make = (maxJobs: number) => {
        const s = new PrepJobStore({ root, resolveArtifact, runner: replay, now: () => t, maxJobs, retainTerminalMs: 60_000, pins: () => ({ ok: true, lockDigest: "", mismatches: [] }), installedTools: async () => [] });
        s.init();
        return s;
      };
      const req = { receptorArtifactId: "r", ligandArtifactId: "l", pH: 7.4, protonation: "EXPLICIT_SUBMITTED", ligandProtonation: "EXPLICIT_SUBMITTED", keepWaters: false, addMissingAtoms: false } as const;
      const s = make(2);
      const a = await s.plan(req);
      t += 1000;
      const b = await s.plan(req);
      await expect(s.plan(req)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", httpStatus: 429 });
      t += 31 * 60_000; // both plans expire; their staged inputs are dropped
      expect(s.get(a.jobId).state).toBe("EXPIRED");
      expect(existsSync(join(s.jobDir(a.jobId), "in"))).toBe(false);
      const c = await s.plan(req); // gc evicts the oldest terminal job to make room
      expect(c.state).toBe("AWAITING_CONFIRMATION");
      expect(existsSync(s.jobDir(a.jobId))).toBe(false);
      expect(() => s.get(a.jobId)).toThrow(/not found/);
      expect(s.get(b.jobId).state).toBe("EXPIRED");
      // After the retention window a restarted store removes the remaining terminal job from disk.
      t += 33 * 60_000;
      const reborn = make(2);
      expect(existsSync(reborn.jobDir(b.jobId))).toBe(false);
      expect(reborn.get(c.jobId).state).toBe("EXPIRED");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
