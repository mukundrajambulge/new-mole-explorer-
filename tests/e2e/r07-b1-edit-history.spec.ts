import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const mini = resolve("tests/fixtures/mini-protein.pdb");
const ligand = resolve("tests/fixtures/g1c-small-molecule.pdb");

test("R07-B1 edit, exact undo/redo, and multi-object isolation stay live without reload", async ({ page }) => {
  test.setTimeout(120000);
  const browserConsoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserConsoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(ligand);

  const panel = page.getByTestId("objects-selections-panel");
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  const miniRow = panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" });
  const ligandRow = panel.locator("[data-object-id]").filter({ hasText: "g1c-small-molecule.pdb" });
  const viewer = page.getByTestId("molecular-viewer");
  await expect(viewer).toHaveCount(1);
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
  const initialRendererGeneration = await viewer.getAttribute("data-renderer-generation");

  // Adding an object focuses it; explicitly focus A so the edit target is unambiguous.
  await miniRow.getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  const historyState = page.getByTestId("scientific-history-state");
  await expect(historyState).toContainText("root");
  const rootStatus = await historyState.innerText();

  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const run = async (value: string) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion.locator(".console-entry").last()).toContainText(value);
  };

  await run("object mini-protein.pdb and id 1");
  await expect(consoleRegion.locator(".console-entry").last()).toContainText("Selected 1 atoms");
  await expect(page.getByTestId("active-selection")).toContainText("1 atoms");

  await run("edit_test");
  await expect(consoleRegion.locator(".console-entry").last()).toContainText("COMMITTED coordinate test edit");
  await expect(historyState).toContainText("undo");
  const childStatus = await historyState.innerText();
  expect(childStatus).not.toBe(rootStatus);
  await expect(viewer).toHaveCount(1);
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
  const editRendererGeneration = await viewer.getAttribute("data-renderer-generation");
  expect(editRendererGeneration).not.toBe(initialRendererGeneration);
  await expect(page.getByTestId("active-selection")).toHaveCount(0);

  await run("undo");
  await expect(consoleRegion.locator(".console-entry").last()).toContainText("UNDO restored exact scientific revision");
  await expect(historyState).toContainText("root");
  await expect(historyState).toContainText("redo");
  await expect(viewer).toHaveCount(1);
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
  expect(await viewer.getAttribute("data-renderer-generation")).not.toBe(editRendererGeneration);

  await run("redo");
  await expect(consoleRegion.locator(".console-entry").last()).toContainText("REDO restored exact scientific revision");
  await expect(historyState).toContainText("undo");
  await expect(viewer).toHaveCount(1);
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
  expect(await viewer.getAttribute("data-renderer-generation")).not.toBe(editRendererGeneration);

  // The Edit ribbon action IDs converge on the same canonical history service.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(historyState).toContainText("root");
  await expect(historyState).toContainText("redo");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(historyState).toContainText("undo");

  // B has an independent root history and remains unchanged after A's edit.
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await expect(historyState).toContainText("root");
  await run("history");
  await expect(consoleRegion.locator(".console-entry").last()).toContainText('"retainedRevisionCount":1');
  await expect(consoleRegion.locator(".console-entry").last()).toContainText('"canUndo":false');

  expect(browserConsoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
