import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { createMockJobServer } from "../../apps/api/src/jobs/mockServer";

/**
 * Full wizard flow (Inputs, Prepare, Box, Run, Results) against the 5.0 MOCK job server.
 * Every /api/docking request from the page is forwarded to the in-process mock; nothing here is a real docking result.
 */
let mock: Server;
let mockPort = 0;

test.beforeAll(async () => {
  mock = createMockJobServer({ stepMs: 150 });
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
  mockPort = (mock.address() as AddressInfo).port;
});
test.afterAll(async () => { await new Promise<void>((resolve) => mock.close(() => resolve())); });

test("wizard runs Inputs to Results against the mock and overlays a pose", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/docking/**", async (route) => {
    const url = new URL(route.request().url());
    const upstream = await fetch(`http://127.0.0.1:${mockPort}${url.pathname.replace(/^\/api/, "")}${url.search}`, {
      method: route.request().method(),
      headers: { "content-type": "application/json" },
      body: route.request().postData() ?? undefined,
    });
    await route.fulfill({ status: upstream.status, contentType: upstream.headers.get("content-type") ?? "application/json", body: await upstream.text() });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Docking" }).click();
  await page.locator("#structure-file").setInputFiles("tests/fixtures/rcsb/1IEP.pdb");

  const wizard = page.getByTestId("docking-wizard");
  await expect(wizard.getByTestId("docking-preview-banner")).toContainText("Preview: not scientifically qualified");
  await expect(wizard.getByTestId("wizard-receptor")).toContainText("atoms", { timeout: 60_000 });
  await expect(wizard.getByLabel("Ligand", { exact: true })).toContainText("STI");
  const next = wizard.getByRole("button", { name: "Next: Prepare" });
  await expect(next).toBeEnabled({ timeout: 60_000 });
  await next.click();

  await wizard.getByRole("button", { name: "Prepare", exact: true }).click();
  await expect(wizard.getByTestId("prep-report")).toBeVisible();
  await expect(wizard.getByTestId("docking-mock-label")).toBeVisible();
  await wizard.getByTestId("prep-confirm").click();
  await expect(wizard.getByTestId("prep-state")).toHaveText("SUCCEEDED", { timeout: 30_000 });
  await wizard.getByRole("button", { name: "Next: Box" }).click();

  // Restored from the old UI-D0 spec: a SearchRegion commit stays blocked without explicit D2 prepared states.
  const editor = page.getByTestId("docking-search-region");
  await expect(editor.getByText("Å", { exact: true })).toBeVisible();
  await editor.getByLabel("Center X").fill("12.5");
  await editor.getByRole("button", { name: "Commit Search Region" }).click();
  await expect(editor).toContainText("explicit PreparedReceptorState and PreparedLigandState");
  await expect(editor.getByTestId("committed-search-region")).toHaveCount(0);

  await wizard.getByRole("button", { name: "Box around ligand" }).click();
  await wizard.getByRole("button", { name: "Next: Run" }).click();
  await wizard.getByTestId("run-start").click();

  await expect(wizard.getByTestId("results-table")).toBeVisible({ timeout: 60_000 });
  await expect(wizard.getByTestId("docking-mock-label")).toBeVisible();
  await expect(wizard.getByTestId("docking-preview-banner")).toBeVisible();
  await expect(wizard.getByTestId("pose-row-1")).toBeVisible();

  const viewer = page.getByTestId("molecular-viewer");
  await expect(viewer).not.toHaveAttribute("data-pose-overlay", "1");
  await wizard.getByTestId("pose-row-2").click();
  await expect(viewer).toHaveAttribute("data-pose-overlay", "1");
});
