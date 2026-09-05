import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const topology = resolve("tests/fixtures/r07-b2-topology.pdb");
const mini = resolve("tests/fixtures/mini-protein.pdb");
const explicitHydrogen = resolve("tests/fixtures/r07-b3-explicit-h.pdb");
const ligand = resolve("tests/fixtures/g1c-small-molecule.pdb");
const multiState = resolve("tests/fixtures/multistate.pdb");
const evidenceDir = resolve("verification/evidence/r07-operational-closure");

const capture = (page: Page, name: string) => page.screenshot({ path: resolve(evidenceDir, name), animations: "disabled", fullPage: true });

const loadFile = async (page: Page, file: string) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByTitle(file.split(/[\\/]/).pop()!).first()).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
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

const openEdit = async (page: Page) => {
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByTestId("edit-state")).toBeVisible();
};

const pickCanvasAtom = async (page: Page) => {
  const viewer = page.getByTestId("molecular-viewer");
  const canvas = viewer.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  for (const fraction of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    await page.mouse.click(box!.x + box!.width * fraction, box!.y + box!.height / 2);
    if (await page.getByTestId("active-selection").count()) return;
  }
  throw new Error("a real canvas pointer click should resolve a canonical atom");
};

test("R07 objects, real names, ON/OFF state, and isolation are operational in the UI", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadFile(page, mini);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(ligand);
  const panel = page.getByTestId("objects-selections-panel");
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  const miniRow = panel.locator('[data-object-name="mini-protein.pdb"]');
  const ligandRow = panel.locator('[data-object-name="g1c-small-molecule.pdb"]');
  await expect(miniRow).toHaveAttribute("data-object-enabled", "true");
  await expect(ligandRow).toHaveAttribute("data-object-enabled", "true");

  await page.screenshot({ path: resolve(evidenceDir, "01-two-real-objects.png"), animations: "disabled", fullPage: true });
  await miniRow.getByRole("button", { name: "Disable mini-protein.pdb" }).click();
  await expect(miniRow).toHaveAttribute("data-object-enabled", "false");
  await expect(page.getByTestId("status-active-object")).toContainText("g1c-small-molecule.pdb · ON");
  await capture(page, "02-object-a-off.png");
  await expect(await runCommand(page, "object mini-protein.pdb")).toContainText(/Selected [\d,]+ atoms/);
  await openEdit(page);
  await expect(page.getByTestId("edit-state")).toHaveAttribute("data-edit-selection-ready", "false");
  await expect(page.getByRole("button", { name: "Delete Selected", exact: true })).toBeDisabled();
  await expect(await runCommand(page, "remove object mini-protein.pdb")).toContainText("OBJECT_DISABLED");
  await ligandRow.getByRole("button", { name: "Disable g1c-small-molecule.pdb" }).click();
  await expect(ligandRow).toHaveAttribute("data-object-enabled", "false");
  await capture(page, "03-object-b-off.png");

  await miniRow.getByRole("button", { name: "Enable mini-protein.pdb" }).click();
  await ligandRow.getByRole("button", { name: "Enable g1c-small-molecule.pdb" }).click();
  await runCommand(page, "unpick");
  const selected = await runCommand(page, "object g1c-small-molecule");
  await expect(selected).toContainText(/Selected [\d,]+ atoms/);
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  await capture(page, "04-real-object-selection.png");

  await miniRow.getByRole("button", { name: "Disable mini-protein.pdb" }).click();
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  await expect(ligandRow).toHaveAttribute("data-object-enabled", "true");
  await capture(page, "17-object-isolation.png");
});

test("R07 history root, edit, undo, and redo are visible and button-operational", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadFile(page, mini);
  const history = page.getByTestId("scientific-history-state");
  await expect(history).toHaveAttribute("data-history-can-undo", "false");
  await capture(page, "05-history-root.png");
  await runCommand(page, "select id 1");
  await runCommand(page, "edit_test");
  await expect(history).toHaveAttribute("data-history-can-undo", "true");
  await capture(page, "06-history-after-edit.png");
  await openEdit(page);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();
  await undo.click();
  await expect(history).toHaveAttribute("data-history-can-undo", "false");
  await expect(history).toHaveAttribute("data-history-can-redo", "true");
  await capture(page, "07-undo.png");
  await redo.click();
  await expect(history).toHaveAttribute("data-history-can-undo", "true");
  await expect(history).toHaveAttribute("data-history-can-redo", "false");
  await capture(page, "08-redo.png");
});

test("R07 B2 UI buttons commit delete and bond edits through canonical history", async ({ page }) => {
  test.setTimeout(120000);
  await loadFile(page, topology);
  const viewer = page.getByTestId("molecular-viewer");
  await runCommand(page, "select id 2");
  await openEdit(page);
  const deleteSelected = page.getByRole("button", { name: "Delete Selected", exact: true });
  await expect(deleteSelected).toBeEnabled();
  await deleteSelected.click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "3");
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "0");
  await capture(page, "09-b2-delete-selected.png");

  await loadFile(page, topology);
  await runCommand(page, "select id 3 or id 4");
  await openEdit(page);
  const createBond = page.getByRole("button", { name: "Create Bond", exact: true });
  await expect(createBond).toBeEnabled();
  await createBond.click();
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "3");
  await capture(page, "10-b2-bond.png");
});

test("R07 B3 UI buttons commit add, refill, remove, attach, and replace operations", async ({ page }) => {
  test.setTimeout(180000);
  const viewer = page.getByTestId("molecular-viewer");

  await loadFile(page, topology);
  await runCommand(page, "select id 1");
  await openEdit(page);
  await page.getByRole("button", { name: "Add Hydrogens", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "7");
  await capture(page, "11-b3-add-h.png");

  await loadFile(page, explicitHydrogen);
  await runCommand(page, "select id 1");
  await openEdit(page);
  await page.getByRole("button", { name: "Refill Hydrogens", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");
  await capture(page, "12-b3-refill-h.png");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "2");
  await runCommand(page, "select id 2");
  await openEdit(page);
  await page.getByRole("button", { name: "Remove Explicit H", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "1");
  await capture(page, "13-b3-remove-h.png");

  await loadFile(page, topology);
  await runCommand(page, "select id 2");
  await openEdit(page);
  await page.getByRole("button", { name: "Attach Atom", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");
  await capture(page, "14-b3-attach.png");

  await loadFile(page, topology);
  await runCommand(page, "select id 2");
  await openEdit(page);
  await page.getByRole("button", { name: "Replace Atom", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");
  await capture(page, "15-b3-replace.png");
});

test("R07 selection, roots, visibility, diagnostics, and command/UI object equivalence are explicit", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadFile(page, mini);
  const panel = page.getByTestId("objects-selections-panel");
  const viewer = page.getByTestId("molecular-viewer");
  const history = page.getByTestId("scientific-history-state");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const run = async (value: string) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    const entry = consoleRegion.locator(".console-entry").last();
    await expect(entry).toContainText(value);
    return entry;
  };
  const addPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await addPromise).setFiles(ligand);
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  const miniRow = panel.locator('[data-object-name="mini-protein.pdb"]');
  const ligandRow = panel.locator('[data-object-name="g1c-small-molecule.pdb"]');
  await expect(history).toHaveAttribute("data-history-can-undo", "false");
  const rootRevision = await history.getAttribute("data-history-current-revision");
  expect(rootRevision).toBeTruthy();
  await expect(await run("history")).toContainText('"retainedRevisionCount":1');
  await expect(await run("object mini-protein.pdb and id 1")).toContainText("Selected 1 atoms");
  await expect(await run("object g1c-small-molecule.pdb and id 1")).toContainText("Selected 1 atoms");
  await expect(await run("object nonexistent-structure.cif and id 1")).toContainText(/No loaded object matches|OBJECT_NOT_FOUND|does not resolve/);
  await run("unpick");
  await expect(page.getByTestId("active-selection")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete Selected", exact: true })).toBeDisabled();

  const initialProjection = await viewer.getAttribute("data-renderer-object-projection");
  expect(initialProjection).toBeTruthy();
  await miniRow.getByRole("button", { name: "Disable mini-protein.pdb" }).click();
  await expect(miniRow).toHaveAttribute("data-object-enabled", "false");
  await expect(viewer).toHaveAttribute("data-renderer-object-projection", new RegExp('"enabled":false'));
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
  await expect(ligandRow).toHaveAttribute("data-object-enabled", "true");
  await expect(history).toHaveAttribute("data-history-current-revision", rootRevision!);
  await miniRow.getByRole("button", { name: "Enable mini-protein.pdb" }).click();
  await expect(miniRow).toHaveAttribute("data-object-enabled", "true");
  await expect(viewer).toHaveAttribute("data-renderer-model-count", "2");
  await expect(history).toHaveAttribute("data-history-current-revision", rootRevision!);
  await run("disable mini-protein.pdb");
  await expect(miniRow).toHaveAttribute("data-object-enabled", "false");
  await run("enable mini-protein.pdb");
  await expect(miniRow).toHaveAttribute("data-object-enabled", "true");
  await expect(history).toHaveAttribute("data-history-current-revision", rootRevision!);
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await expect(history).toHaveAttribute("data-history-can-undo", "false");
  await expect(page.getByTestId("status-active-object")).toContainText("g1c-small-molecule.pdb · ON");
});

test("R07 history supports multiple revisions and fail-closed branch-after-undo semantics", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadFile(page, mini);
  const viewer = page.getByTestId("molecular-viewer");
  const history = page.getByTestId("scientific-history-state");
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const run = async (value: string) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    const entry = consoleRegion.locator(".console-entry").last();
    await expect(entry).toContainText(value);
    return entry;
  };
  await run("select id 1");
  await run("edit_test");
  await expect(history).toHaveAttribute("data-history-can-undo", "true");
  await expect(await run("history")).toContainText('"retainedRevisionCount":2');
  await run("undo");
  await expect(history).toHaveAttribute("data-history-can-redo", "true");
  await loadFile(page, topology);
  await run("select id 1");
  await run("edit_test");
  await run("undo");
  await run("select id 2");
  await run("remove id 2");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "3");
  await expect(history).toHaveAttribute("data-history-can-redo", "false");
  await expect(await run("redo")).toContainText(/REDO_BRANCH_AMBIGUOUS|REDO_UNAVAILABLE/);
  const afterBranch = await run("history");
  await expect(await run("bond id 1, id 1")).toContainText("SELF_BOND");
  const afterFailure = await run("history");
  expect(afterFailure).toContainText((await afterBranch.innerText()).match(/retainedRevisionCount[^,]+/)?.[0] ?? "retainedRevisionCount");
  await expect(viewer).toHaveAttribute("data-scientific-revision", await history.getAttribute("data-history-current-revision") ?? "");
});

test("R07 B2 UI covers Delete Bond and all supported bond-order transitions", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadFile(page, topology);
  const viewer = page.getByTestId("molecular-viewer");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const run = async (value: string) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion.locator(".console-entry").last()).toContainText(value);
  };
  await run("select id 3 or id 4");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Create Bond", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "3");
  await run("select id 3 or id 4");
  await expect(page.getByRole("button", { name: "Delete Bond", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Delete Bond", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");
  await expect(page.getByTestId("active-selection")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "3");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");

  for (const order of ["DOUBLE", "TRIPLE", "AROMATIC", "SINGLE"]) {
    await loadFile(page, topology);
    await run("select id 1 or id 2");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const orderSelect = page.getByRole("combobox", { name: "Bond order" });
    await expect(orderSelect).toBeEnabled();
    await orderSelect.selectOption(order);
    await expect(viewer).toHaveAttribute("data-canonical-bond-count", "2");
    if (order === "SINGLE") await expect(viewer).toHaveAttribute("data-canonical-bond-orders", /SINGLE/);
    else await expect(viewer).toHaveAttribute("data-canonical-bond-orders", new RegExp(order));
  }
});

test("R07 multi-state chemistry remains explicit and undoable through the UI", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadFile(page, multiState);
  const panel = page.getByTestId("objects-selections-panel");
  const row = panel.locator('[data-object-name="multistate.pdb"]');
  const viewer = page.getByTestId("molecular-viewer");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const history = page.getByTestId("scientific-history-state");
  await command.fill("select id 1");
  await page.getByRole("button", { name: /Run/ }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Add Hydrogens", exact: true }).click();
  await expect(row).toContainText("2 states");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "7");
  const stateOneIds = await viewer.getAttribute("data-canonical-atom-ids");
  await row.getByRole("button", { name: "Next state for multistate.pdb" }).click();
  await expect(row).toContainText("2/2");
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "7");
  expect(await viewer.getAttribute("data-canonical-atom-ids")).toBe(stateOneIds);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "4");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "7");
  await expect(history).toHaveAttribute("data-history-can-undo", "true");
  await expect(history).toHaveAttribute("data-history-can-redo", "false");
});

test("R07 pointer picking supplies a canonical target to the edit ribbon", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadFile(page, topology);
  const viewer = page.getByTestId("molecular-viewer");
  await pickCanvasAtom(page);
  await expect(page.getByTestId("context-panel")).toContainText(/Element/);
  await capture(page, "16-picked-edit.png");
  await openEdit(page);
  await expect(page.getByRole("button", { name: "Add Hydrogens", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Add Hydrogens", exact: true }).click();
  await expect(viewer).not.toHaveAttribute("data-canonical-atom-count", "4");

  await loadFile(page, explicitHydrogen);
  await pickCanvasAtom(page);
  await openEdit(page);
  await expect(page.getByRole("button", { name: "Refill Hydrogens", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Refill Hydrogens", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");

  await loadFile(page, topology);
  await pickCanvasAtom(page);
  await openEdit(page);
  await expect(page.getByRole("button", { name: "Attach Atom", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Attach Atom", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");

  await loadFile(page, topology);
  await pickCanvasAtom(page);
  await openEdit(page);
  await expect(page.getByRole("button", { name: "Replace Atom", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Replace Atom", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-canonical-atom-count", "5");
});

test("R07 real 4DJW and 1CRN objects remain name-addressable after RCSB add", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("4DJW");
  await page.getByRole("button", { name: "RCSB fetch" }).click();
  await expect(page.getByTitle("4DJW.cif").first()).toBeVisible({ timeout: 60000 });
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("1CRN");
  await page.getByRole("button", { name: "RCSB add" }).click();
  await expect(page.getByTitle("1CRN.cif").first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await capture(page, "01-two-real-objects.png");
  const firstObject = page.getByTestId("objects-selections-panel").locator('[data-object-name="4DJW.cif"]');
  const secondObject = page.getByTestId("objects-selections-panel").locator('[data-object-name="1CRN.cif"]');
  await firstObject.getByRole("button", { name: "Focus 4DJW.cif" }).click();
  const firstHistory = await runCommand(page, "history");
  await expect(firstHistory).toContainText('"retainedRevisionCount":1');
  await expect(firstHistory).toContainText('"canUndo":false');
  const command = await runCommand(page, "object 4DJW.cif and id 1");
  await expect(command).toContainText(/Selected [\d,]+ atoms/);
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  await runCommand(page, "unpick");
  await secondObject.getByRole("button", { name: "Focus 1CRN.cif" }).click();
  const secondHistory = await runCommand(page, "history");
  await expect(secondHistory).toContainText('"retainedRevisionCount":1');
  await expect(secondHistory).toContainText('"canUndo":false');
  await expect(await runCommand(page, "object 1CRN.cif and id 1")).toContainText(/Selected [\d,]+ atoms/);
  await expect(page.getByTestId("objects-selections-panel").locator('[data-object-name="4DJW.cif"]')).toHaveAttribute("data-object-enabled", "true");
  await expect(page.getByTestId("objects-selections-panel").locator('[data-object-name="1CRN.cif"]')).toHaveAttribute("data-object-enabled", "true");
});
