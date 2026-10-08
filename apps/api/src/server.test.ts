import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
    expect(loadConfig({ MOLE_MODE: "hosted", HOST: "0.0.0.0", ALLOWED_ORIGINS: "https://a.example" }).allowedOrigins).toEqual(["https://a.example"]);
  });
  it("rejects bad numbers and modes", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow();
    expect(() => loadConfig({ MOLE_MODE: "x" })).toThrow();
  });
});

describe("api routes", () => {
  let dir: string;
  let base: string;
  let close: () => Promise<void>;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mole-api-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MAX_JSON_BYTES = "2048";
    const mod = await import("./server.js");
    await mod.startServer(0, "127.0.0.1");
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
    const res = await fetch(`${base}/api/nope`);
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
  it("caps JSON bodies before buffering", async () => {
    const res = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "x".repeat(5000) }) });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });
  it("returns structured error for invalid JSON", async () => {
    const res = await fetch(`${base}/api/projects`, { method: "POST", body: "{nope" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_INPUT");
  });
});
