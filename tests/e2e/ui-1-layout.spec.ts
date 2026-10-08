import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const loadFixture = async (page: Page) => {
  await page.goto("/molstudio");
  await page.locator("#structure-file").setInputFiles(resolve(process.cwd(), "tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-render-ready", /true|ready/i, { timeout: 60000 }).catch(() => undefined);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60000 });
};

test("UI-1 B3: tool rail only takes icon width when closed and the canvas fills the space", async ({ page }) => {
  await page.setViewportSize({ width: 673, height: 682 });
  await loadFixture(page);
  const rail = page.locator("aside.scientific-tool-rail");
  const canvas = page.locator("canvas").first();
  await expect.poll(async () => (await rail.boundingBox())?.width ?? 999).toBeLessThanOrEqual(60);
  const closedWidth = (await canvas.boundingBox())!.width;
  await page.getByRole("button", { name: "Display panel" }).click();
  await expect.poll(async () => (await rail.boundingBox())?.width ?? 0).toBeGreaterThan(150);
  const openWidth = (await canvas.boundingBox())!.width;
  expect(closedWidth).toBeGreaterThan(openWidth);
});

test("UI-1 B2: reset view button has a title and clears the axis gizmo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFixture(page);
  const reset = page.getByRole("button", { name: "Reset view" });
  await expect(reset).toHaveAttribute("title", "Reset view");
  const a = (await reset.boundingBox())!;
  const b = (await page.locator(".canvas-axis-readout").boundingBox())!;
  const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  expect(overlap).toBe(false);
});
