import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Task 5.7c: the wizard runs REAL pinned Vina through the API (FEATURE_DOCKING_RUN=1, capability
 * VINA_COMPARATOR_PREVIEW = EXPERIMENTAL). 1STP end to end: prepare (real prep worker) -> confirm -> box around the
 * crystal ligand -> run -> COMPLETED -> pose overlay. Smoke only (implementation sanity), never a validation claim.
 * Gated: MOLE_DOCK_E2E=1 with WSL Ubuntu-24.04 (~/mole-prep, ~/mole-tools/vina); run with playwright.docking-real.config.ts.
 */
const E2E = process.env.MOLE_DOCK_E2E === "1";
const BANNER = "Vina comparator preview — EXPERIMENTAL. Implemented, not yet verified or evaluated. Scores are empirical Vina scores, not binding free energies.";

/** CCD isomeric SMILES for biotin (CACTVS SMILES_CANONICAL), read from the real CCD fixture. */
const btnSmiles = (): string => {
  const cif = readFileSync("tests/fixtures/rcsb/ccd-BTN.cif", "utf8");
  const m = /^BTN SMILES_CANONICAL CACTVS\s+\S+\s+"([^"]+)"/m.exec(cif);
  if (!m) throw new Error("BTN isomeric SMILES not found in the CCD fixture");
  return m[1]!;
};

test.skip(!E2E, "set MOLE_DOCK_E2E=1 (needs WSL Ubuntu-24.04 with the prep env and pinned Vina)");

test("wizard docks 1STP biotin with real Vina via the API and overlays the top-ranked pose", async ({ page }) => {
  test.setTimeout(900_000);
  const t0 = Date.now();
  const mark = (label: string) => console.log(`DOCK_WIZARD_E2E ${label} +${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await page.goto("/");
  await page.getByRole("button", { name: "Docking" }).click();
  await page.locator("#structure-file").setInputFiles("tests/fixtures/rcsb/1STP.pdb");
  const wizard = page.getByTestId("docking-wizard");

  // Capability axes (5.6): the Vina preview is EXPERIMENTAL; the Mole engine stays UNAVAILABLE. No mock.
  await expect(wizard.getByTestId("vina-experimental-banner")).toHaveText(BANNER, { timeout: 60_000 });
  await expect(wizard.getByTestId("capability-vina")).toContainText("EXPERIMENTAL · IMPLEMENTED_UNVERIFIED · NOT_EVALUATED");
  await expect(wizard.getByTestId("capability-docking-run")).toContainText("UNAVAILABLE");
  await expect(wizard.getByTestId("docking-mock-label")).toHaveCount(0);

  await expect(wizard.getByTestId("wizard-receptor")).toContainText("atoms", { timeout: 60_000 });
  await expect(wizard.getByLabel("Ligand", { exact: true })).toContainText("BTN");
  await wizard.getByLabel("Ligand SMILES template").fill(btnSmiles());
  const next = wizard.getByRole("button", { name: "Next: Prepare" });
  await expect(next).toBeEnabled({ timeout: 60_000 });
  await next.click();

  await wizard.getByRole("button", { name: "Prepare", exact: true }).click();
  await expect(wizard.getByTestId("prep-plan-status")).toContainText("READY", { timeout: 300_000 });
  await expect(wizard.getByTestId("prep-stereo")).toBeVisible();
  await expect(wizard.getByTestId("prep-histidines")).toBeVisible();
  mark("plan READY");
  for (const box of await wizard.getByLabel(/^Acknowledge /).all()) await box.check();
  await wizard.getByTestId("prep-confirm").click();
  await expect(wizard.getByTestId("prep-state")).toHaveText("SUCCEEDED", { timeout: 300_000 });
  await expect(wizard.getByTestId("prep-blocked")).toHaveCount(0);
  mark("prep SUCCEEDED");
  await wizard.getByRole("button", { name: "Next: Box" }).click();

  await wizard.getByRole("button", { name: "Box around ligand" }).click();
  await wizard.getByRole("button", { name: "Next: Run" }).click();
  await expect(wizard.getByTestId("run-unavailable")).toHaveCount(0);
  await wizard.getByLabel("Exhaustiveness").fill("4");
  // A fresh seed per run so the API cannot dedupe onto an earlier COMPLETED job: every pass is a real Vina run.
  const seed = 1 + Math.floor(Math.random() * 1_000_000);
  await wizard.getByLabel("Seed").fill(String(seed));
  mark(`seed ${seed}`);
  await wizard.getByTestId("run-start").click();
  await expect(wizard.getByTestId("run-status-text")).toContainText(/QUEUED|RUNNING|COMPLETED/, { timeout: 60_000 });

  await expect(wizard.getByTestId("results-table")).toBeVisible({ timeout: 600_000 });
  mark("run COMPLETED");
  await expect(wizard.getByTestId("results-label")).toContainText("PREVIEW_UNQUALIFIED");
  await expect(wizard.getByTestId("results-label")).toContainText("not a binding free energy");
  await expect(wizard.getByTestId("results-me-score")).toContainText("ME score: unavailable");
  await expect(wizard.getByTestId("pose-row-1")).toBeVisible();
  await expect(wizard.getByTestId("download-poses.pdbqt")).toBeVisible();
  await expect(wizard.getByTestId("download-manifest.json")).toBeVisible();
  await expect(wizard.getByRole("button", { name: /SDF/ })).toHaveCount(0);

  const viewer = page.getByTestId("molecular-viewer");
  await expect(viewer).not.toHaveAttribute("data-pose-overlay", "1");
  await wizard.getByTestId("pose-row-1").click();
  await expect(viewer).toHaveAttribute("data-pose-overlay", "1", { timeout: 30_000 });
  await expect(wizard.getByTestId("wizard-error")).toHaveCount(0);

  // Claim semantics: no affinity wording anywhere in the docking workspace.
  const text = await page.getByTestId("docking-workspace").innerText();
  expect(text).not.toMatch(/affinit/i);
  expect(text).not.toMatch(/best binder/i);
  mark("overlay shown");
});
