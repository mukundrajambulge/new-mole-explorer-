#!/usr/bin/env node
// Thin CLI entry: `node tools/mole-dock/mole-dock.mjs run --input job.json --out <dir> [--root <dir>]`.
// Exit codes: 0 ok, 2 bad input, 3 engine error.
import { EXIT_BAD_INPUT, main } from "./run.mjs";

const [cmd, ...rest] = process.argv.slice(2);
if (cmd !== "run") {
  process.stderr.write(JSON.stringify({ error: { code: "ARGS_INVALID", message: "usage: mole-dock run --input job.json --out <dir> [--root <dir>]" } }) + "\n");
  process.exitCode = EXIT_BAD_INPUT;
} else {
  const ac = new AbortController();
  process.once("SIGINT", () => ac.abort());
  process.once("SIGTERM", () => ac.abort());
  process.exitCode = await main(rest, { signal: ac.signal });
}
