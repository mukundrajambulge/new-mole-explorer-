import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("./SELECTION_OPERATOR_MATRIX.md", import.meta.url), "utf8");

const splitRow = (line) => {
  const cells = [];
  let cell = "";
  let inCode = false;
  let escaped = false;
  for (const character of line.trim().slice(1, -1)) {
    if (character === "`" && !escaped) inCode = !inCode;
    if (character === "|" && !inCode && !escaped) {
      cells.push(cell.trim());
      cell = "";
    } else cell += character;
    escaped = character === "\\" && !escaped;
    if (character !== "\\") escaped = false;
  }
  cells.push(cell.trim());
  return cells;
};

const rows = source.split(/\r?\n/).filter((line) => line.startsWith("| `") && !line.includes("---"));
const entries = rows.map((line) => {
  const cells = splitRow(line);
  return { operator: cells[0], implementationStatus: cells[8], liveBrowserStatus: cells[9], oracleStatus: cells[10], decision: cells[11] };
});
const countBy = (key) => entries.reduce((counts, entry) => {
  const value = entry[key];
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {});
const summary = {
  schemaVersion: 1,
  source: "verification/selection/SELECTION_OPERATOR_MATRIX.md",
  rowCount: entries.length,
  implementationStatusCounts: countBy("implementationStatus"),
  liveBrowserStatusCounts: countBy("liveBrowserStatus"),
  oracleStatusCounts: countBy("oracleStatus"),
  entries,
};
const output = `${JSON.stringify(summary, null, 2)}\n`;
if (process.argv.includes("--write")) writeFileSync(new URL("./selection-operator-matrix.json", import.meta.url), output);
process.stdout.write(output);
