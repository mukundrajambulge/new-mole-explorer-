import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import {
  DockJobRequestSchema,
  DockResultSchema,
  JobEventSchema,
  JobStatusSchema,
  PrepConfirmationV1Schema,
  PrepJobStateV1Schema,
  PrepManifestV1Schema,
  PrepPlanV1Schema,
  PrepareRequestSchema,
} from "@molecular/contracts";
import { createMockJobServer } from "./mockServer.js";

const sha = "a".repeat(64);
const validDock = { receptorPreparedId: "prep-rec-1", ligandPreparedId: "prep-lig-1", boxCenter: [1, 2, 3], boxSize: [20, 20, 20], seed: 42 };

describe("job contract schemas", () => {
  it("accepts a valid dock request and applies defaults", () => {
    const r = DockJobRequestSchema.parse(validDock);
    expect(r.exhaustiveness).toBe(8);
    expect(r.numPoses).toBe(9);
  });
  it.each([
    ["extra sha256", { ...validDock, sha256: sha }],
    ["profile digest", { ...validDock, profileDigest: sha }],
    ["bad id", { ...validDock, receptorPreparedId: "../etc" }],
    ["nan center", { ...validDock, boxCenter: [NaN, 0, 0] }],
    ["huge box", { ...validDock, boxSize: [500, 20, 20] }],
    ["zero poses", { ...validDock, numPoses: 0 }],
    ["fractional seed", { ...validDock, seed: 1.5 }],
    ["exhaustiveness cap", { ...validDock, exhaustiveness: 1000 }],
  ])("rejects dock request: %s", (_n, v) => {
    expect(DockJobRequestSchema.safeParse(v).success).toBe(false);
  });
  it("prepare request rejects client hashes", () => {
    expect(PrepareRequestSchema.safeParse({ receptorArtifactId: "r1", ligandArtifactId: "l1" }).success).toBe(true);
    expect(PrepareRequestSchema.safeParse({ receptorArtifactId: "r1", ligandArtifactId: "l1", sha256: sha }).success).toBe(false);
    expect(PrepareRequestSchema.safeParse({ receptorArtifactId: "r1", ligandArtifactId: "l1", pH: 15 }).success).toBe(false);
  });
  it("confirmation caps acks and digest shape", () => {
    expect(PrepConfirmationV1Schema.safeParse({ jobId: "j1", planDigest: sha, acks: ["a"] }).success).toBe(true);
    expect(PrepConfirmationV1Schema.safeParse({ jobId: "j1", planDigest: "xyz", acks: [] }).success).toBe(false);
    expect(PrepConfirmationV1Schema.safeParse({ jobId: "j1", planDigest: sha, acks: Array(33).fill("a") }).success).toBe(false);
  });
  it("manifest rejects traversal paths and bad status", () => {
    const m = { schemaVersion: 1, jobId: "j1", status: "PREPARED", stages: [], outputs: [{ role: "RECEPTOR_PDBQT", relPath: "out/r.pdbqt", sha256: sha, bytes: 10 }], diagnostics: [] };
    expect(PrepManifestV1Schema.safeParse(m).success).toBe(true);
    for (const relPath of ["../r.pdbqt", "/abs/r.pdbqt", "C:/r.pdbqt", "a\\b"]) {
      expect(PrepManifestV1Schema.safeParse({ ...m, outputs: [{ ...m.outputs[0], relPath }] }).success).toBe(false);
    }
    expect(PrepManifestV1Schema.safeParse({ ...m, status: "OK" }).success).toBe(false);
  });
  it("plan and state schemas validate", () => {
    const plan = { schemaVersion: 1, jobId: "j1", receptorArtifactId: "r", ligandArtifactId: "l", pH: 7.4, protonationSource: "EXPLICIT_SUBMITTED", chargeModel: "gasteiger", tautomer: "as-submitted", rotatableBonds: 2, decisions: [], warnings: [], planDigest: sha };
    expect(PrepPlanV1Schema.safeParse(plan).success).toBe(true);
    expect(PrepPlanV1Schema.safeParse({ ...plan, planDigest: "short" }).success).toBe(false);
    const st = { schemaVersion: 1, jobId: "j1", state: "AWAITING_CONFIRMATION", plan, createdAt: "t", expiresAt: "t" };
    expect(PrepJobStateV1Schema.safeParse(st).success).toBe(true);
    expect(PrepJobStateV1Schema.safeParse({ ...st, state: "DONE" }).success).toBe(false);
  });
  it("status, result, and event unions validate", () => {
    const s = { jobId: "j1", status: "RUNNING", progress: 0.5, createdAt: "t", updatedAt: "t" };
    expect(JobStatusSchema.safeParse(s).success).toBe(true);
    expect(JobStatusSchema.safeParse({ ...s, progress: 1.5 }).success).toBe(false);
    expect(JobStatusSchema.safeParse({ ...s, status: "DONE" }).success).toBe(false);
    const pose = { rank: 1, vinaScore: -8, meScore: null, meTerms: { gauss1: -1 }, poseArtifactId: "p1" };
    const r = { jobId: "j1", poses: [pose], manifestRef: { artifactId: "m1" }, scoreStatus: "UNAVAILABLE" };
    expect(DockResultSchema.safeParse(r).success).toBe(true);
    expect(DockResultSchema.safeParse({ ...r, poses: [{ ...pose, vinaScore: Infinity }] }).success).toBe(false);
    expect(JobEventSchema.safeParse({ type: "progress", jobId: "j1", seq: 1, at: "t", progress: 0.2 }).success).toBe(true);
    expect(JobEventSchema.safeParse({ type: "bogus", jobId: "j1", seq: 1, at: "t" }).success).toBe(false);
  });
});

describe("mock job server lifecycle", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    server = createMockJobServer({ stepMs: 10, failSeed: 666 });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });
  const post = (p: string, body: unknown) => fetch(base + p, { method: "POST", body: JSON.stringify(body) });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("prep plan -> confirm -> succeeded, single-use and digest-checked", async () => {
    const plan = PrepJobStateV1Schema.parse(await (await post("/docking/prep/plan", { receptorArtifactId: "r1", ligandArtifactId: "l1" })).json());
    const id = plan.jobId;
    const bad = await post(`/docking/prep/${id}/confirm`, { jobId: id, planDigest: sha, acks: [] });
    expect(bad.status).toBe(409);
    const ok = await post(`/docking/prep/${id}/confirm`, { jobId: id, planDigest: plan.plan!.planDigest, acks: [] });
    expect(ok.status).toBe(202);
    expect((await post(`/docking/prep/${id}/confirm`, { jobId: id, planDigest: plan.plan!.planDigest, acks: [] })).status).toBe(409);
    await wait(60);
    const done = PrepJobStateV1Schema.parse(await (await fetch(`${base}/docking/prep/${id}`)).json());
    expect(done.state).toBe("SUCCEEDED");
  });

  it("job runs to COMPLETED with SSE events and a valid result", async () => {
    const st = JobStatusSchema.parse(await (await post("/docking/jobs", validDock)).json());
    const sse = await (await fetch(`${base}/docking/jobs/${st.jobId}/events`)).text();
    const events = sse.split("\n\n").filter((b) => b.includes("data: ")).map((b) => JobEventSchema.parse(JSON.parse(b.split("data: ")[1]!)));
    expect(events.at(-1)?.type).toBe("result");
    expect(events.some((e) => e.type === "status" && e.status === "RUNNING")).toBe(true);
    const final = JobStatusSchema.parse(await (await fetch(`${base}/docking/jobs/${st.jobId}`)).json());
    expect(final.status).toBe("COMPLETED");
    const result = DockResultSchema.parse(await (await fetch(`${base}/docking/jobs/${st.jobId}/result`)).json());
    expect(result.scoreStatus).toBe("PREVIEW_UNQUALIFIED");
    const pose = await fetch(`${base}/docking/artifacts/${result.poses[0]!.poseArtifactId}?format=pdbqt`);
    expect(pose.status).toBe(200);
    expect(await pose.text()).toContain("MOCK");
    expect((await fetch(`${base}/docking/artifacts/nope`)).status).toBe(404);
  });

  it("supports cancel and failure, and rejects invalid input", async () => {
    const a = JobStatusSchema.parse(await (await post("/docking/jobs", validDock)).json());
    expect((await post(`/docking/jobs/${a.jobId}/cancel`, {})).status).toBe(200);
    expect(JobStatusSchema.parse(await (await fetch(`${base}/docking/jobs/${a.jobId}`)).json()).status).toBe("CANCELLED");
    const f = JobStatusSchema.parse(await (await post("/docking/jobs", { ...validDock, seed: 666 })).json());
    await wait(120);
    expect(JobStatusSchema.parse(await (await fetch(`${base}/docking/jobs/${f.jobId}`)).json()).status).toBe("FAILED");
    expect((await post("/docking/jobs", { ...validDock, sha256: sha })).status).toBe(400);
    expect((await fetch(`${base}/docking/jobs/..%2Fx`)).status).toBe(400);
    expect((await post("/docking/jobs", { pad: "x".repeat(70_000) })).status).toBe(413);
  });
});
