/** Frontend preflight mirrors the backend policy so unsafe text is visibly
 * rejected before it can reach selection or presentation handlers. It never
 * evaluates input and intentionally leaves `> 0`, `&`, and `|` available to
 * the canonical selection grammar. */
export const unsafeConsoleDiagnostic = (input: string): string | null => {
  const raw = input.trim();
  if (raw.length > 16_384) return "RESOURCE_LIMIT_EXCEEDED: command text exceeds the safe 16,384-character limit.";
  if ([...raw].some((char) => [0, 8, 11, 12].includes(char.charCodeAt(0))) || /`|\$\(|\$\{|&&|\|\||>>|<<|\s[<>]\s*(?:[A-Za-z_]|[A-Za-z]:|[\\/])/.test(raw)) return "UNSAFE_COMMAND_REJECTED: shell/process interpolation and redirection are not supported.";
  const head = raw.match(/^([^\s;,()]+)/)?.[1]?.toLowerCase() ?? "";
  if (["python", "exec", "eval", "run", "spawn", "fork", "system", "shell", "powershell", "cmd", "bash", "sh", "javascript", "js", "import"].includes(head)) return `UNSAFE_COMMAND_REJECTED: ${head} is outside SAFE_PYMOL_COMPAT.`;
  if (/(^|[\s;])(python|javascript|js|import|exec|eval|spawn|fork|system|powershell|cmd\.exe|bash|sh)(?:\s|\(|$)/i.test(raw)) return "UNSAFE_COMMAND_REJECTED: general code/process execution is rejected.";
  return null;
};
