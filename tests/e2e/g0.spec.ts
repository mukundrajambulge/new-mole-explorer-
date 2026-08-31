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
  await expect(page.getByRole("status")).toContainText("Surface calculation is not implemented in G1B");
});

test("local PDB upload loads canonical metadata into the real viewer", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-projection", "cartoon");
  await expect(page.getByText("3Dmol.js adapter ready · mini-protein.pdb loaded", { exact: false })).toBeVisible();
});

test("failed structure loads keep the current canonical structure", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "invalid.pdb", mimeType: "text/plain", buffer: Buffer.from("not a molecular structure") });
  await expect(page.getByLabel("Molecular render projection").getByText("No ATOM or HETATM records with coordinates were found.", { exact: false })).toBeVisible();
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
});

test("New creates a clean persisted project and Open uses the same structure picker", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByText("Untitled Project · r1", { exact: false })).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Untitled Project · r2", { exact: false })).toBeVisible();
});
