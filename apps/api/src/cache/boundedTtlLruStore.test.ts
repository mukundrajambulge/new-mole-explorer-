import { describe, expect, it, vi } from "vitest";
import { BoundedTtlLruStore } from "./boundedTtlLruStore.js";

describe("bounded TTL/LRU store", () => {
  it("evicts the least recently used entry by count", () => {
    const store = new BoundedTtlLruStore<string, string>({ maxEntries: 2, maxBytes: 100, ttlMs: 1000, sizeOf: (value) => value.length });
    store.set("a", "a"); store.set("b", "b");
    expect(store.get("a")).toBe("a");
    store.set("c", "c");
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")).toBe("a");
    expect(store.get("c")).toBe("c");
  });

  it("evicts by byte budget and refuses an entry larger than the budget", () => {
    const store = new BoundedTtlLruStore<string, string>({ maxEntries: 10, maxBytes: 5, ttlMs: 1000, sizeOf: (value) => value.length });
    expect(store.set("a", "1234")).toBe(true);
    expect(store.set("b", "12")).toBe(true);
    expect(store.get("a")).toBeUndefined();
    expect(store.set("too-large", "123456")).toBe(false);
    expect(store.get("too-large")).toBeUndefined();
  });

  it("expires entries after the configured TTL", () => {
    vi.useFakeTimers();
    try {
      const store = new BoundedTtlLruStore<string, string>({ maxEntries: 2, maxBytes: 100, ttlMs: 1000, sizeOf: (value) => value.length });
      store.set("a", "a");
      vi.advanceTimersByTime(1001);
      expect(store.get("a")).toBeUndefined();
      expect(store.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
