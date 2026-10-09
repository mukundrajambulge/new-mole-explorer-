import { request as httpRequest } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Reply = { status: number; body: string };

describe("request validation fuzz", () => {
  let dir: string;
  let port: number;
  let token: string;
  let close: () => Promise<void>;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mole-api-validation-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MOLE_TOKEN_DIR = join(dir, ".mole");
    const mod = await import("./server.js");
    await mod.startServer(0, "127.0.0.1");
    token = readFileSync(join(dir, ".mole", "token"), "utf8");
    port = (mod.server.address() as AddressInfo).port;
    close = () => new Promise((resolve) => mod.server.close(() => resolve()));
  });
  afterAll(async () => {
    await close();
    rmSync(dir, { recursive: true, force: true });
  });

  const send = (method: string, path: string, body?: string | Buffer, headers: Record<string, string> = {}) =>
    new Promise<Reply>((resolve, reject) => {
      const req = httpRequest({ host: "127.0.0.1", port, method, path, headers: { "x-mole-token": token, ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers } }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text }));
      });
      req.on("error", reject);
      req.end(body);
    });

  const bodies: (string | undefined)[] = [
    undefined, "", "null", "[]", "[1,2]", "42", "\"text\"", "true", "{", "{}", "{\"a\":",
    JSON.stringify({ name: 42 }), JSON.stringify({ name: null }), JSON.stringify({ name: "x".repeat(100_000) }),
    JSON.stringify({ rawCommand: 5 }), JSON.stringify({ rawCommand: "x".repeat(200_000) }), JSON.stringify({ command: "nope" }), JSON.stringify({ command: {} }),
    JSON.stringify({ command: { commandType: "x", origin: null } }), JSON.stringify({ commandType: "x" }), JSON.stringify({ requestedMode: ["SYNC"] }),
    JSON.stringify({ pdbId: 1 }), JSON.stringify({ pdbId: null }), JSON.stringify({ pdbId: "../../etc/passwd" }), JSON.stringify({ pdbId: "9".repeat(50_000) }),
    JSON.stringify({ structure: null }), JSON.stringify({ structure: [] }), JSON.stringify({ structure: {} }), JSON.stringify({ structure: { atoms: 5 }, sourceArtifact: [] }),
    JSON.stringify({ input: [] }), JSON.stringify({ input: {} }), JSON.stringify({ input: { center: "a", size: null } }),
    JSON.stringify({ presentation: null }), JSON.stringify({ presentation: {}, structure: 5 }), JSON.stringify({ session: {} }), JSON.stringify({ session: { objects: [null] } }),
    JSON.stringify({ session: { objects: [], workspaceGroups: [], selections: [], results: [], sceneCollection: {} } }),
    JSON.stringify({ presentation: {}, expectedRevision: "1" }), JSON.stringify({ mode: 7 }), JSON.stringify({ __proto__: { x: 1 }, constructor: 1 }),
  ];
  const pathIds = ["x", "%", "%E0%A4%A", "%zz", "..", "%2e%2e%2f%2e%2e", "project_%00", "project_abc", `project_${"a".repeat(5000)}`, "job:%ff", "C:%5Cwindows"];
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

  const paths = (): string[] => {
    const fixed = [
      "/api/health", "/api/bootstrap", "/api/commands/registry", "/api/v1/commands/registry", "/api/commands/history", "/api/docking/d2/adapt", "/api/docking/d2/search-region",
      "/api/commands/batch", "/api/commands", "/api/v1/commands/execute", "/api/structures/upload", "/api/structures/rcsb", "/api/projects", "/nope", "//", "/api/%", "/api/%zz/%",
    ];
    const dynamic = pathIds.flatMap((id) => [
      `/api/commands/history/${id}/replay`, `/api/commands/jobs/${id}`, `/api/commands/jobs/${id}/cancel`, `/api/commands/jobs/${id}/retry`,
      `/api/projects/${id}`, `/api/projects/${id}/revisions`, `/api/projects/${id}/revisions/${id}`, `/api/projects/${id}?revision=${id}`, `/api/projects/project_abc?revision=%`,
    ]);
    return [...fixed, ...dynamic];
  };

  it("never answers 500 or crashes for malformed bodies, paths and queries", async () => {
    const failures: string[] = [];
    let count = 0;
    for (const path of paths()) {
      for (const method of methods) {
        const candidates = method === "GET" || method === "DELETE" ? [undefined] : bodies;
        for (const body of candidates) {
          if (path === "/api/structures/upload" && body !== undefined && body.length > 100_000) continue;
          const reply = await send(method, path, body).catch((error: Error) => ({ status: -1, body: error.message }));
          count += 1;
          if (reply.status === 500 || reply.status === -1) failures.push(`${method} ${path.slice(0, 60)} ${(body ?? "").slice(0, 40)} -> ${reply.status} ${reply.body.slice(0, 100)}`);
          // 422 is a FAILED CommandResult (diagnostics), not a request-shape error.
          if (reply.status >= 400 && reply.status !== 422) {
            const parsed = JSON.parse(reply.body) as { error: { code: string; message: string } };
            if (!parsed.error) { failures.push(`${method} ${path.slice(0, 60)} no error shape: ${reply.body.slice(0, 100)}`); continue; }
            expect(typeof parsed.error.code).toBe("string");
            expect(parsed.error.message.length).toBeLessThan(400);
            expect(parsed.error.message).not.toMatch(/[A-Za-z]:\\|\/Users\/|\/tmp\//);
          }
        }
      }
    }
    expect(count).toBeGreaterThan(1000);
    expect(failures).toEqual([]);
    // The server is still up.
    expect((await send("GET", "/api/health")).status).toBe(200);
  }, 120_000);

  it("answers 400 with the standard error shape for broken escapes and wrong types", async () => {
    const escape = await send("GET", "/api/projects/%E0%A4%A");
    expect(escape.status).toBe(400);
    expect(JSON.parse(escape.body).error.code).toBe("INVALID_INPUT");
    expect((await send("GET", "/api/commands/jobs/%")).status).toBe(400);
    expect((await send("GET", "/api/projects/project_abc?revision=%zz")).status).toBe(400);
    expect((await send("POST", "/api/projects", "[]")).status).toBe(400);
    expect((await send("POST", "/api/projects", "null")).status).toBe(400);
    expect((await send("POST", "/api/projects", JSON.stringify({ name: 5 }))).status).toBe(400);
    expect((await send("POST", "/api/structures/rcsb", JSON.stringify({}))).status).toBe(400);
    expect((await send("POST", "/api/commands/batch", JSON.stringify({ rawCommand: 1 }))).status).toBe(400);
    const huge = await send("POST", "/api/projects", JSON.stringify({ name: "x".repeat(50_000) }));
    expect(huge.status).toBe(400);
    expect(huge.body.length).toBeLessThan(400);
    const created = await send("POST", "/api/projects", JSON.stringify({ name: "ok" }));
    expect(created.status).toBe(201);
  });
});
