// PreToolUse hook for Edit|Write: block writes into evidence folders and .git (exit 2 blocks).
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const p = String(input?.tool_input?.file_path ?? "").replace(/\\/g, "/");
  if (/\/verification\//.test(p) && process.env.MOLE_ALLOW_EVIDENCE !== "1") { console.error("Blocked: verification/ is accepted evidence; write to test-results/ or $EVIDENCE_DIR."); process.exit(2); }
  if (/\/\.git\//.test(p)) { console.error("Blocked: do not edit .git internals."); process.exit(2); }
  process.exit(0);
});
