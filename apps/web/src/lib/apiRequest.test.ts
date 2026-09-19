import { describe, expect, it, vi } from "vitest";
import { ApiClientError, requestJson } from "./apiRequest";

describe("API request cancellation", () => {
  it("turns a stalled request into a typed timeout", async () => {
    const fetchMock = vi.fn((_input: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson("/api", "/health", {}, { timeoutMs: 5 })).rejects.toMatchObject({ kind: "TIMEOUT", status: 408 });
    vi.unstubAllGlobals();
  });

  it("turns an external abort into a typed cancellation", async () => {
    const fetchMock = vi.fn((_input: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const request = requestJson("/api", "/health", {}, { signal: controller.signal, timeoutMs: 1000 });
    controller.abort();
    await expect(request).rejects.toMatchObject({ kind: "ABORTED", status: 0 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(new ApiClientError(0, null, "cancelled", "ABORTED").kind).toBe("ABORTED");
    vi.unstubAllGlobals();
  });
});
