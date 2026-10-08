#!/usr/bin/env node
// Deterministic wave integration, run by the main session (costs no agent tokens).
//   node scripts/sprint/integrate.mjs W3 main sprint/W3/1.7 sprint/W3/2.8 ... [--smoke]
// Creates sprint/<wave>/integration in a dedicated worktree next to the repo, merges the branches in
// the given order, runs the quick checks after every merge, and undoes and defers any branch that
// conflicts or breaks the checks. Prints a compact JSON summary.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const smoke = argv.includes("--smoke");
const [wave, base, ...branches] = argv.filter((a) => a !== "--smoke");
if (!wave || !base) { console.error("usage: integrate.mjs <wave> <base> <branch...> [--smoke]"); process.exit(2); }
const INTEG = `sprint/${wave}/integration`;
const dir = resolve("..", `mw-integration-${wave}`);
const sh = (cmd, args, cwd = dir) => spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
const git = (...a) => sh("git", a);
const lines = (r) => `${r.stdout || ""}${r.stderr || ""}`.split(/\r?\n/);
const fail = (error) => { console.log(JSON.stringify({ ok: false, wave, error })); process.exit(1); };

if (existsSync(dir)) sh("git", ["worktree", "remove", "--force", dir], process.cwd());
const add = sh("git", ["worktree", "add", "-B", INTEG, dir, base], process.cwd());
if (add.status !== 0) fail(lines(add).join(" ").trim().slice(0, 400));
const ci = sh("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"]);
if (ci.status !== 0) fail("npm ci failed: " + lines(ci).filter((l) => /npm error (code|Missing|`npm ci`)/.test(l)).slice(0, 4).join(" | ").slice(0, 500));

const merged = [], deferred = [];
for (const b of branches) {
  const m = git("merge", "--no-ff", "--no-edit", b);
  if (m.status !== 0) { git("merge", "--abort"); deferred.push({ branch: b, reason: "merge conflict" }); continue; }
  // A branch that adds dependencies needs a fresh install before its checks can load them.
  if (git("diff", "--quiet", "HEAD~1", "HEAD", "--", "package-lock.json").status !== 0) {
    const reinstall = sh("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"]);
    if (reinstall.status !== 0) { git("reset", "--hard", "HEAD~1"); sh("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"]); deferred.push({ branch: b, reason: "npm ci failed after merge" }); continue; }
  }
  const c = sh("node", ["scripts/sprint/check.mjs", "--quick"]);
  if (c.status !== 0) {
    git("reset", "--hard", "HEAD~1"); // only ever on the integration branch inside its own worktree
    deferred.push({ branch: b, reason: "checks failed after merge", tail: lines(c).filter((l) => l.trim()).slice(-10).join("\n") });
    continue;
  }
  merged.push(b);
}
const full = sh("node", ["scripts/sprint/check.mjs", ...(smoke ? ["--smoke"] : [])]);
const head = git("rev-parse", "--short", "HEAD").stdout.trim();
console.log(JSON.stringify({ ok: full.status === 0, wave, branch: INTEG, head, worktree: dir, merged, deferred, finalChecks: lines(full).filter((l) => /^(PASS|FAIL|RESULT)/.test(l)) }, null, 1));
process.exit(full.status === 0 ? 0 : 1);
