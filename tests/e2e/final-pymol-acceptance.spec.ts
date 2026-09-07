import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const viewer = (page: import("@playwright/test").Page) => page.getByTestId("molecular-viewer");

const loadFixture = async (page: import("@playwright/test").Page) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(viewer(page)).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
};

const runCommand = async (page: import("@playwright/test").Page, value: string) => {
  const input = page.getByRole("textbox", { name: "Command or selection query" });
  await input.fill(value);
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" }).locator(".console-entry").last()).toContainText(value);
};

test("final acceptance keeps scenes, ownership and console within the workspace", async ({ page }) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/mini-protein.pdb");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const scenes = page.getByTestId("scene-manager");
    const sceneBox = (await scenes.boundingBox())!;
    expect(sceneBox.y + sceneBox.height).toBeLessThan(size.height - 20);
    const store = (await page.getByTestId("scene-store").boundingBox())!;
    expect(store.y + store.height).toBeLessThanOrEqual(sceneBox.y + sceneBox.height);
    const owner = page.getByTestId("active-object-state");
    expect(await owner.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const before = (await page.getByTestId("molecular-viewer").boundingBox())!;
    await page.getByRole("button", { name: "Collapse console", exact: true }).click();
    const collapsed = (await page.getByTestId("molecular-viewer").boundingBox())!;
    expect(collapsed).toEqual(before);
    await page.getByRole("button", { name: "Expand console", exact: true }).click();
    const consoleBox = (await page.getByRole("region", { name: "Command and selection console" }).boundingBox())!;
    expect(consoleBox.y + consoleBox.height).toBeLessThanOrEqual(sceneBox.y);
  }
  await page.getByTestId("scene-name").fill("Acceptance scene");
  await page.getByTestId("scene-store").click();
  await expect(page.getByTestId("scene-card")).toContainText("Acceptance scene");
});

test("final acceptance covers camera, ligand color, selection, and representation together", async ({ page }) => {
  await loadFixture(page);
  const target = viewer(page);
  await page.getByRole("combobox", { name: "Protein representation" }).selectOption("sticks");
  await page.getByRole("combobox", { name: "Ligand representation" }).selectOption("sticks");
  const ligandColor = page.getByRole("combobox", { name: "Ligand color" });
  await ligandColor.selectOption("custom");
  await page.getByLabel("Ligand custom color").fill("#ff00aa");
  await page.getByRole("combobox", { name: "Projection mode" }).selectOption("orthographic");
  await expect(target).toHaveAttribute("data-camera-projection", "orthographic");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(target).toHaveAttribute("data-camera-action", "FIT");
  await runCommand(page, "select object mini-protein.pdb and resi 1");
  await expect(page.getByTestId("active-selection")).toContainText("4 atoms");
  await expect(target).toHaveAttribute("data-selection-indicator", "visible");
  await page.screenshot({ path: resolve("verification/evidence/final-pymol-acceptance/16-cross-feature/01-camera-color-selection.png"), animations: "disabled" });
  await runCommand(page, "select none");
  await expect(target).toHaveAttribute("data-selection-indicator", "none");
});

test("final acceptance covers R07 edit undo/redo, R08 alignment, R09 scene save, and R10 rejection", async ({ page }) => {
  await loadFixture(page);
  const target = viewer(page);
  await runCommand(page, "select object mini-protein.pdb and id 1");
  await runCommand(page, "edit_test");
  await expect(page.getByTestId("scientific-history-state")).toContainText("undo");
  await runCommand(page, "undo");
  await expect(page.getByTestId("scientific-history-state")).toContainText("redo");
  await runCommand(page, "redo");
  await expect(page.getByTestId("scientific-history-state")).toContainText("undo");
  await runCommand(page, "rms_cur all, all");
  await expect(page.getByTestId("alignment-results")).toContainText("RMS");
  await page.getByTestId("scene-name").fill("Final acceptance A");
  await page.getByTestId("scene-store").click();
  await expect(page.getByTestId("scene-card")).toContainText("Final acceptance A");
  await runCommand(page, "python print(\"hello\")");
  await expect(page.getByRole("region", { name: "Command and selection console" }).locator(".console-entry").last()).toContainText("UNSAFE_COMMAND_REJECTED");
  await expect(target).toHaveAttribute("data-viewer-state", "loaded");
  await page.screenshot({ path: resolve("verification/evidence/final-pymol-acceptance/16-cross-feature/02-r07-r08-r09-r10.png"), animations: "disabled" });
});
