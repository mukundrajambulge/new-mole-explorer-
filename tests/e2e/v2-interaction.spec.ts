import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const viewer = (page: Page) => page.getByTestId("molecular-viewer");

test("V2 keeps target-scoped presentation, inspection, labels, camera, and viewer lifecycle stable", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.locator('[title="mini-protein.pdb"]')).toBeVisible({ timeout: 15000 });
  await expect(viewer(page)).toHaveAttribute("data-renderer-model-loads", "1");

  await page.getByRole("combobox", { name: "Ligand representation" }).selectOption("sticks");
  await page.getByRole("combobox", { name: "Projection mode" }).selectOption("orthographic");
  await page.getByRole("combobox", { name: "Projection mode" }).selectOption("perspective");
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await expect(viewer(page)).toHaveAttribute("data-renderer-water-spheres", "1");
  await expect(viewer(page)).toHaveAttribute("data-renderer-model-loads", "1");

  const command = page.getByRole("textbox", { name: "Command or selection query" });
  if (await command.count() === 0) await page.getByRole("button", { name: "Expand console" }).click();
  await command.fill("show sticks, all");
  await page.getByRole("button", { name: /Run/ }).click();
  await command.fill("hide sticks, chain A");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByText(/HIDE STICKS on \d+ atoms\./)).toBeVisible();
  await command.fill("select chain A");
  await page.getByRole("button", { name: /Run/ }).click();

  await page.getByRole("button", { name: "Collapse console" }).click();
  await expect(page.getByRole("heading", { name: "Context" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId("context-panel")).toContainText("Coordinates");

  await page.locator('summary').filter({ hasText: "Labels" }).click();
  await page.getByRole("combobox", { name: "Label mode" }).selectOption("atom-name");
  await expect(viewer(page)).toHaveAttribute("data-label-mode", "atom-name");
});
