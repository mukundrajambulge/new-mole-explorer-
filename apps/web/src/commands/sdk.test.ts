import { describe, expect, it } from "vitest";
import type { CommandResult } from "@molecular/contracts";
import { createMoleExplorerSession } from "./sdk";

describe("R10 typed SDK facade", () => {
  it("routes typed methods through the canonical command submitter", async () => {
    const submitted: string[] = [];
    const result = {} as CommandResult;
    const session = createMoleExplorerSession(async (rawCommand) => { submitted.push(rawCommand); return result; });
    await session.selection.select("chain A");
    await session.representation.show("sticks", "all");
    await session.color.set("red", "polymer");
    await session.measure.distance("id 1", "id 2");
    await session.edit.addHydrogens("polymer");
    await session.alignment.align("mobile", "target");
    await session.scene.store("Overview");
    expect(submitted).toEqual(["select replace, chain A", "show sticks, all", "color red, polymer", "distance id 1, id 2", "h_add polymer", "align mobile, target", "scene_store Overview"]);
  });
});
