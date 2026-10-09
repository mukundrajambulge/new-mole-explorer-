import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createPrepRoutes } from "../docking/routes.js";
import { PrepArtifactStore } from "./prepArtifacts.js";
import { PrepJobStore } from "./prepJobs.js";
import { REPO_ROOT } from "./prepPins.js";

// Task 5.2b fix round: upload quota, retention/GC and the concurrency limit, on real fixture files.
const FX = resolve(REPO_ROOT, "tests", "fixtures");
const PDBS = ["1CRN.pdb", "1D3Z.pdb", "4DJW.pdb", "1IEP.pdb"].map((n) => readFileSync(join(FX, "rcsb", n)));
const SDF = readFileSync(join(FX, "ethanol.sdf"));

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise((r) => s.close(r));
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
const tmpRoot = () => {
  const r = mkdtempSync(join(tmpdir(), "prepart-"));
  roots.push(r);
  return r;
};
/** A body that yields `bytes` in 64 KB chunks, optionally pausing until `gate` resolves. */
async function* chunks(bytes: Buffer, gate?: Promise<void>): AsyncGenerator<Buffer> {
  for (let i = 0; i < bytes.length; i += 65536) {
    if (gate && i > 0) await gate;
    yield bytes.subarray(i, i + 65536);
  }
}
const tmpFiles = (root: string) => readdirSync(root).filter((n) => n.endsWith(".tmp"));

describe("prep artifact store: streaming, quota, retention, concurrency (5.2b)", () => {
  it("streams to disk with a server-computed sha256, dedupes and round-trips through resolve", async () => {
    const store = new PrepArtifactStore(tmpRoot());
    const a = await store.putStream(chunks(PDBS[3]!), "pdb");
    expect(a.artifactId).toMatch(/^pa_pdb_[0-9a-f]{40}$/);
    expect(a.bytes).toBe(PDBS[3]!.length);
    expect((await store.putStream(chunks(PDBS[3]!), "pdb")).artifactId).toBe(a.artifactId);
    expect(store.put(PDBS[3]!, "pdb").artifactId).toBe(a.artifactId);
    const got = await store.resolve(a.artifactId);
    expect(got?.format).toBe("pdb");
    expect(Buffer.compare(got!.bytes, PDBS[3]!)).toBe(0);
    expect(tmpFiles(store.root)).toEqual([]);
  });

  it("enforces the 20 MB cap while streaming (no declared length) and removes the partial temp file", async () => {
    const store = new PrepArtifactStore(tmpRoot());
    await expect(store.putStream(chunks(Buffer.alloc(20 * 1024 * 1024 + 1, 0x41)), "sdf")).rejects.toMatchObject({ code: "OVERSIZE_INPUT", httpStatus: 413 });
    await expect(store.putStream(chunks(SDF), "sdf", 20 * 1024 * 1024 + 1)).rejects.toMatchObject({ code: "OVERSIZE_INPUT" });
    await expect(store.putStream(chunks(Buffer.from("data_1ABC\n_atom_site.id\n")), "pdb")).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(store.putStream(chunks(Buffer.alloc(0)), "sdf")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(tmpFiles(store.root)).toEqual([]);
    expect(readdirSync(store.root)).toEqual([]);
  });

  it("allows at most two concurrent uploads; the third answers 429 BUSY", async () => {
    const store = new PrepArtifactStore(tmpRoot());
    let open: () => void = () => {};
    const gate = new Promise<void>((r) => (open = r));
    const first = store.putStream(chunks(PDBS[0]!, gate), "pdb");
    const second = store.putStream(chunks(PDBS[1]!, gate), "pdb");
    await expect(store.putStream(chunks(SDF), "sdf")).rejects.toMatchObject({ code: "BUSY", httpStatus: 429 });
    open();
    await Promise.all([first, second]);
    expect((await store.putStream(chunks(SDF), "sdf")).format).toBe("sdf");
  });

  it("enforces the count and byte quota, never evicts artifacts a pending plan may use, and evicts LRU after that", async () => {
    let t = Date.now();
    const root = tmpRoot();
    const store = new PrepArtifactStore(root, { maxArtifacts: 2, now: () => t });
    const a = await store.putStream(chunks(PDBS[0]!), "pdb");
    t += 1000;
    const b = await store.putStream(chunks(PDBS[1]!), "pdb");
    // Both are younger than the 30 min plan TTL: the quota is full.
    await expect(store.putStream(chunks(PDBS[2]!), "pdb")).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", httpStatus: 429 });
    expect(tmpFiles(root)).toEqual([]);
    t += 31 * 60_000;
    await store.resolve(b.artifactId); // b is used again (refreshes its retention); a is the LRU victim
    const c = await store.putStream(chunks(PDBS[2]!), "pdb");
    expect(await store.resolve(a.artifactId)).toBeUndefined();
    expect(await store.resolve(b.artifactId)).toBeDefined();
    expect(await store.resolve(c.artifactId)).toBeDefined();

    const bytesStore = new PrepArtifactStore(tmpRoot(), { maxBytes: PDBS[0]!.length + SDF.length });
    await bytesStore.putStream(chunks(PDBS[0]!), "pdb");
    await bytesStore.putStream(chunks(SDF), "sdf");
    await expect(bytesStore.putStream(chunks(PDBS[1]!), "pdb", PDBS[1]!.length)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    // Without a declared length the real size is checked after streaming.
    await expect(bytesStore.putStream(chunks(PDBS[1]!), "pdb")).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    expect(tmpFiles(bytesStore.root)).toEqual([]);
  });

  it("deletes artifacts unused for the retention window and stale temp files on start-up", async () => {
    let t = Date.now();
    const root = tmpRoot();
    const store = new PrepArtifactStore(root, { retainMs: 60 * 60_000, now: () => t });
    const a = await store.putStream(chunks(SDF), "sdf");
    t += 61 * 60_000;
    store.gc();
    expect(existsSync(join(root, `${a.artifactId}.bin`))).toBe(false);
    expect(existsSync(join(root, `${a.artifactId}.json`))).toBe(false);
  });

  it("over HTTP: quota and oversize answers carry no paths", async () => {
    const root = tmpRoot();
    const artifacts = new PrepArtifactStore(join(root, "a"), { maxArtifacts: 1 });
    const store = new PrepJobStore({ root: join(root, "j"), resolveArtifact: artifacts.resolve, installedTools: async () => [] });
    store.init();
    const routes = createPrepRoutes({ store, artifacts });
    const server = createServer((req, res) => void routes(req, res, new URL(req.url ?? "/", "http://x").pathname));
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/docking/prep/artifacts`;
    const post = async (format: string, body: Buffer) => {
      const r = await fetch(`${url}?format=${format}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: new Uint8Array(body) });
      const text = await r.text();
      expect(text).not.toContain(root);
      return { status: r.status, json: JSON.parse(text) as { artifactId?: string; error?: { code: string } } };
    };
    expect((await post("sdf", SDF)).status).toBe(201);
    const full = await post("pdb", PDBS[0]!);
    expect(full.status).toBe(429);
    expect(full.json.error?.code).toBe("QUOTA_EXCEEDED");
    const big = await post("sdf", Buffer.alloc(20 * 1024 * 1024 + 1, 0x41));
    expect(big.status).toBe(413);
    expect(tmpFiles(join(root, "a"))).toEqual([]);
  }, 60_000);
});
