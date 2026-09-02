import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const mini = resolve("tests/fixtures/mini-protein.pdb");
const ligand = resolve("tests/fixtures/g1c-small-molecule.pdb");
const multiState = resolve("tests/fixtures/multistate.pdb");

test("multiple canonical objects share one viewer and keep object scope independent", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(ligand);

  const panel = page.getByTestId("objects-selections-panel");
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await expect(panel).toContainText("mini-protein.pdb");
  await expect(panel).toContainText("g1c-small-molecule.pdb");

  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 3 atoms");
  await command.fill("chain A and object mini-protein.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 11 atoms");
  await command.fill("object mini-protein.pdb or object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 15 atoms");

  const ligandRow = panel.locator("[data-object-id]").filter({ hasText: "g1c-small-molecule.pdb" });
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await page.getByRole("combobox", { name: "Style" }).selectOption("sticks");
  await panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" }).getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("cartoon");
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("sticks");
  await page.getByRole("combobox", { name: "Color mode" }).selectOption("monochrome");
  await panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" }).getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Color mode" })).toHaveValue("rainbow");
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Color mode" })).toHaveValue("monochrome");

  await command.fill("copy mini-protein.pdb, copied-mini");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel.locator("[data-object-id]")).toHaveCount(3);
  await expect(panel).toContainText("copied-mini");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "3");

  await command.fill("set_name copied-mini, copied-renamed");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel).toContainText("copied-renamed");

  await command.fill("create unsupported-object");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("create is unavailable");

  await ligandRow.getByRole("button", { name: "Disable g1c-small-molecule.pdb" }).click();
  await expect(ligandRow.getByRole("button", { name: "Enable g1c-small-molecule.pdb" })).toBeVisible();
  await command.fill("select all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 24 atoms");
});

test("multi-model ingestion exposes explicit state order and state switching", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(multiState);
  const panel = page.getByTestId("objects-selections-panel");
  await expect(page.getByTitle("multistate.pdb").first()).toBeVisible();
  const row = panel.locator("[data-object-id]").filter({ hasText: "multistate.pdb" });
  await expect(row).toContainText("2 states");
  await expect(row).toContainText("1/2");
  await row.getByRole("button", { name: "Next state for multistate.pdb" }).click();
  await expect(row).toContainText("2/2");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("state 1, multistate.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(row).toContainText("1/2");
  await command.fill("state multistate.pdb, 2");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(row).toContainText("2/2");
  await row.getByRole("button", { name: "Show all states for multistate.pdb" }).click();
  await expect(row.getByRole("button", { name: "Hide all states for multistate.pdb" })).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await command.fill("count_states multistate.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("has 2 canonical coordinate states");
});

test("duplicate display names require a durable object identity", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(mini);

  const panel = page.getByTestId("objects-selections-panel");
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  const objectId = await panel.locator("[data-object-id]").first().getAttribute("data-object-id");
  expect(objectId).toBeTruthy();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("object mini-protein.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("resolves to multiple workspace objects");
  await command.fill(`object ${objectId}`);
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 12 atoms");
});

test("object-scoped surfaces survive an unrelated coordinate-state change", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(multiState);
  await expect(page.getByTitle("multistate.pdb").first()).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(mini);
  const panel = page.getByTestId("objects-selections-panel");
  const stateRow = panel.locator("[data-object-id]").filter({ hasText: "multistate.pdb" });
  const miniRow = panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" });
  const renderer = page.getByTestId("molecular-viewer");

  await stateRow.getByRole("button", { name: "Focus multistate.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("cartoon");
  await page.getByRole("combobox", { name: "Style" }).selectOption("van-der-waals-surface");
  await expect(renderer).toHaveAttribute("data-renderer-surface-object-count", "1");
  await miniRow.getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("cartoon");
  await page.getByRole("combobox", { name: "Style" }).selectOption("van-der-waals-surface");
  await expect(renderer).toHaveAttribute("data-renderer-surface-object-count", "2", { timeout: 15000 });
  const before = await renderer.getAttribute("data-renderer-surface-rebuilds");
  expect(before).toBeTruthy();
  const beforeCounts = JSON.parse(before!) as Record<string, number>;
  const miniId = await miniRow.getAttribute("data-object-id");
  expect(miniId).toBeTruthy();
  expect(Object.entries(beforeCounts).find(([key]) => key.startsWith(`${miniId}:`))?.[1]).toBe(1);

  await stateRow.getByRole("button", { name: "Next state for multistate.pdb" }).click();
  await expect(stateRow).toContainText("2/2");
  await expect(renderer).toHaveAttribute("data-renderer-surface-object-count", "2");
  const after = await renderer.getAttribute("data-renderer-surface-rebuilds");
  expect(after).toBeTruthy();
  const afterCounts = JSON.parse(after!) as Record<string, number>;
  expect(Object.entries(afterCounts).find(([key]) => key.startsWith(`${miniId}:`))?.[1]).toBe(1);
});

test("console presentation commands target canonical workspace objects and keep enable state in sync", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(ligand);

  const panel = page.getByTestId("objects-selections-panel");
  const renderer = page.getByTestId("molecular-viewer");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const objectState = async (objectId: string) => {
    const value = await renderer.getAttribute("data-renderer-object-projection");
    expect(value).toBeTruthy();
    return JSON.parse(value!)[objectId] as { enabled: boolean; directiveCount: number; explicitColorCount: number };
  };
  const miniId = await panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" }).getAttribute("data-object-id");
  const ligandId = await panel.locator("[data-object-id]").filter({ hasText: "g1c-small-molecule.pdb" }).getAttribute("data-object-id");
  expect(miniId).toBeTruthy();
  expect(ligandId).toBeTruthy();
  const beforeMini = await objectState(miniId!);
  const beforeLigand = await objectState(ligandId!);

  await command.fill("show lines, object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("SHOW LINES on 3 atoms");
  const afterLinesMini = await objectState(miniId!);
  const afterLinesLigand = await objectState(ligandId!);
  expect(afterLinesMini.directiveCount).toBe(beforeMini.directiveCount);
  expect(afterLinesLigand.directiveCount).toBeGreaterThan(beforeLigand.directiveCount);

  await command.fill("color red, object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Applied red to 3 atoms");
  expect((await objectState(miniId!)).explicitColorCount).toBe(beforeMini.explicitColorCount);
  expect((await objectState(ligandId!)).explicitColorCount).toBe(3);

  const ligandRow = panel.locator(`[data-object-id="${ligandId}"]`);
  await ligandRow.getByRole("button", { name: `Disable g1c-small-molecule.pdb` }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", new RegExp(`"${ligandId}":\\{"enabled":false`));
  await ligandRow.getByRole("button", { name: `Enable g1c-small-molecule.pdb` }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", new RegExp(`"${ligandId}":\\{"enabled":true`));
});

test("a single object remains render-synchronized across disable and re-enable", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const row = page.getByTestId("objects-selections-panel").locator("[data-object-id]").first();
  const renderer = page.getByTestId("molecular-viewer");
  await row.getByRole("button", { name: "Disable mini-protein.pdb" }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", /"enabled":false/);
  await row.getByRole("button", { name: "Enable mini-protein.pdb" }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", /"enabled":true/);
  await expect(renderer).toHaveAttribute("data-viewer-state", "loaded");
});
