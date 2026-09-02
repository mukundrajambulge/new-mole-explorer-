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

  const ligandRow = panel.locator("[data-object-id]").filter({ hasText: "g1c-small-molecule.pdb" });
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await page.getByRole("combobox", { name: "Style" }).selectOption("sticks");
  await panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" }).getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("cartoon");
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("sticks");

  await command.fill("copy mini-protein.pdb, copied-mini");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel.locator("[data-object-id]")).toHaveCount(3);
  await expect(panel).toContainText("copied-mini");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "3");

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
  await row.getByRole("button", { name: "Show all states for multistate.pdb" }).click();
  await expect(row.getByRole("button", { name: "Hide all states for multistate.pdb" })).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
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
