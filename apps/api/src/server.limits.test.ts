import { createHash } from "node:crypto";
import { request as httpRequest, type ClientRequest } from "node:http";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIB = 1024 * 1024;
const BOUNDARY = "----mole-limits-test";

type Reply = { status: number; body: string };

describe("request size limits", () => {
  let dir: string;
  let port: number;
  let token: string;
  let close: () => Promise<void>;
  const uploadDir = () => join(dir, "tmp", "uploads");
  const pending = () => (existsSync(uploadDir()) ? readdirSync(uploadDir()).length : 0);

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mole-api-limits-"));
    process.env.MOLECULAR_DATA_DIR = dir;
    process.env.MOLE_TOKEN_DIR = join(dir, ".mole");
    delete process.env.MAX_JSON_BYTES;
    delete process.env.MAX_UPLOAD_BYTES;
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

  /** Raw request so the test controls framing (declared length vs chunked) and never buffers the body itself. */
  const send = (options: { method: string; path: string; headers?: Record<string, string | number>; head?: Buffer; bodyBytes?: number; tail?: Buffer; fill?: number; hold?: boolean }) => {
    let req!: ClientRequest;
    const reply = new Promise<Reply>((resolve, reject) => {
      req = httpRequest({ host: "127.0.0.1", port, method: options.method, path: options.path, headers: { "x-mole-token": token, ...options.headers } }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      let answered = false;
      req.on("response", () => { answered = true; });
      req.on("error", (error) => { if (!answered) reject(error); });
      const chunk = Buffer.alloc(MIB, options.fill ?? 0x20);
      let left = options.bodyBytes ?? 0;
      const pump = () => {
        while (left > 0 && !answered && !req.destroyed) {
          const piece = left >= chunk.length ? chunk : chunk.subarray(0, left);
          left -= piece.length;
          if (!req.write(piece)) { req.once("drain", pump); return; }
        }
        if (left === 0 && !answered && !req.destroyed) {
          if (options.tail) req.write(options.tail);
          if (!options.hold) req.end();
        }
      };
      if (options.head) req.write(options.head);
      pump();
    });
    return { reply, abort: () => req.destroy() };
  };

  const upload = (filename: string, bytes: number, extra: { declare?: boolean; fill?: number; hold?: boolean } = {}) => {
    const head = Buffer.from(`--${BOUNDARY}\r\ncontent-disposition: form-data; name="file"; filename="${filename}"\r\ncontent-type: application/octet-stream\r\n\r\n`);
    const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
    const headers: Record<string, string | number> = { "content-type": `multipart/form-data; boundary=${BOUNDARY}` };
    if (extra.declare) headers["content-length"] = head.length + bytes + tail.length;
    return send({ method: "POST", path: "/api/structures/upload", headers, head, bodyBytes: bytes, tail, fill: extra.fill, hold: extra.hold });
  };

  const waitFor = async (condition: () => boolean, timeoutMs = 10_000) => {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeoutMs) throw new Error("timed out");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const code = (reply: Reply) => (JSON.parse(reply.body) as { error: { code: string } }).error.code;

  it("rejects a 9 MB JSON body with 413, declared or streamed", async () => {
    const declared = await send({ method: "POST", path: "/api/projects", headers: { "content-type": "application/json", "content-length": 9 * MIB }, bodyBytes: 9 * MIB }).reply;
    expect(declared.status).toBe(413);
    expect(code(declared)).toBe("PAYLOAD_TOO_LARGE");
    const chunked = await send({ method: "POST", path: "/api/commands", headers: { "content-type": "application/json" }, bodyBytes: 9 * MIB }).reply;
    expect(chunked.status).toBe(413);
    expect(code(chunked)).toBe("PAYLOAD_TOO_LARGE");
    // The connection stays usable afterwards.
    const ok = await send({ method: "POST", path: "/api/projects", headers: { "content-type": "application/json" }, head: Buffer.from("{\"name\":\"after\"}") }).reply;
    expect(ok.status).toBe(201);
  }, 30_000);

  it("allows project saves up to the larger 64 MB cap", async () => {
    const created = await send({ method: "POST", path: "/api/projects", headers: { "content-type": "application/json" }, head: Buffer.from("{}") }).reply;
    const id = (JSON.parse(created.body) as { id: string }).id;
    // 9 MB of unterminated JSON: past the size gate, so the parser (not the cap) rejects it.
    const saved = await send({ method: "PUT", path: `/api/projects/${encodeURIComponent(id)}`, headers: { "content-type": "application/json" }, head: Buffer.from("{\"pad\":\""), bodyBytes: 9 * MIB, fill: 0x78 }).reply;
    expect(saved.status).toBe(400);
    expect(code(saved)).toBe("INVALID_INPUT");
    const huge = await send({ method: "PUT", path: `/api/projects/${encodeURIComponent(id)}`, headers: { "content-type": "application/json" }, bodyBytes: 65 * MIB }).reply;
    expect(huge.status).toBe(413);
  }, 30_000);

  it("ingests a real fixture uploaded as a stream and removes the temp file", async () => {
    const fixture = readFileSync(join(process.cwd(), "..", "..", "tests", "fixtures", "mini-protein.pdb"));
    const head = Buffer.from(`--${BOUNDARY}\r\ncontent-disposition: form-data; name="file"; filename="mini-protein.pdb"\r\n\r\n`);
    const body = Buffer.concat([head, fixture, Buffer.from(`\r\n--${BOUNDARY}--\r\n`)]);
    const res = await send({ method: "POST", path: "/api/structures/upload", headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` }, head: body }).reply;
    expect(res.status).toBe(200);
    const result = JSON.parse(res.body) as { sourceArtifact?: { byteLength?: number; sha256?: string } };
    // The streamed temp file holds exactly the uploaded bytes.
    expect(result.sourceArtifact?.byteLength).toBe(fixture.length);
    expect(result.sourceArtifact?.sha256).toContain(createHash("sha256").update(fixture).digest("hex"));
    expect(pending()).toBe(0);
  }, 30_000);

  it("rejects malformed multipart without leaving files behind", async () => {
    const noBoundary = await send({ method: "POST", path: "/api/structures/upload", headers: { "content-type": "multipart/form-data" }, head: Buffer.from("x") }).reply;
    expect(noBoundary.status).toBe(400);
    const truncated = await send({ method: "POST", path: "/api/structures/upload", headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` }, head: Buffer.from(`--${BOUNDARY}\r\ncontent-disposition: form-data; name="file"; filename="a.pdb"\r\n\r\nATOM`) }).reply;
    expect(truncated.status).toBe(400);
    expect(code(truncated)).toBe("INVALID_INPUT");
    expect(pending()).toBe(0);
  });

  it("rejects a 300 MB upload with 413, declared or streamed, and cleans up", async () => {
    const declared = await upload("big.pdb", 300 * MIB, { declare: true }).reply;
    expect(declared.status).toBe(413);
    expect(code(declared)).toBe("PAYLOAD_TOO_LARGE");
    const streamed = await upload("big.pdb", 300 * MIB).reply;
    expect(streamed.status).toBe(413);
    expect(code(streamed)).toBe("PAYLOAD_TOO_LARGE");
    expect(JSON.parse(streamed.body).error.message).not.toMatch(/[\\/]/);
    await waitFor(() => pending() === 0);
  }, 120_000);

  it("allows two uploads at a time and answers 429 for a third", async () => {
    const first = upload("a.pdb", 2 * MIB, { hold: true });
    const second = upload("b.pdb", 2 * MIB, { hold: true });
    await waitFor(() => pending() === 2);
    const third = await upload("c.pdb", 1024).reply;
    expect(third.status).toBe(429);
    expect(code(third)).toBe("TOO_MANY_UPLOADS");
    first.abort();
    second.abort();
    await Promise.allSettled([first.reply, second.reply]);
    await waitFor(() => pending() === 0);
    // Slots are released after aborted uploads.
    const after = await upload("d.pdb", 1024, { fill: 0 }).reply;
    expect(after.status).toBe(400);
    expect(code(after)).toBe("UNSUPPORTED_FORMAT");
  }, 30_000);

  it("keeps server memory under 1 GB while two 200 MB uploads stream", async () => {
    let peak = process.memoryUsage().rss;
    const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 25);
    try {
      const replies = await Promise.all([upload("one.pdb", 200 * MIB, { fill: 0, declare: true }).reply, upload("two.pdb", 200 * MIB, { fill: 0 }).reply]);
      for (const reply of replies) {
        expect(reply.status).toBe(400);
        expect(code(reply)).toBe("UNSUPPORTED_FORMAT");
      }
    } finally {
      clearInterval(timer);
    }
    peak = Math.max(peak, process.memoryUsage().rss);
    expect(peak).toBeLessThan(1024 * MIB);
    await waitFor(() => pending() === 0);
  }, 180_000);
});
