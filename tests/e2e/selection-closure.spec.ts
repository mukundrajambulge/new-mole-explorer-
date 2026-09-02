import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/mini-protein.pdb");
const typedNucleicFixture = resolve("tests/fixtures/typed-nucleic.mmcif");
const edgeIdentityFixture = resolve("tests/fixtures/edge-identity.mmcif");
const ringFixture = resolve("tests/fixtures/ring-ligand.pdb");
const typedPropertiesFixture = resolve("tests/fixtures/typed-properties.pdb");
const segmentIdentityFixture = resolve("tests/fixtures/segment-identity.pdb");
const sidechainIdentityFixture = resolve("tests/fixtures/sidechain-identity.pdb");
const loadFixture = async (page: Page) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByTitle("mini-protein.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
};

test("source-backed mmCIF polymer typing drives nucleic selection", async ({ page }) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(typedNucleicFixture);
  await expect(page.getByTitle("typed-nucleic.mmcif")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  await command.fill("polymer.nucleic");
  await page.getByRole("button", { name: /Run/ }).click();
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  await expect(consoleRegion).toContainText("Selected 2 atoms");
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  await page.screenshot({ path: "verification/evidence/selection-polymer-nucleic-mmcif.png", animations: "disabled" });
});

test("canonical mmCIF segment identity drives segi and bysegi selection", async ({ page }) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(edgeIdentityFixture);
  await expect(page.getByTitle("edge-identity.mmcif")).toBeVisible({ timeout: 15000 });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const run = async (value: string, count: number) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion.locator(".console-entry").last()).toContainText(`Selected ${count} atoms`);
  };
  await run("segi SEG_A", 2);
  await run("bysegi segi SEG_A", 2);
  await run("alt A", 1);
  await run("b > 20", 2);
  await run("q >= 0.5", 4);
});

test("canonical PDB segment identity and alternate location match the pinned identity fixture", async ({ page }) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(segmentIdentityFixture);
  await expect(page.getByTitle("segment-identity.pdb")).toBeVisible({ timeout: 15000 });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const run = async (value: string, count: number) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion.locator(".console-entry").last()).toContainText(`Selected ${count} atoms`);
    await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  };
  await run("segi SEGA", 2);
  await run("bysegi segi SEGA", 2);
  await run("alt A", 1);
});

test("canonical ring topology expands byring from a seed atom", async ({ page }) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(ringFixture);
  await expect(page.getByTitle("ring-ligand.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  await command.fill("byring name C1");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(consoleRegion.locator(".console-entry").last()).toContainText("Selected 6 atoms");
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-selection-indicator", "visible");
  await command.fill("byring organic");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(consoleRegion.locator(".console-entry").last()).toContainText("Selected 6 atoms");
  await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
});

test("canonical sidechain selection matches the pinned backbone partition fixture", async ({ page }) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(sidechainIdentityFixture);
  await expect(page.getByTitle("sidechain-identity.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const run = async (value: string, count: number) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion.locator(".console-entry").last()).toContainText(`Selected ${count} atoms`);
    await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  };
  await run("backbone", 4);
  await run("sidechain", 1);
});

test("canonical PDB formal charge and secondary structure predicates run live", async ({ page }) => {
  await page.goto("/molstudio");
  await page.locator('input[type="file"]').setInputFiles(typedPropertiesFixture);
  await expect(page.getByTitle("typed-properties.pdb")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 15000 });
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const run = async (value: string, count: number) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion.locator(".console-entry").last()).toContainText(`Selected ${count} atoms`);
    await expect(page.getByTestId("active-selection")).toContainText("VALID NONEMPTY");
  };
  await run("formal_charge = 0", 2);
  await run("formal_charge > 0", 1);
  await run("formal_charge != 0", 2);
  await run("formal_charge < 0", 1);
  await run("formal_charge <= 0", 3);
  await run("formal_charge >= 0", 3);
  await run("ss HELIX", 2);
  await run("ss SHEET", 2);
  await run("b > 20", 1);
  await run("b <= 20", 3);
});

test("selection commands bind canonical membership and named selection actions", async ({ page }) => {
  await loadFixture(page);
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const run = async (value: string) => { await command.fill(value); await page.getByRole("button", { name: /Run/ }).click(); };

  await run("select active_site, chain A and resi 1");
  await expect(page.getByTestId("objects-selections-panel")).toContainText("active_site");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Named selection active_site created");
  await run("show sticks, active_site");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("SHOW STICKS on");
  await run("label active_site, {resn}{resi}:{name}");
  await run("select label ALA1:CA");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Selected 1 atoms");
  await run("center active_site");
  await run("help select");
  await expect(page.getByRole("region", { name: "Command and selection console" })).toContainText("Evaluate canonical atom membership");
  await command.fill("select ");
  await expect(page.getByRole("listbox", { name: "Command suggestions" })).toContainText("chain A");
  await command.fill("");

  await page.getByRole("button", { name: "Collapse console", exact: true }).click();
  const namedRow = page.getByTestId("objects-selections-panel").getByText("active_site", { exact: true }).locator("..");
  await namedRow.getByRole("button", { name: "A active_site" }).click();
  await namedRow.getByRole("button", { name: "S active_site" }).click();
  await namedRow.getByRole("button", { name: "L active_site" }).click();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
});

test("visible selection follows presentation layer changes without changing canonical atom counts", async ({ page }) => {
  await loadFixture(page);
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const run = async (value: string, expectedCount: number) => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion).toContainText(`Selected ${expectedCount} atoms`);
  };

  await run("visible", 11);
  await page.getByRole("button", { name: "Toggle Water" }).click();
  await run("visible", 12);
  await page.getByRole("button", { name: "Toggle Protein" }).click();
  await run("visible", 4);
  await expect(page.locator(".status-metrics")).toContainText("Atoms 12");
});

test("presentation-dependent selectors use the current RenderProjection", async ({ page }) => {
  await loadFixture(page);
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const viewer = page.getByTestId("molecular-viewer");
  const atomMetrics = page.locator(".status-metrics");
  const runSelection = async (value: string, count: number, status: "VALID NONEMPTY" | "VALID EMPTY") => {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion.locator(".console-entry").last()).toContainText(`Selected ${count} atoms`);
    await expect(page.getByTestId("active-selection")).toContainText(status);
    await expect(page.getByTestId("active-selection")).toHaveAttribute("data-presentation-revision", /.+/);
    await expect(viewer).toHaveAttribute("data-selection-indicator", count > 0 ? "visible" : "none");
  };

  const before = await atomMetrics.innerText();
  await runSelection("rep cartoon", 8, "VALID NONEMPTY");
  await command.fill("color red, all");
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(consoleRegion.locator(".console-entry").last()).toContainText(/Applied red to 12 atoms/i);
  await runSelection("select color red", 11, "VALID NONEMPTY");
  await runSelection("select cartoon_color red", 8, "VALID NONEMPTY");
  await runSelection("select ribbon_color red", 0, "VALID EMPTY");
  expect((await atomMetrics.innerText()).replace(/\s+/g, "")).toBe(before.replace(/\s+/g, ""));
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
});

test("component colors persist independently from global color and representation", async ({ page }) => {
  await loadFixture(page);
  const viewer = page.getByTestId("molecular-viewer");
  const proteinColor = page.getByRole("combobox", { name: "Protein color" });
  await proteinColor.selectOption("custom");
  await page.getByLabel("Protein custom color").fill("#ff00aa");
  await page.getByRole("combobox", { name: "Color mode" }).selectOption("chain");
  await page.getByRole("combobox", { name: "Style" }).selectOption("sticks");
  await expect(proteinColor).toHaveValue("custom");
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
  await proteinColor.selectOption("inherit");
  await expect(proteinColor).toHaveValue("inherit");
});

test("custom labels validate visibly and clear without mutating the loaded structure", async ({ page }) => {
  await loadFixture(page);
  const viewer = page.getByTestId("molecular-viewer");
  await page.locator("summary").filter({ hasText: "Labels" }).click();
  await page.getByLabel("Label mode").selectOption("custom");
  const expression = page.getByLabel("Label expression");
  await expression.fill("{not-safe}");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Use only");
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
  await expression.fill("{name}");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-label-mode", "custom");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByLabel("Label mode")).toHaveValue("off");
});

test("analysis and measurement controls remain reachable in the left rail", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loadFixture(page);
  const rail = page.getByLabel("Structure, context and analysis panel");
  const dimensions = await rail.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
  });
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  await expect(page.getByTestId("measurements-panel").getByRole("button", { name: "Distance", exact: true })).toBeVisible();
  await expect(page.getByTestId("measurements-panel").getByRole("button", { name: "Dihedral", exact: true })).toBeVisible();
  await page.screenshot({ path: resolve("verification/evidence/analysis-interaction-scroll.png"), animations: "disabled" });
});
