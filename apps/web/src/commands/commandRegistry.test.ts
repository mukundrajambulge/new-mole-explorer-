import { describe, expect, it } from "vitest";
import { commandHelp, commandSuggestions, parseCommand } from "./commandRegistry";

describe("typed command registry boundary", () => {
  it("separates command head, domain, argument, and target from selection text", () => {
    const parsed = parseCommand("label active_site, {resn}{resi}:{name}");
    expect(parsed.error).toBeNull();
    expect(parsed.command).toMatchObject({ domain: "LABEL", verb: "label", argument: "active_site", target: "{resn}{resi}:{name}" });
  });
  it("returns explicit errors and deterministic autocomplete", () => {
    expect(parseCommand("wat do something").error?.code).toBe("UNKNOWN_COMMAND");
    expect(parseCommand("color").error?.code).toBe("MISSING_ARGUMENT");
    expect(commandSuggestions("sh")).toEqual(["show", "show_as"]);
    expect(commandSuggestions("select ")).toContain("chain");
    expect(commandSuggestions("group ")).toContain("create");
    expect(commandHelp("select")[0]?.domain).toBe("SELECTION");
    expect(parseCommand("rename active_site, binding_site").command).toMatchObject({ domain: "OBJECT", argument: "active_site", target: "binding_site" });
    expect(parseCommand("copy copied_object, source_object").command).toMatchObject({ domain: "OBJECT", verb: "copy", argument: "copied_object", target: "source_object" });
    expect(parseCommand("state 2, objectA").command).toMatchObject({ domain: "OBJECT", verb: "state", argument: "2", target: "objectA" });
    expect(parseCommand("group add protein-set, objectA").command).toMatchObject({ domain: "OBJECT", verb: "group", argument: "add protein-set", target: "objectA" });
  });
});
