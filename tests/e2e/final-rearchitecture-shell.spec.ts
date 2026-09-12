import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const pqrFixture = resolve("tests/fixtures/charged.pqr");
const sdfFixture = resolve("tests/fixtures/ethanol.sdf");
const xyzFixture = resolve("tests/fixtures/water.xyz");
const proteinFixture = resolve("tests/fixtures/mini-protein.pdb");
const ligandFixture = resolve("tests/fixtures/g1c-small-molecule.pdb");

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

test("AT-FSR-G-001 admits a bounded XYZ coordinate frame as a molecule", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(xyzFixture);
  await expect(page.getByTitle("water.xyz")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  await expect(page.getByTestId("source-provenance")).toContainText("XYZ");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_G_XYZ_IMPORT.png") });
});

test("AT-FSR-H-000 keeps two local coordinate objects visible after workspace assembly", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(proteinFixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "File", exact: true }).click();
  const fileInput = page.locator('input[type="file"]');
  await page.getByRole("button", { name: "Add Structure", exact: true }).click();
  await fileInput.setInputFiles(ligandFixture);
  await expect(page.getByTitle("g1c-small-molecule.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("objects-selections-panel").locator("[data-object-id]")).toHaveCount(2);
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-renderer-model-count", "2");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_H_LOCAL_TWO_OBJECTS.png") });
});

test("AT-FSR-I-001 exposes contextual ligand interaction actions", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(ligandFixture);
  await expect(page.getByTitle("g1c-small-molecule.pdb")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Ligand panel" }).click();

  const panel = page.getByTestId("ligand-interaction-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Ligand interactions");
  await expect(panel).toContainText("3 ligand atoms");
  await expect(panel.getByRole("button", { name: "Select ligand" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "H-Bonds" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Contacts" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Clashes" })).toBeVisible();
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_I_LIGAND_CONTEXT.png") });
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

test("AT-FSR-D-001 opens working Measure and Analyze panels from the scientific rail", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(proteinFixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("measurements-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Measure panel" }).click();
  await expect(page.getByRole("heading", { name: "Measure" })).toBeVisible();
  await page.getByRole("button", { name: "Angle", exact: true }).click();
  await expect(page.getByRole("button", { name: "Angle", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Analyze panel" }).click();
  await expect(page.getByRole("heading", { name: "Analyze" })).toBeVisible();
  await page.getByRole("button", { name: "H-Bonds", exact: true }).click();
  await expect(page.getByTestId("analysis-results")).toBeVisible();
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_D_ANALYZE_RAIL.png") });
});

test("AT-FSR-E-001 exposes canonical topology editing through the Edit rail", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(proteinFixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Edit panel" }).click();
  const panel = page.getByRole("region", { name: "Edit panel" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("0 atoms selected");
  await expect(panel.getByRole("button", { name: "Delete atoms" })).toBeDisabled();

  await page.getByRole("button", { name: "Command Console" }).click();
  await page.getByRole("textbox", { name: "Command or selection query" }).fill("select polymer");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(panel).toContainText("8 atoms selected");
  await expect(panel.getByRole("button", { name: "Delete atoms" })).toBeEnabled();
  await expect(panel.getByRole("button", { name: "Create bond" })).toBeDisabled();
  await page.getByRole("button", { name: "Command Console" }).click();
  await expect(page.getByLabel("Command console").getByRole("button", { name: "Command Console" })).toHaveAttribute("aria-expanded", "false");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_E_EDIT_RAIL.png") });
});

test("AT-FSR-F-001 keeps Select-rail, Escape, and console selection state convergent", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(proteinFixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Select panel" }).click();
  const panel = page.getByRole("region", { name: "Select panel" });
  await expect(panel).toContainText("No active selection");
  await panel.getByRole("button", { name: "Select all" }).click();
  await expect(panel).toContainText("12 atoms selected");
  await expect(panel.getByRole("button", { name: "Clear selection" })).toBeEnabled();
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_F_SELECT_RAIL.png") });
  await panel.getByRole("button", { name: "Clear selection" }).click();
  await expect(panel).toContainText("No active selection");
  await panel.getByRole("button", { name: "Select all" }).click();
  await page.keyboard.press("Escape");
  await expect(panel).toContainText("No active selection");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selected-atoms", "0");
});
