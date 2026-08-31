import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");

const loadFixture = async (page: Page) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
};

const renderer = (page: Page) => page.getByTestId("molecular-viewer");

test("G1B-REG-001 starts with an empty real viewer state", async ({ page }) => {
  await page.goto("/");
  await expect(renderer(page)).toHaveAttribute("data-viewer-state", "empty");
  await expect(page.getByText("No structure loaded", { exact: true })).toBeVisible();
});

test("G1B-REG-002 reports the backend connection in the shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".status-ready--connected")).toBeVisible({ timeout: 10000 });
});

test("G1B-REG-003 exposes the RCSB fetch entry point in File", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fetch", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fetch", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "PDB ID" })).toBeVisible();
});

test("G1B-REG-004 renders Spheres without stick cylinders", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Spheres", exact: true }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-sphere-primitives", "11");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "0");
});

test("G1B-REG-005 renders Ball & Stick as spheres plus canonical sticks", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Ball & Stick", exact: true }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-sphere-primitives", "11");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "8");
  await expect(renderer(page)).toHaveAttribute("data-renderer-canonical-bond-source", "canonical");
});

test("G1B-REG-006 renders Licorice with a distinct stick profile", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Licorice", exact: true }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "8");
  await expect(renderer(page)).toHaveAttribute("data-renderer-sphere-primitives", "1");
});

test("G1B-REG-007 renders Lines from canonical bonds", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Lines", exact: true }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-line-segments", "8");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "0");
});

test("G1B-REG-008 renders Sticks from canonical bonds only", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Sticks", exact: true }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "8");
  await expect(renderer(page)).toHaveAttribute("data-renderer-canonical-bond-source", "canonical");
});

test("G1B-REG-009 keeps Cartoon protein contributors separate from ligand sticks", async ({ page }) => {
  await loadFixture(page);
  await expect(renderer(page)).toHaveAttribute("data-renderer-cartoon-contributors", "8");
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "1");
});

test("G1B-REG-010 marks Surface as Coming Soon", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Surface", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("Coming Soon");
});

test("G1B-REG-011 marks Ribbon as Coming Soon instead of substituting Cartoon", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ribbon", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Ribbon geometry is not implemented");
});

test("G1B-REG-012 shows water spheres when the Water layer is ON", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-water-spheres", "1");
});

test("G1B-REG-013 hides water primitives when the Water layer is OFF", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-water-spheres", "0");
});

test("G1B-REG-014 turns ion spheres off without changing canonical structure", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Toggle Ions" }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-ion-spheres", "0");
  await expect(page.getByText("Atoms", { exact: true })).toBeVisible();
  await expect(page.locator(".status-metrics")).toContainText("Atoms 12");
});

test("G1B-REG-015 turns ion spheres back on", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Toggle Ions" }).click();
  await page.getByRole("button", { name: "Toggle Ions" }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-ion-spheres", "1");
});

test("G1B-REG-016 component visibility does not change counts", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Toggle Protein" }).click();
  await expect(page.getByText("8", { exact: true }).first()).toBeVisible();
  await expect(renderer(page)).toHaveAttribute("data-renderer-cartoon-contributors", "0");
});

test("G1B-REG-017 ligand visibility is independent from protein visibility", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Toggle Protein" }).click();
  await expect(renderer(page)).toHaveAttribute("data-renderer-stick-cylinders", "1");
  await expect(renderer(page)).toHaveAttribute("data-renderer-cartoon-contributors", "0");
});

test("G1B-REG-018 Color switches are presentation-only ribbon controls", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Color", exact: true }).click();
  await page.getByRole("button", { name: "Chain", exact: true }).click();
  await expect(renderer(page)).toHaveAttribute("data-viewer-state", "loaded");
  await expect(page.getByRole("combobox", { name: "Color mode" })).toHaveValue("chain");
});

test("G1B-REG-019 top-level menu buttons switch ribbon content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rotate", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ball & Stick", exact: true })).toHaveCount(0);
});

test("G1B-REG-020 ribbon collapse and expand preserve the shell", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse ribbon" }).click();
  await expect(page.getByRole("button", { name: "Expand ribbon" })).toBeVisible();
  await page.getByRole("button", { name: "Expand ribbon" }).click();
  await expect(page.getByRole("button", { name: "Lines", exact: true })).toBeVisible();
});

test("G1B-REG-021 File ribbon keeps implemented and unavailable operations explicit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.getByRole("button", { name: "Import", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toHaveAttribute("data-capability-state", "Coming Soon");
});

test("G1B-REG-022 presentation changes keep scientific identity unchanged", async ({ page }) => {
  await loadFixture(page);
  const initialFile = await page.locator(".status-file").textContent();
  await page.getByRole("button", { name: "Ball & Stick", exact: true }).click();
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await page.getByRole("button", { name: "Color", exact: true }).click();
  await page.getByRole("button", { name: "Uniform", exact: true }).click();
  await expect(page.locator(".status-file")).toHaveText(initialFile ?? "");
  await expect(page.locator(".status-metrics")).toContainText("Atoms 12");
});

test("G1B-REG-023 failed loads preserve the current rendered structure", async ({ page }) => {
  await loadFixture(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "invalid.pdb", mimeType: "text/plain", buffer: Buffer.from("not a molecular structure") });
  await expect(page.getByLabel("Molecular render projection").getByText("No ATOM or HETATM records with coordinates were found.", { exact: false })).toBeVisible();
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible();
  await expect(renderer(page)).toHaveAttribute("data-viewer-state", "loaded");
});

test("G1B-REG-024 camera ribbon controls operate on the loaded viewer", async ({ page }) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "View", exact: true }).click();
  for (const control of ["Rotate", "Pan", "Zoom", "Focus", "Reset View"]) await page.getByRole("button", { name: control, exact: true }).click();
  await expect(renderer(page)).toHaveAttribute("data-viewer-state", "loaded");
});
