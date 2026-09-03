import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const expectedCounts = new Map<string, number>([
  ["select active_site, chain A", 11],
  ["all", 12],
  ["*", 12],
  ["everything", 12],
  ["none", 0],
  ["enabled", 12],
  ["present", 12],
  ["visible", 11],
  ["polymer.nucleic", 0],
  ["name CA", 2],
  ["%active_site", 11],
  ["?missing", 0],
  ["active_site", 11],
  ["groupA", 0],
  ["not water", 11],
  ["!water", 11],
  ["chain A and protein", 8],
  ["chain A & protein", 8],
  ["ligand or water", 3],
  ["ligand | water", 3],
  ["(chain A or chain B) and name CA", 2],
  ["chain A protein", 11],
  ["first all", 1],
  ["last all", 1],
  ["model mini-protein.pdb", 12],
  ["object mini-protein.pdb", 12],
  ["chain A", 11],
  ["segi A", 0],
  ["resn ALA", 4],
  ["resi 1", 4],
  ["alt A", 0],
  ["index 2", 1],
  ["id 2", 1],
  ["rank 0", 1],
  ["name != CA", 10],
  ["select label CA", 2],
  ["byobject chain A", 12],
  ["bysegi chain A", 0],
  ["bychain ligand", 11],
  ["byres name CA", 8],
  ["bycalpha name CA", 2],
  ["bymolecule ligand", 2],
  ["byfragment ligand", 0],
  ["byring ligand", 0],
  ["bycell chain A", 0],
  ["neighbor ligand", 0],
  ["bound_to ligand", 2],
  ["extend 1 ligand", 2],
  ["expand 4 ligand", 6],
  ["near_to ligand", 0],
  ["beyond 4 ligand", 6],
  ["gap 0 ligand", 6],
  ["gap 4 ligand", 0],
  ["pepseq AG", 8],
  ["formal_charge = 0", 0],
  ["partial_charge > 0", 0],
  ["b > 20", 0],
  ["q >= 0.5", 12],
  ["ss HELIX", 0],
  ["elem C", 5],
  ["x < 2", 4],
  ["x <= 2", 5],
  ["y >= 0", 10],
  ["z <= 100", 12],
  ["state 2", 0],
  ["all within 4 of ligand", 6],
  ["all around 4 of ligand", 4],
  ["all near_to 4 of ligand", 4],
  ["all beyond 4 of ligand", 6],
  ["(chain A and name CA) like (chain A and name CA)", 2],
  ["rep cartoon", 8],
  ["cartoon_color red", 8],
  ["ribbon_color red", 0],
  ["select color red", 11],
]);

const expectedSemanticStatus = (value: string): string => {
  const query = value.trim().toLowerCase();
  if (/^(show|show_as|hide|color|set|label|center|zoom|measure|get_view|help|rename|set_name|copy|create|split_states|join_states|delete|update|enable|disable|frame|all_states|count_states|unpick)\b/.test(query)) return "COMMAND_HANDLED";
  if (query.startsWith("select ")) return query === "select active_site, chain a" ? "VALID_NONEMPTY" : "SELECTION_RESULT";
  if (query === "rep cartoon" || query === "cartoon_color red") return "VALID_NONEMPTY";
  if (/^ribbon_color\b/.test(query)) return "VALID_EMPTY";
  if (query === "byfragment ligand") return "MISSING_DEPENDENCY";
  if (/^byring\b/.test(query)) return "VALID_EMPTY";
  if (/^(segi|bysegi|bycell|donors|acceptors)\b/.test(query)) return "UNSUPPORTED_OPERATOR_OR_PROFILE";
  if (query === "gap 0 ligand" || query === "gap 4 ligand") return query === "gap 4 ligand" ? "VALID_EMPTY" : "VALID_NONEMPTY";
  if (/^(partial_charge|polymer\.nucleic)\b/.test(query) || query === "label foo") return "MISSING_DEPENDENCY";
  if (query === "pepseq ag") return "VALID_NONEMPTY";
  if (query === "pepseq 10") return "INVALID_VALUE";
  if (query === "foo = bar") return "SYNTAX_ERROR";
  if (query === "groupa") return "UNKNOWN_NAME";
  if (query === "name like ca" || query === "near_to ligand") return "SYNTAX_ERROR";
  if (query === "chain a protein") return "VALID_NONEMPTY";
  if (["none", "?missing", "alt a", "hydro", "state 2", "neighbor ligand", "formal_charge = 0", "b > 20"].includes(query)) return query === "formal_charge = 0" ? "MISSING_DEPENDENCY" : "VALID_EMPTY";
  if (query === "ss helix") return "MISSING_DEPENDENCY";
  return "VALID_NONEMPTY";
};

const observedSemanticStatus = (category: string, resultText: string, diagnostics: readonly string[], count: number | null): string => {
  if (category !== "SELECTION") return "COMMAND_HANDLED";
  const text = [resultText, ...diagnostics].join(" ");
  if (/Selected [\d,]+ atoms|Named selection .*created/i.test(resultText)) return count === 0 ? "VALID_EMPTY" : "VALID_NONEMPTY";
  if (/Presentation selector|data is unavailable|visibility is not bound|unavailable/i.test(text)) return "MISSING_DEPENDENCY";
  if (/gated|unsupported|Segment identity/i.test(text)) return "UNSUPPORTED_OPERATOR_OR_PROFILE";
  if (/Unknown canonical property|Unknown property/i.test(text)) return "UNKNOWN_PROPERTY";
  if (/pepseq requires/i.test(text)) return "INVALID_VALUE";
  if (/does not exist/i.test(text)) return "UNKNOWN_NAME";
  if (/ambiguous/i.test(text)) return "AMBIGUOUS_NAME";
  if (/require|Unexpected token|Expected|malformed/i.test(text)) return "SYNTAX_ERROR";
  return "SELECTION_REJECTED";
};

test("representative selection families run through the real console input", async ({ page }) => {
  test.setTimeout(240000);
  const browserConsoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserConsoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => networkErrors.push(request.url() + " · " + (request.failure()?.errorText ?? "request failed")));

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
  await expect(page.getByTitle("mini-protein.pdb").first()).toBeVisible();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
  const entries = consoleRegion.locator(".console-entry");
  const activeSelection = page.getByTestId("active-selection");
  const viewer = page.getByTestId("molecular-viewer");
  const queries = [
    "select active_site, chain A",
    "all within 4 of ligand", "all around 4 of ligand", "all near_to 4 of ligand", "all beyond 4 of ligand",
    "all", "*", "everything", "none", "enabled", "present", "visible", "polymer.nucleic", "name CA", "%active_site", "?missing", "active_site", "groupA", "not water", "!water", "chain A and protein", "chain A & protein", "ligand or water", "ligand | water", "(chain A or chain B) and name CA", "chain A protein", "first all", "last all", "model mini-protein.pdb", "object mini-protein.pdb", "chain A", "segi A", "resn ALA", "resi 1", "alt A", "index 2", "id 2", "rank 0", "name != CA", "label all, {name}", "select label CA", "pepseq AG", "pepseq 10", "name CA in chain A", "name like CA", "(chain A and name CA) like (chain A and name CA)", "byobject chain A", "bysegi chain A", "bychain ligand", "byres name CA", "bycalpha name CA", "bymolecule ligand", "byfragment ligand", "byring ligand", "bycell chain A", "neighbor ligand", "bound_to ligand", "extend 1 ligand", "within 4 of ligand", "around 4 of ligand", "expand 4 ligand", "near_to ligand", "beyond 4 ligand", "gap 0 ligand", "gap 4 ligand", "formal_charge = 0", "partial_charge > 0", "b > 20", "q >= 0.5", "ss HELIX", "elem C", "x < 2", "x <= 2", "y >= 0", "z <= 100", "state 2", "foo = bar", "rep cartoon", "color red", "select color red", "show sticks, all", "hide sticks, all", "center all", "zoom all", "measure distance", "measure clear", "get_view", "set cartoon_color, red, polymer", "cartoon_color red", "ribbon_color red",
  ];
  const evidence: Array<Record<string, unknown>> = [];

  for (const value of queries) {
    const entryCountBeforeQuery = await entries.count();
    await command.fill(value);
    await page.getByRole("button", { name: /Run/ }).click();
    const latest = entries.nth(entryCountBeforeQuery);
    await expect(entries).toHaveCount(entryCountBeforeQuery + 1);
    await expect(latest).toBeVisible();
    await expect(latest.locator(".console-result")).toBeVisible();
    await expect(latest).not.toContainText(/Unknown command|Command is not implemented/);
    const category = await latest.locator(".console-category").innerText();
    const resultText = await latest.locator(".console-result").innerText();
    const diagnostics = await latest.locator(".console-diagnostic").allTextContents({ timeoutMs: 1000 });
    const selectedMatch = resultText.match(/Selected ([\d,]+) atoms/);
    const atomMatch = resultText.match(/(\d[\d,]*) atoms/);
    const observedAtomCount = atomMatch ? Number(atomMatch[1].replaceAll(",", "")) : null;
    const selectionResult = category === "SELECTION" && (/Selected [\d,]+ atoms|Named selection .*created/i.test(resultText));
    let observedMembershipHash: string | null = null;
    let viewerMembershipHash: string | null = null;
    let selectionIndicator: string | null = null;
    let selectionVisible = false;
    if (selectionResult) {
      await expect(activeSelection).toBeVisible();
      observedMembershipHash = await activeSelection.getAttribute("data-membership-hash");
      viewerMembershipHash = await viewer.getAttribute("data-selection-membership-hash");
      selectionIndicator = await viewer.getAttribute("data-selection-indicator");
      selectionVisible = selectionIndicator === "visible";
      expect(viewerMembershipHash).toBe(observedMembershipHash);
    }
    const subsequentTargeting: Record<string, unknown> = { attempted: false, command: "show sticks, all" };
    if (selectionResult && observedMembershipHash) {
      const entryCountBeforeTargeting = await entries.count();
      await command.fill("show sticks, all");
      await page.getByRole("button", { name: /Run/ }).click();
      const targetingEntry = entries.nth(entryCountBeforeTargeting);
      await expect(entries).toHaveCount(entryCountBeforeTargeting + 1);
      await expect(targetingEntry).toContainText(/SHOW STICKS|SHOW_AS STICKS/i);
      await expect(targetingEntry.locator(".console-result")).toBeVisible();
      const retainedHash = await activeSelection.getAttribute("data-membership-hash");
      subsequentTargeting.attempted = true;
      subsequentTargeting.category = await targetingEntry.locator(".console-category").innerText();
      subsequentTargeting.result = await targetingEntry.locator(".console-result").innerText();
      subsequentTargeting.retainedMembershipHash = retainedHash;
      subsequentTargeting.unchanged = retainedHash === observedMembershipHash;
      expect(retainedHash).toBe(observedMembershipHash);
      expect(subsequentTargeting.unchanged).toBe(true);
    }
    const observedStatus = observedSemanticStatus(category, resultText, diagnostics, selectedMatch ? Number(selectedMatch[1].replaceAll(",", "")) : observedAtomCount);
    const expectedAtomCount = expectedCounts.get(value);
    if (expectedAtomCount !== undefined && category === "SELECTION") expect(observedAtomCount).toBe(expectedAtomCount);
    evidence.push({
      query: value,
      expected: {
        semanticStatus: expectedSemanticStatus(value),
        atomCount: expectedCounts.get(value) ?? null,
        membershipHash: null,
      },
      observed: {
        semanticStatus: observedStatus,
        category,
        result: resultText,
        atomCount: category === "SELECTION" ? observedAtomCount : null,
        membershipHash: observedMembershipHash,
        viewerMembershipHash,
        selectionIndicator,
        selectionVisible,
        selectionIndicationConsistent: observedMembershipHash ? viewerMembershipHash === observedMembershipHash : null,
      },
      subsequentTargeting,
      failureDiagnostics: diagnostics,
    });
  }

  writeFileSync(resolve("verification/selection/selection-live-evidence.json"), JSON.stringify({
    schemaVersion: 1,
    fixture: "tests/fixtures/mini-protein.pdb",
    generatedBy: "tests/e2e/selection-matrix-live.spec.ts",
    expectedMembershipHashPolicy: "null when no independent application-fixture hash is pinned; observed hashes are recorded from the active canonical selection result",
    attemptedQueryCount: queries.length,
    browserConsoleErrors,
    pageErrors,
    networkErrors,
    attempts: evidence,
  }, null, 2) + "\n", "utf8");
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
  await page.screenshot({ path: resolve("verification/evidence/selection-console-matrix.png"), animations: "disabled" });
});
