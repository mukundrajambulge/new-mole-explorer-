import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const mini = resolve("tests/fixtures/mini-protein.pdb");
const ligand = resolve("tests/fixtures/g1c-small-molecule.pdb");
const multiState = resolve("tests/fixtures/multistate.pdb");

test("multiple canonical objects share one viewer and keep object scope independent", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(ligand);

  const panel = page.getByTestId("objects-selections-panel");
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await expect(panel).toContainText("mini-protein.pdb");
  await expect(panel).toContainText("g1c-small-molecule.pdb");

  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 3 atoms");
  await command.fill("chain A and object mini-protein.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 11 atoms");
  await command.fill("object mini-protein.pdb or object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 15 atoms");
  await command.fill("visible");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 14 atoms");

  const ligandRow = panel.locator("[data-object-id]").filter({ hasText: "g1c-small-molecule.pdb" });
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await page.getByRole("combobox", { name: "Style" }).selectOption("sticks");
  await panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" }).getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("cartoon");
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("sticks");
  await page.getByRole("combobox", { name: "Color mode" }).selectOption("monochrome");
  await panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" }).getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Color mode" })).toHaveValue("rainbow");
  await ligandRow.getByRole("button", { name: "Focus g1c-small-molecule.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Color mode" })).toHaveValue("monochrome");

  await command.fill("copy copied-mini, mini-protein.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel.locator("[data-object-id]")).toHaveCount(3);
  await expect(panel).toContainText("copied-mini");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "3");

  await command.fill("set_name copied-mini, copied-renamed");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel).toContainText("copied-renamed");

  await command.fill("create unsupported-object");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("create requires `create target, selection`");

  await ligandRow.getByRole("button", { name: "Disable g1c-small-molecule.pdb" }).click();
  await expect(ligandRow.getByRole("button", { name: "Enable g1c-small-molecule.pdb" })).toBeVisible();
  await command.fill("select all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 27 atoms");
  await command.fill("enabled");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 24 atoms");
  await command.fill("visible");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 22 atoms");
});

test("cross-object spatial selection requires and records an explicit coordinate frame", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(ligand);

  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const run = async (value: string) => { await command.fill(value); await page.getByRole("button", { name: /Run/ }).click(); };

  await run("object mini-protein.pdb within 2 of object g1c-small-molecule.pdb");
  await expect(consoleRegion).toContainText("Cross-object spatial selection requires an explicit LOCAL_SCIENTIFIC or EFFECTIVE_WORLD coordinate context");
  await expect(page.getByTestId("coordinate-frame").locator("select")).toHaveValue("");

  await run("coordinate_frame local_scientific");
  await expect(page.getByTestId("coordinate-frame").locator("select")).toHaveValue("LOCAL_SCIENTIFIC");
  await run("object mini-protein.pdb within 2 of object g1c-small-molecule.pdb");
  await expect(consoleRegion.locator(".console-entry").last()).toContainText(/Selected \d+ atoms/);
  await run("mini-protein.pdb within 2 of g1c-small-molecule.pdb");
  await expect(consoleRegion.locator(".console-entry").last()).toContainText(/Selected [1-9]\d* atoms/);
  await expect(page.getByTestId("active-selection")).toBeVisible();
  await consoleRegion.locator(".console-history").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.screenshot({ path: "verification/evidence/selection-cross-object-spatial.png", fullPage: true });
});

test("multi-model ingestion exposes explicit state order and state switching", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(multiState);
  const panel = page.getByTestId("objects-selections-panel");
  await expect(page.getByTitle("multistate.pdb").first()).toBeVisible();
  const row = panel.locator("[data-object-id]").filter({ hasText: "multistate.pdb" });
  await expect(row).toContainText("2 states");
  await expect(row).toContainText("1/2");
  await row.getByRole("button", { name: "Next state for multistate.pdb" }).click();
  await expect(row).toContainText("2/2");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("state 1, multistate.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(row).toContainText("1/2");
  await command.fill("x < 1.5");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 3 atoms");
  const firstStateScopes = await panel.getByTestId("active-selection").getAttribute("data-coordinate-state-scopes");
  expect(firstStateScopes ? JSON.parse(firstStateScopes) : null).toEqual([{ objectId: expect.stringContaining("object:"), stateId: expect.any(String), ordinal: 1 }]);
  await command.fill("state multistate.pdb, 2");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(row).toContainText("2/2");
  await command.fill("x < 1.5");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 1 atoms");
  const secondStateScopes = await panel.getByTestId("active-selection").getAttribute("data-coordinate-state-scopes");
  expect(secondStateScopes ? JSON.parse(secondStateScopes) : null).toEqual([{ objectId: expect.stringContaining("object:"), stateId: expect.any(String), ordinal: 2 }]);
  await command.fill("within 1.5 of name N");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 1 atoms");
  const secondSpatialScopes = await panel.getByTestId("active-selection").getAttribute("data-coordinate-state-scopes");
  expect(secondSpatialScopes ? JSON.parse(secondSpatialScopes) : null).toEqual([{ objectId: expect.stringContaining("object:"), stateId: expect.any(String), ordinal: 2 }]);
  await command.fill("state 1, multistate.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(row).toContainText("1/2");
  await command.fill("within 1.5 of name N");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 2 atoms");
  const firstSpatialScopes = await panel.getByTestId("active-selection").getAttribute("data-coordinate-state-scopes");
  expect(firstSpatialScopes ? JSON.parse(firstSpatialScopes) : null).toEqual([{ objectId: expect.stringContaining("object:"), stateId: expect.any(String), ordinal: 1 }]);
  await command.fill("state multistate.pdb, 2");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(row).toContainText("2/2");
  await row.getByRole("button", { name: "Show all states for multistate.pdb" }).click();
  await expect(row.getByRole("button", { name: "Hide all states for multistate.pdb" })).toBeVisible();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await command.fill("count_states multistate.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("has 2 canonical coordinate states");
});

test("duplicate display names require a durable object identity", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(mini);

  const panel = page.getByTestId("objects-selections-panel");
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  const objectId = await panel.locator("[data-object-id]").first().getAttribute("data-object-id");
  expect(objectId).toBeTruthy();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("object mini-protein.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("resolves to multiple workspace objects");
  await command.fill(`object ${objectId}`);
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 12 atoms");
});

test("object-scoped surfaces survive an unrelated coordinate-state change", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(multiState);
  await expect(page.getByTitle("multistate.pdb").first()).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(mini);
  const panel = page.getByTestId("objects-selections-panel");
  const stateRow = panel.locator("[data-object-id]").filter({ hasText: "multistate.pdb" });
  const miniRow = panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" });
  const renderer = page.getByTestId("molecular-viewer");

  await stateRow.getByRole("button", { name: "Focus multistate.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("cartoon");
  await page.getByRole("combobox", { name: "Style" }).selectOption("van-der-waals-surface");
  await expect(renderer).toHaveAttribute("data-renderer-surface-object-count", "1");
  await miniRow.getByRole("button", { name: "Focus mini-protein.pdb" }).click();
  await expect(page.getByRole("combobox", { name: "Style" })).toHaveValue("cartoon");
  await page.getByRole("combobox", { name: "Style" }).selectOption("van-der-waals-surface");
  await expect(renderer).toHaveAttribute("data-renderer-surface-object-count", "2", { timeout: 15000 });
  const before = await renderer.getAttribute("data-renderer-surface-rebuilds");
  expect(before).toBeTruthy();
  const beforeCounts = JSON.parse(before!) as Record<string, number>;
  const miniId = await miniRow.getAttribute("data-object-id");
  expect(miniId).toBeTruthy();
  expect(Object.entries(beforeCounts).find(([key]) => key.startsWith(`${miniId}:`))?.[1]).toBe(1);

  await stateRow.getByRole("button", { name: "Next state for multistate.pdb" }).click();
  await expect(stateRow).toContainText("2/2");
  await expect(renderer).toHaveAttribute("data-renderer-surface-object-count", "2");
  const after = await renderer.getAttribute("data-renderer-surface-rebuilds");
  expect(after).toBeTruthy();
  const afterCounts = JSON.parse(after!) as Record<string, number>;
  expect(Object.entries(afterCounts).find(([key]) => key.startsWith(`${miniId}:`))?.[1]).toBe(1);
});

test("console presentation commands target canonical workspace objects and keep enable state in sync", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await (await chooserPromise).setFiles(ligand);

  const panel = page.getByTestId("objects-selections-panel");
  const renderer = page.getByTestId("molecular-viewer");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const objectState = async (objectId: string) => {
    const value = await renderer.getAttribute("data-renderer-object-projection");
    expect(value).toBeTruthy();
    return JSON.parse(value!)[objectId] as { enabled: boolean; directiveCount: number; explicitColorCount: number };
  };
  const miniId = await panel.locator("[data-object-id]").filter({ hasText: "mini-protein.pdb" }).getAttribute("data-object-id");
  const ligandId = await panel.locator("[data-object-id]").filter({ hasText: "g1c-small-molecule.pdb" }).getAttribute("data-object-id");
  expect(miniId).toBeTruthy();
  expect(ligandId).toBeTruthy();
  const beforeMini = await objectState(miniId!);
  const beforeLigand = await objectState(ligandId!);

  await command.fill("object mini-protein.pdb within 4 of object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Cross-object spatial selection requires an explicit LOCAL_SCIENTIFIC or EFFECTIVE_WORLD coordinate context");

  await command.fill("show lines, object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("SHOW LINES on 3 atoms");
  const afterLinesMini = await objectState(miniId!);
  const afterLinesLigand = await objectState(ligandId!);
  expect(afterLinesMini.directiveCount).toBe(beforeMini.directiveCount);
  expect(afterLinesLigand.directiveCount).toBeGreaterThan(beforeLigand.directiveCount);

  await command.fill("color red, object g1c-small-molecule.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Applied red to 3 atoms");
  expect((await objectState(miniId!)).explicitColorCount).toBe(beforeMini.explicitColorCount);
  expect((await objectState(ligandId!)).explicitColorCount).toBe(3);

  const ligandRow = panel.locator(`[data-object-id="${ligandId}"]`);
  await ligandRow.getByRole("button", { name: `Disable g1c-small-molecule.pdb` }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", new RegExp(`"${ligandId}":\\{"enabled":false`));
  await ligandRow.getByRole("button", { name: `Enable g1c-small-molecule.pdb` }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", new RegExp(`"${ligandId}":\\{"enabled":true`));
});

test("a single object remains render-synchronized across disable and re-enable", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const row = page.getByTestId("objects-selections-panel").locator("[data-object-id]").first();
  const renderer = page.getByTestId("molecular-viewer");
  await row.getByRole("button", { name: "Disable mini-protein.pdb" }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", /"enabled":false/);
  await row.getByRole("button", { name: "Enable mini-protein.pdb" }).click();
  await expect(renderer).toHaveAttribute("data-renderer-object-projection", /"enabled":true/);
  await expect(renderer).toHaveAttribute("data-viewer-state", "loaded");
});

test("create from a canonical selection produces a new lineage object without changing the source", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  const panel = page.getByTestId("objects-selections-panel");
  await expect(panel.locator("[data-object-id]")).toHaveCount(1);
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("create ligand-object, ligand");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel.locator("[data-object-id]")).toHaveCount(2);
  await expect(panel).toContainText("ligand-object");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Created ligand-object from 2 canonical atoms");
  await command.fill("object ligand-object");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 2 atoms");
  await command.fill("select all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 14 atoms");
  await page.screenshot({ path: resolve("verification/evidence/selection-object-create.png") });
});

test("split_states and strict join_states preserve explicit state lineage", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(multiState);
  const panel = page.getByTestId("objects-selections-panel");
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("split_states multistate.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel.locator("[data-object-id]")).toHaveCount(3);
  await expect(panel).toContainText("multistate_state_1");
  await expect(panel).toContainText("multistate_state_2");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Split multistate.pdb into 2 new one-state objects");
  await command.fill("join_states multistate_state_1, multistate_state_2");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel.locator("[data-object-id]")).toHaveCount(4);
  await expect(panel).toContainText("multistate_state_1_joined");
  await expect(panel.locator("[data-object-id]").filter({ hasText: "multistate_state_1_joined" })).toContainText("2 states");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("strict atom/topology correspondence");
  await page.screenshot({ path: resolve("verification/evidence/selection-state-lineage.png") });
});

test("workspace groups organize objects without changing their canonical scope", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(mini);
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  await command.fill("group create ensemble");
  await page.getByRole("button", { name: /Run/ }).click();
  await command.fill("group add ensemble, mini-protein.pdb");
  await page.getByRole("button", { name: /Run/ }).click();
  await command.fill("group close ensemble");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByTestId("workspace-groups")).toContainText("ensemble");
  await expect(page.getByTestId("workspace-groups")).toContainText("closed · 1 object");
  await expect(consoleRegion).toContainText("Added mini-protein.pdb to group ensemble");
  await command.fill("ensemble");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(consoleRegion).toContainText("Selected 12 atoms");
  await command.fill("select all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(consoleRegion).toContainText("Selected 12 atoms");
});
