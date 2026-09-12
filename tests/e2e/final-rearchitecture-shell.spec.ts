import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const pqrFixture = resolve("tests/fixtures/charged.pqr");
const sdfFixture = resolve("tests/fixtures/ethanol.sdf");
const xyzFixture = resolve("tests/fixtures/water.xyz");
const proteinFixture = resolve("tests/fixtures/mini-protein.pdb");
const ligandFixture = resolve("tests/fixtures/g1c-small-molecule.pdb");
const fastaFixture = resolve("tests/fixtures/sample.fasta");
const fastqFixture = resolve("tests/fixtures/sample.fastq");
const dxFixture = resolve("tests/fixtures/sample.dx");
const trajectoryFixture = resolve("tests/fixtures/sample.multi.xyz");

test("AT-FSR-A-001 exposes the approved scientific shell with a collapsed console", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Application menu" }).getByRole("button")).toHaveText([
    "File", "Select", "Display", "Color", "Measure", "Analyze", "View", "Help",
  ]);
  await expect(page.getByRole("button", { name: "Dock", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Contextual toolbar")).toHaveCount(0);
  await expect(page.getByLabel("Command console").getByRole("button", { name: "Command Console" })).toHaveAttribute("aria-expanded", "false");
  const toolRail = page.getByLabel("Scientific tool panels");
  await expect(toolRail.getByRole("button")).toHaveCount(10);
  await expect(toolRail.getByRole("button", { name: /Movie panel/ })).toBeDisabled();
  await expect(toolRail.getByRole("button", { name: /Settings panel/ })).toBeDisabled();
  await expect(toolRail.getByRole("button", { name: /Movie panel/ })).toHaveAttribute("title", "Movie unavailable in current gate");
  await expect(toolRail.getByRole("button", { name: /Settings panel/ })).toHaveAttribute("title", "Settings unavailable in current gate");
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
  await page.getByRole("button", { name: "Analyze panel" }).click();
  await expect(page.getByTestId("measurements-panel").getByRole("button", { name: "Pocket Unavailable", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.getByRole("button", { name: "Projection", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Clipping", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Background", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Axes", exact: true })).toBeDisabled();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-camera-projection", "perspective");
  await page.getByRole("button", { name: "Projection", exact: true }).click();
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-camera-projection", "orthographic");
  await page.getByRole("button", { name: "Help", exact: true }).first().click();
  await page.getByRole("button", { name: "Help", exact: true }).last().click();
  await expect(page.getByRole("status")).toContainText("Complete User Guide");
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
  await page.getByRole("button", { name: "Clear console" }).click();
  await expect(page.getByLabel("Command console")).toContainText("No command events yet.");
  await expect(page.getByLabel("Command console")).not.toContainText("G1C");
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

test("AT-FSR-J-001 exposes the unified biological import dialog and paste routing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByTestId("biological-import-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveText(["Local file", "Online ID", "Paste / text"]);
  await dialog.getByRole("tab", { name: "Paste / text" }).click();
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_J_IMPORT_DIALOG_OPEN.png") });
  await dialog.getByLabel("Pasted data format").selectOption("genbank");
  await dialog.getByLabel("Pasted data filename").fill("pasted-data.fasta");
  await dialog.getByLabel("Pasted biological data").fill("LOCUS       PASTE  8 bp\nORIGIN\n        1 acgtacgt\n//");
  await dialog.getByRole("button", { name: "Validate and open" }).click();
  await expect(page.getByTestId("sequence-viewer")).toHaveAttribute("data-sequence-format", "genbank");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_J_IMPORT_DIALOG_SEQUENCE.png") });
});

test("AT-FSR-J-002 opens a FASTA dataset in the dedicated sequence viewer", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fastaFixture);
  const viewer = page.getByTestId("sequence-viewer");
  await expect(viewer).toBeVisible({ timeout: 15000 });
  await expect(viewer).toHaveAttribute("data-sequence-format", "fasta");
  await expect(viewer).toContainText("alpha");
  await expect(viewer).toContainText("2 records");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_J_FASTA_VIEWER.png") });
});

test("AT-FSR-J-003 opens FASTQ quality data without treating it as coordinates", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fastqFixture);
  const viewer = page.getByTestId("sequence-viewer");
  await expect(viewer).toBeVisible({ timeout: 15000 });
  await expect(viewer).toHaveAttribute("data-sequence-format", "fastq");
  await expect(viewer).toContainText("Read quality");
  await expect(page.getByTestId("molecular-viewer")).toHaveCount(0);
});

test("AT-FSR-J-004 opens an OpenDX density map in the map viewer", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(dxFixture);
  const viewer = page.getByTestId("map-viewer");
  await expect(viewer).toBeVisible({ timeout: 15000 });
  await expect(viewer).toHaveAttribute("data-map-format", "dx");
  await expect(viewer).toHaveAttribute("data-map-complete", "true");
  await expect(viewer).toContainText("4 × 3 × 2");
  await page.getByLabel("Map slice").fill("1");
  await expect(viewer).toContainText("2 / 2");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_J_DENSITY_MAP.png") });
});

test("AT-FSR-J-005 opens multi-frame XYZ as a trajectory viewer", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(trajectoryFixture);
  const viewer = page.getByTestId("trajectory-viewer");
  await expect(viewer).toBeVisible({ timeout: 15000 });
  await expect(viewer).toHaveAttribute("data-trajectory-format", "xyz-trajectory");
  await expect(viewer).toHaveAttribute("data-trajectory-status", "READY");
  await expect(viewer).toContainText("2");
  await page.getByLabel("Trajectory frame").fill("1");
  await expect(viewer).toContainText("frame two");
  await page.screenshot({ path: resolve("verification/final-rearchitecture/evidence/SLICE_J_TRAJECTORY.png") });
});

test("AT-FSR-J-006 fetches an explicit UniProt accession into the sequence viewer", async ({ page }) => {
  await page.route("https://rest.uniprot.org/uniprotkb/P01308.fasta", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: ">sp|P01308|INS_HUMAN insulin\nMALWMRLLPLLALLALWGPDPAAA\n" }));
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByTestId("biological-import-dialog");
  await dialog.getByRole("tab", { name: "Online ID" }).click();
  await dialog.getByLabel("Online provider").selectOption("UniProt");
  await dialog.getByLabel("Online accession").fill("P01308");
  await dialog.getByRole("button", { name: "Fetch and open" }).click();
  await expect(page.getByTestId("sequence-viewer")).toHaveAttribute("data-sequence-format", "fasta");
  await expect(page.getByTestId("sequence-viewer")).toContainText("P01308");
});

test("AT-FSR-J-007 fetches a PubChem compound into the SMILES viewer", async ({ page }) => {
  await page.route("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/CanonicalSMILES,Title/JSON", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ PropertyTable: { Properties: [{ Title: "Aspirin", ConnectivitySMILES: "CC(=O)OC1=CC=CC=C1C(=O)O" }] } }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByTestId("biological-import-dialog");
  await dialog.getByRole("tab", { name: "Online ID" }).click();
  await dialog.getByLabel("Online provider").selectOption("PubChem");
  await dialog.getByLabel("Online accession").fill("aspirin");
  await dialog.getByRole("button", { name: "Fetch and open" }).click();
  await expect(page.getByTestId("smiles-viewer")).toBeVisible();
  await expect(page.getByTestId("smiles-viewer")).toContainText("CC(=O)OC1=CC=CC=C1C(=O)O");
});
