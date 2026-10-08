// PreToolUse hook for Bash: block commands that dump large output into agent context.
// Exit 2 blocks the command; stderr tells the agent the compact alternative.
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let cmd = "";
  try { cmd = String(JSON.parse(raw)?.tool_input?.command || ""); } catch { process.exit(0); }
  const c = cmd.trim();
  const piped = /\|\s*(tail|head|grep|wc)\b/.test(c) || />\s*\S+/.test(c);
  const rules = [
    [/^(npm (run )?(test|typecheck|lint|build)\b|npx (vitest|tsc|eslint)\b)/, "use `node scripts/sprint/check.mjs` (add --quick, --native, --python, --smoke as needed); it prints a compact summary and saves full logs"],
    [/^npx playwright test\b(?!.*--reporter=(line|dot))/, "add --reporter=line, or use `node scripts/sprint/check.mjs --smoke`"],
    [/^git log\b(?!.*(-n\s*\d+|-\d+|--oneline))/, "use `git log --oneline -n 20`"],
    [/^git diff\b(?!.*(--stat|--name-only|--name-status| -- ))/, "start with `git diff --stat <range>`, then diff specific paths with `git diff <range> -- <path>`"],
    [/^(cat|type)\s+\S*(verification|node_modules|package-lock|\.log)/, "do not print large files; grep for the lines you need"],
    [/^(find|ls -R|tree)\b(?!.*(-maxdepth|-L ))/, "limit depth (find -maxdepth 3) or use the Glob tool"],
  ];
  for (const [re, alt] of rules) {
    if (re.test(c) && !piped) { console.error(`Blocked (token guard): ${alt}.`); process.exit(2); }
  }
  process.exit(0);
});
