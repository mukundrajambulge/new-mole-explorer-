import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const viewer = (page: Page) => page.getByTestId("molecular-viewer");

const loadFixture = async (page: Page) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(viewer(page)).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
};

test("V-FINAL admits bounded H-bonds, Contacts, and Clash diagnostics and keeps Pocket truthful", async ({ page }) => {
  await loadFixture(page);
  const analysis = page.getByTestId("analysis-results");

  await page.getByRole("button", { name: "H-Bonds", exact: true }).click();
  await expect(analysis).toContainText("H-BONDS");
  await expect(analysis).toContainText("analysis.h-bond.distance-3.5A");

  await page.getByRole("button", { name: "Contacts", exact: true }).click();
  await expect(analysis).toContainText("CONTACTS");
  await expect(analysis).toContainText("analysis.contact.heavy-atom-distance-4.0A");

  await page.getByRole("button", { name: "Clash", exact: true }).click();
  await expect(analysis).toContainText("CLASH");
  await expect(analysis).toContainText("analysis.clash.heavy-atom-vdw-overlap-0.4A");

  await page.getByRole("button", { name: "Pocket Unavailable", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Unavailable");
  await expect(page.getByRole("status")).toContainText("validated pocket-detection algorithm");
});

test("V-FINAL keeps VDW, SAS, SES, Mesh, Dots, and Dot Surface distinct and cacheable", async ({ page }) => {
  await loadFixture(page);
  const style = page.getByRole("combobox", { name: "Style" });
  const target = viewer(page);

  await style.selectOption("van-der-waals-surface");
  await expect(target).toHaveAttribute("data-renderer-surface-profile", "VDW");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("solvent-accessible-surface");
  await expect(target).toHaveAttribute("data-renderer-surface-profile", "SAS");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("solvent-excluded-surface");
  await expect(target).toHaveAttribute("data-renderer-surface-profile", "SES");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("mesh");
  await expect(target).toHaveAttribute("data-renderer-surface-profile", "MESH");
  await expect(target).toHaveAttribute("data-renderer-mesh-generations", "1");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("dots");
  await expect(target).toHaveAttribute("data-renderer-surface-profile", "DOTS");
  await expect(target).toHaveAttribute("data-renderer-dot-generations", "1");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("dot-surface");
  await expect(target).toHaveAttribute("data-renderer-surface-profile", "DOT_SURFACE");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
});

test("V-FINAL updates surface material opacity without rebuilding the canonical model or surface geometry", async ({ page }) => {
  await loadFixture(page);
  const target = viewer(page);
  await page.getByRole("combobox", { name: "Style" }).selectOption("van-der-waals-surface");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  const modelLoads = await target.getAttribute("data-renderer-model-loads");
  const generations = await target.getAttribute("data-renderer-surface-generations");
  await page.getByText("Representation Settings", { exact: true }).click();
  await page.getByRole("slider", { name: "Surface opacity" }).fill("0.25");
  await expect(target).toHaveAttribute("data-renderer-model-loads", modelLoads ?? "1");
  await expect(target).toHaveAttribute("data-renderer-surface-generations", generations ?? "1");
});

test("V-FINAL keeps rapid representation switching on the final projection", async ({ page }) => {
  await loadFixture(page);
  const target = viewer(page);
  const style = page.getByRole("combobox", { name: "Style" });
  await style.selectOption("dots");
  await style.selectOption("mesh");
  await style.selectOption("solvent-accessible-surface");
  await style.selectOption("cartoon");
  await expect(target).toHaveAttribute("data-renderer-style-profile", "cartoon");
  await expect(target).toHaveAttribute("data-renderer-model-loads", "1");
  await expect(target).not.toHaveAttribute("data-surface-state", "ready");
});

test("V-FINAL exposes only relevant representation controls", async ({ page }) => {
  await loadFixture(page);
  const settings = page.getByText("Representation Settings", { exact: true });
  await settings.click();
  await expect(page.getByRole("slider", { name: "Cartoon thickness" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Dot density" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Style" }).selectOption("mesh");
  await expect(page.getByRole("slider", { name: "Mesh width" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Dot density" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Style" }).selectOption("dots");
  await expect(page.getByRole("slider", { name: "Dot density" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Mesh width" })).toHaveCount(0);
});

test("V-FINAL Center routes through the camera controller and labels remain canonical", async ({ page }) => {
  await loadFixture(page);
  const target = viewer(page);
  await page.getByTestId("projection-display-panel").getByRole("button", { name: "Center", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-action", "CENTER");
  await expect(target).toHaveAttribute("data-renderer-model-loads", "1");

  await page.locator("summary").filter({ hasText: "Labels" }).click();
  await page.getByLabel("Label mode").selectOption("chain");
  await expect(target).toHaveAttribute("data-label-mode", "chain");
  await expect(target).toHaveAttribute("data-label-count", "2");
});

test("V-FINAL captures the clean local upload evidence state", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Collapse console", exact: true }).click();
  await page.screenshot({ path: resolve("verification/evidence/visualization-final/uploaded-protein-cartoon-ligand-sticks.png"), animations: "disabled" });
  await page.getByRole("combobox", { name: "Ligand representation" }).selectOption("space-filling");
  await page.screenshot({ path: resolve("verification/evidence/visualization-final/space-filling-ligand-only.png"), animations: "disabled" });
});
