import { describe, expect, it } from "vitest";
import { ACTION_IDS, ACTION_REGISTRY } from "./registry";

describe("G1B action registry", () => {
  it("provides a capability for every canonical action", () => {
    for (const actionId of Object.values(ACTION_IDS)) {
      expect(ACTION_REGISTRY[actionId]).toMatchObject({ id: actionId });
      expect(["SUPPORTED", "EXPERIMENTAL", "COMING_SOON", "UNAVAILABLE"]).toContain(ACTION_REGISTRY[actionId].state);
    }
  });

  it("does not expose a false implementation for science-owned actions", () => {
    expect(ACTION_REGISTRY["EDIT.ATOM_DELETE"].state).toBe("UNAVAILABLE");
    expect(ACTION_REGISTRY["DOCKING.RUN"].state).toBe("UNAVAILABLE");
    expect(ACTION_REGISTRY["MEASURE.DISTANCE"].state).toBe("COMING_SOON");
  });
});
