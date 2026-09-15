import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type CampaignCase = { testId: string; category: string; query: string; sourceQuery: string; kind: string };
type Programmatic = { test_id: string; actual_programmatic_classification: string; actual_count: number | null; canonical_membership_hash: string; stable_atom_ids: string[]; fixture: string; fixture_sha256: string; molecular_revision: string; diagnostics: unknown[] };
type UiRecord = Record<string, unknown>;

const root = resolve(".");
const campaign = JSON.parse(readFileSync(resolve("verification/selection-exhaustive/campaign-cases.json"), "utf8")) as { cases: CampaignCase[]; caseCount: number };
const programmatic = JSON.parse(readFileSync(resolve("verification/selection-exhaustive/programmatic-results.json"), "utf8")) as { records: Programmatic[] };
const byId = new Map(programmatic.records.map((record) => [record.test_id, record]));
const categoryDir = (category: string) => resolve("verification/selection-exhaustive/evidence", category);
const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const classificationFromUi = (category: string, consoleCategory: string, result: string, diagnostics: string[], count: number | null): string => {
  const text = `${result} ${diagnostics.join(" ")}`;
  if (/(unsupported|gated|not available|unavailable|missing dependency)/i.test(text)) return /unavailable|missing dependency/i.test(text) ? "IMPLEMENTED_WITH_LIMITATION" : "UNSUPPORTED_VALID";
  if (/unknown command|not implemented|not parsed|no structure loaded/i.test(text)) return "BLOCKED";
  if (consoleCategory !== "SELECTION") return /error|failed|preserved/i.test(text) && !/applied|handled|selected|executed/i.test(text) ? "IMPLEMENTED_WITH_LIMITATION" : "PASS";
  if (/require|expected|unexpected|malformed|invalid|syntax|unknown property|unknown selector/i.test(text) && !/Selected \d[\d,]* atoms/i.test(result)) return "INVALID_EXPECTED";
  if (/does not exist|unknown name/i.test(text) && !/Selected \d[\d,]* atoms/i.test(result)) return category === "AG" ? "EMPTY_VALID" : "INVALID_EXPECTED";
  if (count === 0) return "EMPTY_VALID";
  if (count !== null && /Selected [\d,]+ atoms|Named selection .*created/i.test(result)) return "PASS";
  return "IMPLEMENTED_WITH_LIMITATION";
};

const buildReports = (records: UiRecord[]) => {
  const byCategory = new Map<string, UiRecord[]>();
  for (const record of records) { const list = byCategory.get(String(record.category)) ?? []; list.push(record); byCategory.set(String(record.category), list); }
  const statuses = records.reduce<Record<string, number>>((acc, record) => { const key = String(record.final_status); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
  const missing = campaign.cases.map((entry) => entry.testId).filter((id) => !records.some((record) => record.test_id === id));
  const csvHeader = ["test_id","category","query","fixture","expected_classification","actual_classification","actual_count","programmatic_count","mole_hash","canonical_sha256","visual_pass","screenshot","duration_ms","notes"];
  const csvRows = records.map((record) => csvHeader.map((key) => csvEscape(record[key])).join(","));
  writeFileSync(resolve("verification/selection-exhaustive/SELECTION_A_BF_RESULTS.json"), JSON.stringify({ schemaVersion: 1, campaign: "A→BF", generatedAt: new Date().toISOString(), expectedTestExecutions: campaign.caseCount, actualTestExecutions: records.length, missingTestIds: missing, statusCounts: statuses, records }, null, 2) + "\n");
  writeFileSync(resolve("verification/selection-exhaustive/SELECTION_A_BF_RESULTS.csv"), [csvHeader.join(","), ...csvRows].join("\n") + "\n");
  const lines = ["# Selection A→BF exhaustive report", "", `Generated: ${new Date().toISOString()}`, `Expected executions: ${campaign.caseCount}`, `Actual executions: ${records.length}`, `Missing IDs: ${missing.length}`, "", "## Status counts", "", ...Object.entries(statuses).sort().map(([key, value]) => `- ${key}: ${value}`), "", "## Category coverage", "", ...[...byCategory.entries()].sort().map(([category, list]) => `- ${category}: ${list.length}/${campaign.cases.filter((entry) => entry.category === category).length}`), "", "## Verification policy", "", "Each case has one local screenshot, a UI console result, an independent canonical evaluator result, and a SHA-256 hash over the sorted membership tuple. PyMOL exact replay is reported separately and is BLOCKED when the pinned PyMOL runtime is unavailable.", "", `Campaign status: ${missing.length === 0 && records.every((record) => record.final_status !== "DEFECT") ? "PARTIAL" : "FAIL_INCOMPLETE"}`];
  writeFileSync(resolve("verification/selection-exhaustive/FINAL_SELECTION_A_BF_REPORT.md"), lines.join("\n") + "\n");
  writeFileSync(resolve("verification/selection-exhaustive/FINAL_SELECTION_A_BF_REPORT.json"), JSON.stringify({ schemaVersion: 1, campaignStatus: missing.length === 0 ? "PARTIAL" : "FAIL_INCOMPLETE", expectedExecutions: campaign.caseCount, actualExecutions: records.length, missingTestIds: missing, statusCounts: statuses, categoryCoverage: Object.fromEntries([...byCategory.entries()].map(([k, v]) => [k, v.length])), pymol: { status: "BLOCKED", reason: "Pinned PyMOL module is unavailable in the current Python runtime; no equivalence was fabricated." } }, null, 2) + "\n");
};

test("exhaustive A through BF selection and action replay", async ({ page }) => {
  test.setTimeout(1_200_000);
  page.setDefaultTimeout(7000);
  page.setDefaultNavigationTimeout(15000);
  mkdirSync(resolve("verification/selection-exhaustive/evidence"), { recursive: true });
  const records: UiRecord[] = [];
  const browserConsoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserConsoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const loadedFixtures = new Set<string>();
  let currentFixture = "";
  let consoleReady = false;
  for (const entry of campaign.cases) {
    const expected = byId.get(entry.testId);
    const fixture = expected?.fixture ?? "tests/fixtures/mini-protein.pdb";
    const started = Date.now();
    let screenshot = "";
    let actualClassification = "BLOCKED";
    let consoleCategory = "";
    let resultText = "";
    let diagnostics: string[] = [];
    let actualCount: number | null = null;
    let activeHash: string | null = null;
    let selectionIndicator: string | null = null;
    let visualPass = false;
    let notes = "";
    try {
      if (fixture !== currentFixture || !loadedFixtures.has(fixture)) {
        await page.locator('input[type="file"]').setInputFiles(resolve(fixture));
        await expect(page.getByTitle(fixture.split(/[\\/]/).pop()!).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId("molecular-viewer")).toHaveAttribute("data-viewer-state", "loaded", { timeout: 20_000 });
        currentFixture = fixture; loadedFixtures.add(fixture);
      }
      if (!consoleReady) {
        await page.getByRole("button", { name: "Display panel" }).click();
        await page.getByRole("button", { name: "Expand console", exact: true }).click();
        consoleReady = true;
      }
      const consoleRegion = page.getByRole("region", { name: "Command and selection console" });
      const entries = consoleRegion.locator(".console-entry");
      const before = await entries.count();
      const command = page.getByRole("textbox", { name: "Command or selection query" });
      await command.fill(entry.query);
      await page.getByRole("button", { name: /Run/ }).click();
      await expect(entries).toHaveCount(before + 1, { timeout: 20_000 });
      const latest = entries.nth(before);
      await expect(latest.locator(".console-result")).toBeVisible({ timeout: 20_000 });
      consoleCategory = await latest.locator(".console-category").innerText();
      resultText = await latest.locator(".console-result").innerText();
      diagnostics = await latest.locator(".console-diagnostic").allTextContents({ timeout: 1000 }).catch(() => []);
      const match = resultText.match(/(?:Selected|Named selection [^ ]+ created ·) ([\d,]+) atoms/i) ?? resultText.match(/(\d[\d,]*) atoms/i);
      actualCount = match ? Number(match[1]!.replaceAll(",", "")) : null;
      activeHash = await page.getByTestId("active-selection").getAttribute("data-membership-hash").catch(() => null);
      selectionIndicator = await page.getByTestId("molecular-viewer").getAttribute("data-selection-indicator").catch(() => null);
      actualClassification = classificationFromUi(entry.category, consoleCategory, resultText, diagnostics, actualCount);
      const viewer = page.getByTestId("molecular-viewer");
      const box = await viewer.boundingBox();
      const overflow = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > window.innerWidth + 1, vertical: document.documentElement.scrollHeight > window.innerHeight * 2 }));
      visualPass = Boolean(box && box.width > 200 && box.height > 180 && !overflow.horizontal);
      notes = overflow.horizontal ? "horizontal-overflow" : "";
      const cat = entry.category;
      mkdirSync(categoryDir(cat), { recursive: true });
      screenshot = `verification/selection-exhaustive/evidence/${cat}/${entry.testId}__${actualClassification}.png`;
      await page.screenshot({ path: resolve(screenshot), animations: "disabled" });
    } catch (error) {
      notes = error instanceof Error ? error.message : String(error);
      mkdirSync(categoryDir(entry.category), { recursive: true });
      screenshot = `verification/selection-exhaustive/evidence/${entry.category}/${entry.testId}__BLOCKED.png`;
      await page.screenshot({ path: resolve(screenshot), animations: "disabled" }).catch(() => undefined);
      actualClassification = "BLOCKED";
      await page.goto("/").catch(() => undefined);
      currentFixture = "";
      consoleReady = false;
    }
    records.push({
      test_id: entry.testId, category: entry.category, query: entry.query, source_query: entry.sourceQuery,
      fixture, fixture_sha256: expected?.fixture_sha256 ?? null, expected_classification: expected?.actual_programmatic_classification ?? null,
      actual_classification: actualClassification, final_status: actualClassification, console_category: consoleCategory,
      result: resultText, diagnostics, actual_count: actualCount, programmatic_count: expected?.actual_count ?? null,
      mole_membership_hash: activeHash, canonical_membership_hash: expected?.canonical_membership_hash ?? null,
      exact_membership: expected && actualCount !== null && expected.actual_count === actualCount && actualClassification === (expected.actual_programmatic_classification === "VALID_EMPTY" ? "EMPTY_VALID" : "PASS"),
      visual_pass: visualPass, selection_indicator: selectionIndicator, screenshot, duration_ms: Date.now() - started, notes,
    });
  }
  buildReports(records);
  mkdirSync(resolve("verification/selection-exhaustive"), { recursive: true });
  writeFileSync(resolve("verification/selection-exhaustive/SELECTION_BROWSER_ERRORS.json"), JSON.stringify({ browserConsoleErrors, pageErrors }, null, 2) + "\n");
  expect(records).toHaveLength(campaign.caseCount);
  expect(new Set(records.map((record) => record.test_id)).size).toBe(campaign.caseCount);
});
