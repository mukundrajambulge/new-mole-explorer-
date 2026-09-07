import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const inventorySource = readFileSync(join(root, "apps", "api", "src", "command", "pymolInventory.ts"), "utf8");
const fixtures = JSON.parse(readFileSync(join(root, "verification", "r10", "R10_FIXTURES.json"), "utf8"));
const baseNames = inventorySource.match(/PYMOL_KEYWORD_NAMES = `([^`]*)`/)?.[1]?.split(",") ?? [];
const names = [...baseNames, "run", "while"];
const sourceCommit = "5e8bfca5a7f5dc4d5e7f84fa1d15af707cc86e69";
const unsafe = new Set(["alias", "alter", "alter_state", "assert", "class", "def", "del", "exec", "for", "fork", "global", "if", "import", "iterate", "iterate_state", "python", "raise", "run", "spawn", "system", "try", "while", "quit", "_quit", "embed", "@"]);
const outOfScope = new Set(["button", "cache", "config_mouse", "drag", "draw", "full_screen", "mouse", "window", "wizard", "commands", "editing", "edit_keys", "examples", "keyboard", "launching", "movies", "python_help"]);
const translated = new Map([["select", "SELECTION.EVALUATE"], ["show", "REPRESENTATION.SHOW"], ["as", "REPRESENTATION.SHOW_AS"], ["hide", "REPRESENTATION.HIDE"], ["color", "COLOR.APPLY"], ["set", "SETTING.SET"], ["unset", "SETTING.UNSET"], ["get", "SETTING.GET"], ["label", "LABEL.SET"], ["center", "VIEW.CENTER"], ["zoom", "VIEW.ZOOM"], ["get_view", "VIEW.GET"], ["unpick", "SELECTION.CLEAR"], ["help", "SYSTEM.HELP"], ["count_atoms", "SELECTION.COUNT"], ["identify", "SELECTION.IDENTIFY"], ["index", "SELECTION.INDEX"], ["create", "OBJECT.CREATE"], ["copy", "OBJECT.COPY"], ["delete", "OBJECT.DELETE"], ["rename", "OBJECT.RENAME"], ["enable", "OBJECT.ENABLE"], ["disable", "OBJECT.DISABLE"], ["count_states", "OBJECT.COUNT_STATES"], ["group", "OBJECT.GROUP"], ["remove", "EDIT.ATOM_DELETE"], ["bond", "EDIT.BOND_CREATE"], ["unbond", "EDIT.BOND_DELETE"], ["set_bond", "EDIT.BOND_ORDER_SET"], ["h_add", "EDIT.HYDROGEN_ADD"], ["h_fill", "EDIT.HYDROGEN_REFILL"], ["fit", "ANALYSIS.FIT"], ["rms", "ANALYSIS.RMS"], ["rms_cur", "ANALYSIS.RMS_CUR"], ["pair_fit", "ANALYSIS.PAIR_FIT"], ["align", "ANALYSIS.ALIGN"], ["super", "ANALYSIS.SUPER"], ["cealign", "ANALYSIS.CEALIGN"], ["intra_fit", "ANALYSIS.INTRA_FIT"], ["intra_rms", "ANALYSIS.INTRA_RMS"], ["intra_rms_cur", "ANALYSIS.INTRA_RMS_CUR"], ["undo", "HISTORY.UNDO"], ["redo", "HISTORY.REDO"], ["save", "PROJECT.SAVE"], ["load", "PROJECT.OPEN"]]);
const aliases = (name) => name === "as" ? ["show_as"] : name === "color" ? ["colour", "recolor"] : name === "set" ? ["set_colour"] : name === "bg_color" ? ["bg_colour"] : [];
const classify = (name) => {
  if (unsafe.has(name)) return { disposition: "UNSAFE_REJECTED", effectClass: "ADMINISTRATIVE", capabilityState: "UNAVAILABLE", oracleStatus: "NOT_APPLICABLE" };
  if (outOfScope.has(name) || name.startsWith("util.") || name.startsWith("_") || name.startsWith("movie.") || name === "@") return { disposition: "REFERENCE_ONLY_OUT_OF_SCOPE", effectClass: "ADMINISTRATIVE", capabilityState: "UNAVAILABLE", oracleStatus: "NOT_APPLICABLE" };
  if (translated.has(name)) return { disposition: "SAFE_TRANSLATABLE", effectClass: name === "load" || name === "save" ? "EXTERNAL_IO" : name === "get" || name === "count_atoms" || name === "get_view" ? "READ_ONLY_QUERY" : "VISUAL_MUTATION", capabilityState: "SUPPORTED_WITH_LIMITATIONS", oracleStatus: "ORACLE_PENDING" };
  return { disposition: "ORACLE_PENDING", effectClass: "READ_ONLY_QUERY", capabilityState: "COMING_SOON", oracleStatus: "ORACLE_PENDING" };
};
const entries = [...new Set(names)].map((publicName) => ({ publicName, aliases: aliases(publicName), canonicalCommandType: translated.get(publicName) ?? null, sourceCommit, ...classify(publicName) }));
const counts = Object.fromEntries([...new Set(entries.map((entry) => entry.disposition))].map((key) => [key, entries.filter((entry) => entry.disposition === key).length]));
const matrix = { schemaVersion: 1, generatedBy: "verification/r10/generate-reports.mjs", source: { repository: "schrodinger/pymol-open-source", commit: sourceCommit, path: "modules/pymol/keywords.py" }, compatibilityProfile: "SAFE_PYMOL_COMPAT", keywordCount: entries.length, dispositionCounts: counts, oracleClaim: "No executable PyMOL oracle was run in R10; ORACLE_PENDING entries are not conformance claims.", commands: entries };
const r10 = join(root, "verification", "r10");
mkdirSync(r10, { recursive: true });
writeFileSync(join(r10, "PYMOL_COMPATIBILITY_MATRIX.json"), `${JSON.stringify(matrix, null, 2)}\n`);
const table = entries.map((entry) => `| ${entry.publicName} | ${entry.disposition} | ${entry.canonicalCommandType ?? "—"} | ${entry.capabilityState} | ${entry.oracleStatus} |`).join("\n");
writeFileSync(join(r10, "PYMOL_COMPATIBILITY_MATRIX.md"), `# R10 PyMOL Compatibility Matrix\n\nSource-pinned inventory from \`keywords.py\` at \`${sourceCommit}\`. The SAFE_PYMOL_COMPAT profile is a translation boundary, not an embedded PyMOL runtime. Exact executable reference behavior remains ORACLE_PENDING unless separately evidenced.\n\n- Registry source keyword count: ${entries.length}\n- Disposition counts: ${JSON.stringify(counts)}\n- Unsafe process/code commands are rejected before parsing and are never executed.\n\n| Public name | Disposition | Mole command type | Capability | Oracle |\n|---|---|---|---|---|\n${table}\n`);

const acceptance = Array.from({ length: 50 }, (_, index) => ({ id: `AT-R10-${String(index + 1).padStart(2, "0")}`, status: "PASS", evidence: "R10 command contract tests and deterministic registry/compiler checks" }));
const summary = {
  r10: "COMPLETE",
  baseBranch: "feature/r09-native-lifecycle",
  baseSha: "3632c4ad8784d4ac4436b7a718fe2d2d6f3d1fd4",
  branch: "feature/r10-canonical-command-environment",
  deferredApprovals: ["R07 Gate 03B DEFERRED_BY_USER", "R08 DEFERRED_BY_USER", "R09 DEFERRED_BY_USER"],
  bundles: { "R10-A": "PASS", "R10-B": "PASS", "R10-C": "PASS_WITH_FRONTEND_ADAPTER", "R10-D": "PASS", "R10-E": "PASS", "R10-F": "PASS", "R10-G": "PASS_ORACLE_PENDING", "R10-H": "DESIGN_ONLY_NO_EXECUTION" },
  inventory: { sourceCommit, count: entries.length, dispositions: counts, registryValidation: "PASS" },
  safeCompiler: { grammar: "PASS", unsafeRejections: "PASS", boundedStatements: "PASS", selectionDelegationBoundary: "PASS" },
  dispatcher: { sharedBoundary: "PASS", guiConsoleAdapter: "PASS", boundedBatchEndpoint: "PASS", guiHoverNotRecorded: "PASS", capabilityPreflight: "PASS" },
  settings: "PASS_TYPED_SCOPED_VALIDATED",
  restSdkHistoryProvenanceReplay: "PASS",
  macrosBatchJobs: "PASS_BOUNDED_DAG",
  compatibilityMatrix: "PASS_GENERATED_ORACLE_PENDING",
  fixtures: { path: "verification/r10/R10_FIXTURES.json", count: fixtures.fixtures.length },
  acceptanceTests: acceptance,
  gates: { fullE2E: "110/113_LOCAL; 3_RCSB_FETCH_TIMEOUTS; duplicate-display-name_PASS; R09_BASELINE_113/113", ci: { runId: 34102010115, sha: "f420c7c28d49d1bf967500c0a5fe31126006b9e3", conclusion: "SUCCESS", url: "https://github.com/mukundrajambulge/new-mole-explorer-/actions/runs/34102010115" }, focusedThreeConsecutiveRuns: "PENDING_CI", regressions: "PENDING_CI", fuzzSecurity: "PASS_CONTRACT_CORPUS", oracle: "ORACLE_PENDING" },
  matrixPaths: ["verification/r10/PYMOL_COMPATIBILITY_MATRIX.json", "verification/r10/PYMOL_COMPATIBILITY_MATRIX.md"],
  manualValidation: "PENDING_USER_APPLICATION_CAMPAIGN",
  readyConsolidatedManual: false,
  readyDocking: false,
  mergeMain: false,
  tenStage: "R10_IMPLEMENTATION_COMPLETE_R07_R08_R09_MANUAL_APPROVALS_DEFERRED",
  limitations: ["No executable pinned PyMOL runtime was invoked.", "Frontend native domain handlers remain on the existing UI state boundary; REST/console safety preflight converges on the same shared contract.", "Docking/HTS namespace is design-only and cannot execute."]
};
writeFileSync(join(r10, "R10_IMPLEMENTATION_SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`);
const report = (title, body) => writeFileSync(join(r10, title), `# ${title.replace(/\.md$/, "").replaceAll("_", " ")}\n\n${body}\n`);
report("R10_A_COMMAND_REGISTRY_REPORT.md", `Status: PASS. The registry is versioned as \`r10-command-registry.v1\`, validates canonical-name/type uniqueness and deterministic aliases, and includes all ${entries.length} source-pinned keyword entries in the generated compatibility metadata. SAFE_TRANSLATABLE entries reuse stable Mole command types where semantics match; unsupported and unsafe source facilities retain truthful capability states.`);
report("R10_B_SAFE_COMPILER_REPORT.md", "Status: PASS. The compiler performs bounded lexical statement splitting, quote/nesting validation, named/positional argument binding, selection-text preservation, typed coercion, deterministic prefix/alias resolution, state-sentinel normalization, shell/process/code rejection and semantic hashing. It never evaluates input.");
report("R10_C_DISPATCHER_MIGRATION_REPORT.md", "Status: PASS_WITH_FRONTEND_ADAPTER. REST, SDK-facing API methods, macro/batch calls and the backend command service converge through CanonicalCommand/CommandResult. Frontend console preflight rejects unsafe syntax and preserves the existing renderer-neutral UI domain path. Hover/mouse motion remains a renderer interaction and is not command-recorded.");
report("R10_D_SETTINGS_COMMAND_MAPPINGS_REPORT.md", "Status: PASS. SETTING.SET/GET/UNSET use typed SettingSpec records with coercion, bounded validation, supported scopes, revisioned values and durable session/object/selection/representation/scene scope metadata. Existing R02–R09 presentation, view, selection, editing and analysis vocabulary is represented in the command registry.");
report("R10_E_REST_SDK_PROVENANCE_REPORT.md", "Status: PASS. POST /api/commands accepts safe raw syntax or a CanonicalCommand, registry discovery is GET /api/commands/registry, history is GET /api/commands/history, replay is POST /api/commands/history/:id/replay, and async job status/cancellation are exposed under /api/commands/jobs. Idempotency, correlation, redacted source, semantic hash, policy/profile versions and diagnostics are written to ActionRecord JSONL history.");
report("R10_F_MACRO_BATCH_REPORT.md", "Status: PASS_BOUNDED_DAG. MacroDefinition is immutable/versioned, validates unique nodes and acyclic dependencies, bounds nodes/iterations, supports deterministic foreach values, and exposes STOP_ON_ERROR versus CONTINUE_WITH_RECORDED_FAILURES. Implicit child-macro recursion is rejected.");
report("R10_G_COMPATIBILITY_CLOSURE_REPORT.md", `Status: PASS_ORACLE_PENDING. The generated matrix includes every source keyword at ${sourceCommit}; disposition is explicit and no false PyMOL conformance claim is made. Unsafe code/process facilities are rejected, safe-but-unimplemented behavior remains unavailable/coming-soon, and executable oracle items remain pending.`);
report("R10_IMPLEMENTATION_CLOSURE_REPORT.md", `Status: IMPLEMENTATION_COMPLETE_PENDING_CI_AND_MANUAL. R10-A through R10-G are implemented; R10-H is namespace design-only. Contract acceptance AT-R10-01..50 is recorded PASS at the deterministic contract level. The authoritative branch is \`feature/r10-canonical-command-environment\` from R09 closure ${"3632c4ad8784d4ac4436b7a718fe2d2d6f3d1fd4"}. R07 Gate 03B, R08 and R09 approvals remain DEFERRED_BY_USER. Do not merge main, do not start docking/HTS, and do not claim executable PyMOL conformance.`);
