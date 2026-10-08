// PreToolUse hook for Bash: keep git commands that move HEAD out of the main checkout.
// Agents work in worktrees, but their shell can fall back to the project root; a bare
// `git switch` there silently moves the owner's main folder to another branch (happened twice in W4).
// Exit 2 blocks the command; stderr tells the caller what to do instead.
import { resolve } from "node:path";

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const cmd = String(input?.tool_input?.command || "");
  if (!/\bgit\b/.test(cmd)) process.exit(0);

  const norm = (p) => resolve(String(p).replace(/^\/([a-zA-Z])\//, "$1:/")).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const root = norm(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  const isAgent = Boolean(input.agent_id || input.agent_type);
  // Git-Bash absolute paths (/c/...) and drive paths must not be resolved against the current dir first.
  const join = (base, p) => norm(/^(\/[a-zA-Z]\/|[a-zA-Z]:[\\/])/.test(p) ? p : resolve(base, p));

  // Walk the command segment by segment, tracking `cd` so `cd <worktree> && git switch x` is allowed.
  let dir = norm(input.cwd || process.cwd());
  for (const seg of cmd.split(/&&|\|\||;|\n/)) {
    const s = seg.trim();
    const cd = s.match(/^cd\s+("([^"]+)"|'([^']+)'|(\S+))/);
    if (cd) { dir = join(dir, cd[2] || cd[3] || cd[4]); continue; }
    const git = s.match(/^git\s+(?:-c\s+\S+\s+)*(?:-C\s+("([^"]+)"|(\S+))\s+)?(?:-c\s+\S+\s+)*(\S+)(.*)$/);
    if (!git) continue;
    const target = git[2] || git[3] ? join(dir, git[2] || git[3]) : dir;
    if (target !== root) continue; // worktrees live under .claude/worktrees/, so they never equal root
    const sub = git[4];
    const rest = git[5].split(/\s(?:\||\d?>)/)[0].trim(); // ignore `2>&1 | tail` and similar
    const movesHead = /^(switch|checkout|rebase|reset|stash|cherry-pick|am|bisect|pull)$/.test(sub);
    const recovery = (sub === "switch" && rest === "main") || (sub === "checkout" && /^--\s/.test(rest + " "));
    if (movesHead && !recovery) {
      console.error(`Blocked (git guard): \`git ${sub}\` would change the owner's main checkout (${root}). Run it inside your own worktree: cd <your worktree> && git ${sub} ...`);
      process.exit(2);
    }
    if (isAgent && /^(commit|merge|add|rm|mv|restore|clean)$/.test(sub)) {
      console.error(`Blocked (git guard): agents must not \`git ${sub}\` in the main checkout. cd into your worktree first.`);
      process.exit(2);
    }
  }
  process.exit(0);
});
