import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Reads the local-mode token the API writes at start-up (<repo>/.mole/token, or MOLE_TOKEN_DIR).
export function apiHeaders(): Record<string, string> {
  const dir = process.env.MOLE_TOKEN_DIR || resolve(process.cwd(), ".mole");
  return { "x-mole-token": readFileSync(join(dir, "token"), "utf8").trim() };
}
