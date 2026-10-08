import { request as httpRequest } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";

describe("config", () => {
  it("defaults to local loopback", () => {
    const c = loadConfig({});
    expect(c.mode).toBe("local");
    expect(c.host).toBe("127.0.0.1");
  });
  it("refuses a non-loopback host in local mode", () => {
    expect(() => loadConfig({ HOST: "0.0.0.0" })).toThrow();
  });
  it("hosted requires explicit origins and rejects wildcard", () => {
    expect(() => loadConfig({ MOLE_MODE: "hosted", HOST: "0.0.0.0" })).toThrow();
    expect(() => loadConfig({ MOLE_MODE: "hosted", ALLOWED_ORIGINS: "*" })).toThrow();
    expect(loadConfig({ MOLE_MODE: "hosted", HOST: "0.0.0.0", ALLOWED_ORIGINS: "https://a.example", MOLE_TOKEN: "x".repeat(32) }).allowedOrigins).toEqual(["https://a.example"]);
  });
  it("defaults request size limits and bounds the upload cap", () => {
    const c = loadConfig({});
    expect(c.maxJsonBytes).toBe(8 * 1024 * 1024);
    expect(c.maxProjectJsonBytes).toBe(64 * 1024 * 1024);
    expect(c.maxUploadBytes).toBe(256 * 1024 * 1024);
    expect(c.maxConcurrentUploads).toBe(2);
    expect(() => loadConfig({ MAX_UPLOAD_BYTES: String(512 * 1024 * 1024) })).toThrow();
  });
  it("rejects bad numbers and modes", () => {
    expect(() => loadConfig({ API_PORT: "abc" })).toThrow();
    expect(() => loadConfig({ MOLE_MODE: "x" })).toThrow();
  });
  it("ignores the generic PORT in local mode but honours it in hosted mode", () => {
    expect(loadConfig({ PORT: "3101" }).port).toBe(8100);
    expect(loadConfig({ PORT: "3101", API_PORT: "8200" }).port).toBe(8200);
    expect(loadConfig({ MOLE_MODE: "hosted", HOST: "0.0.0.0", ALLOWED_ORIGINS: "https://a.example", MOLE_TOKEN: "x".repeat(32), PORT: "9000" }).port).toBe(9000);
  });
});

describe("api routes", () => {
  let dir: string;
  let base: string;
  let close: () => Promise<void>;
  let token: string;
  const auth = (extra: Record<string, string> = {}) => ({ "x-mole-token": token, ...extra });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mole-api-"));
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

  it("binds to loopback only", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
  });
  it("returns structured 404", async () => {
    const res = await fetch(`${base}/api/nope`, { headers: auth() });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });
  it("reflects only allowed origins and rejects others", async () => {
    const ok = await fetch(`${base}/api/health`, { headers: { origin: "http://localhost:3101" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:3101");
    const bad = await fetch(`${base}/api/health`, { headers: { origin: "http://evil.example" } });
    expect(bad.status).toBe(403);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    expect((await bad.json()).error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
  it("rejects foreign Host headers in local mode (DNS rebinding)", async () => {
    const port = Number(new URL(base).port);
    const get = (host: string) => new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = httpRequest({ host: "127.0.0.1", port, path: "/api/health", headers: { host } }, (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
      req.end();
    });
    const bad = await get(`rebind.evil.example:${port}`);
    expect(bad.status).toBe(403);
    expect(JSON.parse(bad.body).error.code).toBe("HOST_NOT_ALLOWED");
    expect((await get(`localhost:${port + 1}`)).status).toBe(403);
    expect((await get(`localhost:${port}`)).status).toBe(200);
  });
  it("caps JSON bodies before buffering", async () => {
    const res = await fetch(`${base}/api/projects`, { method: "POST", headers: auth({ "content-type": "application/json" }), body: JSON.stringify({ name: "x".repeat(9 * 1024 * 1024) }) });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });
  it("returns structured error for invalid JSON", async () => {
    const res = await fetch(`${base}/api/projects`, { method: "POST", headers: auth(), body: "{nope" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_INPUT");
  });
  it("requires the local token except for health", async () => {
    const none = await fetch(`${base}/api/bootstrap`);
    expect(none.status).toBe(401);
    expect((await none.json()).error.code).toBe("TOKEN_REQUIRED");
    expect((await fetch(`${base}/api/bootstrap`, { headers: { "x-mole-token": "wrong" } })).status).toBe(401);
    expect((await fetch(`${base}/api/projects`, { method: "POST", body: "{}" })).status).toBe(401);
    expect((await fetch(`${base}/api/bootstrap`, { headers: auth() })).status).toBe(200);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
  it("blocks a foreign origin even with a valid token, for state-changing requests too", async () => {
    const res = await fetch(`${base}/api/projects`, { method: "POST", headers: auth({ origin: "http://evil.example", "content-type": "application/json" }), body: "{}" });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const put = await fetch(`${base}/api/projects/abc`, { method: "PUT", headers: auth({ origin: "null" }), body: "{}" });
    expect(put.status).toBe(403);
  });
  it("answers preflight for allowed origins only, with Vary: Origin", async () => {
    const ok = await fetch(`${base}/api/projects`, { method: "OPTIONS", headers: { origin: "http://localhost:3101" } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("vary")).toMatch(/origin/i);
    expect(ok.headers.get("access-control-allow-headers")).toContain("x-mole-token");
    expect((await fetch(`${base}/api/projects`, { method: "OPTIONS", headers: { origin: "http://evil.example" } })).status).toBe(403);
  });

  it("answers 500 when serialization throws and keeps serving", async () => {
    const real = JSON.stringify;
    const spy = vi.spyOn(JSON, "stringify").mockImplementationOnce(() => { throw new Error("boom"); });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const bad = await fetch(`${base}/api/health`);
      expect(bad.status).toBe(500);
      expect((await bad.json() as { error: { code: string } }).error.code).toBe("INTERNAL_ERROR");
      const ok = await fetch(`${base}/api/health`);
      expect(ok.status).toBe(200);
    } finally {
      spy.mockRestore();
      vi.restoreAllMocks();
      expect(JSON.stringify).toBe(real);
    }
  });
});
