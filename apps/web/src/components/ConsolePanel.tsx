import { FormEvent, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { StructureLoadResult } from "@molecular/contracts";
import { commandSuggestions } from "../commands/commandRegistry";
import { Icon } from "./Icon";

type ConsoleDiagnostic = { message: string; span?: { start: number; end: number } };
type ConsoleEntry = { category: "SYSTEM" | "SELECTION" | "PRESENTATION" | "MEASURE" | "OBJECT" | "VIEW" | "CAPABILITY"; command: string; status: string; timestamp: string; count?: number; diagnostics?: readonly ConsoleDiagnostic[] };
export type ConsoleCommandResult = { category: ConsoleEntry["category"]; status: string; count?: number; diagnostics?: readonly ConsoleDiagnostic[] };

const initialEntries: ConsoleEntry[] = [
  { category: "SYSTEM", command: "renderer status", status: "3Dmol.js adapter ready · no structure loaded", timestamp: "09:41:12" },
  { category: "CAPABILITY", command: "dock run", status: "Unavailable in G1C · no docking engine connected", timestamp: "09:41:15" },
];

export const ConsolePanel = ({ expanded, onToggle, structure, namedSelections = [], onCommand }: { expanded: boolean; onToggle: () => void; structure: StructureLoadResult | null; namedSelections?: readonly { name: string; count: number }[]; onCommand?: (command: string) => ConsoleCommandResult }) => {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState(initialEntries);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const visibleEntries = entries.map((entry, index) => index === 0 && entry.command === "renderer status" ? {
    ...entry,
    status: structure ? `3Dmol.js adapter ready · ${structure.structure.source.originalFilename} loaded` : "3Dmol.js adapter ready · no structure loaded",
  } : entry);

  const submitQuery = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const result = onCommand?.(trimmed) ?? { category: "CAPABILITY" as const, status: "Not executed · authoritative command service is not connected in G1C" };
    setEntries((current) => [...current, { category: result.category, command: trimmed, status: result.status, count: result.count, diagnostics: result.diagnostics, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }]);
    setQuery("");
    setHistoryIndex(-1);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    submitQuery();
  };
  const commandHistory = entries.filter((entry) => entry.command !== "renderer status" && entry.command !== "dock run").map((entry) => entry.command);
  const structureSuggestions = structure ? ["all", "none", "polymer", "ligand", "water", "ions", ...[...new Set(structure.structure.atoms.map((atom) => atom.chain).filter(Boolean))].map((chain) => `chain ${chain}`), ...[...new Set(structure.structure.atoms.map((atom) => atom.residueNumber))].slice(0, 3).map((resi) => `resi ${resi}`), ...structure.structure.atoms.slice(0, 3).map((atom) => `name ${atom.atomName}`), ...namedSelections.map((selection) => `%${selection.name}`)] : [];
  const suggestions = /^(select|center|zoom|label)\s+/i.test(query) ? [...new Set([...commandSuggestions(query), ...structureSuggestions])] : commandSuggestions(query);
  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); submitQuery(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") { event.preventDefault(); setQuery(""); setHistoryIndex(-1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); if (commandHistory.length === 0) return; const next = historyIndex < 0 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1); setHistoryIndex(next); setQuery(commandHistory[next]); }
    if (event.key === "ArrowDown") { event.preventDefault(); if (historyIndex < 0) return; const next = historyIndex + 1; if (next >= commandHistory.length) { setHistoryIndex(-1); setQuery(""); } else { setHistoryIndex(next); setQuery(commandHistory[next]); } }
    if (event.key === "Tab" && suggestions.length > 0) { event.preventDefault(); setQuery(`${suggestions[0]} `); }
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
          {visibleEntries.map((entry, index) => <div className="console-entry" key={`${entry.timestamp}-${index}`}><span className="console-prompt">›</span><div className="console-entry-body"><div className="console-command"><span className={`console-category console-category--${entry.category.toLowerCase()}`}>{entry.category}</span><code>{entry.command}</code></div><div className="console-result"><span className="result-dot">●</span>{entry.status}{entry.count !== undefined && <small> · {entry.count.toLocaleString("en-US")} atoms</small>}</div>{entry.diagnostics?.map((diagnostic, diagnosticIndex) => <div className="console-diagnostic" key={`${diagnostic.message}-${diagnosticIndex}`}>{diagnostic.message}{diagnostic.span ? ` · characters ${diagnostic.span.start + 1}–${diagnostic.span.end}` : ""}</div>)}</div><time>{entry.timestamp}</time></div>)}
        </div>
        <form className="console-input-row" onSubmit={submit}><span className="console-prompt">›</span><input value={query} onChange={(event) => { setQuery(event.target.value); setHistoryIndex(-1); }} onKeyDown={onInputKeyDown} placeholder="Type a selection query or command" aria-label="Command or selection query" /><button className="console-submit" type="submit">Run <span>↵</span></button></form>
        {query.trim() && suggestions.length > 0 && <div className="console-suggestions" role="listbox" aria-label="Command suggestions">{suggestions.slice(0, 20).map((suggestion) => <button type="button" role="option" key={suggestion} onClick={() => setQuery(`${suggestion} `)}>{suggestion}</button>)}</div>}
        <div className="console-examples"><span className="examples-label">Examples · ↑↓ history · Ctrl/Cmd+L clear</span><button type="button" onClick={() => setQuery("select all")}>select all</button><button type="button" onClick={() => setQuery("show sticks, all")}>show sticks, all</button><button type="button" onClick={() => setQuery("select active_site, chain A and resi 50-80")}>named selection</button><button type="button" onClick={() => setQuery("label active_site, {resn}{resi}:{name}")}>safe labels</button></div>
      </>}
    </section>
  );
};
