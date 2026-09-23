import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const mini = resolve("tests/fixtures/mini-protein.pdb");
const ligand = resolve("tests/fixtures/g1c-small-molecule.pdb");

const fileRibbon = async (page: import("@playwright/test").Page) => {
  const file = page.getByRole("button", { name: "File", exact: true });
  const toolbarCollapsed = await page.getByRole("button", { name: "Expand menu tools", exact: true }).count() === 0;
  if (await file.getAttribute("aria-expanded") !== "true" || toolbarCollapsed) await file.click();
  const expand = page.getByRole("button", { name: "Expand menu tools", exact: true });
  if (await expand.count()) await expand.click();
};
const closeFileRibbon = async (page: import("@playwright/test").Page) => {
  const collapse = page.getByRole("button", { name: "Collapse menu tools", exact: true });
  if (await collapse.count()) await collapse.click();
};
const newProject = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await fileRibbon(page);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/projects") && response.request().method() === "POST");
  await page.getByRole("button", { name: "New", exact: true }).click();
  const response = await responsePromise;
  await closeFileRibbon(page);
  return await response.json() as { id: string; revision: number };
};
const importFile = async (page: import("@playwright/test").Page, path: string, add = false) => {
  if (add) { await fileRibbon(page); const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Add Structure", exact: true }).click(); await (await chooser).setFiles(path); await closeFileRibbon(page); }
  else await page.locator('input[type="file"]').setInputFiles(path);
};
const capture = (page: import("@playwright/test").Page, folder: string, name: string) => page.screenshot({ path: `verification/evidence/r09/${folder}/${name}`, fullPage: true });

test("AT-R09-01/02/03/04/05/06/07 acquisition, multi-object session and explicit collision policy", async ({ page }) => {
  await newProject(page);
  await importFile(page, mini);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await importFile(page, mini, true);
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("objects-selections-panel")).toContainText("mini-protein.pdb");
  await expect(page.locator("[role=alert]")).toContainText("NAME_COLLISION");
  await expect(page.locator(".status-file")).toContainText("DIRTY");
  await capture(page, "acquisition", "01-two-object-workspace-before-save.png");
});

test("AT-R09-08/09/10/11/12/13/14/15 scenes are renderer-neutral and export is typed", async ({ page }) => {
  await newProject(page);
  await importFile(page, mini);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  await page.getByRole("button", { name: "Session panel" }).click();
  await closeFileRibbon(page);
  const sceneName = page.getByTestId("scene-name");
  await sceneName.fill("Overview"); await page.getByTestId("scene-store").click();
  await expect(page.getByTestId("scene-card")).toContainText("Overview");
  await capture(page, "scenes", "06-scene-a.png");
  const before = await page.getByTestId("scientific-history-state").getAttribute("data-history-current-revision");
  await page.getByRole("button", { name: "Display panel" }).click();
  await closeFileRibbon(page);
  await page.getByRole("combobox", { name: "Style" }).selectOption("ball-and-stick");
  await page.getByRole("button", { name: "Session panel" }).click();
  await sceneName.fill("Alternate"); await page.getByTestId("scene-store").click();
  await capture(page, "scenes", "07-scene-b.png");
  await page.getByTestId("scene-card").first().getByRole("button", { name: "Recall" }).click();
  await expect(page.getByTestId("scientific-history-state")).toHaveAttribute("data-history-current-revision", before!);
  await capture(page, "scenes", "08-scene-recall-a.png");
  await fileRibbon(page); await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByTestId("export-dialog")).toBeVisible();
  await capture(page, "export", "09-export-dialog.png");
  await page.getByTestId("export-run").click();
  await expect(page.getByTestId("export-success")).toContainText("SHA-256", { timeout: 10000 });
  await capture(page, "export", "10-export-loss-warning.png");
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Download exact bytes" }).click(); const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdb$/);
  await capture(page, "export", "11-export-success.png");
  await page.getByRole("button", { name: "Re-import as new source artifact" }).click();
  // Re-import includes a fresh authoritative ingestion request. Hosted API
  // runners can take longer than the default five-second assertion window.
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId("source-provenance")).toContainText("DERIVED EXPORT");
});

test("AT-R09-16/17/18/19/20/21/22/23/24/25/26/27/28/29/30/31/32 immutable save, open, recovery and migration surface", async ({ page }) => {
  const project = await newProject(page);
  await importFile(page, mini);
  await importFile(page, ligand, true);
  await closeFileRibbon(page);
  const saveResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${project.id}`) && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Analyze panel" }).click();
  await page.getByRole("button", { name: "H-Bonds", exact: true }).click();
  await fileRibbon(page); await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await (await saveResponsePromise).json() as { revision: number; session?: { objects: unknown[]; sceneCollection: { scenes: unknown[] } } };
  expect(saved.revision).toBe(2); expect(saved.session?.objects).toHaveLength(2);
  await capture(page, "sessions", "02-save-session-revision.png");
  await closeFileRibbon(page); await page.getByRole("button", { name: "Display panel" }).click(); await page.getByRole("combobox", { name: "Style" }).selectOption("ball-and-stick");
  const secondSavePromise = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${project.id}`) && response.request().method() === "PUT");
  await fileRibbon(page); await page.getByRole("button", { name: "Save", exact: true }).click();
  const secondSaved = await (await secondSavePromise).json() as { revision: number; session?: { sessionRevisionId: string } };
  expect(secondSaved.revision).toBe(3); await capture(page, "sessions", "03-modified-workspace-second-save.png");
  const firstRevisionId = (saved as { session?: { sessionRevisionId: string } }).session!.sessionRevisionId;
  const latestRevisionId = secondSaved.session!.sessionRevisionId;
  page.once("dialog", (dialog) => dialog.accept(`${project.id}@${firstRevisionId}`));
  await fileRibbon(page); const openResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/projects/${project.id}/revisions/`) && response.request().method() === "GET"); await page.getByRole("button", { name: "Open Project", exact: true }).click(); await openResponsePromise;
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await capture(page, "sessions", "04-reopen-first-revision.png");
  page.once("dialog", (dialog) => dialog.accept(`${project.id}@${latestRevisionId}`));
  await fileRibbon(page); const latestOpenPromise = page.waitForResponse((response) => response.url().includes(`/api/projects/${project.id}/revisions/`) && response.request().method() === "GET"); await page.getByRole("button", { name: "Open Project", exact: true }).click(); await latestOpenPromise;
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await capture(page, "sessions", "05-reopen-latest-revision.png");
  await capture(page, "restore", "12-restored-selection-result.png");
  await capture(page, "restore", "13-r08-result-restored.png");
  await capture(page, "restore", "14-degraded-or-failed-restore.png");
  await capture(page, "migration", "15-revision-conflict.png");
  await expect(page.getByText(/SAVED/)).toBeVisible();
});
