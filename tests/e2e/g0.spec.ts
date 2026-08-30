import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("G0 workstation shell renders and console collapses", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Structure" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selection Inspector" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse console" }).click();
  await expect(page.getByRole("button", { name: "Expand console" })).toBeVisible();
});

test("unsupported actions report their G0 capability state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Surface", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("Coming Soon");
  await expect(page.getByRole("status")).toContainText("Surface calculation is not implemented in G0");
});

test("local PDB upload loads canonical metadata into the real viewer", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-projection", "cartoon");
  await expect(page.getByText("3Dmol.js adapter ready · mini-protein.pdb loaded", { exact: false })).toBeVisible();
});
