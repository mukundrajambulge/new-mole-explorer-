import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const firstFixture = resolve("tests/fixtures/mini-protein.pdb");
const secondFixture = resolve("tests/fixtures/g1c-small-molecule.pdb");

test("latest import wins when an earlier upload is still in flight", async ({ page }) => {
  let uploadCount = 0;
  await page.route("**/api/structures/upload", async (route) => {
    uploadCount += 1;
    if (uploadCount === 1) await new Promise((resolveRequest) => setTimeout(resolveRequest, 1_500));
    try {
      await route.continue();
    } catch {
      // The browser is expected to abort the superseded request.
    }
  });

  await page.goto("/");
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(firstFixture);
  await input.setInputFiles(secondFixture);

  await expect(page.getByTitle("g1c-small-molecule.pdb")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTitle("mini-protein.pdb")).toHaveCount(0);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
});

test("File New clears renderer state and the visible model count", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(firstFixture);
  const viewer = page.getByTestId("molecular-viewer");
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15_000 });
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "1");

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();

  await expect(viewer).toHaveAttribute("data-viewer-state", "empty");
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "0");
  await expect(page.getByText("No structure loaded", { exact: true })).toBeVisible();
});
