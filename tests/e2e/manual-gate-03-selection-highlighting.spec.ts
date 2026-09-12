import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "node:path";

const evidenceDir = resolve("verification/evidence/manual-gate-03-selection");

const viewer = (page: Page) => page.getByTestId("molecular-viewer");

const capture = (page: Page, name: string) => page.screenshot({ path: resolve(evidenceDir, name), animations: "disabled", fullPage: true });

const openRcsb = async (page: Page, id: string, add = false) => {
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill(id);
  await page.getByRole("button", { name: add ? "RCSB add" : "RCSB fetch", exact: true }).click();
  await expect(page.getByTitle(`${id}.cif`).first()).toBeVisible({ timeout: 60000 });
};

const runCommand = async (page: Page, value: string) => {
  if (await page.getByRole("button", { name: "Expand console", exact: true }).count()) await page.getByRole("button", { name: "Expand console", exact: true }).click();
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill(value);
  await page.getByRole("button", { name: /Run/ }).click();
  const entry = consoleRegion.locator(".console-entry").last();
  await expect(entry).toContainText(value);
  return entry;
};

const selectedCountFrom = async (entry: Locator): Promise<number> => {
  const text = await entry.innerText();
  const match = text.match(/Selected ([\d,]+) atoms/);
  expect(match, `selection command did not report a count: ${text}`).toBeTruthy();
  return Number(match![1].replaceAll(",", ""));
};

const expectVisibleSelection = async (page: Page, count: number) => {
  await expect(viewer(page)).toHaveAttribute("data-selection-indicator", "visible");
  await expect(viewer(page)).toHaveAttribute("data-selection-highlighted-atom-count", String(count));
  await expect(viewer(page)).toHaveAttribute("data-selection-highlight-limit", "none");
  await expect(viewer(page)).not.toHaveAttribute("data-selection-highlight-mode", "none");
  await expect(page.getByTestId("active-selection")).toContainText(`${count.toLocaleString("en-US")} atoms`);
};

const pickCanvasAtom = async (page: Page) => {
  const canvas = viewer(page).locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  for (const [x, y] of [[0.5, 0.5], [0.35, 0.5], [0.65, 0.5], [0.5, 0.35], [0.5, 0.65]]) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    if (await page.getByTestId("active-selection").count()) return;
  }
  throw new Error("canvas picking did not resolve a canonical atom");
};

const rotateCanvas = async (page: Page) => {
  const canvas = viewer(page).locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.28, box.y + box.height * 0.32);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.48, { steps: 10 });
  await page.mouse.up();
};

test("MANUAL GATE 03 selection highlighting is visible, scalable, and object-isolated", async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/molstudio");
  await openRcsb(page, "4DJW");

  const target = viewer(page);
  await expect(target).toHaveAttribute("data-canonical-atom-count", "7079", { timeout: 60000 });
  const singleObjectScientificRevision = await target.getAttribute("data-scientific-revision");
  const singleObjectModelLoads = await target.getAttribute("data-renderer-model-loads");
  const singleObjectSceneRebuilds = await target.getAttribute("data-renderer-scene-rebuilds");

  await pickCanvasAtom(page);
  await expect(target).toHaveAttribute("data-selection-indicator", "visible");
  const singleCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and id 1"));
  expect(singleCount).toBe(1);
  await expectVisibleSelection(page, singleCount);
  await expect(target).toHaveAttribute("data-selection-highlight-mode", "atom-halo-overlay");
  await capture(page, "01-single-atom.png");

  const residueCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and resi 50"));
  expect(residueCount).toBeGreaterThan(1);
  await expectVisibleSelection(page, residueCount);
  await capture(page, "02-residue.png");

  const chainCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and chain A"));
  expect(chainCount).toBeGreaterThan(100);
  await expectVisibleSelection(page, chainCount);
  await capture(page, "03-chain.png");

  const ligandCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and ligand"));
  expect(ligandCount).toBeGreaterThan(0);
  await expectVisibleSelection(page, ligandCount);
  await capture(page, "04-ligand.png");

  const nameCaCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and name CA"));
  expect(nameCaCount).toBeGreaterThan(100);
  await expectVisibleSelection(page, nameCaCount);
  const namedEntry = await runCommand(page, "select active_site, object 4DJW.cif and name CA");
  await expect(namedEntry).toContainText("Named selection active_site created");
  await expectVisibleSelection(page, nameCaCount);

  const largeCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif"));
  expect(largeCount).toBe(7079);
  expect(largeCount).toBeGreaterThan(128);
  await expectVisibleSelection(page, largeCount);
  await expect(target).toHaveAttribute("data-selection-highlight-mode", "representation-overlay");
  await capture(page, "05-large-selection.png");

  await runCommand(page, "select none");
  await expect(target).toHaveAttribute("data-selected-atoms", "0");
  await expect(target).toHaveAttribute("data-selection-indicator", "none");
  await expect(target).toHaveAttribute("data-selection-highlighted-atom-count", "0");
  await expect(target).toHaveAttribute("data-scientific-revision", singleObjectScientificRevision ?? "");
  await expect(target).toHaveAttribute("data-renderer-model-loads", singleObjectModelLoads ?? "");
  await expect(target).toHaveAttribute("data-renderer-scene-rebuilds", singleObjectSceneRebuilds ?? "");
  await capture(page, "06-clear-selection.png");

  await openRcsb(page, "1CRN", true);
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(target).toHaveAttribute("data-renderer-model-count", "2");
  const multiObjectScientificRevision = await target.getAttribute("data-scientific-revision");
  const multiObjectModelLoads = await target.getAttribute("data-renderer-model-loads");
  const multiObjectSceneRebuilds = await target.getAttribute("data-renderer-scene-rebuilds");
  const isolated4djwCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and chain A"));
  await expectVisibleSelection(page, isolated4djwCount);
  await capture(page, "07-multi-object-isolation.png");
  const isolated1crnCount = await selectedCountFrom(await runCommand(page, "select object 1CRN.cif and chain A"));
  expect(isolated1crnCount).toBeGreaterThan(0);
  await expectVisibleSelection(page, isolated1crnCount);

  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  const viewBeforeRotation = await target.getAttribute("data-camera-view");
  await rotateCanvas(page);
  await expect(target).toHaveAttribute("data-camera-action", "ROTATE");
  await expect.poll(async () => target.getAttribute("data-camera-view"), { timeout: 5000 }).not.toBe(viewBeforeRotation);
  await expectVisibleSelection(page, isolated1crnCount);
  await capture(page, "08-selected-after-rotation.png");

  await page.getByRole("button", { name: "Display", exact: true }).click();
  await page.getByRole("button", { name: "Ball & Stick", exact: true }).click();
  await expect(target).toHaveAttribute("data-projection", "ball-and-stick");
  await expectVisibleSelection(page, isolated1crnCount);
  await expect(target).toHaveAttribute("data-selection-highlight-mode", "representation-overlay");
  await capture(page, "09-selected-after-representation-change.png");

  await expect(target).toHaveAttribute("data-scientific-revision", multiObjectScientificRevision ?? "");
  await expect(target).toHaveAttribute("data-renderer-model-loads", multiObjectModelLoads ?? "");
  await expect(target).toHaveAttribute("data-renderer-scene-rebuilds", multiObjectSceneRebuilds ?? "");
});
