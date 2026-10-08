#!/usr/bin/env node
// Sprint control CLI: deterministic planning and bookkeeping, so agents spend tokens only on engineering.
//   node scripts/sprint/sprint.mjs plan   --window-used 34 [--target 70] [--reserve 10] [--max-tasks 10] [--wave W4] [--base main]
//   node scripts/sprint/sprint.mjs mark   <id...> --status DONE|READY|NEEDS_OWNER|BLOCKED|TODO|DEFERRED_BUDGET [--branch b] [--note "..."]
//   node scripts/sprint/sprint.mjs ledger --wave W1 --spent 812000 --est 900000 --window-before 12 --window-after 47
//   node scripts/sprint/sprint.mjs state                 (rewrites docs/sprint/STATE.md, at most ~60 lines)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BACKLOG = "docs/sprint/backlog.json";
const LEDGER = "docs/sprint/token-ledger.json";
const NEXT = "docs/sprint/next-wave.json";
const STATE = "docs/sprint/STATE.md";

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name, dflt) => { const i = rest.indexOf("--" + name); return i >= 0 ? rest[i + 1] : dflt; };
const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));
const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : d);
const save = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2) + "\n");
const backlog = load(BACKLOG);
const ledger = load(LEDGER, { waves: [], calibration: { tokensPerWindowPct: null, estMultiplier: 1 } });
const T = backlog.tasks;
const byId = Object.fromEntries(T.map((t) => [t.id, t]));
const num = (id) => id.split(/[.a-z]/).filter(Boolean).map(Number);
const cmpId = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1); } return a.localeCompare(b); };

// Planning estimates in OUTPUT tokens; corrected by the measured multiplier after each wave.
const IMPL = { S: 12000, M: 35000, L: 80000 };
const REVIEW = { general: 6000, risk: 12000 };
export function estimate(t) {
  const impl = IMPL[t.size] ?? 35000;
  const reviews = t.lenses.reduce((s, l) => s + REVIEW[l], 0);
  const fixProb = t.risk === "high" ? 0.5 : 0.35;
  return Math.round(impl + reviews + fixProb * (impl * 0.5 + reviews));
}

if (cmd === "plan") {
  const used = Number(opt("window-used", NaN));
  if (Number.isNaN(used)) { console.error("--window-used <percent> is required (read it with get_usage first)"); process.exit(2); }
  const target = Number(opt("target", 70)), reserve = Number(opt("reserve", 10));
  const cal = ledger.calibration;
  const calibrating = !cal.tokensPerWindowPct;
  const maxTasks = Number(opt("max-tasks", calibrating ? 5 : 10));
  const capPct = Math.max(0, target - reserve - used);
  const cap = calibrating ? 250000 : Math.floor(capPct * cal.tokensPerWindowPct);
  if (cap <= 0) { console.log(JSON.stringify({ launch: false, reason: `window at ${used}%; target ${target}% minus reserve ${reserve}% leaves no room. Wait for the reset.` })); process.exit(0); }
  const done = new Set(T.filter((t) => t.status === "DONE").map((t) => t.id));
  const tierRank = { core: 0, strong: 1, stretch: 2 };
  const waveRank = (w) => (w && w.startsWith("W") ? Number(w.slice(1)) : 99);
  const pool = T.filter((t) => t.agentType && ["TODO", "DEFERRED_BUDGET"].includes(t.status) && t.tier !== "deferred")
    .filter((t) => !calibrating || (t.risk !== "high" && t.size !== "L"))
    .sort((a, b) => (b.critical - a.critical) || (tierRank[a.tier] - tierRank[b.tier]) || (waveRank(a.wave) - waveRank(b.wave)) || cmpId(a.id, b.id));
  const picked = [], perLane = {};
  let total = 0;
  for (const t of pool) {
    if (picked.length >= maxTasks) break;
    const depsOk = t.deps.every((d) => done.has(d) || picked.some((p) => p.id === d && p.lane === t.lane));
    if (!depsOk || (perLane[t.lane] || 0) >= 3) continue;
    const est = Math.round(estimate(t) * cal.estMultiplier);
    if (total + est > cap) continue;
    picked.push({ ...t, estOut: est }); total += est; perLane[t.lane] = (perLane[t.lane] || 0) + 1;
  }
  const wave = opt("wave", `W${ledger.waves.length + 1}`);
  const out = { wave, base: opt("base", backlog.base), capOutputTokens: cap, estimatedOutputTokens: total, calibrating, tasks: picked };
  save(NEXT, out);
  console.log(JSON.stringify({ launch: picked.length > 0, wave, calibrating, windowUsed: used, capOutputTokens: cap, estimatedOutputTokens: total, tasks: picked.map((t) => `${t.id}(${t.lane},${t.size}/${t.risk},~${Math.round(t.estOut / 1000)}k)`), file: NEXT }));
} else if (cmd === "mark") {
  const status = opt("status"); if (!status) { console.error("--status required"); process.exit(2); }
  for (const id of positional) {
    const t = byId[id]; if (!t) { console.error("unknown task " + id); process.exitCode = 1; continue; }
    t.status = status; if (opt("branch")) t.branch = opt("branch"); if (opt("note")) t.note = opt("note");
  }
  save(BACKLOG, backlog); console.log(`marked ${positional.join(", ")} -> ${status}`);
} else if (cmd === "ledger") {
  const e = { wave: opt("wave"), spent: Number(opt("spent")), est: Number(opt("est")), windowBefore: Number(opt("window-before")), windowAfter: Number(opt("window-after")) };
  if (Object.values(e).some((v) => v === undefined || Number.isNaN(v))) { console.error("all of --wave --spent --est --window-before --window-after are required"); process.exit(2); }
  ledger.waves.push(e);
  const recent = ledger.waves.slice(-3);
  const deltas = recent.filter((w) => w.windowAfter > w.windowBefore);
  if (deltas.length) ledger.calibration.tokensPerWindowPct = Math.round(deltas.reduce((s, w) => s + w.spent / (w.windowAfter - w.windowBefore), 0) / deltas.length);
  ledger.calibration.estMultiplier = Number((recent.reduce((s, w) => s + w.spent / w.est, 0) / recent.length).toFixed(2));
  save(LEDGER, ledger); console.log(JSON.stringify(ledger.calibration));
} else if (cmd === "state") {
  const count = (f) => T.filter(f).length;
  const statuses = [...new Set(T.map((t) => t.status))].map((s) => `${s}: ${count((t) => t.status === s)}`).join(" · ");
  const tiers = ["core", "strong", "stretch"].map((tier) => `${tier} ${count((t) => t.tier === tier && t.status === "DONE")}/${count((t) => t.tier === tier)}`).join(" · ");
  const attention = T.filter((t) => ["NEEDS_OWNER", "BLOCKED"].includes(t.status));
  const doneIds = new Set(T.filter((t) => t.status === "DONE").map((t) => t.id));
  const next = T.filter((t) => t.agentType && t.status === "TODO" && t.deps.every((d) => doneIds.has(d))).sort((a, b) => (b.critical - a.critical) || cmpId(a.id, b.id)).slice(0, 12);
  const lines = [
    "# Sprint state (generated: do not edit; run `node scripts/sprint/sprint.mjs state`)", "",
    `Status: ${statuses}`, `Done by tier: ${tiers}`,
    `Calibration: ${ledger.calibration.tokensPerWindowPct ? ledger.calibration.tokensPerWindowPct + " output tokens per 1% of the 5-hour window" : "not yet (next wave is a calibration wave)"}; estimate multiplier ${ledger.calibration.estMultiplier}`,
    `Last waves: ${ledger.waves.slice(-3).map((w) => `${w.wave} ${Math.round(w.spent / 1000)}k (${w.windowBefore}%→${w.windowAfter}%)`).join(", ") || "none"}`, "",
    "## Needs the owner", ...(attention.length ? attention.map((t) => `- ${t.id} ${t.title}: ${t.status}${t.note ? " (" + t.note + ")" : ""}`) : ["- nothing"]), "",
    "## Next ready tasks (critical path first)", ...next.map((t) => `- ${t.critical ? "★ " : ""}${t.id} [${t.lane} ${t.size}/${t.risk}] ${t.title}`),
  ];
  writeFileSync(STATE, lines.join("\n") + "\n"); console.log(`wrote ${STATE} (${lines.length} lines)`);
} else {
  console.error("commands: plan | mark | ledger | state"); process.exit(2);
}
