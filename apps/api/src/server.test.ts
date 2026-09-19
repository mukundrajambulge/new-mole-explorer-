import { afterEach, describe, expect, it } from "vitest";
import { request as httpRequest } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiServer } from "./server.js";
import { MAX_JSON_BODY_BYTES } from "./http/body.js";

const servers: Array<ReturnType<typeof createApiServer>> = [];
const roots: string[] = [];

const listen = async (server: ReturnType<typeof createApiServer>): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test server did not expose a TCP address.");
  return `http://127.0.0.1:${address.port}`;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("API transport boundary", () => {
  it("binds the explicit loopback address and rejects unexpected origins", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-api-server-")); roots.push(root);
    const server = createApiServer({ dataRoot: root, allowedOrigins: ["http://localhost:3101"] });
    const base = await listen(server);
    const address = server.address();
    expect(address && typeof address !== "string" ? address.address : address).toBe("127.0.0.1");
    const allowed = await fetch(`${base}/api/health`, { headers: { origin: "http://localhost:3101" } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:3101");
    const rejected = await fetch(`${base}/api/health`, { headers: { origin: "http://evil.example" } });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects an oversized JSON request before buffering it", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-api-body-")); roots.push(root);
    const server = createApiServer({ dataRoot: root });
    const base = await listen(server);
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = httpRequest(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json", "content-length": String(MAX_JSON_BODY_BYTES + 1) } }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        incoming.on("end", () => resolve({ status: incoming.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      });
      request.on("error", reject);
      request.end("{}");
    });
    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
  });
});
