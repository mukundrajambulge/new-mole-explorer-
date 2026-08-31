import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");

test("P0-A keeps the loaded scene visible across camera modes and safe camera actions", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.locator('[title="mini-protein.pdb"]')).toBeVisible({ timeout: 15000 });
  const viewer = page.getByTestId("molecular-viewer");
  const panel = page.getByLabel("Projection & Display panel");
  await expect(viewer).toHaveAttribute("data-camera-clipping-mode", "auto");
  await expect(viewer).toHaveAttribute("data-camera-projection", "perspective");
  const initialLoads = await viewer.getAttribute("data-renderer-model-loads");

  await panel.getByRole("combobox", { name: "Projection mode" }).selectOption("orthographic");
  await expect(viewer).toHaveAttribute("data-camera-projection", "orthographic");
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
  await expect(viewer).toHaveAttribute("data-renderer-model-loads", initialLoads ?? "1");

  for (const [label, action] of [["Fit", "FIT"], ["Center", "CENTER"], ["Orient", "ORIENT"]] as const) {
    await panel.getByRole("button", { name: label, exact: true }).click();
    await expect(viewer).toHaveAttribute("data-camera-action", action);
    await expect(viewer).toHaveAttribute("data-camera-clipping-mode", "auto");
  }

  await panel.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-camera-action", "RESET");
  await expect(viewer).toHaveAttribute("data-camera-projection", "perspective");
  await expect(viewer).toHaveAttribute("data-camera-clipping-mode", "auto");
  await expect(viewer).toHaveAttribute("data-renderer-model-loads", initialLoads ?? "1");

  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  const canvas = page.getByTestId("molecular-viewer").locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const points = [[box.x + box.width * 0.5, box.y + box.height * 0.5], [box.x + box.width * 0.9, box.y + box.height * 0.5], [box.x + box.width * 0.9, box.y + box.height * 0.9], [box.x + box.width * 0.5, box.y + box.height * 0.9], [box.x + box.width * 0.1, box.y + box.height * 0.9], [box.x + box.width * 0.1, box.y + box.height * 0.1], [box.x + box.width * 0.9, box.y + box.height * 0.1], [box.x + box.width * 0.5, box.y + box.height * 0.5]];
    await page.mouse.move(points[0][0], points[0][1]);
    await page.mouse.down();
    for (const point of points.slice(1)) { await page.mouse.move(point[0], point[1]); }
    await page.mouse.up();
  }
  await expect(viewer).toHaveAttribute("data-camera-action", "ROTATE");
  await expect(viewer).toHaveAttribute("data-camera-clipping-mode", "auto");

  await panel.locator("summary").filter({ hasText: "Advanced" }).click();
  await panel.getByRole("spinbutton", { name: "Near clip" }).fill("5");
  await expect(viewer).toHaveAttribute("data-camera-clipping-mode", "manual");
  await panel.getByRole("button", { name: "Reset clipping to Auto" }).click();
  await expect(viewer).toHaveAttribute("data-camera-clipping-mode", "auto");
});
