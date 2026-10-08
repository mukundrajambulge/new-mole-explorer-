#!/usr/bin/env node
// Compact verification for agents and the integrator. Prints one line per check and, on failure,
// only the last lines of output. Full logs go to test-results/sprint-logs/ so agents can grep them
// instead of flooding their context.
//   node scripts/sprint/check.mjs                 typecheck + lint + unit tests
//   node scripts/sprint/check.mjs --quick         typecheck + unit tests
//   node scripts/sprint/check.mjs --native --python --smoke   add native ctest, python tests, smoke e2e
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = new Set(process.argv.slice(2));
const TAIL = Number(process.env.CHECK_TAIL || 25);
const logDir = join("test-results", "sprint-logs");
mkdirSync(logDir, { recursive: true });

// wsl.exe runs without a Windows shell so cmd.exe cannot mangle redirections such as >/dev/null.
const wsl = (cmd) => ({ noShell: true, cmd: "wsl", args: ["-d", "Ubuntu-24.04", "--cd", process.cwd(), "--", "bash", "-lc", cmd] });
const checks = [
  { name: "typecheck", cmd: "npm", args: ["run", "--silent", "typecheck"] },
  ...(argv.has("--quick") ? [] : [{ name: "lint", cmd: "npm", args: ["run", "--silent", "lint"] }]),
  { name: "unit", cmd: "npm", args: ["test", "--silent"] },
  ...(argv.has("--native") ? [{ name: "native", ...wsl("cmake -S native/docking-reference/scoring -B test-results/native-build -G Ninja -DCMAKE_BUILD_TYPE=Release >/dev/null && cmake --build test-results/native-build >/dev/null && ctest --test-dir test-results/native-build --output-on-failure") }] : []),
  ...(argv.has("--python") ? [{ name: "python", ...wsl(". ~/mole-prep/bin/activate && pytest -q workers/prep") }] : []),
  ...(argv.has("--smoke") ? [{ name: "smoke-e2e", cmd: "npx", args: ["playwright", "test", "--project=smoke", "--reporter=line"] }] : []),
];

let failed = 0;
// Playwright reuses any server already on these ports, so a stray dev server from another tree would be
// tested instead of this one (happened in W5-W7). Refuse to run smoke until the ports are free.
if (argv.has("--smoke")) {
  const { createConnection } = await import("node:net");
  const busy = (port) => new Promise((done) => {
    const s = createConnection({ host: "127.0.0.1", port });
    s.once("connect", () => { s.destroy(); done(true); });
    s.once("error", () => done(false));
  });
  const taken = [];
  for (const port of [3101, 8100]) if (await busy(port)) taken.push(port);
  if (taken.length) {
    const i = checks.findIndex((c) => c.name === "smoke-e2e");
    checks.splice(i, 1);
    failed++;
    console.log(`FAIL smoke-e2e: port(s) ${taken.join(", ")} already in use; stop other dev servers so smoke tests this tree, not another one`);
  }
}
for (const c of checks) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(c.cmd, c.args, { encoding: "utf8", shell: !c.noShell && process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
  const secs = (Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1);
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const logFile = join(logDir, `${c.name}.log`);
  writeFileSync(logFile, out);
  if (r.status === 0) { console.log(`PASS ${c.name} (${secs}s)`); continue; }
  failed++;
  const lines = out.split(/\r?\n/).filter((l) => l.trim() && !/^\s*at .*node_modules/.test(l));
  console.log(`FAIL ${c.name} (${secs}s) full log: ${logFile}`);
  console.log(lines.slice(-TAIL).map((l) => "  " + l.slice(0, 220)).join("\n"));
}
console.log(failed ? `RESULT: ${failed} check(s) failed` : "RESULT: all checks passed");
process.exit(failed ? 1 : 0);
