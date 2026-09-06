import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "node:path";

const evidenceDir = resolve("verification/evidence/manual-gate-03b-selection");

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

const expectFocusedSelection = async (page: Page, count: number) => {
  const target = viewer(page);
  await expect(target).toHaveAttribute("data-selection-indicator", "visible");
  await expect(target).toHaveAttribute("data-selection-highlighted-atom-count", String(count));
  await expect(target).toHaveAttribute("data-camera-action", "FOCUS_SELECTION");
  await expect(target).toHaveAttribute("data-camera-target-mode", "selection");
  await expect(target).toHaveAttribute("data-camera-target-atom-count", String(count));
  await expect(target).toHaveAttribute("data-selection-deemphasis", "active");
  await expect(target).toHaveAttribute("data-selection-deemphasis-opacity", "0.46");
  await expect(page.getByTestId("active-selection")).toContainText(`${count.toLocaleString("en-US")} atoms`);
};

test("MANUAL GATE 03B focuses residue and chain selections across representation and color changes", async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/molstudio");
  await openRcsb(page, "4DJW");

  const target = viewer(page);
  await expect(target).toHaveAttribute("data-canonical-atom-count", "7079", { timeout: 60000 });
  const scientificRevision = await target.getAttribute("data-scientific-revision");
  const modelLoads = await target.getAttribute("data-renderer-model-loads");
  const sceneRebuilds = await target.getAttribute("data-renderer-scene-rebuilds");

  const residueCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and resi 50"));
  expect(residueCount).toBeGreaterThan(1);
  await expectFocusedSelection(page, residueCount);
  await expect(page.getByTestId("selection-scope")).toContainText("4DJW.cif");
  await capture(page, "01-residue-autofocus.png");

  const secondResidueCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and resi 50"));
  expect(secondResidueCount).toBeGreaterThan(1);
  await expectFocusedSelection(page, secondResidueCount);
  await capture(page, "02-residue-emphasis.png");

  const chainCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and chain A"));
  expect(chainCount).toBeGreaterThan(100);
  await expectFocusedSelection(page, chainCount);
  await expect(target).toHaveAttribute("data-selection-highlight-mode", "representation-overlay");
  await capture(page, "03-chain-cartoon.png");

  await page.getByLabel("Style").selectOption("sticks");
  await expect(target).toHaveAttribute("data-projection", "sticks");
  await expectFocusedSelection(page, chainCount);
  await expect(target).toHaveAttribute("data-scientific-revision", scientificRevision ?? "");
  await expect(target).toHaveAttribute("data-renderer-model-loads", modelLoads ?? "");
  await expect(target).toHaveAttribute("data-renderer-scene-rebuilds", sceneRebuilds ?? "");
  await capture(page, "04-chain-stick.png");

  await page.getByLabel("Style").selectOption("ball-and-stick");
  await expect(target).toHaveAttribute("data-projection", "ball-and-stick");
  await expectFocusedSelection(page, chainCount);
  await capture(page, "05-chain-ball-stick.png");

  await page.getByLabel("Color mode").selectOption("monochrome");
  await expectFocusedSelection(page, chainCount);
  await capture(page, "08-selection-color-change.png");

  await runCommand(page, "select none");
  await expect(target).toHaveAttribute("data-selection-indicator", "none");
  await expect(target).toHaveAttribute("data-selection-highlighted-atom-count", "0");
  await expect(target).toHaveAttribute("data-selection-deemphasis", "none");
  await expect(target).toHaveAttribute("data-selection-deemphasis-opacity", "1");
  await expect(target).toHaveAttribute("data-scientific-revision", scientificRevision ?? "");
  await expect(target).toHaveAttribute("data-renderer-model-loads", modelLoads ?? "");
  await expect(target).toHaveAttribute("data-renderer-scene-rebuilds", sceneRebuilds ?? "");
  await capture(page, "09-clear-restored.png");
});

test("MANUAL GATE 03B keeps ligand focus visible while ligand representation changes", async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/molstudio");
  await openRcsb(page, "4DJW");

  const target = viewer(page);
  await expect(target).toHaveAttribute("data-canonical-atom-count", "7079", { timeout: 60000 });
  const ligandCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and ligand"));
  expect(ligandCount).toBeGreaterThan(0);
  await expectFocusedSelection(page, ligandCount);
  await capture(page, "06-ligand-focus.png");

  const chainCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and chain A"));
  expect(chainCount).toBeGreaterThan(100);
  await expectFocusedSelection(page, chainCount);

  const ligandRepresentation = page.getByLabel("Ligand representation");
  await expect(ligandRepresentation.locator("option[value=mesh]")).toBeEnabled();
  await ligandRepresentation.selectOption("mesh");
  await expect(target).toHaveAttribute("data-surface-state", /generating|ready/, { timeout: 60000 });
  await expectFocusedSelection(page, chainCount);
  await expect(target).toHaveAttribute("data-selection-deemphasis", "active");
  await capture(page, "07-ligand-representation-change.png");
});

test("MANUAL GATE 03B reports selection ownership separately from active object", async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/molstudio");
  await openRcsb(page, "4DJW");
  await openRcsb(page, "1CRN", true);

  const target = viewer(page);
  await expect(target).toHaveAttribute("data-renderer-model-count", "2");
  const selectedCount = await selectedCountFrom(await runCommand(page, "select object 4DJW.cif and chain A"));
  await expectFocusedSelection(page, selectedCount);

  const scope = page.getByTestId("selection-scope");
  await expect(scope).toHaveAttribute("data-selection-owner-names", /4DJW\.cif/);
  await expect(scope).toContainText("4DJW.cif");
  await expect(page.getByTestId("active-object-state")).toContainText("1CRN.cif");
  await expect(scope).toHaveAttribute("data-selection-scope-relation", "Selection owner differs from active object");
  await expect(scope).toContainText("4DJW.cif");
  await expect(scope).toContainText("active object 1CRN.cif");
  await expect(target).toHaveAttribute("data-selection-indicator", "visible");
  await expect(target).toHaveAttribute("data-selection-highlighted-atom-count", String(selectedCount));
  await capture(page, "10-multi-object-scope.png");
});
