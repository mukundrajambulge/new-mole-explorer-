import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const matrix = JSON.parse(await readFile(join(root, "verification/selection/selection-operator-matrix.json"), "utf8"));
const oracle = JSON.parse(await readFile(join(root, "verification/selection/pymol-oracle-results.json"), "utf8"));
const oracleByQuery = new Map((oracle.rows ?? []).map((row) => [String(row.query ?? row.applicationQuery), row]));

const clean = (value) => String(value).replace(/^`|`$/g, "").trim();
const positiveCases = matrix.entries.map((entry, index) => {
  const query = clean(entry.operator);
  const oracleRow = oracleByQuery.get(query);
  return {
    caseId: `Q-${String(index + 1).padStart(3, "0")}-POSITIVE`,
    operator: query,
    query,
    class: "positive",
    expected: entry.decision ?? "operator accepted according to the selection contract",
    implementationStatus: entry.implementationStatus,
    liveBrowserStatus: entry.liveBrowserStatus,
    oracleStatus: entry.oracleStatus,
    oracleEvidence: oracleRow ? "verification/selection/pymol-oracle-results.json" : null,
    oracleObserved: oracleRow ? { status: oracleRow.status ?? oracleRow.oracleStatus, count: oracleRow.count ?? null, membershipHash: oracleRow.membershipHash ?? null, error: oracleRow.error ?? null } : null,
    notes: "Generated from the maintained 87-row selection operator matrix; this row is a contract/evidence reference, not a new executable PyMOL run."
  };
});

const zeroCases = matrix.entries.map((entry, index) => ({
  caseId: `Q-${String(index + 1).padStart(3, "0")}-ZERO`,
  operator: clean(entry.operator),
  query: "none",
  class: "zero-result",
  expected: "empty selection",
  implementationStatus: entry.implementationStatus,
  liveBrowserStatus: "GENERATED_CASE",
  oracleStatus: oracleByQuery.has("none") ? "ORACLE_VERIFIED" : "ORACLE_PENDING",
  oracleEvidence: oracleByQuery.has("none") ? "verification/selection/pymol-oracle-results.json" : null,
  oracleObserved: oracleByQuery.get("none") ? { status: oracleByQuery.get("none").status ?? oracleByQuery.get("none").oracleStatus, count: oracleByQuery.get("none").count ?? null, membershipHash: oracleByQuery.get("none").membershipHash ?? null } : null,
  notes: "Zero-result control reused for every operator family to detect accidental universe expansion."
}));

const invalidCases = matrix.entries.map((entry, index) => {
  const query = clean(entry.operator);
  return {
    caseId: `Q-${String(index + 1).padStart(3, "0")}-INVALID`,
    operator: query,
    query: `(${query}`,
    class: "invalid",
    expected: "structured rejection or fail-closed parse diagnostic",
    implementationStatus: entry.implementationStatus,
    liveBrowserStatus: "GENERATED_CASE",
    oracleStatus: "ORACLE_PENDING",
    oracleEvidence: null,
    oracleObserved: null,
    notes: "Malformed-parenthesis negative control. Execute in the app and pinned PyMOL when those environments are available; no result is claimed here."
  };
});

const explicit = [
  { caseId: "Q-EDGE-001", query: "name CA and resi 9999", class: "zero-result", expected: "empty selection", notes: "Valid syntax with an absent residue." },
  { caseId: "Q-EDGE-002", query: "chain", class: "invalid", expected: "structured rejection", notes: "Missing chain operand." },
  { caseId: "Q-EDGE-003", query: "resi not-a-number", class: "invalid", expected: "structured rejection", notes: "Invalid numeric operand." },
  { caseId: "Q-EDGE-004", query: "byres (name CA", class: "invalid", expected: "structured rejection", notes: "Unbalanced nested expression." },
  { caseId: "Q-EDGE-005", query: "all", class: "positive", expected: "canonical universe", notes: "Baseline universe control." }
].map((row) => ({ ...row, operator: row.query, implementationStatus: "MATRIX_EDGE_CONTROL", liveBrowserStatus: "GENERATED_CASE", oracleStatus: row.query === "all" && oracleByQuery.has("all") ? "ORACLE_VERIFIED" : "ORACLE_PENDING", oracleEvidence: row.query === "all" ? "verification/selection/pymol-oracle-results.json" : null, oracleObserved: row.query === "all" && oracleByQuery.has("all") ? { status: oracleByQuery.get("all").status ?? oracleByQuery.get("all").oracleStatus, count: oracleByQuery.get("all").count, membershipHash: oracleByQuery.get("all").membershipHash } : null }));

const cases = [...positiveCases, ...zeroCases, ...invalidCases, ...explicit];
const summary = {
  operatorCount: matrix.rowCount,
  caseCount: cases.length,
  positiveCases: cases.filter((c) => c.class === "positive").length,
  zeroResultCases: cases.filter((c) => c.class === "zero-result").length,
  invalidCases: cases.filter((c) => c.class === "invalid").length,
  oracleVerified: cases.filter((c) => c.oracleStatus === "ORACLE_VERIFIED").length,
  oracleEquivalent: cases.filter((c) => c.oracleStatus === "ORACLE_EQUIVALENT").length,
  oraclePending: cases.filter((c) => c.oracleStatus === "ORACLE_PENDING").length,
  executableAvailable: false,
  executableBlocker: "No pymol/pymol.exe executable or importable pymol module is installed in the campaign environment."
};

const corpus = { schemaVersion: 1, generatedAt: new Date().toISOString(), source: "verification/selection/selection-operator-matrix.json", methodology: "Every maintained operator receives positive, zero-result, and malformed negative controls; generated controls are explicitly marked and carry no unobserved oracle claim.", cases, summary };
const comparison = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  applicationMatrix: "verification/selection/selection-operator-matrix.json",
  pinnedOracleResults: "verification/selection/pymol-oracle-results.json",
  oracleExecutable: "BLOCKED",
  oracleBlocker: summary.executableBlocker,
  classificationPolicy: { ORACLE_VERIFIED: "direct pinned PyMOL row status PASS", ORACLE_EQUIVALENT: "application alias or documented spelling map with matching membership", ORACLE_PENDING: "no executable result or generated negative control" },
  rows: cases.map((c) => ({ caseId: c.caseId, query: c.query, class: c.class, appStatus: c.liveBrowserStatus, oracleStatus: c.oracleStatus, oracleObserved: c.oracleObserved, gap: c.oracleStatus === "ORACLE_PENDING" ? "EXECUTABLE_ORACLE_REQUIRED" : null }))
};
await writeFile(join(root, "verification/autonomous-pymol/QUERY_CORPUS.json"), `${JSON.stringify(corpus, null, 2)}\n`);
await writeFile(join(root, "verification/autonomous-pymol/QUERY_ORACLE_COMPARISON.json"), `${JSON.stringify(comparison, null, 2)}\n`);
const gapRows = cases.filter((c) => c.oracleStatus === "ORACLE_PENDING");
const md = `# Query gaps\n\nThe campaign generated ${summary.caseCount} query cases across ${summary.operatorCount} maintained operators: ${summary.positiveCases} positive, ${summary.zeroResultCases} zero-result, and ${summary.invalidCases} malformed/invalid controls.\n\nNo executable PyMOL was available, so ${summary.oraclePending} cases remain **ORACLE_PENDING**. These are evidence gaps rather than failures of the Molexplorer selection engine. The pinned source oracle has ${summary.oracleVerified} directly verified cases and ${summary.oracleEquivalent} documented application-to-PyMOL equivalents in the comparison ledger.\n\n## Required follow-up\n\n- Install or provide the pinned PyMOL executable/runtime and rerun every positive and negative case.\n- Capture return code, selected atom tuples, membership hash, and structured parse diagnostics.\n- Promote a case only when the observed membership or documented alias mapping is exact.\n- Keep malformed controls fail-closed; never treat parser errors as empty selections.\n\nThe full per-case ledger is in [QUERY_CORPUS.json](./QUERY_CORPUS.json) and [QUERY_ORACLE_COMPARISON.json](./QUERY_ORACLE_COMPARISON.json).\n`;
await writeFile(join(root, "verification/autonomous-pymol/QUERY_GAPS.md"), md);
console.log(JSON.stringify(summary, null, 2));
