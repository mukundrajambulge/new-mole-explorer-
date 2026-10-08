// PreToolUse hook for Read: keep agent context small.
// Blocks (exit 2) reading evidence, generated or binary-heavy folders, and any file over the size limit
// unless offset/limit is given. The message tells the agent what to do instead.
import { statSync } from "node:fs";

const LIMIT_BYTES = Number(process.env.MOLE_READ_LIMIT || 120 * 1024);
const NEVER = [
  [/\/verification\//, "accepted evidence; read the short summaries in docs/ instead"],
  [/\/node_modules\//, "dependency code; read the package docs or types only if essential"],
  [/\/(outputs|test-results|playwright-report|build|dist)\//, "generated output; grep the specific log line instead"],
  [/package-lock\.json$/, "lockfile; use `npm ls <pkg>`"],
  [/\.(png|jpe?g|gif|zip|bundle|bin|cif\.gz)$/i, "binary file"],
];

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const ti = input.tool_input || {};
  const p = String(ti.file_path || "").replace(/\\/g, "/");
  for (const [re, why] of NEVER) {
    if (re.test(p)) { console.error(`Blocked read of ${p}: ${why}. (token guard)`); process.exit(2); }
  }
  let size = 0;
  try { size = statSync(ti.file_path).size; } catch { process.exit(0); }
  if (size > LIMIT_BYTES && !ti.limit) {
    console.error(`Blocked: ${p} is ${Math.round(size / 1024)} KB. Use Grep to find the lines you need, then Read with offset and limit (at most about 300 lines at a time). (token guard)`);
    process.exit(2);
  }
  process.exit(0);
});
