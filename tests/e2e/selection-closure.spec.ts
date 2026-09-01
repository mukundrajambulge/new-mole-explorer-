import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const loadFixture = async (page: Page) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
};

test("selection commands bind canonical membership and named selection actions", async ({ page }) => {
  await loadFixture(page);
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const run = async (value: string) => { await command.fill(value); await page.getByRole("button", { name: /Run/ }).click(); };

  await run("select active_site, chain A and resi 1");
  await expect(page.getByTestId("objects-selections-panel")).toContainText("active_site");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Named selection active_site created");
  await run("show sticks, active_site");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("SHOW STICKS on");
  await run("label active_site, {resn}{resi}:{name}");
  await run("center active_site");
  await run("help select");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Evaluate canonical atom membership");
  await command.fill("select ");
  await expect(page.getByRole("listbox", { name: "Command suggestions" })).toContainText("chain A");
  await command.fill("");

  await page.getByRole("button", { name: "Collapse console", exact: true }).click();
  const namedRow = page.getByTestId("objects-selections-panel").getByText("active_site", { exact: true }).locator("..");
  await namedRow.getByRole("button", { name: "A active_site" }).click();
  await namedRow.getByRole("button", { name: "S active_site" }).click();
  await namedRow.getByRole("button", { name: "L active_site" }).click();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
});

test("component colors persist independently from global color and representation", async ({ page }) => {
  await loadFixture(page);
  const viewer = page.getByTestId("molecular-viewer");
  const proteinColor = page.getByRole("combobox", { name: "Protein color" });
  await proteinColor.selectOption("custom");
  await page.getByLabel("Protein custom color").fill("#ff00aa");
  await page.getByRole("combobox", { name: "Color mode" }).selectOption("chain");
  await page.getByRole("combobox", { name: "Style" }).selectOption("sticks");
  await expect(proteinColor).toHaveValue("custom");
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
  await proteinColor.selectOption("inherit");
  await expect(proteinColor).toHaveValue("inherit");
});

test("custom labels validate visibly and clear without mutating the loaded structure", async ({ page }) => {
  await loadFixture(page);
  const viewer = page.getByTestId("molecular-viewer");
  await page.locator("summary").filter({ hasText: "Labels" }).click();
  await page.getByLabel("Label mode").selectOption("custom");
  const expression = page.getByLabel("Label expression");
  await expression.fill("{not-safe}");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Use only");
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
  await expression.fill("{name}");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-label-mode", "custom");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByLabel("Label mode")).toHaveValue("off");
});

test("analysis and measurement controls remain reachable in the left rail", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loadFixture(page);
  const rail = page.getByLabel("Structure, context and analysis panel");
  const dimensions = await rail.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
  });
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  await expect(page.getByTestId("measurements-panel").getByRole("button", { name: "Distance", exact: true })).toBeVisible();
  await expect(page.getByTestId("measurements-panel").getByRole("button", { name: "Dihedral", exact: true })).toBeVisible();
  await page.screenshot({ path: resolve("verification/evidence/analysis-interaction-scroll.png"), animations: "disabled" });
});
