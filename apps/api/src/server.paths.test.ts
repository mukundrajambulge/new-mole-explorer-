import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { safeJoin } from "./projects/safeJoin.js";

describe("safeJoin", () => {
  it("rejects escapes and accepts children", () => {
    const root = mkdtempSync(join(tmpdir(), "mole-sj-"));
    expect(() => safeJoin(root, "..", "x")).toThrow();
    expect(() => safeJoin(root, "a/../../x")).toThrow();
    expect(safeJoin(root, "a", "b.json").startsWith(root)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("path hardening routes", () => {
  let dir: string;
  let base: string;
  let token: string;
  let close: () => Promise<void>;
  const headers = () => ({ "x-mole-token": token, "content-type": "application/json" });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mole-paths-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MOLE_TOKEN_DIR = join(dir, ".mole");
    const mod = await import("./server.js");
    await mod.startServer(0, "127.0.0.1");
    token = readFileSync(join(dir, ".mole", "token"), "utf8");
    base = `http://127.0.0.1:${(mod.server.address() as AddressInfo).port}`;
    close = () => new Promise((resolve) => mod.server.close(() => resolve()));
  });
  afterAll(async () => {
    await close();
    rmSync(dir, { recursive: true, force: true });
  });

  const noPaths = (text: string) => {
    expect(text).not.toContain(dir);
    expect(text).not.toMatch(/[A-Za-z]:\\|\/tmp\/|\/Users\//);
  };
  const createProject = async (): Promise<string> => {
    const created = await (await fetch(`${base}/api/projects`, { method: "POST", headers: headers(), body: "{}" })).json() as Record<string, unknown>;
    return String(created.sessionId ?? created.projectId ?? created.id);
  };

  it("rejects traversal in ?revision= and the revision route with 400", async () => {
    const id = await createProject();
    for (const rev of ["../../index", "..%2F..%2Findex", "session-revision-../x", "x"]) {
      const r = await fetch(`${base}/api/projects/${id}?revision=${rev}`, { headers: headers() });
      const text = await r.text();
      expect(r.status).toBe(400);
      expect(JSON.parse(text).error.code).toBeTruthy();
      noPaths(text);
      const r2 = await fetch(`${base}/api/projects/${id}/revisions/${rev}`, { headers: headers() });
      expect(rev.includes("/") ? [400, 404] : [400]).toContain(r2.status);
      noPaths(await r2.text());
    }
    const missing = await fetch(`${base}/api/projects/${id}?revision=session-revision-abc`, { headers: headers() });
    expect(missing.status).toBe(404);
    noPaths(await missing.text());
  });

  it("rejects a forged rawStorageRef on save with 400", async () => {
    const id = await createProject();
    const sha = "a".repeat(64);
    const session = { sessionId: id, name: "x", objects: [{ objectId: "o1", scientificRevisionId: "r", stateOrder: ["s"], currentStateId: "s", loadResult: { structure: { scientificHash: "h" }, sourceArtifact: { sourceArtifactId: `source_upload_${sha}`, sha256: sha, byteLength: 1, rawStorageRef: "../../../etc/passwd" } } }], workspaceGroups: [], selections: [], results: [] };
    const r = await fetch(`${base}/api/projects/${id}`, { method: "PUT", headers: headers(), body: JSON.stringify({ session }) });
    const text = await r.text();
    expect(r.status).toBe(400);
    noPaths(text);
  });

  it("rejects a malformed project id with 400", async () => {
    const r = await fetch(`${base}/api/projects/..%2F..%2Fx`, { headers: headers() });
    expect(r.status).toBe(400);
    noPaths(await r.text());
  });
});
