import { expect, test } from "@playwright/test";

test("4DJW live selection and a second RCSB object share one workspace", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("4DJW");
  await page.getByRole("button", { name: "RCSB fetch" }).click();
  await expect(page.getByTitle("4DJW.cif").first()).toBeVisible({ timeout: 60000 });

  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("select all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 7079 atoms", { timeout: 15000 });
  await command.fill("chain A and protein");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 3060 atoms", { timeout: 15000 });

  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("1CRN");
  await page.getByRole("button", { name: "RCSB add" }).click();
  await expect(page.getByTitle("1CRN.cif").first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await page.screenshot({ path: "verification/evidence/closure-4djw-two-objects.png", animations: "disabled" });

  await command.fill("object 4DJW.cif");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 7079 atoms", { timeout: 15000 });
});
