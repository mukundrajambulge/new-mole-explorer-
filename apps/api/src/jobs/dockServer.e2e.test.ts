import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DockJobResultResponseV1Schema, DOCKING_PREVIEW_NOTICE } from "@molecular/contracts";
import { dockRequest, readSse, seedPrepJob, sha, statuses, type PreparedIds } from "./dockRoutes.fixture.js";

// Task 5.5 end to end (gated: MOLE_DOCK_E2E=1 on Windows with WSL Ubuntu-24.04 and ~/mole-tools/vina): the real
// server with FEATURE_DOCKING_RUN=1 runs one tiny pinned-Vina job (exhaustiveness 1, 3 poses) over HTTP: submit,
// SSE until terminal, labelled result, poses artifact. The prepared inputs are a sealed prep job dir holding the
// real tests/fixtures PDBQTs (multitype receptor + 1STP biotin), so this checks the run path, not preparation.
const E2E = process.env.MOLE_DOCK_E2E === "1" && process.platform === "win32";

describe.skipIf(!E2E)("docking job over HTTP with real Vina (5.5, MOLE_DOCK_E2E=1)", () => {
  let dir: string;
  let base: string;
  let token: string;
  let ids: PreparedIds;
  let close: () => Promise<void>;
  const saved = process.env.FEATURE_DOCKING_RUN;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test JSON is checked by assertions
  const call = async (method: string, path: string, body?: unknown): Promise<{ status: number; json: Record<string, any> }> => {
    const r = await fetch(`${base}${path}`, { method, headers: { "x-mole-token": token, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await r.text();
    expect(text).not.toContain(dir);
    return { status: r.status, json: JSON.parse(text) as Record<string, unknown> };
  };

  beforeAll(async () => {
    process.env.FEATURE_DOCKING_RUN = "1";
    dir = mkdtempSync(join(tmpdir(), "mole-dock-e2e-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MOLE_TOKEN_DIR = join(dir, ".mole");
    ids = seedPrepJob(join(dir, "prep-jobs"), "SEALED", "41111111-2222-4333-8444-555555555555");
    const mod = await import("../server.js");
    await mod.startServer(0, "127.0.0.1");
    token = readFileSync(join(dir, ".mole", "token"), "utf8");
    base = `http://127.0.0.1:${(mod.server.address() as AddressInfo).port}`;
    close = async () => {
      mod.dockRoutes.closeStreams();
      for (const j of mod.dockService ? mod.dockService.list() : []) if (j.status === "QUEUED" || j.status === "RUNNING") mod.dockService!.cancel(j.jobId);
      await mod.dockService?.close();
      await new Promise<void>((r) => mod.server.close(() => r()));
    };
  });
  afterAll(async () => {
    await close?.();
    if (saved === undefined) delete process.env.FEATURE_DOCKING_RUN;
    else process.env.FEATURE_DOCKING_RUN = saved;
    rmSync(dir, { recursive: true, force: true });
  });

  it("submits, streams to COMPLETED and serves the PREVIEW_UNQUALIFIED result and poses", async () => {
    const boot = await call("GET", "/api/bootstrap");
    expect(boot.json.capabilities.VINA_COMPARATOR_PREVIEW.state).toBe("EXPERIMENTAL");
    expect(boot.json.capabilities["DOCKING.RUN"].state).toBe("UNAVAILABLE");
    const sub = await call("POST", "/api/docking/jobs", dockRequest(ids));
    expect(sub.status).toBe(202);
    const id = sub.json.jobId as string;
    const sse = await readSse(`${base}/api/docking/jobs/${id}/events`, { "x-mole-token": token }, { ms: 240_000 });
    expect(sse.ended).toBe(true);
    const st = await call("GET", `/api/docking/jobs/${id}`);
    expect(st.json.status, JSON.stringify(st.json.error ?? {})).toBe("COMPLETED");
    expect(statuses(sse.events)).toEqual(["CREATED", "QUEUED", "RUNNING", "COMPLETED"]);
    const res = await call("GET", `/api/docking/jobs/${id}/result`);
    const result = DockJobResultResponseV1Schema.parse(res.json);
    expect(result).toMatchObject({ label: "PREVIEW_UNQUALIFIED", meScore: null, notice: DOCKING_PREVIEW_NOTICE, capability: { capability: "EXPERIMENTAL" } });
    expect(result.provenance.vina?.binarySha256).toBe(result.provenance.vinaPin.sha256);
    expect(result.poses.length).toBeGreaterThanOrEqual(1);
    const poses = await fetch(`${base}/api/docking/jobs/${id}/artifacts/poses.pdbqt`, { headers: { "x-mole-token": token } });
    expect(poses.status).toBe(200);
    expect(sha(Buffer.from(await poses.arrayBuffer()))).toBe(result.posesSha256);
    console.log(`DOCK_E2E ${JSON.stringify({ vinaScore: result.vinaScore, poses: result.poses.length })}`);
    // A second identical submit dedupes onto the completed job.
    const again = await call("POST", "/api/docking/jobs", dockRequest(ids));
    expect(again.json).toMatchObject({ jobId: id, deduped: true });
  }, 300_000);
});
