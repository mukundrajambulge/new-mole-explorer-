import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("representative selection families run through the real console input", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const entries = page.getByRole("region", { name: "Command and selection console" }).locator(".console-entry");
  await command.fill("select active_site, chain A");
  await page.getByRole("button", { name: /Run/ }).click();
  const queries = [
    "all", "*", "everything", "none", "enabled", "present", "visible", "name CA", "%active_site", "?missing", "active_site", "groupA", "not water", "!water", "chain A and protein", "chain A & protein", "ligand or water", "ligand | water", "(chain A or chain B) and name CA", "chain A protein", "first all", "last all", "model mini-protein.pdb", "object mini-protein.pdb", "chain A", "segi A", "resn ALA", "resi 1", "alt A", "index 2", "id 2", "rank 0", "label all, {name}", "pepseq 10", "name CA in chain A", "name like CA", "byobject chain A", "bysegi chain A", "bychain ligand", "byres name CA", "bycalpha name CA", "bymolecule ligand", "byfragment ligand", "byring ligand", "bycell chain A", "neighbor ligand", "bound_to ligand", "extend 1 ligand", "within 4 of ligand", "around 4 ligand", "expand 4 ligand", "near_to ligand", "beyond 4 ligand", "gap 4 ligand", "formal_charge = 0", "partial_charge > 0", "b > 20", "q >= 0.5", "ss HELIX", "elem C", "x < 2", "y >= 0", "z <= 100", "state 2", "foo = bar", "rep cartoon", "cartoon_color red",
  ];
  for (const value of queries) {
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    const latest = entries.last();
    await expect(latest).toBeVisible();
    await expect(latest).not.toContainText(/Unknown command|Command is not implemented/);
  }
  await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded");
  await page.screenshot({ path: resolve("verification/evidence/selection-console-matrix.png"), animations: "disabled" });
});
