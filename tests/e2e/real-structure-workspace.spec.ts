import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const evidenceDir = resolve("verification/final-rearchitecture/evidence");

test("4DJW live selection and a second RCSB object share one workspace", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("4DJW");
  await page.getByRole("button", { name: "RCSB fetch" }).click();
  await expect(page.getByTitle("4DJW.cif").first()).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: resolve(evidenceDir, "SLICE_H_4DJW_LOADED.png"), animations: "disabled" });

  const parseMetric = async (label: string) => {
    const text = await page.locator(".status-metrics").innerText();
    const match = text.match(new RegExp(`${label}\\s+([\\d,]+)`));
    expect(match, `missing ${label} metric`).toBeTruthy();
    return Number(match![1].replaceAll(",", ""));
  };
  const readLatestSelectionCount = async () => {
    const latest = page.getByRole("region", { name: "Command console" }).locator(".console-entry").last();
    await expect(latest).toContainText(/Selected [\d,]+ atoms/, { timeout: 15000 });
    const text = await latest.innerText();
    const match = text.match(/Selected ([\d,]+) atoms/);
    expect(match, `latest console entry is not a selection: ${text}`).toBeTruthy();
    return Number(match![1].replaceAll(",", ""));
  };
  const loadedAtomCount = await parseMetric("Atoms");
  expect(loadedAtomCount).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Expand console", exact: true }).click();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("select all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command console" })).toContainText(`Selected ${loadedAtomCount} atoms`, { timeout: 15000 });
  expect(await readLatestSelectionCount()).toBe(loadedAtomCount);
  await expect(page.locator(".status-metrics")).toContainText(`Selection ${loadedAtomCount.toLocaleString("en-US")}`);
  await expect(page.getByTestId("active-selection")).toContainText(`${loadedAtomCount.toLocaleString("en-US")} atoms`);
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  const allSelectionHash = await page.getByTestId("active-selection").getAttribute("data-membership-hash");
  expect(allSelectionHash).toBeTruthy();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-membership-hash", allSelectionHash!);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-indicator", "visible");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-highlight-limit", "none");
  await command.fill("show sticks, all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByTestId("active-selection")).toContainText(`${loadedAtomCount.toLocaleString("en-US")} atoms`);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-membership-hash", allSelectionHash!);
  await command.fill("color red, all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command console" })).toContainText("Applied");
  await expect(page.getByTestId("active-selection")).toContainText(`${loadedAtomCount.toLocaleString("en-US")} atoms`);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-membership-hash", allSelectionHash!);
  await command.fill("center all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-camera-action", "CENTER");
  await command.fill("zoom all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-camera-action", "FIT");
  await command.fill("unpick");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByRole("region", { name: "Command console" })).toContainText("Selection cleared.");
  await expect(page.getByTestId("active-selection")).toHaveCount(0);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-indicator", "none");
  await command.fill("chain A and protein");
  await page.getByRole("button", { name: /Run/ }).click();
  const chainProteinCount = await readLatestSelectionCount();
  expect(chainProteinCount).toBeGreaterThan(0);
  expect(chainProteinCount).toBeLessThanOrEqual(loadedAtomCount);
  await expect(page.locator(".status-metrics")).toContainText(`Selection ${chainProteinCount.toLocaleString("en-US")}`);
  await expect(page.getByTestId("active-selection")).toContainText(`${chainProteinCount.toLocaleString("en-US")} atoms`);
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  const chainProteinHash = await page.getByTestId("active-selection").getAttribute("data-membership-hash");
  expect(chainProteinHash).toBeTruthy();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-membership-hash", chainProteinHash!);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-indicator", "visible");

  await page.getByRole("textbox", { name: "RCSB PDB ID" }).fill("1CRN");
  await page.getByRole("button", { name: "RCSB add" }).click();
  await expect(page.getByTitle("1CRN.cif").first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  // Fit from the full canvas after the second object is admitted. The
  // console is an overlay and remains collapsed for the visual gate.
  await page.getByRole("button", { name: "Collapse console", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Display panel" }).click();
  await page.getByTestId("projection-display-panel").getByRole("button", { name: "Fit", exact: true }).click();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-camera-target-object-count", "2");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(evidenceDir, "SLICE_H_BOTH_VISIBLE_FIT_ALL.png"), animations: "disabled" });

  const objectsPanel = page.getByTestId("objects-selections-panel");
  const firstRow = objectsPanel.locator('[data-object-name="4DJW.cif"]');
  const secondRow = objectsPanel.locator('[data-object-name="1CRN.cif"]');
  await firstRow.getByRole("button", { name: "Disable 4DJW.cif" }).click();
  await expect(firstRow).toHaveAttribute("data-object-enabled", "false");
  await expect(secondRow).toHaveAttribute("data-object-enabled", "true");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(evidenceDir, "SLICE_H_4DJW_HIDDEN.png"), animations: "disabled" });
  await firstRow.getByRole("button", { name: "Enable 4DJW.cif" }).click();
  await secondRow.getByRole("button", { name: "Disable 1CRN.cif" }).click();
  await expect(firstRow).toHaveAttribute("data-object-enabled", "true");
  await expect(secondRow).toHaveAttribute("data-object-enabled", "false");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(evidenceDir, "SLICE_H_1CRN_HIDDEN.png"), animations: "disabled" });
  await secondRow.getByRole("button", { name: "Enable 1CRN.cif" }).click();
  await expect(firstRow).toHaveAttribute("data-object-enabled", "true");
  await expect(secondRow).toHaveAttribute("data-object-enabled", "true");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(evidenceDir, "SLICE_H_BOTH_VISIBLE_RESTORED.png"), animations: "disabled" });

  await page.getByRole("button", { name: "Expand console", exact: true }).click();
  await expect(command).toBeVisible();
  await command.fill("object 4DJW.cif");
  await page.getByRole("button", { name: /Run/ }).click();
  expect(await readLatestSelectionCount()).toBe(loadedAtomCount);
});
