import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const viewports = [
  ["1920x1080", 1920, 1080], ["1600x900", 1600, 900], ["1440x900", 1440, 900],
  ["1366x768", 1366, 768], ["1280x720", 1280, 720], ["1024x768", 1024, 768],
  ["900x900", 900, 900], ["820x1180", 820, 1180], ["768x1024", 768, 1024],
  ["600x960", 600, 960], ["430x932", 430, 932], ["390x844", 390, 844], ["360x800", 360, 800],
] as const;

test("responsive scientific workspace stays within viewport and keeps the rail adjacent", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(resolve("verification/selection-exhaustive/ui"), { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 20_000 });
  const records: Array<Record<string, unknown>> = [];
  for (const [label, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const selectPanelButton = page.getByRole("button", { name: "Select panel", exact: true });
    await selectPanelButton.click();
    await expect(page.locator("[data-rail-panel]")).toBeVisible({ timeout: 5000 });
    const metrics = await page.evaluate(() => {
      const viewer = document.querySelector<HTMLElement>('[data-testid="molecular-viewer"]');
      const rail = document.querySelector<HTMLElement>('[aria-label="Scientific tools"]');
      const buttons = document.querySelector<HTMLElement>('.scientific-tool-rail__buttons');
      const toolbar = document.querySelector<HTMLElement>('[aria-label="Context toolbar"]') ?? document.querySelector<HTMLElement>("header");
      const panel = document.querySelector<HTMLElement>('[data-rail-panel]');
      const rect = (node: HTMLElement | null) => node ? { left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height } : null;
      return { viewport: { width: window.innerWidth, height: window.innerHeight }, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, viewer: rect(viewer), rail: rect(rail), buttons: rect(buttons), panel: rect(panel), toolbar: rect(toolbar) };
    });
    const rail = metrics.rail as { left: number; right: number; width: number } | null;
    const buttons = metrics.buttons as { left: number; right: number; width: number } | null;
    const panel = metrics.panel as { right: number; width: number } | null;
    const noHorizontalOverflow = Number(metrics.scrollWidth) <= width + 1;
    const railAtRight = Boolean(rail && rail.right <= width + 1 && rail.width > 0);
    const panelLeftOfRail = Boolean(panel && buttons && panel.right <= buttons.left + 2);
    const screenshot = `verification/selection-exhaustive/ui/viewport-${label}.png`;
    await page.screenshot({ path: resolve(screenshot), animations: "disabled" });
    records.push({ viewport: label, width, height, geometry: metrics, noHorizontalOverflow, railAtRight, panelLeftOfRail, screenshot, visualPass: noHorizontalOverflow && railAtRight && panelLeftOfRail });
    await selectPanelButton.click();
  }
  writeFileSync(resolve("verification/selection-exhaustive/responsive-ui-results.json"), JSON.stringify({ schemaVersion: 1, viewports: records }, null, 2) + "\n");
  writeFileSync(resolve("verification/selection-exhaustive/RESPONSIVE_UI_REPORT.md"), [
    "# Responsive UI report", "", "The live browser was checked at every requested viewport. Each viewport has one screenshot and DOM geometry checks for horizontal overflow, a visible right tool rail, and a panel that opens immediately to the rail's left.", "",
    ...records.map((record) => `- ${record.viewport}: ${record.visualPass ? "PASS" : "FAIL"} · overflow=${record.noHorizontalOverflow} · rail=${record.railAtRight} · panel-left=${record.panelLeftOfRail}`),
    "", `Overall desktop/compact responsive status: ${records.every((record) => record.visualPass) ? "PASS" : "FAIL"}`,
  ].join("\n") + "\n");
  expect(records).toHaveLength(viewports.length);
  expect(records.every((record) => record.visualPass)).toBeTruthy();
});
