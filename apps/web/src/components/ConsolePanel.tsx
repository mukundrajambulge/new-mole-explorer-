import { FormEvent, useState } from "react";
import type { StructureLoadResult } from "@molecular/contracts";
import { Icon } from "./Icon";

type ConsoleEntry = { category: "SYSTEM" | "SELECTION" | "PRESENTATION" | "MEASURE" | "CAPABILITY"; command: string; status: string; timestamp: string };
export type ConsoleCommandResult = { category: ConsoleEntry["category"]; status: string };

const initialEntries: ConsoleEntry[] = [
  { category: "SYSTEM", command: "renderer status", status: "3Dmol.js adapter ready · no structure loaded", timestamp: "09:41:12" },
  { category: "CAPABILITY", command: "dock run", status: "Unavailable in G1C · no docking engine connected", timestamp: "09:41:15" },
];

export const ConsolePanel = ({ expanded, onToggle, structure, onCommand }: { expanded: boolean; onToggle: () => void; structure: StructureLoadResult | null; onCommand?: (command: string) => ConsoleCommandResult }) => {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState(initialEntries);
  const visibleEntries = entries.map((entry, index) => index === 0 && entry.command === "renderer status" ? {
    ...entry,
    status: structure ? `3Dmol.js adapter ready · ${structure.structure.source.originalFilename} loaded` : "3Dmol.js adapter ready · no structure loaded",
  } : entry);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const result = onCommand?.(trimmed) ?? { category: "CAPABILITY" as const, status: "Not executed · authoritative command service is not connected in G1C" };
    setEntries((current) => [...current, { category: result.category, command: trimmed, status: result.status, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }]);
    setQuery("");
  };

  return (
    <section className={`console-panel ${expanded ? "console-panel--expanded" : "console-panel--collapsed"}`} aria-label="Command and selection console">
      <div className="console-header">
        <button className="console-title" onClick={onToggle} aria-expanded={expanded}><span className="console-chevron">›_</span><strong>Command &amp; Selection Console</strong><span className="console-live" /></button>
        {expanded && <div className="console-actions"><span className="console-mode">G1C / PRESENTATION</span><button className="icon-button icon-button--quiet" onClick={onToggle} aria-label="Collapse console"><Icon name="arrowDown" size={15} /></button><button className="icon-button icon-button--quiet" onClick={() => setEntries([])} aria-label="Clear console"><Icon name="trash" size={15} /></button></div>}
        {!expanded && <button className="icon-button icon-button--quiet" onClick={onToggle} aria-label="Expand console"><Icon name="arrowUp" size={15} /></button>}
      </div>
      {expanded && <>
        <div className="console-history">
          {entries.length === 0 && <div className="console-empty">No command events yet. G1C does not execute scientific queries.</div>}
          {visibleEntries.map((entry, index) => <div className="console-entry" key={`${entry.timestamp}-${index}`}><span className="console-prompt">›</span><div className="console-entry-body"><div className="console-command"><span className={`console-category console-category--${entry.category.toLowerCase()}`}>{entry.category}</span><code>{entry.command}</code></div><div className="console-result"><span className="result-dot">●</span>{entry.status}</div></div><time>{entry.timestamp}</time></div>)}
        </div>
        <form className="console-input-row" onSubmit={submit}><span className="console-prompt">›</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a selection query or command" aria-label="Command or selection query" /><button className="console-submit" type="submit">Run <span>↵</span></button></form>
        <div className="console-examples"><span className="examples-label">Examples</span><button type="button" onClick={() => setQuery("select all")}>select all</button><button type="button" onClick={() => setQuery("show sticks, all")}>show sticks, all</button><button type="button" onClick={() => setQuery("hide sticks, chain A")}>hide sticks, chain A</button><button type="button" onClick={() => setQuery("dock run")}>dock run</button></div>
      </>}
    </section>
  );
};
