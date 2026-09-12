import { describe, expect, it } from "vitest";
import { tokenizeCommandBatch } from "./batchTokenizer";

describe("tokenizeCommandBatch", () => {
  it("splits top-level commands", () => expect(tokenizeCommandBatch("select all; color red, all; zoom all").commands).toEqual(["select all", "color red, all", "zoom all"]));
  it("preserves semicolons within quoted, braced, and parenthesized expressions", () => {
    expect(tokenizeCommandBatch("label all, 'A;B'; select (chain A; chain B); label all, {name;resi}").commands).toEqual(["label all, 'A;B'", "select (chain A; chain B)", "label all, {name;resi}"]);
  });
  it("reports malformed nesting", () => expect(tokenizeCommandBatch("select (chain A; color red, all").error?.message).toBe("Unterminated parenthesized expression."));
});
