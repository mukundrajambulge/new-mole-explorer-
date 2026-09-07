import { describe, expect, it } from "vitest";
import { compileSafeCommand, compileSafeCommands, semanticCommandHash } from "./compiler.js";

describe("R10 safe command compiler", () => {
  it("compiles typed positional/named arguments and preserves nested selections", () => {
    const result = compileSafeCommand("select replace, (chain A and resi 10-20) & organic");
    expect(result.diagnostics).toEqual([]);
    expect(result.command).toMatchObject({ commandType: "SELECTION.EVALUATE", normalizedArgs: { operation: "replace", query: "(chain A and resi 10-20) & organic" } });
    expect(result.command?.semanticHash).toBe(semanticCommandHash(result.command!));
  });

  it("supports unique prefixes and rejects ambiguous prefixes", () => {
    expect(compileSafeCommand("sel all").command?.origin.resolvedPublicName).toBe("select");
    expect(compileSafeCommand("co sticks").diagnostics[0]?.code).toBe("AMBIGUOUS_COMMAND");
  });

  it("rejects code, process and shell syntax before dispatch", () => {
    for (const source of ["python print(1)", "exec('x')", "run echo hi", "system rm -rf x", "select all && echo bad", "color red, all > out"]) {
      expect(compileSafeCommand(source).diagnostics[0]?.code, source).toBe("UNSAFE_COMMAND_REJECTED");
    }
  });

  it("allows bounded safe semicolon statements and rejects malformed nesting", () => {
    const batch = compileSafeCommands("select all; get_view");
    expect(batch.commands).toHaveLength(2);
    expect(compileSafeCommand("select (chain A").diagnostics[0]?.code).toBe("INVALID_ARGUMENT");
  });

  it("normalizes state sentinels without executing input", () => {
    expect(compileSafeCommand("state objectA, all_states").command?.normalizedArgs.state).toEqual({ kind: "ALL_STATES" });
    expect(compileSafeCommand("state objectA, 2").command?.normalizedArgs.state).toEqual({ kind: "EXPLICIT_STATE", ordinal: 2 });
  });
});
