import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const evidenceDir = resolve("verification/p0-boot/evidence");

type RuntimeCapture = { pageErrors: string[]; consoleErrors: string[] };

const captureRuntimeErrors = (page: import("@playwright/test").Page): RuntimeCapture => {
  const capture: RuntimeCapture = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (error) => capture.pageErrors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") capture.consoleErrors.push(message.text());
  });
  return capture;
};

const expectStableShell = async (page: import("@playwright/test").Page, capture: RuntimeCapture, idleMs = 2500) => {
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.getByTestId("molecular-canvas")).toBeVisible();
  await expect(page.getByTestId("objects-selections-panel")).toBeVisible();
  await expect(page.getByLabel("Scientific tools")).toBeVisible();
  await expect(page.getByRole("region", { name: /Command.*console/i })).toBeVisible();
  await expect(page.getByText("The workstation could not start", { exact: false })).toHaveCount(0);
  await page.waitForTimeout(idleMs);
  expect(capture.pageErrors, "uncaught browser errors").toEqual([]);
  expect(capture.consoleErrors.filter((entry) => /maximum update depth|uncaught.*react/i.test(entry)), "React runtime loop errors").toEqual([]);
};

test("P0 boot mounts ten times and survives reload stress without a React update loop", async ({ browser }) => {
  test.setTimeout(120_000);
  for (let boot = 0; boot < 10; boot += 1) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const capture = captureRuntimeErrors(page);
    await page.goto("/molstudio", { waitUntil: "domcontentloaded" });
    await expectStableShell(page, capture, 1500);
    if (boot === 0) await page.screenshot({ path: resolve(evidenceDir, "after/00-boot-stable.png"), animations: "disabled" });
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const capture = captureRuntimeErrors(page);
  for (let reload = 0; reload < 5; reload += 1) {
    await page.goto("/molstudio", { waitUntil: "domcontentloaded" });
    await expectStableShell(page, capture, 1000);
  }
  await page.close();
});

test("P0 persisted ribbon state hydrates once and rejects an invalid record safely", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const capture = captureRuntimeErrors(page);
  await page.goto("/molstudio", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Color", exact: true }).click();
  await expect(page.getByRole("button", { name: "Color", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Color", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectStableShell(page, capture, 2000);
  await page.screenshot({ path: resolve(evidenceDir, "after/persisted-ribbon-restored.png"), animations: "disabled" });
  await page.addInitScript(() => window.sessionStorage.setItem("molecular-workstation.ribbon", "invalid-ribbon"));
  await page.reload();
  await expect(page.getByRole("button", { name: "Display", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectStableShell(page, capture, 1500);
  await page.close();
});

test("P0 4DJW workspace survives right-rail, two-object, and console stress", async ({ page }) => {
  test.setTimeout(180_000);
  const capture = captureRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/molstudio?demo=4DJW", { waitUntil: "domcontentloaded" });
  await expect(page.getByTitle("4DJW.cif").first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
  await expectStableShell(page, capture, 2500);

  const panels = ["Display", "Color", "Select", "Measure", "Analyze", "Session"] as const;
  for (let round = 0; round < 2; round += 1) {
    for (const panel of panels) {
      const launcher = page.getByRole("button", { name: `${panel} panel`, exact: true });
      await launcher.click();
      if (round === 0) await page.screenshot({ path: resolve(evidenceDir, `after/panel-${panel.toLowerCase()}.png`), animations: "disabled" });
      await launcher.click();
    }
  }
  await expect(page.getByRole("button", { name: "Settings panel (unavailable in current gate)", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Display panel", exact: true }).click();
  await page.getByRole("combobox", { name: "Protein representation" }).selectOption("sticks");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-camera-action", "FIT");
  await page.getByRole("button", { name: "Close Display panel", exact: true }).click();

  await page.getByRole("button", { name: "Color panel", exact: true }).click();
  await page.getByRole("combobox", { name: "Color mode" }).selectOption("monochrome");
  await page.getByRole("combobox", { name: "Ligand color" }).selectOption("custom");
  await page.getByLabel("Ligand custom color").fill("#ff00aa");
  // Display and Color share the same inspector component; its close action
  // retains the inspector's Display label while the rail launcher is Color.
  await page.getByRole("button", { name: "Close Display panel", exact: true }).click();

  const rail = page.getByLabel("Scientific tools");
  await page.getByRole("button", { name: "Select panel", exact: true }).click();
  await rail.getByRole("button", { name: "Select all", exact: true }).click();
  await rail.getByRole("button", { name: "Clear selection", exact: true }).click();
  await page.getByRole("button", { name: "Select panel", exact: true }).click();

  await page.getByRole("button", { name: "Measure panel", exact: true }).click();
  await rail.getByRole("button", { name: "Distance", exact: true }).click();
  await page.getByRole("button", { name: "Measure panel", exact: true }).click();

  await page.getByRole("button", { name: "Expand console", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Command or selection query" })).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, "after/console-expanded.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Collapse console", exact: true }).click();
  await page.screenshot({ path: resolve(evidenceDir, "after/console-collapsed.png"), animations: "disabled" });

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("1CRN");
  await page.getByRole("button", { name: "RCSB add", exact: true }).click();
  await expect(page.getByTitle("1CRN.cif").first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await page.screenshot({ path: resolve(evidenceDir, "after/two-object-workspace.png"), animations: "disabled" });
  await expectStableShell(page, capture, 3000);
});
