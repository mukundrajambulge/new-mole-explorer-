import { describe, expect, it } from "vitest";
import { COMMAND_SPECS, RESERVED_FUTURE_COMMAND_FAMILIES, commandInventorySummary, commandSpecFor, resolveCommand, validateCommandRegistry } from "./registry.js";
import { PYMOL_INVENTORY, PYMOL_SOURCE_COMMIT } from "./pymolInventory.js";

describe("R10 versioned command registry", () => {
  it("validates deterministic names, aliases and the pinned source inventory", () => {
    expect(validateCommandRegistry()).toEqual([]);
    expect(PYMOL_SOURCE_COMMIT).toBe("5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69");
    expect(PYMOL_INVENTORY.length).toBe(345);
    expect(commandInventorySummary().sourceKeywordCount).toBe(PYMOL_INVENTORY.length);
    expect(COMMAND_SPECS.length).toBeGreaterThanOrEqual(PYMOL_INVENTORY.length);
  });

  it("maps aliases to the same canonical type and exposes explicit unsafe entries", () => {
    expect(resolveCommand("as")).toMatchObject({ spec: { canonicalName: "show_as", commandType: "REPRESENTATION.SHOW_AS" } });
    expect(resolveCommand("colour")).toMatchObject({ spec: { canonicalName: "color", commandType: "COLOR.APPLY" } });
    expect(resolveCommand("python")).toMatchObject({ spec: { safetyClass: "UNSAFE_REJECTED" } });
  });

  it("keeps the recognized CE alignment command unavailable at runtime", () => {
    expect(PYMOL_INVENTORY.find((entry) => entry.publicName === "cealign")).toMatchObject({ disposition: "SAFE_BUT_NOT_IMPLEMENTED", capabilityState: "UNAVAILABLE" });
    expect(commandSpecFor("cealign")).toMatchObject({ capabilityState: "UNAVAILABLE", handlerKey: "analysis.cealign" });
  });

  it("emits typed binding indexes for command specs", () => {
    expect(commandSpecFor("state")?.objectFields).toEqual(["object"]);
    expect(commandSpecFor("state")?.stateFields).toEqual(["state"]);
    expect(commandSpecFor("select")?.selectionFields).toEqual(["query"]);
    expect(commandSpecFor("set")?.settingFields).toEqual(["name", "scope", "targetId"]);
  });

  it("reserves future docking and HTS namespaces without admitting execution", () => {
    expect(RESERVED_FUTURE_COMMAND_FAMILIES.docking).toContain("DOCKING.RUN");
    expect(resolveCommand("docking.run")).toMatchObject({ error: "UNKNOWN_COMMAND" });
  });
});
