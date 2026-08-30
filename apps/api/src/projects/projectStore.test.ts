import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_PRESENTATION, ProjectStore } from "./projectStore.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("G1B project lifecycle", () => {
  it("creates, atomically saves and reopens a project manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-workstation-g1b-"));
    tempRoots.push(root);
    const store = new ProjectStore(root);
    const created = await store.create("Evidence project");
    expect(created.structure).toBeNull();
    const saved = await store.save(created.id, { structure: null, presentation: DEFAULT_PROJECT_PRESENTATION, expectedRevision: created.revision });
    const opened = await store.open(created.id);
    expect(saved.revision).toBe(2);
    expect(opened.name).toBe("Evidence project");
    expect(opened.presentation.background.color).toBe("#05070a");
  });

  it("fails closed for unknown projects", async () => {
    const root = await mkdtemp(join(tmpdir(), "molecular-workstation-g1b-"));
    tempRoots.push(root);
    await expect(new ProjectStore(root).open("project_00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND", status: 404 });
  });
});
