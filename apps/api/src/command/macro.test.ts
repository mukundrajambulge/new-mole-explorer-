import { describe, expect, it } from "vitest";
import { compileSafeCommand } from "./compiler.js";
import { CommandDispatcher } from "./dispatcher.js";
import { runMacro, validateMacro } from "./macro.js";

describe("R10 bounded macro/batch execution", () => {
  it("rejects cycles and executes a deterministic DAG", () => {
    const command = compileSafeCommand("get_view", { surface: "MACRO" }).command!;
    const cyclic = { schemaVersion: 1 as const, macroId: "cycle", name: "cycle", version: "1", nodes: [{ nodeId: "a", command, dependsOn: ["b"] }, { nodeId: "b", command, dependsOn: ["a"] }], maxNodes: 4, maxIterations: 4, errorPolicy: "STOP_ON_ERROR" as const, deterministic: true, provenance: { createdAt: new Date().toISOString(), sourceHash: "x" } };
    expect(validateMacro(cyclic).some((diagnostic) => diagnostic.code === "PRECONDITION_FAILED")).toBe(true);
    const macro = { ...cyclic, macroId: "dag", nodes: [{ nodeId: "a", command }, { nodeId: "b", command, dependsOn: ["a"] }] };
    expect(runMacro(new CommandDispatcher(), macro).results).toHaveLength(2);
  });
});
