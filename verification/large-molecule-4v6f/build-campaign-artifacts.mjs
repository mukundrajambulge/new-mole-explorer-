import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve("verification/large-molecule-4v6f");
const sourcePath = resolve(root, "01-source/4v6f.cif");
const sourceSha256 = "a48b6f9865ed1dff0e45d1992b9d20633582de6675c16d0b9a4abc75d595e56f";

const write = async (relativePath, contents) => {
  const target = resolve(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
};

const json = async (relativePath, value) => write(relativePath, JSON.stringify(value, null, 2));

const parseCsvLine = (line) => {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { values.push(value); value = ""; continue; }
    value += char;
  }
  values.push(value);
  return values;
};

const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const sourceScan = JSON.parse(await readFile(resolve(root, "02-import/4V6F_LIGHTWEIGHT_SCAN_REPORT.json"), "utf8"));
const previousCsv = await readFile(resolve("verification/selection-exhaustive/SELECTION_A_BF_RESULTS.csv"), "utf8");
const [headerLine, ...dataLines] = previousCsv.trim().split(/\r?\n/);
const headers = parseCsvLine(headerLine);
const previousRows = dataLines.filter(Boolean).map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
const sourceCounts = sourceScan.selectionResults ?? {};

const fixtureSpecific = (fixture) => /charged\.pqr|multistate\.pdb|r07-b2-topology\.pdb/.test(fixture);
const applicabilityRows = previousRows.map((row) => {
  const notApplicable = fixtureSpecific(row.fixture);
  const sourceResult = sourceCounts[row.query];
  return {
    testId: row.test_id,
    category: row.category,
    query: row.query,
    priorFixture: row.fixture,
    priorExpectedClassification: row.expected_classification,
    applicability: notApplicable ? "NOT_APPLICABLE_TO_4V6F" : "APPLICABLE_TO_4V6F",
    executionStatus: notApplicable ? "RETAIN_PRIOR_FIXTURE_ONLY" : "BLOCKED_CANONICAL_IMPORT",
    sourceScanCount: sourceResult?.count ?? null,
    sourceScanMembershipHash: sourceResult?.membershipHash ?? null,
    screenshot: null,
    notes: notApplicable ? "Fixture-specific charge, multi-state, or small-edit case retained in prior A→BE campaign." : "Canonical 4V6F identity did not complete; no browser query or screenshot is claimed."
  };
});
const applicable = applicabilityRows.filter((row) => row.applicability === "APPLICABLE_TO_4V6F");
const notApplicable = applicabilityRows.filter((row) => row.applicability !== "APPLICABLE_TO_4V6F");

await json("05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.json", {
  schemaVersion: 1,
  source: { pdbId: "4V6F", path: "01-source/4v6f.cif", sha256: sourceSha256, method: "OFFICIAL_RCSB_SOURCE_SCAN" },
  reusedDefinitionCount: applicabilityRows.length,
  applicableCount: applicable.length,
  notApplicableCount: notApplicable.length,
  executedCount: 0,
  blockedCount: applicable.length,
  rows: applicabilityRows
});
const matrixColumns = ["testId", "category", "query", "priorFixture", "priorExpectedClassification", "applicability", "executionStatus", "sourceScanCount", "sourceScanMembershipHash", "screenshot", "notes"];
await write("05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.csv", [matrixColumns.join(","), ...applicabilityRows.map((row) => matrixColumns.map((column) => csvEscape(row[column])).join(","))].join("\n"));
await write("05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.md", [
  "# 4V6F A→BE applicability matrix",
  "",
  `Source: official RCSB 4V6F mmCIF, SHA256 \`${sourceSha256}\`. Reused definitions: **${applicabilityRows.length}**; semantically applicable: **${applicable.length}**; fixture-specific and retained only: **${notApplicable.length}**; executed against canonical 4V6F: **0**; blocked after canonical import timeout: **${applicable.length}**.`,
  "",
  "The source-only counts in the JSON are evidence of the parser scan only and are never reported as canonical engine results. No query-specific screenshot is claimed because the canonical model did not complete ingestion.",
  "",
  "| Status | Count |",
  "|---|---:|",
  `| APPLICABLE_TO_4V6F / BLOCKED_CANONICAL_IMPORT | ${applicable.length} |`,
  `| NOT_APPLICABLE_TO_4V6F / RETAIN_PRIOR_FIXTURE_ONLY | ${notApplicable.length} |`,
  "",
  "Fixture-specific exclusions are charged PQR, multi-state PDB, and the small R07-B2 editing topology fixture. Protein/nucleic, solvent, metal, spatial, representation, and generic selection definitions remain applicable in principle, but are blocked from execution by the canonical import defect."
].join("\n"));

await json("04-render/4V6F_RENDER_REPORT.json", {
  pdbId: "4V6F",
  sourceSha256,
  canonicalImport: "BLOCKED_CANONICAL_IMPORT",
  lightweightIdentity: sourceScan.parsedIdentity,
  firstRender: "NOT_RUN",
  representationSweep: "NOT_RUN",
  cleanBootEvidence: "evidence/00-baseline/LM-BOOT-001__clean-boot__PASS.png",
  reason: "Canonical StructureIngestionService identity construction exceeded repeated 20-minute observation windows."
});
await write("04-render/4V6F_RENDER_REPORT.md", "# 4V6F render report\n\nThe official source was downloaded and scanned, but canonical ingestion did not complete. Therefore first render, representation sweep, camera, selection visuals, and large-structure browser interaction are **NOT RUN**, not passed by proxy. Clean boot is separately evidenced by `evidence/00-baseline/LM-BOOT-001__clean-boot__PASS.png`.\n");

const blockedReport = (title, reason) => `# ${title}\n\nStatus: **BLOCKED_CANONICAL_IMPORT**\n\n${reason}\n\nNo successful 4V6F browser interaction is claimed until canonical identity construction completes.\n`;
await write("06-spatial/4V6F_SPATIAL_REPORT.md", blockedReport("4V6F spatial selection report", "Protein/RNA contact, within-distance expansion, monotonic spatial checks, and cross-object spatial selection require the canonical model and were not executed."));
await write("07-color/4V6F_COLOR_REPORT.md", blockedReport("4V6F color report", "Color-mode and component-color acceptance require a rendered canonical model; no source-scan count is substituted for a visual result."));
await write("08-measure/4V6F_MEASURE_REPORT.md", blockedReport("4V6F measurement report", "Distance, angle, dihedral, measurement persistence, and stale-coordinate checks require canonical atom coordinates in the viewer."));
await write("09-console/4V6F_CONSOLE_REPORT.md", blockedReport("4V6F console report", "Console selection and representation commands were not replayed on 4V6F because canonical import was blocked."));
await write("11-session/4V6F_SESSION_REPORT.md", blockedReport("4V6F session report", "Session, scene, export, restore, and revision checks were not replayed on the blocked canonical 4V6F model."));

await json("10-multi-object/MULTI_OBJECT_FIXTURES.json", {
  primary: { id: "4V6F", path: "01-source/4v6f.cif", sha256: sourceSha256, status: "OFFICIAL_SOURCE_PRESENT" },
  standard: { ids: ["4DJW", "1CRN"], repositoryPaths: ["tests/fixtures/4djw.pdb", "tests/fixtures/1crn.pdb"], status: "NOT_FOUND_IN_REPOSITORY", priorEvidence: ["verification/final-rearchitecture/evidence/SLICE_H_4DJW_LOADED.png", "verification/final-rearchitecture/evidence/SLICE_H_1CRN_HIDDEN.png"] },
  small: { id: "mini-protein", path: "tests/fixtures/mini-protein.pdb", status: "PRESENT_STANDARD_REGRESSION_ONLY" },
  canonicalMultiObjectExecution: "NOT_RUN_CANONICAL_IMPORT_BLOCKED",
  note: "No duplicate or fabricated 4DJW/1CRN fixture was created. Existing prior evidence is referenced for regression context only."
});

await write("12-responsive/4V6F_RESPONSIVE_REPORT.md", [
  "# 4V6F responsive report",
  "",
  "The 4V6F-specific responsive render was not run because canonical import is blocked. The responsive layout regression was nevertheless reproduced and fixed with the mini-protein fixture:",
  "",
  "- 720×800 before: canvas CSS width 0; app-main width 56px.",
  "- 720×800 after: canvas CSS size 478×702; WebGL backing buffer 956×1404.",
  "- Focused Playwright test: `G1C-UI-003` PASS.",
  "- Before/after evidence: `evidence/16-defects-before/LM-RESP-001__mini-protein-720x800__FAIL.png` and `evidence/17-defects-after/LM-RESP-001__mini-protein-720x800__PASS.png`.",
  "",
  "Canonical 4V6F responsive acceptance remains blocked by LM-IMP-001, not by the repaired root-grid defect."
].join("\n"));

const performance = {
  sourceBytes: 38137644,
  atomRows: 307345,
  lightweightSourceScan: { elapsedMs: 1735, result: "PASS_SOURCE_SCAN_ONLY", memory: "not instrumented as browser/canonical import" },
  canonicalAttempts: [
    { stage: "pre-parser-fixes", observation: ">20 minutes", peakMemory: "approximately 0.8–1.15 GiB", result: "TIMEOUT_OR_CANCELLED" },
    { stage: "after parser append/index/reduce fixes", observation: ">20 minutes", peakMemory: "approximately 1.5–2.6 GiB", result: "TIMEOUT_OR_CANCELLED" },
    { stage: "after streaming canonical hash helper", observation: ">20 minutes", peakMemory: "approximately 1.5–2.1 GiB", result: "TIMEOUT_OR_CANCELLED" },
    { stage: "after lazy canonical payload views", observation: "approximately 4 minutes before cancellation", peakMemory: "approximately 1.5–1.85 GiB", result: "TIMEOUT_OR_CANCELLED" }
  ],
  uploadPolicyRegression: { result: "PASS", old25MiBBlocker: "resolved", maxBytes: 536870912 },
  standardBrowserRegressionBeforeResponsiveFix: { passed: 146, failed: 1, failure: "G1C-UI-003 zero-width canvas" },
  focusedResponsiveRegressionAfterFix: "PASS",
  acceptanceStatus: "BLOCKED_CANONICAL_IMPORT"
};
await json("13-performance/4V6F_PERFORMANCE_REPORT.json", performance);
await write("13-performance/4V6F_PERFORMANCE_REPORT.md", `# 4V6F performance report\n\nThe 38,137,644-byte official source contains 307,345 atom rows. A lightweight source scan completes in 1,735ms, but that is not a canonical application import. Three canonical attempts exceeded 20 minutes and were cancelled after approximately 0.8–2.6 GiB Node memory, including after parser and streaming-hash optimizations. The upload-policy regression passes with a 512 MiB ceiling; the remaining blocker is canonical identity construction.\n`);

const memory = {
  sourceBytes: 38137644,
  canonicalMemoryObservations: performance.canonicalAttempts,
  browserMemory: "NOT_MEASURED_FOR_4V6F_CANONICAL_MODEL",
  sourceScanMemory: "NOT_INSTRUMENTED",
  status: "CONCERN_BLOCKING_ACCEPTANCE",
  requiredRemediation: "Avoid duplicating the full atom/state/hierarchy graph in scientificPayloadFor and stream or bound canonical identity materialization."
};
await json("14-memory/4V6F_MEMORY_REPORT.json", memory);
await write("14-memory/4V6F_MEMORY_REPORT.md", "# 4V6F memory report\n\nCanonical ingestion is a memory concern and acceptance blocker. Observed attempts reached approximately 1.5–2.6 GiB after parser optimizations before cancellation. No browser-memory pass is claimed.\n");

await write("15-oracle/4V6F_PYMOL_ORACLE_MATRIX.md", [
  "# 4V6F PyMOL oracle matrix",
  "",
  "`PYMOL_ORACLE_STATUS = BLOCKED_ENVIRONMENT`.",
  "",
  "The project-pinned PyMOL executable/module was not available in the current environment (`Get-Command pymol` and repository runtime search found no pinned executable). No random newer runtime was substituted, and no exact PyMOL conformance claim is made.",
  "",
  "| Area | Status |",
  "|---|---|",
  "| 4V6F canonical identity equivalence | BLOCKED_CANONICAL_IMPORT |",
  "| selection equivalence | BLOCKED_CANONICAL_IMPORT |",
  "| render/representation equivalence | BLOCKED_CANONICAL_IMPORT |",
  "| pinned PyMOL reference execution | BLOCKED_ENVIRONMENT |"
].join("\n"));

const digest = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
if (digest !== sourceSha256) throw new Error(`source hash changed: ${digest}`);
console.log(JSON.stringify({ reusedDefinitions: applicabilityRows.length, applicable: applicable.length, notApplicable: notApplicable.length, sourceSha256: digest }));
