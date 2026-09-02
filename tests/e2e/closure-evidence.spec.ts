import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("capture current closure evidence states", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "empty");
  await page.screenshot({ path: resolve("verification/evidence/closure-empty-state.png"), animations: "disabled" });

  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-cartoon-contributors", "8", { timeout: 15000 });
  await page.screenshot({ path: resolve("verification/evidence/closure-uploaded-cartoon-ligand-sticks.png"), animations: "disabled" });

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("1CRN");
  await page.getByRole("button", { name: "RCSB fetch" }).click();
  await expect(page.getByTitle("1CRN.cif").first()).toBeVisible({ timeout: 45000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  await page.screenshot({ path: resolve("verification/evidence/closure-rcsb-1crn-cartoon.png"), animations: "disabled" });
});
