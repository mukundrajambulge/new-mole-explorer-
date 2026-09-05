import { expect, test, type Page } from "@playwright/test";

const viewer = (page: Page) => page.getByTestId("molecular-viewer");

const load4DJW = async (page: Page) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/molstudio");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("4DJW");
  await page.getByRole("button", { name: "RCSB fetch", exact: true }).click();
  await expect(page.getByTitle("4DJW.cif").first()).toBeVisible({ timeout: 60000 });
  await expect(viewer(page)).toHaveAttribute("data-canonical-atom-count", "7079", { timeout: 60000 });
  await expect(viewer(page)).toHaveAttribute("data-renderer-model-count", "1");
};

const dragCanvas = async (page: Page, fromFraction: [number, number], toFraction: [number, number]) => {
  const box = await viewer(page).locator("canvas").boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const point = ([x, y]: [number, number]) => [box.x + box.width * x, box.y + box.height * y] as const;
  const from = point(fromFraction);
  const to = point(toFraction);
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await page.mouse.up();
};

test("MANUAL GATE 01 keeps 4DJW responsive and VDW visible", async ({ page }) => {
  test.setTimeout(180000);
  await load4DJW(page);

  const target = viewer(page);
  const style = page.getByRole("combobox", { name: "Style" });
  await style.selectOption("van-der-waals-surface");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 90000 });
  await expect(target).toHaveAttribute("data-surface-ready", "true");
  await expect(target).toHaveAttribute("data-renderer-surface-object-count", "1");
  await expect(target).toHaveAttribute("data-renderer-model-count", "1");
  await expect(target).toHaveAttribute("data-renderer-object-projection", /"representation":"van-der-waals-surface"/);

  const initial = {
    models: await target.getAttribute("data-renderer-model-loads"),
    scenes: await target.getAttribute("data-renderer-scene-rebuilds"),
    surfaces: await target.getAttribute("data-renderer-surface-rebuilds"),
    revision: await target.getAttribute("data-scientific-revision"),
  };

  await page.getByRole("button", { name: "Collapse console", exact: true }).click();
  await page.screenshot({ path: "verification/evidence/manual-gate-01/vdw-surface-visible.png", animations: "disabled" });

  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  await dragCanvas(page, [0.42, 0.45], [0.76, 0.58]);
  await expect(target).toHaveAttribute("data-camera-action", "ROTATE");
  await expect(target).toHaveAttribute("data-surface-state", "ready");
  await page.screenshot({ path: "verification/evidence/manual-gate-01/vdw-after-rotation.png", animations: "disabled" });

  await page.getByRole("button", { name: "Zoom", exact: true }).click();
  await dragCanvas(page, [0.55, 0.58], [0.55, 0.34]);
  await expect(target).toHaveAttribute("data-camera-action", "ZOOM");
  await expect(target).toHaveAttribute("data-surface-state", "ready");

  await expect(target).toHaveAttribute("data-renderer-model-loads", initial.models ?? "1");
  await expect(target).toHaveAttribute("data-renderer-scene-rebuilds", initial.scenes ?? "1");
  await expect(target).toHaveAttribute("data-renderer-surface-rebuilds", initial.surfaces ?? "{}");
  await expect(target).toHaveAttribute("data-scientific-revision", initial.revision ?? "");

  // Exercise the stale-result guard while returning to the authoritative VDW
  // presentation before the camera checks below.
  await style.selectOption("cartoon");
  await expect(target).not.toHaveAttribute("data-surface-ready", "true");
  await style.selectOption("van-der-waals-surface");
  await expect(target).toHaveAttribute("data-surface-state", "ready", { timeout: 90000 });
  await expect(target).toHaveAttribute("data-renderer-surface-object-count", "1");
  await expect(target).toHaveAttribute("data-renderer-object-projection", /"representation":"van-der-waals-surface"/);
  const afterRapidSwitch = await target.getAttribute("data-renderer-surface-rebuilds");

  const projection = page.getByRole("combobox", { name: "Projection mode" });
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-action", "FIT");
  await projection.selectOption("orthographic");
  await expect(projection).toHaveValue("orthographic");
  await expect(target).toHaveAttribute("data-camera-projection", "orthographic");
  await expect(target).toHaveAttribute("data-renderer-model-loads", initial.models ?? "1");
  await expect(target).toHaveAttribute("data-renderer-surface-rebuilds", afterRapidSwitch ?? "{}");
  await page.screenshot({ path: "verification/evidence/manual-gate-01/view-orthographic.png", animations: "disabled" });
});
