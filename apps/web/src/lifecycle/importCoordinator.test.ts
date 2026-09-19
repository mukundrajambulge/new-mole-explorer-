import { describe, expect, it } from "vitest";
import { LatestImportCoordinator } from "./importCoordinator";

describe("latest import coordinator", () => {
  it("aborts and invalidates the previous operation", () => {
    const coordinator = new LatestImportCoordinator();
    const first = coordinator.begin();
    const second = coordinator.begin();
    expect(first.signal.aborted).toBe(true);
    expect(coordinator.isCurrent(first)).toBe(false);
    expect(coordinator.isCurrent(second)).toBe(true);
  });
});
