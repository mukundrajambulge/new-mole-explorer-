import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { request } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dockRequest, seedPrepJob, type PreparedIds } from "./dockRoutes.fixture.js";
// @ts-expect-error: plain .mjs test support (no types)
import { fakeEngine } from "./dockCrash.fixture.mjs";

// The real server with FEATURE_DOCKING_RUN=1 and a fake (slow) engine: the docking routes sit behind the token
// check, and server.close() ends open SSE streams and closes the job store instead of hanging.
vi.mock("../docking/routes.js", async (orig) => {
  const real = await orig<typeof import("../docking/routes.js")>();
  const { createMoleDockRunner } = await import("./dockRunner.js");
  return { ...real, createDockJobService: (deps: Parameters<typeof real.createDockJobService>[0]) => real.createDockJobService({ ...deps, runner: createMoleDockRunner({ engine: fakeEngine({ holdMs: 60_000 }) }) }) };
});

describe("docking job routes in the real server, flag on (5.5 follow-ups)", () => {
  let dir: string;
  let base: string;
  let token: string;
  let ids: PreparedIds;
  let mod: typeof import("../server.js");
  const saved = process.env.FEATURE_DOCKING_RUN;

  beforeAll(async () => {
    process.env.FEATURE_DOCKING_RUN = "1";
    dir = mkdtempSync(join(tmpdir(), "mole-dock-on-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MOLE_TOKEN_DIR = join(dir, ".mole");
    ids = seedPrepJob(join(dir, "prep-jobs"), "SEALED", "51111111-2222-4333-8444-555555555555");
    mod = await import("../server.js");
    await mod.startServer(0, "127.0.0.1");
    token = readFileSync(join(dir, ".mole", "token"), "utf8");
    base = `http://127.0.0.1:${(mod.server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.FEATURE_DOCKING_RUN;
    else process.env.FEATURE_DOCKING_RUN = saved;
    rmSync(dir, { recursive: true, force: true });
  });

  it("answers 401 without the token on every docking route", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    for (const [m, p] of [
      ["POST", "/api/docking/jobs"],
      ["GET", "/api/docking/jobs"],
      ["GET", `/api/docking/jobs/${id}`],
      ["GET", `/api/docking/jobs/${id}/events`],
      ["POST", `/api/docking/jobs/${id}/cancel`],
      ["GET", `/api/docking/jobs/${id}/result`],
      ["GET", `/api/docking/jobs/${id}/artifacts/poses.pdbqt`],
      ["GET", "/api/docking/capabilities"],
    ] as const) {
      const r = await fetch(`${base}${p}`, { method: m, ...(m === "POST" ? { headers: { "content-type": "application/json" }, body: JSON.stringify(dockRequest(ids)) } : {}) });
      expect(r.status, `${m} ${p}`).toBe(401);
    }
    expect((await fetch(`${base}/api/docking/jobs`, { headers: { "x-mole-token": token } })).status).toBe(200);
  });

  it("server.close() ends open SSE streams, stops the running job and releases the store", async () => {
    const sub = await fetch(`${base}/api/docking/jobs`, { method: "POST", headers: { "x-mole-token": token, "content-type": "application/json" }, body: JSON.stringify(dockRequest(ids)) });
    expect(sub.status).toBe(202);
    const id = ((await sub.json()) as { jobId: string }).jobId;
    let ended = false;
    let open: (() => void) | undefined;
    const opened = new Promise<void>((r) => (open = r));
    const clientEnded = new Promise<void>((r) => {
      request(`${base}/api/docking/jobs/${id}/events`, { headers: { "x-mole-token": token } }, (res) => {
        res.on("data", () => open?.());
        res.on("end", () => ((ended = true), r()));
        res.on("error", () => r());
        res.on("close", () => r());
      }).end();
    });
    await opened;
    expect(mod.dockRoutes.openStreams()).toBe(1);
    const t0 = Date.now();
    await new Promise<void>((r) => mod.server.close(() => r()));
    await clientEnded;
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(ended).toBe(true);
    expect(mod.dockRoutes.openStreams()).toBe(0);
    expect(mod.dockService!.get(id).status).toBe("FAILED");
  }, 30_000);
});
