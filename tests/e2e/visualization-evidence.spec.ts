import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("VIS evidence captures the local Cartoon plus ligand Sticks presentation", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-cartoon-contributors", "8", { timeout: 15000 });
  await page.screenshot({ path: resolve("verification/evidence/uploaded-cartoon-ligand-sticks.png"), animations: "disabled" });
});
