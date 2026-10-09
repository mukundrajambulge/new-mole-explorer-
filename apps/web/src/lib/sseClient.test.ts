import { describe, expect, it } from "vitest";
import { createSseParser, readSse, type SseMessage } from "./sseClient";

const collect = (chunks: string[]) => {
  const out: SseMessage[] = [];
  const retries: number[] = [];
  const p = createSseParser((m) => out.push(m), (ms) => retries.push(ms));
  for (const c of chunks) p.push(c);
  return { out, retries, last: p.lastEventId() };
};

describe("SSE parser (fetch + ReadableStream)", () => {
  it("parses id/event/data, comments, retry and multi-line data across chunk splits", () => {
    const { out, retries, last } = collect(["retry: 2000\n\n: heartbeat\n\nid: 3\nev", "ent: status\ndata: {\"a\":1}\n\nid: 4\r", "\ndata: x\ndata: y\r\n\r\n"]);
    expect(retries).toEqual([2000]);
    expect(out).toEqual([{ id: "3", event: "status", data: "{\"a\":1}" }, { id: "4", event: "message", data: "x\ny" }]);
    expect(last).toBe("4");
  });
  it("does not dispatch an event without a blank line and caps runaway lines", () => {
    expect(collect(["data: partial"]).out).toEqual([]);
    const p = createSseParser(() => undefined);
    expect(() => p.push("x".repeat(300 * 1024))).toThrow(/too long/);
  });
  it("sends Last-Event-ID and reports non-2xx answers with the server message", async () => {
    let seen: string | null = null;
    const ok = (async (_u: string | URL | Request, init?: RequestInit) => {
      seen = new Headers(init?.headers).get("last-event-id");
      return new Response("id: 9\nevent: log\ndata: hi\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
    }) as typeof fetch;
    const got: SseMessage[] = [];
    expect(await readSse("http://x/e", (m) => got.push(m), { signal: new AbortController().signal, lastEventId: "8", fetchImpl: ok })).toBe("9");
    expect(seen).toBe("8");
    expect(got).toEqual([{ id: "9", event: "log", data: "hi" }]);
    const busy = (async () => new Response(JSON.stringify({ error: { code: "SSE_BUSY", message: "Too many event streams are open." } }), { status: 429 })) as typeof fetch;
    await expect(readSse("http://x/e", () => undefined, { signal: new AbortController().signal, fetchImpl: busy })).rejects.toMatchObject({ status: 429, message: expect.stringContaining("Too many") });
  });
});
