import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const pqrFixture = resolve("tests/fixtures/charged.pqr");
const sdfFixture = resolve("tests/fixtures/ethanol.sdf");
const proteinFixture = resolve("tests/fixtures/mini-protein.pdb");

test("AT-FSR-A-001 exposes the approved scientific shell with a collapsed console", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Application menu" }).getByRole("button")).toHaveText([
    "File", "Select", "Display", "Color", "Measure", "Analyze", "View", "Help",
  ]);
  await expect(page.getByRole("button", { name: "Dock", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Contextual toolbar")).toHaveCount(0);
  await expect(page.getByLabel("Command console").getByRole("button", { name: "Command Console" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Scientific tool panels").getByRole("button")).toHaveCount(10);
  await expect(page.getByTestId("scene-manager")).toHaveCount(0);
  await expect(page.getByText("NATIVE LIFECYCLE", { exact: true })).toHaveCount(0);
  await expect(page.getByText("PRESENTATION RIBBON", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_A_EMPTY_WORKSPACE.png") });
});

test("AT-FSR-A-002 opens menus and right-rail panels without changing the canvas shell", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.getByLabel("Contextual toolbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Display panel" }).click();
  await expect(page.getByTestId("projection-display-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Display" })).toBeVisible();
  await expect(page.getByTestId("scene-manager")).toHaveCount(0);

  await page.getByRole("button", { name: "Session panel" }).click();
  await expect(page.getByTestId("scene-manager")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scenes" })).toBeVisible();
});

test("AT-FSR-B-001 admits PQR as a coordinate-bearing object", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(pqrFixture);
  await expect(page.getByTitle("charged.pqr")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  await expect(page.getByTestId("source-provenance")).toContainText("PQR");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_B_PQR_IMPORT.png") });
});

test("AT-FSR-B-002 admits one V2000 SDF molecule as a coordinate-bearing object", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(sdfFixture);
  await expect(page.getByTitle("ethanol.sdf")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  await expect(page.getByTestId("source-provenance")).toContainText("SDF");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_B_SDF_IMPORT.png") });
});

test("AT-FSR-C-001 executes top-level console batches and rejects malformed nesting", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(proteinFixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Command Console" }).click();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("select polymer; show sticks, all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByLabel("Command console")).toContainText("Batch executed 2/2 commands");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-stick-cylinders", "8");
  await command.fill("select (chain A; color red, all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.getByLabel("Command console")).toContainText("Unterminated parenthesized expression");
});
