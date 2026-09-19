import { describe, expect, it } from "vitest";
import { RenderGeneration } from "./renderGeneration";

describe("renderer generation", () => {
  it("rejects a stale continuation after a newer load or clear", () => {
    const generations = new RenderGeneration();
    const first = generations.next();
    const second = generations.next();
    expect(generations.isCurrent(first)).toBe(false);
    expect(generations.isCurrent(second)).toBe(true);
    generations.invalidate();
    expect(generations.isCurrent(second)).toBe(false);
  });
});
