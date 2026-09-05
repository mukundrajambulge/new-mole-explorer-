import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const viewer = (page: Page) => page.getByTestId("molecular-viewer");

const loadFixture = async (page: Page) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(viewer(page)).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
};

test("IMP-PRES-01 keeps menu state and rail ownership truthful", async ({ page }) => {
  await page.goto("/");
  const file = page.getByRole("button", { name: "File", exact: true });
  const edit = page.getByRole("button", { name: "Edit", exact: true });
  await file.click();
  await expect(file).toHaveAttribute("aria-expanded", "true");
  await expect(file).toHaveAttribute("data-menu-active", "true");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await edit.click();
  await expect(file).toHaveAttribute("aria-expanded", "false");
  await expect(edit).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('.context-toolbar[data-ribbon-category="Edit"]')).toContainText("Delete Selected");
  await expect(page.getByLabel("Structure, context and analysis panel")).toContainText("Context");
  await expect(page.getByLabel("Structure, context and analysis panel")).toContainText("Analysis & Interaction");
  await expect(page.getByLabel("Projection & Display panel").getByRole("heading", { name: "Context" })).toHaveCount(0);
  await expect(page.getByLabel("Projection & Display panel").getByRole("heading", { name: "Interaction / Measurements" })).toHaveCount(0);
});

test("IMP-PRES-01 derives label cardinality before renderer projection", async ({ page }) => {
  await loadFixture(page);
  await page.locator("summary").filter({ hasText: "Labels" }).click();
  await page.getByLabel("Label mode").selectOption("chain");
  await expect(viewer(page)).toHaveAttribute("data-label-eligible-count", "11");
  await expect(viewer(page)).toHaveAttribute("data-label-count", "2");
  await page.getByLabel("Label mode").selectOption("residue-number");
  await expect(viewer(page)).toHaveAttribute("data-label-count", "4");
  await page.getByLabel("Label mode").selectOption("atom-name");
  await expect(viewer(page)).toHaveAttribute("data-label-count", "11");
});

test("IMP-PRES-01 projects Ribbon with its bounded renderer profile", async ({ page }) => {
  await loadFixture(page);
  await expect(viewer(page)).toHaveAttribute("data-renderer-style-profile", "cartoon");
  await page.getByRole("combobox", { name: "Style" }).selectOption("ribbon");
  await expect(viewer(page)).toHaveAttribute("data-viewer-state", "loaded");
  await expect(viewer(page)).toHaveAttribute("data-renderer-style-profile", "ribbon");
  await expect(viewer(page)).toHaveAttribute("data-renderer-ribbon-contributors", "8");
});

test("IMP-PRES-01 keeps side-rail controls reachable at required workbench sizes", async ({ page }) => {
  for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    await page.goto("/");
    const dimensions = await page.locator("html").evaluate((node) => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    await page.getByText("Advanced Display", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Reset clipping to Auto" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Structure" })).toBeVisible();
  }
});

test("IMP-PRES-01 exposes measurement mode in the left interaction rail", async ({ page }) => {
  await loadFixture(page);
  const measurements = page.getByTestId("measurements-panel");
  await measurements.getByRole("button", { name: "Distance", exact: true }).click();
  await expect(measurements).toContainText("Pick 2 atoms in order");
  await expect(measurements).toContainText("0 picked");
  await measurements.getByRole("button", { name: "Clear picks", exact: true }).click();
  await expect(measurements).toContainText("0 picked");
});
