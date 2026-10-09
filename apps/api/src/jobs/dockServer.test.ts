import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dockRequest } from "./dockRoutes.fixture.js";

// Task 5.5/5.6 through the real server (server.ts) with FEATURE_DOCKING_RUN unset: nothing about running is
// reachable, the job store is never created, the capabilities say so, and the routes sit behind the token check.
// The prep routes now validate through parseOr400 (1.7 follow-up).
describe("docking job routes in the real server, flag off (5.5)", () => {
  let dir: string;
  let base: string;
  let token: string;
  let close: () => Promise<void>;
  const saved = process.env.FEATURE_DOCKING_RUN;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test JSON is checked by assertions
  const call = async (method: string, path: string, body?: unknown, withToken = true): Promise<{ status: number; json: Record<string, any> }> => {
    const r = await fetch(`${base}${path}`, { method, headers: { ...(withToken ? { "x-mole-token": token } : {}), "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await r.text();
    expect(text).not.toContain(dir);
    return { status: r.status, json: JSON.parse(text) as Record<string, unknown> };
  };

  beforeAll(async () => {
    delete process.env.FEATURE_DOCKING_RUN;
    dir = mkdtempSync(join(tmpdir(), "mole-dock-off-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MOLE_TOKEN_DIR = join(dir, ".mole");
    const mod = await import("../server.js");
    expect(mod.dockService).toBeUndefined();
    await mod.startServer(0, "127.0.0.1");
    token = readFileSync(join(dir, ".mole", "token"), "utf8");
    base = `http://127.0.0.1:${(mod.server.address() as AddressInfo).port}`;
    close = () => new Promise((r) => mod.server.close(() => r()));
  });
  afterAll(async () => {
    await close();
    if (saved === undefined) delete process.env.FEATURE_DOCKING_RUN;
    else process.env.FEATURE_DOCKING_RUN = saved;
    rmSync(dir, { recursive: true, force: true });
  });

  it("answers the plain 404 on every run route and never creates the job store", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const ids = { receptorPreparedId: `prec_${"1".repeat(32)}`, ligandPreparedId: `plig_${"1".repeat(32)}` };
    for (const [m, p] of [
      ["POST", "/api/docking/jobs"],
      ["GET", "/api/docking/jobs"],
      ["GET", `/api/docking/jobs/${id}`],
      ["GET", `/api/docking/jobs/${id}/events`],
      ["POST", `/api/docking/jobs/${id}/cancel`],
      ["GET", `/api/docking/jobs/${id}/result`],
      ["GET", `/api/docking/jobs/${id}/artifacts/poses.pdbqt`],
    ] as const) {
      const r = await call(m, p, m === "POST" ? dockRequest(ids) : undefined);
      expect(r.status, `${m} ${p}`).toBe(404);
      expect(r.json.error.code).toBe("NOT_FOUND");
    }
    expect(existsSync(join(dir, "dock-jobs"))).toBe(false);
    // Behind the token check like every other route.
    expect((await call("POST", "/api/docking/jobs", dockRequest(ids), false)).status).toBe(401);
  });

  it("reports VINA_COMPARATOR_PREVIEW and DOCKING.RUN as UNAVAILABLE, with the reason and the fix", async () => {
    const boot = await call("GET", "/api/bootstrap");
    expect(boot.json.capabilities["DOCKING.RUN"].state).toBe("UNAVAILABLE");
    expect(boot.json.capabilities.VINA_COMPARATOR_PREVIEW.state).toBe("UNAVAILABLE");
    expect(boot.json.capabilities.VINA_COMPARATOR_PREVIEW.description).toMatch(/FEATURE_DOCKING_RUN=1/);
    const cap = await call("GET", "/api/docking/capabilities");
    expect(cap.json.VINA_COMPARATOR_PREVIEW).toMatchObject({ available: false, capability: "UNAVAILABLE", implementation: "IMPLEMENTED_UNVERIFIED", validation: "NOT_EVALUATED" });
    expect(cap.json["DOCKING.RUN"].state).toBe("UNAVAILABLE");
  });

  it("validates prep routes through parseOr400: field and rule named, value and paths never echoed", async () => {
    const plan = { receptorArtifactId: "pa_pdb_" + "0".repeat(40), ligandArtifactId: "pa_sdf_" + "0".repeat(40), pH: "C:\\Users\\secret" };
    const r = await call("POST", "/api/docking/prep/plan", plan);
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("INVALID_INPUT");
    expect(r.json.error.message).toMatch(/^Invalid preparation request: pH: /);
    expect(r.json.error.message).not.toContain("secret");
    const id = await call("GET", "/api/docking/prep/..%2F..%2Fstate.json");
    expect(id.status).toBe(400);
    expect(id.json.error.message).toMatch(/^Invalid job id: /);
    expect((await call("GET", "/api/docking/prep/%E0%A4%A")).status).toBe(400);
  });
});
