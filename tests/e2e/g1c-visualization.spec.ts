import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const renderer = (page: Page) => page.getByTestId("molecular-viewer");

const loadFixture = async (page: Page) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(renderer(page)).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
};

test("G1C-UI-001 exposes the complete style dropdown with truthful capability states", async ({ page }) => {
  await page.goto("/");
  const style = page.getByRole("combobox", { name: "Style" });
  await expect(style.locator("option")).toHaveText([
    "Line", "Stick", "Ball-and-Stick", "Space-Filling", "Van der Waals Surface", "Solvent-Accessible Surface", "Solvent-Excluded Surface", "Mesh", "Dots", "Dot Surface", "Cartoon", "Ribbon", "Trace", "Putty", "Non-bonded (crosses)", "Non-bonded (spheres)", "Licorice",
  ]);
  await expect(style.locator('option[value="van-der-waals-surface"]')).toHaveAttribute("data-capability-state", "SUPPORTED_WITH_LIMITATIONS");
});

test("G1C-REP-001 renders Lines, Sticks, Ball-and-Stick, and Space-Filling from canonical targets", async ({ page }) => {
  await loadFixture(page);
  const style = page.getByRole("combobox", { name: "Style" });
  await style.selectOption("line");
  await expect(renderer(page)).toHaveAttribute("data-renderer-line-segments", "8");
  await expect(renderer(page)).toHaveAttribute("data-renderer-canonical-bond-source", "canonical");
  await style.selectOption("sticks");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "8");
  await style.selectOption("ball-and-stick");
  await expect(renderer(page)).toHaveAttribute("data-renderer-sphere-primitives", "11");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "8");
  await style.selectOption("space-filling");
  await expect(renderer(page)).toHaveAttribute("data-renderer-sphere-primitives", "11");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "0");
  await expect(renderer(page)).toHaveAttribute("data-renderer-style-profile", "space-filling");
});

test("G1C-REP-002 keeps Cartoon, Ribbon, Trace, and Putty capability truth explicit", async ({ page }) => {
  await loadFixture(page);
  const style = page.getByRole("combobox", { name: "Style" });
  await style.selectOption("cartoon");
  await expect(renderer(page)).toHaveAttribute("data-renderer-cartoon-contributors", "8");
  await expect(style.locator('option[value="ribbon"]')).toHaveAttribute("data-capability-state", "SUPPORTED_WITH_LIMITATIONS");
  await expect(style.locator('option[value="ribbon"]')).toHaveAttribute("data-representation-status", "IMPLEMENTED_WITH_LIMITATIONS");
  await style.selectOption("ribbon");
  await expect(renderer(page)).toHaveAttribute("data-renderer-ribbon-contributors", "8");
  await expect(renderer(page)).toHaveAttribute("data-renderer-cartoon-contributors", "0");
  await expect(renderer(page)).toHaveAttribute("data-renderer-style-profile", "ribbon");
  await style.selectOption("trace");
  await expect(renderer(page)).toHaveAttribute("data-renderer-trace-contributors", "8");
  await style.selectOption("putty");
  await expect(renderer(page)).toHaveAttribute("data-renderer-putty-contributors", "8");
});

test("G1C-REP-003 uses canonical topology for non-bonded crosses and spheres", async ({ page }) => {
  await loadFixture(page);
  const style = page.getByRole("combobox", { name: "Style" });
  await style.selectOption("nonbonded-crosses");
  await expect(renderer(page)).toHaveAttribute("data-renderer-cross-contributors", "1");
  await style.selectOption("nonbonded-spheres");
  await expect(renderer(page)).toHaveAttribute("data-renderer-sphere-primitives", "1");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "0");
});

test("G1C-REP-004 projects VDW, Mesh, Dots, and target-scoped surfaces", async ({ page }) => {
  await loadFixture(page);
  const style = page.getByRole("combobox", { name: "Style" });
  await style.selectOption("van-der-waals-surface");
  await expect(renderer(page)).toHaveAttribute("data-renderer-surface-contributors", "11");
  await expect(renderer(page)).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("mesh");
  await expect(renderer(page)).toHaveAttribute("data-renderer-mesh-contributors", "11");
  await expect(renderer(page)).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("dots");
  await expect(renderer(page)).toHaveAttribute("data-renderer-dot-contributors", "11");
  await expect(renderer(page)).toHaveAttribute("data-surface-state", "ready", { timeout: 15000 });
  await style.selectOption("cartoon");
  await page.getByRole("combobox", { name: "Ligand representation" }).selectOption("dots");
  await expect(renderer(page)).toHaveAttribute("data-renderer-dot-contributors", "2");
  await expect(renderer(page)).toHaveAttribute("data-renderer-cartoon-contributors", "8");
});

test("G1C-COLOR-001 exposes all schemes and reports missing property datasets", async ({ page }) => {
  await loadFixture(page);
  const color = page.getByRole("combobox", { name: "Color mode" });
  await expect(color.locator("option")).toHaveCount(15);
  await expect(color.locator("option")).toHaveText([
    "Classic CPK", "Modern/Jmol", "By Molecule", "By Formal Charge", "By Partial Charge", "ESP", "Hydrophobicity", "Rainbow", "Monochrome", "Colourblind-safe", "Secondary Structure (Standard)", "Secondary Structure (Jmol)", "By Chain", "By Element (CPK)", "White",
  ]);
  await color.selectOption("by-partial-charge");
  await expect(page.getByRole("alert")).toHaveText("Partial-charge data unavailable for this molecular revision.");
  await color.selectOption("esp");
  await expect(page.getByRole("alert")).toContainText("ESP field unavailable");
  await color.selectOption("secondary-structure-standard");
  await expect(page.getByRole("alert")).toHaveText("Secondary-structure assignment unavailable for this molecular revision.");
});

test("G1C-UI-002 keeps component visibility in the Projection & Display authority", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await expect(page.locator('.display-row--button').filter({ hasText: "Water" }).getByRole("switch")).toHaveAttribute("aria-checked", "true");
  await page.locator(".side-column--right .display-row--button").filter({ hasText: "Protein" }).click();
  await expect(page.getByRole("button", { name: "Toggle Protein" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".component-row").filter({ hasText: "Protein" })).toContainText("8");
  await page.locator(".side-column--right .display-row--button").filter({ hasText: "Protein" }).click();
  await expect(page.getByRole("button", { name: "Toggle Protein" })).toHaveAttribute("aria-pressed", "true");
});

test("G1C-PERF-001 changes presentation without recreating the canonical model", async ({ page }) => {
  await loadFixture(page);
  const initialLoads = await renderer(page).getAttribute("data-renderer-model-loads");
  expect(initialLoads).toBe("1");
  await page.getByRole("combobox", { name: "Style" }).selectOption("ball-and-stick");
  await page.getByRole("combobox", { name: "Color mode" }).selectOption("chain");
  await page.getByRole("combobox", { name: "Background preset" }).selectOption("White");
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-model-loads", "1");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
});

test("G1C-RCSB-001 loads an official RCSB mmCIF through the backend", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("1CRN");
  await page.getByRole("button", { name: "RCSB fetch" }).click();
  await expect(page.getByTitle("1CRN.cif")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText(/RCSB · MMCIF · sha256/)).toBeVisible();
  await expect(renderer(page)).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
});
