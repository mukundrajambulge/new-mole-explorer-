import { expect, test } from "@playwright/test";

test.describe("UI-D0 Docking workspace", () => {
  test("opens from the active AppShell and reuses one molecular viewer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Docking" }).click();
    await expect(page.getByTestId("docking-workspace")).toBeVisible();
    await expect(page.getByTestId("docking-workflow")).toContainText("DOCKING.RUN remains registered as unavailable");
    await expect(page.getByTestId("molecular-viewer")).toHaveCount(1);
    await expect(page.getByTestId("docking-bottom-panel")).toContainText("No execution jobs, scores, poses, or results are fabricated.");
    await page.locator('button[data-action-id="WORKSPACE.MOLECULAR"]').click();
    await expect(page.getByTestId("molecular-canvas")).toBeVisible();
  });

  test("keeps SearchRegion draft separate and blocks commit without explicit D2 states", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Docking" }).click();
    const editor = page.getByTestId("docking-search-region");
    await expect(editor).toBeVisible();
    await expect(editor.getByText("Å", { exact: true })).toBeVisible();
    await editor.getByLabel("Center X").fill("12.5");
    await editor.getByRole("button", { name: "Show draft" }).click();
    await expect(editor).toContainText("load explicit source evidence before projecting a SearchRegion");
    await editor.getByRole("button", { name: "Commit Search Region" }).click();
    await expect(editor).toContainText("explicit PreparedReceptorState and PreparedLigandState");
    await expect(editor.getByTestId("committed-search-region")).toHaveCount(0);
  });

  test("adapts loaded source evidence through D2 and keeps the viewer box independent of camera reset", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Docking" }).click();
    await page.locator("#structure-file").setInputFiles("tests/fixtures/mini-protein.pdb");
    await expect(page.getByTestId("docking-workspace").getByText("mini-protein.pdb", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("docking-receptor-state")).toContainText("MolecularIdentity");
    await expect(page.getByTestId("docking-receptor-state")).toContainText("PreparedReceptorState");
    await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-search-region-overlay", "DRAFT", { timeout: 30_000 });
    const digestBefore = await page.getByTestId("molecular-viewer").getAttribute("data-search-region-digest");
    await page.getByTestId("molecular-canvas").locator(".canvas-reset").click();
    await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-search-region-overlay", "DRAFT");
    await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-search-region-digest", digestBefore ?? "");
  });
});
