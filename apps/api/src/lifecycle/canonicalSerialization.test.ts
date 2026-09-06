import { describe, expect, it } from "vitest";
import { canonicalJson, scientificHashFor, sha256Bytes } from "./canonicalSerialization.js";

describe("R09 canonical serialization", () => {
  it("sorts object keys while preserving array order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 1 }, list: [2, 1] })).toBe(canonicalJson({ list: [2, 1], a: { x: 1, y: 2 }, z: 1 }));
    expect(scientificHashFor({ atoms: [{ element: "C", x: -0 }] })).toBe(scientificHashFor({ atoms: [{ x: 0, element: "C" }] }));
  });

  it("fails closed for non-finite scientific values and hashes bytes exactly", () => {
    expect(() => canonicalJson({ value: Number.NaN })).toThrow("finite numbers");
    expect(sha256Bytes(new TextEncoder().encode("A\n"))).not.toBe(sha256Bytes(new TextEncoder().encode("A\r\n")));
  });
});
