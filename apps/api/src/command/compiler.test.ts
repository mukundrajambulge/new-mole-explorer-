import { describe, expect, it } from "vitest";
import { compileSafeCommand, compileSafeCommands, semanticCommandHash } from "./compiler.js";

describe("R10 safe command compiler", () => {
  it("compiles typed positional/named arguments and preserves nested selections", () => {
    const result = compileSafeCommand("select replace, (chain A and resi 10-20) & organic");
    expect(result.diagnostics).toEqual([]);
    expect(result.command).toMatchObject({ commandType: "SELECTION.EVALUATE", normalizedArgs: { operation: "replace", query: "(chain A and resi 10-20) & organic" } });
    expect(result.command?.semanticHash).toBe(semanticCommandHash(result.command!));
  });

  it("keeps semantic hashes stable across surface metadata", () => {
    const consoleCommand = compileSafeCommand("show sticks, chain A and resi 10", { surface: "CONSOLE" }).command!;
    const restCommand = compileSafeCommand("show representation=sticks, query=chain A and resi 10", { surface: "REST" }).command!;
    const sdkCommand = compileSafeCommand("show sticks, chain A and resi 10", { surface: "SDK" }).command!;
    expect(consoleCommand.semanticHash).toBe(sdkCommand.semanticHash);
    expect(consoleCommand.semanticHash).toBe(restCommand.semanticHash);
    expect(consoleCommand.origin.surface).not.toBe(restCommand.origin.surface);
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

  it("binds display references only through the supplied typed binding context", () => {
    const result = compileSafeCommand("state objectA, state=2, state=3", { bindings: {
      resolveObject: (reference) => reference === "objectA" ? { id: "object:stable-1", displayName: reference } : { status: "NOT_FOUND" },
      resolveState: (objectId, selector) => objectId === "object:stable-1" && JSON.stringify(selector) === JSON.stringify({ kind: "EXPLICIT_STATE", ordinal: 2 }) ? { id: "state:stable-2" } : { status: "NOT_FOUND" },
    } });
    expect(result.command).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("DUPLICATE_ARGUMENT");

    const bound = compileSafeCommand("state objectA, 2", { bindings: {
      resolveObject: () => ({ id: "object:stable-1" }),
      resolveState: (objectId, selector) => objectId === "object:stable-1" && JSON.stringify(selector) === JSON.stringify({ kind: "EXPLICIT_STATE", ordinal: 2 }) ? { id: "state:stable-2" } : { status: "NOT_FOUND" },
    } });
    expect(bound.diagnostics).toEqual([]);
    expect(bound.command?.normalizedArgs.object).toBe("object:stable-1");
    expect(bound.command?.boundRefs).toEqual({ objectIds: ["object:stable-1"], stateIds: ["state:stable-2"] });
  });

  it("supports named arguments with whitespace without treating spaces as nesting", () => {
    const result = compileSafeCommand("set name = orthoscopic, value = on");
    expect(result.diagnostics).toEqual([]);
    expect(result.command?.normalizedArgs).toMatchObject({ name: "orthoscopic", value: "on" });
  });
});
