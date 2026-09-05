import { expect, test, type Locator, type Page } from "@playwright/test";

const viewer = (page: Page) => page.getByTestId("molecular-viewer");
const molecularCanvas = (page: Page) => page.getByTestId("molecular-canvas");
const displayPanel = (page: Page) => page.getByTestId("projection-display-panel");

const openRcsb = async (page: Page, id: string, add = false) => {
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill(id);
  await page.getByRole("button", { name: add ? "RCSB add" : "RCSB fetch", exact: true }).click();
  await expect(page.getByTitle(`${id}.cif`).first()).toBeVisible({ timeout: 60000 });
};

const dragCanvas = async (page: Page, from: [number, number], to: [number, number]) => {
  const box = await viewer(page).locator("canvas").boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 10 });
  await page.mouse.up();
};

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

const geometry = async (page: Page) => ({
  canvas: await boxOf(molecularCanvas(page)),
  host: await boxOf(viewer(page)),
  webgl: await boxOf(viewer(page).locator("canvas")),
});

const assertFullCanvas = async (page: Page) => {
  const current = await geometry(page);
  expect(Math.abs(current.host.x - current.canvas.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.host.y - current.canvas.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.host.width - current.canvas.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.host.height - current.canvas.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.webgl.width - current.canvas.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.webgl.height - current.canvas.height)).toBeLessThanOrEqual(1);
};

const readJson = async <T>(target: Locator, name: string): Promise<T> => JSON.parse((await target.getAttribute(name)) ?? "null") as T;

const runCommand = async (page: Page, command: string) => {
  if (await page.getByRole("button", { name: "Expand console", exact: true }).count()) await page.getByRole("button", { name: "Expand console", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Command or selection query" });
  await input.fill(command);
  await page.getByRole("button", { name: /Run/ }).click();
};

test("MANUAL GATE 02 camera, viewport, structure integrity, and full-canvas closure", async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/molstudio");
  await openRcsb(page, "4DJW");

  const target = viewer(page);
  await expect(target).toHaveAttribute("data-canonical-atom-count", "7079", { timeout: 60000 });
  await expect(target).toHaveAttribute("data-camera-target-object-count", "1");
  await expect(target).toHaveAttribute("data-camera-target-atom-count", "6194");
  await assertFullCanvas(page);
  const expandedGeometry = await geometry(page);
  const initial = {
    revision: await target.getAttribute("data-scientific-revision"),
    models: await target.getAttribute("data-renderer-model-loads"),
    scenes: await target.getAttribute("data-renderer-scene-rebuilds"),
    surfaces: await target.getAttribute("data-renderer-surface-generations"),
  };

  await displayPanel(page).getByRole("button", { name: "Fit", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-action", "FIT");
  await expect(target).toHaveAttribute("data-camera-target-mode", "workspace-visible");
  await page.screenshot({ path: "verification/evidence/manual-gate-02/01-4djw-only-fit-console-expanded.png", animations: "disabled" });

  await page.getByRole("button", { name: "Collapse console", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand console", exact: true })).toBeVisible();
  await assertFullCanvas(page);
  const collapsedGeometry = await geometry(page);
  expect(Math.abs(collapsedGeometry.host.width - expandedGeometry.host.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(collapsedGeometry.host.height - expandedGeometry.host.height)).toBeLessThanOrEqual(1);
  const cameraPanBeforePan = await readJson<{ x: number; y: number }>(target, "data-camera-pan");
  await page.screenshot({ path: "verification/evidence/manual-gate-02/02-4djw-only-fit-console-collapsed.png", animations: "disabled" });

  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Pan", exact: true }).click();
  await dragCanvas(page, [0.48, 0.45], [0.74, 0.63]);
  await expect(target).toHaveAttribute("data-camera-action", "PAN");
  const panned = await readJson<{ x: number; y: number }>(target, "data-camera-pan");
  expect(Math.abs(panned.x) + Math.abs(panned.y)).toBeGreaterThan(0.01);
  await displayPanel(page).getByRole("button", { name: "Center", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-action", "CENTER");
  const centeredPan = await readJson<{ x: number; y: number }>(target, "data-camera-pan");
  expect(Math.abs(centeredPan.x - cameraPanBeforePan.x) + Math.abs(centeredPan.y - cameraPanBeforePan.y)).toBeLessThan(0.001);
  await page.screenshot({ path: "verification/evidence/manual-gate-02/03-4djw-centered-after-pan.png", animations: "disabled" });

  await runCommand(page, "select id 1");
  await expect(page.getByTestId("active-selection")).toContainText("1 atom");
  await displayPanel(page).getByRole("button", { name: "Center", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-target-mode", "workspace-visible");
  await expect(target).toHaveAttribute("data-camera-target-atom-count", "6194");
  await page.screenshot({ path: "verification/evidence/manual-gate-02/04-4djw-one-atom-selection-global-center.png", animations: "disabled" });

  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  const rotationViews: string[] = [];
  let previousRotationView = await target.getAttribute("data-camera-view");
  for (const [from, to, name] of [
    [[0.25, 0.24], [0.72, 0.35], "05-4djw-rotation-angle-1.png"],
    [[0.72, 0.35], [0.28, 0.38], "06-4djw-rotation-angle-2.png"],
    [[0.28, 0.38], [0.64, 0.26], "07-4djw-rotation-angle-3.png"],
  ] as const) {
    await dragCanvas(page, from, to);
    await expect(target).toHaveAttribute("data-camera-action", "ROTATE");
    await expect.poll(async () => target.getAttribute("data-camera-view"), { timeout: 3000 }).not.toBe(previousRotationView);
    const view = await target.getAttribute("data-camera-view");
    expect(view).toBeTruthy();
    rotationViews.push(view!);
    previousRotationView = view;
    await page.screenshot({ path: `verification/evidence/manual-gate-02/${name}`, animations: "disabled" });
  }
  expect(new Set(rotationViews).size).toBe(3);
  await expect(target).toHaveAttribute("data-scientific-revision", initial.revision ?? "");
  await expect(target).toHaveAttribute("data-renderer-model-loads", initial.models ?? "1");
  await expect(target).toHaveAttribute("data-renderer-scene-rebuilds", initial.scenes ?? "1");

  await displayPanel(page).getByRole("combobox", { name: "Projection mode" }).selectOption("orthographic");
  await expect(target).toHaveAttribute("data-camera-projection", "orthographic");
  await displayPanel(page).getByRole("button", { name: "Fit", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-action", "FIT");
  await expect(target).toHaveAttribute("data-camera-projection", "orthographic");
  await page.screenshot({ path: "verification/evidence/manual-gate-02/08-4djw-orthographic-fit.png", animations: "disabled" });

  await page.goto("/molstudio");
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRcsb(page, "1CRN");
  await displayPanel(page).getByRole("button", { name: "Fit", exact: true }).click();
  await expect(viewer(page)).toHaveAttribute("data-camera-action", "FIT");
  await expect(viewer(page)).toHaveAttribute("data-camera-target-object-count", "1");
  await assertFullCanvas(page);
  await page.screenshot({ path: "verification/evidence/manual-gate-02/09-1crn-only-fit.png", animations: "disabled" });

  await page.goto("/molstudio");
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRcsb(page, "4DJW");
  await openRcsb(page, "1CRN", true);
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(target).toHaveAttribute("data-renderer-model-count", "2");
  const twoObjectRevision = await target.getAttribute("data-scientific-revision");
  await displayPanel(page).getByRole("button", { name: "Fit", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-target-object-count", "2");
  const twoObjectTargetCount = Number(await target.getAttribute("data-camera-target-atom-count"));
  expect(twoObjectTargetCount).toBeGreaterThan(6194);
  await assertFullCanvas(page);
  await page.screenshot({ path: "verification/evidence/manual-gate-02/10-two-objects-fit.png", animations: "disabled" });

  await expect(target).toHaveAttribute("data-camera-target-object-count", "2");
  await expect(target).toHaveAttribute("data-camera-safe-viewport");
  await assertFullCanvas(page);
  await page.screenshot({ path: "verification/evidence/manual-gate-02/11-console-overlay-full-canvas.png", animations: "disabled" });

  await page.setViewportSize({ width: 1366, height: 768 });
  await expect.poll(async () => (await geometry(page)).canvas.width).toBeGreaterThan(500);
  await displayPanel(page).getByRole("button", { name: "Fit", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-action", "FIT");
  const resized = await readJson<{ width: number; height: number }>(target, "data-camera-viewport");
  expect(resized.width).toBeGreaterThan(500);
  expect(resized.height).toBeGreaterThan(300);
  await assertFullCanvas(page);
  await page.screenshot({ path: "verification/evidence/manual-gate-02/12-post-resize-fit-1366x768.png", animations: "disabled" });
  await expect(target).toHaveAttribute("data-scientific-revision", twoObjectRevision ?? "");
});
