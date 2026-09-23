import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const matrix = JSON.parse(await readFile(join(root, "verification/r10/PYMOL_COMPATIBILITY_MATRIX.json"), "utf8"));
const importanceFor = (row) => {
  if (["select", "show", "hide", "as", "color", "set", "get", "center", "zoom", "load", "save"].includes(row.publicName)) return "P0";
  if (row.publicName === "cealign" || ["align", "super", "fit", "rms", "rms_cur"].includes(row.publicName)) return "P1";
  if (row.family === "unsafe") return "NEVER";
  if (["movie/runtime", "files/import/export"].includes(row.family)) return "P3";
  if (row.family === "analysis/other") return "P2";
  return "P2";
};
const gapCategory = (row) => row.disposition === "UNSAFE_REJECTED" ? "MOLEXPLORER_INTENTIONAL_SAFETY_DIVERGENCE" : row.disposition === "REFERENCE_ONLY_OUT_OF_SCOPE" ? "REFERENCE_ONLY" : row.disposition === "SAFE_BUT_NOT_IMPLEMENTED" ? "IMPLEMENTATION_GAP" : row.disposition === "ORACLE_PENDING" ? "COMING_SOON_ORACLE_PENDING" : "TRANSLATED_BOUNDARY";
const implementationLevel = (row) => row.disposition === "SAFE_TRANSLATABLE" ? "SUPPORTED_TRANSLATION_BOUNDARY" : row.disposition === "SAFE_BUT_NOT_IMPLEMENTED" ? "REGISTERED_UNAVAILABLE" : row.disposition === "ORACLE_PENDING" ? "REGISTERED_ONLY" : row.disposition === "UNSAFE_REJECTED" ? "REJECTED_BEFORE_EXECUTION" : "OUT_OF_SCOPE_REFERENCE";
const rows = matrix.commands.map((row) => ({
  keyword: row.publicName,
  family: row.family,
  sourceCommit: row.sourceCommit,
  sourceSyntaxStatus: row.syntaxStatus,
  molexplorerDisposition: row.disposition,
  implementationLevel: implementationLevel(row),
  safetyStatus: row.safetyStatus,
  capabilityState: row.capabilityState,
  oracleStatus: row.oracleStatus,
  category: gapCategory(row),
  priority: importanceFor(row),
  canonicalCommandType: row.canonicalCommandType,
  evidenceRefs: row.evidenceRefs,
  recommendedDisposition: row.disposition === "SAFE_BUT_NOT_IMPLEMENTED" ? "Implement a scientifically validated handler or keep visibly unavailable" : row.disposition === "ORACLE_PENDING" ? "Add bounded handler only after source/oracle test and UI/REST convergence" : row.disposition === "UNSAFE_REJECTED" ? "Keep rejected; never add execution path" : row.disposition === "REFERENCE_ONLY_OUT_OF_SCOPE" ? "Keep reference-only and document scope" : "Retain shared safe translation and add oracle coverage"
}));
const counts = Object.fromEntries([...new Set(rows.map((r) => r.category))].map((k) => [k, rows.filter((r) => r.category === k).length]));
const summary = { sourceKeywordCount: matrix.keywordCount, gapRowCount: rows.length, categories: counts, priorities: Object.fromEntries([...new Set(rows.map((r) => r.priority))].map((k) => [k, rows.filter((r) => r.priority === k).length])), cealign: rows.find((r) => r.keyword === "cealign"), oracleExecutable: "BLOCKED" };
await writeFile(join(root, "verification/autonomous-pymol/PYMOL_IMPLEMENTATION_GAPS.json"), `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), source: matrix.source, methodology: "Every source keyword is retained exactly once and classified against the runtime compatibility boundary. ORACLE_PENDING is an evidence gap, not a claim of parity.", summary, rows }, null, 2)}\n`);

const grouped = [...new Set(rows.map((r) => r.family))].sort().map((family) => {
  const familyRows = rows.filter((r) => r.family === family);
  const line = familyRows.map((r) => `| ${r.keyword} | ${r.category} | ${r.implementationLevel} | ${r.capabilityState} | ${r.priority} |`).join("\n");
  return `### ${family}\n\n| Keyword | Category | Implementation | Capability | Priority |\n|---|---|---|---|---|\n${line}`;
}).join("\n\n");
const md = `# PyMOL implementation gaps\n\nThis is the complete ${summary.sourceKeywordCount}-keyword inventory from [${matrix.source.repository}@${matrix.source.commit}](${matrix.source.repository}). It distinguishes supported safe translations, registered-but-unimplemented commands, intentionally rejected unsafe commands, and reference-only names.\n\n## Disposition counts\n\n${Object.entries(counts).map(([k, v]) => `- **${k}**: ${v}`).join("\n")}\n\n## CEALIGN contradiction resolution\n\nCEALIGN is present in the pinned PyMOL keyword source and in the Molexplorer registry, but the runtime probe returned UNSUPPORTED_CAPABILITY and the analysis handler is unavailable. The matrix therefore records SAFE_BUT_NOT_IMPLEMENTED, REGISTERED_ONLY, UNAVAILABLE, and ORACLE_PENDING; it is not labeled SAFE_TRANSLATABLE. This is the authoritative corrected status for this campaign.\n\n## Functional inventory\n\n${grouped}\n\nThe machine-readable row ledger is PYMOL_IMPLEMENTATION_GAPS.json.\n`;
await writeFile(join(root, "verification/autonomous-pymol/PYMOL_IMPLEMENTATION_GAPS.md"), md);

const plan = `# Remaining PyMOL implementation plan\n\nThe plan is bounded by Molexplorer's safe command contract and by the absence of an installed PyMOL executable in this environment. Each item requires source-pinned behavior, a deterministic fixture, application/REST/console convergence, and a direct oracle comparison before promotion.\n\n## P0 — correctness blockers\n\nNo P0 blocker remains in the current claimed surface after the CEALIGN metadata correction. Keep the fail-closed parser, structured diagnostics, and the corrected unavailable capability state under regression.\n\n## P1 — core structural-analysis closure\n\n- **CEALIGN**: implement only with an explicit algorithm contract, residue correspondence rules, gap/transform semantics, and direct PyMOL oracle vectors; keep unavailable until then.\n- **SUPER/ALIGN/FIT/RMS family**: expand correspondence, outlier rejection, transform matrix, and multi-state behavior tests against pinned source and executable oracle.\n- **Selection and representation translations**: continue adding edge fixtures for alternate locations, insertion codes, nucleic acids, solvent, ions, and ligand boundaries.\n\n## P2 — advanced scientific/query coverage\n\n- Close the 228 ORACLE_PENDING source keywords by functional family, starting with analysis and measurement commands that have deterministic outputs.\n- Add exact parser diagnostics for zero-result versus invalid syntax, and preserve membership hashes for every promoted query.\n- Promote color/property/secondary-structure aliases only with documented equivalence and typed-property fixtures.\n\n## P3 — lifecycle, PSE/PZE, movie and imaging references\n\n- Keep PSE/PZE/session/movie/imaging names reference-only or coming-soon until a bounded format contract, size limits, and security review exist.\n- Add export/import round-trip vectors and visual evidence before claiming lifecycle compatibility.\n\n## Never execute\n\nPython/code execution, shell/system, filesystem/network escape hatches, docking, and HTS remain rejected or design-only. No implementation plan may add an execution path for these namespaces.\n\n## Completion gates\n\nA row may move to supported only when its handler is registered, safety-preflighted, covered by unit and focused E2E tests, converges across GUI/REST/SDK, and has exact or explicitly documented equivalent PyMOL oracle evidence.\n`;
await writeFile(join(root, "verification/autonomous-pymol/PYMOL_REMAINING_IMPLEMENTATION_PLAN.md"), plan);
console.log(JSON.stringify(summary, null, 2));
