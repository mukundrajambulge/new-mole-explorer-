import { describe, expect, it, vi } from "vitest";
import { createDefaultRenderProjection, setInteractionState } from "../rendering/renderProjection";
import { createDirtyTracker, isDirty, trackWorkspaceRevision } from "./dirtyTracker";

const slices = (): unknown[] => [[], [], null];

describe("dirty tracking by revision counter", () => {
  it("hover does not bump the revision and never serializes", () => {
    const stringify = vi.spyOn(JSON, "stringify");
    const tracker = createDirtyTracker();
    const s = slices();
    let projection = createDefaultRenderProjection();
    const base = trackWorkspaceRevision(tracker, projection as never, s);
    stringify.mockClear();
    const start = performance.now();
    for (let i = 0; i < 300_000; i++) {
      projection = setInteractionState(projection, { hoveredAtomId: `atom-${i}` });
      if (trackWorkspaceRevision(tracker, projection as never, s) !== base) throw new Error("hover bumped revision");
    }
    const elapsedMs = performance.now() - start;
    expect(stringify).not.toHaveBeenCalled();
    console.log(`hover x300000 tracked in ${elapsedMs.toFixed(1)} ms, 0 JSON.stringify calls`);
    stringify.mockRestore();
  });

  it("edits bump, save clears, open is not dirty", () => {
    const tracker = createDirtyTracker();
    const s = slices();
    let projection = createDefaultRenderProjection();
    let rev = trackWorkspaceRevision(tracker, projection as never, s);
    let saved: number | null = rev; // baseline adopted in the same render as open
    expect(isDirty(rev, saved)).toBe(false);
    rev = trackWorkspaceRevision(tracker, projection as never, s);
    expect(isDirty(rev, saved)).toBe(false);
    projection = setInteractionState(projection, { selectedAtomIds: ["a"] });
    rev = trackWorkspaceRevision(tracker, projection as never, s);
    expect(isDirty(rev, saved)).toBe(true);
    saved = rev;
    expect(isDirty(rev, saved)).toBe(false);
    rev = trackWorkspaceRevision(tracker, projection as never, [[], ...s.slice(1)]);
    expect(isDirty(rev, saved)).toBe(true);
  });
});
