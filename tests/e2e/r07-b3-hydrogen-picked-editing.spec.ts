import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const topology = resolve("tests/fixtures/r07-b2-topology.pdb");
const explicitHydrogen = resolve("tests/fixtures/r07-b3-explicit-h.pdb");

const loadFile = async (page: Page, file: string) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByTitle(file.split(/[\\/]/).pop()!)).toBeVisible();
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

test("R07-B3 add hydrogens and attach atom reconcile the authoritative child revision in the mounted viewer", async ({ page }) => {
  test.setTimeout(120000);
  await loadFile(page, topology);
  const viewer = page.getByTestId("molecular-viewer");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "4");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");
  const modelLoads = await viewer.getAttribute("data-renderer-model-loads");
  const initialGeneration = await viewer.getAttribute("data-renderer-generation");
  await runCommand(page, "h_add id 1");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "7");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "5");
  await expect(viewer).not.toHaveAttribute("data-renderer-generation", initialGeneration!);
  await expect(page.getByRole("region", { name: "Command and selection console" }).locator(".console-entry").last()).toContainText("COMMITTED");
  await expect(viewer).toHaveAttribute("data-renderer-model-loads", modelLoads!);
  await page.screenshot({ path: "verification/evidence/r07-b3/hydrogen-addition.png", fullPage: true });

  await runCommand(page, "unpick");
  await runCommand(page, "attach O, id 2");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "8");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "6");
  await expect(viewer).toHaveAttribute("data-renderer-model-loads", modelLoads!);
});

test("R07-B3 refill retires old explicit hydrogen identities atomically and exact undo restores the retained parent", async ({ page }) => {
  test.setTimeout(120000);
  await loadFile(page, explicitHydrogen);
  const viewer = page.getByTestId("molecular-viewer");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "2");
  const rootRevision = await viewer.getAttribute("data-scientific-revision");
  await runCommand(page, "h_fill id 1");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "4");
  await page.screenshot({ path: "verification/evidence/r07-b3/hydrogen-refill.png", fullPage: true });
  await runCommand(page, "undo");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "2");
  await expect(viewer).toHaveAttribute("data-scientific-revision", rootRevision!);
  await runCommand(page, "redo");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");
});
