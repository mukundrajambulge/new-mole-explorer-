import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const topology = resolve("tests/fixtures/r07-b2-topology.pdb");
const smallMolecule = resolve("tests/fixtures/g1c-small-molecule.pdb");
const multistate = resolve("tests/fixtures/multistate.pdb");

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
  await expect(consoleRegion.locator(".console-entry").last()).toContainText(value);
  return consoleRegion.locator(".console-entry").last();
};

test("R07-B2 delete selected reconciles canonical topology, viewer model, and exact undo/redo", async ({ page }) => {
  test.setTimeout(120000);
  await loadFile(page, topology);
  const viewer = page.getByTestId("molecular-viewer");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "4");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");
  const initialGeneration = await viewer.getAttribute("data-renderer-generation");
  const initialModelLoads = await viewer.getAttribute("data-renderer-model-loads");
  await runCommand(page, "select id 2");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete Selected", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Delete Selected", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "3");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "0");
  expect(await viewer.getAttribute("data-renderer-generation")).not.toBe(initialGeneration);
  await expect(viewer).toHaveAttribute("data-renderer-model-loads", initialModelLoads!);
  await page.screenshot({ path: "verification/evidence/r07-b2/delete-selected.png", fullPage: true });
  await page.locator('button[data-action-id="HISTORY.UNDO"]').evaluate((element) => (element as HTMLButtonElement).click());
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "4");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");
  await page.locator('button[data-action-id="HISTORY.REDO"]').evaluate((element) => (element as HTMLButtonElement).click());
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "3");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "0");
});

test("R07-B2 console bond, unbond, and bond-order commands use canonical endpoint and order contracts", async ({ page }) => {
  test.setTimeout(120000);
  await loadFile(page, topology);
  const viewer = page.getByTestId("molecular-viewer");
  await runCommand(page, "bond id 3, id 4, double");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "3");
  await expect(viewer).toHaveAttribute("data-canonical-bond-orders", /DOUBLE/);
  await runCommand(page, "unbond id 3, id 4");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");
  await runCommand(page, "set_bond order, double, id 1, id 2");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");
  await expect(viewer).toHaveAttribute("data-canonical-bond-orders", /DOUBLE/);
  await page.screenshot({ path: "verification/evidence/r07-b2/bond-order-replacement.png", fullPage: true });
});

test("R07-B2 rejects self-bond and cross-object topology without partial success", async ({ page }) => {
  test.setTimeout(120000);
  await loadFile(page, topology);
  const viewer = page.getByTestId("molecular-viewer");
  const initialRevision = await viewer.getAttribute("data-scientific-revision");
  const self = await runCommand(page, "bond id 1, id 1");
  await expect(self).toContainText("SELF_BOND");
  await expect(viewer).toHaveAttribute("data-scientific-revision", initialRevision!);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(smallMolecule);
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
  const cross = await runCommand(page, "bond object r07-b2-topology.pdb and id 1, object g1c-small-molecule.pdb and id 1");
  await expect(cross).toContainText("CROSS_OBJECT_TOPOLOGY_UNSUPPORTED");
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
});

test("R07-B2 deletion preserves multi-state membership and history cursor", async ({ page }) => {
  test.setTimeout(120000);
  await loadFile(page, multistate);
  const viewer = page.getByTestId("molecular-viewer");
  await runCommand(page, "count_states multistate.pdb");
  await expect(page.getByRole("region", { name: "Command and selection console" }).locator(".console-entry").last()).toContainText("2 canonical coordinate states");
  await runCommand(page, "remove id 1");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "3");
  await runCommand(page, "state multistate.pdb, 2");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "3");
  await runCommand(page, "undo");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "4");
  await runCommand(page, "redo");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "3");
});
