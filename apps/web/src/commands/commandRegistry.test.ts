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
    expect(parseCommand("coordinate_frame local_scientific").command).toMatchObject({ domain: "SELECTION", verb: "coordinate_frame", argument: "local_scientific", target: null });
    expect(parseCommand("set ribbon_color, red, polymer").command).toMatchObject({ domain: "PRESENTATION", verb: "set", argument: "ribbon_color", target: "red, polymer" });
    expect(commandSuggestions("set ")).toEqual(["cartoon_color", "ribbon_color"]);
    expect(commandSuggestions("coordinate_frame ")).toEqual(["local_scientific", "effective_world"]);
  });
  it("routes bounded history/edit commands through the typed registry", () => {
    expect(parseCommand("history").command).toMatchObject({ domain: "HISTORY", verb: "history", argument: "" });
    expect(parseCommand("undo").command).toMatchObject({ domain: "HISTORY", verb: "undo", argument: "" });
    expect(parseCommand("redo").command).toMatchObject({ domain: "HISTORY", verb: "redo", argument: "" });
    expect(parseCommand("edit_test").command).toMatchObject({ domain: "EDIT", verb: "edit_test", argument: "" });
    expect(parseCommand("remove id 2").command).toMatchObject({ domain: "EDIT", verb: "remove", argument: "id 2", target: null });
    expect(parseCommand("bond id 1, id 2, double").command).toMatchObject({ domain: "EDIT", verb: "bond", argument: "id 1", target: "id 2, double" });
    expect(parseCommand("unbond id 1, id 2").command).toMatchObject({ domain: "EDIT", verb: "unbond", argument: "id 1", target: "id 2" });
    expect(parseCommand("set_bond order, double, id 1, id 2").command).toMatchObject({ domain: "EDIT", verb: "set_bond", argument: "order", target: "double, id 1, id 2" });
  });
});
