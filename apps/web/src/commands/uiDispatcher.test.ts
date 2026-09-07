import { describe, expect, it } from "vitest";
import { createUiCanonicalCommand, dispatchUiCommand } from "./uiDispatcher";

describe("R10 UI canonical dispatcher boundary", () => {
  it("normalizes console and GUI-originated commands into the shared contract", () => {
    const command = createUiCanonicalCommand("select add, chain A and polymer");
    expect(command.commandType).toBe("SELECTION.EVALUATE");
    expect(command.normalizedArgs).toEqual({ operation: "add", query: "chain A and polymer" });
    expect(command.origin.surface).toBe("CONSOLE");
    expect(command.commandVersion).toBe("r10-command-registry.v1");
  });

  it("passes the canonical command to the one UI execution boundary", () => {
    const executed = dispatchUiCommand("zoom all", (command) => command.commandType, "GUI");
    expect(executed.result).toBe("VIEW.ZOOM");
    expect(executed.command.origin.surface).toBe("GUI");
  });
});
