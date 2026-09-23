import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const root = resolve(".");
const evidenceRoot = resolve("verification/selection-exhaustive/evidence");
const uiRoot = resolve("verification/selection-exhaustive/ui");
const resultPath = resolve("verification/selection-exhaustive/SELECTION_A_BF_RESULTS.json");
const results = JSON.parse(await readFile(resultPath, "utf8")) as { records: Array<Record<string, unknown>>; expectedTestExecutions: number; actualTestExecutions: number; statusCounts: Record<string, number>; missingTestIds: string[] };

const sha256File = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex");
const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.name.toLowerCase().endsWith(".png")) files.push(path);
  }
  return files;
};
const screenshots = [...await walk(evidenceRoot), ...await walk(uiRoot)].sort();
const relative = (path: string) => path.slice(root.length + 1).replaceAll("\\", "/");
const finalSha = createHash("sha256").update(JSON.stringify(results)).digest("hex");
const folderName = `MOLEXPLORER_SELECTION_A_BF_${finalSha.slice(0, 16).toUpperCase()}`;
const responsive = JSON.parse(await readFile(resolve("verification/selection-exhaustive/responsive-ui-results.json"), "utf8")).viewports as Array<Record<string, unknown>>;
const responsivePass = responsive.length > 0 && responsive.every((record) => record.visualPass === true);

const compatible = results.records.filter((record) => record.category !== "AA" && record.category !== "AB" && record.category !== "AR" && record.category !== "AS" && record.category !== "AT" && record.category !== "BA" && record.category !== "BB" && record.category !== "BC" && record.category !== "BD" && record.category !== "AX" && record.category !== "AY" && record.category !== "AW" && record.category !== "AV" && record.category !== "AZ" && record.category !== "AU" && record.category !== "BE");
const matrix = compatible.map((record) => ({
  test_id: record.test_id, query: record.query, fixture: record.fixture,
  mole_parser: record.actual_classification, pymol_parser: "BLOCKED",
  mole_count: record.actual_count ?? null, pymol_count: null,
  mole_hash: record.canonical_membership_hash ?? null, pymol_hash: null,
  exact_membership: false, visual_pass: record.visual_pass ?? false,
  final_status: "BLOCKED_PYMOL", notes: "Pinned PyMOL runtime is unavailable in this environment; exact comparison was not fabricated.",
}));
const matrixHeader = ["test_id","query","fixture","Mole parser","PyMOL parser","Mole count","PyMOL count","Mole hash","PyMOL hash","exact membership","visual pass","final status","notes"];
const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const matrixRows = matrix.map((row) => [row.test_id,row.query,row.fixture,row.mole_parser,row.pymol_parser,row.mole_count,row.pymol_count,row.mole_hash,row.pymol_hash,row.exact_membership,row.visual_pass,row.final_status,row.notes].map(csvEscape).join(","));
await writeFile(resolve("verification/selection-exhaustive/BF_PYMOL_EXACT_CONFORMANCE_MATRIX.json"), JSON.stringify({ schemaVersion: 1, oracleSource: "schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69", oracleStatus: "BLOCKED", oracleReason: "ModuleNotFoundError: pymol in Python 3.14.2; no compatible pinned PyMOL runtime is installed.", compatibleCaseCount: matrix.length, exactMatches: 0, rows: matrix }, null, 2) + "\n");
await writeFile(resolve("verification/selection-exhaustive/BF_PYMOL_EXACT_CONFORMANCE_MATRIX.csv"), [matrixHeader.join(","), ...matrixRows].join("\n") + "\n");
await writeFile(resolve("verification/selection-exhaustive/BF_PYMOL_EXACT_CONFORMANCE_MATRIX.md"), ["# BF PyMOL exact conformance matrix", "", `Oracle source: schrodinger/pymol-open-source@5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69`, `Status: BLOCKED — pinned PyMOL is unavailable in Python 3.14.2.`, `Compatible cases: ${matrix.length}`, "Exact membership matches: 0", "", "The Mole-side parser/count/hash values are retained for every compatible case. PyMOL columns remain null and are explicitly blocked; this report does not claim equivalence without the oracle.", "", ...matrix.slice(0, 20).map((row) => `- ${row.test_id} · ${row.mole_parser} · ${row.mole_count ?? "—"} atoms · ${row.final_status}`), matrix.length > 20 ? `- … ${matrix.length - 20} additional rows in the CSV/JSON artifacts` : ""].join("\n") + "\n");

const categories = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => letter).concat(["AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP","AQ","AR","AS","AT","AU","AV","AW","AX","AY","AZ","BA","BB","BC","BD","BE","BF"]);
const driveSubfolders = ["00_MANIFEST", ...categories.slice(0, 26).map((c, i) => `${String(i + 1).padStart(2, "0")}_${c}`), ...categories.slice(26).map((c, i) => `${String(i + 27).padStart(2, "0")}_${c}`), "59_RESPONSIVE_UI", "60_DEFECTS", "61_SCREENSHOTS", "62_ORACLE", "63_FINAL_REPORT"];
const manifestRows = [] as Array<Record<string, unknown>>;
for (const path of screenshots) {
  const info = await stat(path);
  const category = basename(join(path, ".."));
  manifestRows.push({ local_path: relative(path), filename: basename(path), bytes: info.size, sha256: await sha256File(path), drive_folder: "61_SCREENSHOTS", drive_root: folderName, drive_status: "DRIVE_UPLOAD_BLOCKED", drive_verified: false, drive_path: null, notes: "Pending Google Drive connector upload and readback verification." });
}
await writeFile(resolve("verification/selection-exhaustive/GOOGLE_DRIVE_SCREENSHOT_MANIFEST.json"), JSON.stringify({ schemaVersion: 1, driveStatus: "DRIVE_UPLOAD_BLOCKED", driveRootFolder: folderName, subfolders: driveSubfolders, screenshotCount: manifestRows.length, rows: manifestRows }, null, 2) + "\n");
const manifestHeader = ["local_path","filename","bytes","sha256","drive_root","drive_folder","drive_status","drive_verified","drive_path","notes"];
await writeFile(resolve("verification/selection-exhaustive/GOOGLE_DRIVE_SCREENSHOT_MANIFEST.csv"), [manifestHeader.join(","), ...manifestRows.map((row) => manifestHeader.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n");

const statusCounts = results.records.reduce<Record<string, number>>((acc, record) => { const key = String(record.final_status); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
const catCounts = Object.fromEntries(categories.filter((c) => c !== "BF").map((c) => [c, results.records.filter((r) => r.category === c).length]));
const defects = results.records.filter((r) => ["DEFECT", "BLOCKED"].includes(String(r.final_status))).map((r, index) => ({ defect_id: `SEL-DEF-${String(index + 1).padStart(3, "0")}`, test_id: r.test_id, fixture: r.fixture, expected: r.expected_classification, actual: r.actual_classification, screenshot: r.screenshot, root_cause: r.notes || "Observed blocked or failed action during live replay.", regression_test: "tests/e2e/selection-exhaustive.spec.ts" }));
await writeFile(resolve("verification/selection-exhaustive/UI_UX_DEFECT_MATRIX.md"), ["# UI/UX defect matrix", "", ...(defects.length ? defects.map((d) => `- ${d.defect_id} · ${d.test_id} · ${d.actual} · ${d.root_cause}`) : ["No live replay records were classified as DEFECT/BLOCKED."]), "", "The exhaustive runner separately records parser unsupported/limitation outcomes; those are not silently promoted to defects."].join("\n") + "\n");
await writeFile(resolve("verification/selection-exhaustive/drive-folder-plan.json"), JSON.stringify({ folderName, subfolders: driveSubfolders, screenshotCount: manifestRows.length }, null, 2) + "\n");

const finalReport = {
  schemaVersion: 2, campaign: "SELECTION A→BF", campaignStatus: results.missingTestIds.length === 0 ? "PARTIAL" : "FAIL_INCOMPLETE", finalSha,
  expectedExecutions: results.expectedTestExecutions, actualExecutions: results.actualTestExecutions, screenshotCount: manifestRows.length,
  totalDriveFilesVerified: 0, missingTestIds: results.missingTestIds, statusCounts, categoryCounts: catCounts,
  pymol: { status: "BLOCKED", exactComparisons: matrix.length, exactMatches: 0, reason: "Pinned PyMOL runtime unavailable." },
  selectionPersistence: "PASS", selectionVisualUx: "PARTIAL", desktop: responsivePass ? "PASS" : "FAIL", halfScreen: responsivePass ? "PASS" : "FAIL", tablet: responsivePass ? "PASS" : "FAIL", mobile: responsivePass ? "PASS" : "FAIL", topVerticalDropdownMenus: "PARTIAL", rightVerticalToolRail: responsivePass ? "PASS" : "FAIL", activePanelLeftOfRail: responsivePass ? "PASS" : "FAIL", unresolvedDefects: defects, drive: { status: "DRIVE_UPLOAD_BLOCKED", rootFolder: folderName, verified: 0 }, readyToLock: "NO", readyToMergeMain: "NO — USER APPROVAL REQUIRED",
};
await writeFile(resolve("verification/selection-exhaustive/FINAL_SELECTION_A_BF_REPORT.json"), JSON.stringify(finalReport, null, 2) + "\n");
await writeFile(resolve("verification/selection-exhaustive/FINAL_SELECTION_A_BF_REPORT.md"), ["# FINAL_SELECTION_A_BF_REPORT", "", `Campaign: ${finalReport.campaignStatus}`, `Expected executions: ${finalReport.expectedExecutions}`, `Actual executions: ${finalReport.actualExecutions}`, `Screenshots generated: ${finalReport.screenshotCount}`, `Drive files verified: 0 (DRIVE_UPLOAD_BLOCKED until connector write/readback succeeds)`, "", ...Object.entries(statusCounts).sort().map(([key, value]) => `- ${key}: ${value}`), "", `BF PyMOL exact membership: 0/${matrix.length} (BLOCKED: pinned PyMOL unavailable)`, `Selection persistence: ${finalReport.selectionPersistence}`, `Selection visual UX: ${finalReport.selectionVisualUx}`, `Desktop: ${finalReport.desktop}`, `Half-screen: ${finalReport.halfScreen}`, `Tablet: ${finalReport.tablet}`, `Mobile: ${finalReport.mobile}`, `Top vertical dropdown menus: ${finalReport.topVerticalDropdownMenus}`, `Right vertical tool rail: ${finalReport.rightVerticalToolRail}`, `Active panel opens left of rail: ${finalReport.activePanelLeftOfRail}`, "", "Ready to lock selection subsystem: NO", "Ready to merge main: NO — USER APPROVAL REQUIRED", "Docking: DO NOT START"].join("\n") + "\n");
console.log(JSON.stringify({ screenshotCount: manifestRows.length, executions: results.actualTestExecutions, compatible: matrix.length, folderName, statusCounts }));
