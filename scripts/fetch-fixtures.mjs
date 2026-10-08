#!/usr/bin/env node
// Verifies tests/fixtures/rcsb against manifest.json and fetches untracked (large) entries such as 4V6F.
// Usage: node scripts/fetch-fixtures.mjs [--verify-only]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "tests", "fixtures", "rcsb");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const verifyOnly = process.argv.includes("--verify-only");
const MAX_BYTES = 256 * 1024 * 1024;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

let failures = 0;
mkdirSync(dir, { recursive: true });
for (const entry of manifest.files) {
  if (!/^[A-Za-z0-9._-]+$/.test(entry.name)) {
    console.error(`FAIL ${entry.name}: unsafe file name`);
    failures += 1;
    continue;
  }
  const target = join(dir, entry.name);
  if (!existsSync(target)) {
    if (entry.tracked || verifyOnly) {
      if (entry.tracked) {
        console.error(`FAIL ${entry.name}: missing`);
        failures += 1;
      } else console.log(`SKIP ${entry.name}: not fetched (untracked)`);
      continue;
    }
    const response = await fetch(entry.url);
    if (!response.ok) {
      console.error(`FAIL ${entry.name}: HTTP ${response.status}`);
      failures += 1;
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES || sha256(bytes) !== entry.sha256) {
      console.error(`FAIL ${entry.name}: downloaded content does not match the pinned sha256`);
      failures += 1;
      continue;
    }
    writeFileSync(`${target}.part`, bytes);
    renameSync(`${target}.part`, target);
    console.log(`FETCHED ${entry.name}`);
    continue;
  }
  const bytes = readFileSync(target);
  if (sha256(bytes) !== entry.sha256 || bytes.length !== entry.bytes) {
    console.error(`FAIL ${entry.name}: sha256 or size mismatch`);
    failures += 1;
  } else console.log(`OK ${entry.name}`);
}
console.log(failures === 0 ? "RESULT: manifest verifies" : `RESULT: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
