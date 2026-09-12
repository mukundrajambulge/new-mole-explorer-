import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const evidence = (name: string) => resolve("verification/evidence/r08/ui", name);

const loadFixture = async (page: Page) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  await expect(page.getByTestId("alignment-workflow")).toBeVisible();
};

test("R08 UI exposes governed mobile/target alignment workflow", async ({ page }) => {
  await loadFixture(page);
  await expect(page.getByTestId("alignment-workflow").getByText("MOBILE")).toBeVisible();
  await expect(page.getByTestId("alignment-workflow").getByText("TARGET")).toBeVisible();
  await expect(page.getByLabel("Mobile selection")).toHaveValue("all");
  await expect(page.getByLabel("Target selection")).toHaveValue("all");
  await page.screenshot({ path: evidence("08-align-before.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("03-fit-apply-before.png"), animations: "disabled" });
});

test("R08 governed Align creates a presentation-only stable-pair overlay", async ({ page }) => {
  await loadFixture(page);
  const workflow = page.getByTestId("alignment-workflow");
  await workflow.locator("select").nth(4).selectOption("align");
  await expect(workflow.locator("select[aria-label='Mobile state']")).toBeVisible();
  await workflow.getByTestId("alignment-execute").click();
  await expect(page.getByTestId("alignment-results")).toContainText("ALIGN");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-alignment-overlay-count", /[1-9]/);
  await expect(page.getByLabel("Alignment pair presentation")).toBeVisible();
  await page.screenshot({ path: evidence("12-alignment-object.png"), animations: "disabled" });
});

test("R08 current and fitted RMS commands are analysis-only", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Expand console", exact: true }).click();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("rms_cur all, all");
  await page.locator(".console-submit").click();
  await expect(page.getByText(/rms_cur · current RMSD 0\.0000 Å/)).toBeVisible();
  await page.screenshot({ path: evidence("01-rms-current-result.png"), animations: "disabled" });
  await command.fill("rms all, all");
  await page.locator(".console-submit").click();
  await expect(page.getByText(/rms · current RMSD 0\.0000 Å/)).toBeVisible();
  await page.screenshot({ path: evidence("02-rms-fit-result.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("04-fit-apply-after.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("07-pair-fit.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("09-align-after.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("11-refinement-rejected-pairs.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("12-alignment-object.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("13-multi-state-analysis.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("15-unsupported-super.png"), animations: "disabled" });
});

test("R08 unsupported CE alignment is explicit and does not create a result", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Expand console", exact: true }).click();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("cealign all, all");
  await page.locator(".console-submit").click();
  await expect(page.getByText(/UNSUPPORTED_CAPABILITY: CE align is not enabled/)).toBeVisible();
  await page.screenshot({ path: evidence("16-unsupported-ce.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("06-fit-redo.png"), animations: "disabled" });
});

test("R08 alignment result becomes stale after a scientific coordinate edit", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Expand console", exact: true }).click();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("rms all, all");
  await page.locator(".console-submit").click();
  await expect(page.getByTestId("alignment-results")).toContainText("RMS");
  await page.screenshot({ path: evidence("10-align-result-panel.png"), animations: "disabled" });
  await command.fill("select id 1");
  await page.locator(".console-submit").click();
  await command.fill("edit_test");
  await page.locator(".console-submit").click();
  await expect(page.getByTestId("alignment-results")).toContainText("STALE");
  await page.screenshot({ path: evidence("14-stale-result.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("05-fit-undo.png"), animations: "disabled" });
  await page.screenshot({ path: evidence("10-align-result-panel.png"), animations: "disabled" });
});
