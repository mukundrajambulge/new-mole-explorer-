import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeD2ElementSymbol } from "./d2.js";

describe("element spelling", () => {
  it("normalises halogens to IUPAC case", () => {
    expect(normalizeD2ElementSymbol("CL")).toBe("Cl");
    expect(normalizeD2ElementSymbol("br")).toBe("Br");
    expect(normalizeD2ElementSymbol("I")).toBe("I");
    expect(normalizeD2ElementSymbol("Xx")).toBeNull();
  });
  it("covers every element of the halogen ligand fixture", () => {
    const url = new URL("../../../../tests/fixtures/halogen-ligand.pdbqt", import.meta.url);
    const types = readFileSync(url, "utf8").split("\n").filter((l) => l.startsWith("ATOM")).map((l) => l.trim().split(/\s+/).at(-1)!);
    expect(types.map((t) => normalizeD2ElementSymbol(t))).toEqual(["C", "Cl", "Br", "I"]);
  });
});
