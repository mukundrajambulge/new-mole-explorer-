import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";

const hostedEnv = { MOLE_MODE: "hosted", HOST: "127.0.0.1", ALLOWED_ORIGINS: "https://a.example" };

const withEnv = async (patch: Record<string, string>, run: () => Promise<void>) => {
  const saved = { ...process.env };
  Object.assign(process.env, patch);
  vi.resetModules();
  try {
    await run();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    vi.resetModules();
  }
};

describe("hosted mode and startup failures", () => {
  it("hosted refuses to start without a long MOLE_TOKEN", () => {
    expect(() => loadConfig(hostedEnv)).toThrow(/MOLE_TOKEN/);
    expect(() => loadConfig({ ...hostedEnv, MOLE_TOKEN: "short" })).toThrow(/MOLE_TOKEN/);
    expect(loadConfig({ ...hostedEnv, MOLE_TOKEN: "x".repeat(32) }).token).toBe("x".repeat(32));
  });

  it("hosted requires the token on every non-health request; EADDRINUSE rejects", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mole-hosted-"));
    const secret = "s".repeat(40);
    try {
      await withEnv({ ...hostedEnv, MOLE_TOKEN: secret, MOLECULAR_DATA_DIR: dir }, async () => {
        const mod = await import("./server.js");
        const blocker = createNetServer();
        await new Promise<void>((resolve) => blocker.listen(0, "127.0.0.1", resolve));
        await expect(mod.startServer((blocker.address() as AddressInfo).port, "127.0.0.1")).rejects.toThrow(/EADDRINUSE/);
        await new Promise<void>((resolve) => blocker.close(() => resolve()));
        await mod.startServer(0, "127.0.0.1");
        const port = (mod.server.address() as AddressInfo).port;
        const base = `http://127.0.0.1:${port}`;
        const noTok = await fetch(`${base}/api/projects`, { method: "POST", body: "{}" });
        expect(noTok.status).toBe(401);
        expect((await noTok.json()).error.code).toBe("TOKEN_REQUIRED");
        expect((await fetch(`${base}/api/bootstrap`, { headers: { "x-mole-token": "w".repeat(40) } })).status).toBe(401);
        expect((await fetch(`${base}/api/bootstrap`, { headers: { "x-mole-token": secret } })).status).toBe(200);
        expect((await fetch(`${base}/api/health`)).status).toBe(200);
        await new Promise<void>((resolve) => mod.server.close(() => resolve()));
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hosted mode refuses the docking job routes and reports the capability UNAVAILABLE even with FEATURE_DOCKING_RUN=1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mole-hosted-dock-"));
    const secret = "s".repeat(40);
    try {
      await withEnv({ ...hostedEnv, MOLE_TOKEN: secret, MOLECULAR_DATA_DIR: dir, FEATURE_DOCKING_RUN: "1" }, async () => {
        const mod = await import("./server.js");
        expect(mod.dockService).toBeUndefined();
        await mod.startServer(0, "127.0.0.1");
        const base = `http://127.0.0.1:${(mod.server.address() as AddressInfo).port}`;
        const headers = { "x-mole-token": secret };
        const list = await fetch(`${base}/api/docking/jobs`, { headers });
        expect(list.status).toBe(404);
        expect((await list.json()).error).toMatchObject({ code: "UNAVAILABLE", message: expect.stringMatching(/hosted mode.*accounts/) });
        const caps = await (await fetch(`${base}/api/docking/capabilities`, { headers })).json();
        expect(caps.VINA_COMPARATOR_PREVIEW).toMatchObject({ available: false, capability: "UNAVAILABLE" });
        const boot = await (await fetch(`${base}/api/bootstrap`, { headers })).json();
        expect(boot.capabilities.VINA_COMPARATOR_PREVIEW.state).toBe("UNAVAILABLE");
        await new Promise<void>((resolve) => mod.server.close(() => resolve()));
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("local startServer rejects when the token dir is unwritable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mole-badtok-"));
    writeFileSync(join(dir, "file"), "x");
    try {
      await withEnv({ MOLE_MODE: "local", MOLE_TOKEN_DIR: join(dir, "file", "sub"), MOLECULAR_DATA_DIR: dir }, async () => {
        const mod = await import("./server.js");
        await expect(mod.startServer(0, "127.0.0.1")).rejects.toThrow();
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("local EADDRINUSE leaves the existing token file untouched", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mole-keeptok-"));
    writeFileSync(join(dir, "token"), "original-token");
    try {
      await withEnv({ MOLE_MODE: "local", MOLE_TOKEN_DIR: dir, MOLECULAR_DATA_DIR: dir }, async () => {
        const mod = await import("./server.js");
        const blocker = createNetServer();
        await new Promise<void>((resolve) => blocker.listen(0, "127.0.0.1", resolve));
        await expect(mod.startServer((blocker.address() as AddressInfo).port, "127.0.0.1")).rejects.toThrow(/EADDRINUSE/);
        await new Promise<void>((resolve) => blocker.close(() => resolve()));
        expect(readFileSync(join(dir, "token"), "utf8")).toBe("original-token");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
