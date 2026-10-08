import { describe, expect, it, vi } from "vitest";
import { createHoverStore } from "./hoverStore";

describe("hoverStore", () => {
  it("notifies subscribers only on change and supports unsubscribe", () => {
    const store = createHoverStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set("a");
    store.set("a");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe("a");
    off();
    store.set(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
