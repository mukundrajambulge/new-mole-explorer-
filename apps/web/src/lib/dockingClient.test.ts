import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockJobServer } from "../../../api/src/jobs/mockServer";
import { createDockingClient, DockingClientError, isAbortError } from "./dockingClient";

let server: Server;
let base = "";
beforeAll(async () => {
  server = createMockJobServer({ stepMs: 5 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const sig = () => new AbortController().signal;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("dockingClient against the 5.0 mock server", () => {
  it("runs prepare, confirm, job and result with validated replies", async () => {
    const c = createDockingClient(base, true);
    const plan = await c.planPrep({ receptorArtifactId: "rec-1", ligandArtifactId: "lig-1", pH: 7.4, protonation: "EXPLICIT_SUBMITTED", keepWaters: false }, sig());
    expect(plan.state).toBe("AWAITING_CONFIRMATION");
    await c.confirmPrep({ jobId: plan.jobId, planDigest: plan.plan!.planDigest, acks: [] }, sig());
    let prep = await c.getPrep(plan.jobId, sig());
    for (let i = 0; i < 50 && prep.state !== "SUCCEEDED"; i += 1) { await wait(10); prep = await c.getPrep(plan.jobId, sig()); }
    expect(prep.preparedReceptorId).toBeTruthy();
    const job = await c.startJob({ receptorPreparedId: prep.preparedReceptorId!, ligandPreparedId: prep.preparedLigandId!, boxCenter: [0, 0, 0], boxSize: [10, 10, 10], exhaustiveness: 8, numPoses: 3, seed: 1 }, sig());
    let st = job;
    for (let i = 0; i < 100 && st.status !== "SUCCEEDED"; i += 1) { await wait(10); st = await c.getJob(job.jobId, sig()); }
    const result = await c.getResult(job.jobId, sig());
    expect(result.scoreStatus).toBe("PREVIEW_UNQUALIFIED");
    expect(result.poses).toHaveLength(3);
  });
  it("shows real server errors and cancels", async () => {
    const c = createDockingClient(base, true);
    await expect(c.getJob("nope-1", sig())).rejects.toMatchObject({ status: 404, message: expect.stringContaining("not found") });
    const job = await c.startJob({ receptorPreparedId: "a", ligandPreparedId: "b", boxCenter: [0, 0, 0], boxSize: [10, 10, 10], exhaustiveness: 8, numPoses: 3, seed: 2 }, sig());
    expect((await c.cancelJob(job.jobId, sig())).status).toBe("CANCELLED");
    await expect(c.cancelJob(job.jobId, sig())).rejects.toBeInstanceOf(DockingClientError);
  });
  it("aborts in-flight requests", async () => {
    const c = createDockingClient(base, true);
    const ac = new AbortController();
    const p = c.getJob("whatever", ac.signal);
    ac.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
  });
});
