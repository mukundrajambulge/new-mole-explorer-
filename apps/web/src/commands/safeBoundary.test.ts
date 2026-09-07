import { describe, expect, it } from "vitest";
import { unsafeConsoleDiagnostic } from "./safeBoundary";

describe("R10 frontend safe command boundary", () => {
  it("rejects process and shell syntax while preserving selection comparisons", () => {
    expect(unsafeConsoleDiagnostic("python print(1)")).toContain("UNSAFE_COMMAND_REJECTED");
    expect(unsafeConsoleDiagnostic("color red, all > out")).toContain("UNSAFE_COMMAND_REJECTED");
    expect(unsafeConsoleDiagnostic("select partial_charge > 0")).toBeNull();
    expect(unsafeConsoleDiagnostic("select chain A & organic")).toBeNull();
  });
});
